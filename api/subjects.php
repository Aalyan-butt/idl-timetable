<?php
require_once '../includes/config.php';
requireAdmin();

$method = $_SERVER['REQUEST_METHOD'];
$db     = getDB();

// ── GET: fetch subjects for a class, auto-seeding from timetable ──────────
if ($method === 'GET') {
    $class_id = intval($_GET['class_id'] ?? 0);
    if (!$class_id) {
        jsonResponse(['error' => 'class_id required'], 400);
    }

    // Seed from timetable: insert any subjects not yet in class_subjects
    $seed = $db->prepare(
        'INSERT IGNORE INTO class_subjects (class_id, subject_name)
         SELECT DISTINCT ?, subject
         FROM timetable
         WHERE class_id = ? AND subject IS NOT NULL AND TRIM(subject) != \'\' AND is_break = 0'
    );
    $seed->bind_param('ii', $class_id, $class_id);
    $seed->execute();

    // Return all subjects for this class
    $stmt = $db->prepare(
        'SELECT id, class_id, subject_name, created_at
         FROM class_subjects
         WHERE class_id = ?
         ORDER BY subject_name ASC'
    );
    $stmt->bind_param('i', $class_id);
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    jsonResponse($rows);
}

// ── POST: create a new subject ────────────────────────────────────────────
if ($method === 'POST') {
    $data         = json_decode(file_get_contents('php://input'), true);
    $class_id     = intval($data['class_id'] ?? 0);
    $subject_name = trim($data['subject_name'] ?? '');

    if (!$class_id || $subject_name === '') {
        jsonResponse(['error' => 'class_id and subject_name required'], 400);
    }

    $stmt = $db->prepare(
        'INSERT INTO class_subjects (class_id, subject_name) VALUES (?, ?)'
    );
    $stmt->bind_param('is', $class_id, $subject_name);
    if (!$stmt->execute()) {
        if ($db->errno === 1062) {
            jsonResponse(['error' => 'Subject already exists for this class'], 409);
        }
        jsonResponse(['error' => $db->error], 500);
    }
    $new_id = $db->insert_id;
    jsonResponse(['id' => $new_id, 'class_id' => $class_id, 'subject_name' => $subject_name]);
}

// ── PUT: rename a subject ─────────────────────────────────────────────────
if ($method === 'PUT') {
    $data         = json_decode(file_get_contents('php://input'), true);
    $id           = intval($data['id'] ?? 0);
    $subject_name = trim($data['subject_name'] ?? '');

    if (!$id || $subject_name === '') {
        jsonResponse(['error' => 'id and subject_name required'], 400);
    }

    $stmt = $db->prepare(
        'UPDATE class_subjects SET subject_name = ? WHERE id = ?'
    );
    $stmt->bind_param('si', $subject_name, $id);
    if (!$stmt->execute()) {
        jsonResponse(['error' => $db->error], 500);
    }
    jsonResponse(['success' => true]);
}

// ── DELETE: remove a subject ──────────────────────────────────────────────
if ($method === 'DELETE') {
    $id = intval($_GET['id'] ?? 0);
    if (!$id) {
        jsonResponse(['error' => 'id required'], 400);
    }

    $stmt = $db->prepare('DELETE FROM class_subjects WHERE id = ?');
    $stmt->bind_param('i', $id);
    $stmt->execute();
    jsonResponse(['success' => true]);
}

jsonResponse(['error' => 'Method not allowed'], 405);
