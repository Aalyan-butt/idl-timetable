<?php
require_once '../includes/config.php';
requireAdmin();

$method = $_SERVER['REQUEST_METHOD'];
$db     = getDB();

// ── Auto-seed: create a parents row for any student father_cnic not yet there,
//              and assign family_codes to any cnic that doesn't have one yet ──
function seedParents($db) {
    // 1. Insert parent rows for any father_cnic in students not in parents
    $db->query(
        "INSERT IGNORE INTO parents (student_id, parent_name, cnic, phone)
         SELECT DISTINCT NULL, s.father_name, s.father_cnic, s.father_phone
         FROM students s
         WHERE s.father_cnic IS NOT NULL AND TRIM(s.father_cnic) != ''
         AND s.father_cnic NOT IN (SELECT cnic FROM parents WHERE cnic IS NOT NULL)"
    );

    // 2. Assign family_code to any cnic that doesn't have one yet
    $result = $db->query(
        "SELECT DISTINCT cnic FROM parents
         WHERE cnic IS NOT NULL AND TRIM(cnic) != ''
         AND (family_code IS NULL OR TRIM(family_code) = '')"
    );
    if (!$result) return;
    while ($row = $result->fetch_assoc()) {
        $cnic   = $row['cnic'];
        $maxRes = $db->query("SELECT MAX(CAST(family_code AS UNSIGNED)) AS max_code FROM parents WHERE family_code IS NOT NULL AND TRIM(family_code) != ''");
        $maxRow = $maxRes ? $maxRes->fetch_assoc() : [];
        $code   = str_pad(($maxRow['max_code'] ? intval($maxRow['max_code']) : 0) + 1, 3, '0', STR_PAD_LEFT);
        $stmt   = $db->prepare("UPDATE parents SET family_code = ? WHERE cnic = ? AND (family_code IS NULL OR TRIM(family_code) = '')");
        $stmt->bind_param('ss', $code, $cnic);
        $stmt->execute();
    }
}

// ── GET: list all parent families ─────────────────────────────────────────
if ($method === 'GET') {
    seedParents($db);

    $result = $db->query(
        "SELECT
            MIN(p.id)           AS id,
            MIN(p.family_code)  AS family_code,
            p.cnic              AS father_cnic,
            MIN(p.photo)        AS photo,
            MIN(p.parent_name)  AS parent_name,
            MIN(p.phone)        AS parent_phone,
            MIN(p.email)        AS email,
            MIN(p.whatsapp)     AS whatsapp,
            MIN(p.address)      AS address,
            MIN(p.profession)   AS profession,
            MIN(p.gender)       AS gender,
            MIN(p.notes)        AS notes,
            MIN(p.doc1)         AS doc1,
            MIN(p.doc2)         AS doc2,
            GROUP_CONCAT(
                CONCAT(s.student_name, IFNULL(CONCAT(' (', c.name, ')'), ''))
                ORDER BY s.student_name SEPARATOR '||'
            ) AS children_str,
            COUNT(s.id) AS children_count
         FROM parents p
         LEFT JOIN students s ON s.father_cnic = p.cnic
         LEFT JOIN classes c ON c.id = s.class_id
         WHERE p.cnic IS NOT NULL AND TRIM(p.cnic) != ''
         GROUP BY p.cnic
         ORDER BY CAST(MIN(p.family_code) AS UNSIGNED) ASC"
    );

    if (!$result) jsonResponse(['error' => 'DB error: ' . $db->error], 500);
    $rows = [];
    while ($row = $result->fetch_assoc()) {
        $row['children'] = $row['children_str'] ? explode('||', $row['children_str']) : [];
        unset($row['children_str']);
        $rows[] = $row;
    }
    jsonResponse($rows);
}

