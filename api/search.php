<?php
require_once '../includes/config.php';
requireAuth();

header('Content-Type: application/json');
$db = getDB();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $teacher_id = isset($_GET['teacher_id']) ? intval($_GET['teacher_id']) : 0;
    if (!$teacher_id) { echo json_encode(['error' => 'teacher_id required']); exit(); }

    // Supervisor: can only search their assigned teachers
    if (isSupervisor() && !supervisorCanAccessTeacher($teacher_id)) {
        echo json_encode(['error' => 'Teacher not assigned to you']); exit();
    }

    $stmt = $db->prepare('SELECT id, title, name FROM teachers WHERE id = ?');
    $stmt->bind_param('i', $teacher_id);
    $stmt->execute();
    $teacher = $stmt->get_result()->fetch_assoc();
    if (!$teacher) { echo json_encode(['error' => 'Teacher not found']); exit(); }

    // All teachers for name lookup
    $res = $db->query('SELECT id, title, name FROM teachers');
    $allTeachers = [];
    while ($row = $res->fetch_assoc()) $allTeachers[$row['id']] = $row;

    // Exclude break slots (is_break=1 have no teacher)
    $stmt2 = $db->prepare(
        'SELECT t.*, c.name AS class_name, te.title AS teacher_title, te.name AS teacher_name
         FROM timetable t
         JOIN classes  c  ON t.class_id  = c.id
         JOIN teachers te ON t.teacher_id = te.id
         WHERE (t.teacher_id = ? OR FIND_IN_SET(?, IFNULL(t.teacher_ids, "")))
           AND (t.is_break = 0 OR t.is_break IS NULL)
         ORDER BY t.days, t.start_time'
    );
    $stmt2->bind_param('ii', $teacher_id, $teacher_id);
    $stmt2->execute();
    $res2 = $stmt2->get_result();

    $slots = [];
    while ($row = $res2->fetch_assoc()) {
        $ids = array_filter(array_map('intval', explode(',', $row['teacher_ids'] ?: $row['teacher_id'])));
        $names = [];
        foreach ($ids as $tid) {
            if (isset($allTeachers[$tid])) $names[] = $allTeachers[$tid]['title'] . ' ' . $allTeachers[$tid]['name'];
        }
        $row['all_teacher_names'] = implode(', ', $names);
        $row['teacher_count']     = count($ids);
        $slots[] = $row;
    }
    echo json_encode(['teacher' => $teacher, 'slots' => $slots, 'count' => count($slots)]);
    exit();
}
echo json_encode(['error' => 'Method not allowed']);
