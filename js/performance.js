// ===== STUDENT PERFORMANCE — PERFORMANCE TESTS =====

var _ptData = [];

const PT_COLS = [
  { key: 'col-pt-sr',       label: 'Sr.#',          def: true  },
  { key: 'col-pt-name',     label: 'Test Name',      def: true  },
  { key: 'col-pt-status',   label: 'Status',         def: true  },
  { key: 'col-pt-date',     label: 'Test Date',      def: true  },
  { key: 'col-pt-deadline', label: 'Entry Deadline', def: false },
  { key: 'col-pt-class',    label: 'Class',          def: true  },
  { key: 'col-pt-subject',  label: 'Subject',        def: true  },
  { key: 'col-pt-marks',    label: 'Marks',          def: true  },
  { key: 'col-pt-teacher',  label: 'Teacher',        def: true  },
  { key: 'col-pt-coverage', label: 'Coverage',       def: false },
  { key: 'col-pt-created',  label: 'Created',        def: false },
  { key: 'col-pt-actions',  label: 'Actions',        def: true  },
];

var _ptColState = {};

async function loadPerformanceTests() {
  try {
    const data = await api(API.performanceTests);
    _ptData = Array.isArray(data) ? data : [];
    _initPTColFilter();
    _populatePTFilters();
    filterPerformanceTests();
  } catch(e) { toast(e.message, 'error'); }
}

function _initPTColFilter() {
  const wrap = document.getElementById('pt-col-checkboxes');
  if (!wrap) return;
  if (wrap.dataset.init) { return; }
  wrap.dataset.init = '1';
  PT_COLS.forEach(c => {
    if (_ptColState[c.key] === undefined) _ptColState[c.key] = c.def;
    const lbl = document.createElement('label');
    lbl.style.cssText = 'display:flex;align-items:center;gap:5px;font-size:0.82rem;cursor:pointer;user-select:none';
    lbl.innerHTML = `<input type="checkbox" ${_ptColState[c.key] ? 'checked' : ''} onchange="togglePTCol('${c.key}',this.checked)"> ${c.label}`;
    wrap.appendChild(lbl);
  });
  _applyPTColVisibility();
}

function togglePTCol(key, visible) {
  _ptColState[key] = visible;
  _applyPTColVisibility();
}

function _applyPTColVisibility() {
  PT_COLS.forEach(c => {
    document.querySelectorAll(`[data-col="${c.key}"]`).forEach(el => {
      el.style.display = _ptColState[c.key] ? '' : 'none';
    });
  });
}

function setAllPTCols(val) {
  PT_COLS.forEach(c => { _ptColState[c.key] = val; });
  document.querySelectorAll('#pt-col-checkboxes input[type=checkbox]').forEach(cb => cb.checked = val);
  _applyPTColVisibility();
}

function togglePTFilterPanel() {
  const body  = document.getElementById('pt-col-filter-body');
  const caret = document.getElementById('pt-filter-caret');
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : '';
  if (caret) caret.textContent = open ? '▼' : '▲';
}

function _populatePTFilters() {
  const cf = document.getElementById('pt-filter-class');
  if (cf) {
    const seen = new Map();
    _ptData.forEach(t => { if (t.class_id && !seen.has(t.class_id)) seen.set(t.class_id, t.class_name); });
    cf.innerHTML = '<option value="">All Classes</option>' +
      [...seen.entries()].map(([id, name]) => `<option value="${id}">${escapeHtml(name||'')}</option>`).join('');
  }
  const sf = document.getElementById('pt-filter-subject');
  if (sf) {
    const seen = new Map();
    _ptData.forEach(t => { if (t.subject_id && !seen.has(t.subject_id)) seen.set(t.subject_id, t.subject_name); });
    sf.innerHTML = '<option value="">All Subjects</option>' +
      [...seen.entries()].map(([id, name]) => `<option value="${id}">${escapeHtml(name||'')}</option>`).join('');
  }
  const tf = document.getElementById('pt-filter-teacher');
  if (tf) {
    const seen = new Map();
    _ptData.forEach(t => { if (t.teacher_id && !seen.has(t.teacher_id)) seen.set(t.teacher_id, t.teacher_name); });
    tf.innerHTML = '<option value="">All Teachers</option>' +
      [...seen.entries()].map(([id, name]) => `<option value="${id}">${escapeHtml(name||'')}</option>`).join('');
  }
}

