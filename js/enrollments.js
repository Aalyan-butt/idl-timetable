// ===== CLASS ENROLLMENT =====
let _ceTab = 'all';

function setCETab(tab) {
  _ceTab = tab;
  ['all','assigned','unassigned'].forEach(t => {
    const btn = document.getElementById('ce-tab-' + t);
    if (!btn) return;
    const active = t === tab;
    btn.style.background     = active ? 'var(--accent)' : '';
    btn.style.color          = active ? '#05050e' : '';
    btn.style.borderColor    = active ? 'var(--accent)' : '';
  });
  renderClassEnrollment();
}

function loadClassEnrollment() {
  if (!_studentsCache.length) {
    // students not loaded yet — load them first
    loadStudents().then(() => renderClassEnrollment());
  } else {
    renderClassEnrollment();
  }
}

function filterClassEnrollment() { renderClassEnrollment(); }

// ── Single floating class-picker (shared across all rows) ──────────────────
(function() {
  if (document.getElementById('ce-float-picker')) return; // already exists
  const el = document.createElement('div');
  el.id = 'ce-float-picker';
  el.style.cssText = 'display:none;position:fixed;z-index:9999;background:var(--surface2);border:1px solid var(--border);border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.5);min-width:200px;overflow:hidden';
  el.innerHTML = `
    <div style="padding:8px 10px;border-bottom:1px solid var(--border)">
      <input id="ce-float-search" type="text" placeholder="Search class…" autocomplete="off"
        oninput="renderCEFloatList(this.value)"
        style="width:100%;padding:6px 10px;border-radius:6px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:0.85rem;box-sizing:border-box">
    </div>
    <div id="ce-float-list" style="max-height:200px;overflow-y:auto"></div>`;
  document.body.appendChild(el);

  document.addEventListener('mousedown', e => {
    const picker = document.getElementById('ce-float-picker');
    if (picker && !picker.contains(e.target) && !e.target.closest('.ce-trigger')) {
      picker.style.display = 'none';
    }
  });
})();

let _ceActiveSid = null;

function openCEPicker(sid) {
  _ceActiveSid = sid;
  const trigger = document.getElementById('ce-trigger-' + sid);
  const picker  = document.getElementById('ce-float-picker');
  if (!trigger || !picker) return;

  const rect = trigger.getBoundingClientRect();
  const pickerW = Math.max(rect.width, 220);
  let left = rect.left;
  if (left + pickerW > window.innerWidth - 8) left = window.innerWidth - pickerW - 8;
  picker.style.top   = (rect.bottom + 4) + 'px';
  picker.style.left  = left + 'px';
  picker.style.width = pickerW + 'px';
  picker.style.display = 'block';

  const searchEl = document.getElementById('ce-float-search');
  searchEl.value = '';
  renderCEFloatList('');
  setTimeout(() => searchEl.focus(), 50);
}

function renderCEFloatList(q) {
  const listEl = document.getElementById('ce-float-list');
  if (!listEl) return;
  const term = (q || '').trim().toLowerCase();
  const filtered = term ? classes.filter(c => c.name.toLowerCase().includes(term)) : classes;

  if (!filtered.length) {
    listEl.innerHTML = `<div style="padding:12px 14px;color:var(--text-muted);font-size:0.85rem">No classes found</div>`;
    return;
  }
  const sid = _ceActiveSid;
  listEl.innerHTML = filtered.map(c =>
    `<div onmousedown="selectCEClass(${sid},${c.id},'${escapeHtml(c.name).replace(/'/g,"&#39;")}')"
      style="padding:9px 14px;cursor:pointer;font-size:0.88rem;color:var(--text)"
      onmouseenter="this.style.background='rgba(201,168,76,0.12)'"
      onmouseleave="this.style.background=''">
      ${escapeHtml(c.name)}
    </div>`
  ).join('');
}

function selectCEClass(sid, classId, className) {
  if (!window._ceClassPicks) window._ceClassPicks = {};
  window._ceClassPicks[sid] = { id: classId, name: className };
  const trigger = document.getElementById('ce-trigger-' + sid);
  if (trigger) {
    trigger.querySelector('.ce-trigger-label').textContent = className;
    trigger.querySelector('.ce-trigger-label').style.color = 'var(--text)';
  }
  const picker = document.getElementById('ce-float-picker');
  if (picker) picker.style.display = 'none';
}

