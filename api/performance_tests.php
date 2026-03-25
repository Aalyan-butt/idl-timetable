<?php
require_once '../includes/config.php';
requireAuth();

$method = $_SERVER['REQUEST_METHOD'];
$db     = getDB();

function extractPTData($data) {
    return [
        'test_name'            => trim($data['test_name']            ?? ''),
        'test_date'            => (trim($data['test_date']           ?? '') ?: null),
        'marks_entry_deadline' => (trim($data['marks_entry_deadline']?? '') ?: null),
        'total_marks'          => (isset($data['total_marks'])  && $data['total_marks']  !== '' ? (float)$data['total_marks']  : null),
        'class_id'             => (isset($data['class_id'])     && $data['class_id']     !== '' ? (int)$data['class_id']     : null),
        'subject_id'           => (isset($data['subject_id'])   && $data['subject_id']   !== '' ? (int)$data['subject_id']   : null),
        'teacher_id'           => (isset($data['teacher_id'])   && $data['teacher_id']   !== '' ? (int)$data['teacher_id']   : null),
        'notify_teacher'       => !empty($data['notify_teacher']) ? 1 : 0,
        'coverage_details'     => trim($data['coverage_details'] ?? ''),
        'status'               => in_array($data['status'] ?? '', ['Empty','Incomplete','Done']) ? $data['status'] : 'Empty',
    ];
}

if ($method === 'GET') {
    $id = $_GET['id'] ?? null;
    $sql = 'SELECT pt.*,
                c.name          AS class_name,
                s.subject_name,
                CONCAT(t.title," ",t.name) AS teacher_name
            FROM performance_tests pt
            LEFT JOIN classes  c ON pt.class_id   = c.id
            LEFT JOIN class_subjects s ON pt.subject_id = s.id
            LEFT JOIN teachers t ON pt.teacher_id = t.id';

    if ($id) {
        $stmt = $db->prepare($sql . ' WHERE pt.id = ?');
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        if (!$row) jsonResponse(['error' => 'Not found'], 404);
        jsonResponse($row);
    }

    $rows = $db->query($sql . ' ORDER BY pt.test_date DESC, pt.id DESC')->fetch_all(MYSQLI_ASSOC);
    jsonResponse($rows);
}

if ($method === 'POST') {
    requireAdmin();
    $data = json_decode(file_get_contents('php://input'), true);
    $f    = extractPTData($data);

    if (empty($f['test_name'])) jsonResponse(['error' => 'Test name is required'], 400);

    $stmt = $db->prepare(
        'INSERT INTO performance_tests
         (test_name, test_date, marks_entry_deadline, total_marks,
          class_id, subject_id, teacher_id, notify_teacher, coverage_details, status)
         VALUES (?,?,?,?,?,?,?,?,?,?)'
    );
    $stmt->bind_param('sssdiiiiss',
        $f['test_name'], $f['test_date'], $f['marks_entry_deadline'], $f['total_marks'],
        $f['class_id'], $f['subject_id'], $f['teacher_id'], $f['notify_teacher'],
        $f['coverage_details'], $f['status']
    );
    if ($stmt->execute()) {
        jsonResponse(['success' => true, 'id' => $db->insert_id]);
    } else {
        jsonResponse(['error' => 'Failed: ' . $db->error], 500);
    }
}

if ($method === 'PUT') {
    requireAdmin();
    $id = $_GET['id'] ?? null;
    if (!$id) jsonResponse(['error' => 'ID required'], 400);

    $data = json_decode(file_get_contents('php://input'), true);
    $f    = extractPTData($data);
    if (empty($f['test_name'])) jsonResponse(['error' => 'Test name is required'], 400);

    $stmt = $db->prepare(
        'UPDATE performance_tests SET
         test_name=?, test_date=?, marks_entry_deadline=?, total_marks=?,
         class_id=?, subject_id=?, teacher_id=?, notify_teacher=?,
         coverage_details=?, status=?
         WHERE id=?'
    );
    $stmt->bind_param('sssdiiissi',
        $f['test_name'], $f['test_date'], $f['marks_entry_deadline'], $f['total_marks'],
        $f['class_id'], $f['subject_id'], $f['teacher_id'], $f['notify_teacher'],
        $f['coverage_details'], $f['status'], $id
    );
    if ($stmt->execute()) {
        jsonResponse(['success' => true]);
    } else {
        jsonResponse(['error' => 'Failed: ' . $db->error], 500);
    }
}

if ($method === 'DELETE') {
    requireAdmin();
    $id = $_GET['id'] ?? null;
    if (!$id) jsonResponse(['error' => 'ID required'], 400);
    $stmt = $db->prepare('DELETE FROM performance_tests WHERE id=?');
    $stmt->bind_param('i', $id);
    if ($stmt->execute()) {
        jsonResponse(['success' => true]);
    } else {
        jsonResponse(['error' => 'Failed: ' . $db->error], 500);
    }
}
