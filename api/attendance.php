<?php
/**
 * Attendance API — Staff & Student Attendance
 * Endpoints:
 *   GET  ?type=staff&date=YYYY-MM-DD            — fetch staff attendance for a date (with teacher list)
 *   GET  ?type=staff_overview&...               — paginated history + stats
 *   GET  ?type=student&date=YYYY-MM-DD&class_id=N
 *   GET  ?type=student_overview&...
 *   POST {type, records:[{id,status,notes}...], date}  — bulk save
 *   GET  ?type=staff_summary&teacher_id=N&from=&to=    — per-teacher summary
 *   GET  ?type=student_summary&student_id=N&from=&to=
 */
require_once '../includes/config.php';
requireAuth();

$method = $_SERVER['REQUEST_METHOD'];
$db     = getDB();

// ──────────────────────────────────────────────────────────────────
// GET
// ──────────────────────────────────────────────────────────────────
if ($method === 'GET') {
    $type = $_GET['type'] ?? '';

    // ------ Barcode Lookup: validate a barcode and return person info ------
    if ($type === 'qr_lookup') {
        $code = trim($_GET['code'] ?? '');
        if (!$code) jsonResponse(['error' => 'No code provided'], 400);
        $info = parseAttendanceBarcode($db, $code);
        if (!$info) jsonResponse(['error' => 'Unknown barcode'], 404);
        jsonResponse($info);
    }

    // ------ Staff attendance for a given date ------
    if ($type === 'staff') {
        $date = $_GET['date'] ?? date('Y-m-d');
        if (!isValidDate($date)) jsonResponse(['error' => 'Invalid date'], 400);

        $teachers = [];
        $res = $db->query("SELECT id, CONCAT(title,' ',name) AS full_name, phone, designation FROM teachers ORDER BY name");
        while ($r = $res->fetch_assoc()) $teachers[] = $r;

        $attendance = [];
        $stmt = $db->prepare("SELECT teacher_id, status, notes FROM staff_attendance WHERE date = ?");
        $stmt->bind_param('s', $date);
        $stmt->execute();
        $res2 = $stmt->get_result();
        while ($r = $res2->fetch_assoc()) $attendance[$r['teacher_id']] = $r;

        foreach ($teachers as &$t) {
            $a = $attendance[$t['id']] ?? null;
            $t['status'] = $a ? $a['status'] : null;
            $t['notes']  = $a ? $a['notes']  : '';
        }
        jsonResponse(['date' => $date, 'teachers' => $teachers]);
    }

    // ------ Staff overview: history + stats ------
    if ($type === 'staff_overview') {
        $teacher_id = intval($_GET['teacher_id'] ?? 0);
        $from       = $_GET['from'] ?? date('Y-m-01');
        $to         = $_GET['to']   ?? date('Y-m-d');
        $status     = $_GET['status'] ?? '';
        $page       = max(1, intval($_GET['page'] ?? 1));
        $limit      = 50;
        $offset     = ($page - 1) * $limit;

        if (!isValidDate($from) || !isValidDate($to)) jsonResponse(['error' => 'Invalid date'], 400);

        $where = ['a.date BETWEEN ? AND ?'];
        $params = [$from, $to];
        $types  = 'ss';

        if ($teacher_id > 0) { $where[] = 'a.teacher_id = ?'; $params[] = $teacher_id; $types .= 'i'; }
        if (in_array($status, ['present','absent','late','leave'])) { $where[] = 'a.status = ?'; $params[] = $status; $types .= 's'; }

        $wSql = implode(' AND ', $where);

        // Summary counts
        $sumStmt = $db->prepare("SELECT status, COUNT(*) AS cnt FROM staff_attendance a WHERE $wSql GROUP BY status");
        $sumStmt->bind_param($types, ...$params);
        $sumStmt->execute();
        $summary = ['present'=>0,'absent'=>0,'late'=>0,'leave'=>0,'pending'=>0,'total'=>0];
        $res = $sumStmt->get_result();
        while ($r = $res->fetch_assoc()) { $summary[$r['status']] = (int)$r['cnt']; $summary['total'] += (int)$r['cnt']; }

        // Paginated records
        $recStmt = $db->prepare(
            "SELECT a.id, a.date, a.status, a.notes, a.teacher_id,
                    CONCAT(t.title,' ',t.name) AS teacher_name, t.designation
             FROM staff_attendance a
             JOIN teachers t ON t.id = a.teacher_id
             WHERE $wSql
             ORDER BY a.date DESC, t.name ASC
             LIMIT ? OFFSET ?"
        );
        $recTypes = $types . 'ii';
        $recParams = array_merge($params, [$limit, $offset]);
        $recStmt->bind_param($recTypes, ...$recParams);
        $recStmt->execute();
        $records = [];
        $res2 = $recStmt->get_result();
        while ($r = $res2->fetch_assoc()) $records[] = $r;

        // Count total matching for pagination
        $cntStmt = $db->prepare("SELECT COUNT(*) FROM staff_attendance a WHERE $wSql");
        $cntStmt->bind_param($types, ...$params);
        $cntStmt->execute();
        $total_rows = $cntStmt->get_result()->fetch_row()[0];

        jsonResponse(['summary' => $summary, 'records' => $records, 'total' => (int)$total_rows, 'page' => $page, 'pages' => ceil($total_rows / $limit)]);
    }

    // ------ Per-teacher summary (for detail modal) ------
    if ($type === 'staff_summary') {
        $tid  = intval($_GET['teacher_id'] ?? 0);
        $from = $_GET['from'] ?? date('Y-m-01');
        $to   = $_GET['to']   ?? date('Y-m-d');
        if ($tid < 1 || !isValidDate($from) || !isValidDate($to)) jsonResponse(['error' => 'Bad params'], 400);

        $stmt = $db->prepare("SELECT date, status, notes FROM staff_attendance WHERE teacher_id=? AND date BETWEEN ? AND ? ORDER BY date DESC");
        $stmt->bind_param('iss', $tid, $from, $to);
        $stmt->execute();
        $rows = [];
        $res  = $stmt->get_result();
        while ($r = $res->fetch_assoc()) $rows[] = $r;

        $stats = ['present'=>0,'absent'=>0,'late'=>0,'leave'=>0];
        foreach ($rows as $r) if (isset($stats[$r['status']])) $stats[$r['status']]++;
        jsonResponse(['records' => $rows, 'stats' => $stats]);
    }

    // ------ Student attendance for a date + class (class_id=0 = all classes) ------
    if ($type === 'student') {
        $date     = $_GET['date']     ?? date('Y-m-d');
        $class_id = intval($_GET['class_id'] ?? 0);
        if (!isValidDate($date)) jsonResponse(['error' => 'Invalid date'], 400);

        $students = [];
        if ($class_id > 0) {
            // Single class
            $stmt = $db->prepare(
                "SELECT s.id, s.student_name AS full_name, s.gr_number AS reg_number, s.photo, s.class_id, '' AS class_name
                 FROM students s
                 WHERE s.class_id = ?
                 ORDER BY s.student_name"
            );
            $stmt->bind_param('i', $class_id);
            $stmt->execute();
            $res = $stmt->get_result();
            while ($r = $res->fetch_assoc()) $students[] = $r;

            $attendance = [];
            $stmt2 = $db->prepare("SELECT student_id, status, notes FROM student_attendance WHERE date = ? AND class_id = ?");
            $stmt2->bind_param('si', $date, $class_id);
            $stmt2->execute();
            $res2 = $stmt2->get_result();
            while ($r = $res2->fetch_assoc()) $attendance[$r['student_id']] = $r;
        } else {
            // All classes
            $stmt = $db->prepare(
                "SELECT s.id, s.student_name AS full_name, s.gr_number AS reg_number, s.photo, s.class_id,
                        COALESCE(c.name, '—') AS class_name
                 FROM students s
                 LEFT JOIN classes c ON c.id = s.class_id
                 ORDER BY c.name, s.student_name"
            );
            $stmt->execute();
            $res = $stmt->get_result();
            while ($r = $res->fetch_assoc()) $students[] = $r;

            $attendance = [];
            $stmt2 = $db->prepare("SELECT student_id, status, notes FROM student_attendance WHERE date = ?");
            $stmt2->bind_param('s', $date);
            $stmt2->execute();
            $res2 = $stmt2->get_result();
            while ($r = $res2->fetch_assoc()) $attendance[$r['student_id']] = $r;
        }

        foreach ($students as &$s) {
            $a = $attendance[$s['id']] ?? null;
            $s['status'] = $a ? $a['status'] : null;
            $s['notes']  = $a ? $a['notes']  : '';
        }
        jsonResponse(['date' => $date, 'class_id' => $class_id, 'students' => $students]);
    }

    // ------ Student overview ------
    if ($type === 'student_overview') {
        $student_id = intval($_GET['student_id'] ?? 0);
        $class_id   = intval($_GET['class_id']   ?? 0);
        $from       = $_GET['from'] ?? date('Y-m-01');
        $to         = $_GET['to']   ?? date('Y-m-d');
        $status     = $_GET['status'] ?? '';
        $page       = max(1, intval($_GET['page'] ?? 1));
        $limit      = 50;
        $offset     = ($page - 1) * $limit;

        if (!isValidDate($from) || !isValidDate($to)) jsonResponse(['error' => 'Invalid date'], 400);

        $where  = ['a.date BETWEEN ? AND ?'];
        $params = [$from, $to];
        $types  = 'ss';

        if ($student_id > 0) { $where[] = 'a.student_id = ?'; $params[] = $student_id; $types .= 'i'; }
        if ($class_id   > 0) { $where[] = 'a.class_id   = ?'; $params[] = $class_id;   $types .= 'i'; }
        if (in_array($status, ['present','absent','late','leave'])) { $where[] = 'a.status = ?'; $params[] = $status; $types .= 's'; }

        $wSql = implode(' AND ', $where);

        $sumStmt = $db->prepare("SELECT status, COUNT(*) AS cnt FROM student_attendance a WHERE $wSql GROUP BY status");
        $sumStmt->bind_param($types, ...$params);
        $sumStmt->execute();
        $summary = ['present'=>0,'absent'=>0,'late'=>0,'leave'=>0,'pending'=>0,'total'=>0];
        $res = $sumStmt->get_result();
        while ($r = $res->fetch_assoc()) { $summary[$r['status']] = (int)$r['cnt']; $summary['total'] += (int)$r['cnt']; }

        $recStmt = $db->prepare(
            "SELECT a.id, a.date, a.status, a.notes, a.student_id, a.class_id,
             CONCAT(s.student_name) AS student_name, s.gr_number AS reg_number,
                    c.name AS class_name
             FROM student_attendance a
             JOIN students s ON s.id = a.student_id
             LEFT JOIN classes c ON c.id = a.class_id
             WHERE $wSql
             ORDER BY a.date DESC, s.student_name ASC
             LIMIT ? OFFSET ?"
        );
        $recTypes  = $types . 'ii';
        $recParams = array_merge($params, [$limit, $offset]);
        $recStmt->bind_param($recTypes, ...$recParams);
        $recStmt->execute();
        $records = [];
        $res2 = $recStmt->get_result();
        while ($r = $res2->fetch_assoc()) $records[] = $r;

        $cntStmt = $db->prepare("SELECT COUNT(*) FROM student_attendance a WHERE $wSql");
        $cntStmt->bind_param($types, ...$params);
        $cntStmt->execute();
        $total_rows = $cntStmt->get_result()->fetch_row()[0];

        jsonResponse(['summary' => $summary, 'records' => $records, 'total' => (int)$total_rows, 'page' => $page, 'pages' => ceil($total_rows / $limit)]);
    }

    // ------ Per-student summary ------
    if ($type === 'student_summary') {
        $sid  = intval($_GET['student_id'] ?? 0);
        $from = $_GET['from'] ?? date('Y-m-01');
        $to   = $_GET['to']   ?? date('Y-m-d');
        if ($sid < 1 || !isValidDate($from) || !isValidDate($to)) jsonResponse(['error' => 'Bad params'], 400);

        $stmt = $db->prepare("SELECT a.date, a.status, a.notes, c.name AS class_name FROM student_attendance a LEFT JOIN classes c ON c.id=a.class_id WHERE a.student_id=? AND a.date BETWEEN ? AND ? ORDER BY a.date DESC");
        $stmt->bind_param('iss', $sid, $from, $to);
        $stmt->execute();
        $rows = [];
        $res  = $stmt->get_result();
        while ($r = $res->fetch_assoc()) $rows[] = $r;

        $stats = ['present'=>0,'absent'=>0,'late'=>0,'leave'=>0];
        foreach ($rows as $r) if (isset($stats[$r['status']])) $stats[$r['status']]++;
        jsonResponse(['records' => $rows, 'stats' => $stats]);
    }

    jsonResponse(['error' => 'Unknown type'], 400);
}

