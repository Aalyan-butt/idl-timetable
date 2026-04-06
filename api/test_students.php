<?php
require_once '../includes/config.php';
requireAuth();

$db = getDB();

// Create table if it doesn't exist
$db->query("
    CREATE TABLE IF NOT EXISTS test_students (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        test_id    INT NOT NULL,
        student_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_ts (test_id, student_id),
        KEY idx_test (test_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
");

$method  = $_SERVER['REQUEST_METHOD'];
$test_id = intval($_GET['test_id'] ?? 0);

// ── GET ?test_id=X
// Returns: { has_custom_roster, current: [...], previous: [...] }
// current  = students currently in this class
// previous = students who have marks in this test but are no longer in this class
if ($method === 'GET') {
    if (!$test_id) jsonResponse(['error' => 'test_id required'], 400);

    // Get the test's class_id
    $pt = $db->query("SELECT class_id FROM performance_tests WHERE id = $test_id")->fetch_assoc();
    if (!$pt) jsonResponse(['error' => 'Test not found'], 404);
    $class_id = intval($pt['class_id']);

    // Check if a custom roster exists
    $roster_count = (int)$db->query("SELECT COUNT(*) AS c FROM test_students WHERE test_id = $test_id")->fetch_assoc()['c'];
    $has_custom = $roster_count > 0;

    // Roster IDs (if any)
    $roster_ids = [];
    if ($has_custom) {
        $res = $db->query("SELECT student_id FROM test_students WHERE test_id = $test_id");
        while ($r = $res->fetch_assoc()) $roster_ids[] = intval($r['student_id']);
    }

    // Current students (in this class right now)
    $stmt = $db->prepare("
        SELECT id AS student_id, gr_number, student_name, photo
        FROM students
        WHERE class_id = ?
        ORDER BY student_name
    ");
    $stmt->bind_param('i', $class_id);
    $stmt->execute();
    $res = $stmt->get_result();
    $current_ids = [];
    $current = [];
    while ($r = $res->fetch_assoc()) {
        $current_ids[] = intval($r['student_id']);
        $r['in_roster'] = $has_custom ? in_array(intval($r['student_id']), $roster_ids) : true;
        $current[] = $r;
    }

    // Previous students: have marks in this test but are no longer in this class
    $current_ids_sql = implode(',', array_merge($current_ids, [0]));
    $stmt2 = $db->prepare("
        SELECT DISTINCT s.id AS student_id, s.gr_number, s.student_name, s.photo
        FROM performance_marks pm
        JOIN students s ON s.id = pm.student_id
        WHERE pm.test_id = ? AND s.id NOT IN ($current_ids_sql)
        ORDER BY s.student_name
    ");
    $stmt2->bind_param('i', $test_id);
    $stmt2->execute();
    $res2 = $stmt2->get_result();
    $previous = [];
    while ($r = $res2->fetch_assoc()) {
        $r['in_roster'] = $has_custom ? in_array(intval($r['student_id']), $roster_ids) : false;
        $previous[] = $r;
    }

    jsonResponse([
        'has_custom_roster' => $has_custom,
        'class_id'          => $class_id,
        'current'           => $current,
        'previous'          => $previous,
    ]);
}

// ── POST {test_id, student_ids: [...]}
// Replaces the full roster for this test.
// If student_ids is empty → clears the roster (reverts to all class students)
if ($method === 'POST') {
    requireAdmin();
    $data        = json_decode(file_get_contents('php://input'), true);
    $test_id     = intval($data['test_id']    ?? 0);
    $student_ids = $data['student_ids']       ?? [];

    if (!$test_id) jsonResponse(['error' => 'test_id required'], 400);

    // Clear existing roster
    $db->query("DELETE FROM test_students WHERE test_id = $test_id");

    if (!empty($student_ids)) {
        $stmt = $db->prepare("INSERT IGNORE INTO test_students (test_id, student_id) VALUES (?, ?)");
        foreach ($student_ids as $sid) {
            $sid = intval($sid);
            if (!$sid) continue;
            $stmt->bind_param('ii', $test_id, $sid);
            $stmt->execute();
        }
    }

    jsonResponse(['success' => true, 'roster_count' => count($student_ids)]);
}

// ── DELETE ?test_id=X → clears the custom roster
if ($method === 'DELETE') {
    requireAdmin();
    if (!$test_id) jsonResponse(['error' => 'test_id required'], 400);
    $db->query("DELETE FROM test_students WHERE test_id = $test_id");
    jsonResponse(['success' => true]);
}
