<?php
/**
 * WhatsApp API Handler
 * Supports two providers:
 *   - local    → free, uses your own number via the local Node wa-server
 *   - ultramsg → paid, uses UltraMsg cloud API
 *
 * Uses PHP native stream context instead of cURL —
 * no extension dependency, lighter and faster for local loopback calls.
 */

// Raise memory limit at runtime (post_max_size requires .htaccess or php.ini)
ini_set('memory_limit', '256M');
ini_set('max_execution_time', '120');

require_once '../includes/config.php';
requireAuth();
requireAdmin();

// ─── Accept POST only ─────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method not allowed'], 405);
}

// ─── Parse request body ───────────────────────────────────────────────────────
$rawInput = file_get_contents('php://input');

// Detect if Apache/PHP silently truncated the body due to post_max_size
$contentLength = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
if ($contentLength > 0 && strlen($rawInput) < $contentLength) {
    jsonResponse(['error' => "Upload too large for server config ({$contentLength} bytes received). Ask your admin to increase post_max_size in php.ini or .htaccess."], 413);
}

$data   = json_decode($rawInput, true) ?? [];
$action = $data['action'] ?? '';

// ─── Load WhatsApp settings from DB ──────────────────────────────────────────
$db  = getDB();
$res = $db->query("SELECT `key`, `value` FROM settings WHERE `key` LIKE 'wa_%'");
$s   = [];
while ($row = $res->fetch_assoc()) $s[$row['key']] = $row['value'];

$provider  = $s['wa_provider']        ?? 'local';          // 'local' | 'ultramsg'
$localUrl  = rtrim($s['wa_local_url'] ?? 'https://kirk-njs.web02.empoweric.com', '/');
$apiUrl    = rtrim($s['wa_api_url']   ?? 'https://api.ultramsg.com', '/');
$instanceId= $s['wa_instance']   ?? '';
$apiKey    = $s['wa_api_key']    ?? '';
$delayMs   = (int)($s['wa_delay_ms'] ?? 4000);             // ms between bulk messages

// Account ID scopes the WhatsApp session to the current logged-in user
$accountId = (string)($_SESSION['user_id'] ?? 'default');

// Validate UltraMsg config when that provider is active
if ($provider === 'ultramsg' && (empty($apiKey) || empty($instanceId))) {
    jsonResponse(['error' => 'UltraMsg not configured. Set wa_api_key, wa_instance and wa_api_url in Settings.'], 400);
}

// ─── Local-only: connection status ───────────────────────────────────────────
if ($action === 'status') {
    if ($provider !== 'local') jsonResponse(['error' => 'status requires local provider'], 400);
    jsonResponse(httpRequest("$localUrl/status?account=$accountId", 'GET'));
}

// ─── Local-only: fetch QR code ────────────────────────────────────────────────
if ($action === 'get_qr') {
    if ($provider !== 'local') jsonResponse(['error' => 'get_qr requires local provider'], 400);
    jsonResponse(httpRequest("$localUrl/qr?account=$accountId", 'GET'));
}

// ─── Local-only: logout / unlink number ──────────────────────────────────────
if ($action === 'logout') {
    if ($provider !== 'local') jsonResponse(['error' => 'logout requires local provider'], 400);
    jsonResponse(httpRequest("$localUrl/logout", 'POST', ['account' => $accountId]));
}

// ─── Send a single text message ───────────────────────────────────────────────
if ($action === 'send_message') {
    $to      = trim($data['to']      ?? '');
    $message = trim($data['message'] ?? '');
    if (!$to || !$message) jsonResponse(['error' => 'to and message are required'], 400);

    jsonResponse($provider === 'local'
        ? httpRequest("$localUrl/send-message", 'POST', ['account' => $accountId, 'to' => $to, 'message' => $message])
        : httpRequest("$apiUrl/instance$instanceId/messages/chat", 'POST',
            ['token' => $apiKey, 'to' => $to, 'body' => $message], 'form')
    );
}

