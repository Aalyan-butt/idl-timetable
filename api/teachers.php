<?php
require_once '../includes/config.php';
requireAuth();

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

if ($method === 'GET') {
    $id = $_GET['id'] ?? null;
    if ($id) {
        if (isSupervisor() && !supervisorCanAccessTeacher($id)) {
            jsonResponse(['error' => 'Not found'], 404);
        }
        $stmt = $db->prepare('SELECT * FROM teachers WHERE id = ?');
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $result = $stmt->get_result()->fetch_assoc();
        jsonResponse($result ?: ['error' => 'Not found']);
    } else {
        if (isSupervisor()) {
            $ids = getSupervisorTeacherIds();
            if (empty($ids)) { jsonResponse([]); }
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $stmt = $db->prepare("SELECT * FROM teachers WHERE id IN ($placeholders) ORDER BY name");
            $types = str_repeat('i', count($ids));
            $stmt->bind_param($types, ...$ids);
            $stmt->execute();
            $r = $stmt->get_result(); $teachers = [];
            while ($row = $r->fetch_assoc()) $teachers[] = $row;
            jsonResponse($teachers);
        }
        $result = $db->query('SELECT * FROM teachers ORDER BY name');
        $teachers = [];
        while ($row = $result->fetch_assoc()) $teachers[] = $row;
        jsonResponse($teachers);
    }
}

function extractTeacherData($data) {
    return [
        'title'              => trim($data['title']              ?? ''),
        'name'               => trim($data['name']               ?? ''),
        'designation'        => trim($data['designation']        ?? ''),
        'religion'           => trim($data['religion']           ?? ''),
        'gender'             => trim($data['gender']             ?? ''),
        'joining_date'       => (trim($data['joining_date']      ?? '') ?: null),
        'nic_number'         => trim($data['nic_number']         ?? ''),
        'employment_type'    => trim($data['employment_type']    ?? 'Permanent'),
        'per_lecture_amount' => (isset($data['per_lecture_amount']) && $data['per_lecture_amount'] !== '' ? (float)$data['per_lecture_amount'] : null),
        'role'               => trim($data['role']               ?? 'Teacher'),
        'work_experience'    => trim($data['work_experience']    ?? ''),
        'qualification'      => trim($data['qualification']      ?? ''),
        'marital_status'     => trim($data['marital_status']     ?? ''),
        'phone'              => trim($data['phone']              ?? ''),
        'whatsapp'           => trim($data['whatsapp']           ?? ''),
        'blood_group'        => trim($data['blood_group']        ?? ''),
        'email'              => trim($data['email']              ?? ''),
        'date_of_birth'      => (trim($data['date_of_birth']     ?? '') ?: null),
        'place_of_birth'     => trim($data['place_of_birth']     ?? ''),
        'address'            => trim($data['address']            ?? ''),
        'starting_salary'    => (isset($data['starting_salary']) && $data['starting_salary'] !== '' ? (float)$data['starting_salary'] : null),
        'current_salary'     => (isset($data['current_salary'])  && $data['current_salary']  !== '' ? (float)$data['current_salary']  : null),
        'bank_account_no'    => trim($data['bank_account_no']    ?? ''),
        'notes'              => trim($data['notes']              ?? ''),
        'photo'              => trim($data['photo']              ?? ''),
        'cnic_front'         => trim($data['cnic_front']         ?? ''),
        'cnic_back'          => trim($data['cnic_back']          ?? ''),
        'relationship_name'  => trim($data['relationship_name']  ?? ''),
    ];
}

