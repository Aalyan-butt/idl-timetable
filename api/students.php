<?php

// Debug logging helper
function debug_log($msg) {
    file_put_contents(__DIR__ . '/../debug_students.log', date('Y-m-d H:i:s') . ' ' . $msg . "\n", FILE_APPEND);
}

require_once '../includes/config.php';
debug_log('students.php loaded');
requireAuth();
debug_log('Auth passed, method: ' . ($_SERVER['REQUEST_METHOD'] ?? 'unknown'));

$method = $_SERVER['REQUEST_METHOD'];
$db     = null;
try {
    $db = getDB();
    debug_log('DB connection OK');
} catch (Exception $e) {
    debug_log('DB connection failed: ' . $e->getMessage());
    echo json_encode(['error' => 'DB connection failed', 'debug' => $e->getMessage()]);
    exit();
}

$action = $_GET['action'] ?? '';
$role   = $_SESSION['role'] ?? '';
debug_log('Role: ' . $role);
debug_log('Action: ' . $action);

// ── Helper: add virtual first_name / last_name from student_name ──
function addNameParts(array &$row): void {
    $name = $row['student_name'] ?? '';
    $pos  = strpos($name, ' ');
    $row['first_name'] = $pos !== false ? substr($name, 0, $pos) : $name;
    $row['last_name']  = $pos !== false ? trim(substr($name, $pos + 1)) : '';
}

// Apply to a list
function addNamePartsAll(array &$rows): void {
    foreach ($rows as &$r) addNameParts($r);
}

// ── Safe logNotification wrapper ────────────────────────────────
function safeLogNotification(...$args): void {
    if (function_exists('logNotification')) {
        logNotification(...$args);
    }
}

// ── Student comments ────────────────────────────────────────────
if ($action === 'comments') {
    if ($method === 'GET') {
        $student_id = intval($_GET['student_id'] ?? 0);
        if (!$student_id) { jsonResponse(['error' => 'student_id required'], 400); exit(); }
        debug_log('Fetching comments for student_id=' . $student_id);
        $stmt = $db->prepare('SELECT * FROM student_comments WHERE student_id=? ORDER BY created_at DESC');
        $stmt->bind_param('i', $student_id);
        $stmt->execute();
        $result = $stmt->get_result();
        $comments = [];
        while ($row = $result->fetch_assoc()) $comments[] = $row;
        jsonResponse($comments);
        exit();
    }

    if ($method === 'POST') {
        if (!in_array($role, ['admin', 'superadmin'])) { jsonResponse(['error' => 'Admin access required'], 403); exit(); }
        $data = json_decode(file_get_contents('php://input'), true);
        $student_id = intval($data['student_id'] ?? $_GET['student_id'] ?? 0);
        if (!$student_id) { jsonResponse(['error' => 'student_id required'], 400); exit(); }
        $comment = trim($data['comment'] ?? '');
        if (!$comment) { jsonResponse(['error' => 'Comment is required'], 400); exit(); }
        $author      = $_SESSION['username'] ?? '';
        $author_role = $role;
        debug_log('Inserting comment for student_id=' . $student_id);
        $stmt = $db->prepare('INSERT INTO student_comments (student_id, comment, author_username, author_role) VALUES (?,?,?,?)');
        $stmt->bind_param('isss', $student_id, $comment, $author, $author_role);
        if ($stmt->execute()) { jsonResponse(['success' => true, 'id' => $db->insert_id]); exit(); }
        else { jsonResponse(['error' => 'Failed to add comment'], 500); exit(); }
    }

    if ($method === 'DELETE') {
        if (!in_array($role, ['admin', 'superadmin'])) { jsonResponse(['error' => 'Admin access required'], 403); exit(); }
        $data = json_decode(file_get_contents('php://input'), true);
        $comment_id = intval($data['id'] ?? $_GET['id'] ?? 0);
        if (!$comment_id) { jsonResponse(['error' => 'Comment ID required'], 400); exit(); }
        debug_log('Deleting comment id=' . $comment_id);
        $stmt = $db->prepare('DELETE FROM student_comments WHERE id=?');
        $stmt->bind_param('i', $comment_id);
        if ($stmt->execute()) { jsonResponse(['success' => true]); exit(); }
        else { jsonResponse(['error' => 'Failed to delete comment'], 500); exit(); }
    }
    exit();
}