function searchPerformanceTests() { filterPerformanceTests(); }

function resetPTFilters() {
  ['pt-search-input','pt-filter-date-from','pt-filter-date-to'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  ['pt-filter-status','pt-filter-class','pt-filter-subject','pt-filter-teacher'].forEach(id => {
    const el = document.getElementById(id); if (el) el.selectedIndex = 0;
  });
  filterPerformanceTests();
}

function filterPerformanceTests() {
  const search    = (document.getElementById('pt-search-input')?.value    || '').toLowerCase().trim();
  const status    = document.getElementById('pt-filter-status')?.value    || '';
  const classId   = document.getElementById('pt-filter-class')?.value     || '';
  const subjectId = document.getElementById('pt-filter-subject')?.value   || '';
  const teacherId = document.getElementById('pt-filter-teacher')?.value   || '';
  const dateFrom  = document.getElementById('pt-filter-date-from')?.value || '';
  const dateTo    = document.getElementById('pt-filter-date-to')?.value   || '';

  let rows = _ptData.filter(t => {
    if (search) {
      const hay = [t.test_name, t.class_name, t.subject_name, t.teacher_name]
        .map(v => (v || '').toLowerCase()).join(' ');
      if (!hay.includes(search)) return false;
    }
    if (status    && t.status              !== status)            return false;
    if (classId   && String(t.class_id)   !== classId)           return false;
    if (subjectId && String(t.subject_id) !== subjectId)         return false;
    if (teacherId && String(t.teacher_id) !== teacherId)         return false;
    if (dateFrom  && t.test_date && t.test_date < dateFrom)      return false;
    if (dateTo    && t.test_date && t.test_date > dateTo)        return false;
    return true;
  });

  const perPage = parseInt(document.getElementById('pt-per-page')?.value || '25');
  const lbl = document.getElementById('pt-count-label');
  if (lbl) lbl.textContent = `${rows.length} record${rows.length !== 1 ? 's' : ''}`;

  _renderPTTable(perPage > 0 ? rows.slice(0, perPage) : rows);
}

function _renderPTTable(rows) {
  const tbody = document.getElementById('pt-body');
  if (!tbody) return;
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="12" style="text-align:center;padding:28px;color:var(--text-muted)">No Data Found</td></tr>`;
    _applyPTColVisibility();
    return;
  }
  tbody.innerHTML = rows.map((t, i) => `
    <tr>
      <td data-col="col-pt-sr" style="min-width:48px">${i + 1}</td>
      <td data-col="col-pt-name" style="font-weight:600;min-width:160px">${escapeHtml(t.test_name)}</td>
      <td data-col="col-pt-status">${_ptStatusBadge(t.status)}</td>
      <td data-col="col-pt-date">${t.test_date ? t.test_date.substring(0,10) : '—'}</td>
      <td data-col="col-pt-deadline">${t.marks_entry_deadline ? t.marks_entry_deadline.substring(0,10) : '—'}</td>
      <td data-col="col-pt-class">${escapeHtml(t.class_name   || '—')}</td>
      <td data-col="col-pt-subject">${escapeHtml(t.subject_name || '—')}</td>
      <td data-col="col-pt-marks">${t.total_marks != null ? t.total_marks : '—'}</td>
      <td data-col="col-pt-teacher">${escapeHtml(t.teacher_name || '—')}</td>
      <td data-col="col-pt-coverage" style="max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(t.coverage_details || '—')}</td>
      <td data-col="col-pt-created">${t.created_at ? t.created_at.substring(0,10) : '—'}</td>
      <td data-col="col-pt-actions">
        <div style="display:flex;gap:6px">
          <button class="btn btn-secondary" style="padding:4px 10px;font-size:0.78rem" onclick="editPerformanceTest(${t.id})">Edit</button>
          <button class="btn" style="padding:4px 10px;font-size:0.78rem;background:rgba(255,85,85,0.15);color:#ff5555;border:1px solid rgba(255,85,85,0.3)" onclick="deletePerformanceTest(${t.id},'${escapeHtml(t.test_name).replace(/'/g,"\\'")}')">Del</button>
        </div>
      </td>
    </tr>`).join('');
  _applyPTColVisibility();
}

function _ptStatusBadge(status) {
  const map = {
    'Empty':      ['rgba(144,144,184,0.12)', '#9090b8'],
    'Incomplete': ['rgba(255,165,0,0.14)',   '#ffaa44'],
    'Done':       ['rgba(68,204,136,0.14)',  '#44cc88'],
  };
  const [bg, color] = map[status] || map['Empty'];
  return `<span style="background:${bg};color:${color};padding:2px 10px;border-radius:12px;font-size:0.78rem;font-weight:600;white-space:nowrap">${escapeHtml(status || 'Empty')}</span>`;
}

// ===== ADD / EDIT MODAL =====

function openPTModal(id) {
  document.getElementById('pt-modal-error').style.display = 'none';
  document.getElementById('pt-modal-subject-error').style.display = 'none';
  document.getElementById('pt-modal-id').value = id || '';
  document.getElementById('pt-modal-title').textContent = id ? 'Edit Performance Test' : 'Add Performance Test';

  const classSelect = document.getElementById('pt-modal-class');
  classSelect.innerHTML = '<option value="">Select Class</option>' +
    (classes || []).map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');

  const teacherSelect = document.getElementById('pt-modal-teacher');
  teacherSelect.innerHTML = '<option value="">Select Teacher</option>' +
    (teachers || []).map(t => `<option value="${t.id}">${escapeHtml((t.title||'') + ' ' + (t.name||''))}</option>`).join('');

  if (id) {
    const t = _ptData.find(x => x.id == id);
    if (t) {
      document.getElementById('pt-modal-name').value     = t.test_name || '';
      document.getElementById('pt-modal-date').value     = t.test_date ? t.test_date.substring(0,10) : '';
      document.getElementById('pt-modal-deadline').value = t.marks_entry_deadline ? t.marks_entry_deadline.substring(0,10) : '';
      document.getElementById('pt-modal-marks').value    = t.total_marks != null ? t.total_marks : '';
      document.getElementById('pt-modal-coverage').value = t.coverage_details || '';
      document.getElementById('pt-modal-notify').checked = !!t.notify_teacher;
      document.getElementById('pt-modal-status').value   = t.status || 'Empty';
      if (t.class_id) { classSelect.value = t.class_id; _loadPTSubjects(t.class_id, t.subject_id); }
      else             _clearPTSubjects();
      if (t.teacher_id) teacherSelect.value = t.teacher_id;
    }
  } else {
    document.getElementById('pt-modal-name').value     = '';
    document.getElementById('pt-modal-date').value     = '';
    document.getElementById('pt-modal-deadline').value = '';
    document.getElementById('pt-modal-marks').value    = '';
    document.getElementById('pt-modal-coverage').value = '';
    document.getElementById('pt-modal-notify').checked = false;
    document.getElementById('pt-modal-status').value   = 'Empty';
    _clearPTSubjects();
  }
  openModal('pt-modal-overlay');
  // Hook subject dropdown click AFTER makeSearchable runs (10ms delay inside openModal)
  setTimeout(() => {
    const subjWrapper = document.getElementById('pt-modal-subject')?.closest('.ss-wrapper');
    if (subjWrapper && !subjWrapper.dataset.ptHooked) {
      subjWrapper.dataset.ptHooked = '1';
      subjWrapper.querySelector('.ss-display')?.addEventListener('click', e => {
        if (!document.getElementById('pt-modal-class')?.value) {
          e.stopImmediatePropagation();
          document.getElementById('pt-modal-subject-error').style.display = '';
        } else {
          document.getElementById('pt-modal-subject-error').style.display = 'none';
        }
      }, true); // capture = true so it runs before makeSearchable's listener
    }
  }, 50);
}

function _clearPTSubjects() {
  document.getElementById('pt-modal-subject').innerHTML = '<option value="">Select Subject</option>';
}

async function _loadPTSubjects(classId, selectedId) {
  const sel = document.getElementById('pt-modal-subject');
  sel.innerHTML = '<option value="">Loading…</option>';
  try {
    const data = await api(`${API.subjects}?class_id=${classId}`);
    sel.innerHTML = '<option value="">Select Subject</option>' +
      (Array.isArray(data) ? data : []).map(s =>
        `<option value="${s.id}"${s.id == selectedId ? ' selected' : ''}>${escapeHtml(s.subject_name)}</option>`
      ).join('');
  } catch(e) { _clearPTSubjects(); }
}


function onPTSubjectChange(subjectId) {
  document.getElementById('pt-modal-subject-error').style.display = 'none';
  if (!subjectId) return;
  const classId = document.getElementById('pt-modal-class')?.value;
  if (!classId) return;
  _autoSelectPTTeacher(classId, subjectId);
}

function onPTClassChange(classId) {
  document.getElementById('pt-modal-subject-error').style.display = 'none';
  if (classId) _loadPTSubjects(classId, null);
  else _clearPTSubjects();
}

function _autoSelectPTTeacher(classId, subjectId) {
  // Find subject name from the subject select options
  const subjSel = document.getElementById('pt-modal-subject');
  const subjectName = subjSel?.options[subjSel.selectedIndex]?.text?.toLowerCase() || '';
  if (!subjectName) return;

  // Search timetableSlots (globally loaded) for matching class+subject
  const matchingSlots = (timetableSlots || []).filter(s =>
    String(s.class_id) === String(classId) &&
    !s.is_break &&
    (s.subject || '').toLowerCase() === subjectName
  );

  if (!matchingSlots.length) return;

  // Collect all unique teacher IDs from matching slots
  const teacherIdSet = new Set();
  matchingSlots.forEach(s => {
    (s.teacher_ids || String(s.teacher_id || '')).split(',').forEach(id => {
      const tid = id.trim();
      if (tid && tid !== '0') teacherIdSet.add(tid);
    });
  });

  if (!teacherIdSet.size) return;

  // Auto-select the first teacher found in the dropdown
  const teacherSel = document.getElementById('pt-modal-teacher');
  for (const opt of teacherSel.options) {
    if (teacherIdSet.has(String(opt.value))) {
      teacherSel.value = opt.value;
      // Refresh the custom searchable display
      const wrapper = teacherSel.closest('.ss-wrapper');
      if (wrapper?._ssRefresh) wrapper._ssRefresh();
      break;
    }
  }
}

async function savePT() {
  const errEl = document.getElementById('pt-modal-error');
  errEl.style.display = 'none';
  const id = document.getElementById('pt-modal-id').value;

  const body = {
    test_name:            document.getElementById('pt-modal-name').value.trim(),
    test_date:            document.getElementById('pt-modal-date').value     || null,
    marks_entry_deadline: document.getElementById('pt-modal-deadline').value || null,
    total_marks:          document.getElementById('pt-modal-marks').value    || null,
    class_id:             document.getElementById('pt-modal-class').value    || null,
    subject_id:           document.getElementById('pt-modal-subject').value  || null,
    teacher_id:           document.getElementById('pt-modal-teacher').value  || null,
    notify_teacher:       document.getElementById('pt-modal-notify').checked ? 1 : 0,
    coverage_details:     document.getElementById('pt-modal-coverage').value.trim(),
    status:               document.getElementById('pt-modal-status').value   || 'Empty',
  };

  if (!body.test_name) {
    errEl.textContent = 'Test name is required.';
    errEl.style.display = '';
    return;
  }
  try {
    if (id) {
      await api(`${API.performanceTests}?id=${id}`, 'PUT', body);
      toast('Test updated');
    } else {
      await api(API.performanceTests, 'POST', body);
      toast('Test added');
    }
    closeModal('pt-modal-overlay');
    loadPerformanceTests();
  } catch(e) {
    errEl.textContent = e.message;
    errEl.style.display = '';
  }
}

function editPerformanceTest(id) { openPTModal(id); }

async function deletePerformanceTest(id, name) {
  if (!confirm(`Delete test "${name}"?\nThis cannot be undone.`)) return;
  try {
    await api(`${API.performanceTests}?id=${id}`, 'DELETE');
    toast('Test deleted');
    loadPerformanceTests();
  } catch(e) { toast(e.message, 'error'); }
}

// ===== PERFORMANCE MARKS =====

var _pmTestId   = null;
var _pmTestData = null;
var _pmStudents = [];

async function loadPerformanceMarks() {
  try {
    const tests = await api(API.performanceTests);
    _ptData = Array.isArray(tests) ? tests : _ptData;
    _pmBuildClassFilter(_ptData);
    _pmBuildTestList(_ptData);
  } catch(e) { toast(e.message, 'error'); }
}

function _pmFmtDate(dateStr) {
  if (!dateStr) return '—';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const p = (dateStr + '').substring(0, 10).split('-');
  return p.length === 3 ? `${p[2]}-${months[parseInt(p[1], 10) - 1]}-${p[0]}` : dateStr;
}

function _pmBuildClassFilter(tests) {
  const sel = document.getElementById('pm-class-filter');
  if (!sel) return;
  const seen = new Map();
  tests.forEach(t => { if (t.class_id && !seen.has(t.class_id)) seen.set(t.class_id, t.class_name); });
  sel.innerHTML = '<option value="">All Classes</option>' +
    [...seen.entries()].map(([id, name]) => `<option value="${id}">${escapeHtml(name || '')}</option>`).join('');
}

function _pmBuildTestList(tests) {
  const classFilter = document.getElementById('pm-class-filter')?.value || '';
  const filtered = classFilter ? tests.filter(t => String(t.class_id) === classFilter) : tests;
  const sel = document.getElementById('pm-test-select');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Select Test Name —</option>' +
    filtered.map(t => {
      const date  = _pmFmtDate(t.test_date);
      const label = `${t.test_name}  [${t.class_name || ''}]  [${t.subject_name || ''}]  [${t.status || 'Empty'}]  [${date}]`;
      return `<option value="${t.id}">${escapeHtml(label)}</option>`;
    }).join('');
  // If the current test is no longer in the filtered set, clear selection
  if (classFilter && _pmTestId && !filtered.find(t => t.id == _pmTestId)) pmSelectTest('');
}

function pmFilterTestList() {
  _pmBuildTestList(_ptData);
}

async function pmSelectTest(testId) {
  const infoEl   = document.getElementById('pm-test-info');
  const statsEl  = document.getElementById('pm-stats-card');
  const saveEl   = document.getElementById('pm-save-row');
  const totalEl  = document.getElementById('pm-total-marks-val');
  const tbody    = document.getElementById('pm-students-body');

  if (!testId) {
    _pmTestId = null; _pmTestData = null; _pmStudents = [];
    if (infoEl)  infoEl.style.display  = 'none';
    if (statsEl) statsEl.style.display = 'none';
    if (saveEl)  saveEl.style.display  = 'none';
    if (totalEl) totalEl.textContent   = '—';
    if (tbody)   tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:44px;color:var(--text-muted)">No Data Found</td></tr>`;
    pmApplyCols();
    return;
  }

  _pmTestId   = parseInt(testId);
  _pmTestData = (_ptData || []).find(t => t.id == testId) || null;

  if (_pmTestData) {
    document.getElementById('pm-info-date').textContent     = _pmFmtDate(_pmTestData.test_date);
    document.getElementById('pm-info-subject').textContent  = _pmTestData.subject_name  || '—';
    document.getElementById('pm-info-teacher').textContent  = _pmTestData.teacher_name  ? _pmTestData.teacher_name + ' (Teacher)' : '—';
    document.getElementById('pm-info-total').textContent    = _pmTestData.total_marks   != null ? _pmTestData.total_marks : '—';
    document.getElementById('pm-info-details').textContent  = _pmTestData.coverage_details || 'No test details provided.';
    document.getElementById('pm-stats-subject').textContent = _pmTestData.subject_name  || '';
    document.getElementById('pm-total-badge').textContent   = _pmTestData.total_marks   != null ? _pmTestData.total_marks : '—';
    if (totalEl) totalEl.textContent = _pmTestData.total_marks != null ? _pmTestData.total_marks : '—';
    if (infoEl)  infoEl.style.display = '';
  }

  if (statsEl) statsEl.style.display = '';
  if (saveEl)  saveEl.style.display  = '';
  if (tbody) tbody.innerHTML =
    '<tr><td colspan="8" style="text-align:center;padding:36px;color:var(--text-muted)">Loading…</td></tr>';

  const fillEl = document.getElementById('pm-fill-all');
  if (fillEl) fillEl.value = '';

  try {
    _pmStudents = await api(`${API.performanceMarks}?test_id=${testId}`);
    _pmRenderStudents();
  } catch(e) {
    document.getElementById('pm-students-body').innerHTML =
      `<tr><td colspan="8" style="text-align:center;padding:36px;color:#ff5555">${escapeHtml(e.message)}</td></tr>`;
    toast(e.message, 'error');
  }
}