function renderClassEnrollment() {
  const body = document.getElementById('ce-body');
  if (!body) return;

  const q = (document.getElementById('ce-search')?.value || '').trim().toLowerCase();
  let list = (_studentsCache || []).slice();

  if (_ceTab === 'assigned')   list = list.filter(s => s.class_id && classes.find(c => c.id == s.class_id));
  if (_ceTab === 'unassigned') list = list.filter(s => !s.class_id || !classes.find(c => c.id == s.class_id));

  if (q) {
    list = list.filter(s => {
      const name = ((s.first_name||'') + ' ' + (s.last_name||'')).trim().toLowerCase() || (s.student_name||'').toLowerCase();
      return name.includes(q) || (s.gr_number||'').toLowerCase().includes(q) || (s.father_name||'').toLowerCase().includes(q);
    });
  }

  const cePerPage = parseInt(document.getElementById('ce-per-page')?.value ?? '0');
  const ceTotal = list.length;
  const countEl = document.getElementById('ce-count-label');
  if (countEl) countEl.textContent = ceTotal > 0 ? (cePerPage > 0 && ceTotal > cePerPage ? `Showing ${cePerPage} of ${ceTotal} students` : `${ceTotal} student${ceTotal !== 1 ? 's' : ''}`) : '';
  if (cePerPage > 0) list = list.slice(0, cePerPage);

  if (!list.length) {
    body.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:28px;color:var(--text-muted)">No students found.</td></tr>`;
    return;
  }

  if (!window._ceClassPicks) window._ceClassPicks = {};

  body.innerHTML = list.map((s, idx) => {
    const fullName = escapeHtml(((s.first_name||'') + ' ' + (s.last_name||'')).trim() || s.student_name || '—');
    const cls = classes.find(c => c.id == s.class_id);
    window._ceClassPicks[s.id] = cls ? { id: cls.id, name: cls.name } : null;
    const currentCls = cls
      ? `<span style="background:rgba(42,74,142,0.15);color:var(--accent);padding:2px 10px;border-radius:6px;font-size:0.83rem;font-weight:600">${escapeHtml(cls.name)}</span>`
      : `<span style="color:#7a8bbf;font-style:italic;font-size:0.83rem">Pre Admission Assessment</span>`;
    const pick = window._ceClassPicks[s.id];
    const label = pick ? escapeHtml(pick.name) : 'Pre Admission Assessment';
    const labelColor = pick ? 'var(--text)' : 'var(--text-muted)';

    return `<tr style="vertical-align:middle;font-size:0.9rem;text-align:center">
      <td style="padding:8px 6px;color:var(--text-muted);font-weight:600">${idx + 1}</td>
      <td style="padding:8px 6px;text-align:left;font-weight:600;color:var(--text)">${fullName}</td>
      <td style="padding:8px 6px;color:var(--accent);font-weight:700">${escapeHtml(s.gr_number || '—')}</td>
      <td style="padding:8px 6px;text-align:left;color:var(--text-muted)">${escapeHtml(s.father_name || '—')}</td>
      <td style="padding:8px 10px">
        <div style="display:flex;gap:6px;align-items:center;justify-content:center">
          <div class="ce-trigger" id="ce-trigger-${s.id}" onclick="openCEPicker(${s.id})"
            style="flex:1;max-width:190px;padding:6px 10px;border-radius:6px;border:1px solid var(--border);background:var(--surface2);cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:6px;user-select:none">
            <span class="ce-trigger-label" style="font-size:0.85rem;color:${labelColor};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${label}</span>
            <span style="font-size:0.7rem;color:var(--text-muted);flex-shrink:0">&#9660;</span>
          </div>
          <button onclick="saveEnrollment(${s.id})" style="background:#2a4a8e;color:#fff;border:none;border-radius:6px;padding:6px 14px;cursor:pointer;font-size:0.82rem;font-weight:700;white-space:nowrap;transition:opacity .15s" onmouseenter="this.style.opacity='.8'" onmouseleave="this.style.opacity='1'">
            &#10003; Save
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

async function saveEnrollment(studentId) {
  const pick    = window._ceClassPicks?.[studentId];
  const classId = pick ? pick.id : '';
  const student = _studentsCache.find(s => s.id == studentId);
  if (!student) return;

  try {
    await api(API.students, 'PUT', { ...student, id: studentId, class_id: classId });
    toast(classId ? 'Class assigned successfully' : 'Class removed');
    delete window._ceClassPicks[studentId]; // reset so it re-reads updated class
    await loadStudents();
    renderClassEnrollment();
    refreshStudentNotifBadge();
  } catch(e) {
    toast('Error: ' + e.message, true);
  }
}

// ===== SUBJECT ENROLLMENT =====
let _seSubjects = [];
let _seStudentsList = [];
let _seEnrollments = [];
let _seFilterMode = null;
let _seFilterSubjectId = null;
let _seFilterStudentId = null;
let _seSelectedStudents = [];   // [{id, name}] multi-select
let _seSelectedSubjects = [];   // [{id, name}] multi-select
let _seModalEnrolledIds = new Set();
let _seEditEnrollmentId = null;
let _seEditStudentId = null;
let _seEditSubjectId = null;

// Normalize subject name for deduplication (case + whitespace insensitive)
function _seNormSubject(name) {
  return (name || '').toLowerCase().trim().replace(/\s+/g, ' ');
}
function _seDeduplicateSubjects(list) {
  const seen = new Set();
  return list.filter(s => {
    const k = _seNormSubject(s.subject_name);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// Show a modal autocomplete list on mousedown
function _seModalInputMousedown(listId, event) {
  const el = document.getElementById(listId);
  if (el) el.style.display = '';
  const inputMap = {
    'se-student-list':      'se-student-search',
    'se-subject-list':      'se-subject-search',
    'se-edit-student-list': 'se-edit-student-search',
    'se-edit-subject-list': 'se-edit-subject-search'
  };
  const inputEl = document.getElementById(inputMap[listId]);
  // Clear edit-modal inputs on open so all results show (not filtered to current value)
  if ((listId === 'se-edit-student-list' || listId === 'se-edit-subject-list') && inputEl) {
    inputEl.value = '';
  }
  const q = inputEl ? inputEl.value : '';
  if (listId === 'se-student-list')      renderSEStudentList(q);
  if (listId === 'se-subject-list')      renderSESubjectList(q);
  if (listId === 'se-edit-student-list') renderSEEditStudentList(q);
  if (listId === 'se-edit-subject-list') renderSEEditSubjectList(q);
}

// Hide a modal autocomplete list when input loses focus (delay lets item clicks fire first)
function _seModalInputBlur(listId) {
  setTimeout(function() {
    const el = document.getElementById(listId);
    if (el) el.style.display = 'none';
  }, 280);
}

// Close page dropdowns on outside click
document.addEventListener('click', function(e) {
  if (!e.target.closest('#se-dd-subject')) seDDClose('subject');
  if (!e.target.closest('#se-dd-student')) seDDClose('student');
});

function seDDOpen(which) {
  const panel = document.getElementById(`se-dd-${which}-panel`);
  const other = which === 'subject' ? 'student' : 'subject';
  seDDClose(other);
  if (panel) panel.style.display = '';
  const q = document.getElementById(`se-dd-${which}-search`)?.value || '';
  if (which === 'subject') seRenderPageSubjects(q);
  else seRenderPageStudents(q);
}

function seDDClose(which) {
  const panel   = document.getElementById(`se-dd-${which}-panel`);
  const trigger = document.getElementById(`se-dd-${which}-trigger`);
  if (panel)   panel.style.display = 'none';
  if (trigger) trigger.classList.remove('open');
}

function _seSetDDLabel(which, text, hasValue) {
  const input = document.getElementById(`se-dd-${which}-search`);
  const tag   = document.getElementById(`se-dd-${which}-tag`);
  // Always keep input clear so user can type a new search immediately
  if (input) input.value = '';
  if (tag) {
    if (hasValue) {
      const clearFn = which === 'subject' ? 'seSelectPageSubject(null)' : 'seSelectPageStudent(null)';
      tag.style.display = '';
      tag.innerHTML = `<span class="se-tag" style="font-size:0.82rem">${escapeHtml(text)}&nbsp;<span class="se-tag-remove" onclick="event.stopPropagation();${clearFn}">&#10005;</span></span>`;
    } else {
      tag.style.display = 'none';
      tag.innerHTML = '';
    }
  }
}

