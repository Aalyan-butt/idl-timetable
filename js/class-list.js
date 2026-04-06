// ===== CLASS LIST PAGE =====
let _clAllStudents   = [];
let _clClassOptions  = [];
let _clSelectedClass = null; // { id, name }
let _clInitialised   = false;

async function loadClassList() {
  if (!_clInitialised) {
    _clInitialised = true;
    // Load class options from global or API
    if (typeof classes !== 'undefined' && classes.length) {
      _clClassOptions = classes;
    } else {
      _clClassOptions = await api(API.classes).catch(() => []);
    }
    _clBuildClassDrop();
    _clCloseOnOutsideClick();
  }
  // If navigated here with a pre-selected class, data is already loaded via clSelectClass()
}

// Called externally (e.g. from paGoToClassList in performance.js)
async function clSelectClass(classId, className) {
  _clSelectedClass = { id: classId, name: className };
  // Update trigger text
  const trigText = document.getElementById('cl-cls-trigger-text');
  if (trigText) trigText.textContent = className || 'Select Class…';
  // Highlight in dropdown
  document.querySelectorAll('.cl-cs-item').forEach(el => {
    el.classList.toggle('selected', String(el.dataset.id) === String(classId));
  });
  // Close panel
  const panel = document.getElementById('cl-cls-panel');
  const trigger = document.getElementById('cl-cls-trigger');
  if (panel)   panel.classList.remove('open');
  if (trigger) trigger.classList.remove('open');
  // Load students
  await _clLoadStudents();
}

async function _clLoadStudents() {
  if (!_clSelectedClass) return;
  // Show loading state
  const tbody = document.getElementById('cl-tbody');
  if (tbody) tbody.innerHTML = `<tr><td colspan="9"><div class="cl-empty-state"><div class="cl-empty-icon-ring" style="animation:spin 1s linear infinite;border-top-color:var(--accent)">&#9696;</div><div class="cl-empty-title">Loading…</div></div></td></tr>`;

  try {
    const all = await api(API.students).catch(() => []);
    _clAllStudents = all.filter(s => String(s.class_id) === String(_clSelectedClass.id));
    _clUpdateStats();
    clRenderTable();
  } catch (e) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="9"><div class="cl-empty-state"><div class="cl-empty-icon-ring">&#9888;</div><div class="cl-empty-title">Failed to load</div><div class="cl-empty-sub">${escapeHtml(e.message || 'Unknown error')}</div></div></td></tr>`;
  }
}

function _clUpdateStats() {
  const total  = _clAllStudents.length;
  const male   = _clAllStudents.filter(s => (s.gender||'').toLowerCase() === 'male').length;
  const female = _clAllStudents.filter(s => (s.gender||'').toLowerCase() === 'female').length;
  const t = document.getElementById('cl-stat-total');  if (t) t.textContent = total;
  const m = document.getElementById('cl-stat-male');   if (m) m.textContent = male;
  const f = document.getElementById('cl-stat-female'); if (f) f.textContent = female;
}

function clRenderTable() {
  const tbody = document.getElementById('cl-tbody');
  if (!tbody) return;

  const countBar   = document.getElementById('cl-count-bar');
  const searchVal  = (document.getElementById('cl-search')?.value || '').toLowerCase();
  const genderVal  = (document.getElementById('cl-gender-filter')?.value || '').toLowerCase();

  if (!_clSelectedClass) {
    if (countBar) countBar.style.display = 'none';
    tbody.innerHTML = `<tr><td colspan="9">
    <div class="cl-empty-title">Select a Class</div>

    </div></td></tr>`;
    return;
  }

  let rows = _clAllStudents.filter(s => {
    if (genderVal && (s.gender||'').toLowerCase() !== genderVal) return false;
    if (searchVal) {
      const fullName = ((s.first_name||'') + ' ' + (s.last_name||'')).trim() || s.student_name || '';
      const hay = `${fullName} ${s.gr_number||''} ${s.father_name||''}`.toLowerCase();
      if (!hay.includes(searchVal)) return false;
    }
    return true;
  });

  // Update count bar
  if (countBar) {
    countBar.style.display = 'block';
    const showCount = document.getElementById('cl-showing-count');
    const classLabel = document.getElementById('cl-class-label-bar');
    if (showCount) showCount.textContent = rows.length;
    if (classLabel) classLabel.textContent = _clSelectedClass.name || '—';
  }

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="cl-empty-state"><div class="cl-empty-icon-ring">&#128100;</div><div class="cl-empty-title">No Students Found</div><div class="cl-empty-sub">No students match the current filters</div></div></td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map((s, i) => {
    const fullName = ((s.first_name||'') + ' ' + (s.last_name||'')).trim() || s.student_name || '—';
    const admitted = s.created_at ? s.created_at.slice(0,10) : '—';
    const gender   = s.gender ? (s.gender.charAt(0).toUpperCase() + s.gender.slice(1).toLowerCase()) : '—';
    const gColor   = (s.gender||'').toLowerCase() === 'female' ? '#ff82c8' : '#64b4ff';
    const contact  = s.father_phone || s.guardian_phone || s.mother_phone || '—';
    const avatarEl = s.photo
      ? `<div class="cl-avatar"><img src="${escapeHtml(s.photo)}" alt="photo" onerror="this.parentElement.innerHTML='&#128100;'"></div>`
      : `<div class="cl-avatar">&#128100;</div>`;
    return `<tr>
      <td style="text-align:center;color:var(--text-muted);font-size:0.8rem">${i+1}</td>
      <td style="text-align:center">${avatarEl}</td>
      <td><span class="cl-name-link" onclick="viewStudent(${s.id})">${escapeHtml(fullName)}</span></td>
      <td style="font-size:0.82rem;color:var(--text-muted)">${escapeHtml(s.gr_number||'—')}</td>
      <td style="font-size:0.85rem;color:${gColor};font-weight:600">${escapeHtml(gender)}</td>
      <td style="font-size:0.85rem">${escapeHtml(s.father_name||'—')}</td>
      <td style="font-size:0.82rem;color:var(--text-muted)">${escapeHtml(contact)}</td>
      <td style="font-size:0.8rem;color:var(--text-muted);white-space:nowrap">${admitted}</td>
      <td style="text-align:center">
        <button class="cl-action-btn" onclick="viewStudent(${s.id})">&#128100; View</button>
      </td>
    </tr>`;
  }).join('');
}