function _pmRenderStudents() {
  const tbody = document.getElementById('pm-students-body');
  if (!tbody) return;
  if (!_pmStudents.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:44px;color:#555566">No students found in this class.</td></tr>';
    return;
  }
  const total = _pmTestData?.total_marks != null ? parseFloat(_pmTestData.total_marks) : null;

  tbody.innerHTML = _pmStudents.map((s, i) => {
    const obtained = s.marks_obtained != null ? s.marks_obtained : '';
    const isAbsent = !!parseInt(s.is_absent || 0);
    const isSkip   = !!parseInt(s.is_skip   || 0);
    const disabled = isAbsent || isSkip;
    const exceeds  = total !== null && obtained !== '' && parseFloat(obtained) > total;

    const photo = s.photo
      ? `<img src="${escapeHtml(s.photo)}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid rgba(201,162,39,0.4)">`
      : `<div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#c9a227,#8a6e10);display:inline-flex;align-items:center;justify-content:center;font-weight:700;color:#0e0e14;font-size:0.88rem">${escapeHtml((s.student_name || '?')[0].toUpperCase())}</div>`;

    const marksClass = `pm-marks-inp${exceeds ? ' pm-exceeds' : ''}`;

    return `<tr id="pm-row-${i}">
      <td style="min-width:44px;color:#555566;font-size:0.8rem">${i + 1}</td>
      <td class="pm-col-gr" style="min-width:72px"><span class="pm-gr-text">${escapeHtml(s.gr_number || '—')}</span></td>
      <td class="pm-col-photo" style="min-width:58px">${photo}</td>
      <td style="min-width:170px">
        <span class="pm-name-link" onclick="openStudentBio(${s.student_id})">${escapeHtml(s.student_name || '—')}</span>
      </td>
      <td style="min-width:130px">
        <input type="number" id="pm-marks-${i}" value="${escapeHtml(String(obtained))}"
          ${disabled ? 'disabled' : ''} min="0" ${total !== null ? `max="${total}"` : ''}
          class="${marksClass}" oninput="pmCheckExceeds(${i})">
      </td>
      <td class="pm-col-skip" style="min-width:64px;text-align:center">
        <input type="checkbox" id="pm-skip-${i}" ${isSkip ? 'checked' : ''}
          onchange="pmToggleSkip(${i},this.checked)" class="pm-cb">
      </td>
      <td class="pm-col-absent" style="min-width:74px;text-align:center">
        <input type="checkbox" id="pm-absent-${i}" ${isAbsent ? 'checked' : ''}
          onchange="pmToggleAbsent(${i},this.checked)" class="pm-cb pm-cb-absent">
      </td>
      <td class="pm-col-comment" style="min-width:200px">
        <textarea id="pm-comment-${i}" rows="2"
          placeholder="Write notes or comments here…"
          class="pm-comment-ta">${escapeHtml(s.comment || '')}</textarea>
      </td>
    </tr>`;
  }).join('');

  pmApplyCols();
}