if ($method === 'POST') {
    if (isSupervisor()) jsonResponse(['error' => 'Supervisors cannot create teachers'], 403);
    requireAdmin();
    $data = json_decode(file_get_contents('php://input'), true);
    $f = extractTeacherData($data);

    if (empty($f['title']) || empty($f['name'])) jsonResponse(['error' => 'Title and name required'], 400);
    if (!in_array($f['title'], ['Sir', 'Mam', 'Ms.'])) jsonResponse(['error' => 'Title must be Sir, Mam or Ms.'], 400);

    $stmt = $db->prepare('INSERT INTO teachers (title,name,designation,religion,gender,joining_date,nic_number,employment_type,per_lecture_amount,role,work_experience,qualification,marital_status,phone,whatsapp,blood_group,email,date_of_birth,place_of_birth,address,starting_salary,current_salary,bank_account_no,notes,photo,cnic_front,cnic_back,relationship_name) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    $stmt->bind_param('ssssssssdsssssssssssddssssss',
        $f['title'],$f['name'],$f['designation'],$f['religion'],$f['gender'],$f['joining_date'],
        $f['nic_number'],$f['employment_type'],$f['per_lecture_amount'],$f['role'],
        $f['work_experience'],$f['qualification'],$f['marital_status'],$f['phone'],$f['whatsapp'],
        $f['blood_group'],$f['email'],$f['date_of_birth'],$f['place_of_birth'],$f['address'],
        $f['starting_salary'],$f['current_salary'],$f['bank_account_no'],$f['notes'],
        $f['photo'],$f['cnic_front'],$f['cnic_back'],$f['relationship_name']
    );
    if ($stmt->execute()) {
        $new_id = $db->insert_id;
        logNotification('add', 'teacher', $new_id, "{$f['title']} {$f['name']}",
            array_merge(['id' => $new_id], $f));
        jsonResponse(['success' => true, 'id' => $new_id]);
    } else {
        jsonResponse(['error' => 'Failed to add teacher: ' . $db->error], 500);
    }
}

if ($method === 'PUT') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonResponse(['error' => 'ID required'], 400);
    if (isSupervisor()) {
        if (!supervisorCanAccessTeacher($id)) jsonResponse(['error' => 'Teacher not assigned to you'], 403);
    } else {
        requireAdmin();
    }

    $data = json_decode(file_get_contents('php://input'), true);
    $f = extractTeacherData($data);

    if (empty($f['title']) || empty($f['name'])) jsonResponse(['error' => 'Title and name required'], 400);
    if (!in_array($f['title'], ['Sir', 'Mam', 'Ms.'])) jsonResponse(['error' => 'Title must be Sir, Mam or Ms.'], 400);

    $old_stmt = $db->prepare('SELECT * FROM teachers WHERE id=?');
    $old_stmt->bind_param('i', $id);
    $old_stmt->execute();
    $old_row = $old_stmt->get_result()->fetch_assoc();

    $stmt = $db->prepare('UPDATE teachers SET title=?,name=?,designation=?,religion=?,gender=?,joining_date=?,nic_number=?,employment_type=?,per_lecture_amount=?,role=?,work_experience=?,qualification=?,marital_status=?,phone=?,whatsapp=?,blood_group=?,email=?,date_of_birth=?,place_of_birth=?,address=?,starting_salary=?,current_salary=?,bank_account_no=?,notes=?,photo=?,cnic_front=?,cnic_back=?,relationship_name=? WHERE id=?');
    $stmt->bind_param('ssssssssdsssssssssssddssssssi',
        $f['title'],$f['name'],$f['designation'],$f['religion'],$f['gender'],$f['joining_date'],
        $f['nic_number'],$f['employment_type'],$f['per_lecture_amount'],$f['role'],
        $f['work_experience'],$f['qualification'],$f['marital_status'],$f['phone'],$f['whatsapp'],
        $f['blood_group'],$f['email'],$f['date_of_birth'],$f['place_of_birth'],$f['address'],
        $f['starting_salary'],$f['current_salary'],$f['bank_account_no'],$f['notes'],
        $f['photo'],$f['cnic_front'],$f['cnic_back'],$f['relationship_name'],$id
    );
    if ($stmt->execute()) {
        logNotification('edit', 'teacher', $id, "{$f['title']} {$f['name']}", $old_row);
        jsonResponse(['success' => true]);
    } else {
        jsonResponse(['error' => 'Failed to update: ' . $db->error], 500);
    }
}

if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonResponse(['error' => 'ID required'], 400);
    if (isSupervisor()) {
        if (!supervisorCanAccessTeacher($id)) jsonResponse(['error' => 'Teacher not assigned to you'], 403);
    } else {
        requireAdmin();
    }

    $old_stmt = $db->prepare('SELECT * FROM teachers WHERE id=?');
    $old_stmt->bind_param('i', $id);
    $old_stmt->execute();
    $old_row = $old_stmt->get_result()->fetch_assoc();
    $display_name = ($old_row ? $old_row['title'] . ' ' . $old_row['name'] : "Teacher #{$id}");

    $stmt = $db->prepare('DELETE FROM teachers WHERE id=?');
    $stmt->bind_param('i', $id);
    if ($stmt->execute()) {
        logNotification('delete', 'teacher', $id, $display_name, $old_row);
        jsonResponse(['success' => true]);
    } else {
        jsonResponse(['error' => 'Failed to delete'], 500);
    }
}