// ── Siblings lookup (by father CNIC) ────────────────────────────
if ($action === 'siblings') {
    $father_cnic = trim($_GET['father_cnic'] ?? '');
    $student_id  = intval($_GET['student_id'] ?? 0);

    if (!$father_cnic && $student_id) {
        $stmt = $db->prepare('SELECT father_cnic FROM students WHERE id=?');
        $stmt->bind_param('i', $student_id);
        $stmt->execute();
        $row         = $stmt->get_result()->fetch_assoc();
        $father_cnic = $row['father_cnic'] ?? '';
    }
    if (!$father_cnic) { jsonResponse([]); exit(); }

    debug_log('Siblings lookup for father_cnic=' . $father_cnic);
    $stmt2 = $db->prepare('SELECT s.id, s.student_name, s.gr_number, s.class_id, c.name as class_name FROM students s LEFT JOIN classes c ON c.id=s.class_id WHERE s.father_cnic=? ORDER BY s.student_name');
    $stmt2->bind_param('s', $father_cnic);
    $stmt2->execute();
    $result   = $stmt2->get_result();
    $siblings = [];
    while ($r = $result->fetch_assoc()) { addNameParts($r); $siblings[] = $r; }
    jsonResponse($siblings);
    exit();
}

// ── Student schedule (for student/parent dashboards) ────────────
if ($action === 'my_schedule') {
    $student_id = intval($_GET['child_id'] ?? $_GET['student_id'] ?? ($_SESSION['student_id'] ?? 0));
    if (!$student_id) { jsonResponse(['error' => 'No student linked'], 400); exit(); }

    if ($role === 'parent') {
        $myStudentId = intval($_SESSION['student_id'] ?? 0);
        if ($myStudentId) {
            $stmt = $db->prepare('SELECT father_cnic FROM students WHERE id=?');
            $stmt->bind_param('i', $myStudentId);
            $stmt->execute();
            $parentRow = $stmt->get_result()->fetch_assoc();
            if ($parentRow && !empty($parentRow['father_cnic'])) {
                $stmt2 = $db->prepare('SELECT id FROM students WHERE father_cnic=? AND id=?');
                $stmt2->bind_param('si', $parentRow['father_cnic'], $student_id);
                $stmt2->execute();
                if (!$stmt2->get_result()->fetch_assoc()) {
                    jsonResponse(['error' => 'Access denied'], 403);
                    exit();
                }
            } else {
                $student_id = $myStudentId;
            }
        }
    }

    debug_log('Student schedule for student_id=' . $student_id);
    $stmt = $db->prepare('SELECT s.*, c.name as class_name FROM students s LEFT JOIN classes c ON c.id=s.class_id WHERE s.id=?');
    $stmt->bind_param('i', $student_id);
    $stmt->execute();
    $student = $stmt->get_result()->fetch_assoc();
    if (!$student) { jsonResponse(['error' => 'Student not found'], 404); exit(); }
    addNameParts($student);

    $slots = [];
    if (!empty($student['class_id'])) {
        $stmt2 = $db->prepare('SELECT t.*, c.name as class_name FROM timetable t LEFT JOIN classes c ON c.id=t.class_id WHERE t.class_id=? ORDER BY t.start_time');
        $stmt2->bind_param('i', $student['class_id']);
        $stmt2->execute();
        $result = $stmt2->get_result();
        while ($r = $result->fetch_assoc()) $slots[] = $r;
    }

    jsonResponse(['student' => $student, 'slots' => $slots, 'class_name' => $student['class_name'] ?? '']);
    exit();
}

