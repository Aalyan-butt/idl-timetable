<?php
require_once '../includes/config.php';
requireAuth();

if (!isAdmin()) jsonResponse(['error' => 'Admin access required'], 403);

$method = $_SERVER['REQUEST_METHOD'];
if ($method !== 'POST') jsonResponse(['error' => 'POST only'], 405);

$db   = getDB();
$type = trim($_GET['type'] ?? '');
$data = json_decode(file_get_contents('php://input'), true);
$rows = $data['rows'] ?? [];

if (empty($rows) || !is_array($rows)) {
    jsonResponse(['error' => 'No rows provided'], 400);
}

$inserted = 0;
$skipped  = 0;
$errors   = [];

// ─── TEACHERS ────────────────────────────────────────────────────────────────
if ($type === 'teachers') {
    $stmt_check = $db->prepare('SELECT id FROM teachers WHERE LOWER(name) = LOWER(?) AND title = ?');
    $stmt_ins   = $db->prepare('INSERT INTO teachers (title, name) VALUES (?, ?)');

    foreach ($rows as $i => $row) {
        $rowNum = $i + 2; // header is row 1
        $title  = trim($row['title'] ?? '');
        $name   = trim($row['name']  ?? '');

        if (empty($title) || empty($name)) {
            $errors[] = "Row {$rowNum}: Title and Name are required.";
            continue;
        }

        // Normalize title
        $tl = strtolower($title);
        if ($tl === 'sir')                          $title = 'Sir';
        elseif ($tl === 'mam' || $tl === 'ms.' || $tl === 'ms') $title = 'Mam';
        else {
            $errors[] = "Row {$rowNum}: Title must be 'Sir' or 'Mam' (got '{$title}').";
            continue;
        }

        $stmt_check->bind_param('ss', $name, $title);
        $stmt_check->execute();
        if ($stmt_check->get_result()->num_rows > 0) { $skipped++; continue; }

        $stmt_ins->bind_param('ss', $title, $name);
        if ($stmt_ins->execute()) $inserted++;
        else $errors[] = "Row {$rowNum}: Database error — " . $db->error;
    }

// ─── CLASSES ─────────────────────────────────────────────────────────────────
} elseif ($type === 'classes') {
    $stmt_check = $db->prepare('SELECT id FROM classes WHERE LOWER(name) = LOWER(?)');
    $stmt_ins   = $db->prepare('INSERT INTO classes (name) VALUES (?)');

    foreach ($rows as $i => $row) {
        $rowNum = $i + 2;
        $name   = trim($row['name'] ?? '');

        if (empty($name)) {
            $errors[] = "Row {$rowNum}: Class name is required.";
            continue;
        }

        $stmt_check->bind_param('s', $name);
        $stmt_check->execute();
        if ($stmt_check->get_result()->num_rows > 0) { $skipped++; continue; }

        $stmt_ins->bind_param('s', $name);
        if ($stmt_ins->execute()) $inserted++;
        else $errors[] = "Row {$rowNum}: Database error — " . $db->error;
    }

// ─── TIMETABLE ───────────────────────────────────────────────────────────────
} elseif ($type === 'timetable') {

    // force_rows: array of original row indices the user approved despite conflicts
    $force_rows = array_map('intval', (array)($data['force_rows'] ?? []));

    // Build lookup maps
    $class_map = [];
    $res = $db->query('SELECT id, name FROM classes');
    while ($r = $res->fetch_assoc()) $class_map[strtolower(trim($r['name']))] = (int)$r['id'];

    $teacher_map     = [];
    $teacher_display = []; // id => "Sir Ahmed Khan"
    $res = $db->query('SELECT id, title, name FROM teachers');
    while ($r = $res->fetch_assoc()) {
        $full = strtolower($r['title'] . ' ' . $r['name']);
        $teacher_map[$full] = (int)$r['id'];
        $teacher_map[strtolower(trim($r['name']))] = (int)$r['id'];
        $teacher_display[(int)$r['id']] = $r['title'] . ' ' . $r['name'];
    }

    // Day normalisation
    $day_full = [
        'mon' => 'Monday',    'monday'    => 'Monday',
        'tue' => 'Tuesday',   'tuesday'   => 'Tuesday',
        'wed' => 'Wednesday', 'wednesday' => 'Wednesday',
        'thu' => 'Thursday',  'thursday'  => 'Thursday',
        'fri' => 'Friday',    'friday'    => 'Friday',
    ];
    $preset_days = [
        'mon-tue'  => ['Monday','Tuesday'],
        'wed-thu'  => ['Wednesday','Thursday'],
        'fri'      => ['Friday'],
        'mon-thu'  => ['Monday','Tuesday','Wednesday','Thursday'],
        'mon-fri'  => ['Monday','Tuesday','Wednesday','Thursday','Friday'],
    ];
    $dgroup_map = [
        'Monday,Tuesday'                                  => 'mon-tue',
        'Wednesday,Thursday'                              => 'wed-thu',
        'Friday'                                          => 'fri',
        'Monday,Tuesday,Wednesday,Thursday'               => 'mon-thu',
        'Monday,Tuesday,Wednesday,Thursday,Friday'        => 'mon-fri',
    ];

    // Teacher conflict check helper
    function importCheckTeacherConflict($db, $teacher_ids, $days_arr, $start_time, $end_time, $teacher_display) {
        foreach ($teacher_ids as $tid) {
            $tid  = intval($tid);
            $sql  = 'SELECT t.days, t.start_time, t.end_time, c.name AS class_name
                     FROM timetable t
                     JOIN classes c ON t.class_id = c.id
                     WHERE (t.teacher_id = ? OR FIND_IN_SET(?, IFNULL(t.teacher_ids,"")))';
            $stmt = $db->prepare($sql);
            $stmt->bind_param('ii', $tid, $tid);
            $stmt->execute();
            $res  = $stmt->get_result();
            while ($slot = $res->fetch_assoc()) {
                $overlap = array_intersect($days_arr, explode(',', $slot['days']));
                if (!empty($overlap)) {
                    $ns = strtotime($start_time); $ne = strtotime($end_time);
                    $es = strtotime($slot['start_time']); $ee = strtotime($slot['end_time']);
                    if ($ns < $ee && $ne > $es) {
                        return [
                            'teacher_name' => $teacher_display[$tid] ?? "Teacher #{$tid}",
                            'class_name'   => $slot['class_name'],
                            'start_time'   => date('g:i A', $es),
                            'end_time'     => date('g:i A', $ee),
                        ];
                    }
                }
            }
        }
        return null;
    }

    $stmt_ins = $db->prepare(
        'INSERT INTO timetable
         (class_id, teacher_id, teacher_ids, day_group, days, start_time, end_time, subject, is_break)
         VALUES (?,?,?,?,?,?,?,?,?)'
    );

    // Exact-duplicate check: same class, days, start, end, subject already exists?
    $stmt_dup = $db->prepare(
        'SELECT id FROM timetable WHERE class_id=? AND days=? AND start_time=? AND end_time=? AND subject=? LIMIT 1'
    );

    $conflicts = []; // rows needing user approval

    foreach ($rows as $i => $row) {
        $rowNum      = $i + 2;
        $class_name  = trim($row['class']   ?? '');
        $subject     = trim($row['subject'] ?? '');
        $teacher_str = trim($row['teacher'] ?? '');
        $days_raw    = trim($row['days']    ?? '');
        $start_time  = trim($row['start']   ?? '');
        $end_time    = trim($row['end']     ?? '');

        // ── Class lookup ──────────────────────────────────────────────────
        if (empty($class_name)) { $errors[] = "Row {$rowNum}: Class is required."; continue; }
        $class_id = $class_map[strtolower($class_name)] ?? null;
        if (!$class_id) { $errors[] = "Row {$rowNum}: Class '{$class_name}' not found — add it first."; continue; }

        // ── Days parsing ──────────────────────────────────────────────────
        if (empty($days_raw)) { $errors[] = "Row {$rowNum}: Days are required."; continue; }
        $days_arr = [];
        if (isset($preset_days[strtolower($days_raw)])) {
            $days_arr = $preset_days[strtolower($days_raw)];
        } else {
            $parts = preg_split('/[;|]/', $days_raw);
            $bad_day = false;
            foreach ($parts as $p) {
                $p = strtolower(trim($p));
                if (isset($day_full[$p])) $days_arr[] = $day_full[$p];
                else { $errors[] = "Row {$rowNum}: Unknown day '{$p}'."; $bad_day = true; }
            }
            if ($bad_day) continue;
        }
        if (empty($days_arr)) { $errors[] = "Row {$rowNum}: No valid days found."; continue; }
        $days = implode(',', array_unique($days_arr));

        // Day group
        $sorted_d = $days_arr; sort($sorted_d);
        $day_group = $dgroup_map[implode(',', array_unique($sorted_d))] ?? implode(',', array_unique($sorted_d));

        // ── Times ─────────────────────────────────────────────────────────
        if (empty($start_time) || empty($end_time)) { $errors[] = "Row {$rowNum}: Start and End times required."; continue; }
        if (strlen($start_time) === 5) $start_time .= ':00';
        if (strlen($end_time)   === 5) $end_time   .= ':00';
        if (strtotime($end_time) <= strtotime($start_time)) {
            $errors[] = "Row {$rowNum}: End time must be after start time.";
            continue;
        }

        // ── Break vs Regular ───────────────────────────────────────────────
        $is_break = (strtolower($subject) === 'break') ? 1 : 0;

        if ($is_break) {
            $subject    = 'Break';
            $teacher_id = 0;
            $ids_str    = '';
        } else {
            if (empty($subject)) { $errors[] = "Row {$rowNum}: Subject required."; continue; }
            if (empty($teacher_str)) { $errors[] = "Row {$rowNum}: Teacher required for non-break slots."; continue; }

            $t_parts = preg_split('/\|/', $teacher_str);
            $t_ids   = [];
            foreach ($t_parts as $tp) {
                $tp  = trim($tp);
                $tid = $teacher_map[strtolower($tp)] ?? null;
                if (!$tid) { $errors[] = "Row {$rowNum}: Teacher '{$tp}' not found — add them first."; }
                else $t_ids[] = $tid;
            }
            if (empty($t_ids)) continue;
            $teacher_id = $t_ids[0];
            $ids_str    = implode(',', $t_ids);

            // ── Teacher conflict check ─────────────────────────────────────
            if (!in_array($i, $force_rows)) {
                $conflict = importCheckTeacherConflict($db, $t_ids, $days_arr, $start_time, $end_time, $teacher_display);
                if ($conflict !== null) {
                    $conflicts[] = [
                        'row_index'    => $i,
                        'row_num'      => $rowNum,
                        'teacher_name' => $conflict['teacher_name'],
                        'class_name'   => $conflict['class_name'],
                        'conflict_time'=> $conflict['start_time'] . ' – ' . $conflict['end_time'],
                        'subject'      => $subject,
                        'target_class' => $class_name,
                        'days'         => $days_raw,
                        'start'        => substr($start_time, 0, 5),
                        'end'          => substr($end_time, 0, 5),
                        'teacher'      => $teacher_str,
                    ];
                    continue; // hold for user decision
                }
            }
        }

        // Skip exact duplicates (prevents re-importing the same slot twice)
        $stmt_dup->bind_param('issss', $class_id, $days, $start_time, $end_time, $subject);
        $stmt_dup->execute();
        $stmt_dup->store_result();
        if ($stmt_dup->num_rows > 0) { $skipped++; continue; }

        $stmt_ins->bind_param('iissssssi',
            $class_id, $teacher_id, $ids_str,
            $day_group, $days, $start_time, $end_time,
            $subject, $is_break
        );
        if ($stmt_ins->execute()) $inserted++;
        else $errors[] = "Row {$rowNum}: Database error — " . $db->error;
    }

} else {
    jsonResponse(['error' => "Unknown import type '{$type}'"], 400);
}

jsonResponse(['inserted' => $inserted, 'skipped' => $skipped, 'errors' => $errors, 'conflicts' => $conflicts ?? []]);