// ── POST: add a new parent entry ──────────────────────────────────────────
if ($method === 'POST') {
    $data        = json_decode(file_get_contents('php://input'), true);
    $cnic        = trim($data['father_cnic']  ?? '');
    $parent_name = trim($data['parent_name']  ?? '');
    $phone       = trim($data['parent_phone'] ?? '');
    $photo       = $data['photo']       ?? null;
    $email       = trim($data['email']      ?? '');
    $whatsapp    = trim($data['whatsapp']   ?? '');
    $address     = trim($data['address']    ?? '');
    $profession  = trim($data['profession'] ?? '');
    $gender      = trim($data['gender']     ?? '');
    $notes       = trim($data['notes']      ?? '');
    $doc1        = $data['doc1'] ?? null;
    $doc2        = $data['doc2'] ?? null;

    if (!$cnic)        jsonResponse(['error' => 'CNIC is required'], 400);
    if (!$parent_name) jsonResponse(['error' => 'Parent name is required'], 400);

    // Check duplicate
    $check = $db->prepare('SELECT id FROM parents WHERE cnic = ? LIMIT 1');
    $check->bind_param('s', $cnic);
    $check->execute();
    if ($check->get_result()->fetch_assoc()) {
        jsonResponse(['error' => 'A parent record with this CNIC already exists'], 409);
    }

    // Auto-assign next family_code
    $maxRes = $db->query("SELECT MAX(CAST(family_code AS UNSIGNED)) AS max_code FROM parents WHERE family_code IS NOT NULL AND TRIM(family_code) != ''");
    $maxRow = $maxRes ? $maxRes->fetch_assoc() : [];
    $code   = str_pad(($maxRow['max_code'] ? intval($maxRow['max_code']) : 0) + 1, 3, '0', STR_PAD_LEFT);

    $stmt = $db->prepare('INSERT INTO parents (parent_name, cnic, phone, photo, email, whatsapp, address, profession, gender, notes, doc1, doc2, family_code) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
    $stmt->bind_param('sssssssssssss', $parent_name, $cnic, $phone, $photo, $email, $whatsapp, $address, $profession, $gender, $notes, $doc1, $doc2, $code);
    if (!$stmt->execute()) jsonResponse(['error' => $db->error], 500);
    jsonResponse(['id' => $db->insert_id, 'family_code' => $code]);
}

// ── PUT: update photo for a family (matched by cnic) ─────────────────────
if ($method === 'PUT') {
    $data        = json_decode(file_get_contents('php://input'), true);
    $cnic        = trim($data['father_cnic']  ?? '');
    $parent_name = trim($data['parent_name']  ?? '');
    $phone       = trim($data['parent_phone'] ?? '');
    $photo       = $data['photo']       ?? null;
    $email       = trim($data['email']      ?? '');
    $whatsapp    = trim($data['whatsapp']   ?? '');
    $address     = trim($data['address']    ?? '');
    $profession  = trim($data['profession'] ?? '');
    $gender      = trim($data['gender']     ?? '');
    $notes       = trim($data['notes']      ?? '');
    $doc1        = $data['doc1'] ?? null;
    $doc2        = $data['doc2'] ?? null;

    if (!$cnic) jsonResponse(['error' => 'cnic required'], 400);

    $stmt = $db->prepare('UPDATE parents SET parent_name=?, phone=?, photo=?, email=?, whatsapp=?, address=?, profession=?, gender=?, notes=?, doc1=?, doc2=? WHERE cnic=?');
    $stmt->bind_param('ssssssssssss', $parent_name, $phone, $photo, $email, $whatsapp, $address, $profession, $gender, $notes, $doc1, $doc2, $cnic);
    if (!$stmt->execute()) jsonResponse(['error' => $db->error], 500);
    jsonResponse(['success' => true]);
}

// ── DELETE: remove parent records by cnic ────────────────────────────────
if ($method === 'DELETE') {
    $cnic = trim($_GET['cnic'] ?? '');
    if (!$cnic) jsonResponse(['error' => 'cnic required'], 400);
    $stmt = $db->prepare('DELETE FROM parents WHERE cnic = ?');
    $stmt->bind_param('s', $cnic);
    $stmt->execute();
    jsonResponse(['success' => true]);
}

jsonResponse(['error' => 'Method not allowed'], 405);