function pmToggleAbsent(idx, checked) {
  const inp  = document.getElementById(`pm-marks-${idx}`);
  const skip = document.getElementById(`pm-skip-${idx}`);
  if (inp) {
    if (checked) { inp.value = ''; inp.classList.remove('pm-exceeds'); if (skip) skip.checked = false; }
    inp.disabled = checked;
  }
  pmCheckExceeds(idx);
}

function pmToggleSkip(idx, checked) {
  const inp = document.getElementById(`pm-marks-${idx}`);
  const abs = document.getElementById(`pm-absent-${idx}`);
  if (inp) {
    if (checked) { inp.value = ''; inp.classList.remove('pm-exceeds'); if (abs) abs.checked = false; }
    inp.disabled = checked;
  }
  pmCheckExceeds(idx);
}

function pmToggleAllAbsent(checked) {
  _pmStudents.forEach((_, i) => { const cb = document.getElementById(`pm-absent-${i}`); if (cb) { cb.checked = checked; pmToggleAbsent(i, checked); } });
}

function pmToggleAllSkip(checked) {
  _pmStudents.forEach((_, i) => { const cb = document.getElementById(`pm-skip-${i}`); if (cb) { cb.checked = checked; pmToggleSkip(i, checked); } });
}

function pmFillAll(value) {
  _pmStudents.forEach((_, i) => {
    const inp = document.getElementById(`pm-marks-${i}`);
    if (inp && !inp.disabled) { inp.value = value; pmCheckExceeds(i); }
  });
}

