<?php
require_once '../includes/config.php';
requireAdminOrSupervisor();   // admins + supervisors can use this endpoint

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();
$isSA   = isSuperAdmin();
$isSupv = isSupervisor();

// Super-admin requests endpoint
if ($method === 'GET' && isset($_GET['action']) && $_GET['action'] === 'sa_requests') {
    requireSuperAdmin();
    $result = $db->query('SELECT * FROM superadmin_requests ORDER BY created_at DESC');
    $reqs = [];
    while ($row = $result->fetch_assoc()) $reqs[] = $row;
    jsonResponse($reqs);
}

if ($method === 'POST' && isset($_GET['action']) && $_GET['action'] === 'sa_request') {
    requireSuperAdmin();
    $data = json_decode(file_get_contents('php://input'), true);
    $teacher_id = intval($data['teacher_id'] ?? 0);
    $class_ids = $data['class_ids'] ?? '';
    $note = trim($data['note'] ?? '');
    if (!$teacher_id || !$class_ids) jsonResponse(['error' => 'teacher_id and class_ids required'], 400);
    $stmt = $db->prepare('INSERT INTO superadmin_requests (teacher_id, class_ids, note, status) VALUES (?,?,?,\'pending\')');
    $stmt->bind_param('iss', $teacher_id, $class_ids, $note);
    if ($stmt->execute()) jsonResponse(['success' => true, 'id' => $db->insert_id]);
    else jsonResponse(['error' => 'Failed to create request'], 500);
}

if ($method === 'PUT' && isset($_GET['action']) && $_GET['action'] === 'sa_approve') {
    requireSuperAdmin();
    $id = intval($_GET['id'] ?? 0);
    if (!$id) jsonResponse(['error' => 'ID required'], 400);
    $stmt = $db->prepare('UPDATE superadmin_requests SET status=\'approved\' WHERE id=?');
    $stmt->bind_param('i', $id);
    if ($stmt->execute()) jsonResponse(['success' => true]);
    else jsonResponse(['error' => 'Failed'], 500);
}

if ($method === 'PUT' && isset($_GET['action']) && $_GET['action'] === 'sa_reject') {
    requireSuperAdmin();
    $id = intval($_GET['id'] ?? 0);
    if (!$id) jsonResponse(['error' => 'ID required'], 400);
    $stmt = $db->prepare('UPDATE superadmin_requests SET status=\'rejected\' WHERE id=?');
    $stmt->bind_param('i', $id);
    if ($stmt->execute()) jsonResponse(['success' => true]);
    else jsonResponse(['error' => 'Failed'], 500);
}

if ($method === 'GET') {
    if ($isSupv) {
        // Supervisors only see users explicitly assigned to them via supervisor_user_ids
        $assignedUserIds = getSupervisorUserIds();
        if (empty($assignedUserIds)) {
            jsonResponse([]);
        }
        $placeholders = implode(',', array_fill(0, count($assignedUserIds), '?'));
        $stmt = $db->prepare(
            "SELECT id, username, role, teacher_ids_perm, class_ids_perm, supervisor_teacher_ids, supervisor_class_ids, supervisor_user_ids, student_id, created_at
             FROM users WHERE role = 'user' AND id IN ({$placeholders}) ORDER BY username"
        );
        $types = str_repeat('i', count($assignedUserIds));
        $stmt->bind_param($types, ...$assignedUserIds);
        $stmt->execute();
        $result = $stmt->get_result();
        $users = [];
        while ($row = $result->fetch_assoc()) $users[] = $row;
        jsonResponse($users);
    }
    $result = $db->query('SELECT id, username, role, teacher_ids_perm, class_ids_perm, supervisor_teacher_ids, supervisor_class_ids, supervisor_user_ids, student_id, created_at FROM users ORDER BY username');
    $users = [];
    while ($row = $result->fetch_assoc()) $users[] = $row;
    jsonResponse($users);
}

