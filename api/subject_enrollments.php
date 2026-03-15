<?php
require_once '../includes/config.php';
requireAdmin();

$method = $_SERVER['REQUEST_METHOD'];
$db     = getDB();

// Ensure the table exists
$db->query(
    'CREATE TABLE IF NOT EXISTS `subject_enrollments` (
       `id`          int(11) NOT NULL AUTO_INCREMENT,
       `subject_id`  int(11) NOT NULL,
       `student_id`  int(11) NOT NULL,
       `enrolled_at` timestamp NULL DEFAULT current_timestamp(),
       PRIMARY KEY (`id`),
       UNIQUE KEY `uq_subject_student` (`subject_id`, `student_id`),
       KEY `idx_subject_id` (`subject_id`),
       KEY `idx_student_id` (`student_id`)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
);

// ── GET ───────────────────────────────────────────────────────────────────────
if ($method === 'GET') {
    $action = $_GET['action'] ?? '';

    // All class_subjects with class names (for dropdown population)
    if ($action === 'all_subjects') {
        $stmt = $db->prepare(
            'SELECT cs.id, cs.class_id, cs.subject_name, c.name AS class_name
             FROM class_subjects cs
             JOIN classes c ON c.id = cs.class_id
             ORDER BY c.name ASC, cs.subject_name ASC'
        );
        $stmt->execute();
        jsonResponse($stmt->get_result()->fetch_all(MYSQLI_ASSOC));
    }

    if ($action === 'all_enrollments') {
        $stmt = $db->prepare(
            'SELECT se.id, se.subject_id, se.student_id, se.enrolled_at,
                    s.student_name, s.gr_number, s.father_name, s.class_id,
                    COALESCE(c.name, \'\') AS class_name,
                    cs.subject_name
             FROM subject_enrollments se
             JOIN students s ON s.id = se.student_id
             JOIN class_subjects cs ON cs.id = se.subject_id
             LEFT JOIN classes c ON c.id = s.class_id
             ORDER BY s.student_name ASC, cs.subject_name ASC'
        );
        $stmt->execute();
        jsonResponse($stmt->get_result()->fetch_all(MYSQLI_ASSOC));
    }

    // Enrollments for a subject → returns rows with student details
    $subject_id = intval($_GET['subject_id'] ?? 0);
    if ($subject_id) {
        $stmt = $db->prepare(
            'SELECT se.id, se.subject_id, se.student_id, se.enrolled_at,
                    s.student_name, s.gr_number, s.father_name, s.class_id,
                    COALESCE(c.name, \'\') AS class_name
             FROM subject_enrollments se
             JOIN students s ON s.id = se.student_id
             LEFT JOIN classes c ON c.id = s.class_id
             WHERE se.subject_id = ?
             ORDER BY s.student_name ASC'
        );
        $stmt->bind_param('i', $subject_id);
        $stmt->execute();
        jsonResponse($stmt->get_result()->fetch_all(MYSQLI_ASSOC));
    }

    // Enrollments for a student → returns rows with subject + class details
    $student_id = intval($_GET['student_id'] ?? 0);
    if ($student_id) {
        $stmt = $db->prepare(
            'SELECT se.id, se.subject_id, se.student_id, se.enrolled_at,
                    cs.subject_name, cs.class_id,
                    c.name AS class_name
             FROM subject_enrollments se
             JOIN class_subjects cs ON cs.id = se.subject_id
             JOIN classes c ON c.id = cs.class_id
             WHERE se.student_id = ?
             ORDER BY c.name ASC, cs.subject_name ASC'
        );
        $stmt->bind_param('i', $student_id);
        $stmt->execute();
        jsonResponse($stmt->get_result()->fetch_all(MYSQLI_ASSOC));
    }

    jsonResponse(['error' => 'subject_id or student_id required'], 400);
}

// ── POST: enroll a student in a subject ──────────────────────────────────────
if ($method === 'POST') {
    $data       = json_decode(file_get_contents('php://input'), true);
    $subject_id = intval($data['subject_id'] ?? 0);
    $student_id = intval($data['student_id'] ?? 0);

    if (!$subject_id || !$student_id) {
        jsonResponse(['error' => 'subject_id and student_id required'], 400);
    }

    $stmt = $db->prepare(
        'INSERT INTO subject_enrollments (subject_id, student_id) VALUES (?, ?)'
    );
    $stmt->bind_param('ii', $subject_id, $student_id);
    if (!$stmt->execute()) {
        if ($db->errno === 1062) {
            jsonResponse(['error' => 'Student is already enrolled in this subject'], 409);
        }
        jsonResponse(['error' => $db->error], 500);
    }
    $new_id = $db->insert_id;
    logNotification('add', 'subject_enrollment', $new_id, "Enrollment #$new_id");
    jsonResponse(['id' => $new_id, 'subject_id' => $subject_id, 'student_id' => $student_id]);
}

// ── PUT: move enrollment to a different subject ───────────────────────────────
if ($method === 'PUT') {
    $data       = json_decode(file_get_contents('php://input'), true);
    $id         = intval($data['id'] ?? 0);
    $subject_id = intval($data['subject_id'] ?? 0);

    if (!$id || !$subject_id) {
        jsonResponse(['error' => 'id and subject_id required'], 400);
    }

    $stmt = $db->prepare(
        'UPDATE subject_enrollments SET subject_id = ? WHERE id = ?'
    );
    $stmt->bind_param('ii', $subject_id, $id);
    if (!$stmt->execute()) {
        if ($db->errno === 1062) {
            jsonResponse(['error' => 'Student is already enrolled in the target subject'], 409);
        }
        jsonResponse(['error' => $db->error], 500);
    }
    logNotification('edit', 'subject_enrollment', $id, "Enrollment #$id");
    jsonResponse(['success' => true]);
}

// ── DELETE: remove an enrollment ─────────────────────────────────────────────
if ($method === 'DELETE') {
    $id = intval($_GET['id'] ?? 0);
    if (!$id) {
        jsonResponse(['error' => 'id required'], 400);
    }

    $stmt = $db->prepare('DELETE FROM subject_enrollments WHERE id = ?');
    $stmt->bind_param('i', $id);
    $stmt->execute();
    logNotification('delete', 'subject_enrollment', $id, "Enrollment #$id");
    jsonResponse(['success' => true]);
}

jsonResponse(['error' => 'Method not allowed'], 405);