// ── Class Dropdown ──────────────────────────────────────────────
function _clBuildClassDrop() {
  const list = document.getElementById('cl-cls-list');
  if (!list) return;
  _clRenderClassItems('');
}

function _clRenderClassItems(q) {
  const list = document.getElementById('cl-cls-list');
  if (!list) return;
  const filtered = q
    ? _clClassOptions.filter(c => c.name.toLowerCase().includes(q.toLowerCase()))
    : _clClassOptions;
  if (!filtered.length) {
    list.innerHTML = `<div class="cl-cs-empty">No classes found</div>`;
    return;
  }
  list.innerHTML = filtered.map(c =>
    `<div class="cl-cs-item${_clSelectedClass && String(_clSelectedClass.id) === String(c.id) ? ' selected' : ''}"
      data-id="${c.id}" data-name="${escapeHtml(c.name)}"
      onmousedown="clSelectClassEl(this)">${escapeHtml(c.name)}</div>`
  ).join('');
}

function clSelectClassEl(el) {
  const id   = el.dataset.id;
  const name = el.dataset.name;
  clSelectClass(id, name);
}

function clToggleClassDrop(e) {
  if (e) e.stopPropagation();
  const panel   = document.getElementById('cl-cls-panel');
  const trigger = document.getElementById('cl-cls-trigger');
  const isOpen  = panel.classList.contains('open');
  if (isOpen) {
    panel.classList.remove('open');
    trigger.classList.remove('open');
  } else {
    panel.classList.add('open');
    trigger.classList.add('open');
    const search = document.getElementById('cl-cls-search');
    if (search) { search.value = ''; search.focus(); }
    _clRenderClassItems('');
  }
}

function clFilterClassDrop() {
  const q = document.getElementById('cl-cls-search')?.value || '';
  _clRenderClassItems(q);
}

function _clCloseOnOutsideClick() {
  document.addEventListener('click', function(e) {
    const wrap = document.getElementById('cl-cls-sel-wrap');
    if (wrap && !wrap.contains(e.target)) {
      const panel   = document.getElementById('cl-cls-panel');
      const trigger = document.getElementById('cl-cls-trigger');
      if (panel)   panel.classList.remove('open');
      if (trigger) trigger.classList.remove('open');
    }
  }, true);
}

// ── Search helpers ──────────────────────────────────────────────
function clClearBtnToggle(input) {
  const btn = document.getElementById('cl-search-clear');
  if (btn) btn.style.display = input.value ? 'block' : 'none';
}

function clClearSearch() {
  const inp = document.getElementById('cl-search');
  const btn = document.getElementById('cl-search-clear');
  if (inp) inp.value = '';
  if (btn) btn.style.display = 'none';
  clRenderTable();
}

function clResetFilters() {
  const inp = document.getElementById('cl-search');
  const g   = document.getElementById('cl-gender-filter');
  if (inp) inp.value = '';
  if (g)   g.value   = '';
  clClearBtnToggle({ value: '' });
  clRenderTable();
}

// ── Downloads ──────────────────────────────────────────────────
function clDownloadPDF(orientation) {
  const dm = document.getElementById('cl-dm');
  const scale = dm ? getMenuScale(dm) : 90;
  const className = _clSelectedClass ? _clSelectedClass.name : 'All';
  downloadTableDoc(
    'cl-tbody',
    `class_list_${className.replace(/\s+/g,'_')}`,
    ['#', 'Student Name', 'GR Number', 'Gender', 'Father Name', 'Contact', 'Admitted'],
    'pdf', 'A4', orientation || 'landscape', scale
  );
}

function clDownloadExcel() {
  const className = _clSelectedClass ? _clSelectedClass.name : 'All';
  downloadGenericExcel(
    'cl-tbody',
    ['#', 'Student Name', 'GR Number', 'Gender', 'Father Name', 'Contact', 'Admitted'],
    `Class List — ${className}`,
    `IDL_ClassList_${className.replace(/\s+/g,'_')}`
  );
}
