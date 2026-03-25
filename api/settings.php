<?php
require_once '../includes/config.php';
requireAuth();

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

$days = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];

if ($method === 'GET') {
    $result = $db->query("SELECT `key`, `value` FROM settings");
    $settings = [];
    while ($row = $result->fetch_assoc()) {
        $settings[$row['key']] = $row['value'];
    }
    if (!isset($settings['school_start'])) $settings['school_start'] = '08:00';
    if (!isset($settings['school_end']))   $settings['school_end']   = '14:00';
    // Return per-day settings (empty string = use default / school off)
    foreach ($days as $d) {
        if (!isset($settings["{$d}_start"])) $settings["{$d}_start"] = '';
        if (!isset($settings["{$d}_end"]))   $settings["{$d}_end"]   = '';
    }
    jsonResponse($settings);
}

// ── AI Settings (openai_api_key, openai_model) — handle before the school-hours POST
if ($method === 'POST' && isset($_GET['ai'])) {
    requireSuperAdmin();
    $data = json_decode(file_get_contents('php://input'), true);
    $stmt = $db->prepare("INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?");

    if (!empty(trim($data['openai_api_key'] ?? ''))) {
        $key = 'openai_api_key';
        $val = trim($data['openai_api_key']);
        $stmt->bind_param('sss', $key, $val, $val);
        $stmt->execute();
    }
    if (!empty(trim($data['openai_model'] ?? ''))) {
        $key = 'openai_model';
        $val = trim($data['openai_model']);
        $stmt->bind_param('sss', $key, $val, $val);
        $stmt->execute();
    }
    jsonResponse(['success' => true]);
}

if ($method === 'POST') {
    requireAdmin();
    $data = json_decode(file_get_contents('php://input'), true);

    $school_start = trim($data['school_start'] ?? '08:00');
    $school_end   = trim($data['school_end']   ?? '14:00');

    if (empty($school_start) || empty($school_end)) {
        jsonResponse(['error' => 'Default start and end times are required'], 400);
    }

    $stmt = $db->prepare("INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?");

    // Save school defaults
    foreach (['school_start' => $school_start, 'school_end' => $school_end] as $key => $val) {
        $stmt->bind_param('sss', $key, $val, $val);
        $stmt->execute();
    }

    // Save per-day school hours
    foreach ($days as $d) {
        $dStart = isset($data["{$d}_start"]) ? trim($data["{$d}_start"]) : '';
        $dEnd   = isset($data["{$d}_end"])   ? trim($data["{$d}_end"])   : '';
        $keyS = "{$d}_start"; $keyE = "{$d}_end";
        $stmt->bind_param('sss', $keyS, $dStart, $dStart); $stmt->execute();
        $stmt->bind_param('sss', $keyE, $dEnd,   $dEnd);   $stmt->execute();
    }

    // Save class-specific hours — matches classid_{id}_start, classid_{id}_end,
    // classid_{id}_{day}_start, classid_{id}_{day}_end
    foreach ($data as $key => $val) {
        if (preg_match('/^classid_\d+_([a-z]+_)?(start|end)$/', $key)) {
            $val = trim($val);
            $stmt->bind_param('sss', $key, $val, $val);
            $stmt->execute();
        }
    }

    jsonResponse(['success' => true, 'school_start' => $school_start, 'school_end' => $school_end]);
}
