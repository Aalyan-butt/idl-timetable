<?php
require_once '../includes/config.php';
requireSuperAdmin();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$db     = getDB();

// Ensure the table exists (idempotent)
$db->query('CREATE TABLE IF NOT EXISTS notifications (
    id            INT PRIMARY KEY AUTO_INCREMENT,
    actor_username VARCHAR(100) NOT NULL,
    actor_role    VARCHAR(50)  NOT NULL,
    action_type   VARCHAR(20)  NOT NULL,
    entity_type   VARCHAR(50)  NOT NULL,
    entity_id     INT          DEFAULT NULL,
    entity_name   VARCHAR(500) DEFAULT NULL,
    snapshot_data LONGTEXT     DEFAULT NULL,
    created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

// ── GET: list all notifications ──────────────────────────────────────────────
if ($method === 'GET') {
    $result = $db->query('SELECT * FROM notifications ORDER BY created_at DESC');
    $rows   = [];
    while ($row = $result->fetch_assoc()) {
        // snapshot_data is internal; never expose to client to keep things clean
        unset($row['snapshot_data']);
        $rows[] = $row;
    }
    jsonResponse($rows);
}

// ── DELETE: remove one notification ─────────────────────────────────────────
if ($method === 'DELETE') {
    $id = intval($_GET['id'] ?? 0);
    if (!$id) jsonResponse(['error' => 'ID required'], 400);

    $stmt = $db->prepare('DELETE FROM notifications WHERE id=?');
    $stmt->bind_param('i', $id);
    if ($stmt->execute()) jsonResponse(['success' => true]);
    jsonResponse(['error' => 'Delete failed'], 500);
}

// ── POST action=undo: reverse the logged change ──────────────────────────────
if ($method === 'POST' && $action === 'undo') {
    $id = intval($_GET['id'] ?? 0);
    if (!$id) jsonResponse(['error' => 'ID required'], 400);

    // Load full notification row (including snapshot)
    $stmt = $db->prepare('SELECT * FROM notifications WHERE id=?');
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $notif = $stmt->get_result()->fetch_assoc();
    if (!$notif) jsonResponse(['error' => 'Notification not found'], 404);

    $snapshot    = $notif['snapshot_data'] ? json_decode($notif['snapshot_data'], true) : null;
    $entity_type = $notif['entity_type'];
    $action_type = $notif['action_type'];
    $entity_id   = intval($notif['entity_id']);

    $undo_stmt = null;

    // ── Undo ADD (delete the newly created entity) ───────────────────────────
    if ($action_type === 'add') {
        switch ($entity_type) {
            case 'teacher':
                $undo_stmt = $db->prepare('DELETE FROM teachers WHERE id=?');
                $undo_stmt->bind_param('i', $entity_id);
                break;
            case 'class':
                $undo_stmt = $db->prepare('DELETE FROM classes WHERE id=?');
                $undo_stmt->bind_param('i', $entity_id);
                break;
            case 'timetable':
                $undo_stmt = $db->prepare('DELETE FROM timetable WHERE id=?');
                $undo_stmt->bind_param('i', $entity_id);
                break;
            case 'user':
                $undo_stmt = $db->prepare('DELETE FROM users WHERE id=?');
                $undo_stmt->bind_param('i', $entity_id);
                break;
            default:
                jsonResponse(['error' => 'Unknown entity type: ' . $entity_type], 400);
        }
    }

    // ── Undo EDIT (restore old row from snapshot) ────────────────────────────
    elseif ($action_type === 'edit') {
        if (!$snapshot) jsonResponse(['error' => 'No snapshot data available for undo'], 400);

        switch ($entity_type) {
            case 'teacher': {
                $title = $snapshot['title'] ?? '';
                $name  = $snapshot['name']  ?? '';
                $undo_stmt = $db->prepare('UPDATE teachers SET title=?, name=? WHERE id=?');
                $undo_stmt->bind_param('ssi', $title, $name, $entity_id);
                break;
            }
            case 'class': {
                $name = $snapshot['name'] ?? '';
                $undo_stmt = $db->prepare('UPDATE classes SET name=? WHERE id=?');
                $undo_stmt->bind_param('si', $name, $entity_id);
                break;
            }
            case 'timetable': {
                $class_id   = intval($snapshot['class_id']   ?? 0);
                $teacher_id = intval($snapshot['teacher_id'] ?? 0);
                $teacher_ids = $snapshot['teacher_ids'] ?? '';
                $day_group  = $snapshot['day_group']  ?? '';
                $days       = $snapshot['days']       ?? '';
                $start_time = $snapshot['start_time'] ?? '';
                $end_time   = $snapshot['end_time']   ?? '';
                $subject    = $snapshot['subject']    ?? '';
                $is_break   = intval($snapshot['is_break'] ?? 0);
                $undo_stmt = $db->prepare(
                    'UPDATE timetable SET class_id=?, teacher_id=?, teacher_ids=?, day_group=?,
                     days=?, start_time=?, end_time=?, subject=?, is_break=? WHERE id=?'
                );
                $undo_stmt->bind_param('iissssssii',
                    $class_id, $teacher_id, $teacher_ids, $day_group,
                    $days, $start_time, $end_time, $subject, $is_break, $entity_id
                );
                break;
            }
            case 'user': {
                $username               = $snapshot['username']               ?? '';
                $role                   = $snapshot['role']                   ?? 'user';
                $teacher_ids_perm       = $snapshot['teacher_ids_perm']       ?? '';
                $class_ids_perm         = $snapshot['class_ids_perm']         ?? '';
                $supervisor_teacher_ids = $snapshot['supervisor_teacher_ids'] ?? '';
                $supervisor_class_ids   = $snapshot['supervisor_class_ids']   ?? '';
                $supervisor_user_ids    = $snapshot['supervisor_user_ids']    ?? '';
                $undo_stmt = $db->prepare(
                    'UPDATE users SET username=?, role=?, teacher_ids_perm=?, class_ids_perm=?,
                     supervisor_teacher_ids=?, supervisor_class_ids=?, supervisor_user_ids=? WHERE id=?'
                );
                $undo_stmt->bind_param('sssssssi',
                    $username, $role, $teacher_ids_perm, $class_ids_perm,
                    $supervisor_teacher_ids, $supervisor_class_ids, $supervisor_user_ids, $entity_id
                );
                break;
            }
            default:
                jsonResponse(['error' => 'Unknown entity type: ' . $entity_type], 400);
        }
    }

    // ── Undo DELETE (re-insert the deleted row from snapshot) ────────────────
    elseif ($action_type === 'delete') {
        if (!$snapshot) jsonResponse(['error' => 'No snapshot data available for undo'], 400);

        switch ($entity_type) {
            case 'teacher': {
                $orig_id = intval($snapshot['id'] ?? 0);
                $title   = $snapshot['title'] ?? '';
                $name    = $snapshot['name']  ?? '';
                $undo_stmt = $db->prepare('INSERT INTO teachers (id, title, name) VALUES (?,?,?)');
                $undo_stmt->bind_param('iss', $orig_id, $title, $name);
                break;
            }
            case 'class': {
                $orig_id = intval($snapshot['id'] ?? 0);
                $name    = $snapshot['name'] ?? '';
                $undo_stmt = $db->prepare('INSERT INTO classes (id, name) VALUES (?,?)');
                $undo_stmt->bind_param('is', $orig_id, $name);
                break;
            }
            case 'timetable': {
                $orig_id    = intval($snapshot['id']         ?? 0);
                $class_id   = intval($snapshot['class_id']   ?? 0);
                $teacher_id = intval($snapshot['teacher_id'] ?? 0);
                $teacher_ids = $snapshot['teacher_ids'] ?? '';
                $day_group  = $snapshot['day_group']  ?? '';
                $days       = $snapshot['days']       ?? '';
                $start_time = $snapshot['start_time'] ?? '';
                $end_time   = $snapshot['end_time']   ?? '';
                $subject    = $snapshot['subject']    ?? '';
                $is_break   = intval($snapshot['is_break'] ?? 0);
                $undo_stmt = $db->prepare(
                    'INSERT INTO timetable
                     (id, class_id, teacher_id, teacher_ids, day_group, days, start_time, end_time, subject, is_break)
                     VALUES (?,?,?,?,?,?,?,?,?,?)'
                );
                $undo_stmt->bind_param('iiissssssi',
                    $orig_id, $class_id, $teacher_id, $teacher_ids, $day_group,
                    $days, $start_time, $end_time, $subject, $is_break
                );
                break;
            }
            case 'user': {
                $orig_id                = intval($snapshot['id']   ?? 0);
                $username               = $snapshot['username']               ?? '';
                $password               = $snapshot['password']               ?? '';  // already hashed
                $role                   = $snapshot['role']                   ?? 'user';
                $teacher_ids_perm       = $snapshot['teacher_ids_perm']       ?? '';
                $class_ids_perm         = $snapshot['class_ids_perm']         ?? '';
                $supervisor_teacher_ids = $snapshot['supervisor_teacher_ids'] ?? '';
                $supervisor_class_ids   = $snapshot['supervisor_class_ids']   ?? '';
                $supervisor_user_ids    = $snapshot['supervisor_user_ids']    ?? '';
                $undo_stmt = $db->prepare(
                    'INSERT INTO users
                     (id, username, password, role, teacher_ids_perm, class_ids_perm,
                      supervisor_teacher_ids, supervisor_class_ids, supervisor_user_ids)
                     VALUES (?,?,?,?,?,?,?,?,?)'
                );
                $undo_stmt->bind_param('issssssss',
                    $orig_id, $username, $password, $role, $teacher_ids_perm, $class_ids_perm,
                    $supervisor_teacher_ids, $supervisor_class_ids, $supervisor_user_ids
                );
                break;
            }
            default:
                jsonResponse(['error' => 'Unknown entity type: ' . $entity_type], 400);
        }
    } else {
        jsonResponse(['error' => 'Unknown action_type: ' . $action_type], 400);
    }

    if (!$undo_stmt) jsonResponse(['error' => 'Undo statement not prepared'], 500);

    if ($undo_stmt->execute()) {
        // Remove the notification now that it has been reversed
        $del = $db->prepare('DELETE FROM notifications WHERE id=?');
        $del->bind_param('i', $id);
        $del->execute();
        jsonResponse(['success' => true]);
    } else {
        jsonResponse(['error' => 'Undo failed: ' . $db->error], 500);
    }
}

// ── POST action=clear_all: delete all notifications ──────────────────────────
if ($method === 'POST' && $action === 'clear_all') {
    $db->query('DELETE FROM notifications');
    jsonResponse(['success' => true]);
}
