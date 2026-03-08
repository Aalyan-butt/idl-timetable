<?php
// Timetable API - Handles CRUD operations for timetable slots with conflict detection and validation
require_once '../includes/config.php';
requireAuth();

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

// ===== UTILITY FUNCTIONS =====
// Formats time to 12-hour format with AM/PM
function fmtTime($t) {
    if (!$t) return $t;
    $d = DateTime::createFromFormat('H:i:s', $t) ?: DateTime::createFromFormat('H:i', $t);
    return $d ? $d->format('g:i A') : $t;
}

// Checks for time slot overlaps within the same class to prevent scheduling conflicts
function checkClassSlotDuplicate($db, $class_id, $days, $start_time, $end_time, $exclude_id = null) {
    $days_arr = explode(',', $days);
    $sql = 'SELECT t.id, t.days, t.start_time, t.end_time, t.subject, t.is_break,
                   c.name as class_name,
                   IFNULL(CONCAT(te.title, " ", te.name), "Break") as teacher_name
            FROM timetable t
            JOIN classes c ON t.class_id = c.id
            LEFT JOIN teachers te ON t.teacher_id = te.id AND t.teacher_id > 0
            WHERE t.class_id = ?';
    if ($exclude_id) $sql .= ' AND t.id != ' . intval($exclude_id);
    $stmt = $db->prepare($sql);
    $stmt->bind_param('i', $class_id);
    $stmt->execute();
    $res = $stmt->get_result();
    while ($slot = $res->fetch_assoc()) {
        $overlap_days = array_intersect($days_arr, explode(',', $slot['days']));
        if (!empty($overlap_days)) {
            $ns = strtotime($start_time); $ne = strtotime($end_time);
            $es = strtotime($slot['start_time']); $ee = strtotime($slot['end_time']);
            if ($ns < $ee && $ne > $es) {
                // Format times for display
                $fmt_s = date('g:i A', $es);
                $fmt_e = date('g:i A', $ee);
                $label = $slot['is_break'] ? 'Break' : ($slot['subject'] ?: 'Unknown');
                return [
                    'conflict_id'   => (int)$slot['id'],
                    'class_name'    => $slot['class_name'],
                    'teacher_name'  => $slot['teacher_name'],
                    'subject'       => $label,
                    'is_break'      => (int)$slot['is_break'],
                    'start_time'    => $fmt_s,
                    'end_time'      => $fmt_e,
                    'days'          => $slot['days'],
                ];
            }
        }
    }
    return false;
}

// Checks for teacher scheduling conflicts to ensure no teacher is double-booked
function checkTeacherConflict($db, $teacher_ids_arr, $days, $start_time, $end_time, $exclude_id = null) {
    $days_arr = explode(',', $days);
    foreach ($teacher_ids_arr as $tid) {
        $tid = intval($tid);
        $sql = 'SELECT t.id, t.days, t.start_time, t.end_time,
                       c.name as class_name,
                       IFNULL(CONCAT(te.title, " ", te.name), "") as teacher_name
                FROM timetable t
                JOIN classes c ON t.class_id = c.id
                LEFT JOIN teachers te ON te.id = ?
                WHERE (t.teacher_id = ? OR FIND_IN_SET(?, IFNULL(t.teacher_ids, "")))';
        if ($exclude_id) $sql .= ' AND t.id != ' . intval($exclude_id);
        $stmt = $db->prepare($sql);
        $stmt->bind_param('iii', $tid, $tid, $tid);
        $stmt->execute();
        $res = $stmt->get_result();
        while ($slot = $res->fetch_assoc()) {
            $overlap = array_intersect($days_arr, explode(',', $slot['days']));
            if (!empty($overlap)) {
                $ns = strtotime($start_time); $ne = strtotime($end_time);
                $es = strtotime($slot['start_time']); $ee = strtotime($slot['end_time']);
                if ($ns < $ee && $ne > $es) {
                    return ['class_name' => $slot['class_name'], 'teacher_name' => $slot['teacher_name']];
                }
            }
        }
    }
    return false;
}

