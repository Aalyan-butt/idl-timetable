<?php
require_once '../includes/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

if ($method === 'POST' && $action === 'login') {
    $data = json_decode(file_get_contents('php://input'), true);
    $username = trim($data['username'] ?? '');
    $password = $data['password'] ?? '';

    if (empty($username) || empty($password)) {
        jsonResponse(['error' => 'Username and password required'], 400);
    }

    $db = getDB();
    $stmt = $db->prepare('SELECT id, username, password, role, teacher_ids_perm, class_ids_perm, supervisor_teacher_ids, supervisor_class_ids, supervisor_user_ids FROM users WHERE username = ?');
    $stmt->bind_param('s', $username);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result->fetch_assoc();

    if ($user && password_verify($password, $user['password'])) {
        session_regenerate_id(true); // create a fresh session ID on login
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['username'] = $user['username'];
        $_SESSION['role'] = $user['role'];
        $_SESSION['teacher_ids_perm'] = $user['teacher_ids_perm'] ?? '';
        $_SESSION['class_ids_perm'] = $user['class_ids_perm'] ?? '';
        $_SESSION['supervisor_teacher_ids'] = $user['supervisor_teacher_ids'] ?? '';
        $_SESSION['supervisor_class_ids']   = $user['supervisor_class_ids']   ?? '';
        $_SESSION['supervisor_user_ids']    = $user['supervisor_user_ids']    ?? '';
        $_SESSION['last_activity']          = time();
        jsonResponse([
            'success'               => true,
            'user_id'               => $user['id'],
            'role'                  => $user['role'],
            'username'              => $user['username'],
            'teacher_ids_perm'      => $user['teacher_ids_perm'] ?? '',
            'class_ids_perm'        => $user['class_ids_perm'] ?? '',
            'supervisor_teacher_ids'=> $user['supervisor_teacher_ids'] ?? '',
            'supervisor_class_ids'  => $user['supervisor_class_ids']   ?? '',
            'supervisor_user_ids'   => $user['supervisor_user_ids']    ?? ''
        ]);
    } else {
        jsonResponse(['error' => 'Invalid credentials'], 401);
    }
}

if ($method === 'POST' && $action === 'logout') {
    session_unset();
    session_destroy();
    jsonResponse(['success' => true]);
}

if ($method === 'GET' && $action === 'check') {
    if (isset($_SESSION['user_id'])) {
        // Server-side safety net: expire truly abandoned sessions after 8 hours.
        // The real 8-hour away-from-tab logout is handled client-side via visibilitychange.
        $idleTimeout = 8 * 60 * 60; // 8 hours
        if (isset($_SESSION['last_activity']) && (time() - $_SESSION['last_activity']) > $idleTimeout) {
            session_unset();
            session_destroy();
            jsonResponse(['authenticated' => false, 'reason' => 'idle_timeout']);
        }
        $_SESSION['last_activity'] = time();
        jsonResponse([
            'authenticated'          => true,
            'user_id'                => $_SESSION['user_id'],
            'role'                   => $_SESSION['role'],
            'username'               => $_SESSION['username'],
            'teacher_ids_perm'       => $_SESSION['teacher_ids_perm'] ?? '',
            'class_ids_perm'         => $_SESSION['class_ids_perm'] ?? '',
            'supervisor_teacher_ids' => $_SESSION['supervisor_teacher_ids'] ?? '',
            'supervisor_class_ids'   => $_SESSION['supervisor_class_ids']   ?? '',
            'supervisor_user_ids'    => $_SESSION['supervisor_user_ids']    ?? ''
        ]);
    } else {
        jsonResponse(['authenticated' => false]);
    }
}
