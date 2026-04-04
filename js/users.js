// ===== USER CRUD =====
// Close teacher/class permission lists when clicking outside their containers
document.addEventListener('mousedown', function(e) {
  const tGroup = document.getElementById('teacher-permissions-group');
  if (tGroup && !tGroup.contains(e.target)) {
    const list = document.getElementById('teacher-permissions-list');
    if (list) list.style.display = 'none';
  }
  const cGroup = document.getElementById('class-permissions-group');
  if (cGroup && !cGroup.contains(e.target)) {
    const list = document.getElementById('class-permissions-list');
    if (list) list.style.display = 'none';
  }
  const qaT = document.getElementById('qa-teacher-perm-group');
  if (qaT && !qaT.contains(e.target)) {
    const list = document.getElementById('qa-teacher-list');
    if (list) list.style.display = 'none';
  }
  const qaC = document.getElementById('qa-class-perm-group');
  if (qaC && !qaC.contains(e.target)) {
    const list = document.getElementById('qa-class-list');
    if (list) list.style.display = 'none';
  }
});

function toggleTeacherPermissions() {
  const role = document.getElementById('user-role').value;
  document.getElementById('teacher-permissions-group').style.display = role === 'user' ? '' : 'none';
  document.getElementById('class-permissions-group').style.display = role === 'user' ? '' : 'none';
  document.getElementById('supervisor-assignments-group').style.display = role === 'supervisor' ? '' : 'none';
  document.getElementById('student-link-group').style.display = (role === 'student' || role === 'parent') ? '' : 'none';
  document.getElementById('student-single-wrap').style.display = role === 'student' ? '' : 'none';
  document.getElementById('parent-student-wrap').style.display = role === 'parent' ? '' : 'none';
  ['teacher-perm-search','class-perm-search','supv-teacher-search','supv-class-search','supv-user-search'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  if (role === 'supervisor') loadSupervisorAssignmentLists([], [], []);
  if (role === 'student') loadStudentLinkOptions();
  if (role === 'parent') loadParentStudentList([]);
}

async function loadStudentLinkOptions(selectedId) {
  const select = document.getElementById('user-student-id');
  try {
    const students = await api(API.students);
    select.innerHTML = '<option value="">Select student…</option>' + students.map(s => {
      const cls = classes.find(c => c.id == s.class_id);
      return `<option value="${s.id}" ${selectedId == s.id ? 'selected' : ''}>${escapeHtml(((s.first_name||'') + ' ' + (s.last_name||'')).trim())}${cls ? ' — ' + escapeHtml(cls.name) : ''} (${escapeHtml(s.father_cnic)})</option>`;
    }).join('');
  } catch { select.innerHTML = '<option value="">Could not load students</option>'; }
}

async function loadParentStudentList(selectedIds = [], autoCnic = null, listId = 'parent-student-list', cbClass = 'parent-st-cb', itemClass = 'parent-st-item') {
  const list = document.getElementById(listId);
  if (!list) return;
  list.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:8px">Loading…</p>';
  try {
    const students = _studentsCache && _studentsCache.length ? _studentsCache : await api(API.students);
    if (!students.length) { list.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:8px">No Data Found</p>'; return; }
    // Auto-select by CNIC if provided and no existing IDs
    const autoIds = autoCnic
      ? students.filter(s => s.father_cnic === autoCnic).map(s => String(s.id))
      : [];
    const effectiveSelected = selectedIds.length ? selectedIds.map(String) : autoIds;

    list.innerHTML = students.map(s => {
      const name = escapeHtml(((s.first_name||'') + ' ' + (s.last_name||'')).trim() || s.student_name || '—');
      const cls  = (classes||[]).find(c => c.id == s.class_id);
      const checked = effectiveSelected.includes(String(s.id)) ? 'checked' : '';
      return `<label class="${itemClass}" style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:5px;cursor:pointer;font-size:0.87rem" onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background=''">
        <input type="checkbox" class="${cbClass}" value="${s.id}" ${checked} style="accent-color:var(--accent);width:14px;height:14px;flex-shrink:0">
        <span style="font-weight:600;color:var(--text)">${name}</span>
        ${cls ? `<span class="badge badge-blue" style="font-size:0.72rem">${escapeHtml(cls.name)}</span>` : ''}
        <span style="color:var(--text-muted);font-family:monospace;font-size:0.78rem">${escapeHtml(s.father_cnic||'')}</span>
      </label>`;
    }).join('');
  } catch { list.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:8px">Could not load students.</p>'; }
}

function filterParentStudentList(q) {
  const term = q.toLowerCase();
  document.querySelectorAll('.parent-st-item').forEach(item => {
    item.style.display = item.textContent.toLowerCase().includes(term) ? '' : 'none';
  });
}

function filterQAParentStudentList(q) {
  const term = q.toLowerCase();
  document.querySelectorAll('.qa-parent-st-item').forEach(item => {
    item.style.display = item.textContent.toLowerCase().includes(term) ? '' : 'none';
  });
}

async function loadTeacherPermissionsList(selectedIds = []) {
  const list = document.getElementById('teacher-permissions-list');
  list.style.display = 'none';
  try {
    const ts = await api(API.teachers);
    if (ts.length === 0) { list.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:8px">No teachers added yet.</p>'; return; }
    list.innerHTML = ts.map(t => {
      const displayTitle = normalizeTitle(t.title);
      return `
        <label style="display:flex;align-items:center;gap:10px;padding:6px 8px;border-radius:6px;cursor:pointer;font-size:0.88rem;transition:background 0.15s" onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background=''">
          <input type="checkbox" class="teacher-perm-cb" value="${t.id}" ${selectedIds.includes(String(t.id)) ? 'checked' : ''} style="accent-color:var(--accent);width:15px;height:15px;flex-shrink:0">
          <span class="badge ${t.title==='Sir'?'badge-blue':'badge-gold'}" style="font-size:0.75rem">${displayTitle}</span>
          ${t.name}
        </label>`;
    }).join('');
  } catch { list.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:8px">Could not load teachers.</p>'; }
}

async function loadClassPermissionsList(selectedIds = []) {
  const list = document.getElementById('class-permissions-list');
  list.style.display = 'none';
  try {
    const cs = await api(API.classes);
    if (cs.length === 0) { list.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:8px">No Data Found.</p>'; return; }
    list.innerHTML = cs.map(c => `
      <label style="display:flex;align-items:center;gap:10px;padding:6px 8px;border-radius:6px;cursor:pointer;font-size:0.88rem;transition:background 0.15s" onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background=''">
        <input type="checkbox" class="class-perm-cb" value="${c.id}" ${selectedIds.includes(String(c.id)) ? 'checked' : ''} style="accent-color:var(--accent);width:15px;height:15px;flex-shrink:0">
        <span class="badge badge-blue" style="font-size:0.75rem">📚</span>
        ${c.name}
      </label>`).join('');
  } catch { list.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:8px">Could not load classes.</p>'; }
}

function _setSelectAllActive(allBtnId, noneBtnId, activateAll) {
  const allBtn  = typeof allBtnId  === 'string' ? document.getElementById(allBtnId)  : allBtnId;
  const noneBtn = typeof noneBtnId === 'string' ? document.getElementById(noneBtnId) : noneBtnId;
  if (activateAll) {
    if (allBtn)  { allBtn.style.background='#16a34a';  allBtn.style.color='#fff'; allBtn.style.borderColor='#16a34a'; }
    if (noneBtn) { noneBtn.style.background=''; noneBtn.style.color=''; noneBtn.style.borderColor=''; }
  } else {
    if (allBtn)  { allBtn.style.background='';  allBtn.style.color=''; allBtn.style.borderColor=''; }
    if (noneBtn) { noneBtn.style.background=''; noneBtn.style.color=''; noneBtn.style.borderColor=''; }
  }
}
function selectAllTeachersPermission(btn) { document.querySelectorAll('.teacher-perm-cb').forEach(cb => cb.checked = true);  _setSelectAllActive(btn, 'btn-none-teachers', true); }
function selectNoneTeachersPermission(btn){ document.querySelectorAll('.teacher-perm-cb').forEach(cb => cb.checked = false); _setSelectAllActive('btn-all-teachers', btn, false); }
function selectAllClassesPermission(btn)  { document.querySelectorAll('.class-perm-cb').forEach(cb => cb.checked = true);    _setSelectAllActive(btn, 'btn-none-classes', true); }
function selectNoneClassesPermission(btn) { document.querySelectorAll('.class-perm-cb').forEach(cb => cb.checked = false);   _setSelectAllActive('btn-all-classes', btn, false); }
function selectAllSupervisorTeachers(btn) { document.querySelectorAll('.supv-teacher-cb').forEach(cb => cb.checked = true);  _setSelectAllActive(btn, 'btn-none-supv-teachers', true); }
function selectNoneSupervisorTeachers(btn){ document.querySelectorAll('.supv-teacher-cb').forEach(cb => cb.checked = false); _setSelectAllActive('btn-all-supv-teachers', btn, false); }
function selectAllSupervisorClasses(btn)  { document.querySelectorAll('.supv-class-cb').forEach(cb => cb.checked = true);    _setSelectAllActive(btn, 'btn-none-supv-classes', true); }
function selectNoneSupervisorClasses(btn) { document.querySelectorAll('.supv-class-cb').forEach(cb => cb.checked = false);   _setSelectAllActive('btn-all-supv-classes', btn, false); }
function selectAllSupervisorUsers(btn)    { document.querySelectorAll('.supv-user-cb').forEach(cb => cb.checked = true);     _setSelectAllActive(btn, 'btn-none-supv-users', true); }
function selectNoneSupervisorUsers(btn)   { document.querySelectorAll('.supv-user-cb').forEach(cb => cb.checked = false);    _setSelectAllActive('btn-all-supv-users', btn, false); }

// Filter visible checkbox labels by search text
function filterCheckboxList(listId, searchId) {
  const q = (document.getElementById(searchId)?.value || '').toLowerCase().trim();
  document.querySelectorAll(`#${listId} label`).forEach(lbl => {
    lbl.style.display = (!q || lbl.textContent.toLowerCase().includes(q)) ? '' : 'none';
  });
}

async function loadSupervisorAssignmentLists(selectedTeacherIds = [], selectedClassIds = [], selectedUserIds = []) {
  const tList = document.getElementById('supervisor-teacher-list');
  const cList = document.getElementById('supervisor-class-list');
  const uList = document.getElementById('supervisor-user-list');
  tList.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:8px">Loading...</p>';
  cList.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:8px">Loading...</p>';
  if (uList) uList.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:8px">Loading...</p>';
  try {
    // Fetch all teachers and classes via standard API (returns unfiltered for admins)
    const [ts, cs] = await Promise.all([
      api(API.teachers).catch(() => []),
      api(API.classes).catch(() => [])
    ]);
    // Fetch viewer users (admin gets all users; filter to role='user' client-side)
    const allUsers = await api(API.users).catch(() => []);
    const viewerUsers = Array.isArray(allUsers) ? allUsers.filter(u => u.role === 'user') : [];

    // Render teachers
    if (ts.length === 0) {
      tList.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:8px">No teachers available.</p>';
    } else {
      tList.innerHTML = ts.map(t => {
        const displayTitle = normalizeTitle(t.title);
        return `<label style="display:flex;align-items:center;gap:10px;padding:6px 8px;border-radius:6px;cursor:pointer;font-size:0.88rem;transition:background 0.15s" onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background=''">
          <input type="checkbox" class="supv-teacher-cb" value="${t.id}" ${selectedTeacherIds.includes(String(t.id)) ? 'checked' : ''} style="accent-color:#c87fff;width:15px;height:15px;flex-shrink:0">
          <span class="badge ${t.title==='Sir'?'badge-blue':'badge-gold'}" style="font-size:0.75rem">${displayTitle}</span>
          ${t.name}
        </label>`;
      }).join('');
    }
    // Render classes
    if (cs.length === 0) {
      cList.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:8px">No classes available.</p>';
    } else {
      cList.innerHTML = cs.map(c => {
        return `<label style="display:flex;align-items:center;gap:10px;padding:6px 8px;border-radius:6px;cursor:pointer;font-size:0.88rem;transition:background 0.15s" onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background=''">
          <input type="checkbox" class="supv-class-cb" value="${c.id}" ${selectedClassIds.includes(String(c.id)) ? 'checked' : ''} style="accent-color:#c87fff;width:15px;height:15px;flex-shrink:0">
          <span class="badge badge-blue" style="font-size:0.75rem">${c.name}</span>
        </label>`;
      }).join('');
    }
    // Render viewer users
    if (uList) {
      if (viewerUsers.length === 0) {
        uList.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:8px">No viewer accounts found.</p>';
      } else {
        uList.innerHTML = viewerUsers.map(u => {
          return `<label style="display:flex;align-items:center;gap:10px;padding:6px 8px;border-radius:6px;cursor:pointer;font-size:0.88rem;transition:background 0.15s" onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background=''">
            <input type="checkbox" class="supv-user-cb" value="${u.id}" ${selectedUserIds.includes(String(u.id)) ? 'checked' : ''} style="accent-color:#c87fff;width:15px;height:15px;flex-shrink:0">
            <span class="badge badge-blue" style="font-size:0.75rem">User</span>
            ${u.username}
          </label>`;
        }).join('');
      }
    }
  } catch(err) {
    tList.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:8px">Could not load data.</p>';
    cList.innerHTML = '';
    if (uList) uList.innerHTML = '';
  }
}

function copyStoredPassword() {
  const val = document.getElementById('user-stored-password').value;
  if (!val) return;
  navigator.clipboard.writeText(val).then(() => toast('Password copied', 'success')).catch(() => {});
}

function openUserModal() {
  document.getElementById('user-id').value = '';
  document.getElementById('user-username').value = '';
  document.getElementById('user-password').value = '';
  document.getElementById('user-role').value = 'user';
  document.getElementById('user-modal-title').textContent = 'Add User';
  document.getElementById('user-modal-error').style.display = 'none';
  document.getElementById('pw-hint').style.display = 'none';
  document.getElementById('stored-password-group').style.display = 'none';
  document.getElementById('user-stored-password').value = '';
  document.getElementById('teacher-permissions-group').style.display = '';
  document.getElementById('class-permissions-group').style.display = '';
  document.getElementById('supervisor-assignments-group').style.display = 'none';
  document.getElementById('student-link-group').style.display = 'none';
  document.getElementById('user-student-id').value = '';
  // Reset search filters
  ['teacher-perm-search','class-perm-search','supv-teacher-search','supv-class-search','supv-user-search'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  // Reset select-all button states
  ['btn-all-teachers','btn-none-teachers','btn-all-classes','btn-none-classes','btn-all-supv-teachers','btn-none-supv-teachers','btn-all-supv-classes','btn-none-supv-classes','btn-all-supv-users','btn-none-supv-users'].forEach(id => { const b = document.getElementById(id); if (b) { b.style.background=''; b.style.color=''; b.style.borderColor=''; } });
  // Show superadmin option only for superadmins
  const saOpt = document.querySelector('#user-role option[value="superadmin"]');
  if (saOpt) {
    const isSA = currentUser?.role === 'superadmin';
    saOpt.style.display = isSA ? '' : 'none';
    saOpt.disabled = !isSA;
  }
  // Show supervisor option only for admin/superadmin
  const supvOpt = document.querySelector('#user-role option[value="supervisor"]');
  if (supvOpt) {
    const canAddSupv = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
    supvOpt.style.display = canAddSupv ? '' : 'none';
    supvOpt.disabled = !canAddSupv;
  }
  loadTeacherPermissionsList([]);
  loadClassPermissionsList([]);
  openModal('user-modal-overlay');
}

function editUser(id) {
  const u = usersCache.find(x => String(x.id) === String(id));
  if (!u) { toast('User data not found', 'error'); return; }
  document.getElementById('user-id').value = u.id;
  document.getElementById('user-username').value = u.username;
  document.getElementById('user-password').value = '';
  document.getElementById('user-role').value = u.role;
  document.getElementById('user-modal-title').textContent = 'Edit User';
  document.getElementById('user-modal-error').style.display = 'none';
  document.getElementById('pw-hint').style.display = '';
  const _storedPw = u.password_hint || '';
  document.getElementById('user-stored-password').value = _storedPw;
  document.getElementById('stored-password-group').style.display = _storedPw ? '' : 'none';
  const selectedIds = u.teacher_ids_perm ? u.teacher_ids_perm.split(',').map(x=>x.trim()).filter(Boolean) : [];
  const selectedClassIds = u.class_ids_perm ? u.class_ids_perm.split(',').map(x=>x.trim()).filter(Boolean) : [];
  document.getElementById('teacher-permissions-group').style.display = u.role === 'user' ? '' : 'none';
  document.getElementById('class-permissions-group').style.display = u.role === 'user' ? '' : 'none';
  document.getElementById('supervisor-assignments-group').style.display = u.role === 'supervisor' ? '' : 'none';
  document.getElementById('student-link-group').style.display = (u.role === 'student' || u.role === 'parent') ? '' : 'none';
  document.getElementById('student-single-wrap').style.display = u.role === 'student' ? '' : 'none';
  document.getElementById('parent-student-wrap').style.display = u.role === 'parent'  ? '' : 'none';
  if (u.role === 'student') loadStudentLinkOptions(u.student_id);
  if (u.role === 'parent') {
    const selIds = u.student_ids ? u.student_ids.split(',').map(x=>x.trim()).filter(Boolean) : [];
    loadParentStudentList(selIds);
  }
  // Reset search filters when opening edit modal
  ['teacher-perm-search','class-perm-search','supv-teacher-search','supv-class-search','supv-user-search'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  // Show superadmin option only for superadmins
  const saOpt = document.querySelector('#user-role option[value="superadmin"]');
  if (saOpt) { const isSA = currentUser?.role === 'superadmin'; saOpt.style.display = isSA ? '' : 'none'; saOpt.disabled = !isSA; }
  // Show supervisor option for admin/superadmin
  const supvOpt = document.querySelector('#user-role option[value="supervisor"]');
  if (supvOpt) { const can = currentUser?.role === 'admin' || currentUser?.role === 'superadmin'; supvOpt.style.display = can ? '' : 'none'; supvOpt.disabled = !can; }
  loadTeacherPermissionsList(selectedIds);
  loadClassPermissionsList(selectedClassIds);
  if (u.role === 'supervisor') {
    const supvTIds = u.supervisor_teacher_ids ? u.supervisor_teacher_ids.split(',').map(x=>x.trim()).filter(Boolean) : [];
    const supvCIds = u.supervisor_class_ids   ? u.supervisor_class_ids.split(',').map(x=>x.trim()).filter(Boolean) : [];
    const supvUIds = u.supervisor_user_ids    ? u.supervisor_user_ids.split(',').map(x=>x.trim()).filter(Boolean) : [];
    loadSupervisorAssignmentLists(supvTIds, supvCIds, supvUIds);
  }
  openModal('user-modal-overlay');
}

async function saveUser() {
  const id = document.getElementById('user-id').value;
  const username = document.getElementById('user-username').value.trim();
  const password = document.getElementById('user-password').value;
  const role = document.getElementById('user-role').value;
  const errEl = document.getElementById('user-modal-error');
  errEl.style.display = 'none';
  const selectedTeachers = [...document.querySelectorAll('.teacher-perm-cb:checked')].map(cb => cb.value);
  const teacher_ids_perm = role === 'user' ? selectedTeachers.join(',') : '';
  const selectedClasses = [...document.querySelectorAll('.class-perm-cb:checked')].map(cb => cb.value);
  const class_ids_perm = role === 'user' ? selectedClasses.join(',') : '';
  // Supervisor assignment fields
  const supvTeachers = [...document.querySelectorAll('.supv-teacher-cb:checked')].map(cb => cb.value);
  const supvClasses  = [...document.querySelectorAll('.supv-class-cb:checked')].map(cb => cb.value);
  const supvUsers    = [...document.querySelectorAll('.supv-user-cb:checked')].map(cb => cb.value);
  const supervisor_teacher_ids = role === 'supervisor' ? supvTeachers.join(',') : '';
  const supervisor_class_ids   = role === 'supervisor' ? supvClasses.join(',') : '';
  const supervisor_user_ids    = role === 'supervisor' ? supvUsers.join(',') : '';
  const student_id  = role === 'student' ? (document.getElementById('user-student-id').value || null) : null;
  const student_ids = role === 'parent'  ? [...document.querySelectorAll('.parent-st-cb:checked')].map(cb => cb.value).join(',') || null : null;
  if (!username) { errEl.textContent = 'Username required'; errEl.style.display = 'flex'; return; }
  if (!id && !password) { errEl.textContent = 'Password required for new user'; errEl.style.display = 'flex'; return; }
  if (role === 'student' && !student_id) { errEl.textContent = 'Please link to a student record'; errEl.style.display = 'flex'; return; }
  if (role === 'parent' && !student_ids) { errEl.textContent = 'Please select at least one child'; errEl.style.display = 'flex'; return; }
  try {
    if (id) {
      await api(`${API.users}?id=${id}`, 'PUT', { username, password, role, teacher_ids_perm, class_ids_perm, supervisor_teacher_ids, supervisor_class_ids, supervisor_user_ids, student_id, student_ids });
    } else {
      await api(API.users, 'POST', { username, password, role, teacher_ids_perm, class_ids_perm, supervisor_teacher_ids, supervisor_class_ids, supervisor_user_ids, student_id, student_ids });
    }
    closeModal('user-modal-overlay');
    toast('User saved successfully', 'success');
    loadUsers();
  } catch (e) { errEl.textContent = e.message; errEl.style.display = 'flex'; }
}

// ===== DELETE CONFIRM =====
function confirmDelete(type, id, name) {
  document.getElementById('confirm-message').textContent = `Are you sure you want to delete "${name}"? This action cannot be undone.`;
  document.getElementById('confirm-btn').onclick = async () => {
    try {
      if (type === 'teacher') await api(`${API.teachers}?id=${id}`, 'DELETE');
      if (type === 'class') await api(`${API.classes}?id=${id}`, 'DELETE');
      if (type === 'timetable') await api(`${API.timetable}?id=${id}`, 'DELETE');
      if (type === 'user') await api(`${API.users}?id=${id}`, 'DELETE');
      closeModal('confirm-modal-overlay');
      toast('Deleted successfully', 'success');
      if (type === 'teacher') loadTeachers();
      if (type === 'class') loadClasses();
      if (type === 'timetable') loadTimetable();
      if (type === 'user') loadUsers();
    } catch (e) { closeModal('confirm-modal-overlay'); toast(e.message, 'error'); }
  };
  openModal('confirm-modal-overlay');
}

// ===== MODAL HELPERS =====
function openModal(id) {
  document.getElementById(id).classList.add('open');
  setTimeout(() => {
    document.getElementById(id).querySelectorAll('select:not([data-ss-init])').forEach(sel => makeSearchable(sel));
    document.getElementById(id).querySelectorAll('.ss-wrapper').forEach(w => { if (w._ssRefresh) w._ssRefresh(); });
  }, 10);
}
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    const inner = overlay.querySelector('.modal') || overlay.querySelector('.popup-confirm-box');
    if (inner && inner.contains(e.target)) return;
    if (overlay.id === 'import-modal-overlay') closeImportModal();
    else if (overlay.id === 'wa-modal-overlay') closeWAModal();
    else overlay.classList.remove('open');
  });
});

// ===== POPUP CONFIRM HELPER =====
function showPopupConfirm({ title = 'Are you sure?', msg, icon = '\u2753', yesLabel = 'Confirm', yesCls = 'btn-danger', onYes }) {
  const overlay = document.getElementById('popup-confirm-overlay');
  document.getElementById('popup-confirm-icon').textContent  = icon;
  document.getElementById('popup-confirm-title').textContent = title;
  document.getElementById('popup-confirm-msg').textContent   = msg;
  const yesBtn = document.getElementById('popup-confirm-yes');
  const noBtn  = document.getElementById('popup-confirm-no');
  yesBtn.className = 'btn ' + yesCls;
  yesBtn.textContent = yesLabel;
  const close = () => overlay.classList.remove('open');
  yesBtn.onclick = () => { close(); onYes(); };
  noBtn.onclick  = close;
  overlay.onclick = e => { if (e.target === overlay) close(); };
  overlay.classList.add('open');
}

// ===== SUPERADMIN FUNCTIONS =====
let _saRequests = [];

async function loadSARequests() {
  try {
    _saRequests = await api(`${API.users}?action=sa_requests`);
    const pending = _saRequests.filter(r => r.status === 'pending').length;
    const badge = document.getElementById('sa-badge');
    if (badge) { badge.textContent = pending; badge.style.display = pending > 0 ? 'inline' : 'none'; }
  } catch(e) { /* ignore if table doesn't exist yet */ }
}

function showPage_sa_requests() {
  renderSARequests();
}

async function renderSARequests() {
  await loadSARequests();
  await loadAllData();
  const tbody = document.getElementById('sa-requests-body');
  if (!tbody) return;
  if (_saRequests.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:36px;color:var(--text-muted)">No requests yet</td></tr>';
    return;
  }
  tbody.innerHTML = _saRequests.map(r => {
    const teacher = teachers.find(t => t.id == r.teacher_id);
    const teacherName = teacher ? `${normalizeTitle(teacher.title)} ${teacher.name}` : `Teacher #${r.teacher_id}`;
    const classNames = (r.class_ids || '').split(',').map(cid => {
      const cls = classes.find(c => c.id == cid.trim());
      return cls ? cls.name : `Class #${cid}`;
    }).join(', ');
    const statusBadge = r.status === 'pending' ? '<span class="badge badge-gold">Pending</span>' :
                        r.status === 'approved' ? '<span class="badge badge-green">Approved</span>' :
                        '<span class="badge badge-red">Rejected</span>';
    const actions = r.status === 'pending' ? `
      <button class="btn btn-success btn-sm" onclick="approveSARequest(${r.id})">✓ Approve</button>
      <button class="btn btn-danger btn-sm" onclick="rejectSARequest(${r.id})">✕ Reject</button>` : '—';
    return `<tr>
      <td>${teacherName}</td>
      <td style="font-size:0.85rem">${classNames}</td>
      <td style="color:var(--text-muted);font-size:0.85rem">${r.note || '—'}</td>
      <td>${statusBadge}</td>
      <td style="color:var(--text-muted);font-size:0.82rem">${formatDate(r.created_at)}</td>
      <td>${actions}</td>
    </tr>`;
  }).join('');
}

async function openSARequestModal() {
  await loadAllData();
  document.getElementById('sa-req-teacher').innerHTML = '<option value="">Select teacher...</option>' + teachers.map(t => `<option value="${t.id}">${normalizeTitle(t.title)} ${t.name}</option>`).join('');
  document.getElementById('sa-req-classes').innerHTML = classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  document.getElementById('sa-req-note').value = '';
  document.getElementById('sa-request-error').style.display = 'none';
  // Make modal visible
  const overlay = document.getElementById('sa-request-modal-overlay');
  overlay.style.display = 'flex';
  makeSearchable(document.getElementById('sa-req-teacher'));
  makeSearchable(document.getElementById('sa-req-classes'));
  setTimeout(() => overlay.classList.add('open'), 10);
}

async function submitSARequest() {
  const teacher_id = document.getElementById('sa-req-teacher').value;
  const classSelect = document.getElementById('sa-req-classes');
  const class_ids = [...classSelect.selectedOptions].map(o => o.value).join(',');
  const note = document.getElementById('sa-req-note').value.trim();
  const errEl = document.getElementById('sa-request-error');
  errEl.style.display = 'none';
  if (!teacher_id) { errEl.textContent = 'Please select a teacher'; errEl.style.display = 'flex'; return; }
  if (!class_ids || classSelect.selectedOptions.length < 2) { errEl.textContent = 'Please select at least 2 classes'; errEl.style.display = 'flex'; return; }
  try {
    await api(`${API.users}?action=sa_request`, 'POST', { teacher_id: +teacher_id, class_ids, note });
    closeModal('sa-request-modal-overlay');
    toast('Request submitted — approve it below', 'success');
    renderSARequests();
  } catch(e) { errEl.textContent = e.message; errEl.style.display = 'flex'; }
}

async function approveSARequest(id) {
  try {
    await api(`${API.users}?action=sa_approve&id=${id}`, 'PUT');
    toast('Request approved', 'success');
    renderSARequests();
  } catch(e) { toast(e.message, 'error'); }
}

async function rejectSARequest(id) {
  try {
    await api(`${API.users}?action=sa_reject&id=${id}`, 'PUT');
    toast('Request rejected', 'success');
    renderSARequests();
  } catch(e) { toast(e.message, 'error'); }
}

// ===== QUICK ACCOUNT MODAL (Teacher / Student) =====
let _qaType         = null;  // 'teacher' | 'student'
let _qaId           = null;  // teacher_id or student_id
let _qaUserId       = null;  // existing user.id if found
let _qaExistingUser = null;  // full existing user object

function generateParentUsername(name) {
  const base = name.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean).join('');
  const suffix = String(Math.floor(100 + Math.random() * 900));
  return (base || 'parent') + suffix;
}

function generateTeacherUsername(name) {
  const clean = name.replace(/\b(Sir|Mam|Miss|Mr|Mrs|Ms|Dr|Prof)\b/gi, '').trim();
  const base = clean.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean).join('');
  const suffix = String(Math.floor(10 + Math.random() * 90));
  return (base || 'teacher') + suffix;
}

function generatePassword() {
  const upper   = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower   = 'abcdefghjkmnpqrstuvwxyz';
  const digits  = '23456789';
  const special = '@#$!%&*';
  const all = upper + lower + digits + special;
  const pw = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    special[Math.floor(Math.random() * special.length)],
  ];
  for (let i = 4; i < 12; i++) pw.push(all[Math.floor(Math.random() * all.length)]);
  for (let i = pw.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pw[i], pw[j]] = [pw[j], pw[i]];
  }
  return pw.join('');
}

function copyQuickPw() {
  const inp = document.getElementById('quick-acct-password');
  if (!inp) return;
  navigator.clipboard.writeText(inp.value).then(() => toast('Password copied!', 'success')).catch(() => {
    inp.select(); document.execCommand('copy'); toast('Password copied!', 'success');
  });
}

function regenQuickPw() {
  const inp = document.getElementById('quick-acct-password');
  if (inp) inp.value = generatePassword();
}

async function openQuickAccountModal(type, id, name) {
  _qaType         = type;
  _qaId           = id;
  _qaUserId       = null;
  _qaExistingUser = null;

  const title = type === 'teacher' ? `Teacher Account: ${name}` : type === 'parent' ? `Parent Account: ${name}` : `Student Account: ${name}`;
  document.getElementById('quick-acct-title').textContent = title;
  document.getElementById('quick-acct-loading').style.display = '';
  document.getElementById('quick-acct-exists').style.display = 'none';
  document.getElementById('quick-acct-new').style.display = 'none';
  document.getElementById('quick-acct-teacher-section').style.display = 'none';
  document.getElementById('quick-acct-footer').style.display = 'none';
  document.getElementById('quick-acct-error').style.display = 'none';
  document.getElementById('qa-teacher-list').style.display = 'none';
  document.getElementById('qa-class-list').style.display = 'none';
  document.getElementById('qa-parent-students').style.display = 'none';
  // Collapse parent students section
  const psBody = document.getElementById('qa-parent-students-body');
  if (psBody) psBody.style.display = 'none';
  const psCaret = document.getElementById('qa-parent-students-caret');
  if (psCaret) psCaret.innerHTML = '&#9660;';
  const psList = document.getElementById('qa-parent-student-list');
  if (psList) psList.style.display = 'none';
  const psSearch = document.getElementById('qa-parent-student-search');
  if (psSearch) psSearch.value = '';
  // Collapse the advanced section
  document.getElementById('qa-advanced').style.display = 'none';
  document.getElementById('qa-advanced-caret').innerHTML = '&#9660;';

  openModal('quick-acct-modal-overlay');

  try {
    const users = await api(API.users);
    let existing = null;
    if (type === 'teacher') {
      existing = users.find(u => u.teacher_id && String(u.teacher_id) === String(id));
    } else if (type === 'parent') {
      existing = users.find(u => u.role === 'parent' && String(u.parent_id) === String(id));
    } else {
      existing = users.find(u => u.role === 'student' && u.student_id && String(u.student_id) === String(id));
    }

    document.getElementById('quick-acct-loading').style.display = 'none';

    if (existing) {
      _qaUserId       = existing.id;
      _qaExistingUser = existing;
      document.getElementById('quick-acct-username-display').value = existing.username;
      const _storedQaPw = existing.password_hint || '';
      document.getElementById('quick-acct-reset-pw').value = _storedQaPw;
      document.getElementById('quick-acct-reset-pw').type = _storedQaPw ? 'text' : 'password';
      document.getElementById('quick-acct-reset-eye').textContent = '\uD83D\uDC41';
      document.getElementById('quick-acct-exists').style.display = '';
      document.getElementById('qa-delete-btn').style.display = '';
      document.getElementById('qa-submit-btn').textContent = 'Save';
    } else {
      document.getElementById('quick-acct-username').value = type === 'teacher' ? generateTeacherUsername(name) : type === 'parent' ? generateParentUsername(name) : name.toLowerCase().replace(/[^a-z0-9]/g, '');
      document.getElementById('quick-acct-password').value = generatePassword();
      const hintEl = document.getElementById('qa-pw-hint');
      if (hintEl) hintEl.textContent = type === 'teacher' ? '(auto-generated — share with teacher)' : type === 'parent' ? '(auto-generated — share with parent)' : '(auto-generated — share with student)';
      document.getElementById('quick-acct-new').style.display = '';
      document.getElementById('qa-delete-btn').style.display = 'none';
      document.getElementById('qa-submit-btn').textContent = 'Create Account';
    }

    if (type === 'teacher') {
      document.getElementById('quick-acct-teacher-section').style.display = '';

      const qaRole = document.getElementById('qa-role');
      qaRole.value = existing ? (existing.role || 'user') : 'user';

      const isSA = currentUser && currentUser.role === 'superadmin';
      const saOpt = qaRole.querySelector('option[value="superadmin"]');
      if (saOpt) { saOpt.style.display = isSA ? '' : 'none'; saOpt.disabled = !isSA; }
      if (!isSA && qaRole.value === 'superadmin') qaRole.value = 'user';

      qaTogglePermsVisibility();

      document.getElementById('qa-teacher-search').value = '';
      document.getElementById('qa-class-search').value = '';

      const selectedTeacherIds = existing
        ? (existing.teacher_ids_perm || '').split(',').map(x => x.trim()).filter(Boolean)
        : [String(id)];

      let selectedClassIds = [];
      if (existing) {
        selectedClassIds = (existing.class_ids_perm || '').split(',').map(x => x.trim()).filter(Boolean);
      } else {
        try {
          const slots = await api(`${API.timetable}?teacher_id=${id}`);
          selectedClassIds = [...new Set(slots.map(s => String(s.class_id)))];
        } catch { selectedClassIds = []; }
      }

      loadQATeacherList(selectedTeacherIds);
      loadQAClassList(selectedClassIds);
    }

    if (type === 'parent') {
      // Auto-detect students by parent CNIC, or load existing student_ids
      const parentRecord = (typeof _piData !== 'undefined' ? _piData : []).find(p => p.id == id);
      const parentCnic   = parentRecord ? parentRecord.father_cnic : null;
      const existingIds  = existing && existing.student_ids
        ? existing.student_ids.split(',').map(x => x.trim()).filter(Boolean)
        : [];
      await loadParentStudentList(existingIds, parentCnic, 'qa-parent-student-list', 'qa-parent-st-cb', 'qa-parent-st-item');
      const qaStuWrap = document.getElementById('qa-parent-students');
      if (qaStuWrap) qaStuWrap.style.display = '';
    }

    document.getElementById('quick-acct-footer').style.display = 'flex';
  } catch(e) {
    document.getElementById('quick-acct-loading').style.display = 'none';
    toast('Could not load user data', 'error');
    closeModal('quick-acct-modal-overlay');
  }
}

async function loadQATeacherList(selectedIds = []) {
  const list = document.getElementById('qa-teacher-list');
  try {
    const ts = await api(API.teachers);
    if (!ts.length) { list.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:8px">No teachers added yet.</p>'; return; }
    list.innerHTML = ts.map(t => {
      const displayTitle = normalizeTitle(t.title);
      return `
        <label style="display:flex;align-items:center;gap:10px;padding:6px 8px;border-radius:6px;cursor:pointer;font-size:0.88rem;transition:background 0.15s" onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background=''">
          <input type="checkbox" class="qa-teacher-cb" value="${t.id}" ${selectedIds.includes(String(t.id)) ? 'checked' : ''} style="accent-color:var(--accent);width:15px;height:15px;flex-shrink:0">
          <span class="badge ${t.title==='Sir'?'badge-blue':'badge-gold'}" style="font-size:0.75rem">${displayTitle}</span>
          ${t.name}
        </label>`;
    }).join('');
  } catch { list.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:8px">Could not load teachers.</p>'; }
}

async function loadQAClassList(selectedIds = []) {
  const list = document.getElementById('qa-class-list');
  try {
    const cs = await api(API.classes);
    if (!cs.length) { list.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:8px">No Data Found.</p>'; return; }
    list.innerHTML = cs.map(c => `
      <label style="display:flex;align-items:center;gap:10px;padding:6px 8px;border-radius:6px;cursor:pointer;font-size:0.88rem;transition:background 0.15s" onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background=''">
        <input type="checkbox" class="qa-class-cb" value="${c.id}" ${selectedIds.includes(String(c.id)) ? 'checked' : ''} style="accent-color:var(--accent);width:15px;height:15px;flex-shrink:0">
        <span class="badge badge-blue" style="font-size:0.75rem">&#128218;</span>
        ${c.name}
      </label>`).join('');
  } catch { list.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:8px">Could not load classes.</p>'; }
}

function qaToggleAdvanced() {
  const adv = document.getElementById('qa-advanced');
  const caret = document.getElementById('qa-advanced-caret');
  const isOpen = adv.style.display !== 'none';
  adv.style.display = isOpen ? 'none' : '';
  caret.innerHTML = isOpen ? '&#9660;' : '&#9650;';
}

function qaToggleParentStudents() {
  const body  = document.getElementById('qa-parent-students-body');
  const caret = document.getElementById('qa-parent-students-caret');
  const isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : '';
  caret.innerHTML = isOpen ? '&#9660;' : '&#9650;';
  // Hide the dropdown list when collapsing
  if (isOpen) {
    document.getElementById('qa-parent-student-list').style.display = 'none';
    const s = document.getElementById('qa-parent-student-search');
    if (s) s.value = '';
    filterQAParentStudentList('');
  }
}

function qaTogglePermsVisibility() {
  const role = document.getElementById('qa-role').value;
  document.getElementById('qa-perms-section').style.display = role === 'user' ? '' : 'none';
}

function toggleQuickPw(inputId, btnId) {
  const inp = document.getElementById(inputId);
  const btn = document.getElementById(btnId);
  if (!inp) return;
  if (inp.type === 'password') {
    inp.type = 'text';
    if (btn) btn.textContent = '\uD83D\uDE48';
  } else {
    inp.type = 'password';
    if (btn) btn.textContent = '\uD83D\uDC41';
  }
}

async function quickAcctSubmit() {
  const isExisting = !!_qaUserId;
  const errEl = document.getElementById('quick-acct-error');
  errEl.style.display = 'none';

  let username, password;
  if (isExisting) {
    username = document.getElementById('quick-acct-username-display').value.trim() || _qaExistingUser.username;
    password = document.getElementById('quick-acct-reset-pw').value;
    if (password && password.length < 6) {
      errEl.textContent = 'Password must be at least 6 characters.';
      errEl.style.display = 'flex';
      return;
    }
    // For student/parent with no changes, just close
    if ((_qaType === 'student' || _qaType === 'parent') && !password && username === _qaExistingUser.username) { closeModal('quick-acct-modal-overlay'); return; }
  } else {
    username = document.getElementById('quick-acct-username').value.trim();
    password = document.getElementById('quick-acct-password').value;
    if (!username) { errEl.textContent = 'Username is required.'; errEl.style.display = 'flex'; return; }
    if (!password) { errEl.textContent = 'Password is required.'; errEl.style.display = 'flex'; return; }
    if (password.length < 6) { errEl.textContent = 'Password must be at least 6 characters.'; errEl.style.display = 'flex'; return; }
  }

  let payload;
  if (_qaType === 'teacher') {
    const role       = document.getElementById('qa-role').value;
    const teacherIds = [...document.querySelectorAll('.qa-teacher-cb:checked')].map(cb => cb.value).join(',');
    const classIds   = [...document.querySelectorAll('.qa-class-cb:checked')].map(cb => cb.value).join(',');
    payload = {
      username,
      role,
      teacher_id:       role === 'user' ? _qaId : null,
      teacher_ids_perm: role === 'user' ? teacherIds : '',
      class_ids_perm:   role === 'user' ? classIds   : '',
    };
    if (password) payload.password = password;
  } else if (_qaType === 'parent') {
    const student_ids = [...document.querySelectorAll('.qa-parent-st-cb:checked')].map(cb => cb.value).join(',') || null;
    payload = {
      username,
      role: 'parent',
      parent_id:   _qaId,
      student_ids,
    };
    if (password) payload.password = password;
  } else {
    payload = {
      username,
      role: isExisting ? _qaExistingUser.role : 'student',
      student_id: _qaId,
    };
    if (password) payload.password = password;
  }

  try {
    if (isExisting) {
      await api(`${API.users}?id=${_qaUserId}`, 'PUT', payload);
      closeModal('quick-acct-modal-overlay');
      toast('Account updated successfully', 'success');
    } else {
      await api(API.users, 'POST', payload);
      closeModal('quick-acct-modal-overlay');
      toast('Account created successfully', 'success');
    }
    loadUsers();
  } catch(e) { errEl.textContent = e.message; errEl.style.display = 'flex'; }
}

function quickAcctDelete() {
  const label = _qaType === 'teacher' ? 'teacher account' : _qaType === 'parent' ? 'parent account' : 'student account';
  showPopupConfirm({
    title: 'Delete Account',
    msg: `Delete this ${label}? The person will no longer be able to log in.`,
    icon: '\uD83D\uDDD1\uFE0F',
    yesLabel: 'Delete',
    yesCls: 'btn-danger',
    onYes: async () => {
      try {
        await api(`${API.users}?id=${_qaUserId}`, 'DELETE');
        closeModal('quick-acct-modal-overlay');
        toast('Account deleted', 'success');
        loadUsers();
      } catch(e) { toast(e.message, 'error'); }
    }
  });
}

