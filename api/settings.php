
<?php
require_once '../includes/config.php';
requireAuth();

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

$days = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];

if ($method === 'GET') {
    $result = $db->query("SELECT `key`, `value` FROM settings");
    $settings = [];
    while ($row = $result->fetch_assoc()) {
        $settings[$row['key']] = $row['value'];
    }
    if (!isset($settings['school_start'])) $settings['school_start'] = '08:00';
    if (!isset($settings['school_end']))   $settings['school_end']   = '14:00';
    // Return per-day settings (empty string = use default / school off)
    foreach ($days as $d) {
        if (!isset($settings["{$d}_start"])) $settings["{$d}_start"] = '';
        if (!isset($settings["{$d}_end"]))   $settings["{$d}_end"]   = '';
    }
    jsonResponse($settings);
}

// ── AI Settings (openai_api_key, openai_model) — handle before the school-hours POST
if ($method === 'POST' && isset($_GET['ai'])) {
    requireSuperAdmin();
    $data = json_decode(file_get_contents('php://input'), true);
    $stmt = $db->prepare("INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?");

    if (!empty(trim($data['openai_api_key'] ?? ''))) {
        $key = 'openai_api_key';
        $val = trim($data['openai_api_key']);
        $stmt->bind_param('sss', $key, $val, $val);
        $stmt->execute();
    }
    if (!empty(trim($data['openai_model'] ?? ''))) {
        $key = 'openai_model';
        $val = trim($data['openai_model']);
        $stmt->bind_param('sss', $key, $val, $val);
        $stmt->execute();
    }
    jsonResponse(['success' => true]);
}