// ─── Send a file / PDF via URL ────────────────────────────────────────────────────
if ($action === 'send_file') {
    $to       = trim($data['to']       ?? '');
    $fileUrl  = trim($data['file_url'] ?? '');
    $caption  = trim($data['caption']  ?? '');
    $filename = trim($data['filename'] ?? 'document.pdf');
    if (!$to || !$fileUrl) jsonResponse(['error' => 'to and file_url are required'], 400);

    jsonResponse($provider === 'local'
        ? httpRequest("$localUrl/send-file", 'POST', ['account' => $accountId, 'to' => $to, 'file_url' => $fileUrl, 'caption' => $caption, 'filename' => $filename])
        : httpRequest("$apiUrl/instance$instanceId/messages/document", 'POST',
            ['token' => $apiKey, 'to' => $to, 'document' => $fileUrl, 'caption' => $caption, 'filename' => $filename], 'form')
    );
}

// ─── Send a file uploaded from the user\'s computer (base64) ───────────────────────
// Only supported by the local provider (UltraMsg requires a public URL)
if ($action === 'send_file_upload') {
    if ($provider !== 'local') jsonResponse(['error' => 'File upload requires local provider'], 400);
    $to       = trim($data['to']       ?? '');
    $fileData = $data['file_data']     ?? '';   // base64-encoded file content
    $mimeType = trim($data['mime_type'] ?? 'application/octet-stream');
    $filename = trim($data['filename']  ?? 'file');
    $caption  = trim($data['caption']   ?? '');
    if (!$to || !$fileData) jsonResponse(['error' => 'to and file_data are required'], 400);
    jsonResponse(httpRequest("$localUrl/send-file-upload", 'POST', [
        'account'  => $accountId,
        'to'       => $to,
        'data'     => $fileData,
        'mimetype' => $mimeType,
        'filename' => $filename,
        'caption'  => $caption,
    ]));
}

// ─── Bulk send to multiple teachers ──────────────────────────────────────────
if ($action === 'bulk_send') {
    $teacherIds = $data['teacher_ids'] ?? [];
    $message    = trim($data['message']  ?? '');
    $fileUrl    = trim($data['file_url'] ?? '');
    $caption    = trim($data['caption']  ?? '');
    $filename   = trim($data['filename'] ?? 'document.pdf');
    $sendType   = $data['send_type'] ?? 'message'; // 'message' | 'file'

    if (empty($teacherIds))                          jsonResponse(['error' => 'No teachers selected'], 400);
    if ($sendType === 'message' && empty($message))  jsonResponse(['error' => 'Message text is required'], 400);
    if ($sendType === 'file') {
        $fileSource = $data['file_source'] ?? 'url'; // 'url' | 'upload'
        $fileData   = $data['file_data']   ?? '';    // base64 (upload mode)
        $mimeType   = $data['mime_type']   ?? 'application/octet-stream';
        if ($fileSource === 'url'    && empty($fileUrl))  jsonResponse(['error' => 'File URL is required'], 400);
        if ($fileSource === 'upload' && empty($fileData)) jsonResponse(['error' => 'File data is required'], 400);
        if ($fileSource === 'upload' && $provider !== 'local') jsonResponse(['error' => 'File upload mode requires local provider'], 400);
    }

    // Fetch teachers who have a contact number
    $placeholders = implode(',', array_fill(0, count($teacherIds), '?'));
    $stmt = $db->prepare(
        "SELECT id, title, name, whatsapp, phone FROM teachers
         WHERE id IN ($placeholders) AND (whatsapp <> '' OR phone <> '')"
    );
    $stmt->bind_param(str_repeat('i', count($teacherIds)), ...$teacherIds);
    $stmt->execute();
    $teachers = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

    $sent = $failed = 0;
    $results = [];

    foreach ($teachers as $i => $t) {
        // Throttle: pause between sends to avoid rate-limiting
        if ($i > 0) usleep($delayMs * 1000);

        // Prefer WhatsApp number, fall back to phone; normalise to +92 E.164
        $phone = preg_replace('/[^0-9+]/', '', $t['whatsapp'] ?: $t['phone']);
        if (str_starts_with($phone, '0')) $phone = '+92' . substr($phone, 1);

        if ($sendType === 'message') {
            $r = ($provider === 'local')
                ? httpRequest("$localUrl/send-message", 'POST', ['account' => $accountId, 'to' => $phone, 'message' => $message])
                : httpRequest("$apiUrl/instance$instanceId/messages/chat", 'POST',
                    ['token' => $apiKey, 'to' => $phone, 'body' => $message], 'form');
        } elseif (($fileSource ?? 'url') === 'upload') {
            // File uploaded from computer — send base64 data directly to local Node server
            $r = httpRequest("$localUrl/send-file-upload", 'POST', [
                'account'  => $accountId,
                'to'       => $phone,
                'data'     => $fileData,
                'mimetype' => $mimeType,
                'filename' => $filename,
                'caption'  => $caption,
            ], 'json', 120);
        } else {
            $r = ($provider === 'local')
                ? httpRequest("$localUrl/send-file", 'POST', ['account' => $accountId, 'to' => $phone, 'file_url' => $fileUrl, 'caption' => $caption, 'filename' => $filename])
                : httpRequest("$apiUrl/instance$instanceId/messages/document", 'POST',
                    ['token' => $apiKey, 'to' => $phone, 'document' => $fileUrl, 'caption' => $caption, 'filename' => $filename], 'form');
        }

        $ok = isset($r['sent']) && $r['sent'] === 'true';
        $ok ? $sent++ : $failed++;
        $results[] = ['teacher_id' => $t['id'], 'name' => "{$t['title']} {$t['name']}", 'phone' => $phone, 'success' => $ok, 'error' => $ok ? null : ($r['error'] ?? 'Unknown error')];
    }

    jsonResponse([
        'success' => true,
        'sent'    => $sent,
        'failed'  => $failed,
        'total'   => count($teachers),
        'skipped' => count($teacherIds) - count($teachers),
        'results' => $results,
    ]);
}