async function loadSubjectEnrollment() {
  try {
    const [subs] = await Promise.all([
      api(`${API.subjectEnrollments}?action=all_subjects`),
      _studentsCache.length ? Promise.resolve() : loadStudents()
    ]);
    _seSubjects = subs;
    _seStudentsList = (_studentsCache || []).slice().sort((a,b) =>
      (a.student_name||'').localeCompare(b.student_name||''));

    if (_seFilterMode === 'subject' && _seFilterSubjectId) {
      const sub = _seSubjects.find(s => s.id == _seFilterSubjectId);
      if (sub) {
        _seSetDDLabel('subject', sub.subject_name, true);
        await _seLoadBySubject(_seFilterSubjectId);
      }
    } else if (_seFilterMode === 'student' && _seFilterStudentId) {
      const st = _seStudentsList.find(s => s.id == _seFilterStudentId);
      if (st) {
        _seSetDDLabel('student', st.student_name || '—', true);
        await _seLoadByStudent(_seFilterStudentId);
      }
    } else {
      await _seLoadAll();
    }
  } catch(e) {
    document.getElementById('se-enrollments-area').innerHTML =
      `<div class="card" style="text-align:center;padding:40px;color:var(--danger)">Error loading data: ${escapeHtml(e.message)}</div>`;
  }
}

