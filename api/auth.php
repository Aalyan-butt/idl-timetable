<?php
require_once '../includes/config.php';

$method = $_SERVER['REQUEST_METHOD'];

function debug_log($msg) {
    file_put_contents(__DIR__ . '/../debug_auth.log', date('Y-m-d H:i:s') . ' ' . $msg . "\n", FILE_APPEND);
}

$action = $_GET['action'] ?? '';

if ($method === 'POST' && $action === 'login') {
    $data = json_decode(file_get_contents('php://input'), true);
    $username = trim($data['username'] ?? '');
    $password = $data['password'] ?? '';

    debug_log('Login attempt');

    if (empty($username) || empty($password)) {
        debug_log('Missing username or password');
        jsonResponse(['error' => 'Username and password required'], 400);
    }

    debug_log('Username: ' . $username);

    try {
        $db = getDB();
        debug_log('DB connection OK');
        $stmt = $db->prepare('SELECT id, username, password, role, teacher_ids_perm, class_ids_perm, supervisor_teacher_ids, supervisor_class_ids, supervisor_user_ids, student_id, parent_id, student_ids FROM users WHERE username = ?');
        if ($stmt === false) {
            debug_log('Prepare failed: ' . $db->error);
            jsonResponse(['error' => 'DB prepare failed', 'debug' => $db->error], 500);
        }
        $stmt->bind_param('s', $username);
        $stmt->execute();
        $result = $stmt->get_result();
        $user = $result->fetch_assoc();
        debug_log('User fetch: ' . ($user ? 'found' : 'not found'));
    } catch (Exception $e) {
        debug_log('DB error: ' . $e->getMessage());
        jsonResponse(['error' => 'DB error', 'debug' => $e->getMessage()], 500);
    }

    if ($user && password_verify($password, $user['password'])) {
        $_SESSION['user_id']                = $user['id'];
        $_SESSION['username']               = $user['username'];
        $_SESSION['role']                   = $user['role'];
        $_SESSION['teacher_ids_perm']       = $user['teacher_ids_perm'] ?? '';
        $_SESSION['class_ids_perm']         = $user['class_ids_perm'] ?? '';
        $_SESSION['supervisor_teacher_ids'] = $user['supervisor_teacher_ids'] ?? '';
        $_SESSION['supervisor_class_ids']   = $user['supervisor_class_ids']   ?? '';
        $_SESSION['supervisor_user_ids']    = $user['supervisor_user_ids']    ?? '';
        $_SESSION['student_id']             = $user['student_id'] ?? null;
        $_SESSION['parent_id']              = $user['parent_id'] ?? null;
        $_SESSION['student_ids']            = $user['student_ids'] ?? '';
        $_SESSION['last_activity']          = time();

        debug_log('Password verified, login success');
        debug_log('Session set for user_id: ' . $user['id']);

        jsonResponse([
            'success'                => true,
            'user_id'                => $user['id'],
            'role'                   => $user['role'],
            'username'               => $user['username'],
            'teacher_ids_perm'       => $user['teacher_ids_perm'] ?? '',
            'class_ids_perm'         => $user['class_ids_perm'] ?? '',
            'supervisor_teacher_ids' => $user['supervisor_teacher_ids'] ?? '',
            'supervisor_class_ids'   => $user['supervisor_class_ids']   ?? '',
            'supervisor_user_ids'    => $user['supervisor_user_ids']    ?? '',
            'student_id'             => $user['student_id'] ?? null,
            'parent_id'              => $user['parent_id'] ?? null,
            'student_ids'            => $user['student_ids'] ?? ''
        ]);
    } else {
        debug_log('Invalid credentials');
        jsonResponse(['error' => 'Invalid credentials'], 401);
    }
}

if ($method === 'POST' && $action === 'logout') {
    debug_log('Logout attempt');
    session_unset();
    session_destroy();
    debug_log('Logout success');
    jsonResponse(['success' => true]);
}

if ($method === 'GET' && $action === 'check') {
    debug_log('Session check');
    if (isset($_SESSION['user_id'])) {
        $idleTimeout = 8 * 60 * 60;
        if (isset($_SESSION['last_activity']) && (time() - $_SESSION['last_activity']) > $idleTimeout) {
            debug_log('Session idle timeout');
            session_unset();
            session_destroy();
            jsonResponse(['authenticated' => false, 'reason' => 'idle_timeout']);
        }
        $_SESSION['last_activity'] = time();
        debug_log('Session active for user_id: ' . $_SESSION['user_id']);
        jsonResponse([
            'authenticated'          => true,
            'user_id'                => $_SESSION['user_id'],
            'role'                   => $_SESSION['role'],
            'username'               => $_SESSION['username'],
            'teacher_ids_perm'       => $_SESSION['teacher_ids_perm'] ?? '',
            'class_ids_perm'         => $_SESSION['class_ids_perm'] ?? '',
            'supervisor_teacher_ids' => $_SESSION['supervisor_teacher_ids'] ?? '',
            'supervisor_class_ids'   => $_SESSION['supervisor_class_ids']   ?? '',
            'supervisor_user_ids'    => $_SESSION['supervisor_user_ids']    ?? '',
            'student_id'             => $_SESSION['student_id'] ?? null,
            'parent_id'              => $_SESSION['parent_id'] ?? null,
            'student_ids'            => $_SESSION['student_ids'] ?? ''
        ]);
    } else {
        debug_log('Session check: not authenticated');
        jsonResponse(['authenticated' => false]);
    }
}