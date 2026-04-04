// ===== WHATSAPP =====

/** Returns the current user's ID used to scope the WA session. */
function waAccountId() {
  return (currentUser && currentUser.user_id) ? String(currentUser.user_id) : 'default';
}

/**
 * Proxy fetch to the Node WA server via api/whatsapp_proxy.php.
 * path examples: '/status?account=1', '/qr?account=1', '/reset'
 */
async function waFetch(path, method = 'GET', body = null) {
  const [pathPart, qs] = path.split('?');
  let url = 'api/whatsapp_proxy.php?path=' + encodeURIComponent(pathPart);
  if (qs) url += '&' + qs;
  const opts = { method };
  if (body) {
    opts.headers = { 'Content-Type': 'application/json' };
    opts.body = JSON.stringify(body);
  }
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

let waQrPollTimer  = null;
let waModalIsOpen  = false;
let waCurrentTab   = 'message';
let waUploadedFile = null; // { base64, mime, name, size }

function waSetTab(tab) {
  waCurrentTab = tab;
  document.getElementById('wa-msg-section').style.display  = tab === 'message' ? '' : 'none';
  document.getElementById('wa-file-section').style.display = tab === 'file'    ? '' : 'none';
  document.getElementById('wa-tab-msg').className  = 'btn btn-sm ' + (tab === 'message' ? 'btn-primary' : 'btn-secondary');
  document.getElementById('wa-tab-file').className = 'btn btn-sm ' + (tab === 'file'    ? 'btn-primary' : 'btn-secondary');
}

function waHandleFileSelect(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 64 * 1024 * 1024) { toast('File too large (max 64 MB)', 'error'); input.value = ''; return; }
  document.getElementById('wa-file-info-name').textContent = file.name;
  document.getElementById('wa-file-info-size').textContent = file.size < 1024 * 1024
    ? (file.size / 1024).toFixed(1) + ' KB'
    : (file.size / 1024 / 1024).toFixed(2) + ' MB';
  const infoEl = document.getElementById('wa-file-info');
  infoEl.style.display = 'flex';
  const reader = new FileReader();
  reader.onload = e => {
    const [header, base64] = e.target.result.split(',');
    const mime = header.match(/data:([^;]+)/)[1];
    waUploadedFile = { base64, mime, name: file.name, size: file.size };
  };
  reader.readAsDataURL(file);
}

function waRemoveFile() {
  waUploadedFile = null;
  document.getElementById('wa-file-input').value = '';
  document.getElementById('wa-file-info').style.display = 'none';
}

function waInitDropZone() {
  const drop = document.getElementById('wa-file-drop');
  if (!drop || drop._dzInit) return;
  drop._dzInit = true;
  drop.addEventListener('dragover',  e => { e.preventDefault(); drop.style.borderColor = '#25d366'; });
  drop.addEventListener('dragleave', () => { drop.style.borderColor = 'var(--border)'; });
  drop.addEventListener('drop', e => {
    e.preventDefault();
    drop.style.borderColor = 'var(--border)';
    const fi = document.getElementById('wa-file-input');
    const dt = new DataTransfer();
    dt.items.add(e.dataTransfer.files[0]);
    fi.files = dt.files;
    waHandleFileSelect(fi);
  });
}

function openWAModal() {
  waModalIsOpen = true;
  waUploadedFile = null;
  document.getElementById('wa-modal-error').style.display = 'none';
  document.getElementById('wa-modal-success').style.display = 'none';
  document.getElementById('wa-progress').style.display = 'none';
  document.getElementById('wa-send-btn').disabled = false;
  const searchEl = document.getElementById('wa-recipient-search');
  if (searchEl) searchEl.value = '';
  waRenderRecipients();
  openModal('wa-modal-overlay');
  waSetTab('message');
  waCheckAndShowPanel();
  waInitDropZone();
}

function closeWAModal() {
  waModalIsOpen = false;
  clearInterval(waQrPollTimer);
  closeModal('wa-modal-overlay');
}