if ($method === 'POST') {
    requireAdmin();
    $data = json_decode(file_get_contents('php://input'), true);

    $school_start      = trim($data['school_start'] ?? '08:00');
    $school_end        = trim($data['school_end']   ?? '14:00');
    $update_timetable  = !empty($data['update_timetable']);

    if (empty($school_start) || empty($school_end)) {
        jsonResponse(['error' => 'Default start and end times are required'], 400);
    }

    // ── Helper: HH:MM → total minutes ────────────────────────────────────────
    function timeToMinutes($t) {
        if (empty($t)) return 0;
        $p = explode(':', $t);
        return intval($p[0]) * 60 + intval($p[1]);
    }

    // ── Read old settings BEFORE saving (needed for timetable shift) ──────────
    $old = [];
    if ($update_timetable) {
        $res = $db->query("SELECT `key`, `value` FROM settings");
        while ($row = $res->fetch_assoc()) $old[$row['key']] = $row['value'];
    }

    $stmt = $db->prepare("INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?");

    // Save school defaults
    foreach (['school_start' => $school_start, 'school_end' => $school_end] as $key => $val) {
        $stmt->bind_param('sss', $key, $val, $val);
        $stmt->execute();
    }

    // Save per-day school hours
    foreach ($days as $d) {
        $dStart = isset($data["{$d}_start"]) ? trim($data["{$d}_start"]) : '';
        $dEnd   = isset($data["{$d}_end"])   ? trim($data["{$d}_end"])   : '';
        $keyS = "{$d}_start"; $keyE = "{$d}_end";
        $stmt->bind_param('sss', $keyS, $dStart, $dStart); $stmt->execute();
        $stmt->bind_param('sss', $keyE, $dEnd,   $dEnd);   $stmt->execute();
    }

    // Save class-specific hours — matches classid_{id}_start, classid_{id}_end,
    // classid_{id}_{day}_start, classid_{id}_{day}_end
    foreach ($data as $key => $val) {
        if (preg_match('/^classid_\d+_([a-z]+_)?(start|end)$/', $key)) {
            $val = trim($val);
            $stmt->bind_param('sss', $key, $val, $val);
            $stmt->execute();
        }
    }

    // ── Auto-update timetable slots to match new timings ──────────────────────
    $timetable_updated = 0;

    if ($update_timetable) {
        $proper_days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

        // Classes with a NON-EMPTY class-level default override (classid_{id}_start)
        // Only non-empty values qualify — empty means "follow school default"
        $class_specific_ids = [];
        foreach ($old as $k => $v) {
            if (!empty($v) && preg_match('/^classid_(\d+)_start$/', $k, $m))
                $class_specific_ids[] = intval($m[1]);
        }
        foreach ($data as $k => $v) {
            if (!empty(trim($v)) && preg_match('/^classid_(\d+)_start$/', $k, $m))
                $class_specific_ids[] = intval($m[1]);
        }
        $class_specific_ids = array_unique($class_specific_ids);

        // ALL classes with any NON-EMPTY override — default or per-day
        $class_any_ids = $class_specific_ids;
        foreach ($old as $k => $v) {
            if (!empty($v) && preg_match('/^classid_(\d+)_[a-z]+_start$/', $k, $m))
                $class_any_ids[] = intval($m[1]);
        }
        foreach ($data as $k => $v) {
            if (!empty(trim($v)) && preg_match('/^classid_(\d+)_[a-z]+_start$/', $k, $m))
                $class_any_ids[] = intval($m[1]);
        }
        $class_any_ids = array_unique($class_any_ids);

        // ── 1. Default school-hours shift → classes WITHOUT a class-level override ──
        // (Classes with only per-day overrides still receive the default shift here;
        //  step 4 will apply the extra per-day delta on top of it.)
        $old_default_start  = $old['school_start'] ?? '08:00';
        $default_shift_secs = (timeToMinutes($school_start) - timeToMinutes($old_default_start)) * 60;

        if ($default_shift_secs !== 0) {
            if (empty($class_specific_ids)) {
                $upd = $db->prepare(
                    "UPDATE timetable SET
                        start_time = SEC_TO_TIME(TIME_TO_SEC(start_time) + ?),
                        end_time   = SEC_TO_TIME(TIME_TO_SEC(end_time)   + ?)"
                );
                $upd->bind_param('ii', $default_shift_secs, $default_shift_secs);
                $upd->execute();
                $timetable_updated += $upd->affected_rows;
            } else {
                $placeholders = implode(',', array_fill(0, count($class_specific_ids), '?'));
                $types        = 'ii' . str_repeat('i', count($class_specific_ids));
                $params       = array_merge([$default_shift_secs, $default_shift_secs], $class_specific_ids);
                $upd = $db->prepare(
                    "UPDATE timetable SET
                        start_time = SEC_TO_TIME(TIME_TO_SEC(start_time) + ?),
                        end_time   = SEC_TO_TIME(TIME_TO_SEC(end_time)   + ?)
                     WHERE class_id NOT IN ($placeholders)"
                );
                $upd->bind_param($types, ...$params);
                $upd->execute();
                $timetable_updated += $upd->affected_rows;
            }
        }

        // ── 2. Class-specific default shifts → per class ─────────────────────
        foreach ($class_specific_ids as $cid) {
            $old_class_start  = $old["classid_{$cid}_start"] ?? ($old['school_start'] ?? '08:00');
            $new_class_start  = trim($data["classid_{$cid}_start"] ?? '') ?: $school_start;
            $class_shift_secs = (timeToMinutes($new_class_start) - timeToMinutes($old_class_start)) * 60;

            if ($class_shift_secs !== 0) {
                $upd = $db->prepare(
                    "UPDATE timetable SET
                        start_time = SEC_TO_TIME(TIME_TO_SEC(start_time) + ?),
                        end_time   = SEC_TO_TIME(TIME_TO_SEC(end_time)   + ?)
                     WHERE class_id = ?"
                );
                $upd->bind_param('iii', $class_shift_secs, $class_shift_secs, $cid);
                $upd->execute();
                $timetable_updated += $upd->affected_rows;
            }
        }

        // ── 3. Per-day default shifts → rows for that day, no class override ──
        foreach ($proper_days as $dayName) {
            $dk      = strtolower($dayName);
            $eff_old = ($old["{$dk}_start"] ?? '') ?: ($old['school_start'] ?? '08:00');
            $eff_new = trim($data["{$dk}_start"] ?? '') ?: $school_start;
            $total   = (timeToMinutes($eff_new) - timeToMinutes($eff_old)) * 60;
            $extra   = $total - $default_shift_secs;
            if ($extra === 0) continue;

            if (empty($class_any_ids)) {
                $upd = $db->prepare(
                    "UPDATE timetable SET
                        start_time = SEC_TO_TIME(TIME_TO_SEC(start_time) + ?),
                        end_time   = SEC_TO_TIME(TIME_TO_SEC(end_time)   + ?)
                     WHERE FIND_IN_SET(?, days)"
                );
                $upd->bind_param('iis', $extra, $extra, $dayName);
            } else {
                $ph     = implode(',', array_fill(0, count($class_any_ids), '?'));
                $types  = 'iis' . str_repeat('i', count($class_any_ids));
                $params = array_merge([$extra, $extra, $dayName], $class_any_ids);
                $upd = $db->prepare(
                    "UPDATE timetable SET
                        start_time = SEC_TO_TIME(TIME_TO_SEC(start_time) + ?),
                        end_time   = SEC_TO_TIME(TIME_TO_SEC(end_time)   + ?)
                     WHERE FIND_IN_SET(?, days) AND class_id NOT IN ($ph)"
                );
                $upd->bind_param($types, ...$params);
            }
            $upd->execute();
            $timetable_updated += $upd->affected_rows;
        }

        // ── 4. Per-day class-specific shifts → per class + day ───────────────
        foreach ($class_any_ids as $cid) {
            // How much was already applied to this class's rows above?
            if (in_array($cid, $class_specific_ids)) {
                $old_cs          = $old["classid_{$cid}_start"] ?? ($old['school_start'] ?? '08:00');
                $new_cs          = trim($data["classid_{$cid}_start"] ?? '') ?: $school_start;
                $already_applied = (timeToMinutes($new_cs) - timeToMinutes($old_cs)) * 60;
            } else {
                $already_applied = $default_shift_secs;
            }

            foreach ($proper_days as $dayName) {
                $dk = strtolower($dayName);

                // Old effective (class-day → class default → day default → school default)
                $old_cd = ($old["classid_{$cid}_{$dk}_start"] ?? '')
                    ?: (($old["classid_{$cid}_start"] ?? '')
                        ?: (($old["{$dk}_start"] ?? '') ?: ($old['school_start'] ?? '08:00')));

                // New effective — same priority chain: class-day → class default → day default → school
                $new_cd_raw = trim($data["classid_{$cid}_{$dk}_start"] ?? '');
                $new_cs_raw = trim($data["classid_{$cid}_start"] ?? '');   // empty = no override
                $new_d_raw  = trim($data["{$dk}_start"] ?? '');
                $new_cd     = $new_cd_raw ?: ($new_cs_raw ?: ($new_d_raw ?: $school_start));

                $total = (timeToMinutes($new_cd) - timeToMinutes($old_cd)) * 60;
                $extra = $total - $already_applied;
                if ($extra === 0) continue;

                $upd = $db->prepare(
                    "UPDATE timetable SET
                        start_time = SEC_TO_TIME(TIME_TO_SEC(start_time) + ?),
                        end_time   = SEC_TO_TIME(TIME_TO_SEC(end_time)   + ?)
                     WHERE class_id = ? AND FIND_IN_SET(?, days)"
                );
                $upd->bind_param('iiis', $extra, $extra, $cid, $dayName);
                $upd->execute();
                $timetable_updated += $upd->affected_rows;
            }
        }
    }

    jsonResponse([
        'success'           => true,
        'school_start'      => $school_start,
        'school_end'        => $school_end,
        'timetable_updated' => $timetable_updated,
    ]);
}