if ($method === 'GET') {
    $class_id   = $_GET['class_id']   ?? null;
    $teacher_id = isset($_GET['teacher_id']) ? intval($_GET['teacher_id']) : null;
    $id         = $_GET['id']         ?? null;

    // For supervisors: enforce assigned class/teacher filters
    $supvClassIds   = isSupervisor() ? getSupervisorClassIds()   : null;
    $supvTeacherIds = isSupervisor() ? getSupervisorTeacherIds() : null;

    // If supervisor tries to fetch by class_id not assigned to them, return empty
    if ($class_id && $supvClassIds !== null && !in_array(intval($class_id), $supvClassIds)) {
        jsonResponse([]);
    }
    // If supervisor tries to fetch by teacher_id not assigned to them, return empty
    if ($teacher_id && $supvTeacherIds !== null && !in_array($teacher_id, $supvTeacherIds)) {
        jsonResponse([]);
    }

    $baseSelect = 'SELECT t.*, c.name as class_name,
                          IFNULL(te.title, "") as title,
                          IFNULL(te.name, "") as teacher_name
                   FROM timetable t
                   JOIN classes c ON t.class_id = c.id
                   LEFT JOIN teachers te ON t.teacher_id = te.id AND t.teacher_id > 0';

    if ($id) {
        $stmt = $db->prepare("$baseSelect WHERE t.id = ?");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        if ($row) {
            // Supervisor: check access
            if ($supvClassIds !== null && !in_array(intval($row['class_id']), $supvClassIds)) {
                jsonResponse(['error' => 'Access denied'], 403);
            }
            $row['is_break'] = (int)$row['is_break'];
        }
        jsonResponse($row);
    } elseif ($class_id) {
        $stmt = $db->prepare("$baseSelect WHERE t.class_id = ? ORDER BY t.days, t.start_time");
        $stmt->bind_param('i', $class_id);
        $stmt->execute();
        $rows = []; $r = $stmt->get_result();
        while ($row = $r->fetch_assoc()) { $row['is_break'] = (int)$row['is_break']; $rows[] = $row; }
        jsonResponse($rows);
    } elseif ($teacher_id) {
        $stmt = $db->prepare("$baseSelect WHERE (t.teacher_id = ? OR FIND_IN_SET(?, IFNULL(t.teacher_ids,''))) AND t.is_break = 0 ORDER BY t.days, t.start_time");
        $stmt->bind_param('ii', $teacher_id, $teacher_id);
        $stmt->execute();
        $rows = []; $r = $stmt->get_result();
        while ($row = $r->fetch_assoc()) { $row['is_break'] = (int)$row['is_break']; $rows[] = $row; }
        jsonResponse($rows);
    } else {
        $res = $db->query("$baseSelect ORDER BY c.name, t.days, t.start_time");
        $rows = [];
        while ($row = $res->fetch_assoc()) {
            $row['is_break'] = (int)$row['is_break'];
            // Supervisor: only include assigned classes
            if ($supvClassIds !== null && !in_array(intval($row['class_id']), $supvClassIds)) continue;
            $rows[] = $row;
        }
        jsonResponse($rows);
    }
}

