// ===== STUDENT PERFORMANCE — PERFORMANCE TESTS =====

var _ptData = [];

const PT_COLS = [
  { key: 'col-pt-sr',       label: 'Sr.#',          def: true  },
  { key: 'col-pt-name',     label: 'Test Name',      def: true  },
  { key: 'col-pt-status',   label: 'Status',         def: true  },
  { key: 'col-pt-mstatus',  label: 'Marks Status',   def: true  },
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
    tbody.innerHTML = `<tr><td colspan="13" style="text-align:center;padding:28px;color:var(--text-muted)">No performance tests found.</td></tr>`;
    _applyPTColVisibility();
    return;
  }
  tbody.innerHTML = rows.map((t, i) => `
    <tr>
      <td data-col="col-pt-sr" style="min-width:48px">${i + 1}</td>
      <td data-col="col-pt-name" style="font-weight:600;min-width:160px">${escapeHtml(t.test_name)}</td>
      <td data-col="col-pt-status">${_ptStatusBadge(t.status)}</td>
      <td data-col="col-pt-mstatus"><span style="font-size:0.8rem;color:var(--text-muted)">—</span></td>
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
