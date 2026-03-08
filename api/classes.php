<?php
require_once '../includes/config.php';
requireAuth();

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

if ($method === 'GET') {
    $id = $_GET['id'] ?? null;
    if ($id) {
        if (isSupervisor() && !supervisorCanAccessClass($id)) {
            jsonResponse(['error' => 'Not found'], 404);
        }
        $stmt = $db->prepare('SELECT * FROM classes WHERE id = ?');
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $result = $stmt->get_result()->fetch_assoc();
        jsonResponse($result ?: ['error' => 'Not found']);
    } else {
        if (isSupervisor()) {
            $ids = getSupervisorClassIds();
            if (empty($ids)) { jsonResponse([]); }
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $stmt = $db->prepare("SELECT * FROM classes WHERE id IN ($placeholders) ORDER BY name");
            $types = str_repeat('i', count($ids));
            $stmt->bind_param($types, ...$ids);
            $stmt->execute();
            $r = $stmt->get_result(); $classes = [];
            while ($row = $r->fetch_assoc()) $classes[] = $row;
            jsonResponse($classes);
        }
        $result = $db->query('SELECT * FROM classes ORDER BY name');
        $classes = [];
        while ($row = $result->fetch_assoc()) $classes[] = $row;
        jsonResponse($classes);
    }
}

if ($method === 'POST') {
    if (isSupervisor()) jsonResponse(['error' => 'Supervisors cannot create classes'], 403);
    requireAdmin();
    $data = json_decode(file_get_contents('php://input'), true);
    $name = trim($data['name'] ?? '');

    if (empty($name)) jsonResponse(['error' => 'Class name required'], 400);

    $stmt = $db->prepare('INSERT INTO classes (name) VALUES (?)');
    $stmt->bind_param('s', $name);
    if ($stmt->execute()) {
        $new_id = $db->insert_id;
        logNotification('add', 'class', $new_id, $name,
            ['id' => $new_id, 'name' => $name]);
        jsonResponse(['success' => true, 'id' => $new_id]);
    } else {
        jsonResponse(['error' => 'Failed to add class'], 500);
    }
}

if ($method === 'PUT') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonResponse(['error' => 'ID required'], 400);
    if (isSupervisor()) {
        if (!supervisorCanAccessClass($id)) jsonResponse(['error' => 'Class not assigned to you'], 403);
    } else {
        requireAdmin();
    }

    $data = json_decode(file_get_contents('php://input'), true);
    $name = trim($data['name'] ?? '');
    if (empty($name)) jsonResponse(['error' => 'Class name required'], 400);

    // Snapshot old row for undo
    $old_stmt = $db->prepare('SELECT * FROM classes WHERE id=?');
    $old_stmt->bind_param('i', $id);
    $old_stmt->execute();
    $old_row = $old_stmt->get_result()->fetch_assoc();

    $stmt = $db->prepare('UPDATE classes SET name=? WHERE id=?');
    $stmt->bind_param('si', $name, $id);
    if ($stmt->execute()) {
        logNotification('edit', 'class', $id, $name, $old_row);
        jsonResponse(['success' => true]);
    } else {
        jsonResponse(['error' => 'Failed to update'], 500);
    }
}

if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonResponse(['error' => 'ID required'], 400);
    if (isSupervisor()) {
        if (!supervisorCanAccessClass($id)) jsonResponse(['error' => 'Class not assigned to you'], 403);
    } else {
        requireAdmin();
    }

    // Snapshot old row for undo
    $old_stmt = $db->prepare('SELECT * FROM classes WHERE id=?');
    $old_stmt->bind_param('i', $id);
    $old_stmt->execute();
    $old_row = $old_stmt->get_result()->fetch_assoc();
    $display_name = ($old_row ? $old_row['name'] : "Class #{$id}");

    $stmt = $db->prepare('DELETE FROM classes WHERE id=?');
    $stmt->bind_param('i', $id);
    if ($stmt->execute()) {
        logNotification('delete', 'class', $id, $display_name, $old_row);
        jsonResponse(['success' => true]);
    } else {
        jsonResponse(['error' => 'Failed to delete'], 500);
    }
}