if ($method === 'POST') {
    if (!isAdmin() && !isSupervisor()) jsonResponse(['error' => 'Access denied'], 403);
    $data = json_decode(file_get_contents('php://input'), true);

    $class_id    = intval($data['class_id'] ?? 0);
    $day_group   = trim($data['day_group']  ?? '');
    $days        = trim($data['days']       ?? '');
    $start_time  = trim($data['start_time'] ?? '');
    $end_time    = trim($data['end_time']   ?? '');
    $is_break      = !empty($data['is_break']) ? 1 : 0;
    $force         = !empty($data['force_conflict']);
    $force_overlap = !empty($data['force_overlap']);

    if (!$class_id || empty($days) || empty($start_time) || empty($end_time)) {
        jsonResponse(['error' => 'Class, days and times are required'], 400);
    }
    if (strtotime($end_time) <= strtotime($start_time)) {
        jsonResponse(['error' => 'End time must be after start time'], 400);
    }

    // Supervisor class access check
    if (isSupervisor() && !supervisorCanAccessClass($class_id)) {
        jsonResponse(['error' => 'Class not assigned to you'], 403);
    }

    if ($is_break) {
        $subject    = 'Break';
        $teacher_id = 0;
        $ids_str    = '';

        $duplicate = checkClassSlotDuplicate($db, $class_id, $days, $start_time, $end_time);
        if ($duplicate !== false) {
            $label = $duplicate['is_break'] ? 'Break' : "'{$duplicate['subject']}'";
            if (isAdmin() && !$force_overlap) {
                jsonResponse([
                    'overlap_warning' => true,
                    'conflict_id'     => $duplicate['conflict_id'],
                    'message'         => "This time slot overlaps with an existing {$label} slot in {$duplicate['class_name']} ({$duplicate['start_time']} – {$duplicate['end_time']}). Do you want to add this slot anyway?"
                ], 409);
            }
            if (!isAdmin()) {
                jsonResponse(['error' => "Time overlaps with an existing {$label} slot in class {$duplicate['class_name']} ({$duplicate['start_time']} – {$duplicate['end_time']}). Please delete or adjust that slot first.", 'conflict_id' => $duplicate['conflict_id']], 409);
            }
            // admin/superadmin + force_overlap: fall through
        }

        $stmt = $db->prepare('INSERT INTO timetable (class_id, teacher_id, teacher_ids, day_group, days, start_time, end_time, subject, is_break) VALUES (?,?,?,?,?,?,?,?,1)');
        $stmt->bind_param('iissssss', $class_id, $teacher_id, $ids_str, $day_group, $days, $start_time, $end_time, $subject);
        if ($stmt->execute()) {
            $new_id = $db->insert_id;
            $cn = $db->prepare('SELECT name FROM classes WHERE id=?'); $cn->bind_param('i', $class_id); $cn->execute();
            $cn_row = $cn->get_result()->fetch_assoc(); $cn_label = $cn_row ? $cn_row['name'] : "Class#{$class_id}";
            logNotification('add', 'timetable', $new_id,
                "Break in {$cn_label} ({$days} " . fmtTime($start_time) . " - " . fmtTime($end_time) . ")",
                ['id'=>$new_id,'class_id'=>$class_id,'teacher_id'=>0,'teacher_ids'=>'','day_group'=>$day_group,'days'=>$days,'start_time'=>$start_time,'end_time'=>$end_time,'subject'=>'Break','is_break'=>1]);
            jsonResponse(['success' => true, 'id' => $new_id]);
        } else jsonResponse(['error' => 'Failed to add break slot: ' . $db->error], 500);

    } else {
        $teacher_ids = array_values(array_filter(array_map('intval', (array)($data['teacher_ids'] ?? []))));
        if (empty($teacher_ids) && !empty($data['teacher_id'])) $teacher_ids = [intval($data['teacher_id'])];
        $subject = trim($data['subject'] ?? '');

        if (empty($teacher_ids) || empty($subject)) {
            jsonResponse(['error' => 'Teacher(s) and subject are required'], 400);
        }

        // Supervisor: validate teacher IDs
        if (isSupervisor()) {
            $assignedTeacherIds = getSupervisorTeacherIds();
            foreach ($teacher_ids as $tid) {
                if (!in_array($tid, $assignedTeacherIds)) {
                    jsonResponse(['error' => 'Teacher not assigned to you'], 403);
                }
            }
        }

        $primary = $teacher_ids[0];
        $ids_str = implode(',', $teacher_ids);

        // Check class-level slot overlap (covers break + regular slots for same class)
        $duplicate = checkClassSlotDuplicate($db, $class_id, $days, $start_time, $end_time);
        if ($duplicate !== false) {
            $label = $duplicate['is_break'] ? 'Break' : "'{$duplicate['subject']}'";
            if (isAdmin() && !$force_overlap) {
                jsonResponse([
                    'overlap_warning' => true,
                    'conflict_id'     => $duplicate['conflict_id'],
                    'message'         => "This time slot overlaps with an existing {$label} slot in {$duplicate['class_name']} ({$duplicate['start_time']} – {$duplicate['end_time']}). Do you want to add this slot anyway?"
                ], 409);
            }
            if (!isAdmin()) {
                jsonResponse(['error' => "Time overlaps with an existing {$label} slot in class {$duplicate['class_name']} ({$duplicate['start_time']} – {$duplicate['end_time']}). Please delete or adjust that slot first.", 'conflict_id' => $duplicate['conflict_id']], 409);
            }
            // admin/superadmin + force_overlap: fall through
        }

        // Check teacher conflict
        $conflict = checkTeacherConflict($db, $teacher_ids, $days, $start_time, $end_time);
        if ($conflict !== false) {
            if (isAdmin() && !$force) {
                // Return warning so frontend (admin or superadmin) can show confirmation dialog
                $tName = $conflict['teacher_name'] ?: 'This teacher';
                jsonResponse([
                    'warning'    => true,
                    'teacher_name' => $tName,
                    'class_name' => $conflict['class_name'],
                    'message'    => "{$tName} is already assigned to {$conflict['class_name']} at this time. Are you sure you want to add this too?"
                ], 409);
            }
            if (!isAdmin()) {
                jsonResponse(['error' => "A selected teacher is already scheduled in \"{$conflict['class_name']}\" at this time. A teacher cannot be in two classes simultaneously."], 409);
            }
            // admin/superadmin with force == true: fall through and allow
        }

        $stmt = $db->prepare('INSERT INTO timetable (class_id, teacher_id, teacher_ids, day_group, days, start_time, end_time, subject, is_break) VALUES (?,?,?,?,?,?,?,?,0)');
        $stmt->bind_param('iissssss', $class_id, $primary, $ids_str, $day_group, $days, $start_time, $end_time, $subject);
        if ($stmt->execute()) {
            $new_id = $db->insert_id;
            $cn = $db->prepare('SELECT name FROM classes WHERE id=?'); $cn->bind_param('i', $class_id); $cn->execute();
            $cn_row = $cn->get_result()->fetch_assoc(); $cn_label = $cn_row ? $cn_row['name'] : "Class#{$class_id}";
            logNotification('add', 'timetable', $new_id,
                "{$subject} in {$cn_label} ({$days} " . fmtTime($start_time) . " - " . fmtTime($end_time) . ")",
                ['id'=>$new_id,'class_id'=>$class_id,'teacher_id'=>$primary,'teacher_ids'=>$ids_str,'day_group'=>$day_group,'days'=>$days,'start_time'=>$start_time,'end_time'=>$end_time,'subject'=>$subject,'is_break'=>0]);
            jsonResponse(['success' => true, 'id' => $new_id]);
        } else jsonResponse(['error' => 'Failed to add slot: ' . $db->error], 500);
    }
}