function seRenderPageSubjects(q) {
  const ql = (q || '').toLowerCase().trim().replace(/\s+/g, ' ');
  const deduped = _seDeduplicateSubjects(_seSubjects);
  const filtered = ql
    ? deduped.filter(s => _seNormSubject(s.subject_name).includes(ql))
    : deduped;
  const container = document.getElementById('se-dd-subject-list');
  if (!container) return;
  if (!filtered.length) {
    container.innerHTML = '<div style="padding:12px;color:var(--text-muted);font-size:0.85rem;text-align:center">No subjects found</div>';
    return;
  }
  container.innerHTML = filtered.map(s => {
    const safeName = (s.subject_name||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    const isSel = s.id == _seFilterSubjectId;
    return `<div class="se-dd-item${isSel ? ' se-selected' : ''}" onclick="seSelectPageSubject(${s.id}, '${safeName}')">
      <div>${escapeHtml(s.subject_name)}</div>
    </div>`;
  }).join('');
}

function seRenderPageStudents(q) {
  const ql = (q || '').toLowerCase();
  const filtered = ql
    ? _seStudentsList.filter(s => (s.student_name||'').toLowerCase().includes(ql) || (s.gr_number||'').toLowerCase().includes(ql))
    : _seStudentsList;
  const container = document.getElementById('se-dd-student-list');
  if (!container) return;
  if (!filtered.length) {
    container.innerHTML = '<div style="padding:12px;color:var(--text-muted);font-size:0.85rem;text-align:center">No students found</div>';
    return;
  }
  container.innerHTML = filtered.map(s => {
    const safeName = (s.student_name||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    const isSel = s.id == _seFilterStudentId;
    return `<div class="se-dd-item${isSel ? ' se-selected' : ''}" onclick="seSelectPageStudent(${s.id}, '${safeName}')">
      <div>${escapeHtml(s.student_name || '—')}</div>
      ${s.gr_number ? `<div style="font-size:0.78rem;color:var(--text-muted)">GR: ${escapeHtml(s.gr_number)}</div>` : ''}
    </div>`;
  }).join('');
}

async function seSelectPageSubject(id, label) {
  if (id && _seFilterSubjectId == id) { id = null; label = null; }
  _seFilterSubjectId = id;
  _seFilterMode = id ? 'subject' : null;
  _seFilterStudentId = null;
  _seSetDDLabel('student', '\u2014 Search student \u2014', false);
  seDDClose('subject');
  seDDClose('student');
  if (id) {
    _seSetDDLabel('subject', label, true);
    await _seLoadBySubject(id);
  } else {
    _seSetDDLabel('subject', '\u2014 Search subject \u2014', false);
    _seEnrollments = [];
    document.getElementById('se-enrollments-area').innerHTML =
      '<div class="card" style="text-align:center;padding:40px;color:var(--text-muted)">Select a subject or student above to view enrollments.</div>';
  }
}

async function seSelectPageStudent(id, label) {
  if (id && _seFilterStudentId == id) { id = null; label = null; }
  _seFilterStudentId = id;
  _seFilterMode = id ? 'student' : null;
  _seFilterSubjectId = null;
  _seSetDDLabel('subject', '\u2014 Search subject \u2014', false);
  seDDClose('subject');
  seDDClose('student');
  if (id) {
    _seSetDDLabel('student', label, true);
    await _seLoadByStudent(id);
  } else {
    _seSetDDLabel('student', '\u2014 Search student \u2014', false);
    _seEnrollments = [];
    document.getElementById('se-enrollments-area').innerHTML =
      '<div class="card" style="text-align:center;padding:40px;color:var(--text-muted)">Select a subject or student above to view enrollments.</div>';
  }
}

async function _seLoadBySubject(subjectId) {
  document.getElementById('se-enrollments-area').innerHTML =
    '<div class="card" style="text-align:center;padding:32px;color:var(--text-muted)">Loading\u2026</div>';
  try {
    // Find all subject IDs whose normalized name matches the selected subject
    const selectedSub = _seSubjects.find(s => s.id == subjectId);
    const normKey = selectedSub ? _seNormSubject(selectedSub.subject_name) : null;
    const allMatchingIds = normKey
      ? _seSubjects.filter(s => _seNormSubject(s.subject_name) === normKey).map(s => s.id)
      : [subjectId];
    // Fetch enrollments for all matching IDs and merge (deduplicate by enrollment id)
    const results = await Promise.all(allMatchingIds.map(id => api(`${API.subjectEnrollments}?subject_id=${id}`)));
    const seen = new Set();
    _seEnrollments = results.flat().filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true; });
    _seRenderBySubject();
  } catch(e) {
    document.getElementById('se-enrollments-area').innerHTML =
      `<div class="card" style="text-align:center;padding:40px;color:var(--danger)">Error: ${escapeHtml(e.message)}</div>`;
  }
}

async function _seLoadByStudent(studentId) {
  document.getElementById('se-enrollments-area').innerHTML =
    '<div class="card" style="text-align:center;padding:32px;color:var(--text-muted)">Loading\u2026</div>';
  try {
    _seEnrollments = await api(`${API.subjectEnrollments}?student_id=${studentId}`);
    _seRenderByStudent();
  } catch(e) {
    document.getElementById('se-enrollments-area').innerHTML =
      `<div class="card" style="text-align:center;padding:40px;color:var(--danger)">Error: ${escapeHtml(e.message)}</div>`;
  }
}

async function _seReloadCurrent() {
  if (_seFilterMode === 'subject' && _seFilterSubjectId) await _seLoadBySubject(_seFilterSubjectId);
  else if (_seFilterMode === 'student' && _seFilterStudentId) await _seLoadByStudent(_seFilterStudentId);
  else await _seLoadAll();
}

