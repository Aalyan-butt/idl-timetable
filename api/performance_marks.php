<?php
require_once '../includes/config.php';
requireAuth();

$method = $_SERVER['REQUEST_METHOD'];
$db     = getDB();

// ── GET ──────────────────────────────────────────────────────────────────────
// ?test_id=X    → all students in the test's class + their marks
// ?student_id=X → full marks history for a student across all tests
if ($method === 'GET') {
    $test_id    = intval($_GET['test_id']    ?? 0);
    $student_id = intval($_GET['student_id'] ?? 0);

    if ($test_id) {
        // Return every student in the test's class with their marks (if any).
        // Marks are keyed by student_id, so they survive class re-assignments.
        $stmt = $db->prepare("
            SELECT s.id AS student_id,
                   s.gr_number,
                   s.student_name,
                   s.photo,
                   pm.id            AS mark_id,
                   pm.marks_obtained,
                   pm.is_absent,
                   pm.is_skip,
                   pm.comment
            FROM   students s
            JOIN   performance_tests pt ON pt.id = ? AND s.class_id = pt.class_id
            LEFT   JOIN performance_marks pm
                   ON pm.student_id = s.id AND pm.test_id = ?
            ORDER  BY s.student_name
        ");
        $stmt->bind_param('ii', $test_id, $test_id);
        $stmt->execute();
        $res  = $stmt->get_result();
        $rows = [];
        while ($r = $res->fetch_assoc()) $rows[] = $r;
        jsonResponse($rows);
    }

    if ($student_id) {
        // Full performance history for a single student (all tests they were marked in).
        $stmt = $db->prepare("
            SELECT pm.*,
                   pt.test_name,
                   pt.test_date,
                   pt.total_marks,
                   c.name          AS class_name,
                   cs.subject_name
            FROM   performance_marks pm
            JOIN   performance_tests pt ON pt.id = pm.test_id
            LEFT   JOIN classes c       ON c.id  = pt.class_id
            LEFT   JOIN class_subjects cs ON cs.id = pt.subject_id
            WHERE  pm.student_id = ?
            ORDER  BY pt.test_date DESC, pm.saved_at DESC
        ");
        $stmt->bind_param('i', $student_id);
        $stmt->execute();
        $res  = $stmt->get_result();
        $rows = [];
        while ($r = $res->fetch_assoc()) $rows[] = $r;
        jsonResponse($rows);
    }

    jsonResponse(['error' => 'test_id or student_id required'], 400);
}

// ── POST — bulk upsert marks for a test ──────────────────────────────────────
if ($method === 'POST') {
    requireAdmin();
    $data    = json_decode(file_get_contents('php://input'), true);
    $test_id = intval($data['test_id'] ?? 0);
    $marks   = $data['marks']          ?? [];

    if (!$test_id)         jsonResponse(['error' => 'test_id required'], 400);
    if (!is_array($marks)) jsonResponse(['error' => 'marks array required'], 400);

    $stmt = $db->prepare("
        INSERT INTO performance_marks
            (test_id, student_id, marks_obtained, is_absent, is_skip, comment)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            marks_obtained = VALUES(marks_obtained),
            is_absent      = VALUES(is_absent),
            is_skip        = VALUES(is_skip),
            comment        = VALUES(comment),
            saved_at       = CURRENT_TIMESTAMP
    ");

    $saved = 0;
    foreach ($marks as $m) {
        $sid      = intval($m['student_id']    ?? 0); if (!$sid) continue;
        $absent   = intval($m['is_absent']     ?? 0);
        $skip     = intval($m['is_skip']       ?? 0);
        $obtained = $absent ? null : floatval($m['marks_obtained'] ?? 0);
        $comment  = trim($m['comment']         ?? '');

        $stmt->bind_param('iidiss', $test_id, $sid, $obtained, $absent, $skip, $comment);
        $stmt->execute();
        $saved++;
    }

    // Auto-update test status: Empty / Incomplete / Done
    $filled = (int)$db->query(
        "SELECT COUNT(*) AS c FROM performance_marks WHERE test_id = $test_id"
    )->fetch_assoc()['c'];
    $total = (int)$db->query(
        "SELECT COUNT(*) AS c
         FROM   students s
         JOIN   performance_tests pt ON pt.id = $test_id AND s.class_id = pt.class_id"
    )->fetch_assoc()['c'];

    $status = 'Empty';
    if ($filled > 0 && $filled >= $total) $status = 'Done';
    elseif ($filled > 0)                  $status = 'Incomplete';

    $db->query("UPDATE performance_tests SET status = '$status' WHERE id = $test_id");

    jsonResponse(['success' => true, 'saved' => $saved, 'test_status' => $status]);
}