// ──────────────────────────────────────────────────────────────────
// POST — Bulk save attendance
// ──────────────────────────────────────────────────────────────────
if ($method === 'POST') {
    if (!isAdmin() && !isSupervisor()) jsonResponse(['error' => 'Forbidden'], 403);

    $body    = json_decode(file_get_contents('php://input'), true);
    $type    = $body['type']    ?? '';
    $date    = $body['date']    ?? '';
    $records = $body['records'] ?? [];

    if (!isValidDate($date))     jsonResponse(['error' => 'Invalid date'], 400);
    if (!is_array($records))     jsonResponse(['error' => 'Records required'], 400);
    if (!in_array($type, ['staff','student'])) jsonResponse(['error' => 'Unknown type'], 400);

    // ── Barcode / Digital mark ──────────────────────────────────────
    if ($body['qr_mark'] ?? false) {
        $code   = trim($body['code'] ?? '');
        $status = $body['status'] ?? 'present';
        $notes  = substr(trim($body['notes'] ?? ''), 0, 255);
        $date   = $body['date'] ?? date('Y-m-d');
        $marker = $_SESSION['user_id'] ?? null;
        if (!in_array($status, ['present','absent','late','leave','pending'])) $status = 'present';
        $info = parseAttendanceBarcode($db, $code);
        if (!$info) jsonResponse(['error' => 'Unknown barcode: ' . $code], 404);
        if ($info['person_type'] === 'staff') {
            $stmt = $db->prepare(
                "INSERT INTO staff_attendance (teacher_id, date, status, notes, marked_by)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE status=VALUES(status), notes=CONCAT(notes,' | ',VALUES(notes)), marked_by=VALUES(marked_by), marked_at=CURRENT_TIMESTAMP"
            );
            $id = $info['id'];
            $stmt->bind_param('isssi', $id, $date, $status, $notes, $marker);
        } else {
            $class_id = $info['class_id'] ?? 0;
            $stmt = $db->prepare(
                "INSERT INTO student_attendance (student_id, class_id, date, status, notes, marked_by)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE status=VALUES(status), notes=CONCAT(notes,' | ',VALUES(notes)), marked_by=VALUES(marked_by), marked_at=CURRENT_TIMESTAMP"
            );
            $id = $info['id'];
            $stmt->bind_param('iisssi', $id, $class_id, $date, $status, $notes, $marker);
        }
        $stmt->execute();
        // affected_rows: 1=new insert, 2=duplicate updated, 0=no change
        $info['already_marked'] = $stmt->affected_rows >= 2;
        jsonResponse(array_merge($info, ['status_marked' => $status, 'date' => $date]));
    }

    $marker = $_SESSION['user_id'] ?? null;
    $saved  = 0;

    if ($type === 'staff') {
        $stmt = $db->prepare(
            "INSERT INTO staff_attendance (teacher_id, date, status, notes, marked_by)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE status=VALUES(status), notes=VALUES(notes), marked_by=VALUES(marked_by), marked_at=CURRENT_TIMESTAMP"
        );
        foreach ($records as $rec) {
            $tid    = intval($rec['id'] ?? 0);
            $status = $rec['status'] ?? 'present';
            $notes  = substr(trim($rec['notes'] ?? ''), 0, 255);
            if ($tid < 1 || !in_array($status, ['present','absent','late','leave','pending'])) continue;
            $stmt->bind_param('isssi', $tid, $date, $status, $notes, $marker);
            $stmt->execute();
            $saved++;
        }
        jsonResponse(['saved' => $saved, 'date' => $date]);
    }

    if ($type === 'student') {
        $global_class_id = intval($body['class_id'] ?? 0);
        $stmt = $db->prepare(
            "INSERT INTO student_attendance (student_id, class_id, date, status, notes, marked_by)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE status=VALUES(status), notes=VALUES(notes), marked_by=VALUES(marked_by), marked_at=CURRENT_TIMESTAMP"
        );
        foreach ($records as $rec) {
            $sid      = intval($rec['id'] ?? 0);
            $status   = $rec['status'] ?? 'present';
            $notes    = substr(trim($rec['notes'] ?? ''), 0, 255);
            // Use per-record class_id (all-classes mode) or fall back to global class_id
            $rec_cid  = intval($rec['class_id'] ?? $global_class_id);
            if ($sid < 1 || $rec_cid < 1 || !in_array($status, ['present','absent','late','leave','pending'])) continue;
            $stmt->bind_param('iisssi', $sid, $rec_cid, $date, $status, $notes, $marker);
            $stmt->execute();
            $saved++;
        }
        jsonResponse(['saved' => $saved, 'date' => $date]);
    }
}