async function waCheckAndShowPanel() {
  document.getElementById('wa-connect-panel').style.display = '';
  document.getElementById('wa-send-area').style.display = 'none';
  clearInterval(waQrPollTimer);

  try {
    const data = await waFetch('/status?account=' + waAccountId());
    if (data.connected) {
      waShowConnected(data.status);
    } else if (data.hasCreds) {
      waShowResuming();   // has a linked number, just reconnecting
    } else {
      waShowQR();         // no number linked yet — show QR to scan
    }
  } catch(e) {
    _waSetQRPanel();
    document.getElementById('wa-qr-status-text').textContent = 'Unable to connect to WhatsApp server. Please contact the administrator.';
  }
}

/* ── Helpers shared by QR/Resuming panels ─────────────────────────────────── */
function _waSetQRPanel() {
  document.getElementById('wa-qr-section').style.display    = '';
  document.getElementById('wa-connected-bar').style.display = 'none';
  document.getElementById('wa-send-area').style.display     = 'none';
  document.getElementById('wa-force-reset-btn').style.display = 'none';
}
function _waSpinner(msg) {
  document.getElementById('wa-qr-loading').style.display = '';
  document.getElementById('wa-qr-img').style.display     = 'none';
  document.getElementById('wa-qr-status-text').textContent = msg;
}
function _waQRImage(src) {
  document.getElementById('wa-qr-img').src = src;
  document.getElementById('wa-qr-img').style.display     = '';
  document.getElementById('wa-qr-loading').style.display = 'none';
  document.getElementById('wa-qr-status-text').textContent = 'Scan with WhatsApp → Linked Devices → Link a Device';
}

/* ── STATE 1: Connected ────────────────────────────────────────────────────── */
function waShowConnected(statusText) {
  clearInterval(waQrPollTimer);
  document.getElementById('wa-qr-section').style.display    = 'none';
  document.getElementById('wa-connected-bar').style.display = '';
  document.getElementById('wa-conn-normal').style.display   = 'flex';
  document.getElementById('wa-conn-confirm').style.display  = 'none';
  document.getElementById('wa-connected-name').textContent  = statusText || 'Ready to send messages';
  document.getElementById('wa-send-area').style.display     = '';

  // Poll every 8s to detect real drops.
  // Require 2 consecutive disconnected responses before switching UI —
  // Baileys does brief internal restarts (~2-3s) that would otherwise
  // cause false "Resuming" flicker on every keepalive cycle.
  let waDisconnectStreak = 0;
  waQrPollTimer = setInterval(async () => {
    if (!waModalIsOpen) { clearInterval(waQrPollTimer); return; }
    try {
      const d = await waFetch('/status?account=' + waAccountId());
      if (d.connected) {
        waDisconnectStreak = 0; // reset on any connected response
      } else {
        waDisconnectStreak++;
        if (waDisconnectStreak >= 2) {
          clearInterval(waQrPollTimer);
          if (d.hasCreds) waShowResuming(); else waShowQR();
        }
      }
    } catch(e) { /* server blip — keep polling, don't flip state */ }
  }, 8000);
}

/* ── STATE 2: Resuming (has creds, temporarily disconnected) ──────────────── */
function waShowResuming() {
  clearInterval(waQrPollTimer);
  _waSetQRPanel();
  _waSpinner('Loading your WhatsApp session\u2026');

  // Poll every 2s until connected (or until we discover creds are gone)
  waQrPollTimer = setInterval(async () => {
    if (!waModalIsOpen) { clearInterval(waQrPollTimer); return; }
    try {
      const d = await waFetch('/status?account=' + waAccountId());
      if (d.connected) {
        clearInterval(waQrPollTimer);
        waShowConnected(d.status);
      } else if (!d.hasCreds) {
        // Creds were cleared (logout/reset) — show QR
        clearInterval(waQrPollTimer);
        waShowQR();
      }
      // else still resuming — keep spinner, no counter shown
    } catch(e) { /* server blip — keep waiting */ }
  }, 2000);
}