jsonResponse(['error' => 'Unknown action'], 400);

// ─── HTTP helper (replaces cURL) ─────────────────────────────────────────────
/**
 * Lightweight HTTP request using PHP native stream context.
 * No cURL extension required — works out of the box on any PHP install.
 *
 * @param string $url         Full URL to call
 * @param string $method      'GET' | 'POST'
 * @param array  $body        Payload array (POST only)
 * @param string $contentType 'json' (default) | 'form'
 */
function httpRequest(string $url, string $method = 'GET', array $body = [], string $contentType = 'json', int $timeout = 30): array {
    // Try cURL first (more reliable on Windows/XAMPP), fall back to stream context
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => $timeout,
            CURLOPT_FOLLOWLOCATION => true,
        ]);
        if ($method === 'POST') {
            $postBody = $contentType === 'form' ? http_build_query($body) : json_encode($body);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $postBody);
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                $contentType === 'form' ? 'Content-Type: application/x-www-form-urlencoded' : 'Content-Type: application/json',
            ]);
        }
        $raw  = curl_exec($ch);
        $err  = curl_error($ch);
        curl_close($ch);
        if ($raw === false) return ['error' => "Cannot reach $url — $err"];
        return json_decode($raw, true) ?? ['raw' => $raw];
    }

    // Fallback: PHP stream context
    $opts = ['http' => [
        'method'          => $method,
        'ignore_errors'   => true,
        'timeout'         => $timeout,
        'follow_location' => 1,
    ]];
    if ($method === 'POST') {
        if ($contentType === 'form') {
            $opts['http']['content'] = http_build_query($body);
            $opts['http']['header']  = "Content-Type: application/x-www-form-urlencoded\r\n";
        } else {
            $opts['http']['content'] = json_encode($body);
            $opts['http']['header']  = "Content-Type: application/json\r\n";
        }
    }
    $raw = @file_get_contents($url, false, stream_context_create($opts));
    if ($raw === false) return ['error' => "Cannot reach $url — is the server running?"];
    return json_decode($raw, true) ?? ['raw' => $raw];
}