// ──────────────────────────────────────────────────────────────────
// PUT — update a single attendance record (status + notes)
// ──────────────────────────────────────────────────────────────────
if ($method === 'PUT') {
    if (!isAdmin() && !isSupervisor()) jsonResponse(['error' => 'Forbidden'], 403);

    $body   = json_decode(file_get_contents('php://input'), true);
    $id     = intval($body['id']     ?? 0);
    $type   = $body['type']   ?? '';
    $status = $body['status'] ?? '';
    $notes  = substr(trim($body['notes'] ?? ''), 0, 255);

    if ($id < 1 || !in_array($type, ['staff','student'])) jsonResponse(['error' => 'Bad params'], 400);
    if (!in_array($status, ['present','absent','late','leave']))  jsonResponse(['error' => 'Invalid status'], 400);

    $table = $type === 'staff' ? 'staff_attendance' : 'student_attendance';
    $stmt  = $db->prepare("UPDATE `$table` SET status=?, notes=? WHERE id=?");
    $stmt->bind_param('ssi', $status, $notes, $id);
    $stmt->execute();
    jsonResponse(['updated' => $stmt->affected_rows, 'id' => $id, 'status' => $status, 'notes' => $notes]);
}

// ──────────────────────────────────────────────────────────────────
// DELETE — remove a single record
// ──────────────────────────────────────────────────────────────────
if ($method === 'DELETE') {
    if (!isAdmin()) jsonResponse(['error' => 'Forbidden'], 403);
    $body = json_decode(file_get_contents('php://input'), true);
    $id   = intval($body['id']   ?? 0);
    $type = $body['type'] ?? '';
    if ($id < 1 || !in_array($type, ['staff','student'])) jsonResponse(['error' => 'Bad params'], 400);
    $table = $type === 'staff' ? 'staff_attendance' : 'student_attendance';
    $stmt  = $db->prepare("DELETE FROM `$table` WHERE id = ?");
    $stmt->bind_param('i', $id);
    $stmt->execute();
    jsonResponse(['deleted' => $stmt->affected_rows]);
}