/* ── STATE 3: Needs QR scan (no creds at all) ─────────────────────────────── */
async function waShowQR() {
  clearInterval(waQrPollTimer);
  _waSetQRPanel();
  _waSpinner('Generating QR code\u2026');

  // Initial fetch
  try {
    const data = await waFetch('/qr?account=' + waAccountId());
    if (data.connected) { waShowConnected(data.message); return; }
    if (data.hasCreds)  { waShowResuming(); return; }  // switched to resuming
    if (data.qr) { _waQRImage(data.qr); }
    else { _waSpinner(data.message || 'Generating QR\u2026'); }
  } catch(e) {
    _waSpinner('Server not reachable \u2014 retrying\u2026');
  }

  let qrLoaded = false;
  waQrPollTimer = setInterval(async () => {
    if (!waModalIsOpen) { clearInterval(waQrPollTimer); return; }
    try {
      if (!qrLoaded) {
        const d = await waFetch('/qr?account=' + waAccountId());
        if (d.connected) { clearInterval(waQrPollTimer); waShowConnected(d.message); return; }
        if (d.hasCreds)  { clearInterval(waQrPollTimer); waShowResuming(); return; }
        if (d.qr) { _waQRImage(d.qr); qrLoaded = true; }
        else { _waSpinner(d.message || 'Generating QR\u2026'); }
      } else {
        const d = await waFetch('/status?account=' + waAccountId());
        if (d.connected) { clearInterval(waQrPollTimer); waShowConnected(d.status); }
      }
    } catch(e) { /* keep polling */ }
  }, 2000);
}

async function waRefreshQR() {
  clearInterval(waQrPollTimer);
  await waShowQR();
}

async function waForceReset() {
  clearInterval(waQrPollTimer);
  document.getElementById('wa-force-reset-btn').style.display = 'none';
  _waSpinner('Clearing session\u2026');
  try { await waFetch('/reset', 'POST', { account: waAccountId() }); } catch(e) {}
  await new Promise(r => setTimeout(r, 2000));
  await waShowQR();
}

/* ── Disconnect / Change Number ─────────────────────────────────────────────── */
function waConfirmDisconnect() {
  document.getElementById('wa-conn-normal').style.display  = 'none';
  document.getElementById('wa-conn-confirm').style.display = 'flex';
}
function waCancelDisconnect() {
  document.getElementById('wa-conn-confirm').style.display = 'none';
  document.getElementById('wa-conn-normal').style.display  = 'flex';
}
async function waDoDisconnect() {
  document.getElementById('wa-conn-confirm').style.display = 'none';
  document.getElementById('wa-conn-normal').style.display  = 'flex';
  try {
    await waFetch('/reset', 'POST', { account: waAccountId() });   // clears DB session + reinits → fresh QR
    toast('Number unlinked. Scan QR to connect a new number.', 'success');
    if (waModalIsOpen) { await new Promise(r => setTimeout(r, 1500)); waShowQR(); }
  } catch(e) {
    toast('Could not reach WhatsApp server', 'error');
  }
}
async function waDisconnect() { waConfirmDisconnect(); }


function waRenderRecipients() {
  const list = document.getElementById('wa-recipient-list');
  if (!teachers || !teachers.length) {
    list.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:0.85rem;padding:12px">No teachers loaded</div>';
    return;
  }
  const q = (document.getElementById('wa-recipient-search')?.value || '').toLowerCase().trim();
  const filtered = q
    ? teachers.filter(t => (t.title + ' ' + t.name).toLowerCase().includes(q) || (t.whatsapp || t.phone || '').includes(q))
    : teachers;
  if (!filtered.length) {
    list.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:0.85rem;padding:12px">No results for "' + q + '"</div>';
    waUpdateCount();
    return;
  }
  list.innerHTML = filtered.map(t => {
    const phone = t.whatsapp || t.phone || '';
    const hasPhone = !!phone;
    const style = `display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;padding:6px 4px;cursor:${hasPhone ? 'pointer' : 'default'};border-radius:6px;opacity:${hasPhone ? '1' : '0.45'}`;
    return `<label style="${style}" title="${hasPhone ? '' : 'No phone/WhatsApp number'}">
      <input type="checkbox" class="wa-recipient-check" value="${t.id}"${hasPhone ? '' : ' disabled'} style="accent-color:#25d366">
      <span style="font-size:0.87rem">${t.title} ${t.name}</span>
      <span style="font-size:0.77rem;color:var(--text-muted);text-align:right">${phone || 'No number'}</span>
    </label>`;
  }).join('');
  document.getElementById('wa-recipient-list').addEventListener('change', waUpdateCount);
  waUpdateCount();
}