async function _seLoadAll() {
  const area = document.getElementById('se-enrollments-area');
  area.innerHTML = '<div class="card" style="text-align:center;padding:32px;color:var(--text-muted)">Loading\u2026</div>';
  try {
    const data = await api(`${API.subjectEnrollments}?action=all_enrollments`);
    if (!data.length) {
      area.innerHTML = '<div class="card" style="text-align:center;padding:40px;color:var(--text-muted)">No enrollments found.</div>';
      return;
    }
    const isAdm = currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin');
    const actHdr = isAdm ? '<th>Actions</th>' : '';
    const rows = data.map((e, i) => {
      const dateStr = e.enrolled_at ? new Date(e.enrolled_at).toLocaleDateString('en-PK') : '\u2014';
      const actCell = isAdm
        ? `<td><div style="display:flex;gap:6px"><button class="btn btn-secondary btn-sm" onclick="openSEEditModal(${e.id})">Edit</button><button class="btn btn-danger btn-sm" onclick="deleteSEEnroll(${e.id})">Delete</button></div></td>`
        : '';
      return `<tr style="font-size:0.9rem">
        <td style="text-align:center;color:var(--text-muted);font-weight:600">${i + 1}</td>
        <td style="color:var(--accent);font-weight:700">${escapeHtml(e.gr_number || '\u2014')}</td>
        <td style="font-weight:600">${escapeHtml(e.student_name || '\u2014')}</td>
        <td style="color:var(--accent2)">${escapeHtml(e.subject_name || '\u2014')}</td>
        <td style="color:var(--text-muted)">${escapeHtml(e.father_name || '\u2014')}</td>
        <td>${escapeHtml(e.class_name || '\u2014')}</td>
        <td style="font-size:0.82rem;color:var(--text-muted)">${dateStr}</td>
        ${actCell}
      </tr>`;
    }).join('');
    area.innerHTML = `<div class="card">
      <div style="margin-bottom:10px;font-size:0.85rem;color:var(--text-muted)">${data.length} enrollment${data.length !== 1 ? 's' : ''} total</div>
      <div class="table-wrap"><table style="white-space:nowrap">
        <thead><tr><th>#</th><th>GR#</th><th>Student Name</th><th>Subject</th><th>Father Name</th><th>Class</th><th>Enrolled On</th>${actHdr}</tr></thead>
        <tbody id="se-body">${rows}</tbody>
      </table></div>
    </div>`;
  } catch(e) {
    area.innerHTML = `<div class="card" style="text-align:center;padding:40px;color:var(--danger)">Error: ${escapeHtml(e.message)}</div>`;
  }
}

function _seRenderBySubject() {
  const data = _seEnrollments;
  const area = document.getElementById('se-enrollments-area');
  if (!data.length) {
    area.innerHTML = '<div class="card" style="text-align:center;padding:40px;color:var(--text-muted)">No students enrolled in this subject.</div>';
    return;
  }
  const isAdm = currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin');
  const actHdr = isAdm ? '<th>Actions</th>' : '';
  const rows = data.map((e, i) => {
    const dateStr = e.enrolled_at ? new Date(e.enrolled_at).toLocaleDateString('en-PK') : '\u2014';
    const actCell = isAdm
      ? `<td><div style="display:flex;gap:6px"><button class="btn btn-secondary btn-sm" onclick="openSEEditModal(${e.id})">Edit</button><button class="btn btn-danger btn-sm" onclick="deleteSEEnroll(${e.id})">Delete</button></div></td>`
      : '';
    return `<tr style="font-size:0.9rem">
      <td style="text-align:center;color:var(--text-muted);font-weight:600">${i + 1}</td>
      <td style="color:var(--accent);font-weight:700">${escapeHtml(e.gr_number || '\u2014')}</td>
      <td style="font-weight:600">${escapeHtml(e.student_name)}</td>
      <td style="color:var(--text-muted)">${escapeHtml(e.father_name || '\u2014')}</td>
      <td>${escapeHtml(e.class_name || '\u2014')}</td>
      <td style="font-size:0.82rem;color:var(--text-muted)">${dateStr}</td>
      ${actCell}
    </tr>`;
  }).join('');
  area.innerHTML = `<div class="card">
    <div style="margin-bottom:10px;font-size:0.85rem;color:var(--text-muted)">${data.length} student${data.length !== 1 ? 's' : ''} enrolled</div>
    <div class="table-wrap"><table style="white-space:nowrap">
      <thead><tr><th>#</th><th>GR#</th><th>Student Name</th><th>Father Name</th><th>Class</th><th>Enrolled On</th>${actHdr}</tr></thead>
      <tbody id="se-body">${rows}</tbody>
    </table></div>
  </div>`;
}

