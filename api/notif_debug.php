<?php
/**
 * TEMPORARY DIAGNOSTIC — DELETE THIS FILE AFTER DEBUGGING
 * Upload to: /api/notif_debug.php on live server
 * Open in browser while logged in as admin/supervisor (NOT superadmin)
 */
require_once '../includes/config.php';

header('Content-Type: text/plain');

echo "========== NOTIFICATION DIAGNOSTIC ==========\n\n";

// 1. PHP version
echo "PHP Version: " . PHP_VERSION . "\n\n";

// 2. Session state
echo "--- SESSION ---\n";
echo "session_status: " . session_status() . " (2=active)\n";
echo "user_id   : " . ($_SESSION['user_id']   ?? 'NOT SET') . "\n";
echo "username  : " . ($_SESSION['username']  ?? 'NOT SET') . "\n";
echo "role      : " . ($_SESSION['role']      ?? 'NOT SET') . "\n\n";

// 3-A. logNotification would exit early if these fail
if (!isset($_SESSION['user_id'])) {
    echo "PROBLEM: Session has no user_id — you must be logged in to test this.\n";
    echo "Log in as admin/supervisor first, then open this URL again.\n";
    exit;
}
if ($_SESSION['role'] === 'superadmin') {
    echo "PROBLEM: You're logged in as superadmin — logNotification skips superadmin.\n";
    echo "Log in as a regular admin or supervisor and reopen this page.\n";
    exit;
}

// 3. DB connection
echo "--- DATABASE ---\n";
$db = getDB();
echo "Connected: YES\n";
echo "DB Host: " . DB_HOST . "\n";
echo "DB Name: " . DB_NAME . "\n";
echo "DB User: " . DB_USER . "\n\n";

// 4. Check if notifications table exists
echo "--- TABLE CHECK ---\n";
$tbl = $db->query("SHOW TABLES LIKE 'notifications'");
if ($tbl && $tbl->num_rows > 0) {
    echo "notifications table: EXISTS\n";
    $cols = $db->query("DESCRIBE notifications");
    echo "Columns:\n";
    while ($c = $cols->fetch_assoc()) {
        echo "  " . $c['Field'] . " (" . $c['Type'] . ")\n";
    }
} else {
    echo "notifications table: DOES NOT EXIST ← THIS IS THE PROBLEM\n";
    echo "\nRun this SQL on your live database:\n\n";
    echo "CREATE TABLE `notifications` (\n";
    echo "  `id` int(11) NOT NULL AUTO_INCREMENT,\n";
    echo "  `actor_username` varchar(100) NOT NULL,\n";
    echo "  `actor_role` varchar(50) NOT NULL,\n";
    echo "  `action_type` varchar(20) NOT NULL,\n";
    echo "  `entity_type` varchar(50) NOT NULL,\n";
    echo "  `entity_id` int(11) DEFAULT NULL,\n";
    echo "  `entity_name` varchar(500) DEFAULT NULL,\n";
    echo "  `snapshot_data` longtext DEFAULT NULL,\n";
    echo "  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),\n";
    echo "  PRIMARY KEY (`id`)\n";
    echo ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n";
    exit;
}

echo "\n--- INSERT TEST ---\n";
$stmt = $db->prepare(
    'INSERT INTO notifications (actor_username, actor_role, action_type, entity_type, entity_id, entity_name, snapshot_data)
     VALUES (?,?,?,?,?,?,?)'
);
if ($stmt === false) {
    echo "prepare() FAILED: " . $db->error . "\n";
    exit;
}
echo "prepare(): OK\n";

$u = 'debug_test';
$r = 'admin';
$a = 'add';
$et = 'teacher';
$ei = 999;
$en = 'Debug Test Teacher';
$sn = null;
$stmt->bind_param('ssssiss', $u, $r, $a, $et, $ei, $en, $sn);

if ($stmt->execute()) {
    $inserted_id = $db->insert_id;
    echo "execute(): OK — inserted test row with id=" . $inserted_id . "\n";
    // Clean up test row
    $db->query("DELETE FROM notifications WHERE id=" . intval($inserted_id));
    echo "Cleanup: test row deleted\n\n";
    echo "=== RESULT: INSERT WORKS FINE ===\n";
    echo "The logNotification function should work. Check if:\n";
    echo "  1. You uploaded the latest config.php to the live server\n";
    echo "  2. The admin/supervisor session is valid when actions are performed\n";
} else {
    echo "execute() FAILED: " . $stmt->error . "\n";
    echo "MySQL errno: " . $db->errno . "\n";
}

echo "\n========== END DIAGNOSTIC ==========\n";