function waUpdateCount() {
  const checked = document.querySelectorAll('.wa-recipient-check:checked').length;
  document.getElementById('wa-recipient-count').textContent = checked + ' selected';
}

function waSelectAllTeachers() {
  document.querySelectorAll('.wa-recipient-check:not(:disabled)').forEach(c => c.checked = true);
  waUpdateCount();
}
function waDeselectAll() {
  document.querySelectorAll('.wa-recipient-check').forEach(c => c.checked = false);
  waUpdateCount();
}

async function waSendBulk() {
  const checked = Array.from(document.querySelectorAll('.wa-recipient-check:checked')).map(c => parseInt(c.value));
  const errEl = document.getElementById('wa-modal-error');
  const sucEl = document.getElementById('wa-modal-success');
  errEl.style.display = 'none'; sucEl.style.display = 'none';
  if (!checked.length) { errEl.textContent = 'Please select at least one recipient'; errEl.style.display = 'flex'; return; }
  const delay = parseInt(document.getElementById('wa-delay-slider').value) * 1000;

  const isFile = waCurrentTab === 'file';
  let message = '', filePayload = null;
  if (isFile) {
    if (!waUploadedFile) { errEl.textContent = 'Please select a file to send'; errEl.style.display = 'flex'; return; }
    filePayload = {
      data:     waUploadedFile.base64,
      mimetype: waUploadedFile.mime,
      filename: waUploadedFile.name,
      caption:  document.getElementById('wa-file-caption').value.trim(),
    };
  } else {
    message = document.getElementById('wa-message').value.trim();
    if (!message) { errEl.textContent = 'Please enter a message'; errEl.style.display = 'flex'; return; }
  }

  document.getElementById('wa-send-btn').disabled = true;
  document.getElementById('wa-progress').style.display = '';

  let sent = 0, failed = 0, skipped = 0;
  const results = [];

  for (let i = 0; i < checked.length; i++) {
    const tid   = checked[i];
    const t     = teachers.find(x => x.id == tid);
    const raw   = t ? (t.whatsapp || t.phone || '') : '';
    const phone = waFormatPhone(raw);

    document.getElementById('wa-progress-text').textContent = `Sending ${i + 1} of ${checked.length}…`;
    document.getElementById('wa-progress-bar').style.width = Math.round(((i + 1) / checked.length) * 100) + '%';

    if (!phone) {
      skipped++;
      results.push({ id: tid, success: false, skipped: true });
      continue;
    }

    try {
      if (isFile) {
        await waFetch('/send-file-upload', 'POST', { account: waAccountId(), to: phone, ...filePayload });
      } else {
        await waFetch('/send-message', 'POST', { account: waAccountId(), to: phone, message });
      }
      sent++;
      results.push({ id: tid, success: true });
    } catch(e) {
      failed++;
      results.push({ id: tid, success: false, error: e.message });
    }

    if (delay > 0 && i < checked.length - 1) await new Promise(r => setTimeout(r, delay));
  }

  document.getElementById('wa-progress-bar').style.width = '100%';
  const summary = `✅ Sent: ${sent} | Failed: ${failed} | Skipped (no number): ${skipped}`;
  if (failed > 0) {
    const firstErr = results.find(r => !r.success && !r.skipped);
    const detail   = firstErr?.error ? ` — ${firstErr.error}` : '';
    errEl.textContent = summary + detail;
    errEl.style.display = 'flex';
  } else {
    sucEl.textContent = summary;
    sucEl.style.display = 'flex';
    document.getElementById('wa-message').value = '';  // clear after successful send
    waRemoveFile();
  }
  document.getElementById('wa-send-btn').disabled = false;
  document.getElementById('wa-progress').style.display = 'none';
}