function _seRenderByStudent() {
  const data = _seEnrollments;
  const area = document.getElementById('se-enrollments-area');
  const student = (_studentsCache||[]).find(s => s.id == _seFilterStudentId);
  const stName = student ? (student.student_name || 'this student') : 'this student';
  const studentClass = student ? ((classes||[]).find(c => c.id == student.class_id)?.name || '\u2014') : '\u2014';
  if (!data.length) {
    area.innerHTML = `<div class="card" style="text-align:center;padding:40px;color:var(--text-muted)">${escapeHtml(stName)} is not enrolled in any subjects.</div>`;
    return;
  }
  const isAdm = currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin');
  const actHdr = isAdm ? '<th>Actions</th>' : '';
  const rows = data.map((e, i) => {
    const dateStr = e.enrolled_at ? new Date(e.enrolled_at).toLocaleDateString('en-PK') : '\u2014';
    const actCell = isAdm
      ? `<td><div style="display:flex;gap:6px"><button class="btn btn-secondary btn-sm" onclick="openSEEditModal(${e.id})">Edit</button><button class="btn btn-danger btn-sm" onclick="deleteSEEnroll(${e.id})">Delete</button></div></td>`
      : '';
    return `<tr style="font-size:0.9rem">
      <td style="text-align:center;color:var(--text-muted);font-weight:600">${i + 1}</td>
      <td style="font-weight:600;color:var(--accent)">${escapeHtml(e.subject_name)}</td>
      <td>${escapeHtml(studentClass)}</td>
      <td style="font-size:0.82rem;color:var(--text-muted)">${dateStr}</td>
      ${actCell}
    </tr>`;
  }).join('');
  area.innerHTML = `<div class="card">
    <div style="margin-bottom:10px;font-size:0.85rem;color:var(--text-muted)">${escapeHtml(stName)} is enrolled in ${data.length} subject${data.length !== 1 ? 's' : ''}</div>
    <div class="table-wrap"><table style="white-space:nowrap">
      <thead><tr><th>#</th><th>Subject</th><th>Class</th><th>Enrolled On</th>${actHdr}</tr></thead>
      <tbody id="se-body">${rows}</tbody>
    </table></div>
  </div>`;
}

// -- Enroll modal helpers ----------------------------------------------------
function _seRenderEnrollTags(which) {
  const wrap  = document.getElementById(`se-${which}-tag-wrap`);
  const input = document.getElementById(`se-${which}-search`);
  if (!wrap || !input) return;
  wrap.querySelectorAll('.se-tag').forEach(t => t.remove());
  const list = which === 'student' ? _seSelectedStudents : _seSelectedSubjects;
  list.forEach(item => {
    const tag = document.createElement('span');
    tag.className = 'se-tag';
    tag.innerHTML = `${escapeHtml(item.name)}&nbsp;<span class="se-tag-remove" onmousedown="event.preventDefault();_seRemoveEnrollTag('${which}',${item.id})">&#10005;</span>`;
    wrap.insertBefore(tag, input);
  });
}

function _seRemoveEnrollTag(which, id) {
  if (which === 'student') {
    _seSelectedStudents = _seSelectedStudents.filter(s => s.id !== id);
  } else {
    _seSelectedSubjects = _seSelectedSubjects.filter(s => s.id !== id);
  }
  _seRenderEnrollTags(which);
  if (which === 'student') renderSEStudentList(document.getElementById('se-student-search').value || '');
  else renderSESubjectList(document.getElementById('se-subject-search').value || '');
}

// -- Enroll modal ------------------------------------------------------------
function openSEEnrollModal() {
  _seSelectedStudents = [];
  _seSelectedSubjects = [];
  _seModalEnrolledIds = new Set();
  document.getElementById('se-student-search').value = '';
  document.getElementById('se-subject-search').value = '';
  document.getElementById('se-student-list').style.display = 'none';
  document.getElementById('se-subject-list').style.display = 'none';
  document.getElementById('se-student-tag-wrap').querySelectorAll('.se-tag').forEach(t => t.remove());
  document.getElementById('se-subject-tag-wrap').querySelectorAll('.se-tag').forEach(t => t.remove());
  document.getElementById('se-enroll-error').style.display = 'none';
  renderSEStudentList('');
  renderSESubjectList('');
  openModal('se-enroll-modal-overlay');
}

