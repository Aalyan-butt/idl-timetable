<?php
require_once '../includes/config.php';
requireSuperAdmin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method not allowed'], 405);
}

$data = json_decode(file_get_contents('php://input'), true);
$message     = trim($data['message']      ?? '');
$history     = is_array($data['history']) ? $data['history'] : [];
$fileContent = isset($data['file_content']) ? trim($data['file_content']) : null;

if ($message === '' && ($fileContent === null || $fileContent === '')) {
    jsonResponse(['error' => 'Message or file content is required'], 400);
}

$db = getDB();

// ── Get OpenAI API key from settings ──────────────────────────────────────────
$apiKey = '';
$aiModel = 'gpt-4o-mini';
$keyResult = $db->query("SELECT `key`, `value` FROM settings WHERE `key` IN ('openai_api_key','openai_model')");
while ($row = $keyResult->fetch_assoc()) {
    if ($row['key'] === 'openai_api_key') $apiKey   = $row['value'];
    if ($row['key'] === 'openai_model')   $aiModel  = $row['value'];
}

if (empty(trim($apiKey))) {
    jsonResponse(['error' => 'OpenAI API key not configured. Please add it in Settings → AI Settings.'], 400);
}

// ── Fetch system context from DB ──────────────────────────────────────────────

// Teachers
$teacherRows = $db->query("SELECT id, title, name FROM teachers ORDER BY name");
$teacherList = [];
$teacherMap  = [];
while ($t = $teacherRows->fetch_assoc()) {
    $label = trim($t['title'] . ' ' . $t['name']);
    $teacherList[] = $label;
    $teacherMap[$t['id']] = $label;
}

// Classes
$classRows = $db->query("SELECT id, name FROM classes ORDER BY name");
$classList = [];
$classMap  = [];
while ($c = $classRows->fetch_assoc()) {
    $classList[] = $c['name'];
    $classMap[$c['id']] = $c['name'];
}

// Timetable (compact representation)
$ttRows = $db->query(
    "SELECT t.id, t.class_id, t.subject, t.teacher_ids, t.days, t.start_time, t.end_time, t.is_break
     FROM timetable t ORDER BY t.class_id, t.start_time"
);
$timetableLines = [];
while ($s = $ttRows->fetch_assoc()) {
    $cn    = $classMap[$s['class_id']] ?? "Class#{$s['class_id']}";
    $start = substr($s['start_time'], 0, 5);
    $end   = substr($s['end_time'],   0, 5);
    if ($s['is_break']) {
        $timetableLines[] = "{$cn}: BREAK {$start}-{$end} ({$s['days']})";
    } else {
        $tIds  = array_filter(array_map('trim', explode(',', $s['teacher_ids'] ?? '')));
        $tNameParts = array_map(fn($tid) => $teacherMap[$tid] ?? '', $tIds);
        $tStr  = implode(' & ', array_filter($tNameParts));
        $timetableLines[] = "{$cn}: {$s['subject']} | {$tStr} | {$start}-{$end} | {$s['days']}";
    }
}

// Limit timetable context to avoid sending too much text
$ttContext = implode("\n", array_slice($timetableLines, 0, 80));
if (count($timetableLines) > 80) {
    $ttContext .= "\n... (" . (count($timetableLines) - 80) . " more slots not shown)";
}

$teacherStr  = implode(', ', $teacherList);
$classStr    = implode(', ', $classList);
$teacherCount = count($teacherList);
$classCount   = count($classList);
$ttCount      = count($timetableLines);

// ── System prompt ─────────────────────────────────────────────────────────────
$systemPrompt = <<<PROMPT
You are an AI Assistant for the IDL Timetable Management System — a school scheduling application.
You help the superadmin manage timetables, teachers, and classes.

## Current System Data

**Teachers ({$teacherCount} total):**
{$teacherStr}

**Classes ({$classCount} total):**
{$classStr}

**Timetable ({$ttCount} slots — format: Class: Subject | Teacher | Start-End | Days):**
{$ttContext}

## Your Capabilities
1. **Answer questions** about teachers, classes, and timetable data above.
2. **Detect conflicts** — same teacher assigned to overlapping times on the same day.
3. **Format uploaded Excel/CSV data** into the system's timetable import format.
4. **Suggest timetable plans** — create new schedules based on requirements.
5. **Analyze workloads** — count how many slots each teacher has.

## Timetable Import Format (use when formatting data for import)
When the user wants to import a timetable, format the output as a CSV block:
- One slot per line: `Class, Subject, Teacher, Days, Start, End`
- Days: `Mon-Tue`, `Wed-Thu`, `Fri`, `Mon-Thu`, `Mon-Fri`, or `Mon;Wed;Fri`
- Time: 24-hour format e.g. `08:00`, `14:30`
- Teacher: `Sir/Ms. Full Name` — must match an existing teacher exactly
- For breaks: subject = `BREAK`, teacher = blank
- **Important**: Start the code block's first line with `TIMETABLE_IMPORT_DATA` so the system can detect it.

Example:
```
TIMETABLE_IMPORT_DATA
Level 4J, Computer Science, Sir Ahmed Khan, Mon-Thu, 08:00, 09:00
Level 4J, Mathematics, Ms. Sara Ali, Mon-Thu, 09:00, 10:00
Level 4J, BREAK, , Mon-Thu, 10:00, 10:15
```

## Guidelines
- Be concise and specific.
- When listing data, use bullet points or short tables.
- Flag schedule conflicts clearly.
- If asked to format Excel data, focus on producing the clean import CSV.
- If no data matches the user's query, say so clearly.
PROMPT;

// ── Build messages array ───────────────────────────────────────────────────────
$messages = [['role' => 'system', 'content' => $systemPrompt]];

// Append conversation history (last 12 exchanges max)
$safeHistory = array_slice($history, -12);
foreach ($safeHistory as $h) {
    if (!isset($h['role'], $h['content'])) continue;
    $role = ($h['role'] === 'assistant') ? 'assistant' : 'user';
    $messages[] = ['role' => $role, 'content' => (string)$h['content']];
}

// Build user message — prepend file content if attached
$userMessage = $message;
if (!empty($fileContent)) {
    $fileSnippet = mb_substr($fileContent, 0, 6000);
    $fileHeader  = $message ?: 'Please analyze this file and format it for timetable import.';
    $userMessage = "{$fileHeader}\n\nFile content:\n```\n{$fileSnippet}\n```";
}

$messages[] = ['role' => 'user', 'content' => $userMessage];

// ── Call OpenAI Chat Completions API ──────────────────────────────────────────
$payload = json_encode([
    'model'       => $aiModel,
    'messages'    => $messages,
    'max_tokens'  => 2048,
    'temperature' => 0.6,
]);

$ch = curl_init('https://api.openai.com/v1/chat/completions');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $payload,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json',
        'Authorization: Bearer ' . trim($apiKey),
    ],
    CURLOPT_TIMEOUT        => 60,
    CURLOPT_CONNECTTIMEOUT => 15,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr  = curl_error($ch);
curl_close($ch);

if ($response === false || !empty($curlErr)) {
    jsonResponse(['error' => 'Could not connect to AI service: ' . $curlErr], 502);
}

$result = json_decode($response, true);

if ($httpCode !== 200 || !isset($result['choices'][0]['message']['content'])) {
    $errMsg = $result['error']['message'] ?? "OpenAI returned HTTP {$httpCode}";
    jsonResponse(['error' => $errMsg], 502);
}

$reply = $result['choices'][0]['message']['content'];
jsonResponse(['reply' => $reply]);