jsonResponse(['error' => 'Method not allowed'], 405);

// ── helpers ──────────────────────────────────────────────────────
function isValidDate($d) {
    if (!$d || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $d)) return false;
    [$y, $m, $day] = explode('-', $d);
    return checkdate((int)$m, (int)$day, (int)$y);
}

function parseAttendanceBarcode($db, $code) {
    // Format: IDL-STAFF-{id} or IDL-STUDENT-{id}
    if (preg_match('/^IDL-STAFF-(\d+)$/', strtoupper($code), $m)) {
        $id   = intval($m[1]);
        $stmt = $db->prepare("SELECT id, CONCAT(IFNULL(title,''),' ',name) AS name, designation FROM teachers WHERE id = ? LIMIT 1");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $row  = $stmt->get_result()->fetch_assoc();
        if (!$row) return null;
        return ['person_type'=>'staff','id'=>$row['id'],'name'=>trim($row['name']),'sub'=>$row['designation']??''];
    }
    if (preg_match('/^IDL-STUDENT-(\d+)$/', strtoupper($code), $m)) {
        $id   = intval($m[1]);
        $stmt = $db->prepare(
            "SELECT s.id, s.student_name AS name, s.gr_number, s.class_id, c.name AS class_name
             FROM students s LEFT JOIN classes c ON c.id=s.class_id WHERE s.id=? LIMIT 1");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $row  = $stmt->get_result()->fetch_assoc();
        if (!$row) return null;
        return ['person_type'=>'student','id'=>$row['id'],'name'=>$row['name'],'sub'=>$row['class_name']??'','class_id'=>$row['class_id']??0,'reg_number'=>$row['gr_number']??''];
    }
    return null;
}