function pmCheckExceeds(idx) {
  const inp = document.getElementById(`pm-marks-${idx}`);
  const total = _pmTestData?.total_marks != null ? parseFloat(_pmTestData.total_marks) : null;
  if (!inp || total === null) return;
  const ex = inp.value !== '' && parseFloat(inp.value) > total;
  inp.classList.toggle('pm-exceeds', ex);
}

function pmShowRowWarn(idx) {
  const s   = _pmStudents[idx];
  const val = document.getElementById(`pm-marks-${idx}`)?.value;
  toast(`⚠ ${escapeHtml(s.student_name)}: ${val} exceeds total marks (${_pmTestData?.total_marks}).`, 'error');
}

function pmShowWarnings() {
  const total = _pmTestData?.total_marks != null ? parseFloat(_pmTestData.total_marks) : null;
  if (total === null) { toast('No test selected.', 'error'); return; }
  const issues = _pmStudents.reduce((acc, s, i) => {
    const inp = document.getElementById(`pm-marks-${i}`);
    if (inp && inp.value !== '' && parseFloat(inp.value) > total) acc.push(`${escapeHtml(s.student_name)}: ${inp.value}`);
    return acc;
  }, []);
  if (!issues.length) { toast('No marks exceed the total — all good!', 'success'); return; }
  toast(`⚠ ${issues.length} student(s) exceed total (${total}):\n${issues.slice(0, 5).join(', ')}${issues.length > 5 ? '…' : ''}`, 'error');
}