if ($method === 'PUT') {
    if (!isAdmin() && !isSupervisor()) jsonResponse(['error' => 'Access denied'], 403);
    $id = intval($_GET['id'] ?? 0);
    if (!$id) jsonResponse(['error' => 'ID required'], 400);

    // Supervisor: verify the slot belongs to an assigned class
    if (isSupervisor()) {
        $chk = $db->prepare('SELECT class_id FROM timetable WHERE id=?');
        $chk->bind_param('i', $id);
        $chk->execute();
        $existing = $chk->get_result()->fetch_assoc();
        if (!$existing || !supervisorCanAccessClass($existing['class_id'])) {
            jsonResponse(['error' => 'Access denied to this timetable slot'], 403);
        }
    }

    $data = json_decode(file_get_contents('php://input'), true);

    $class_id   = intval($data['class_id'] ?? 0);
    $day_group  = trim($data['day_group']  ?? '');
    $days       = trim($data['days']       ?? '');
    $start_time = trim($data['start_time'] ?? '');
    $end_time   = trim($data['end_time']   ?? '');
    $is_break      = !empty($data['is_break']) ? 1 : 0;
    $force         = !empty($data['force_conflict']);
    $force_overlap = !empty($data['force_overlap']);

    if (!$class_id || empty($days) || empty($start_time) || empty($end_time)) {
        jsonResponse(['error' => 'Class, days and times are required'], 400);
    }
    if (strtotime($end_time) <= strtotime($start_time)) {
        jsonResponse(['error' => 'End time must be after start time'], 400);
    }

    // Supervisor: validate assigned class
    if (isSupervisor() && !supervisorCanAccessClass($class_id)) {
        jsonResponse(['error' => 'Class not assigned to you'], 403);
    }

    // Fetch old row + class name for undo snapshot and notification label
    $old_tt = $db->prepare('SELECT * FROM timetable WHERE id=?');
    $old_tt->bind_param('i', $id);
    $old_tt->execute();
    $old_tt_row = $old_tt->get_result()->fetch_assoc();
    $tt_cn = $db->prepare('SELECT name FROM classes WHERE id=?'); $tt_cn->bind_param('i', $class_id); $tt_cn->execute();
    $tt_cn_row = $tt_cn->get_result()->fetch_assoc(); $cn_label = $tt_cn_row ? $tt_cn_row['name'] : "Class#{$class_id}";

    if ($is_break) {
        $subject    = 'Break';
        $teacher_id = 0;
        $ids_str    = '';

        $duplicate = checkClassSlotDuplicate($db, $class_id, $days, $start_time, $end_time, $id);
        if ($duplicate !== false) {
            $label = $duplicate['is_break'] ? 'Break' : "'{$duplicate['subject']}'";
            if (isAdmin() && !$force_overlap) {
                jsonResponse([
                    'overlap_warning' => true,
                    'conflict_id'     => $duplicate['conflict_id'],
                    'message'         => "This time slot overlaps with an existing {$label} slot in {$duplicate['class_name']} ({$duplicate['start_time']} – {$duplicate['end_time']}). Do you want to add this slot anyway?"
                ], 409);
            }
            if (!isAdmin()) {
                jsonResponse(['error' => "Time overlaps with an existing {$label} slot in class {$duplicate['class_name']} ({$duplicate['start_time']} – {$duplicate['end_time']}). Please delete or adjust that slot first.", 'conflict_id' => $duplicate['conflict_id']], 409);
            }
            // admin/superadmin + force_overlap: fall through
        }

        $stmt = $db->prepare('UPDATE timetable SET class_id=?, teacher_id=?, teacher_ids=?, day_group=?, days=?, start_time=?, end_time=?, subject=?, is_break=1 WHERE id=?');
        $stmt->bind_param('iissssssi', $class_id, $teacher_id, $ids_str, $day_group, $days, $start_time, $end_time, $subject, $id);
        if ($stmt->execute()) {
            logNotification('edit', 'timetable', $id, "Break in {$cn_label} ({$days} " . fmtTime($start_time) . " - " . fmtTime($end_time) . ")", $old_tt_row);
            jsonResponse(['success' => true]);
        } else jsonResponse(['error' => 'Failed to update break slot'], 500);

    } else {
        $teacher_ids = array_values(array_filter(array_map('intval', (array)($data['teacher_ids'] ?? []))));
        if (empty($teacher_ids) && !empty($data['teacher_id'])) $teacher_ids = [intval($data['teacher_id'])];
        $subject = trim($data['subject'] ?? '');

        if (empty($teacher_ids) || empty($subject)) {
            jsonResponse(['error' => 'Teacher(s) and subject are required'], 400);
        }

        // Supervisor: validate teacher IDs
        if (isSupervisor()) {
            $assignedTeacherIds = getSupervisorTeacherIds();
            foreach ($teacher_ids as $tid) {
                if (!in_array($tid, $assignedTeacherIds)) {
                    jsonResponse(['error' => 'Teacher not assigned to you'], 403);
                }
            }
        }

        $primary = $teacher_ids[0];
        $ids_str = implode(',', $teacher_ids);

        // Check class-level slot overlap (covers break + regular slots for same class)
        $duplicate = checkClassSlotDuplicate($db, $class_id, $days, $start_time, $end_time, $id);
        if ($duplicate !== false) {
            $label = $duplicate['is_break'] ? 'Break' : "'{$duplicate['subject']}'";
            if (isAdmin() && !$force_overlap) {
                jsonResponse([
                    'overlap_warning' => true,
                    'conflict_id'     => $duplicate['conflict_id'],
                    'message'         => "This time slot overlaps with an existing {$label} slot in {$duplicate['class_name']} ({$duplicate['start_time']} – {$duplicate['end_time']}). Do you want to add this slot anyway?"
                ], 409);
            }
            if (!isAdmin()) {
                jsonResponse(['error' => "Time overlaps with an existing {$label} slot in class {$duplicate['class_name']} ({$duplicate['start_time']} – {$duplicate['end_time']}). Please delete or adjust that slot first.", 'conflict_id' => $duplicate['conflict_id']], 409);
            }
            // admin/superadmin + force_overlap: fall through
        }

        $conflict = checkTeacherConflict($db, $teacher_ids, $days, $start_time, $end_time, $id);
        if ($conflict !== false) {
            if (isAdmin() && !$force) {
                $tName = $conflict['teacher_name'] ?: 'This teacher';
                jsonResponse([
                    'warning'      => true,
                    'teacher_name' => $tName,
                    'class_name'   => $conflict['class_name'],
                    'message'      => "{$tName} is already assigned to {$conflict['class_name']} at this time. Are you sure you want to add this too?"
                ], 409);
            }
            if (!isAdmin()) {
                jsonResponse(['error' => "A selected teacher is already scheduled in \"{$conflict['class_name']}\" at this time. A teacher cannot be in two classes simultaneously."], 409);
            }
            // admin/superadmin with force: fall through
        }

        $stmt = $db->prepare('UPDATE timetable SET class_id=?, teacher_id=?, teacher_ids=?, day_group=?, days=?, start_time=?, end_time=?, subject=?, is_break=0 WHERE id=?');
        $stmt->bind_param('iissssssi', $class_id, $primary, $ids_str, $day_group, $days, $start_time, $end_time, $subject, $id);
        if ($stmt->execute()) {
            logNotification('edit', 'timetable', $id, "{$subject} in {$cn_label} ({$days} " . fmtTime($start_time) . " - " . fmtTime($end_time) . ")", $old_tt_row);
            jsonResponse(['success' => true]);
        } else jsonResponse(['error' => 'Failed to update'], 500);
    }
}