if ($method === 'POST') {
    if ($isSupv) jsonResponse(['error' => 'Supervisors cannot create users'], 403);

    $data = json_decode(file_get_contents('php://input'), true);
    $username                 = trim($data['username'] ?? '');
    $password                 = $data['password'] ?? '';
    $role                     = $data['role'] ?? 'user';
    $teacher_ids_perm         = $data['teacher_ids_perm']        ?? '';
    $class_ids_perm           = $data['class_ids_perm']          ?? '';
    $supervisor_teacher_ids   = $data['supervisor_teacher_ids']   ?? '';
    $supervisor_class_ids     = $data['supervisor_class_ids']     ?? '';
    $supervisor_user_ids      = $data['supervisor_user_ids']      ?? '';
    $student_id               = isset($data['student_id']) && $data['student_id'] !== '' ? intval($data['student_id']) : null;

    if (empty($username) || empty($password)) jsonResponse(['error' => 'Username and password required'], 400);
    $allowedRoles = $isSA ? ['admin', 'user', 'superadmin', 'supervisor', 'student', 'parent'] : ['admin', 'user', 'supervisor', 'student', 'parent'];
    if (!in_array($role, $allowedRoles)) jsonResponse(['error' => 'Invalid role'], 400);
    if ($role === 'superadmin' && !$isSA) jsonResponse(['error' => 'Only Super Admin can create Super Admin accounts'], 403);
    if (strlen($password) < 6) jsonResponse(['error' => 'Password must be at least 6 characters'], 400);

    // Clear fields not relevant to role
    if ($role !== 'supervisor') { $supervisor_teacher_ids = ''; $supervisor_class_ids = ''; $supervisor_user_ids = ''; }
    if ($role !== 'user')       { $teacher_ids_perm = ''; $class_ids_perm = ''; }
    if (!in_array($role, ['student', 'parent'])) { $student_id = null; }

    $hashed = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $db->prepare('INSERT INTO users (username, password, role, teacher_ids_perm, class_ids_perm, supervisor_teacher_ids, supervisor_class_ids, supervisor_user_ids, student_id) VALUES (?,?,?,?,?,?,?,?,?)');
    $stmt->bind_param('ssssssssi', $username, $hashed, $role, $teacher_ids_perm, $class_ids_perm, $supervisor_teacher_ids, $supervisor_class_ids, $supervisor_user_ids, $student_id);
    if ($stmt->execute()) {
        $new_id = $db->insert_id;
        $roleLabel = ['admin'=>'Admin','user'=>'User','supervisor'=>'Supervisor','superadmin'=>'Super Admin','student'=>'Student','parent'=>'Parent'][$role] ?? $role;
        logNotification('add', 'user', $new_id, "{$username} ({$roleLabel})",
            ['id'=>$new_id,'username'=>$username,'role'=>$role,'teacher_ids_perm'=>$teacher_ids_perm,'class_ids_perm'=>$class_ids_perm,'supervisor_teacher_ids'=>$supervisor_teacher_ids,'supervisor_class_ids'=>$supervisor_class_ids,'supervisor_user_ids'=>$supervisor_user_ids,'student_id'=>$student_id]);
        jsonResponse(['success' => true, 'id' => $new_id]);
    } else {
        jsonResponse(['error' => 'Username already exists or failed to create'], 500);
    }
}

