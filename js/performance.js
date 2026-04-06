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
    tbody.innerHTML = `<tr><td colspan="12" style="text-align:center;padding:28px;color:var(--text-muted)">No Record Found</td></tr>`;
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
var _pmDirty    = false;   // true when user has unsaved mark changes

function _pmSetDirty(val) {
  _pmDirty = val;
  // Drive beforeunload warning
  if (val) {
    window._pmBeforeUnload = window._pmBeforeUnload || function(e) {
      if (_pmDirty) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', window._pmBeforeUnload);
  } else {
    if (window._pmBeforeUnload) window.removeEventListener('beforeunload', window._pmBeforeUnload);
  }
}

async function loadPerformanceMarks() {
  // Auto-save draft of any in-progress work before resetting
  if (_pmTestId) _pmAutoSaveDraft();

  // Reset everything to default state
  _pmTestId   = null;
  _pmTestData = null;
  _pmStudents = [];
  _pmSetDirty(false);

  const infoEl  = document.getElementById('pm-test-info');
  const statsEl = document.getElementById('pm-stats-card');
  const saveEl  = document.getElementById('pm-save-row');
  const totalEl = document.getElementById('pm-total-marks-val');
  const tbody   = document.getElementById('pm-students-body');
  const msRow   = document.getElementById('pm-manage-students-row');

  if (infoEl)  infoEl.style.display  = 'none';
  if (statsEl) statsEl.style.display = 'none';
  if (saveEl)  saveEl.style.display  = 'none';
  if (msRow)   msRow.style.display   = 'none';
  if (totalEl) totalEl.textContent   = '—';
  if (tbody)   tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:44px;color:var(--text-muted)">No Record Found</td></tr>`;

  // Reset the test select dropdown to default
  const sel = document.getElementById('pm-test-select');
  if (sel) {
    const w = sel.closest('.ss-wrapper');
    if (w && w._ssRefresh) {
      // Reset via the underlying select
      sel.value = '';
      w._ssRefresh();
    } else if (sel) {
      sel.value = '';
    }
  }

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
  const msRow    = document.getElementById('pm-manage-students-row');

  if (!testId) {
    _pmTestId = null; _pmTestData = null; _pmStudents = [];
    if (infoEl)  infoEl.style.display  = 'none';
    if (statsEl) statsEl.style.display = 'none';
    if (saveEl)  saveEl.style.display  = 'none';
    if (msRow)   msRow.style.display   = 'none';
    if (totalEl) totalEl.textContent   = '—';
    if (tbody)   tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:44px;color:var(--text-muted)">No Record Found</td></tr>`;
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
  if (msRow)   msRow.style.display   = 'flex';
  if (tbody) tbody.innerHTML =
    '<tr><td colspan="8" style="text-align:center;padding:36px;color:var(--text-muted)">Loading…</td></tr>';

  const fillEl = document.getElementById('pm-fill-all');
  if (fillEl) fillEl.value = '';

  try {
    _pmStudents = await api(`${API.performanceMarks}?test_id=${testId}`);

    // Update roster note
    _pmUpdateRosterNote();

    _pmRenderStudents();
  } catch(e) {
    document.getElementById('pm-students-body').innerHTML =
      `<tr><td colspan="8" style="text-align:center;padding:36px;color:#ff5555">${escapeHtml(e.message)}</td></tr>`;
    toast(e.message, 'error');
  }
}

function _pmUpdateRosterNote() {
  const noteEl = document.getElementById('pm-roster-note');
  if (!noteEl || !_pmStudents) return;
  noteEl.textContent = `${_pmStudents.length} student${_pmStudents.length !== 1 ? 's' : ''} in this test`;
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
  _pmAttachDraftListeners();
}

function _pmAttachDraftListeners() {
  const tbody = document.getElementById('pm-students-body');
  if (!tbody || tbody._draftBound) return;
  tbody._draftBound = true;
  tbody.addEventListener('input',  () => { _pmAutoSaveDraft(); _pmSetDirty(true); });
  tbody.addEventListener('change', () => { _pmAutoSaveDraft(); _pmSetDirty(true); });
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

function pmHasDirtyChanges() { return _pmDirty && !!_pmTestId; }

// ── Unsaved-changes guard (called from navigation interceptor) ──────────────
var _pmPendingNav = null; // page name to navigate to after guard decision

function pmShowUnsavedGuard(targetPage) {
  _pmPendingNav = targetPage;
  const m = document.getElementById('pm-unsaved-modal');
  if (m) m.classList.add('open');
}

function pmUnsavedCancel() {
  _pmPendingNav = null;
  const m = document.getElementById('pm-unsaved-modal');
  if (m) m.classList.remove('open');
}

function pmUnsavedDiscard() {
  const m = document.getElementById('pm-unsaved-modal');
  if (m) m.classList.remove('open');
  _pmSetDirty(false);
  _pmClearDraft(_pmTestId);
  const target = _pmPendingNav;
  _pmPendingNav = null;
  if (target) showPage(target);
}

async function pmUnsavedSave() {
  const m = document.getElementById('pm-unsaved-modal');
  if (m) m.classList.remove('open');
  await pmSaveAll();
  const target = _pmPendingNav;
  _pmPendingNav = null;
  if (target && !_pmDirty) showPage(target); // only navigate if save succeeded
}

async function pmSaveAll(opts) {
  if (!_pmTestId) return;
  // Auto-save draft before saving (in case save fails)
  _pmAutoSaveDraft();
  const marks = _pmStudents.map((_, i) => _pmGetRow(i));
  try {
    const resp = await api(API.performanceMarks, 'POST', { test_id: _pmTestId, marks });
    _pmClearDraft(_pmTestId); // Clear draft on successful save
    _pmSetDirty(false);
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

// ===== DRAFT SYSTEM =====
function _pmDraftKey(testId) { return `pm_draft_${testId}`; }

function _pmAutoSaveDraft() {
  if (!_pmTestId || !_pmStudents.length) return;
  const data = _pmStudents.map((s, i) => ({
    student_id: s.student_id,
    marks:      document.getElementById(`pm-marks-${i}`)?.value   ?? '',
    absent:     document.getElementById(`pm-absent-${i}`)?.checked ?? false,
    skip:       document.getElementById(`pm-skip-${i}`)?.checked   ?? false,
    comment:    document.getElementById(`pm-comment-${i}`)?.value  ?? '',
  }));
  // Only save if something was actually entered
  const hasData = data.some(d => d.marks !== '' || d.absent || d.skip || d.comment !== '');
  if (!hasData) return;
  try { localStorage.setItem(_pmDraftKey(_pmTestId), JSON.stringify({ ts: Date.now(), data })); } catch(e) {}
}

function _pmGetDraft(testId) {
  try { const raw = localStorage.getItem(_pmDraftKey(testId)); return raw ? JSON.parse(raw) : null; }
  catch(e) { return null; }
}

function _pmClearDraft(testId) {
  try { localStorage.removeItem(_pmDraftKey(testId)); } catch(e) {}
}

function pmRestoreDraft() {
  const draft = _pmGetDraft(_pmTestId);
  if (!draft) return;
  const dm = document.getElementById('pm-draft-modal');
  if (dm) dm.classList.remove('open');
  // Render with saved data
  _pmRenderStudents();
  // Apply draft values after render
  setTimeout(() => {
    draft.data.forEach((d, i) => {
      // Find the row index by student_id
      const idx = _pmStudents.findIndex(s => s.student_id == d.student_id);
      if (idx === -1) return;
      const marksEl   = document.getElementById(`pm-marks-${idx}`);
      const absentEl  = document.getElementById(`pm-absent-${idx}`);
      const skipEl    = document.getElementById(`pm-skip-${idx}`);
      const commentEl = document.getElementById(`pm-comment-${idx}`);
      if (absentEl && d.absent)  { absentEl.checked = true;  pmToggleAbsent(idx, true);  }
      if (skipEl   && d.skip)    { skipEl.checked   = true;  pmToggleSkip(idx, true);    }
      if (marksEl  && d.marks)   { marksEl.value = d.marks;  pmCheckExceeds(idx); }
      if (commentEl && d.comment) commentEl.value = d.comment;
    });
    toast('Draft restored', 'success');
  }, 50);
}

function pmDiscardDraft() {
  _pmClearDraft(_pmTestId);
  const dm = document.getElementById('pm-draft-modal');
  if (dm) dm.classList.remove('open');
  _pmRenderStudents();
}

// ===== MANAGE STUDENTS =====
var _pmMsData = null; // { has_custom_roster, current, previous }

async function pmManageStudents() {
  if (!_pmTestId) return;
  const overlay = document.getElementById('pm-ms-modal-overlay');
  if (overlay) overlay.classList.add('open');
  document.getElementById('pm-ms-list').innerHTML = '<div class="pm-ms-empty">Loading...</div>';
  document.getElementById('pm-ms-search').value = '';

  try {
    _pmMsData = await api(`${API.testStudents}?test_id=${_pmTestId}`);
    _pmMsRender('');
  } catch(e) {
    document.getElementById('pm-ms-list').innerHTML = `<div class="pm-ms-empty" style="color:#ff5555">${escapeHtml(e.message)}</div>`;
  }
}

function pmCloseMsModal() {
  const overlay = document.getElementById('pm-ms-modal-overlay');
  if (overlay) overlay.classList.remove('open');
}

function _pmMsRender(q) {
  if (!_pmMsData) return;
  const list = document.getElementById('pm-ms-list');
  const ql = q.toLowerCase();

  function buildRows(students, badgeClass, badgeLabel) {
    const filtered = ql ? students.filter(s => (s.student_name || '').toLowerCase().includes(ql) || (s.gr_number || '').toLowerCase().includes(ql)) : students;
    if (!filtered.length) return '';
    return filtered.map(s => `
      <label class="pm-ms-student-row" data-type="${badgeLabel}">
        <input type="checkbox" class="pm-ms-cb" data-id="${s.student_id}" ${s.in_roster ? 'checked' : ''}>
        <span class="pm-ms-student-name">${escapeHtml(s.student_name || '—')}</span>
        <span class="pm-ms-student-gr">${escapeHtml(s.gr_number || '')}</span>
        <span class="${badgeClass}">${badgeLabel}</span>
      </label>`).join('');
  }

  const currentHtml  = buildRows(_pmMsData.current,  'pm-ms-badge-current', 'Current');
  const previousHtml = buildRows(_pmMsData.previous, 'pm-ms-badge-prev',    'Previous');

  let html = '';
  if (_pmMsData.current.length || currentHtml) {
    html += `<div class="pm-ms-section-label">Current Students <span class="pm-ms-badge-current">in this class</span></div>`;
    html += currentHtml || '<div class="pm-ms-empty">No current students match</div>';
  }
  if (_pmMsData.previous.length || previousHtml) {
    html += `<div class="pm-ms-section-label" style="margin-top:18px">Previous Students <span class="pm-ms-badge-prev">no longer in class</span></div>`;
    html += previousHtml || '<div class="pm-ms-empty">No previous students match</div>';
  }
  if (!html) html = '<div class="pm-ms-empty">No students found</div>';
  list.innerHTML = html;
}

function pmMsFilter(q) { _pmMsRender(q); }

function pmMsSelectAll() {
  document.querySelectorAll('.pm-ms-cb').forEach(cb => { cb.checked = true; });
  // Also update _pmMsData
  if (_pmMsData) {
    _pmMsData.current.forEach(s => s.in_roster = true);
    _pmMsData.previous.forEach(s => s.in_roster = true);
  }
}

function pmMsSelectNone() {
  document.querySelectorAll('.pm-ms-cb').forEach(cb => { cb.checked = false; });
  if (_pmMsData) {
    _pmMsData.current.forEach(s => s.in_roster = false);
    _pmMsData.previous.forEach(s => s.in_roster = false);
  }
}

function pmMsSelectCurrent() {
  document.querySelectorAll('.pm-ms-cb').forEach(cb => {
    const row = cb.closest('.pm-ms-student-row');
    cb.checked = row?.dataset.type === 'Current';
  });
  if (_pmMsData) {
    _pmMsData.current.forEach(s => s.in_roster = true);
    _pmMsData.previous.forEach(s => s.in_roster = false);
  }
}

async function pmSaveRoster() {
  if (!_pmTestId) return;
  const checked = [...document.querySelectorAll('.pm-ms-cb:checked')].map(cb => parseInt(cb.dataset.id));
  try {
    await api(API.testStudents, 'POST', { test_id: _pmTestId, student_ids: checked });
    pmCloseMsModal();
    toast(`Roster saved — ${checked.length} student${checked.length !== 1 ? 's' : ''} in this test`, 'success');
    // Reload students for this test
    _pmStudents = await api(`${API.performanceMarks}?test_id=${_pmTestId}`);
    _pmUpdateRosterNote();
    _pmRenderStudents();
  } catch(e) { toast(e.message, 'error'); }
}

// ============================================================
// ===== PERFORMANCE ANALYSIS =================================
// ============================================================

var _paAllStudents   = [];   // full student list from server
var _paFilteredStud  = [];   // students after class/name/gr filters
var _paSelectedStud  = null; // currently selected student object
var _paAllRecords    = [];   // raw marks history from API
var _paTableRows     = [];   // processed rows shown in table
var _paSortKey       = 'date';
var _paSortDir       = 'desc';
var _paActiveSubject = '';   // subject pill filter
var _paDropTimer     = null;
var _paClassSelected = '';   // selected class id for custom dropdown
var _paClassOptions  = [];   // [{id, name}] for class dropdown

async function loadPerformanceAnalysis() {
  // Load students + classes in parallel
  try {
    const [studs, cls] = await Promise.all([
      api(API.students).catch(() => []),
      api(API.classes).catch(() => [])
    ]);
    _paAllStudents  = Array.isArray(studs) ? studs : [];
    _paFilteredStud = _paAllStudents;
    _paBuildClassFilter(cls);
    _paResetStudentUI();
  } catch(e) { toast(e.message, 'error'); }
}

function _paBuildClassFilter(cls) {
  _paClassOptions = [{id:'', name:'All Classes'}, ...cls.map(c => ({id: String(c.id), name: c.name || ''})) ];
  _paRenderClassList(_paClassOptions);
  _paSetClassTriggerText('All Classes');
  _paClassSelected = '';
}

// ── Custom Class Dropdown helpers ──────────────────────────────
function _paSetClassTriggerText(text) {
  const el = document.getElementById('pa-cls-trigger-text');
  if (el) el.textContent = text || 'All Classes';
}

function _paRenderClassList(options) {
  const list = document.getElementById('pa-cls-list');
  if (!list) return;
  if (!options.length) {
    list.innerHTML = '<div class="pa-cs-empty">No classes found</div>';
    return;
  }
  list.innerHTML = options.map(o =>
    `<div class="pa-cs-item${_paClassSelected === o.id ? ' selected' : ''}" data-id="${escapeHtml(o.id)}" data-name="${escapeHtml(o.name)}" onmousedown="paSelectClassEl(this)">${escapeHtml(o.name)}</div>`
  ).join('');
}

function paSelectClassEl(el) {
  paSelectClass(el.dataset.id || '', el.dataset.name || 'All Classes');
}

function paToggleClassDrop(e) {
  e.stopPropagation();
  const trigger = document.getElementById('pa-cls-trigger');
  const panel   = document.getElementById('pa-cls-panel');
  if (!panel) return;
  const isOpen = panel.classList.contains('open');
  // close all custom panels
  document.querySelectorAll('.pa-cs-panel.open').forEach(p => p.classList.remove('open'));
  document.querySelectorAll('.pa-cs-trigger.open').forEach(t => t.classList.remove('open'));
  if (!isOpen) {
    panel.classList.add('open');
    if (trigger) trigger.classList.add('open');
    const search = document.getElementById('pa-cls-search');
    if (search) { search.value = ''; search.focus(); }
    _paRenderClassList(_paClassOptions);
  }
}

function paFilterClassDrop() {
  const q = (document.getElementById('pa-cls-search')?.value || '').toLowerCase();
  const filtered = _paClassOptions.filter(o => o.name.toLowerCase().includes(q));
  _paRenderClassList(filtered);
}

function paSelectClass(id, name) {
  _paClassSelected = id;
  _paSetClassTriggerText(name || 'All Classes');
  const panel   = document.getElementById('pa-cls-panel');
  const trigger = document.getElementById('pa-cls-trigger');
  if (panel)   panel.classList.remove('open');
  if (trigger) trigger.classList.remove('open');
  paOnClassChange();
}

// ── Filter inputs ────────────────────────────────────────────────
function paOnClassChange() {
  _paSelectedStud = null;
  _paResetStudentUI();
  _paApplyStudentFilters();
}

function paOnNameInput() {
  _paApplyStudentFilters();
  paShowDropdown();
}

function paOnGrInput() {
  _paApplyStudentFilters();
  paShowDropdown();
}

function _paApplyStudentFilters() {
  const classId = _paClassSelected || '';
  const name    = (document.getElementById('pa-name-input')?.value  || '').toLowerCase().trim();
  const gr      = (document.getElementById('pa-gr-input')?.value    || '').toLowerCase().trim();

  _paFilteredStud = _paAllStudents.filter(s => {
    if (classId && String(s.class_id) !== classId) return false;
    if (name && !(s.student_name || '').toLowerCase().includes(name)) return false;
    if (gr   && !(s.gr_number    || '').toLowerCase().includes(gr))   return false;
    return true;
  });
  _paRenderDropdown();
}

function _paRenderDropdown() {
  const dd = document.getElementById('pa-name-dropdown');
  if (!dd) return;
  const list = _paFilteredStud.slice(0, 30);
  if (!list.length) {
    dd.innerHTML = `<div style="padding:12px 14px;color:var(--text-muted);font-size:0.85rem">No students found</div>`;
  } else {
    dd.innerHTML = list.map(s => `
      <div class="pa-dd-item" data-id="${s.id}"
        style="padding:9px 14px;cursor:pointer;display:flex;align-items:center;gap:10px;border-bottom:1px solid rgba(201,168,76,0.07);transition:background .1s"
        onmousedown="paSelectStudent(${s.id})"
        onmouseover="this.style.background='rgba(201,168,76,0.09)'"
        onmouseout="this.style.background=''">
        <span style="font-size:0.88rem;color:var(--text);font-weight:600">${escapeHtml(s.student_name||'—')}</span>
        <span style="font-size:0.78rem;color:var(--text-muted);margin-left:auto">GR: ${escapeHtml(s.gr_number||'—')}</span>
        ${s.class_name ? `<span style="font-size:0.75rem;color:var(--accent);background:rgba(201,168,76,0.1);padding:1px 7px;border-radius:8px">${escapeHtml(s.class_name)}</span>` : ''}
      </div>`).join('');
  }
  dd.style.display = 'block';
}

function paShowDropdown() {
  clearTimeout(_paDropTimer);
  _paApplyStudentFilters();
}

function paHideDropdown() {
  _paDropTimer = setTimeout(() => {
    const dd = document.getElementById('pa-name-dropdown');
    if (dd) dd.style.display = 'none';
  }, 200);
}

async function paSelectStudent(id) {
  const dd = document.getElementById('pa-name-dropdown');
  if (dd) dd.style.display = 'none';

  _paSelectedStud = _paAllStudents.find(s => s.id == id) || null;
  if (!_paSelectedStud) return;

  // Fill name/gr inputs
  const nameInp = document.getElementById('pa-name-input');
  const grInp   = document.getElementById('pa-gr-input');
  if (nameInp) nameInp.value = _paSelectedStud.student_name || '';
  if (grInp)   grInp.value   = _paSelectedStud.gr_number    || '';

  // Show student strip
  _paShowStudentStrip(_paSelectedStud);

  // Load history
  const tbody = document.getElementById('pa-body');
  if (tbody) tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:44px;color:var(--text-muted)">Loading…</td></tr>`;

  try {
    _paAllRecords = await api(`${API.performanceMarks}?student_id=${id}`);
    _paAllRecords = Array.isArray(_paAllRecords) ? _paAllRecords : [];
    _paBuildSubjectPills();
    _paBuildDateFilters();
    _paBuildSubjectFilter();
    _paActiveSubject = '';
    paFilterTable();
    _paUpdateStats();
  } catch(e) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:44px;color:#ff5555">${escapeHtml(e.message)}</td></tr>`;
    toast(e.message, 'error');
  }
}

function _paShowStudentStrip(s) {
  const strip = document.getElementById('pa-student-strip');
  if (!strip) return;

  // Avatar
  const avatarWrap = document.getElementById('pa-avatar-wrap');
  if (avatarWrap) {
    avatarWrap.innerHTML = s.photo
      ? `<img src="${escapeHtml(s.photo)}" class="pa-avatar" onerror="this.style.display='none'">`
      : `<div class="pa-avatar-placeholder">&#128100;</div>`;
  }

  const nameEl = document.getElementById('pa-s-name');
  const metaEl = document.getElementById('pa-s-meta');
  if (nameEl) nameEl.textContent = s.student_name || '—';
  if (metaEl) {
    const parts = [];
    if (s.gr_number)   parts.push(`GR: ${s.gr_number}`);
    if (s.class_name)  parts.push(s.class_name);
    if (s.father_name) parts.push(`Father: ${s.father_name}`);
    metaEl.textContent = parts.join('  ·  ') || '—';
  }
  strip.classList.add('visible');
}

function _paUpdateStats() {
  const scored = _paAllRecords.filter(r => !r.is_absent && !r.is_skip && r.marks_obtained !== null && r.marks_obtained !== '');
  const total  = _paAllRecords.length;
  const absent = _paAllRecords.filter(r => r.is_absent == 1).length;

  let avg = '—', best = '—';
  if (scored.length) {
    const pcts = scored.map(r => r.total_marks > 0 ? (parseFloat(r.marks_obtained) / parseFloat(r.total_marks)) * 100 : null).filter(p => p !== null);
    if (pcts.length) {
      avg  = (pcts.reduce((a,b) => a+b, 0) / pcts.length).toFixed(1) + '%';
      best = Math.max(...pcts).toFixed(1) + '%';
    }
  }

  _paSet('pa-chip-tests',  total);
  _paSet('pa-chip-avg',    avg);
  _paSet('pa-chip-best',   best);
  _paSet('pa-chip-absent', absent);
}

function _paSet(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

function _paBuildSubjectPills() {
  const row = document.getElementById('pa-subject-row');
  const pills = document.getElementById('pa-subject-pills');
  if (!row || !pills) return;

  const subjects = [...new Map(_paAllRecords.map(r => [r.subject_name, r.subject_name])).entries()].map(([k]) => k).filter(Boolean);
  if (!subjects.length) { row.style.display = 'none'; return; }

  pills.innerHTML = `<button class="pa-subject-pill active" onclick="paSetSubjectPill('',this)">All</button>` +
    subjects.map(s => `<button class="pa-subject-pill" onclick="paSetSubjectPill('${escapeHtml(s)}',this)">${escapeHtml(s)}</button>`).join('');
  row.style.display = 'block';
}

function paSetSubjectPill(subject, btn) {
  _paActiveSubject = subject;
  document.querySelectorAll('.pa-subject-pill').forEach(p => p.classList.remove('active'));
  if (btn) btn.classList.add('active');
  paFilterTable();
}

function _paBuildDateFilters() {
  const dates = [...new Set(_paAllRecords.map(r => r.test_date).filter(Boolean))].sort();
  const fromSel = document.getElementById('pa-date-from');
  const toSel   = document.getElementById('pa-date-to');
  if (!fromSel || !toSel) return;
  const opts = dates.map(d => `<option value="${d}">${d}</option>`).join('');
  fromSel.innerHTML = '<option value="">From Date</option>' + opts;
  toSel.innerHTML   = '<option value="">To Date</option>'   + opts;
}

function _paBuildSubjectFilter() {
  const subjects = [...new Set(_paAllRecords.map(r => r.subject_name).filter(Boolean))];
  const sel = document.getElementById('pa-subject-filter');
  if (!sel) return;
  sel.innerHTML = '<option value="">All Subjects</option>' +
    subjects.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
}

// ── Table filter + render ────────────────────────────────────────
function paFilterTable() {
  const search  = (document.getElementById('pa-table-search')?.value    || '').toLowerCase().trim();
  const subject = document.getElementById('pa-subject-filter')?.value   || '';
  const status  = document.getElementById('pa-status-filter')?.value    || '';
  const dFrom   = document.getElementById('pa-date-from')?.value        || '';
  const dTo     = document.getElementById('pa-date-to')?.value          || '';

  let rows = _paAllRecords.filter(r => {
    if (_paActiveSubject && r.subject_name !== _paActiveSubject) return false;
    if (subject && r.subject_name !== subject) return false;
    if (dFrom && r.test_date && r.test_date < dFrom) return false;
    if (dTo   && r.test_date && r.test_date > dTo)   return false;
    if (status) {
      const s = _paRowStatus(r);
      if (s !== status) return false;
    }
    if (search) {
      const hay = [r.test_name, r.class_name, r.subject_name].map(v => (v||'').toLowerCase()).join(' ');
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  // Sort
  rows = _paSort(rows);
  _paTableRows = rows;

  // Per page
  const perPage = parseInt(document.getElementById('pa-per-page')?.value || '25');
  const shown   = perPage > 0 ? rows.slice(0, perPage) : rows;

  const lbl = document.getElementById('pa-count-label');
  if (lbl) lbl.textContent = `${rows.length} record${rows.length !== 1 ? 's' : ''}`;

  _paRenderTable(shown);
}

function _paRowStatus(r) {
  if (r.is_absent == 1) return 'absent';
  if (r.is_skip   == 1) return 'skip';
  if (r.marks_obtained !== null && r.marks_obtained !== '') return 'scored';
  return 'pending';
}

function _paSort(rows) {
  const dir = _paSortDir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    let va, vb;
    switch (_paSortKey) {
      case 'sr':       return 0;
      case 'date':     va = a.test_date    || ''; vb = b.test_date    || ''; break;
      case 'test':     va = a.test_name    || ''; vb = b.test_name    || ''; break;
      case 'class':    va = a.class_name   || ''; vb = b.class_name   || ''; break;
      case 'subject':  va = a.subject_name || ''; vb = b.subject_name || ''; break;
      case 'teacher':  va = a.teacher_name || ''; vb = b.teacher_name || ''; break;
      case 'obtained': va = parseFloat(a.marks_obtained ?? -1); vb = parseFloat(b.marks_obtained ?? -1); return dir * (va - vb);
      case 'total':    va = parseFloat(a.total_marks    ?? -1); vb = parseFloat(b.total_marks    ?? -1); return dir * (va - vb);
      case 'pct':
        va = (a.total_marks > 0 && a.marks_obtained !== null && a.marks_obtained !== '') ? parseFloat(a.marks_obtained)/parseFloat(a.total_marks) : -1;
        vb = (b.total_marks > 0 && b.marks_obtained !== null && b.marks_obtained !== '') ? parseFloat(b.marks_obtained)/parseFloat(b.total_marks) : -1;
        return dir * (va - vb);
      case 'status':   va = _paRowStatus(a); vb = _paRowStatus(b); break;
      default:         va = ''; vb = '';
    }
    if (va < vb) return -1 * dir;
    if (va > vb) return  1 * dir;
    return 0;
  });
}

function paSortBy(key) {
  if (_paSortKey === key) _paSortDir = _paSortDir === 'asc' ? 'desc' : 'asc';
  else { _paSortKey = key; _paSortDir = key === 'date' ? 'desc' : 'asc'; }
  // Update header icons
  document.querySelectorAll('#pa-table thead th').forEach(th => {
    th.classList.remove('pa-sorted');
    const icon = th.querySelector('.pa-sort-icon');
    if (icon) icon.textContent = '⇅';
  });
  const sortedTh = document.querySelector(`#pa-table thead th[onclick="paSortBy('${key}')"]`);
  if (sortedTh) {
    sortedTh.classList.add('pa-sorted');
    const icon = sortedTh.querySelector('.pa-sort-icon');
    if (icon) icon.textContent = _paSortDir === 'asc' ? '↑' : '↓';
  }
  paFilterTable();
}

function _paScoreColor(pct) {
  if (pct >= 80) return '#44cc88';
  if (pct >= 60) return '#c9a84c';
  if (pct >= 40) return '#ffaa33';
  return '#ff5555';
}

function _paRenderTable(rows) {
  const tbody = document.getElementById('pa-body');
  if (!tbody) return;
  if (!rows.length) {
    const msg = _paSelectedStud ? 'No records match your filters.' : 'Select a student to view performance records.';
    const title = _paSelectedStud ? 'No Records Found' : 'Select a Student';
    const icon  = _paSelectedStud ? '&#128269;' : '&#128202;';
    tbody.innerHTML = `<tr><td colspan="11"><div class="pa-empty-state">
      <div class="pa-empty-icon-ring">${icon}</div>
      <div class="pa-empty-title">${title}</div>
      <div class="pa-empty-sub">${msg}</div>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map((r, i) => {
    const status   = _paRowStatus(r);
    const obtained = r.marks_obtained !== null && r.marks_obtained !== '' ? parseFloat(r.marks_obtained) : null;
    const total    = r.total_marks != null ? parseFloat(r.total_marks) : null;
    const pct      = (obtained !== null && total > 0) ? (obtained / total * 100) : null;
    const color    = pct !== null ? _paScoreColor(pct) : 'var(--text-muted)';

    const statusBadge = {
      absent:  `<span class="pa-badge pa-badge-absent">Absent</span>`,
      skip:    `<span class="pa-badge pa-badge-skip">Skipped</span>`,
      scored:  `<span class="pa-badge pa-badge-scored">Scored</span>`,
      pending: `<span class="pa-badge pa-badge-pending">Pending</span>`,
    }[status];

    const scoreBar = pct !== null
      ? `<div class="pa-score-bar-wrap">
           <div class="pa-score-bar-bg"><div class="pa-score-bar-fill" style="width:${Math.min(pct,100).toFixed(1)}%;background:${color}"></div></div>
           <span class="pa-score-text" style="color:${color}">${pct.toFixed(1)}%</span>
         </div>`
      : `<span style="color:var(--text-muted);font-size:0.82rem">—</span>`;

    const dateStr = r.test_date ? new Date(r.test_date + 'T00:00:00').toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'}) : '—';
    const comment = r.comment ? escapeHtml(r.comment) : '';

    return `<tr>
      <td class="pa-col-sr"      style="color:var(--text-muted);font-size:0.8rem;text-align:center">${i+1}</td>
      <td class="pa-col-date"    style="white-space:nowrap;font-size:0.85rem;color:var(--text-muted)">${dateStr}</td>
      <td class="pa-col-test"    ><span class="pa-test-link" onclick="paGoToTestMarks(${r.test_id || 0})">${escapeHtml(r.test_name||'—')}</span></td>
      <td class="pa-col-class"   style="font-size:0.85rem">${escapeHtml(r.class_name||'—')}</td>
      <td class="pa-col-subject" style="font-size:0.85rem;color:var(--accent)">${escapeHtml(r.subject_name||'—')}</td>
      <td class="pa-col-teacher" style="font-size:0.82rem;color:var(--text-muted)">${escapeHtml(r.teacher_name||'—')}</td>
      <td class="pa-col-obtained" style="font-weight:700;font-size:0.95rem;color:${obtained !== null ? color : 'var(--text-muted)'}">
        ${obtained !== null ? obtained : (status === 'absent' ? '—' : status === 'skip' ? '—' : '—')}
      </td>
      <td class="pa-col-total"   style="font-size:0.88rem;color:var(--text-muted)">${total !== null ? total : '—'}</td>
      <td class="pa-col-pct">${scoreBar}</td>
      <td class="pa-col-status">${statusBadge}</td>
      <td class="pa-col-comment"><div class="pa-comment-cell" title="${comment}">${comment || '<span style="color:var(--text-muted);font-size:0.8rem">—</span>'}</div></td>
    </tr>`;
  }).join('');
}

// ── Column visibility ────────────────────────────────────────────
function paApplyCols() {
  const cols = ['sr','date','test','class','subject','teacher','obtained','total','pct','status','comment'];
  cols.forEach(c => {
    const cb   = document.getElementById(`pa-col-${c}`);
    const show = !cb || cb.checked;
    document.querySelectorAll(`.pa-col-${c}`).forEach(el => { el.style.display = show ? '' : 'none'; });
  });
}

function paSetAllCols(val, e) {
  if (e) e.stopPropagation();
  const cols = ['sr','date','test','class','subject','teacher','obtained','total','pct','status','comment'];
  cols.forEach(c => {
    const cb = document.getElementById(`pa-col-${c}`);
    if (cb) cb.checked = val;
  });
  paApplyCols();
}

function paToggleColPanel(e) {
  e.stopPropagation();
  const panel = document.getElementById('pa-col-panel');
  if (!panel) return;
  panel.classList.toggle('open');
  // Close class dropdown if open
  document.querySelectorAll('.pa-cs-panel.open').forEach(p => p.classList.remove('open'));
  document.querySelectorAll('.pa-cs-trigger.open').forEach(t => t.classList.remove('open'));
}

// ── Click student name → open student modal ──────────────────────────
function paOpenStudentProfile() {
  if (!_paSelectedStud) return;
  if (typeof viewStudent === 'function') viewStudent(_paSelectedStud.id);
}

// ── Click test name → go to Performance Marks with that test ──────────
function paGoToTestMarks(testId) {
  if (!testId) return;
  showPage('performance-marks').then(() => {
    setTimeout(() => {
      const sel = document.getElementById('pm-test-select');
      if (sel) {
        sel.value = testId;
        pmSelectTest(testId);
        // Sync the custom searchable wrapper if present
        const w = sel.closest('.ss-wrapper');
        if (w && w._ssRefresh) w._ssRefresh();
      }
    }, 80);
  }).catch(() => {});
}

// ── Click class name → go to Class List with that class ───────────────
function paGoToClassList() {
  if (!_paSelectedStud || !_paSelectedStud.class_id) return;
  const classId   = _paSelectedStud.class_id;
  const className = _paSelectedStud.class_name || '';
  showPage('class-list').then(() => {
    setTimeout(() => {
      if (typeof clSelectClass === 'function') clSelectClass(classId, className);
    }, 80);
  }).catch(() => {});
}

// Close col panel and class dropdown on outside click
document.addEventListener('click', () => {
  const panel = document.getElementById('pa-col-panel');
  if (panel) panel.classList.remove('open');
  document.querySelectorAll('.pa-cs-panel.open').forEach(p => p.classList.remove('open'));
  document.querySelectorAll('.pa-cs-trigger.open').forEach(t => t.classList.remove('open'));
});

// ── Reset ────────────────────────────────────────────────────────
function paResetFilters() {
  ['pa-date-from','pa-date-to','pa-subject-filter','pa-status-filter'].forEach(id => {
    const el = document.getElementById(id); if (el) el.selectedIndex = 0;
  });
  ['pa-name-input','pa-gr-input','pa-table-search'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  // Reset custom class dropdown
  _paClassSelected = '';
  _paSetClassTriggerText('All Classes');
  _paRenderClassList(_paClassOptions);
  _paSelectedStud  = null;
  _paAllRecords    = [];
  _paActiveSubject = '';
  _paResetStudentUI();
  _paFilteredStud = _paAllStudents;
}

function _paResetStudentUI() {
  const strip = document.getElementById('pa-student-strip');
  if (strip) strip.classList.remove('visible');
  const sRow = document.getElementById('pa-subject-row');
  if (sRow) sRow.style.display = 'none';
  const tbody = document.getElementById('pa-body');
  if (tbody) tbody.innerHTML = `<tr><td colspan="11"><div class="pa-empty-state">
  
    <div class="pa-empty-title">Select a Student</div>
  </div></td></tr>`;
  const lbl = document.getElementById('pa-count-label');
  if (lbl) lbl.textContent = '';
}

// ── PDF / Excel downloads ────────────────────────────────────────
function paDownloadPDF(orientation) {
  if (!_paSelectedStud) { toast('Please select a student first', 'error'); return; }
  const scale = getMenuScale(document.getElementById('pa-dm'));
  const studentInfo = {
    name:  _paSelectedStud.student_name || 'Student',
    gr:    _paSelectedStud.gr_number    || '',
    cls:   _paSelectedStud.class_name   || '',
    photo: _paSelectedStud.photo        || ''
  };
  downloadTableDoc('pa-body', `performance_${_paSelectedStud.student_name || 'student'}`,
    ['#','Test Date','Test Name','Class','Subject','Teacher','Obtained','Total','Score %','Status','Comment'],
    'pdf', 'A4', orientation, scale, null, studentInfo);
}

function paDownloadExcel() {
  if (!_paSelectedStud) { toast('Please select a student first', 'error'); return; }
  const studentInfo = {
    name:  _paSelectedStud.student_name || 'Student',
    gr:    _paSelectedStud.gr_number    || '',
    photo: _paSelectedStud.photo        || ''
  };
  downloadGenericExcel('pa-body',
    ['#','Test Date','Test Name','Class','Subject','Teacher','Obtained','Total','Score %','Status','Comment'],
    `Performance – ${_paSelectedStud.student_name || 'Student'}`,
    `IDL_Performance_${((_paSelectedStud.student_name||'student').replace(/\s+/g,'_'))}`,
    studentInfo);
}