// ── Parent: get all children ────────────────────────────────────
if ($action === 'my_children') {
    if ($role !== 'parent') { jsonResponse(['error' => 'Parent access required'], 403); exit(); }
    $myStudentId = intval($_SESSION['student_id'] ?? 0);
    if (!$myStudentId) { jsonResponse([]); exit(); }

    debug_log('Parent my_children for student_id=' . $myStudentId);
    $stmt = $db->prepare('SELECT father_cnic FROM students WHERE id=?');
    $stmt->bind_param('i', $myStudentId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    if (!$row || empty($row['father_cnic'])) { jsonResponse([]); exit(); }

    $cnic  = $row['father_cnic'];
    $stmt2 = $db->prepare('SELECT s.*, c.name as class_name FROM students s LEFT JOIN classes c ON c.id=s.class_id WHERE s.father_cnic=? ORDER BY s.student_name');
    $stmt2->bind_param('s', $cnic);
    $stmt2->execute();
    $result   = $stmt2->get_result();
    $children = [];
    while ($r = $result->fetch_assoc()) { addNameParts($r); $children[] = $r; }
    jsonResponse(['children' => $children]);
    exit();
}

// ── Confirm registration ─────────────────────────────────────────
if ($action === 'confirm' && $method === 'POST') {
    if (!in_array($role, ['admin', 'superadmin'])) { jsonResponse(['error' => 'Admin access required'], 403); exit(); }
    $data = json_decode(file_get_contents('php://input'), true);
    $id   = intval($data['id'] ?? 0);
    if (!$id) { jsonResponse(['error' => 'ID required'], 400); exit(); }
    $stmt = $db->prepare("UPDATE students SET registration_status='confirmed' WHERE id=?");
    $stmt->bind_param('i', $id);
    if ($stmt->execute()) { jsonResponse(['success' => true]); }
    else { jsonResponse(['error' => 'Failed to confirm'], 500); }
    exit();
}

// ── Preview next GR# ────────────────────────────────────────────
if ($action === 'next_gr') {
    debug_log('Preview next GR#');
    $grq    = $db->query("SELECT MAX(CAST(gr_number AS UNSIGNED)) as max_gr, MAX(sr_number) as max_sr FROM students");
    $grRow  = $grq ? $grq->fetch_assoc() : [];
    $max_gr = $grRow['max_gr'] ? intval($grRow['max_gr']) : 0;
    $max_sr = $grRow['max_sr'] ? intval($grRow['max_sr']) : 0;
    jsonResponse(['next_gr' => str_pad($max_gr + 1, 3, '0', STR_PAD_LEFT), 'next_sr' => $max_sr + 1]);
    exit();
}

// ── Shared field list (used for both INSERT and UPDATE) ──────────
$studentFields = [
    'student_name', 'class_id', 'referred_by', 'date_of_birth', 'gender',
    'religion', 'caste', 'place_of_birth', 'nationality', 'nic_passport',
    'b_form', 'admission_date', 'registration_no', 'previous_school',
    'reason_for_leaving', 'photo', 'student_mobile',
    'mother_phone', 'mother_name', 'mother_profession', 'mother_nic',
    'guardian_phone', 'emergency_contact', 'student_address', 'student_city',
    'registration_remarks', 'campus_private_remarks',
    'father_name', 'father_cnic', 'father_phone', 'father_occupation',
    'father_designation', 'father_email', 'father_address', 'father_relationship',
    'physical_handicap', 'blood_group',
    'fee_1_type', 'fee_1_amount', 'fee_2_type', 'fee_2_amount',
    'fee_3_type', 'fee_3_amount', 'fee_4_type', 'fee_4_amount',
    'test_date', 'test_for_class', 'total_test_marks', 'total_obtained_marks',
    'registration_status'
];

// ── Fee fields treated as decimals ──────────────────────────────
$decimalFields = ['fee_1_amount','fee_2_amount','fee_3_amount','fee_4_amount'];

// ── Photo validation helper ──────────────────────────────────────
// FIX: Now also accepts relative server paths (e.g. "uploads/photo.jpg"),
// not just data URIs and full URLs
function validatePhoto(?string $v): ?string {
    if (!$v) return null;
    if (strpos($v, 'data:image') === 0)   return $v; // base64 data URI
    if (filter_var($v, FILTER_VALIDATE_URL)) return $v; // absolute URL
    if (preg_match('/^[a-zA-Z0-9_\-\/\.]+$/', $v)) return $v; // relative path
    return null;
}

// ── CRUD ─────────────────────────────────────────────────────────
if ($method === 'GET') {
    debug_log('GET method');
    if (isset($_GET['id'])) {
        $id = intval($_GET['id']);
        debug_log('Fetching student by id=' . $id);
        $stmt = $db->prepare('SELECT s.*, c.name as class_name FROM students s LEFT JOIN classes c ON c.id=s.class_id WHERE s.id=?');
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $student = $stmt->get_result()->fetch_assoc();
        if (!$student) { jsonResponse(['error' => 'Student not found'], 404); exit(); }
        addNameParts($student);
        jsonResponse($student);
        exit(); // FIX: was missing — without this, code fell through to the list query below
    }
    // List all students
    debug_log('Fetching all students');
    $result   = $db->query('SELECT s.*, c.name as class_name FROM students s LEFT JOIN classes c ON c.id=s.class_id ORDER BY s.student_name');
    $students = [];
    while ($row = $result->fetch_assoc()) { addNameParts($row); $students[] = $row; }
    jsonResponse($students);
    exit();
}

if ($method === 'POST') {
    debug_log('POST method');
    if (!in_array($role, ['admin', 'superadmin'])) { jsonResponse(['error' => 'Admin access required'], 403); exit(); }
    $data = json_decode(file_get_contents('php://input'), true);

    $first_name   = trim($data['first_name'] ?? '');
    $last_name    = trim($data['last_name']  ?? '');
    $student_name = trim($first_name . ' ' . $last_name);
    if (!$first_name) { jsonResponse(['error' => 'First name is required'], 400); exit(); }
    $data['student_name'] = $student_name;

    $cols = []; $placeholders = []; $types = ''; $vals = [];
    foreach ($studentFields as $f) {
        $v = $data[$f] ?? null;
        if ($f === 'photo') $v = validatePhoto($v);
        // FIX: class_id must be bound as integer, not string
        if ($f === 'class_id') {
            $cols[] = '`class_id`'; $placeholders[] = '?';
            $types .= 'i'; $vals[] = $v ? intval($v) : null; continue;
        }
        if (in_array($f, $decimalFields)) {
            $cols[] = "`$f`"; $placeholders[] = '?';
            $types .= 'd'; $vals[] = ($v !== null && $v !== '') ? floatval($v) : null; continue;
        }
        $cols[]         = "`$f`";
        $placeholders[] = '?';
        $types .= 's';
        $vals[] = is_null($v) ? null : trim((string)$v);
    }

    // Auto-generate next GR# and Sr#
    $grq     = $db->query("SELECT MAX(CAST(gr_number AS UNSIGNED)) as max_gr, MAX(sr_number) as max_sr FROM students");
    $grRow   = $grq ? $grq->fetch_assoc() : [];
    $max_gr  = $grRow['max_gr'] ? intval($grRow['max_gr']) : 0;
    $next_gr = str_pad($max_gr + 1, 3, '0', STR_PAD_LEFT);
    $next_sr = ($grRow['max_sr'] ? intval($grRow['max_sr']) : 0) + 1;
    $cols[]         = '`gr_number`';
    $placeholders[] = '?';
    $types .= 's';
    $vals[] = $next_gr;
    $cols[]         = '`sr_number`';
    $placeholders[] = '?';
    $types .= 'i';
    $vals[] = $next_sr;

    $sql  = 'INSERT INTO students (' . implode(',', $cols) . ') VALUES (' . implode(',', $placeholders) . ')';
    debug_log('Inserting new student: ' . $student_name);
    $stmt = $db->prepare($sql);
    $stmt->bind_param($types, ...$vals);
    if ($stmt->execute()) {
        $newId = $db->insert_id;
        safeLogNotification('add', 'student', $newId, $student_name);
        jsonResponse(['success' => true, 'id' => $newId, 'gr_number' => $next_gr, 'sr_number' => $next_sr]);
    } else {
        jsonResponse(['error' => 'Failed to create student: ' . $db->error], 500);
    }
    exit();
}

if ($method === 'PUT') {
    debug_log('PUT method');
    if (!in_array($role, ['admin', 'superadmin'])) { jsonResponse(['error' => 'Admin access required'], 403); exit(); }
    $data = json_decode(file_get_contents('php://input'), true);
    $id   = intval($data['id'] ?? $_GET['id'] ?? 0);
    if (!$id) { jsonResponse(['error' => 'ID required'], 400); exit(); }

    $first_name   = trim($data['first_name'] ?? '');
    $last_name    = trim($data['last_name']  ?? '');
    $student_name = trim($first_name . ' ' . $last_name);
    if (!$first_name) { jsonResponse(['error' => 'First name is required'], 400); exit(); }
    $data['student_name'] = $student_name;

    // Snapshot old row
    debug_log('Updating student id=' . $id);
    $old = $db->prepare('SELECT * FROM students WHERE id=?');
    $old->bind_param('i', $id);
    $old->execute();
    $oldRow = $old->get_result()->fetch_assoc();
    if (!$oldRow) { jsonResponse(['error' => 'Student not found'], 404); exit(); }

    $sets  = []; $types = ''; $vals = [];
    foreach ($studentFields as $f) {
        $v = $data[$f] ?? null;
        if ($f === 'photo') $v = validatePhoto($v);
        // FIX: class_id must be bound as integer, not string
        if ($f === 'class_id') {
            $sets[] = '`class_id`=?'; $types .= 'i';
            $vals[] = $v ? intval($v) : null; continue;
        }
        if (in_array($f, $decimalFields)) {
            $sets[] = "`$f`=?"; $types .= 'd';
            $vals[] = ($v !== null && $v !== '') ? floatval($v) : null; continue;
        }
        $sets[] = "`$f`=?";
        $types .= 's';
        $vals[] = is_null($v) ? null : trim((string)$v);
    }
    $types .= 'i';
    $vals[] = $id;

    $sql  = 'UPDATE students SET ' . implode(',', $sets) . ' WHERE id=?';
    $stmt = $db->prepare($sql);
    $stmt->bind_param($types, ...$vals);
    if ($stmt->execute()) {
        safeLogNotification('edit', 'student', $id, $student_name, $oldRow);
        jsonResponse(['success' => true]);
    } else {
        jsonResponse(['error' => 'Failed to update student: ' . $db->error], 500);
    }
    exit();
}

if ($method === 'DELETE') {
    debug_log('DELETE method');
    if (!in_array($role, ['admin', 'superadmin'])) { jsonResponse(['error' => 'Admin access required'], 403); exit(); }
    $data = json_decode(file_get_contents('php://input'), true);
    $id   = intval($data['id'] ?? $_GET['id'] ?? 0);
    if (!$id) { jsonResponse(['error' => 'ID required'], 400); exit(); }

    debug_log('Deleting student id=' . $id);
    $old = $db->prepare('SELECT * FROM students WHERE id=?');
    $old->bind_param('i', $id);
    $old->execute();
    $oldRow = $old->get_result()->fetch_assoc();
    if (!$oldRow) { jsonResponse(['error' => 'Student not found'], 404); exit(); }

    $delComments = $db->prepare('DELETE FROM student_comments WHERE student_id=?');
    if ($delComments) { $delComments->bind_param('i', $id); $delComments->execute(); }

    $stmt = $db->prepare('DELETE FROM students WHERE id=?');
    $stmt->bind_param('i', $id);
    if ($stmt->execute()) {
        safeLogNotification('delete', 'student', $id, $oldRow['student_name'] ?? '', $oldRow);
        jsonResponse(['success' => true]);
    } else {
        jsonResponse(['error' => 'Failed to delete student'], 500);
    }
    exit();
}