function _pmGetRow(idx) {
  return {
    student_id:     _pmStudents[idx].student_id,
    marks_obtained: document.getElementById(`pm-marks-${idx}`)?.value ?? '',
    is_absent:      document.getElementById(`pm-absent-${idx}`)?.checked ? 1 : 0,
    is_skip:        document.getElementById(`pm-skip-${idx}`)?.checked  ? 1 : 0,
    comment:        document.getElementById(`pm-comment-${idx}`)?.value ?? '',
  };
}

async function pmSaveAll() {
  if (!_pmTestId) return;
  const marks = _pmStudents.map((_, i) => _pmGetRow(i));
  try {
    const resp = await api(API.performanceMarks, 'POST', { test_id: _pmTestId, marks });
    toast(`All marks saved. Test status: ${resp.test_status}`, 'success');
    _pmStudents = await api(`${API.performanceMarks}?test_id=${_pmTestId}`);
    _pmRenderStudents();
    const t = (_ptData || []).find(x => x.id == _pmTestId);
    if (t) t.status = resp.test_status;
  } catch(e) { toast(e.message, 'error'); }
}

async function pmSaveRow(idx) {
  if (!_pmTestId) return;
  try {
    const resp = await api(API.performanceMarks, 'POST', { test_id: _pmTestId, marks: [_pmGetRow(idx)] });
    toast(`Saved: ${escapeHtml(_pmStudents[idx].student_name)}`, 'success');
    const t = (_ptData || []).find(x => x.id == _pmTestId);
    if (t) t.status = resp.test_status;
  } catch(e) { toast(e.message, 'error'); }
}

function pmApplyCols() {
  const cols = ['gr', 'photo', 'skip', 'absent', 'comment'];
  cols.forEach(c => {
    const cb   = document.getElementById(`pm-col-cb-${c}`);
    const show = !cb || cb.checked;
    document.querySelectorAll(`.pm-col-${c}`).forEach(el => { el.style.display = show ? '' : 'none'; });
  });
}
