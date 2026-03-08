/**
 * WhatsApp Server — Baileys edition
 * Session stored in MySQL (idltimetable.wa_session) — no file clutter,
 * survives restarts automatically, easy to reset from the UI.
 */

const express    = require('express');
const mysql      = require('mysql2/promise');
const https      = require('https');
const http       = require('http');
const {
    default: makeWASocket,
    DisconnectReason,
    fetchLatestBaileysVersion,
    initAuthCreds,
    BufferJSON,
    proto,
} = require('@whiskeysockets/baileys');
const { Boom }   = require('@hapi/boom');
const QRCode     = require('qrcode');
const qrTerminal = require('qrcode-terminal');
const pino       = require('pino');

const app  = express();
const PORT = process.env.WA_PORT || 3001;

// --- Process-level crash guard ---
process.on('uncaughtException',  err => console.error('[uncaughtException]',  err?.message || err));
process.on('unhandledRejection', r   => console.error('[unhandledRejection]', r?.message   || r));

// --- Credential-save queue (prevents race conditions during rapid creds.update events) ---
const credsQueues = new Map();
function queueCredsSave(accountId, saveFn) {
    if (!credsQueues.has(accountId)) credsQueues.set(accountId, Promise.resolve());
    const next = credsQueues.get(accountId).then(saveFn).catch(e =>
        console.error(`[${accountId}] queued creds save error:`, e.message)
    );
    credsQueues.set(accountId, next);
    return next;
}

app.use(express.json({ limit: '100mb' }));

// Allow cross-origin requests from the PHP app
const allowed_origins = [
    'https://tools.idl.edu.pk',
    'http://tools.idl.edu.pk', // optional if someone uses http
];