if ($method === 'PUT') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonResponse(['error' => 'ID required'], 400);

    $chk = $db->prepare('SELECT role, teacher_ids_perm FROM users WHERE id=?');
    $chk->bind_param('i', $id);
    $chk->execute();
    $target = $chk->get_result()->fetch_assoc();
    if (!$target) jsonResponse(['error' => 'User not found'], 404);

    if ($isSupv) {
        // Supervisors may only edit user accounts assigned to them
        if ($target['role'] !== 'user' || !supervisorCanAccessUser($id)) {
            jsonResponse(['error' => 'You do not have permission to edit this account'], 403);
        }
    } else {
        if ($target['role'] === 'superadmin' && !$isSA) {
            jsonResponse(['error' => 'You do not have permission to edit Super Admin accounts'], 403);
        }
    }

    $data = json_decode(file_get_contents('php://input'), true);
    $username                 = trim($data['username'] ?? '');
    $role                     = $data['role'] ?? 'user';
    $password                 = $data['password'] ?? '';
    $teacher_ids_perm         = $data['teacher_ids_perm']        ?? '';
    $class_ids_perm           = $data['class_ids_perm']          ?? '';
    $supervisor_teacher_ids   = $data['supervisor_teacher_ids']   ?? '';
    $supervisor_class_ids     = $data['supervisor_class_ids']     ?? '';
    $supervisor_user_ids      = $data['supervisor_user_ids']      ?? '';
    $student_id               = isset($data['student_id']) && $data['student_id'] !== '' ? intval($data['student_id']) : null;

    if (empty($username)) jsonResponse(['error' => 'Username required'], 400);

    if ($isSupv) {
        // Supervisors can only update username/password; role stays 'user'
        $role = 'user';
        $supervisor_teacher_ids = '';
        $supervisor_class_ids   = '';
        $supervisor_user_ids    = '';
        $class_ids_perm         = '';
        $student_id             = null;
    } else {
        $allowedRoles = $isSA ? ['admin', 'user', 'superadmin', 'supervisor', 'student', 'parent'] : ['admin', 'user', 'supervisor', 'student', 'parent'];
        if (!in_array($role, $allowedRoles)) jsonResponse(['error' => 'Invalid role'], 400);
        if ($role === 'superadmin' && !$isSA) jsonResponse(['error' => 'Only Super Admin can assign Super Admin role'], 403);
        if ($role !== 'supervisor') { $supervisor_teacher_ids = ''; $supervisor_class_ids = ''; $supervisor_user_ids = ''; }
        if ($role !== 'user')       { $teacher_ids_perm = ''; $class_ids_perm = ''; }
        if (!in_array($role, ['student', 'parent'])) { $student_id = null; }
    }

    if (!empty($password)) {
        if (strlen($password) < 6) jsonResponse(['error' => 'Password must be at least 6 characters'], 400);
        $hashed = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $db->prepare('UPDATE users SET username=?, role=?, password=?, teacher_ids_perm=?, class_ids_perm=?, supervisor_teacher_ids=?, supervisor_class_ids=?, supervisor_user_ids=?, student_id=? WHERE id=?');
        $stmt->bind_param('ssssssssii', $username, $role, $hashed, $teacher_ids_perm, $class_ids_perm, $supervisor_teacher_ids, $supervisor_class_ids, $supervisor_user_ids, $student_id, $id);
    } else {
        $stmt = $db->prepare('UPDATE users SET username=?, role=?, teacher_ids_perm=?, class_ids_perm=?, supervisor_teacher_ids=?, supervisor_class_ids=?, supervisor_user_ids=?, student_id=? WHERE id=?');
        $stmt->bind_param('sssssssii', $username, $role, $teacher_ids_perm, $class_ids_perm, $supervisor_teacher_ids, $supervisor_class_ids, $supervisor_user_ids, $student_id, $id);
    }

    // Fetch old row for undo snapshot (after validation, before execute)
    $old_usr = $db->prepare('SELECT * FROM users WHERE id=?');
    $old_usr->bind_param('i', $id);
    $old_usr->execute();
    $old_usr_row = $old_usr->get_result()->fetch_assoc();

    if ($stmt->execute()) {
        $roleLabel = ['admin'=>'Admin','user'=>'User','supervisor'=>'Supervisor','superadmin'=>'Super Admin','student'=>'Student','parent'=>'Parent'][$role] ?? $role;
        logNotification('edit', 'user', intval($id), "{$username} ({$roleLabel})", $old_usr_row);
        jsonResponse(['success' => true]);
    } else {
        jsonResponse(['error' => 'Failed to update user'], 500);
    }
}

if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonResponse(['error' => 'ID required'], 400);

    if ($id == $_SESSION['user_id']) {
        jsonResponse(['error' => 'Cannot delete your own account'], 400);
    }

    $chk = $db->prepare('SELECT role, teacher_ids_perm FROM users WHERE id=?');
    $chk->bind_param('i', $id);
    $chk->execute();
    $target = $chk->get_result()->fetch_assoc();
    if (!$target) jsonResponse(['error' => 'User not found'], 404);

    if ($isSupv) {
        if ($target['role'] !== 'user' || !supervisorCanAccessUser($id)) {
            jsonResponse(['error' => 'You do not have permission to delete this account'], 403);
        }
    } else {
        if ($target['role'] === 'superadmin' && !$isSA) {
            jsonResponse(['error' => 'You do not have permission to delete Super Admin accounts'], 403);
        }
    }

    // Fetch full user row for snapshot (for undo-delete)
    $old_usr = $db->prepare('SELECT * FROM users WHERE id=?');
    $old_usr->bind_param('i', $id);
    $old_usr->execute();
    $old_usr_row = $old_usr->get_result()->fetch_assoc();
    $del_username = $old_usr_row ? $old_usr_row['username'] : "User#{$id}";
    $del_role     = $old_usr_row ? $old_usr_row['role'] : '';
    $del_roleLabel = ['admin'=>'Admin','user'=>'User','supervisor'=>'Supervisor','superadmin'=>'Super Admin'][$del_role] ?? $del_role;

    $stmt = $db->prepare('DELETE FROM users WHERE id=?');
    $stmt->bind_param('i', $id);
    if ($stmt->execute()) {
        logNotification('delete', 'user', intval($id), "{$del_username} ({$del_roleLabel})", $old_usr_row);
        jsonResponse(['success' => true]);
    } else {
        jsonResponse(['error' => 'Failed to delete user'], 500);
    }
}