function renderSEStudentList(q) {
  q = (q || '').toLowerCase().trim();
  let list = (_studentsCache || []);
  if (q) list = list.filter(s =>
    (s.student_name||'').toLowerCase().includes(q) ||
    (s.gr_number||'').toLowerCase().includes(q) ||
    (s.father_name||'').toLowerCase().includes(q)
  );
  list = list.slice(0, 60);
  const container = document.getElementById('se-student-list');
  if (!list.length) {
    container.innerHTML = '<div style="padding:12px;color:var(--text-muted);font-size:0.85rem;text-align:center">No students found</div>';
    return;
  }
  container.innerHTML = list.map(s => {
    const safe  = (s.student_name||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    const isSel = _seSelectedStudents.some(x => x.id === s.id);
    const cls   = (classes||[]).find(c => c.id == s.class_id);
    return `<div onclick="event.stopPropagation();selectSEStudent(${s.id}, '${safe}')"
      style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);font-size:0.88rem${isSel ? ';background:rgba(42,74,142,0.15)' : ''}"
      onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='${isSel ? 'rgba(42,74,142,0.15)' : ''}'">
      <div style="font-weight:600${isSel ? ';color:var(--accent)' : ''}">${escapeHtml(s.student_name||'\u2014')}${isSel ? ' \u2713' : ''}</div>
      <div style="color:var(--text-muted);font-size:0.78rem">GR: ${escapeHtml(s.gr_number||'\u2014')}${cls ? ' &nbsp;|&nbsp; ' + escapeHtml(cls.name) : ''}</div>
    </div>`;
  }).join('');
}

function renderSESubjectList(q) {
  q = (q || '').toLowerCase().trim().replace(/\s+/g, ' ');
  let list = _seDeduplicateSubjects(_seSubjects);
  if (q) list = list.filter(s => _seNormSubject(s.subject_name).includes(q));
  list = list.slice(0, 80);
  const container = document.getElementById('se-subject-list');
  if (!list.length) {
    container.innerHTML = '<div style="padding:12px;color:var(--text-muted);font-size:0.85rem;text-align:center">No subjects found</div>';
    return;
  }
  container.innerHTML = list.map(s => {
    const safe  = (s.subject_name||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    const isSel = _seSelectedSubjects.some(x => x.id === s.id);
    return `<div onclick="event.stopPropagation();selectSESubject(${s.id}, '${safe}')"
      style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);font-size:0.88rem${isSel ? ';background:rgba(42,74,142,0.15)' : ''}"
      onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='${isSel ? 'rgba(42,74,142,0.15)' : ''}'">
      <div style="font-weight:600${isSel ? ';color:var(--accent)' : ''}">${escapeHtml(s.subject_name)}${isSel ? ' \u2713' : ''}</div>
    </div>`;
  }).join('');
}

function selectSEStudent(id, name) {
  if (!_seSelectedStudents.some(s => s.id === id)) {
    _seSelectedStudents.push({ id, name });
    _seRenderEnrollTags('student');
  }
  document.getElementById('se-student-search').value = '';
  document.getElementById('se-student-list').style.display = 'none';
  document.getElementById('se-enroll-error').style.display = 'none';
  renderSEStudentList('');
}

function selectSESubject(id, name) {
  if (!_seSelectedSubjects.some(s => s.id === id)) {
    _seSelectedSubjects.push({ id, name });
    _seRenderEnrollTags('subject');
  }
  document.getElementById('se-subject-search').value = '';
  document.getElementById('se-subject-list').style.display = 'none';
  document.getElementById('se-enroll-error').style.display = 'none';
  renderSESubjectList('');
}

async function saveSEEnroll() {
  const err = document.getElementById('se-enroll-error');
  if (!_seSelectedStudents.length) { err.textContent = 'Please select at least one student.'; err.style.display = ''; return; }
  if (!_seSelectedSubjects.length) { err.textContent = 'Please select at least one subject.';  err.style.display = ''; return; }
  try {
    let enrolled = 0, skipped = 0;
    for (const student of _seSelectedStudents) {
      for (const subject of _seSelectedSubjects) {
        try {
          await api(API.subjectEnrollments, 'POST', { subject_id: subject.id, student_id: student.id });
          enrolled++;
        } catch(e) {
          if (e.message && e.message.toLowerCase().includes('already enrolled')) skipped++;
          else throw e;
        }
      }
    }
    closeModal('se-enroll-modal-overlay');
    toast(skipped ? `Enrolled ${enrolled}, skipped ${skipped} duplicate(s)` : `Enrolled successfully`);
    await _seReloadCurrent();
  } catch(e) {
    err.textContent = 'Error: ' + e.message;
    err.style.display = '';
  }
}

// -- Edit enrollment ---------------------------------------------------------
function renderSEEditStudentList(q) {
  q = (q || '').toLowerCase().trim();
  let list = (_studentsCache || []);
  if (q) list = list.filter(s =>
    (s.student_name||'').toLowerCase().includes(q) ||
    (s.gr_number||'').toLowerCase().includes(q) ||
    (s.father_name||'').toLowerCase().includes(q)
  );
  list = list.slice(0, 60);
  const container = document.getElementById('se-edit-student-list');
  if (!container) return;
  if (!list.length) {
    container.innerHTML = '<div style="padding:12px;color:var(--text-muted);font-size:0.85rem;text-align:center">No students found</div>';
    return;
  }
  container.innerHTML = list.map(s => {
    const safe = (s.student_name||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    const isSel = s.id === _seEditStudentId;
    const cls = (classes||[]).find(c => c.id == s.class_id);
    return `<div onclick="event.stopPropagation();selectSEEditStudent(${s.id}, '${safe}')"
      style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);font-size:0.88rem${isSel ? ';background:rgba(42,74,142,0.15)' : ''}"
      onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='${isSel ? 'rgba(42,74,142,0.15)' : ''}'">
      <div style="font-weight:600${isSel ? ';color:var(--accent)' : ''}">${escapeHtml(s.student_name||'—')}${isSel ? ' \u2713' : ''}</div>
      <div style="color:var(--text-muted);font-size:0.78rem">GR: ${escapeHtml(s.gr_number||'—')}${cls ? ' &nbsp;|&nbsp; ' + escapeHtml(cls.name) : ''}</div>
    </div>`;
  }).join('');
}

function renderSEEditSubjectList(q) {
  q = (q || '').toLowerCase().trim().replace(/\s+/g, ' ');
  let list = _seDeduplicateSubjects(_seSubjects);
  if (q) list = list.filter(s => _seNormSubject(s.subject_name).includes(q));
  list = list.slice(0, 80);
  const container = document.getElementById('se-edit-subject-list');
  if (!container) return;
  if (!list.length) {
    container.innerHTML = '<div style="padding:12px;color:var(--text-muted);font-size:0.85rem;text-align:center">No subjects found</div>';
    return;
  }
  container.innerHTML = list.map(s => {
    const safe = (s.subject_name||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    const isSel = s.id == _seEditSubjectId;
    return `<div onclick="event.stopPropagation();selectSEEditSubject(${s.id}, '${safe}')"
      style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);font-size:0.88rem${isSel ? ';background:rgba(42,74,142,0.15)' : ''}"
      onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='${isSel ? 'rgba(42,74,142,0.15)' : ''}'">
      <div style="font-weight:600${isSel ? ';color:var(--accent)' : ''}">${escapeHtml(s.subject_name)}${isSel ? ' \u2713' : ''}</div>
    </div>`;
  }).join('');
}

function selectSEEditStudent(id, name) {
  _seEditStudentId = id;
  document.getElementById('se-edit-student-search').value = name;
  document.getElementById('se-edit-student-list').style.display = 'none';
  document.getElementById('se-edit-error').style.display = 'none';
}

function selectSEEditSubject(id, name) {
  _seEditSubjectId = id;
  document.getElementById('se-edit-subject-search').value = name;
  document.getElementById('se-edit-subject-list').style.display = 'none';
  document.getElementById('se-edit-error').style.display = 'none';
}

function openSEEditModal(enrollmentId) {
  const enrollment = _seEnrollments.find(e => e.id == enrollmentId);
  if (!enrollment) return;
  _seEditEnrollmentId = enrollmentId;
  _seEditStudentId = enrollment.student_id;
  _seEditSubjectId = enrollment.subject_id;
  const st = (_studentsCache||[]).find(s => s.id == enrollment.student_id);
  const studentName = enrollment.student_name || (st ? st.student_name : '') || `Student #${enrollment.student_id}`;
  const sub = _seSubjects.find(s => s.id == enrollment.subject_id);
  const subjectName = sub ? sub.subject_name : '';
  document.getElementById('se-edit-student-search').value = studentName;
  document.getElementById('se-edit-subject-search').value = subjectName;
  document.getElementById('se-edit-student-list').style.display = 'none';
  document.getElementById('se-edit-subject-list').style.display = 'none';
  document.getElementById('se-edit-error').style.display = 'none';
  renderSEEditStudentList('');
  renderSEEditSubjectList('');
  openModal('se-edit-modal-overlay');
}

async function saveSEEdit() {
  const err = document.getElementById('se-edit-error');
  if (!_seEditStudentId) { err.textContent = 'Please select a student.'; err.style.display = ''; return; }
  if (!_seEditSubjectId) { err.textContent = 'Please select a subject.';  err.style.display = ''; return; }
  const enrollment = _seEnrollments.find(e => e.id == _seEditEnrollmentId);
  const studentChanged = enrollment && enrollment.student_id != _seEditStudentId;
  try {
    if (studentChanged) {
      // Delete old + create new when student changes
      await api(`${API.subjectEnrollments}?id=${_seEditEnrollmentId}`, 'DELETE');
      await api(API.subjectEnrollments, 'POST', { subject_id: _seEditSubjectId, student_id: _seEditStudentId });
    } else {
      await api(API.subjectEnrollments, 'PUT', { id: _seEditEnrollmentId, subject_id: _seEditSubjectId });
    }
    closeModal('se-edit-modal-overlay');
    toast('Enrollment updated');
    await _seReloadCurrent();
  } catch(e) {
    err.textContent = 'Error: ' + e.message;
    err.style.display = '';
  }
}

async function deleteSEEnroll(id) {
  const enrollment = _seEnrollments.find(e => e.id == id);
  const label = enrollment ? (enrollment.student_name || enrollment.subject_name || 'this entry') : 'this entry';
  if (!confirm(`Remove ${label} from this enrollment?`)) return;
  try {
    await api(`${API.subjectEnrollments}?id=${id}`, 'DELETE');
    toast('Enrollment removed');
    await _seReloadCurrent();
  } catch(e) {
    toast('Error: ' + e.message, true);
  }
}

checkAuth();
tmAttachDraftListeners();
