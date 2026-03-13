<?php
/**
 * Application Bootstrap / Config
 * Loaded by every API endpoint via require_once.
 * Provides: DB connection, session, auth helpers, JSON response, notification logging.
 */

// ─── Error handling ───────────────────────────────────────────────────────
// Never let PHP warnings/notices bleed into JSON responses
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL);
ob_start(); // buffer stray output; flushed/discarded inside jsonResponse()

// ─── Database credentials ────────────────────────────────────────────────────
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'idltimetable');

// ─── Security / CORS headers ───────────────────────────────────────────────────
header('X-Frame-Options: SAMEORIGIN');
header('X-Content-Type-Options: nosniff');
header('X-XSS-Protection: 1; mode=block');
header('Referrer-Policy: strict-origin-when-cross-origin');

// CORS - restrict to same host only
$allowed_origin = (isset($_SERVER['HTTPS']) ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
if (isset($_SERVER['HTTP_ORIGIN'])) {
    if ($_SERVER['HTTP_ORIGIN'] === $allowed_origin) {
        header('Access-Control-Allow-Origin: ' . $allowed_origin);
    }
} else {
    header('Access-Control-Allow-Origin: ' . $allowed_origin);
}
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Credentials: true');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit();
}

// ─── Database connection (singleton) ──────────────────────────────────────────
// Single MySQLi instance reused for the lifetime of the request
$_db_instance = null;
function getDB() {
    global $_db_instance;
    if ($_db_instance !== null) return $_db_instance;
    $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
    if ($conn->connect_error) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        exit();
    }
    $conn->set_charset('utf8mb4');
    $_db_instance = $conn;
    return $conn;
}

// ─── Session bootstrap ────────────────────────────────────────────────────────────
if (session_status() === PHP_SESSION_NONE) {
    session_set_cookie_params([
        'lifetime' => 86400,
        'path'     => '/',
        'secure'   => isset($_SERVER['HTTPS']),
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_start();
}

// Session timeout: 8 hours
if (isset($_SESSION['last_activity']) && (time() - $_SESSION['last_activity']) > 28800) {
    session_unset();
    session_destroy();
}
if (isset($_SESSION['user_id'])) {
    $_SESSION['last_activity'] = time();
}

function requireAuth() {
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(['error' => 'Not authenticated']);
        exit();
    }
}

function requireAdmin() {
    requireAuth();
    if (!in_array($_SESSION['role'], ['admin', 'superadmin'])) {
        http_response_code(403);
        echo json_encode(['error' => 'Admin access required']);
        exit();
    }
}

// Allow admin, superadmin, OR supervisor
function requireAdminOrSupervisor() {
    requireAuth();
    if (!in_array($_SESSION['role'], ['admin', 'superadmin', 'supervisor'])) {
        http_response_code(403);
        echo json_encode(['error' => 'Access denied']);
        exit();
    }
}

function requireSuperAdmin() {
    requireAuth();
    if ($_SESSION['role'] !== 'superadmin') {
        http_response_code(403);
        echo json_encode(['error' => 'Super Admin access required']);
        exit();
    }
}

function isAdmin() {
    return isset($_SESSION['role']) && in_array($_SESSION['role'], ['admin', 'superadmin']);
}

function isSuperAdmin() {
    return isset($_SESSION['role']) && $_SESSION['role'] === 'superadmin';
}

function isSupervisor() {
    return isset($_SESSION['role']) && $_SESSION['role'] === 'supervisor';
}

function isStudent() {
    return isset($_SESSION['role']) && $_SESSION['role'] === 'student';
}

function isParent() {
    return isset($_SESSION['role']) && $_SESSION['role'] === 'parent';
}

// Return array of assigned teacher IDs for a supervisor (empty array if not supervisor)
function getSupervisorTeacherIds() {
    if (!isSupervisor()) return [];
    $raw = $_SESSION['supervisor_teacher_ids'] ?? '';
    if (trim($raw) === '') return [];
    return array_values(array_filter(array_map('intval', explode(',', $raw))));
}

// Return array of assigned class IDs for a supervisor
function getSupervisorClassIds() {
    if (!isSupervisor()) return [];
    $raw = $_SESSION['supervisor_class_ids'] ?? '';
    if (trim($raw) === '') return [];
    return array_values(array_filter(array_map('intval', explode(',', $raw))));
}

// Check if the current supervisor is allowed to manage a specific teacher
function supervisorCanAccessTeacher($teacher_id) {
    if (!isSupervisor()) return true; // non-supervisors use their own permission system
    return in_array(intval($teacher_id), getSupervisorTeacherIds());
}

// Check if the current supervisor is allowed to manage a specific class
function supervisorCanAccessClass($class_id) {
    if (!isSupervisor()) return true;
    return in_array(intval($class_id), getSupervisorClassIds());
}

// Return array of assigned user IDs for a supervisor
function getSupervisorUserIds() {
    if (!isSupervisor()) return [];
    $raw = $_SESSION['supervisor_user_ids'] ?? '';
    if (trim($raw) === '') return [];
    return array_values(array_filter(array_map('intval', explode(',', $raw))));
}

// Check if the current supervisor can access a specific user
function supervisorCanAccessUser($user_id) {
    if (!isSupervisor()) return true;
    return in_array(intval($user_id), getSupervisorUserIds());
}

function jsonResponse($data, $code = 200) {
    ob_end_clean(); // discard any stray output (warnings, notices) before JSON
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit();
}

/**
 * Log an action performed by a non-superadmin user for the superadmin notifications feed.
 * Silently skips if called by superadmin or when no session exists.
 *
 * @param string      $action_type   'add' | 'edit' | 'delete'
 * @param string      $entity_type   'teacher' | 'class' | 'timetable' | 'user'
 * @param int|null    $entity_id     Primary key of the affected row
 * @param string      $entity_name   Human-readable label (e.g. "Sir Ahmed Khan")
 * @param array|null  $snapshot_data Full old row (for edit/delete undo support)
 */
function logNotification($action_type, $entity_type, $entity_id, $entity_name, $snapshot_data = null) {
    if (!isset($_SESSION['user_id'])) return;
    if ($_SESSION['role'] === 'superadmin') return;
    try {
        $db = getDB();

        $actor_username = $_SESSION['username'] ?? '';
        $actor_role     = $_SESSION['role']     ?? '';
        $snap           = ($snapshot_data !== null) ? json_encode($snapshot_data) : null;

        $stmt = $db->prepare(
            'INSERT INTO notifications
             (actor_username, actor_role, action_type, entity_type, entity_id, entity_name, snapshot_data)
             VALUES (?,?,?,?,?,?,?)'
        );

        if ($stmt === false) {
            error_log('logNotification: prepare() failed — ' . $db->error);
            return;
        }

        $stmt->bind_param('ssssiss', $actor_username, $actor_role, $action_type, $entity_type, $entity_id, $entity_name, $snap);

        if (!$stmt->execute()) {
            error_log('logNotification: execute() failed — ' . $stmt->error);
        }
    } catch (\Throwable $e) {
        error_log('logNotification exception: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    }
}

header('Content-Type: application/json');