app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (allowed_origins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

// --- Per-account session state ---
// Each account gets its own Map entry with connection + health tracking
const sessions = new Map();

function getSession(accountId) {
    if (!sessions.has(accountId)) {
        sessions.set(accountId, {
            sock:              null,
            isReady:           false,
            hasCreds:          false,
            qrDataUrl:         null,
            statusMsg:         'Starting…',
            reconnectDelay:    2000,
            reconnectTimer:    null,
            consecutiveFails:  0,       // track repeated failures before clearing session
            healthTimer:       null,    // periodic health check
            lastActivity:      0,       // timestamp of last successful WA event
        });
    }
    return sessions.get(accountId);
}

/** Extract accountId from request — query param for GET, body field for POST. */
function getAccountId(req) {
    return (req.query.account || req.body?.account || 'default').toString().trim();
}

// --- Helpers ---

/**
 * Build the WhatsApp JID (Jabber ID) from a phone number.
 * Baileys uses @s.whatsapp.net for individual chats.
 */
function formatJid(phone) {
    return phone.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
}

/** Download a remote URL into a Buffer. */
function fetchBuffer(url) {
    return new Promise((resolve, reject) => {
        const mod = url.startsWith('https') ? https : http;
        mod.get(url, res => {
            const chunks = [];
            res.on('data', c  => chunks.push(c));
            res.on('end',  () => resolve({
                buffer: Buffer.concat(chunks),
                mime:   res.headers['content-type'] || 'application/octet-stream',
            }));
            res.on('error', reject);
        }).on('error', reject);
    });
}

// --- Database session ---
let _pool = null;
async function getPool() {
    if (_pool) return _pool;
    _pool = mysql.createPool({
        host: '10.0.2.27', user: 'aalyan', password: '7D9eA69WshnOp7rzxTv1', database: 'IDLtimetable',
        waitForConnections: true, connectionLimit: 5,
        enableKeepAlive: true,      // prevent MySQL dropping idle connections
        keepAliveInitialDelay: 30000,
    });
    await _pool.query(`
        CREATE TABLE IF NOT EXISTS wa_session (
            id VARCHAR(200) PRIMARY KEY,
            data MEDIUMTEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('DB session table ready.');
    return _pool;
}

/**
 * Custom Baileys auth-state backed by MySQL.
 * All keys are prefixed with accountId: so each account has isolated storage.
 */
async function useDBAuthState(accountId) {
    const db = await getPool();
    const prefix = accountId + ':';

    const readData = async (id) => {
        try {
            const [rows] = await db.query('SELECT data FROM wa_session WHERE id = ?', [prefix + id]);
            if (!rows.length) return null;
            return JSON.parse(rows[0].data, BufferJSON.reviver);
        } catch (err) {
            console.error(`[${accountId}] readData(${id}) error:`, err.message);
            return null;
        }
    };
    const writeData = async (id, data) => {
        const json = JSON.stringify(data, BufferJSON.replacer);
        await db.query(
            'INSERT INTO wa_session (id,data) VALUES (?,?) ON DUPLICATE KEY UPDATE data=VALUES(data), updated_at=NOW()',
            [prefix + id, json]
        );
    };
    const removeData = async (id) => {
        await db.query('DELETE FROM wa_session WHERE id = ?', [prefix + id]);
    };

    const savedCreds = await readData('creds');
    const creds = savedCreds || initAuthCreds();
    const sess  = getSession(accountId);
    sess.hasCreds = !!savedCreds;

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(ids.map(async id => {
                        let value = await readData(`${type}-${id}`);
                        if (type === 'app-state-sync-key' && value) {
                            value = proto.Message.AppStateSyncKeyData.fromObject(value);
                        }
                        data[id] = value;
                    }));
                    return data;
                },
                set: async (data) => {
                    const tasks = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            tasks.push(value
                                ? writeData(`${category}-${id}`, value)
                                : removeData(`${category}-${id}`)
                            );
                        }
                    }
                    await Promise.all(tasks);
                },
            },
        },
        saveCreds: async () => {
            await queueCredsSave(accountId, async () => {
                await writeData('creds', creds);
                getSession(accountId).hasCreds = true;
            });
        },
    };
}

/** Clear session for one account — next init will show a fresh QR. */
function clearSession(accountId) {
    const sess = getSession(accountId);
    sess.isReady  = false;
    sess.hasCreds = false;
    sess.qrDataUrl = null;
    const prefix = accountId + ':';
    getPool().then(db =>
        db.query('DELETE FROM wa_session WHERE id LIKE ?', [prefix + '%'])
          .then(() => console.log(`Session cleared for account: ${accountId}`))
          .catch(e  => console.error('clearSession error:', e.message))
    );
}

// --- WhatsApp client initialisation ---

function scheduleReconnect(accountId, ms) {
    const sess = getSession(accountId);
    clearTimeout(sess.reconnectTimer);
    sess.reconnectTimer = setTimeout(() => initClient(accountId), ms);
    sess.reconnectDelay = Math.min(sess.reconnectDelay * 1.3, 15000); // gentler backoff, 15s max
}

function destroySock(accountId) {
    const sess = getSession(accountId);
    clearInterval(sess.healthTimer);
    sess.healthTimer = null;
    if (sess.sock) {
        try { sess.sock.ev.removeAllListeners(); } catch (_) {}
        try { sess.sock.end(); } catch (_) {}
        sess.sock = null;
    }
}

async function initClient(accountId) {
    destroySock(accountId);
    const sess = getSession(accountId);
    try {
        const { state, saveCreds } = await useDBAuthState(accountId);

        // Use the version bundled with Baileys — fetchLatestBaileysVersion() is
        // unreliable and can return wrong values that cause protocol mismatches.
        let version;
        try {
            const latest = await fetchLatestBaileysVersion();
            if (latest?.version) version = latest.version;
        } catch (_) {}
        if (!version) version = [2, 3000, 1017531287];  // safe fallback
        console.log(`[${accountId}] WA Web v${version.join('.')} | hasCreds=${sess.hasCreds}`);

        // Set appropriate status before connecting
        sess.statusMsg = sess.hasCreds ? 'Resuming session…' : 'Generating QR code…';

        sess.sock = makeWASocket({
            version,
            auth:                           state,
            logger:                         pino({ level: 'silent' }),
            printQRInTerminal:              false,
            browser:                        ['IDL-Timetable', 'Chrome', '131.0.0.0'],
            markOnlineOnConnect:            false,
            syncFullHistory:                false,
            connectTimeoutMs:               60000,
            defaultQueryTimeoutMs:          undefined,  // no timeout on queries
            keepAliveIntervalMs:            15000,      // more frequent pings = stabler connection
            retryRequestDelayMs:            2000,
            generateHighQualityLinkPreview: false,
            // Required: Baileys calls this on message retries. Without it,
            // retry failures accumulate and WhatsApp drops the session.
            getMessage: async (key) => {
                return { conversation: '' };   // we don't store messages; return empty
            },
        });

        // Connection / QR updates
        sess.sock.ev.on('connection.update', async update => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                qrTerminal.generate(qr, { small: true });
                sess.qrDataUrl = await QRCode.toDataURL(qr);
                sess.isReady   = false;
                sess.statusMsg = 'Waiting for QR scan';
                console.log(`[${accountId}] QR ready.`);
            }

            if (connection === 'open') {
                sess.isReady           = true;
                sess.hasCreds          = true;
                sess.qrDataUrl         = null;
                sess.statusMsg         = 'Connected';
                sess.reconnectDelay    = 2000;
                sess.consecutiveFails  = 0;
                sess.lastActivity      = Date.now();
                console.log(`[${accountId}] WhatsApp connected ✓`);

                // Health check — reconnect only if no activity for 3+ minutes
                clearInterval(sess.healthTimer);
                sess.healthTimer = setInterval(() => {
                    const silentMs = Date.now() - sess.lastActivity;
                    if (silentMs > 180000) {  // 3 minutes with no events = likely dead
                        console.log(`[${accountId}] Health check: no activity for ${Math.round(silentMs/1000)}s, reconnecting…`);
                        destroySock(accountId);
                        scheduleReconnect(accountId, 2000);
                    }
                }, 60000); // check every 60s
            }

            if (connection === 'close') {
                sess.isReady   = false;
                sess.qrDataUrl = null;
                clearInterval(sess.healthTimer);
                sess.healthTimer = null;

                const errCode = (lastDisconnect?.error instanceof Boom)
                    ? lastDisconnect.error.output.statusCode
                    : lastDisconnect?.error?.message || 'unknown';

                console.log(`[${accountId}] Disconnected — reason: ${errCode} (consecutive=${sess.consecutiveFails})`);

                // Only clear session on explicit logout from the phone
                if (errCode === DisconnectReason.loggedOut) {
                    sess.statusMsg = 'Logged out from phone — scan QR to reconnect';
                    sess.consecutiveFails = 0;
                    clearSession(accountId);
                    scheduleReconnect(accountId, 2000);

                // For badSession/401 — retry with existing creds first;
                // only wipe after 10 consecutive SAME-TYPE failures
                } else if (errCode === DisconnectReason.badSession || errCode === 401) {
                    sess.consecutiveFails++;
                    if (sess.consecutiveFails >= 10) {
                        console.log(`[${accountId}] 10 consecutive 401s — clearing session.`);
                        sess.statusMsg = 'Session expired — scan QR to reconnect';
                        sess.consecutiveFails = 0;
                        clearSession(accountId);
                        scheduleReconnect(accountId, 3000);
                    } else {
                        sess.statusMsg = 'Reconnecting…';
                        scheduleReconnect(accountId, sess.reconnectDelay);
                    }

                // For forbidden/403 — also retry before clearing
                } else if (errCode === DisconnectReason.forbidden || errCode === 403) {
                    sess.consecutiveFails++;
                    if (sess.consecutiveFails >= 10) {
                        console.log(`[${accountId}] 10 consecutive 403s — clearing session.`);
                        sess.statusMsg = 'Account restricted — scan QR to reconnect';
                        sess.consecutiveFails = 0;
                        clearSession(accountId);
                        scheduleReconnect(accountId, 5000);
                    } else {
                        sess.statusMsg = 'Reconnecting…';
                        scheduleReconnect(accountId, sess.reconnectDelay);
                    }

                // All other reasons (restartRequired, timeout, connectionLost, network blip)
                // — always keep creds, reset consecutiveFails since it's a different issue
                } else {
                    sess.consecutiveFails = 0;  // different error type — reset counter
                    sess.statusMsg = sess.hasCreds ? 'Resuming session…' : 'Reconnecting…';
                    scheduleReconnect(accountId, sess.reconnectDelay);
                }
            }
        });

        sess.sock.ev.on('creds.update', async (...args) => {
            sess.lastActivity = Date.now();
            await saveCreds(...args);
        });

        // Process message history events to avoid protocol errors
        sess.sock.ev.on('messaging-history.set', ({ chats, contacts, messages, isLatest }) => {
            sess.lastActivity = Date.now();
            // Just acknowledge — we don't need to store chat history
        });

    } catch (err) {
        console.error(`[${accountId}] initClient error:`, err.message);
        const sess = getSession(accountId);
        sess.statusMsg = sess.hasCreds ? 'Resuming session…' : 'Starting…';
        scheduleReconnect(accountId, sess.reconnectDelay);
    }
}

/** On startup: reconnect all accounts that have stored creds in the DB. */
async function initAllStoredSessions() {
    try {
        const db = await getPool();
        const [rows] = await db.query("SELECT id FROM wa_session WHERE id LIKE '%:creds'");
        for (const row of rows) {
            const accountId = row.id.replace(/:creds$/, '');
            if (accountId) {
                console.log(`Reconnecting stored session for account: ${accountId}`);
                initClient(accountId);
            }
        }
        if (!rows.length) console.log('No stored sessions found — waiting for first scan.');
    } catch (e) {
        console.error('initAllStoredSessions error:', e.message);
    }
}

initAllStoredSessions();

// --- Routes ---

/**
 * GET /status?account=<id>
 * { connected, hasCreds, status }
 */
app.get('/status', (req, res) => {
    const accountId = getAccountId(req);
    const sess = getSession(accountId);
    // Lazily start if not yet initialised (no stored session)
    if (!sess.sock && !sess.hasCreds && !sess.reconnectTimer) {
        initClient(accountId);
    }
    res.json({ connected: sess.isReady, hasCreds: sess.hasCreds, status: sess.statusMsg });
});

/**
 * GET /qr?account=<id>
 * { connected, hasCreds, qr?, message }
 */
app.get('/qr', (req, res) => {
    const accountId = getAccountId(req);
    const sess = getSession(accountId);
    if (!sess.sock && !sess.hasCreds && !sess.reconnectTimer) {
        initClient(accountId);
    }
    if (sess.isReady)   return res.json({ connected: true,  hasCreds: true,  message: sess.statusMsg });
    if (sess.qrDataUrl) return res.json({ connected: false, hasCreds: false, qr: sess.qrDataUrl });
    return res.json({ connected: false, hasCreds: sess.hasCreds, qr: null, message: sess.statusMsg });
});

/** POST /send-message — { account, to, message } */
app.post('/send-message', async (req, res) => {
    const accountId = getAccountId(req);
    const sess = getSession(accountId);
    if (!sess.isReady || !sess.sock) return res.status(503).json({ error: 'WhatsApp not connected.' });
    const { to, message } = req.body;
    if (!to || !message) return res.status(400).json({ error: 'to and message are required' });
    try {
        await sess.sock.sendMessage(formatJid(to), { text: message });
        res.json({ sent: 'true', message: 'Sent successfully' });
    } catch (err) {
        console.error(`[${accountId}] send-message error:`, err.message);
        res.status(500).json({ error: err.message });
    }
});

/** POST /send-file — { account, to, file_url, caption, filename } */
app.post('/send-file', async (req, res) => {
    const accountId = getAccountId(req);
    const sess = getSession(accountId);
    if (!sess.isReady || !sess.sock) return res.status(503).json({ error: 'WhatsApp not connected.' });
    const { to, file_url, caption = '', filename = 'document.pdf' } = req.body;
    if (!to || !file_url) return res.status(400).json({ error: 'to and file_url are required' });
    try {
        const { buffer, mime } = await fetchBuffer(file_url);
        await sess.sock.sendMessage(formatJid(to), {
            document: buffer,
            mimetype: mime,
            fileName: filename,
            caption,
        });
        res.json({ sent: 'true', message: 'File sent successfully' });
    } catch (err) {
        console.error(`[${accountId}] send-file error:`, err.message);
        res.status(500).json({ error: err.message });
    }
});

/** POST /send-file-upload — { account, to, data (base64), mimetype, filename, caption } */
app.post('/send-file-upload', async (req, res) => {
    const accountId = getAccountId(req);
    const sess = getSession(accountId);
    if (!sess.isReady || !sess.sock) return res.status(503).json({ error: 'WhatsApp not connected.' });
    const { to, data, mimetype, filename = 'file', caption = '' } = req.body;
    if (!to || !data || !mimetype) return res.status(400).json({ error: 'to, data and mimetype are required' });
    try {
        const buffer = Buffer.from(data, 'base64');
        const msgContent = { document: buffer, mimetype, fileName: filename };
        if (caption) msgContent.caption = caption;
        await sess.sock.sendMessage(formatJid(to), msgContent);
        res.json({ sent: 'true', message: 'File sent successfully' });
    } catch (err) {
        console.error(`[${accountId}] send-file-upload error:`, err.message);
        res.status(500).json({ error: err.message });
    }
});

/** POST /reset — { account } — clear session, generate fresh QR */
app.post('/reset', async (req, res) => {
    const accountId = getAccountId(req);
    const sess = getSession(accountId);
    destroySock(accountId);
    clearSession(accountId);
    sess.statusMsg      = 'Cleared — generating new QR…';
    sess.reconnectDelay = 3000;
    clearTimeout(sess.reconnectTimer);
    setTimeout(() => initClient(accountId), 1000);
    res.json({ success: true });
});

/** POST /logout — { account } — graceful WA logout then fresh QR */
app.post('/logout', async (req, res) => {
    const accountId = getAccountId(req);
    const sess = getSession(accountId);
    try { if (sess.sock) await sess.sock.logout().catch(() => {}); } catch (_) {}
    clearSession(accountId);
    sess.statusMsg = 'Logged out — generating new QR…';
    clearTimeout(sess.reconnectTimer);
    setTimeout(() => initClient(accountId), 1500);
    res.json({ success: true });
});

// --- Start ---
const server = app.listen(PORT, () => {
    console.log(`WhatsApp (Baileys) server listening on http://localhost:${PORT}`);
    console.log('No browser required — pure WebSocket connection.');
});

server.on('error', err => {
    if (err.code === 'EADDRINUSE') {
        console.error(`[ERROR] Port ${PORT} is already in use.`);
        console.error(`  Run:  Stop-Process -Name node -Force`);
        process.exit(1);
    } else {
        console.error('[server error]', err.message);
    }
});
