<?php
// One-time migration runner — delete this file after use!
require_once '../includes/config.php';
requireAuth();
if (!isSuperAdmin() && !isAdmin()) { echo 'Access denied'; exit; }

$db  = getDB();
$sql = file_get_contents(__DIR__ . '/../migrations/006_add_plain_password.sql');

// Split on semicolons, run each non-empty statement
$statements = array_filter(array_map('trim', explode(';', $sql)));
$results = [];
foreach ($statements as $stmt) {
    if (!$stmt || strpos($stmt, '--') === 0) continue;
    if ($db->query($stmt)) {
        $results[] = "OK:  " . substr(preg_replace('/\s+/', ' ', $stmt), 0, 100);
    } else {
        $results[] = "ERR: " . $db->error . "\n     " . substr(preg_replace('/\s+/', ' ', $stmt), 0, 100);
    }
}

// Verify
$check = $db->query("SHOW COLUMNS FROM users LIKE 'plain_password'")->num_rows;
echo "<pre style='font-family:monospace;font-size:13px;padding:20px'>";
echo "=== Migration 006: Add plain_password to users ===\n\n";
foreach ($results as $r) echo htmlspecialchars($r) . "\n";
echo "\n" . ($check ? "✅ plain_password column is ready!" : "❌ Column still missing — check errors above");
echo "\n\nDelete api/migrate.php after use.</pre>";