if ($method === 'DELETE') {
    if (!isAdmin() && !isSupervisor()) jsonResponse(['error' => 'Access denied'], 403);
    $id = $_GET['id'] ?? null;
    if (!$id) jsonResponse(['error' => 'ID required'], 400);
    // Supervisor: verify slot belongs to assigned class
    if (isSupervisor()) {
        $chk = $db->prepare('SELECT class_id FROM timetable WHERE id=?');
        $chk->bind_param('i', $id);
        $chk->execute();
        $existing = $chk->get_result()->fetch_assoc();
        if (!$existing || !supervisorCanAccessClass($existing['class_id'])) {
            jsonResponse(['error' => 'Access denied to this timetable slot'], 403);
        }
    }
    // Fetch old row for snapshot and a readable label
    $old_tt = $db->prepare('SELECT * FROM timetable WHERE id=?');
    $old_tt->bind_param('i', $id);
    $old_tt->execute();
    $old_tt_row = $old_tt->get_result()->fetch_assoc();
    $del_class_id  = intval($old_tt_row['class_id'] ?? 0);
    $del_cn        = $db->prepare('SELECT name FROM classes WHERE id=?'); $del_cn->bind_param('i', $del_class_id); $del_cn->execute();
    $del_cn_row    = $del_cn->get_result()->fetch_assoc();
    $del_cn_label  = $del_cn_row ? $del_cn_row['name'] : "Class#{$del_class_id}";
    $del_subject   = ($old_tt_row && $old_tt_row['is_break']) ? 'Break' : ($old_tt_row['subject'] ?? 'Slot');
    $del_days      = $old_tt_row['days']       ?? '';
    $del_start     = $old_tt_row['start_time'] ?? '';
    $del_end       = $old_tt_row['end_time']   ?? '';

    $stmt = $db->prepare('DELETE FROM timetable WHERE id=?');
    $stmt->bind_param('i', $id);
    if ($stmt->execute()) {
        logNotification('delete', 'timetable', intval($id),
            "{$del_subject} in {$del_cn_label} ({$del_days} " . fmtTime($del_start) . " - " . fmtTime($del_end) . ")",
            $old_tt_row);
        jsonResponse(['success' => true]);
    } else jsonResponse(['error' => 'Failed to delete'], 500);
}
