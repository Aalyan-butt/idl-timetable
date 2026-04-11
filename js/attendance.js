// =============================================================
// attendance.js — Staff & Student Attendance
// =============================================================

// ── Shared helpers ────────────────────────────────────────────
let _attDebounceTimers = {};
function attDebounce(key, fn, ms = 600) {
  clearTimeout(_attDebounceTimers[key]);
  _attDebounceTimers[key] = setTimeout(fn, ms);
}
function attFmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function attFmtDateShort(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
}
function attStatusBadge(s) {
  const map = {
    present: ['badge-present', 'Present'],
    absent:  ['badge-absent',  'Absent'],
    late:    ['badge-late',    'Late'],
    leave:   ['badge-leave',   'Leave'],
    pending: ['badge-pending', 'Pending'],
  };
  const [cls, lbl] = map[s] || ['', s];
  return `<span class="att-status-badge ${cls}">${lbl}</span>`;
}
function attPct(n, total) {
  if (!total) return '';
  return `${Math.round(n / total * 100)}%`;
}
function attToday() {
  const d = new Date();
  return d.toISOString().split('T')[0];
}
function attMonthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

// ─────────────────────────────────────────────────────────────
// STAFF ATTENDANCE — Mark page
// ─────────────────────────────────────────────────────────────
let _saData = []; // { id, full_name, designation, status, notes }

function initStaffAttendancePage() {
  const inp = document.getElementById('sa-date');
  if (inp && !inp.value) inp.value = attToday();
  saLoadAttendance();
}

async function saLoadAttendance() {
  const date = document.getElementById('sa-date')?.value || attToday();
  const tbody = document.getElementById('sa-tbody');
  if (!tbody) return;
  // reset pending filter on reload
  _saPendingFilter = false;
  const pb = document.getElementById('sa-pending-btn');
  if (pb) { pb.style.background = pb.style.borderColor = pb.style.color = ''; pb.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:4px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>View Pending'; }
  tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--text-muted)">Loading…</td></tr>`;
  try {
    const res = await api('api/attendance.php?type=staff&date=' + encodeURIComponent(date));
    _saData = (res.teachers || []).map(t => ({ ...t, status: t.status || null, notes: t.notes || '' }));
    saRenderTable();
    saUpdatePills();
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--danger)">Failed to load. ${e.message || ''}</td></tr>`;
  }
}

function saRenderTable() {
  const tbody = document.getElementById('sa-tbody');
  if (!tbody) return;
  if (!_saData.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--text-muted)">No staff found.</td></tr>`;
    return;
  }
  tbody.innerHTML = _saData.map((t, i) => {
    const rowCls = t.status ? `att-row-${t.status}` : '';
    return `<tr class="${rowCls}" id="sa-row-${t.id}">
      <td class="att-num">${i + 1}</td>
      <td>
        <div class="att-name-cell">${escapeHtml(t.full_name)}</div>
        ${t.designation ? `<div class="att-designation">${escapeHtml(t.designation)}</div>` : ''}
      </td>
      <td>
        <div class="att-status-row">
          ${['present','absent','late','leave'].map(s =>
            `<button class="att-status-btn${t.status === s ? ` active-${s}` : ''}"
              onclick="saSetStatus(${t.id},'${s}')" data-s="${s}">${s.charAt(0).toUpperCase() + s.slice(1)}</button>`
          ).join('')}
        </div>
      </td>
      <td>
        <input type="text" class="att-notes-input" value="${escapeHtml(t.notes)}"
          placeholder="Optional remark…" maxlength="255"
          oninput="saSetNotes(${t.id},this.value)">
      </td>
    </tr>`;
  }).join('');
  saUpdateProgress();
}

function saSetStatus(id, status) {
  const t = _saData.find(x => x.id == id);
  if (!t) return;
  t.status = status;
  const row = document.getElementById(`sa-row-${id}`);
  if (row) {
    row.className = `att-row-${status}`;
    row.querySelectorAll('.att-status-btn').forEach(btn => {
      const s = btn.getAttribute('data-s');
      btn.className = 'att-status-btn' + (s === status ? ` active-${s}` : '');
    });
  }
  saUpdatePills();
  saUpdateProgress();
}

function saSetNotes(id, val) {
  const t = _saData.find(x => x.id == id);
  if (t) t.notes = val;
}

function saMarkAll(status) {
  _saData.forEach(t => { t.status = status; });
  saRenderTable();
  saUpdatePills();
}

/* Toggle showing only pending rows on the staff attendance table */
let _saPendingFilter = false;
function saFilterPending() {
  _saPendingFilter = !_saPendingFilter;
  const btn = document.getElementById('sa-pending-btn');
  if (btn) {
    btn.style.background   = _saPendingFilter ? 'rgba(124,111,205,0.28)' : '';
    btn.style.borderColor  = _saPendingFilter ? 'rgba(124,111,205,0.6)'  : '';
    btn.style.color        = _saPendingFilter ? '#b0a8f0' : '';
    btn.innerHTML = _saPendingFilter
      ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:4px"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>Show All'
      : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:4px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>View Pending';
  }
  document.querySelectorAll('#sa-tbody tr[id^="sa-row-"]').forEach(row => {
    const id  = parseInt(row.id.replace('sa-row-', ''));
    const rec = _saData.find(x => x.id === id);
    row.style.display = (!_saPendingFilter || rec?.status === 'pending' || !rec?.status) ? '' : 'none';
  });
}

let _saStatusFilter = null;

function saUpdatePills() {
  const counts = { present: 0, absent: 0, late: 0, leave: 0, unmarked: 0 };
  _saData.forEach(t => {
    if (t.status && counts[t.status] !== undefined) counts[t.status]++;
    else if (!t.status) counts.unmarked++;
  });
  const el = (id, txt) => { const e = document.getElementById(id); if (e) e.textContent = txt; };
  el('sa-pill-unmarked', `${counts.unmarked} Unmarked`);
  el('sa-pill-present',  `${counts.present} Present`);
  el('sa-pill-absent',   `${counts.absent} Absent`);
  el('sa-pill-late',     `${counts.late} Late`);
  el('sa-pill-leave',    `${counts.leave} Leave`);
}

function saClearPillActive() {
  document.querySelectorAll('#sa-pills .att-pill').forEach(b => b.classList.remove('pill-active'));
}

function saFilterByStatus(status) {
  if (_saStatusFilter === status) {
    _saStatusFilter = null;
    saClearPillActive();
  } else {
    _saStatusFilter = status;
    saClearPillActive();
    const btn = document.getElementById(`sa-pill-${status}`);
    if (btn) btn.classList.add('pill-active');
  }
  saApplyStatusFilter();
}

function saApplyStatusFilter() {
  let visible = 0;
  document.querySelectorAll('#sa-tbody tr[id^="sa-row-"]').forEach(row => {
    if (!_saStatusFilter) { row.style.display = ''; visible++; return; }
    const id  = parseInt(row.id.replace('sa-row-', ''));
    const rec = _saData.find(x => x.id === id);
    const match = _saStatusFilter === 'unmarked' ? (!rec?.status) : (rec?.status === _saStatusFilter);
    row.style.display = match ? '' : 'none';
    if (match) visible++;
  });
  const tbody = document.getElementById('sa-tbody');
  const existing = document.getElementById('sa-no-filter-row');
  if (tbody && _saStatusFilter && visible === 0) {
    if (!existing) {
      const tr = document.createElement('tr');
      tr.id = 'sa-no-filter-row';
      tr.innerHTML = `<td colspan="4" style="text-align:center;padding:28px;color:var(--text-muted)">No records found for this filter.</td>`;
      tbody.appendChild(tr);
    }
  } else if (existing) {
    existing.remove();
  }
}

function saUpdateProgress() {
  const marked   = _saData.filter(t => t.status).length;
  const total    = _saData.length;
  const el       = document.getElementById('sa-progress');
  if (el) el.textContent = `${marked} / ${total} marked`;
}

async function saSaveAttendance() {
  const date = document.getElementById('sa-date')?.value || attToday();
  const records = _saData.filter(t => t.status).map(t => ({ id: t.id, status: t.status, notes: t.notes || '' }));
  if (!records.length) { toast('Mark at least one status first', 'warn'); return; }
  const btn = document.getElementById('sa-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  try {
    const res = await api('api/attendance.php', 'POST', { type: 'staff', date, records });
    toast(`Saved ${res.saved} records for ${attFmtDate(date)}`, 'success');
    const note = document.getElementById('sa-saved-note');
    if (note) note.textContent = `Last saved at ${new Date().toLocaleTimeString()}`;
  } catch (e) {
    toast('Save failed: ' + (e.message || e), 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Save Attendance'; }
  }
}

// ─────────────────────────────────────────────────────────────
// STAFF ATTENDANCE OVERVIEW
// ─────────────────────────────────────────────────────────────
let _aoPage  = 1;
let _aoCache = null; // last full response

function initAttendanceOverviewPage() {
  const f = document.getElementById('ao-from'), t = document.getElementById('ao-to');
  if (f && !f.value) f.value = attMonthStart();
  if (t && !t.value) t.value = attToday();
  if (f) f.addEventListener('change', () => attDebounce('ao-date', () => aoLoad(1)));
  if (t) t.addEventListener('change', () => attDebounce('ao-date', () => aoLoad(1)));
  aoLoadTeacherList().then(() => aoLoad(1));
}

async function aoLoadTeacherList() {
  try {
    const teachers = await api('api/teachers.php');
    const sel = document.getElementById('ao-teacher');
    if (!sel) return;
    teachers.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = (t.title ? t.title + ' ' : '') + t.name;
      sel.appendChild(opt);
    });
  } catch (_) {}
}

async function aoLoad(page = 1) {
  _aoPage = page;
  const from      = document.getElementById('ao-from')?.value    || attMonthStart();
  const to        = document.getElementById('ao-to')?.value      || attToday();
  const teacher   = document.getElementById('ao-teacher')?.value || '';
  const status    = document.getElementById('ao-status')?.value  || '';
  const tbody     = document.getElementById('ao-tbody');
  const countEl   = document.getElementById('ao-count-label');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-muted)">Loading…</td></tr>`;

  let url = `api/attendance.php?type=staff_overview&from=${from}&to=${to}&page=${page}`;
  if (teacher) url += `&teacher_id=${teacher}`;
  if (status)  url += `&status=${status}`;

  try {
    const res = await api(url);
    _aoCache  = res;
    aoRenderStats(res.summary);
    aoRenderTable(res);
    if (countEl) countEl.textContent = `${res.total} record${res.total != 1 ? 's' : ''}`;
    aoRenderPagination(res.page, res.pages);
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--danger)">Error: ${e.message || e}</td></tr>`;
  }
}

function aoRenderStats(s) {
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  set('ao-stat-total',   s.total);
  set('ao-stat-present', s.present);
  set('ao-stat-absent',  s.absent);
  set('ao-stat-late',    s.late);
  set('ao-stat-leave',   s.leave);
  set('ao-stat-pending', s.pending || 0);
  set('ao-stat-present-pct', s.total ? attPct(s.present, s.total) : '');
  set('ao-stat-absent-pct',  s.total ? attPct(s.absent,  s.total) : '');
}

function aoRenderTable(res) {
  const tbody = document.getElementById('ao-tbody');
  if (!res.records.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-muted)">No records found.</td></tr>`;
    return;
  }
  tbody.innerHTML = res.records.map(r => `
    <tr>
      <td style="white-space:nowrap">${attFmtDateShort(r.date)}</td>
      <td style="font-weight:600">${escapeHtml(r.teacher_name)}</td>
      <td style="color:var(--text-muted);font-size:0.82rem">${escapeHtml(r.designation || '—')}</td>
      <td>${attStatusBadge(r.status)}</td>
      <td style="color:var(--text-muted);font-size:0.82rem;max-width:180px">${escapeHtml(r.notes || '—')}</td>
      <td>
        <button class="btn-action btn-edit" onclick="aoEditRecord(${r.id},${JSON.stringify(escapeHtml(r.teacher_name))},'${r.date}','${r.status}',${JSON.stringify(r.notes||'')})" >Edit</button>
        <button class="btn-action btn-danger" onclick="aoDeleteRecord(${r.id})" style="margin-left:4px">Delete</button>
      </td>
    </tr>`).join('');
}

function aoRenderPagination(page, pages) {
  const el = document.getElementById('ao-pagination');
  if (!el || pages <= 1) { if (el) el.innerHTML = ''; return; }
  const btns = [];
  btns.push(`<button class="ao-p-btn" onclick="aoLoad(${page - 1})" ${page <= 1 ? 'disabled' : ''}>&laquo; Prev</button>`);
  const start = Math.max(1, page - 2), end = Math.min(pages, page + 2);
  for (let i = start; i <= end; i++) {
    btns.push(`<button class="ao-p-btn" onclick="aoLoad(${i})" style="${i === page ? 'background:rgba(201,168,76,.25);color:var(--accent2)' : ''}">${i}</button>`);
  }
  btns.push(`<button class="ao-p-btn" onclick="aoLoad(${page + 1})" ${page >= pages ? 'disabled' : ''}>Next &raquo;</button>`);
  btns.push(`<span class="ao-p-info">Page ${page} of ${pages}</span>`);
  el.innerHTML = btns.join('');
}

let _aoEditCurrent = {};
function aoEditRecord(id, name, date, status, notes) {
  _aoEditCurrent = { id, status };
  document.getElementById('ao-edit-id').value        = id;
  document.getElementById('ao-edit-name').textContent = name;
  document.getElementById('ao-edit-date-disp').textContent = attFmtDateShort(date);
  document.getElementById('ao-edit-notes').value     = notes || '';
  document.querySelectorAll('#ao-edit-status-row .att-status-btn').forEach(btn => {
    btn.classList.toggle('active-' + btn.dataset.s, btn.dataset.s === status);
  });
  document.getElementById('ao-edit-modal').style.display = 'flex';
}
function aoEditPickStatus(s) {
  _aoEditCurrent.status = s;
  document.querySelectorAll('#ao-edit-status-row .att-status-btn').forEach(btn => {
    btn.className = 'att-status-btn' + (btn.dataset.s === s ? ' active-' + s : '');
  });
}
async function aoSaveEdit() {
  const id     = document.getElementById('ao-edit-id').value;
  const status = _aoEditCurrent.status;
  const notes  = document.getElementById('ao-edit-notes').value.trim();
  if (!id || !status) { toast('Select a status first', 'warn'); return; }
  try {
    await api('api/attendance.php', 'PUT', { type: 'staff', id: parseInt(id), status, notes });
    toast('Record updated', 'success');
    aoCloseEditModal();
    aoLoad(_aoPage);
  } catch (e) {
    toast('Update failed: ' + e.message, 'error');
  }
}
function aoCloseEditModal() {
  document.getElementById('ao-edit-modal').style.display = 'none';
}

async function aoDeleteRecord(id) {
  if (!confirm('Delete this attendance record?')) return;
  try {
    await api('api/attendance.php', 'DELETE', { type: 'staff', id });
    toast('Record deleted', 'success');
    aoLoad(_aoPage);
  } catch (e) {
    toast('Delete failed', 'error');
  }
}

function aoDownloadExcel() {
  if (!_aoCache?.records?.length) { toast('No data to export', 'warn'); return; }
  const rows = [['Date', 'Staff Member', 'Designation', 'Status', 'Remarks']];
  _aoCache.records.forEach(r => rows.push([r.date, r.teacher_name, r.designation || '', r.status, r.notes || '']));
  attExportXLSX(rows, 'Staff_Attendance');
}

function aoDownloadPDF() {
  if (!_aoCache?.records?.length) { toast('No data to export', 'warn'); return; }
  const from  = document.getElementById('ao-from')?.value || '';
  const to    = document.getElementById('ao-to')?.value   || '';
  const title = `Staff Attendance — ${from} to ${to}`;
  const heads = ['Date', 'Staff Member', 'Designation', 'Status', 'Remarks'];
  const rows  = _aoCache.records.map(r => [r.date, r.teacher_name, r.designation || '', r.status, r.notes || '']);
  attExportPDF(title, heads, rows);
}

// ─────────────────────────────────────────────────────────────
// STUDENT ATTENDANCE — Mark page
// ─────────────────────────────────────────────────────────────
let _stattData = [];

async function initStudentAttendancePage() {
  const inp = document.getElementById('statt-date');
  if (inp && !inp.value) inp.value = attToday();
  // populate class list
  const sel = document.getElementById('statt-class');
  if (!sel) return;
  try {
    const cls = await api('api/classes.php');
    cls.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id; opt.textContent = c.name; sel.appendChild(opt);
    });
  } catch (_) {}
  // Auto-load with "All Classes" selected by default
  stattLoad();
}

let _stattStatusFilter = null; // null = show all

async function stattLoad() {
  const classId = document.getElementById('statt-class')?.value || '';
  const date    = document.getElementById('statt-date')?.value  || attToday();
  const wrap    = document.getElementById('statt-table-wrap');
  const bulk    = document.getElementById('statt-bulk');
  const savebar = document.getElementById('statt-save-bar');
  const info    = document.getElementById('statt-enroll-info');
  // reset filters on reload
  _stattPendingFilter = false;
  _stattStatusFilter  = null;
  stattClearPillActive();
  const pb = document.getElementById('statt-pending-btn');
  if (pb) { pb.style.background = pb.style.borderColor = pb.style.color = ''; pb.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:4px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>View Pending'; }

  // Show/hide Class column
  const thClass = document.getElementById('statt-th-class');
  if (thClass) thClass.style.display = classId ? 'none' : '';

  const tbody = document.getElementById('statt-tbody');
  const cols = classId ? 4 : 5;
  if (tbody) tbody.innerHTML = `<tr><td colspan="${cols}" style="text-align:center;padding:32px;color:var(--text-muted)">Loading…</td></tr>`;
  if (wrap) wrap.style.display = '';
  if (bulk) bulk.style.display = 'flex';
  if (savebar) savebar.style.display = 'flex';

  try {
    const url = classId
      ? `api/attendance.php?type=student&date=${encodeURIComponent(date)}&class_id=${classId}`
      : `api/attendance.php?type=student&date=${encodeURIComponent(date)}&class_id=0`;
    const res = await api(url);
    _stattData = res.students.map(s => ({ ...s, status: s.status || null, notes: s.notes || '' }));
    stattRenderTable();
    stattUpdatePills();
    if (info) info.textContent = `${_stattData.length} student${_stattData.length != 1 ? 's' : ''}${classId ? ' enrolled' : ' across all classes'}`;
  } catch (e) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="${cols}" style="text-align:center;padding:24px;color:var(--danger)">Failed: ${e.message}</td></tr>`;
  }
}

function stattRenderTable() {
  const tbody   = document.getElementById('statt-tbody');
  const classId = document.getElementById('statt-class')?.value || '';
  const showClass = !classId;
  if (!tbody) return;
  const cols = showClass ? 5 : 4;
  if (!_stattData.length) {
    tbody.innerHTML = `<tr><td colspan="${cols}" style="text-align:center;padding:32px;color:var(--text-muted)">No students found.</td></tr>`;
    return;
  }
  tbody.innerHTML = _stattData.map((s, i) => {
    const rowCls  = s.status ? `att-row-${s.status}` : '';
    const classCol = showClass ? `<td style="font-size:0.8rem;color:var(--text-muted)">${escapeHtml(s.class_name || '—')}</td>` : '';
    return `<tr class="${rowCls}" id="statt-row-${s.id}">
      <td class="att-num">${i + 1}</td>
      <td>
        <div class="att-name-cell">${escapeHtml(s.full_name)}</div>
        ${s.reg_number ? `<div class="att-designation">${escapeHtml(s.reg_number)}</div>` : ''}
      </td>
      ${classCol}
      <td>
        <div class="att-status-row">
          ${['present','absent','late','leave'].map(st =>
            `<button class="att-status-btn${s.status === st ? ` active-${st}` : ''}"
              onclick="stattSetStatus(${s.id},'${st}')" data-s="${st}">${st.charAt(0).toUpperCase() + st.slice(1)}</button>`
          ).join('')}
        </div>
      </td>
      <td>
        <input type="text" class="att-notes-input" value="${escapeHtml(s.notes)}"
          placeholder="Optional remark…" maxlength="255"
          oninput="stattSetNotes(${s.id},this.value)">
      </td>
    </tr>`;
  }).join('');
  stattApplyStatusFilter();
  stattUpdateProgress();
}

function stattSetStatus(id, status) {
  const s = _stattData.find(x => x.id == id);
  if (!s) return;
  s.status = status;
  const row = document.getElementById(`statt-row-${id}`);
  if (row) {
    row.className = `att-row-${status}`;
    row.querySelectorAll('.att-status-btn').forEach(btn => {
      const st = btn.getAttribute('data-s');
      btn.className = 'att-status-btn' + (st === status ? ` active-${st}` : '');
    });
  }
  stattUpdatePills();
  stattUpdateProgress();
}

function stattSetNotes(id, val) {
  const s = _stattData.find(x => x.id == id);
  if (s) s.notes = val;
}

function stattMarkAll(status) {
  _stattData.forEach(s => { s.status = status; });
  stattRenderTable();
  stattUpdatePills();
}

/* Toggle showing only pending rows on the student attendance table */
let _stattPendingFilter = false;
function stattFilterPending() {
  _stattPendingFilter = !_stattPendingFilter;
  const btn = document.getElementById('statt-pending-btn');
  if (btn) {
    btn.style.background  = _stattPendingFilter ? 'rgba(124,111,205,0.28)' : '';
    btn.style.borderColor = _stattPendingFilter ? 'rgba(124,111,205,0.6)'  : '';
    btn.style.color       = _stattPendingFilter ? '#b0a8f0' : '';
    btn.innerHTML = _stattPendingFilter
      ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:4px"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>Show All'
      : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:4px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>View Pending';
  }
  document.querySelectorAll('#statt-tbody tr[id^="statt-row-"]').forEach(row => {
    const id  = parseInt(row.id.replace('statt-row-', ''));
    const rec = _stattData.find(x => x.id === id);
    row.style.display = (!_stattPendingFilter || rec?.status === 'pending' || !rec?.status) ? '' : 'none';
  });
}

function stattUpdatePills() {
  const counts = { present: 0, absent: 0, late: 0, leave: 0, pending: 0, unmarked: 0 };
  _stattData.forEach(s => {
    if (s.status && counts[s.status] !== undefined) counts[s.status]++;
    else if (!s.status) counts.unmarked++;
  });
  const el = (id, txt) => { const e = document.getElementById(id); if (e) e.textContent = txt; };
  el('statt-pill-unmarked', `${counts.unmarked} Unmarked`);
  el('statt-pill-present',  `${counts.present} Present`);
  el('statt-pill-absent',   `${counts.absent} Absent`);
  el('statt-pill-late',     `${counts.late} Late`);
  el('statt-pill-leave',    `${counts.leave} Leave`);
  el('statt-pill-pending',  `${counts.pending} Pending`);
}

function stattClearPillActive() {
  document.querySelectorAll('#statt-pills .att-pill').forEach(b => b.classList.remove('pill-active'));
}

function stattFilterByStatus(status) {
  // Toggle: clicking the active filter clears it
  if (_stattStatusFilter === status) {
    _stattStatusFilter = null;
    stattClearPillActive();
  } else {
    _stattStatusFilter = status;
    stattClearPillActive();
    const btn = document.getElementById(`statt-pill-${status}`);
    if (btn) btn.classList.add('pill-active');
  }
  stattApplyStatusFilter();
}

function stattApplyStatusFilter() {
  let visible = 0;
  const classId  = document.getElementById('statt-class')?.value || '';
  const colspan  = classId ? 4 : 5;
  document.querySelectorAll('#statt-tbody tr[id^="statt-row-"]').forEach(row => {
    if (!_stattStatusFilter) { row.style.display = ''; visible++; return; }
    const id  = parseInt(row.id.replace('statt-row-', ''));
    const rec = _stattData.find(x => x.id === id);
    const match = _stattStatusFilter === 'unmarked' ? (!rec?.status) : (rec?.status === _stattStatusFilter);
    row.style.display = match ? '' : 'none';
    if (match) visible++;
  });
  const tbody = document.getElementById('statt-tbody');
  const existing = document.getElementById('statt-no-filter-row');
  if (tbody && _stattStatusFilter && visible === 0) {
    if (!existing) {
      const tr = document.createElement('tr');
      tr.id = 'statt-no-filter-row';
      tr.innerHTML = `<td colspan="${colspan}" style="text-align:center;padding:28px;color:var(--text-muted)">No records found for this filter.</td>`;
      tbody.appendChild(tr);
    }
  } else if (existing) {
    existing.remove();
  }
}

function stattUpdateProgress() {
  const marked = _stattData.filter(s => s.status).length;
  const el = document.getElementById('statt-progress');
  if (el) el.textContent = `${marked} / ${_stattData.length} marked`;
}

async function stattSave() {
  const date    = document.getElementById('statt-date')?.value || attToday();
  const classId = parseInt(document.getElementById('statt-class')?.value || '0');
  // When all-classes mode, each record carries its own class_id from the student record
  const records = _stattData.filter(s => s.status).map(s => ({
    id: s.id, status: s.status, notes: s.notes || '',
    class_id: s.class_id || classId
  }));
  if (!records.length) { toast('Mark at least one status', 'warn'); return; }
  try {
    const res = await api('api/attendance.php', 'POST', { type: 'student', date, class_id: classId, records });
    toast(`Saved ${res.saved} records for ${attFmtDate(date)}`, 'success');
    const note = document.getElementById('statt-saved-note');
    if (note) note.textContent = `Saved at ${new Date().toLocaleTimeString()}`;
  } catch (e) {
    toast('Save failed: ' + (e.message || e), 'error');
  }
}

// ─────────────────────────────────────────────────────────────
// STUDENT ATTENDANCE OVERVIEW
// ─────────────────────────────────────────────────────────────
let _saoPage  = 1;
let _saoCache = null;
let _saoAllStudents = [];

async function initStudentAttendanceOverviewPage() {
  const f = document.getElementById('sao-from'), t = document.getElementById('sao-to');
  if (f && !f.value) f.value = attMonthStart();
  if (t && !t.value) t.value = attToday();
  if (f) f.addEventListener('change', () => attDebounce('sao-date', () => saoLoad(1)));
  if (t) t.addEventListener('change', () => attDebounce('sao-date', () => saoLoad(1)));
  await Promise.all([saoLoadClasses(), saoLoadStudents()]);
  saoLoad(1);
}

async function saoLoadClasses() {
  try {
    const cls = await api('api/classes.php');
    const sel = document.getElementById('sao-class');
    if (!sel) return;
    cls.forEach(c => {
      const opt = document.createElement('option'); opt.value = c.id; opt.textContent = c.name; sel.appendChild(opt);
    });
  } catch (_) {}
}

async function saoLoadStudents() {
  try {
    const students = await api('api/students.php');
    _saoAllStudents = (students || []).filter(s => s.registration_status === 'confirmed');
    saoPopulateStudentSelect('');
  } catch (_) {}
}

function saoPopulateStudentSelect(classFilter) {
  const sel = document.getElementById('sao-student');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">All Students</option>';
  _saoAllStudents.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = `${s.student_name}${s.gr_number ? ' ('+s.gr_number+')' : ''}`;
    sel.appendChild(opt);
  });
  if (current) sel.value = current;
}

async function saoLoad(page = 1) {
  _saoPage = page;
  const from      = document.getElementById('sao-from')?.value     || attMonthStart();
  const to        = document.getElementById('sao-to')?.value       || attToday();
  const classId   = document.getElementById('sao-class')?.value    || '';
  const studentId = document.getElementById('sao-student')?.value  || '';
  const status    = document.getElementById('sao-status')?.value   || '';
  const tbody     = document.getElementById('sao-tbody');
  const countEl   = document.getElementById('sao-count-label');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted)">Loading…</td></tr>`;

  let url = `api/attendance.php?type=student_overview&from=${from}&to=${to}&page=${page}`;
  if (classId)   url += `&class_id=${classId}`;
  if (studentId) url += `&student_id=${studentId}`;
  if (status)    url += `&status=${status}`;

  try {
    const res = await api(url);
    _saoCache  = res;
    saoRenderStats(res.summary);
    saoRenderTable(res);
    if (countEl) countEl.textContent = `${res.total} record${res.total != 1 ? 's' : ''}`;
    saoRenderPagination(res.page, res.pages);
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--danger)">Error: ${e.message || e}</td></tr>`;
  }
}

function saoRenderStats(s) {
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  set('sao-stat-total',   s.total);
  set('sao-stat-present', s.present);
  set('sao-stat-absent',  s.absent);
  set('sao-stat-late',    s.late);
  set('sao-stat-leave',   s.leave);
  set('sao-stat-pending', s.pending || 0);
  set('sao-stat-present-pct', s.total ? attPct(s.present, s.total) : '');
  set('sao-stat-absent-pct',  s.total ? attPct(s.absent,  s.total) : '');
}

function saoRenderTable(res) {
  const tbody = document.getElementById('sao-tbody');
  if (!res.records.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted)">No records found.</td></tr>`;
    return;
  }
  tbody.innerHTML = res.records.map(r => `
    <tr>
      <td style="white-space:nowrap">${attFmtDateShort(r.date)}</td>
      <td style="font-weight:600">${escapeHtml(r.student_name)}</td>
      <td style="color:var(--text-muted);font-size:0.82rem">${escapeHtml(r.reg_number || '—')}</td>
      <td style="color:var(--text-muted);font-size:0.82rem">${escapeHtml(r.class_name || '—')}</td>
      <td>${attStatusBadge(r.status)}</td>
      <td style="color:var(--text-muted);font-size:0.82rem;max-width:160px">${escapeHtml(r.notes || '—')}</td>
      <td>
        <button class="btn-action btn-edit" onclick="saoEditRecord(${r.id},${JSON.stringify(escapeHtml(r.student_name))},'${r.date}','${r.status}',${JSON.stringify(r.notes||'')})" >Edit</button>
        <button class="btn-action btn-danger" onclick="saoDeleteRecord(${r.id})" style="margin-left:4px">Delete</button>
      </td>
    </tr>`).join('');
}

function saoRenderPagination(page, pages) {
  const el = document.getElementById('sao-pagination');
  if (!el || pages <= 1) { if (el) el.innerHTML = ''; return; }
  const btns = [];
  btns.push(`<button class="ao-p-btn" onclick="saoLoad(${page - 1})" ${page <= 1 ? 'disabled' : ''}>&laquo; Prev</button>`);
  const start = Math.max(1, page - 2), end = Math.min(pages, page + 2);
  for (let i = start; i <= end; i++) {
    btns.push(`<button class="ao-p-btn" onclick="saoLoad(${i})" style="${i === page ? 'background:rgba(201,168,76,.25);color:var(--accent2)' : ''}">${i}</button>`);
  }
  btns.push(`<button class="ao-p-btn" onclick="saoLoad(${page + 1})" ${page >= pages ? 'disabled' : ''}>Next &raquo;</button>`);
  btns.push(`<span class="ao-p-info">Page ${page} of ${pages}</span>`);
  el.innerHTML = btns.join('');
}

let _saoEditCurrent = {};
function saoEditRecord(id, name, date, status, notes) {
  _saoEditCurrent = { id, status };
  document.getElementById('sao-edit-id').value        = id;
  document.getElementById('sao-edit-name').textContent = name;
  document.getElementById('sao-edit-date-disp').textContent = attFmtDateShort(date);
  document.getElementById('sao-edit-notes').value     = notes || '';
  document.querySelectorAll('#sao-edit-status-row .att-status-btn').forEach(btn => {
    btn.classList.toggle('active-' + btn.dataset.s, btn.dataset.s === status);
  });
  document.getElementById('sao-edit-modal').style.display = 'flex';
}
function saoEditPickStatus(s) {
  _saoEditCurrent.status = s;
  document.querySelectorAll('#sao-edit-status-row .att-status-btn').forEach(btn => {
    btn.className = 'att-status-btn' + (btn.dataset.s === s ? ' active-' + s : '');
  });
}
async function saoSaveEdit() {
  const id     = document.getElementById('sao-edit-id').value;
  const status = _saoEditCurrent.status;
  const notes  = document.getElementById('sao-edit-notes').value.trim();
  if (!id || !status) { toast('Select a status first', 'warn'); return; }
  try {
    await api('api/attendance.php', 'PUT', { type: 'student', id: parseInt(id), status, notes });
    toast('Record updated', 'success');
    saoCloseEditModal();
    saoLoad(_saoPage);
  } catch (e) {
    toast('Update failed: ' + e.message, 'error');
  }
}
function saoCloseEditModal() {
  document.getElementById('sao-edit-modal').style.display = 'none';
}

async function saoDeleteRecord(id) {
  if (!confirm('Delete this attendance record?')) return;
  try {
    await api('api/attendance.php', 'DELETE', { type: 'student', id });
    toast('Record deleted', 'success');
    saoLoad(_saoPage);
  } catch (e) {
    toast('Delete failed', 'error');
  }
}

function saoDownloadExcel() {
  if (!_saoCache?.records?.length) { toast('No data to export', 'warn'); return; }
  const rows = [['Date', 'Student', 'Reg No.', 'Class', 'Status', 'Remarks']];
  _saoCache.records.forEach(r => rows.push([r.date, r.student_name, r.reg_number || '', r.class_name || '', r.status, r.notes || '']));
  attExportXLSX(rows, 'Student_Attendance');
}

function saoDownloadPDF() {
  if (!_saoCache?.records?.length) { toast('No data to export', 'warn'); return; }
  const from  = document.getElementById('sao-from')?.value || '';
  const to    = document.getElementById('sao-to')?.value   || '';
  const title = `Student Attendance — ${from} to ${to}`;
  const heads = ['Date', 'Student', 'Reg No.', 'Class', 'Status', 'Remarks'];
  const rows  = _saoCache.records.map(r => [r.date, r.student_name, r.reg_number || '', r.class_name || '', r.status, r.notes || '']);
  attExportPDF(title, heads, rows);
}

// ─────────────────────────────────────────────────────────────
// SHARED EXPORT HELPERS
// ─────────────────────────────────────────────────────────────
function attExportXLSX(rows, filename) {
  if (typeof XLSX === 'undefined') { toast('XLSX library not loaded', 'error'); return; }
  const wb  = XLSX.utils.book_new();
  const ws  = XLSX.utils.aoa_to_sheet(rows);
  // Style header row width
  ws['!cols'] = rows[0].map((_, i) => ({ wch: Math.max(12, ...rows.map(r => String(r[i] || '').length)) }));
  XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
  XLSX.writeFile(wb, `${filename}_${attToday()}.xlsx`);
}

function attExportPDF(title, headers, rows) {
  const win = window.open('', '_blank');
  if (!win) { toast('Popup blocked', 'warn'); return; }
  const statusColor = { present: '#4caf50', absent: '#f44336', late: '#ffc107', leave: '#00bfa5' };
  const trs = rows.map(r =>
    `<tr>${r.map((cell, i) => {
      const isStatus = headers[i] === 'Status';
      const col = isStatus ? (statusColor[cell] || '#999') : '';
      return `<td style="${isStatus ? `color:${col};font-weight:700` : ''}">${cell}</td>`;
    }).join('')}</tr>`
  ).join('');

  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body{font-family:Georgia,serif;background:#fff;color:#111;padding:20px}
    h2{font-size:1.1rem;font-weight:700;margin-bottom:4px;color:#222}
    p{font-size:0.78rem;color:#666;margin-bottom:16px}
    table{width:100%;border-collapse:collapse;font-size:0.82rem}
    th{background:#1a1a3e;color:#c9a84c;text-transform:uppercase;letter-spacing:.05em;padding:9px 10px;text-align:left;font-size:0.7rem}
    tr:nth-child(even){background:#f7f7fc}
    td{padding:7px 10px;border-bottom:1px solid #e0e0e0}
    @media print{@page{margin:15mm}}
  </style></head><body>
  <h2>${title}</h2>
  <p>Generated: ${new Date().toLocaleString()}</p>
  <table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${trs}</tbody></table>
  <script>window.onload=()=>{window.print()}<\/script>
  </body></html>`);
  win.document.close();
}

// =============================================================
// DIGITAL ATTENDANCE — Barcode Scanner + ID Card Generator
// =============================================================
let _daStream     = null;
let _daScanActive = false;
let _daLastCode   = '';
let _daLastCodeTs = 0;
let _daLog        = [];
let _daMode       = 'staff';
let _daCardData   = [];        // full card data for individual PDF print
let _daCardAll    = [];        // unfiltered, for search/filter reset

function initDigitalAttendancePage() {
  const inp = document.getElementById('da-date');
  if (inp && !inp.value) inp.value = attToday();

  // Sync late-time inputs from global school settings
  const s = window.schoolSettings || {};
  const staffEl   = document.getElementById('da-staff-late-time');
  const studentEl = document.getElementById('da-student-late-time');
  if (staffEl && s.teacher_late_after) {
    staffEl.value = s.teacher_late_after;
    const d = document.getElementById('da-staff-late-disp');
    if (d) { const t = d.querySelector('span'); if (t) t.textContent = s.teacher_late_after; }
  }
  if (studentEl && s.student_late_after) {
    studentEl.value = s.student_late_after;
    const d = document.getElementById('da-student-late-disp');
    if (d) { const t = d.querySelector('span'); if (t) t.textContent = s.student_late_after; }
  }
}

function initStaffIdCardsPage()   { bgcInitPage(); }
function initStudentIdCardsPage() { sicInitPage(); }

// =============================================================
//  SHARED — Principal Signature (used by both BGC + SIC)
// =============================================================
const PRINCIPAL_SIG_LS = 'idl_principal_sig';

function principalSigGet() {
  return localStorage.getItem(PRINCIPAL_SIG_LS) || '';
}

function principalSigBuildHtml(sigData, wrapCls, imgStyle) {
  if (!sigData) return '';
  return `<img src="${sigData}" style="${imgStyle || 'max-width:100%;max-height:100%;object-fit:contain;display:block'}" alt="Principal Sig">`;
}

function bgcUpdateSigPreview(data, imgId, phId) {
  const img = document.getElementById(imgId);
  const ph  = document.getElementById(phId);
  if (!img || !ph) return;
  if (data) { img.src = data; img.style.display = 'block'; ph.style.display = 'none'; }
  else       { img.style.display = 'none'; ph.style.display = ''; }
}

function bgcUploadSig(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const data = e.target.result;
    localStorage.setItem(PRINCIPAL_SIG_LS, data);
    bgcUpdateSigPreview(data, 'bgcs-sig-img', 'bgcs-sig-placeholder');
    bgcRenderCards(_bgcData);
    toast('Signature uploaded', 'success');
  };
  reader.readAsDataURL(file);
  input.value = '';
}

function bgcClearSig() {
  localStorage.removeItem(PRINCIPAL_SIG_LS);
  bgcUpdateSigPreview('', 'bgcs-sig-img', 'bgcs-sig-placeholder');
  bgcRenderCards(_bgcData);
  toast('Signature removed', 'info');
}

function sicUploadSig(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const data = e.target.result;
    localStorage.setItem(PRINCIPAL_SIG_LS, data);
    bgcUpdateSigPreview(data, 'sics-sig-img', 'sics-sig-placeholder');
    sicRenderCards(_sicData);
    toast('Signature uploaded', 'success');
  };
  reader.readAsDataURL(file);
  input.value = '';
}

function sicClearSig() {
  localStorage.removeItem(PRINCIPAL_SIG_LS);
  bgcUpdateSigPreview('', 'sics-sig-img', 'sics-sig-placeholder');
  sicRenderCards(_sicData);
  toast('Signature removed', 'info');
}

// =============================================================
//  BLUE-GOLD STAFF ID CARDS  (BGC)
// =============================================================
const BGC_DEFAULTS = {
  orgName:     'INSTITUTE OF DYNAMIC LEARNING',
  orgSub:      'STAFF IDENTITY CARD',
  footerAddr:  'IDL-107-A, Peoples Colony No.1, Faisalabad',
  footerPhone: 'Ph: 0304-8555545',
  backHname:   'INSTITUTE OF DYNAMIC LEARNING',
  backSub:     'FAISALABAD · PAKISTAN',
  tc1:         'This card is property of IDL and must be carried during working hours as a means of identification.',
  tc2:         'Return this card immediately upon resignation, termination, or expiry of contract.',
  website:     'idl.faisalabad.edu.pk',
  backPhone:   '0304-8555545',
  backFooter:  'INSTITUTE OF DYNAMIC LEARNING · FAISALABAD',
};
const BGC_LS_KEY = 'bgc_card_settings';

let _bgcAll  = [];   // unfiltered teacher list
let _bgcData = [];   // filtered teacher list

function bgcGetSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(BGC_LS_KEY) || '{}');
    return Object.assign({}, BGC_DEFAULTS, saved);
  } catch(e) { return { ...BGC_DEFAULTS }; }
}

function bgcLoadSettingsToForm() {
  const s = bgcGetSettings();
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  set('bgcs-org-name',    s.orgName);
  set('bgcs-org-sub',     s.orgSub);
  set('bgcs-footer-addr', s.footerAddr);
  set('bgcs-footer-phone',s.footerPhone);
  set('bgcs-back-hname',  s.backHname);
  set('bgcs-back-sub',    s.backSub);
  set('bgcs-tc1',         s.tc1);
  set('bgcs-tc2',         s.tc2);
  set('bgcs-website',     s.website);
  set('bgcs-back-phone',  s.backPhone);
  set('bgcs-back-footer', s.backFooter);
  bgcUpdateSigPreview(principalSigGet(), 'bgcs-sig-img', 'bgcs-sig-placeholder');
}

function bgcReadSettingsFromForm() {
  const v = id => document.getElementById(id)?.value?.trim() || '';
  return {
    orgName:    v('bgcs-org-name')    || BGC_DEFAULTS.orgName,
    orgSub:     v('bgcs-org-sub')     || BGC_DEFAULTS.orgSub,
    footerAddr: v('bgcs-footer-addr') || BGC_DEFAULTS.footerAddr,
    footerPhone:v('bgcs-footer-phone')|| BGC_DEFAULTS.footerPhone,
    backHname:  v('bgcs-back-hname')  || BGC_DEFAULTS.backHname,
    backSub:    v('bgcs-back-sub')    || BGC_DEFAULTS.backSub,
    tc1:        v('bgcs-tc1')         || BGC_DEFAULTS.tc1,
    tc2:        v('bgcs-tc2')         || BGC_DEFAULTS.tc2,
    website:    v('bgcs-website')     || BGC_DEFAULTS.website,
    backPhone:  v('bgcs-back-phone')  || BGC_DEFAULTS.backPhone,
    backFooter: v('bgcs-back-footer') || BGC_DEFAULTS.backFooter,
  };
}

function bgcSaveSettings() {
  const s = bgcReadSettingsFromForm();
  try { localStorage.setItem(BGC_LS_KEY, JSON.stringify(s)); } catch(e) {}
  bgcRenderCards(_bgcData);
  toast('Card settings saved', 'success');
}

function bgcResetSettings() {
  try { localStorage.removeItem(BGC_LS_KEY); } catch(e) {}
  bgcLoadSettingsToForm();
  bgcRenderCards(_bgcData);
  toast('Reset to defaults', 'success');
}

function bgcApplySettings() {
  // Re-render with current form values (live preview)
  bgcRenderCards(_bgcData);
}

function bgcToggleSettings() {
  const body  = document.getElementById('bgc-settings-body');
  const title = document.getElementById('bgc-settings-toggle');
  const caret = document.getElementById('bgc-caret');
  if (!body) return;
  const open = body.classList.toggle('open');
  if (title) title.classList.toggle('open', open);
  if (caret) caret.style.transform = open ? 'rotate(180deg)' : '';
}

function bgcCardFilter() {
  const q = (document.getElementById('idc-search')?.value || '').toLowerCase().trim();
  _bgcData = q
    ? _bgcAll.filter(p => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || (p.role||'').toLowerCase().includes(q))
    : [..._bgcAll];
  bgcRenderCards(_bgcData);
}

async function bgcInitPage() {
  bgcLoadSettingsToForm();
  const grid = document.getElementById('da-cards-grid');
  if (grid) grid.innerHTML = `<div class="da-cards-loading"><div style="opacity:.4">Loading staff cards…</div></div>`;
  const srch = document.getElementById('idc-search');
  if (srch) srch.value = '';
  try {
    const raw = await api('api/teachers.php');
    _bgcAll = (raw || []).map(t => ({
      id:          t.id,
      type:        'staff',
      code:        `IDL-STAFF-${t.id}`,
      name:        ((t.title ? t.title + ' ' : '') + (t.name || '')).trim() || '—',
      role:        t.designation || t.role || 'Staff',
      phone:       t.phone || '',
      blood:       t.blood_group || '',
      nic:         t.nic_number || '',
      joining:     t.joining_date || '',
      address:     t.address || '',
      photo:       t.photo || '',
    }));
    _bgcData = [..._bgcAll];
    bgcRenderCards(_bgcData);
  } catch(e) {
    if (grid) grid.innerHTML = `<div class="da-cards-loading" style="color:var(--danger)">Error loading teachers: ${escapeHtml(e.message)}</div>`;
  }
}

/* Helper: generate a deterministic barcode pattern from a string seed */
function bgcBarcodeRects(seed, w, h, count) {
  // Simple seeded pseudo-random, always same bars for same teacher code
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (Math.imul(31, hash) + seed.charCodeAt(i)) | 0;
  const rects = [];
  const minW = 1, maxW = 3.5;
  let x = 0;
  while (x < w - maxW && rects.length < count) {
    hash = (Math.imul(1664525, hash) + 1013904223) | 0;
    const barW = minW + (Math.abs(hash) % 100) / 100 * (maxW - minW);
    const gap  = 1.5 + (Math.abs(hash >> 8) % 100) / 100 * 2.5;
    rects.push({ x: x.toFixed(2), w: barW.toFixed(2), h });
    x += barW + gap;
  }
  return rects;
}

function bgcBarcodeSVG(code, svgW, svgH) {
  const rects = bgcBarcodeRects(code, svgW, svgH, 30);
  const bars  = rects.map(r => `<rect x="${r.x}" y="0" width="${r.w}" height="${r.h}" fill="#0d1b6e"/>`).join('');
  return `<svg width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">${bars}</svg>`;
}

function bgcRenderCards(people) {
  const grid    = document.getElementById('da-cards-grid');
  const countEl = document.getElementById('idc-count');
  if (!grid) return;

  if (countEl) countEl.textContent = `${people.length} card${people.length !== 1 ? 's' : ''}`;
  if (!people.length) { grid.innerHTML = '<div class="da-cards-loading">No staff cards found</div>'; return; }

  const s = bgcReadSettingsFromForm();
  const logoSrc = 'assets/logo.jpeg';

  grid.innerHTML = people.map((p, idx) => {
    const initial    = (p.name || '?')[0].toUpperCase();
    const barcodeId  = `bgc-bc-${p.id}`;
    const barcodeIdB = `bgc-bc-back-${p.id}`;

    // Photo HTML (front)
    const photoHtml = p.photo
      ? `<img src="${escapeHtml(p.photo)}" alt=""
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
         <span class="bgc-f-photo-init" style="display:none;align-items:center;justify-content:center;position:absolute;inset:0">${initial}</span>`
      : `<span class="bgc-f-photo-init">${initial}</span>`;

    // Front info grid
    const joined = p.joining ? new Date(p.joining).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—';
    const frontGrid = `
      <div class="bgc-f-field"><span class="bgc-f-flbl">Phone</span><span class="bgc-f-fval">${escapeHtml(p.phone || '—')}</span></div>
      <div class="bgc-f-field"><span class="bgc-f-flbl">Joined</span><span class="bgc-f-fval">${escapeHtml(joined)}</span></div>
      <div class="bgc-f-field"><span class="bgc-f-flbl">NIC No.</span><span class="bgc-f-fval">${escapeHtml(p.nic || '—')}</span></div>
      <div class="bgc-f-field"><span class="bgc-f-flbl">Blood Group</span><span class="bgc-f-fval">${escapeHtml(p.blood || '—')}</span></div>
      <div class="bgc-f-field" style="grid-column:1/-1"><span class="bgc-f-flbl">Address</span><span class="bgc-f-fval">${escapeHtml(p.address || '—')}</span></div>
    `;

    return `
    <div class="bgc-pair-wrap">
      <!-- FRONT LABEL -->
      <div class="bgc-pair-label">Front — ${escapeHtml(p.name)}</div>

      <!-- ═══ FRONT CARD ═══ -->
      <div class="bgc-card bgc-front">
        <div class="bgc-f-header"></div>
        <!-- Dot grid -->
        <div class="bgc-f-dots">
          ${'<div class="bgc-f-dot"></div>'.repeat(12)}
        </div>
        <!-- Header content -->
        <div class="bgc-f-hcontent">
          <div class="bgc-f-logo">
            <img src="${logoSrc}" alt="IDL"
                 onerror="this.style.display='none';this.parentNode.innerHTML='<span style=\\'font-size:8px;font-weight:700;color:#c9a84c;\\'>IDL</span>'"/>
          </div>
          <div>
            <div class="bgc-f-org-name">${escapeHtml(s.orgName)}</div>
            <div class="bgc-f-org-sub">${escapeHtml(s.orgSub)}</div>
          </div>
        </div>
        <div class="bgc-f-gold-line"></div>
        <!-- Photo -->
        <div class="bgc-f-photo">${photoHtml}</div>
        <!-- Principal signature -->
        <div class="bgc-f-principal">
          <div class="bgc-f-sig-area">
            ${principalSigBuildHtml(principalSigGet(), '', 'max-width:100%;max-height:100%;object-fit:contain;display:block')}
          </div>
          <div class="bgc-f-principal-lbl">PRINCIPAL</div>
        </div>
        <!-- Body -->
        <div class="bgc-f-body">
          <div class="bgc-f-name">${escapeHtml(p.name)}</div>
          <div class="bgc-f-role">${escapeHtml(p.role)}</div>
          <div class="bgc-f-grid">${frontGrid}</div>
        </div>
        <!-- Barcode -->
        <div class="bgc-f-barcode">
          <div id="${barcodeId}">${bgcBarcodeSVG(p.code, 86, 28)}</div>
        </div>
        <div class="bgc-f-gold-footer-line"></div>
        <div class="bgc-f-footer">
          <span class="bgc-f-ftxt">${escapeHtml(s.footerAddr)}</span>
          <span class="bgc-f-ftxt">${escapeHtml(s.footerPhone)}</span>
        </div>
      </div>

      <!-- BACK LABEL -->
      <div class="bgc-pair-label">Back — Terms &amp; Conditions</div>

      <!-- ═══ BACK CARD ═══ -->
      <div class="bgc-card bgc-back">
        <div class="bgc-b-header">
          <div class="bgc-b-logo">
            <img src="${logoSrc}" alt="IDL"
                 onerror="this.style.display='none';this.parentNode.innerHTML='<span style=\\'font-size:7px;font-weight:700;color:#c9a84c;\\'>IDL</span>'"/>
          </div>
          <div>
            <div class="bgc-b-hname">${escapeHtml(s.backHname)}</div>
            <div class="bgc-b-hsub">${escapeHtml(s.backSub)}</div>
          </div>
          <div class="bgc-b-dots">${'<div class="bgc-b-dot"></div>'.repeat(12)}</div>
        </div>
        <div class="bgc-b-gold-line"></div>
        <div class="bgc-b-deco-tl"></div>
        <div class="bgc-b-deco-br"></div>
        <!-- Flex inner: TC → contact row → barcode, all in one container -->
        <div class="bgc-b-inner">
          <div class="bgc-b-tc-block">
            <div class="bgc-b-tc-title">TERMS &amp; CONDITIONS</div>
            <div class="bgc-b-tc-line"></div>
            <div class="bgc-b-tc-text">${escapeHtml(s.tc1)}</div>
            <div class="bgc-b-tc-text">${escapeHtml(s.tc2)}</div>
          </div>
          <div class="bgc-b-contact-row">
            <div class="bgc-b-contact-item">
              <div class="bgc-b-contact-icon">
                <svg width="7" height="7" viewBox="0 0 7 7"><circle cx="3.5" cy="3.5" r="2.5" fill="none" stroke="#c9a84c" stroke-width=".8"/><path d="M3.5 2v1.5l1 .8" stroke="#c9a84c" stroke-width=".6" fill="none"/></svg>
              </div>
              <span class="bgc-b-contact-txt">${escapeHtml(s.website)}</span>
            </div>
            <div class="bgc-b-contact-item">
              <div class="bgc-b-contact-icon">
                <svg width="7" height="7" viewBox="0 0 7 7"><rect x="1" y="1.5" width="5" height="4" rx=".5" fill="none" stroke="#c9a84c" stroke-width=".7"/><path d="M1 2l2.5 2 2.5-2" stroke="#c9a84c" stroke-width=".6" fill="none"/></svg>
              </div>
              <span class="bgc-b-contact-txt">${escapeHtml(s.backPhone)}</span>
            </div>
          </div>
          <div class="bgc-b-barcode">
            <div id="${barcodeIdB}">${bgcBarcodeSVG(p.code, 165, 22)}</div>
          </div>
        </div>
        <div class="bgc-b-gold-footer-line"></div>
        <div class="bgc-b-footer">
          <span class="bgc-b-ftxt">${escapeHtml(s.backFooter)}</span>
        </div>
      </div>

      <!-- Buttons -->
      <div class="bgc-btn-row">
        <button class="btn-action btn-download" onclick="bgcPrintSingle(${idx})" title="Print this card">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               style="vertical-align:middle;margin-right:4px">
            <polyline points="6 9 6 2 18 2 18 9"/>
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
            <rect x="6" y="14" width="12" height="8"/>
          </svg>Print / PDF
        </button>
      </div>
    </div>`;
  }).join('');

  // Try to upgrade SVG barcodes with JsBarcode if available
  if (typeof JsBarcode !== 'undefined') {
    people.forEach(p => {
      [`bgc-bc-${p.id}`, `bgc-bc-back-${p.id}`].forEach((containerId, i) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        // Create svg inside container
        let svgEl = container.querySelector('svg');
        if (!svgEl) { svgEl = document.createElementNS('http://www.w3.org/2000/svg','svg'); container.innerHTML = ''; container.appendChild(svgEl); }
        try {
          JsBarcode(svgEl, p.code, {
            format: 'CODE128', width: i === 0 ? 0.46 : 0.42,
            height: i === 0 ? 28 : 22,
            displayValue: false, margin: 1,
            background: 'transparent', lineColor: '#0d1b6e',
          });
        } catch(e) { /* keep fallback SVG */ }
      });
    });
  }
}

function bgcPrintSingle(idx) {
  const p = _bgcData[idx];
  if (!p) return;
  const s = bgcReadSettingsFromForm();

  const initial   = (p.name || '?')[0].toUpperCase();
  const photoHtml = p.photo
    ? `<img src="${p.photo}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:6px"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
       <span style="display:none;position:absolute;inset:0;align-items:center;justify-content:center;font-family:'Playfair Display',serif;font-size:20px;font-weight:800;color:#24327f">${initial}</span>`
    : `<span style="display:flex;align-items:center;justify-content:center;position:absolute;inset:0;font-family:'Playfair Display',serif;font-size:20px;font-weight:800;color:#24327f">${initial}</span>`;
  const joined = p.joining ? new Date(p.joining).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—';
  const logoSrc = 'assets/logo.jpeg';

  const win = window.open('','_blank');
  if (!win) { toast('Popup blocked — use Print All instead', 'warn'); return; }

  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Staff ID Card — ${p.name}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Montserrat:wght@400;500;600;700&family=Playfair+Display:wght@400;600;700;800&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Montserrat',sans-serif;background:#f3f4f8;padding:24px;display:flex;gap:24px;flex-wrap:wrap}
    .card{width:380px;height:230px;border-radius:16px;position:relative;overflow:hidden;border:1px solid rgba(40,53,147,.18);box-shadow:0 16px 34px rgba(25,34,89,.16);-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .front{background:linear-gradient(180deg,#fcfbf7 0%,#f5f2e9 100%)}
    .f-header{position:absolute;top:0;left:0;right:0;height:70px;background:linear-gradient(135deg,#202c7a 0%,#2f3fa7 55%,#3949b8 100%)}
    .f-hc{position:absolute;top:0;left:0;right:0;height:70px;display:flex;align-items:center;padding:0 16px;gap:10px;z-index:2}
    .f-lc{width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,.18);border:1.7px solid rgba(240,191,85,.7);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0}
    .f-lc img{width:100%;height:100%;object-fit:cover;border-radius:50%}
    .f-on{font-size:9px;font-weight:700;color:#fff8e8;letter-spacing:1.3px;line-height:1.45}
    .f-os{font-size:7px;color:#f1cf7a;letter-spacing:2px;margin-top:1px}
    .f-gl{position:absolute;top:68px;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent 0%,#c9a84c 25%,#f0c45e 50%,#c9a84c 75%,transparent 100%);z-index:5}
    .f-ph{position:absolute;top:38px;right:18px;width:70px;height:76px;border-radius:8px;background:linear-gradient(180deg,#f7f3e6 0%,#ede4c8 100%);border:2.5px solid #fff;box-shadow:0 8px 18px rgba(18,25,72,.18);display:flex;align-items:center;justify-content:center;overflow:hidden;position:absolute;z-index:3}
    .f-pri{position:absolute;top:118px;right:6px;width:88px;display:flex;flex-direction:column;align-items:center;z-index:3}
    .f-pri-sa{width:76px;height:24px;border-bottom:1.4px solid #2a3990;display:flex;align-items:center;justify-content:center;overflow:hidden;padding-bottom:2px}
    .f-pri-sa img{max-width:100%;max-height:100%;object-fit:contain;display:block}
    .f-pri-lbl{font-size:6.5px;font-weight:700;color:#2a3990;letter-spacing:1.5px;text-transform:uppercase;margin-top:3px;font-family:'Montserrat',sans-serif}
    .f-body{position:absolute;top:84px;left:14px;right:102px;bottom:32px;overflow:hidden;display:flex;flex-direction:column}
    .f-name{font-family:'Cormorant Garamond',serif;font-size:21px;font-weight:700;color:#24327f;line-height:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;flex-shrink:0}
    .f-role{font-size:8px;color:#b88619;font-weight:700;letter-spacing:2px;margin:4px 0 8px;text-transform:uppercase;overflow:hidden;white-space:nowrap;flex-shrink:0}
    .f-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 10px;overflow:hidden}
    .f-field{display:flex;flex-direction:column;min-width:0;overflow:hidden}
    .f-flbl{font-size:6.5px;color:#7a7685;font-weight:700;letter-spacing:1px;text-transform:uppercase;white-space:nowrap}
    .f-fval{font-size:7.6px;color:#22263a;font-weight:600;line-height:1.45;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
    /* Front barcode — fixed 90px column, SVG clamped */
    .f-bc{position:absolute;bottom:30px;right:6px;width:94px;overflow:hidden;display:flex;flex-direction:column;align-items:center}
    .f-bc svg{width:94px !important;max-width:94px;height:28px !important}
    .f-gfl{position:absolute;bottom:28px;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent 0%,#c9a84c 25%,#f0c45e 50%,#c9a84c 75%,transparent 100%);z-index:3}
    .f-footer{position:absolute;bottom:0;left:0;right:0;height:28px;background:linear-gradient(135deg,#1f2a73 0%,#2a3990 100%);display:flex;align-items:center;padding:0 10px;justify-content:space-between;border-top:1px solid rgba(240,191,85,.35)}
    .f-ft{font-size:6.4px;color:#f9e6b0;font-weight:500;letter-spacing:.3px}
    /* Back */
    .back{background:linear-gradient(180deg,#fcfbf7 0%,#f6f2e7 100%)}
    .b-hd{position:absolute;top:0;left:0;right:0;height:54px;background:linear-gradient(135deg,#202c7a 0%,#2f3fa7 55%,#3949b8 100%);display:flex;align-items:center;padding:0 16px;gap:10px}
    .b-lc{width:35px;height:35px;border-radius:50%;background:rgba(255,255,255,.18);border:1.5px solid rgba(240,191,85,.7);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0}
    .b-lc img{width:100%;height:100%;object-fit:cover;border-radius:50%}
    .b-hn{font-family:'Playfair Display',serif;font-size:10.5px;font-weight:700;color:#fff8e8;letter-spacing:1px;line-height:1.4}
    .b-hs{font-size:6.5px;color:#f1cf7a;letter-spacing:1.4px}
    .b-dots{display:grid;grid-template-columns:repeat(4,5px);gap:3px;margin-left:auto}
    .b-dot{width:5px;height:5px;border-radius:50%;background:rgba(240,191,85,.55)}
    .b-gl{position:absolute;top:54px;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent 0%,#c9a84c 25%,#f0c45e 50%,#c9a84c 75%,transparent 100%);z-index:6}
    .b-dtl{position:absolute;top:54px;left:0;width:92px;height:92px;background:linear-gradient(135deg,#f0c45e 0%,#d4a535 50%,#b07a10 100%);border-bottom-right-radius:100%;opacity:.92}
    .b-dbr{position:absolute;bottom:28px;right:0;width:76px;height:76px;background:linear-gradient(315deg,#f0c45e 0%,#d4a535 50%,#b07a10 100%);border-top-left-radius:100%;opacity:.9}
    /* Back flex inner container — replaces .b-cnt/.b-cr/.b-bc absolute positioning */
    .b-inner{position:absolute;top:56px;left:0;right:0;bottom:28px;display:flex;flex-direction:column;align-items:center;padding:4px 14px 2px;overflow:hidden;z-index:5;gap:3px}
    .b-tc-blk{flex:1 1 auto;min-height:0;overflow:hidden;width:100%;display:flex;flex-direction:column;align-items:center;padding-bottom:2px}
    .b-tct{font-family:'Playfair Display',serif;font-size:16px;font-weight:800;color:#1e2c7a;letter-spacing:1.5px;text-align:center;margin-bottom:3px;flex-shrink:0;white-space:nowrap}
    .b-tcl{width:52px;height:2px;background:linear-gradient(90deg,#c69423 0%,#f0c45e 100%);margin:0 auto 7px;border-radius:2px;flex-shrink:0}
    .b-tct2{font-family:'Playfair Display',serif;font-size:7.5px;color:#353a56;line-height:1.55;text-align:center;margin-bottom:3px;overflow:hidden;width:100%;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3}
    .b-cr{flex-shrink:0;display:flex;justify-content:center;gap:12px;width:100%;padding:1px 0}
    .b-ci{display:flex;align-items:center;gap:4px;min-width:0;overflow:hidden}
    .b-cic{width:12px;height:12px;background:linear-gradient(135deg,#24327f 0%,#3d4eb5 100%);border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .b-ct{font-family:'Playfair Display',serif;font-size:7px;color:#2f3346;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .b-bc{flex-shrink:0;display:flex;flex-direction:column;align-items:center;width:100%;max-width:170px;overflow:hidden;padding:1px 0}
    .b-bc svg{width:100% !important;max-width:170px;height:22px !important}
    .b-gfl{position:absolute;bottom:28px;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent 0%,#c9a84c 25%,#f0c45e 50%,#c9a84c 75%,transparent 100%)}
    .b-footer{position:absolute;bottom:0;left:0;right:0;height:28px;background:linear-gradient(135deg,#1f2a73 0%,#2a3990 100%);display:flex;align-items:center;justify-content:center;border-top:1px solid rgba(240,191,85,.35)}
    .b-ft{font-family:'Playfair Display',serif;font-size:7px;color:#f7df9e;letter-spacing:1.5px;font-weight:600}
    @media print{body{padding:8mm}@page{margin:8mm}}
  </style></head><body>

  <!-- FRONT -->
  <div class="card front">
    <div class="f-header"></div>
    <div class="f-hc">
      <div class="f-lc"><img src="${logoSrc}" alt="IDL" onerror="this.style.display='none';this.parentNode.innerHTML='<span style=\\'font-size:8px;font-weight:700;color:#c9a84c\\'>IDL</span>'"/></div>
      <div><div class="f-on">${escapeHtml(s.orgName)}</div><div class="f-os">${escapeHtml(s.orgSub)}</div></div>
    </div>
    <div class="f-gl"></div>
    <div class="f-ph" style="position:absolute;">${photoHtml}</div>
    <div class="f-pri">
      <div class="f-pri-sa">${principalSigBuildHtml(principalSigGet(),'','max-width:100%;max-height:100%;object-fit:contain;display:block')}</div>
      <div class="f-pri-lbl">PRINCIPAL</div>
    </div>
    <div class="f-body">
      <div class="f-name">${escapeHtml(p.name)}</div>
      <div class="f-role">${escapeHtml(p.role)}</div>
      <div class="f-grid">
        <div class="f-field"><span class="f-flbl">Phone</span><span class="f-fval">${escapeHtml(p.phone||'—')}</span></div>
        <div class="f-field"><span class="f-flbl">Joined</span><span class="f-fval">${escapeHtml(joined)}</span></div>
        <div class="f-field"><span class="f-flbl">NIC No.</span><span class="f-fval">${escapeHtml(p.nic||'—')}</span></div>
        <div class="f-field"><span class="f-flbl">Blood Group</span><span class="f-fval">${escapeHtml(p.blood||'—')}</span></div>
        <div class="f-field" style="grid-column:1/-1"><span class="f-flbl">Address</span><span class="f-fval">${escapeHtml(p.address||'—')}</span></div>
      </div>
    </div>
    <div class="f-bc"><svg id="bc-front"></svg></div>
    <div class="f-gfl"></div>
    <div class="f-footer"><span class="f-ft">${escapeHtml(s.footerAddr)}</span><span class="f-ft">${escapeHtml(s.footerPhone)}</span></div>
  </div>

  <!-- BACK -->
  <div class="card back">
    <div class="b-hd">
      <div class="b-lc"><img src="${logoSrc}" alt="IDL" onerror="this.style.display='none';this.parentNode.innerHTML='<span style=\\'font-size:7px;font-weight:700;color:#c9a84c\\'>IDL</span>'"/></div>
      <div><div class="b-hn">${escapeHtml(s.backHname)}</div><div class="b-hs">${escapeHtml(s.backSub)}</div></div>
      <div class="b-dots">${'<div class="b-dot"></div>'.repeat(12)}</div>
    </div>
    <div class="b-gl"></div><div class="b-dtl"></div><div class="b-dbr"></div>
    <div class="b-inner">
      <div class="b-tc-blk">
        <div class="b-tct">TERMS &amp; CONDITIONS</div>
        <div class="b-tcl"></div>
        <div class="b-tct2">${escapeHtml(s.tc1)}</div>
        <div class="b-tct2">${escapeHtml(s.tc2)}</div>
      </div>
      <div class="b-cr">
        <div class="b-ci"><div class="b-cic"><svg width="7" height="7" viewBox="0 0 7 7"><circle cx="3.5" cy="3.5" r="2.5" fill="none" stroke="#c9a84c" stroke-width=".8"/><path d="M3.5 2v1.5l1 .8" stroke="#c9a84c" stroke-width=".6" fill="none"/></svg></div><span class="b-ct">${escapeHtml(s.website)}</span></div>
        <div class="b-ci"><div class="b-cic"><svg width="7" height="7" viewBox="0 0 7 7"><rect x="1" y="1.5" width="5" height="4" rx=".5" fill="none" stroke="#c9a84c" stroke-width=".7"/><path d="M1 2l2.5 2 2.5-2" stroke="#c9a84c" stroke-width=".6" fill="none"/></svg></div><span class="b-ct">${escapeHtml(s.backPhone)}</span></div>
      </div>
      <div class="b-bc"><svg id="bc-back"></svg></div>
    </div>
    <div class="b-gfl"></div>
    <div class="b-footer"><span class="b-ft">${escapeHtml(s.backFooter)}</span></div>
  </div>

  <script>
    window.onload = function() {
      if (typeof JsBarcode !== 'undefined') {
        JsBarcode('#bc-front', '${p.code}', {format:'CODE128',width:0.46,height:28,displayValue:false,margin:1,background:'transparent',lineColor:'#0d1b6e'});
        JsBarcode('#bc-back',  '${p.code}', {format:'CODE128',width:0.42,height:22,displayValue:false,margin:1,background:'transparent',lineColor:'#0d1b6e'});
      }
      setTimeout(() => window.print(), 800);
    };
  <\/script>
  </body></html>`);
  win.document.close();
}

// =============================================================
//  BLUE-GOLD STUDENT ID CARDS  (SIC)
// =============================================================
const SIC_DEFAULTS = {
  orgName:     'INSTITUTE OF DYNAMIC LEARNING',
  orgSub:      'STUDENT IDENTITY CARD',
  footerAddr:  'IDL-107-A, Peoples Colony No.1, Faisalabad',
  footerPhone: 'Ph: 0304-8555545',
  backHname:   'INSTITUTE OF DYNAMIC LEARNING',
  backSub:     'FAISALABAD · PAKISTAN',
  tc1:         'This card is property of IDL and must be carried by the student during all school hours as a means of identification.',
  tc2:         'If found, please return this card to IDL or the nearest authority. Loss must be reported immediately.',
  website:     'idl.faisalabad.edu.pk',
  backPhone:   '0304-8555545',
  backFooter:  'INSTITUTE OF DYNAMIC LEARNING · FAISALABAD',
};
const SIC_LS_KEY = 'sic_card_settings';

let _sicAll  = [];
let _sicData = [];

function sicGetSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SIC_LS_KEY) || '{}');
    return Object.assign({}, SIC_DEFAULTS, saved);
  } catch(e) { return { ...SIC_DEFAULTS }; }
}

function sicLoadSettingsToForm() {
  const s = sicGetSettings();
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  set('sics-org-name',    s.orgName);
  set('sics-org-sub',     s.orgSub);
  set('sics-footer-addr', s.footerAddr);
  set('sics-footer-phone',s.footerPhone);
  set('sics-back-hname',  s.backHname);
  set('sics-back-sub',    s.backSub);
  set('sics-tc1',         s.tc1);
  set('sics-tc2',         s.tc2);
  set('sics-website',     s.website);
  set('sics-back-phone',  s.backPhone);
  set('sics-back-footer', s.backFooter);
  bgcUpdateSigPreview(principalSigGet(), 'sics-sig-img', 'sics-sig-placeholder');
}

function sicReadSettingsFromForm() {
  const v = id => document.getElementById(id)?.value?.trim() || '';
  return {
    orgName:    v('sics-org-name')    || SIC_DEFAULTS.orgName,
    orgSub:     v('sics-org-sub')     || SIC_DEFAULTS.orgSub,
    footerAddr: v('sics-footer-addr') || SIC_DEFAULTS.footerAddr,
    footerPhone:v('sics-footer-phone')|| SIC_DEFAULTS.footerPhone,
    backHname:  v('sics-back-hname')  || SIC_DEFAULTS.backHname,
    backSub:    v('sics-back-sub')    || SIC_DEFAULTS.backSub,
    tc1:        v('sics-tc1')         || SIC_DEFAULTS.tc1,
    tc2:        v('sics-tc2')         || SIC_DEFAULTS.tc2,
    website:    v('sics-website')     || SIC_DEFAULTS.website,
    backPhone:  v('sics-back-phone')  || SIC_DEFAULTS.backPhone,
    backFooter: v('sics-back-footer') || SIC_DEFAULTS.backFooter,
  };
}

function sicSaveSettings() {
  const s = sicReadSettingsFromForm();
  try { localStorage.setItem(SIC_LS_KEY, JSON.stringify(s)); } catch(e) {}
  sicRenderCards(_sicData);
  toast('Card settings saved', 'success');
}

function sicResetSettings() {
  try { localStorage.removeItem(SIC_LS_KEY); } catch(e) {}
  sicLoadSettingsToForm();
  sicRenderCards(_sicData);
  toast('Reset to defaults', 'success');
}

function sicApplySettings() { sicRenderCards(_sicData); }

function sicToggleSettings() {
  const body  = document.getElementById('sic-settings-body');
  const title = document.getElementById('sic-settings-toggle');
  const caret = document.getElementById('sic-caret');
  if (!body) return;
  const open = body.classList.toggle('open');
  if (title) title.classList.toggle('open', open);
  if (caret) caret.style.transform = open ? 'rotate(180deg)' : '';
}

function sicCardFilter() {
  const q = (document.getElementById('sic-search')?.value || '').toLowerCase().trim();
  _sicData = q
    ? _sicAll.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.gr||'').toLowerCase().includes(q) ||
        (p.className||'').toLowerCase().includes(q))
    : [..._sicAll];
  sicRenderCards(_sicData);
}

async function sicInitPage() {
  sicLoadSettingsToForm();
  const grid = document.getElementById('sic-cards-grid');
  if (grid) grid.innerHTML = `<div class="da-cards-loading"><div style="opacity:.4">Loading student cards…</div></div>`;
  const srch = document.getElementById('sic-search');
  if (srch) srch.value = '';
  try {
    const raw = await api('api/students.php');
    _sicAll = (raw || []).map(s => ({
      id:        s.id,
      type:      'student',
      code:      `IDL-STUDENT-${s.id}`,
      name:      s.student_name || s.name || '—',
      gr:        s.gr_number || '',
      cnic:      s.b_form || '',
      fatherName:s.father_name || '',
      fatherPhone:s.father_phone || s.guardian_phone || '',
      blood:     s.blood_group || '',
      address:   s.father_address || s.student_address || s.address || '',
      className: s.class_name || '',
      photo:     s.photo || '',
    }));
    _sicData = [..._sicAll];
    sicRenderCards(_sicData);
  } catch(e) {
    if (grid) grid.innerHTML = `<div class="da-cards-loading" style="color:var(--danger)">Error loading students: ${escapeHtml(e.message)}</div>`;
  }
}

function sicRenderCards(people) {
  const grid    = document.getElementById('sic-cards-grid');
  const countEl = document.getElementById('sic-count');
  if (!grid) return;

  if (countEl) countEl.textContent = `${people.length} card${people.length !== 1 ? 's' : ''}`;
  if (!people.length) { grid.innerHTML = '<div class="da-cards-loading">No student cards found</div>'; return; }

  const s       = sicReadSettingsFromForm();
  const logoSrc = 'assets/logo.jpeg';
  const sigData = principalSigGet();
  const sigHtml = sigData
    ? `<img src="${sigData}" style="max-width:100%;max-height:100%;object-fit:contain;display:block" alt="">`
    : '';

  grid.innerHTML = people.map((p, idx) => {
    const initial    = (p.name || '?')[0].toUpperCase();
    const barcodeId  = `sic-bc-${p.id}`;
    const barcodeIdB = `sic-bc-back-${p.id}`;

    const photoHtml = p.photo
      ? `<img src="${escapeHtml(p.photo)}" alt=""
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
         <span class="sic-f-photo-init" style="display:none;align-items:center;justify-content:center;position:absolute;inset:0">${initial}</span>`
      : `<span class="sic-f-photo-init">${initial}</span>`;

    return `
    <div class="sic-pair-wrap">
      <div class="sic-pair-label">Front — ${escapeHtml(p.name)}</div>

      <!-- ═══ STUDENT FRONT ═══ -->
      <div class="sic-card sic-front">
        <div class="sic-f-header"></div>
        <div class="sic-f-dots">${'<div class="sic-f-dot"></div>'.repeat(12)}</div>
        <div class="sic-f-hcontent">
          <div class="sic-f-logo">
            <img src="${logoSrc}" alt="IDL"
                 onerror="this.style.display='none';this.parentNode.innerHTML='<span style=\\'font-size:8px;font-weight:700;color:#c9a84c;\\'>IDL</span>'"/>
          </div>
          <div>
            <div class="sic-f-org-name">${escapeHtml(s.orgName)}</div>
            <div class="sic-f-org-sub">${escapeHtml(s.orgSub)}</div>
          </div>
        </div>
        <div class="sic-f-gold-line"></div>
        <div class="sic-f-ribbon"><span>STUDENT</span></div>
        <!-- Photo -->
        <div class="sic-f-photo">${photoHtml}</div>
        <!-- Principal -->
        <div class="sic-f-principal">
          <div class="sic-f-sig-area">${sigHtml}</div>
          <div class="sic-f-principal-lbl">PRINCIPAL</div>
        </div>
        <!-- Barcode (right column, below principal) -->
        <div class="sic-f-right-barcode">
          <div id="${barcodeId}">${bgcBarcodeSVG(p.code, 86, 26)}</div>
        </div>
        <!-- Left body -->
        <div class="sic-f-body">
          <div class="sic-f-name">${escapeHtml(p.name)}</div>
          <div class="sic-f-grid">
            <div class="sic-f-field"><span class="sic-f-flbl">Student ID</span><span class="sic-f-fval">${escapeHtml(p.gr || '—')}</span></div>
            <div class="sic-f-field"><span class="sic-f-flbl">CNIC / B-Form</span><span class="sic-f-fval">${escapeHtml(p.cnic || '—')}</span></div>
            <div class="sic-f-field"><span class="sic-f-flbl">Parent's Name</span><span class="sic-f-fval">${escapeHtml(p.fatherName || '—')}</span></div>
            <div class="sic-f-field"><span class="sic-f-flbl">Parent's Phone</span><span class="sic-f-fval">${escapeHtml(p.fatherPhone || '—')}</span></div>
            <div class="sic-f-field" style="grid-column:1/-1"><span class="sic-f-flbl">Address</span><span class="sic-f-fval">${escapeHtml(p.address || '—')}</span></div>
          </div>
        </div>
        <div class="sic-f-gold-footer-line"></div>
        <div class="sic-f-footer">
          <span class="sic-f-ftxt">${escapeHtml(s.footerAddr)}</span>
          <span class="sic-f-ftxt">${escapeHtml(s.footerPhone)}</span>
        </div>
      </div>

      <div class="sic-pair-label">Back — Terms &amp; Conditions</div>

      <!-- ═══ STUDENT BACK ═══ -->
      <div class="sic-card sic-back">
        <div class="sic-b-header">
          <div class="sic-b-logo">
            <img src="${logoSrc}" alt="IDL"
                 onerror="this.style.display='none';this.parentNode.innerHTML='<span style=\\'font-size:7px;font-weight:700;color:#c9a84c;\\'>IDL</span>'"/>
          </div>
          <div>
            <div class="sic-b-hname">${escapeHtml(s.backHname)}</div>
            <div class="sic-b-hsub">${escapeHtml(s.backSub)}</div>
          </div>
          <div class="sic-b-dots">${'<div class="sic-b-dot"></div>'.repeat(12)}</div>
        </div>
        <div class="sic-b-gold-line"></div>
        <div class="sic-b-deco-tl"></div>
        <div class="sic-b-deco-br"></div>
        <div class="sic-b-inner">
          <div class="sic-b-tc-block">
            <div class="sic-b-tc-title">TERMS &amp; CONDITIONS</div>
            <div class="sic-b-tc-line"></div>
            <div class="sic-b-tc-text">${escapeHtml(s.tc1)}</div>
            <div class="sic-b-tc-text">${escapeHtml(s.tc2)}</div>
          </div>
          <div class="sic-b-contact-row">
            <div class="sic-b-contact-item">
              <div class="sic-b-contact-icon">
                <svg width="7" height="7" viewBox="0 0 7 7"><circle cx="3.5" cy="3.5" r="2.5" fill="none" stroke="#c9a84c" stroke-width=".8"/><path d="M3.5 2v1.5l1 .8" stroke="#c9a84c" stroke-width=".6" fill="none"/></svg>
              </div>
              <span class="sic-b-contact-txt">${escapeHtml(s.website)}</span>
            </div>
            <div class="sic-b-contact-item">
              <div class="sic-b-contact-icon">
                <svg width="7" height="7" viewBox="0 0 7 7"><rect x="1" y="1.5" width="5" height="4" rx=".5" fill="none" stroke="#c9a84c" stroke-width=".7"/><path d="M1 2l2.5 2 2.5-2" stroke="#c9a84c" stroke-width=".6" fill="none"/></svg>
              </div>
              <span class="sic-b-contact-txt">${escapeHtml(s.backPhone)}</span>
            </div>
          </div>
          <div class="sic-b-barcode">
            <div id="${barcodeIdB}">${bgcBarcodeSVG(p.code, 165, 22)}</div>
          </div>
        </div>
        <div class="sic-b-gold-footer-line"></div>
        <div class="sic-b-footer">
          <span class="sic-b-ftxt">${escapeHtml(s.backFooter)}</span>
        </div>
      </div>

      <div class="sic-btn-row">
        <button class="btn-action btn-download" onclick="sicPrintSingle(${idx})" title="Print this card">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               style="vertical-align:middle;margin-right:4px">
            <polyline points="6 9 6 2 18 2 18 9"/>
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
            <rect x="6" y="14" width="12" height="8"/>
          </svg>Print / PDF
        </button>
      </div>
    </div>`;
  }).join('');

  // Upgrade fallback SVG barcodes with JsBarcode if available
  if (typeof JsBarcode !== 'undefined') {
    people.forEach(p => {
      [`sic-bc-${p.id}`, `sic-bc-back-${p.id}`].forEach((containerId, i) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        let svgEl = container.querySelector('svg');
        if (!svgEl) { svgEl = document.createElementNS('http://www.w3.org/2000/svg','svg'); container.innerHTML = ''; container.appendChild(svgEl); }
        try {
          JsBarcode(svgEl, p.code, {
            format: 'CODE128', width: i === 0 ? 0.44 : 0.42,
            height: i === 0 ? 26 : 22,
            displayValue: false, margin: 1,
            background: 'transparent', lineColor: '#0d1b6e',
          });
        } catch(e) { /* keep fallback */ }
      });
    });
  }
}

function sicPrintSingle(idx) {
  const p = _sicData[idx];
  if (!p) return;
  const s       = sicReadSettingsFromForm();
  const initial = (p.name || '?')[0].toUpperCase();
  const sigData = principalSigGet();
  const logoSrc = 'assets/logo.jpeg';

  const photoHtml = p.photo
    ? `<img src="${p.photo}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:6px"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
       <span style="display:none;position:absolute;inset:0;align-items:center;justify-content:center;font-family:'Playfair Display',serif;font-size:18px;font-weight:800;color:#24327f">${initial}</span>`
    : `<span style="display:flex;align-items:center;justify-content:center;position:absolute;inset:0;font-family:'Playfair Display',serif;font-size:18px;font-weight:800;color:#24327f">${initial}</span>`;

  const win = window.open('','_blank');
  if (!win) { toast('Popup blocked — use Print All instead', 'warn'); return; }

  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Student ID Card — ${p.name}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Montserrat:wght@400;500;600;700&family=Playfair+Display:wght@400;600;700;800&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Montserrat',sans-serif;background:#f3f4f8;padding:24px;display:flex;gap:24px;flex-wrap:wrap}
    .card{width:380px;height:230px;border-radius:16px;position:relative;overflow:hidden;border:1px solid rgba(40,53,147,.18);box-shadow:0 16px 34px rgba(25,34,89,.16);-webkit-print-color-adjust:exact;print-color-adjust:exact}
    /* FRONT */
    .front{background:linear-gradient(180deg,#fcfbf7 0%,#f5f2e9 100%)}
    .f-hd{position:absolute;top:0;left:0;right:0;height:70px;background:linear-gradient(135deg,#202c7a 0%,#2f3fa7 55%,#3949b8 100%)}
    .f-hc{position:absolute;top:0;left:0;right:0;height:70px;display:flex;align-items:center;padding:0 16px;gap:10px;z-index:2}
    .f-lc{width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,.18);border:1.7px solid rgba(240,191,85,.7);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0}
    .f-lc img{width:100%;height:100%;object-fit:cover;border-radius:50%}
    .f-on{font-size:9px;font-weight:700;color:#fff8e8;letter-spacing:1.3px;line-height:1.45}
    .f-os{font-size:7px;color:#f1cf7a;letter-spacing:2px;margin-top:1px}
    .f-gl{position:absolute;top:68px;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent 0%,#c9a84c 25%,#f0c45e 50%,#c9a84c 75%,transparent 100%);z-index:5}
    .f-rib{position:absolute;top:70px;left:0;width:68px;height:14px;background:linear-gradient(135deg,#c08b18 0%,#f0c45e 60%,#d4a535 100%);display:flex;align-items:center;justify-content:center;z-index:4;clip-path:polygon(0 0,100% 0,92% 100%,0 100%)}
    .f-rib span{font-size:6px;font-weight:800;color:#1a2060;letter-spacing:1.5px;text-transform:uppercase;padding-left:4px}
    .f-ph{position:absolute;top:34px;right:14px;width:66px;height:62px;border-radius:8px;background:linear-gradient(180deg,#f7f3e6 0%,#ede4c8 100%);border:2.5px solid #fff;box-shadow:0 8px 18px rgba(18,25,72,.18);display:flex;align-items:center;justify-content:center;overflow:hidden;z-index:3}
    .f-pri{position:absolute;top:102px;right:6px;width:88px;display:flex;flex-direction:column;align-items:center;z-index:3}
    .f-pri-sa{width:76px;height:26px;border-bottom:1.4px solid #2a3990;display:flex;align-items:center;justify-content:center;overflow:hidden;padding-bottom:2px}
    .f-pri-sa img{max-width:100%;max-height:100%;object-fit:contain;display:block}
    .f-pri-lbl{font-size:6.5px;font-weight:700;color:#2a3990;letter-spacing:1.5px;text-transform:uppercase;margin-top:3px}
    .f-rbc{position:absolute;top:162px;right:6px;width:94px;display:flex;flex-direction:column;align-items:center;z-index:3;overflow:hidden}
    .f-rbc svg{width:94px !important;max-width:94px;height:26px !important}
    .f-body{position:absolute;top:88px;left:14px;right:102px;bottom:32px;overflow:hidden;display:flex;flex-direction:column}
    .f-name{font-family:'Cormorant Garamond',serif;font-size:19px;font-weight:700;color:#24327f;line-height:1;margin-bottom:4px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;flex-shrink:0}
    .f-grid{display:grid;grid-template-columns:1fr 1fr;gap:3px 8px;overflow:hidden}
    .f-field{display:flex;flex-direction:column;min-width:0;overflow:hidden}
    .f-flbl{font-size:6px;color:#7a7685;font-weight:700;letter-spacing:.8px;text-transform:uppercase;white-space:nowrap}
    .f-fval{font-size:7.2px;color:#22263a;font-weight:600;line-height:1.35;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
    .f-gfl{position:absolute;bottom:28px;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent 0%,#c9a84c 25%,#f0c45e 50%,#c9a84c 75%,transparent 100%);z-index:3}
    .f-footer{position:absolute;bottom:0;left:0;right:0;height:28px;background:linear-gradient(135deg,#1f2a73 0%,#2a3990 100%);display:flex;align-items:center;padding:0 10px;justify-content:space-between;border-top:1px solid rgba(240,191,85,.35)}
    .f-ft{font-size:6.4px;color:#f9e6b0;font-weight:500;letter-spacing:.3px}
    /* BACK */
    .back{background:linear-gradient(180deg,#fcfbf7 0%,#f6f2e7 100%)}
    .b-hd{position:absolute;top:0;left:0;right:0;height:54px;background:linear-gradient(135deg,#202c7a 0%,#2f3fa7 55%,#3949b8 100%);display:flex;align-items:center;padding:0 16px;gap:10px}
    .b-lc{width:35px;height:35px;border-radius:50%;background:rgba(255,255,255,.18);border:1.5px solid rgba(240,191,85,.7);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0}
    .b-lc img{width:100%;height:100%;object-fit:cover;border-radius:50%}
    .b-hn{font-family:'Playfair Display',serif;font-size:10.5px;font-weight:700;color:#fff8e8;letter-spacing:1px;line-height:1.4}
    .b-hs{font-size:6.5px;color:#f1cf7a;letter-spacing:1.4px}
    .b-dots{display:grid;grid-template-columns:repeat(4,5px);gap:3px;margin-left:auto}
    .b-dot{width:5px;height:5px;border-radius:50%;background:rgba(240,191,85,.45)}
    .b-gl{position:absolute;top:54px;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent 0%,#c9a84c 25%,#f0c45e 50%,#c9a84c 75%,transparent 100%);z-index:6}
    .b-dtl{position:absolute;top:54px;left:0;width:92px;height:92px;background:linear-gradient(135deg,#f0c45e 0%,#d4a535 50%,#b07a10 100%);border-bottom-right-radius:100%;opacity:.92}
    .b-dbr{position:absolute;bottom:28px;right:0;width:76px;height:76px;background:linear-gradient(315deg,#f0c45e 0%,#d4a535 50%,#b07a10 100%);border-top-left-radius:100%;opacity:.9}
    .b-inner{position:absolute;top:56px;left:0;right:0;bottom:28px;display:flex;flex-direction:column;align-items:center;padding:4px 14px 2px;overflow:hidden;z-index:5;gap:3px}
    .b-tc-blk{flex:1 1 auto;min-height:0;overflow:hidden;width:100%;display:flex;flex-direction:column;align-items:center;padding-bottom:2px}
    .b-tct{font-family:'Playfair Display',serif;font-size:16px;font-weight:800;color:#1e2c7a;letter-spacing:1.5px;text-align:center;margin-bottom:3px;flex-shrink:0;white-space:nowrap}
    .b-tcl{width:52px;height:2px;background:linear-gradient(90deg,#c69423 0%,#f0c45e 100%);margin:0 auto 7px;border-radius:2px;flex-shrink:0}
    .b-tct2{font-family:'Playfair Display',serif;font-size:7.5px;color:#353a56;line-height:1.55;text-align:center;margin-bottom:3px;overflow:hidden;width:100%;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3}
    .b-cr{flex-shrink:0;display:flex;justify-content:center;gap:12px;width:100%;padding:1px 0}
    .b-ci{display:flex;align-items:center;gap:4px;min-width:0;overflow:hidden}
    .b-cic{width:12px;height:12px;background:linear-gradient(135deg,#24327f 0%,#3d4eb5 100%);border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .b-ct{font-family:'Playfair Display',serif;font-size:7px;color:#2f3346;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .b-bc{flex-shrink:0;display:flex;flex-direction:column;align-items:center;width:100%;max-width:170px;overflow:hidden;padding:1px 0}
    .b-bc svg{width:100% !important;max-width:170px;height:22px !important}
    .b-gfl{position:absolute;bottom:28px;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent 0%,#c9a84c 25%,#f0c45e 50%,#c9a84c 75%,transparent 100%)}
    .b-footer{position:absolute;bottom:0;left:0;right:0;height:28px;background:linear-gradient(135deg,#1f2a73 0%,#2a3990 100%);display:flex;align-items:center;justify-content:center;border-top:1px solid rgba(240,191,85,.35)}
    .b-ft{font-family:'Playfair Display',serif;font-size:7px;color:#f7df9e;letter-spacing:1.5px;font-weight:600}
    @media print{body{padding:8mm}@page{margin:8mm}}
  </style></head><body>

  <!-- FRONT -->
  <div class="card front">
    <div class="f-hd"></div>
    <div class="f-hc">
      <div class="f-lc"><img src="${logoSrc}" alt="IDL" onerror="this.style.display='none';this.parentNode.innerHTML='<span style=\\'font-size:8px;font-weight:700;color:#c9a84c\\'>IDL</span>'"/></div>
      <div><div class="f-on">${escapeHtml(s.orgName)}</div><div class="f-os">${escapeHtml(s.orgSub)}</div></div>
    </div>
    <div class="f-gl"></div>
    <div class="f-rib"><span>STUDENT</span></div>
    <div class="f-ph" style="position:absolute;">${photoHtml}</div>
    <div class="f-pri">
      <div class="f-pri-sa">${sigData ? `<img src="${sigData}" style="max-width:100%;max-height:100%;object-fit:contain;display:block" alt="">` : ''}</div>
      <div class="f-pri-lbl">PRINCIPAL</div>
    </div>
    <div class="f-rbc"><svg id="sbc-front"></svg></div>
    <div class="f-body">
      <div class="f-name">${escapeHtml(p.name)}</div>
      <div class="f-grid">
        <div class="f-field"><span class="f-flbl">Student ID</span><span class="f-fval">${escapeHtml(p.gr||'—')}</span></div>
        <div class="f-field"><span class="f-flbl">CNIC / B-Form</span><span class="f-fval">${escapeHtml(p.cnic||'—')}</span></div>
        <div class="f-field"><span class="f-flbl">Parent's Name</span><span class="f-fval">${escapeHtml(p.fatherName||'—')}</span></div>
        <div class="f-field"><span class="f-flbl">Parent's Phone</span><span class="f-fval">${escapeHtml(p.fatherPhone||'—')}</span></div>
        <div class="f-field" style="grid-column:1/-1"><span class="f-flbl">Address</span><span class="f-fval">${escapeHtml(p.address||'—')}</span></div>
      </div>
    </div>
    <div class="f-gfl"></div>
    <div class="f-footer"><span class="f-ft">${escapeHtml(s.footerAddr)}</span><span class="f-ft">${escapeHtml(s.footerPhone)}</span></div>
  </div>

  <!-- BACK -->
  <div class="card back">
    <div class="b-hd">
      <div class="b-lc"><img src="${logoSrc}" alt="IDL" onerror="this.style.display='none';this.parentNode.innerHTML='<span style=\\'font-size:7px;font-weight:700;color:#c9a84c\\'>IDL</span>'"/></div>
      <div><div class="b-hn">${escapeHtml(s.backHname)}</div><div class="b-hs">${escapeHtml(s.backSub)}</div></div>
      <div class="b-dots">${'<div class="b-dot"></div>'.repeat(12)}</div>
    </div>
    <div class="b-gl"></div><div class="b-dtl"></div><div class="b-dbr"></div>
    <div class="b-inner">
      <div class="b-tc-blk">
        <div class="b-tct">TERMS &amp; CONDITIONS</div>
        <div class="b-tcl"></div>
        <div class="b-tct2">${escapeHtml(s.tc1)}</div>
        <div class="b-tct2">${escapeHtml(s.tc2)}</div>
      </div>
      <div class="b-cr">
        <div class="b-ci"><div class="b-cic"><svg width="7" height="7" viewBox="0 0 7 7"><circle cx="3.5" cy="3.5" r="2.5" fill="none" stroke="#c9a84c" stroke-width=".8"/><path d="M3.5 2v1.5l1 .8" stroke="#c9a84c" stroke-width=".6" fill="none"/></svg></div><span class="b-ct">${escapeHtml(s.website)}</span></div>
        <div class="b-ci"><div class="b-cic"><svg width="7" height="7" viewBox="0 0 7 7"><rect x="1" y="1.5" width="5" height="4" rx=".5" fill="none" stroke="#c9a84c" stroke-width=".7"/><path d="M1 2l2.5 2 2.5-2" stroke="#c9a84c" stroke-width=".6" fill="none"/></svg></div><span class="b-ct">${escapeHtml(s.backPhone)}</span></div>
      </div>
      <div class="b-bc"><svg id="sbc-back"></svg></div>
    </div>
    <div class="b-gfl"></div>
    <div class="b-footer"><span class="b-ft">${escapeHtml(s.backFooter)}</span></div>
  </div>

  <script>
    window.onload = function() {
      if (typeof JsBarcode !== 'undefined') {
        JsBarcode('#sbc-front', '${p.code}', {format:'CODE128',width:0.44,height:26,displayValue:false,margin:1,background:'transparent',lineColor:'#0d1b6e'});
        JsBarcode('#sbc-back',  '${p.code}', {format:'CODE128',width:0.42,height:22,displayValue:false,margin:1,background:'transparent',lineColor:'#0d1b6e'});
      }
      setTimeout(() => window.print(), 800);
    };
  <\/script>
  </body></html>`);
  win.document.close();
}

function daSwitchTab(tab) {
  document.querySelectorAll('.da-tab').forEach((b, i) => b.classList.toggle('active', ['scanner','idcards'][i] === tab));
  document.querySelectorAll('.da-section').forEach(s => s.classList.remove('active'));
  const sec = document.getElementById(`da-${tab}-section`);
  if (sec) sec.classList.add('active');
  if (tab === 'idcards') daLoadCards(_daMode);
}

// ── Camera lifecycle ──────────────────────────────────────────
async function daStartCamera() {
  const errEl = document.getElementById('da-cam-err');
  if (errEl) errEl.textContent = '';
  try {
    _daStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } });
    const video = document.getElementById('da-video');
    video.srcObject = _daStream;
    await video.play();
    document.getElementById('da-cam-idle').style.display     = 'none';
    document.getElementById('da-scan-overlay').style.display = 'flex';
    document.getElementById('da-btn-start').style.display    = 'none';
    document.getElementById('da-btn-stop').style.display     = '';
    _daScanActive = true;
    daScanLoop();
  } catch (e) {
    if (errEl) errEl.textContent = 'Camera error: ' + e.message;
  }
}

function daStopCamera() {
  _daScanActive = false;
  if (_daStream) { _daStream.getTracks().forEach(t => t.stop()); _daStream = null; }
  const video = document.getElementById('da-video');
  if (video) { video.srcObject = null; }
  document.getElementById('da-cam-idle').style.display     = '';
  document.getElementById('da-scan-overlay').style.display = 'none';
  document.getElementById('da-btn-start').style.display    = '';
  document.getElementById('da-btn-stop').style.display     = 'none';
}

// ZXing reader singleton for barcode scanning
let _daBarcodeReader = null;
function _daGetBarcodeReader() {
  if (!_daBarcodeReader && typeof ZXing !== 'undefined') {
    const hints = new Map();
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
      ZXing.BarcodeFormat.CODE_128,
      ZXing.BarcodeFormat.CODE_39,
      ZXing.BarcodeFormat.EAN_13,
      ZXing.BarcodeFormat.EAN_8,
    ]);
    hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
    _daBarcodeReader = new ZXing.MultiFormatReader();
    _daBarcodeReader.setHints(hints);
  }
  return _daBarcodeReader;
}

function daScanLoop() {
  if (!_daScanActive) return;
  const video  = document.getElementById('da-video');
  const canvas = document.getElementById('da-canvas');
  if (!video || !canvas || video.readyState < 2) { requestAnimationFrame(daScanLoop); return; }
  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const reader = _daGetBarcodeReader();
  if (reader) {
    try {
      const lum    = new ZXing.HTMLCanvasElementLuminanceSource(canvas);
      const bmp    = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(lum));
      const result = reader.decode(bmp);
      if (result) {
        const text = result.getText();
        const now  = Date.now();
        if (text !== _daLastCode || now - _daLastCodeTs > 3000) {
          _daLastCode   = text;
          _daLastCodeTs = now;
          const statusEl = document.getElementById('da-cam-status');
          if (statusEl) statusEl.textContent = 'Barcode detected…';
          daProcessCode(text);
          setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 1500);
        }
      }
    } catch (e) { /* NotFoundException — no barcode in frame, normal */ }
  }
  requestAnimationFrame(daScanLoop);
}

// ── Determine status based on start time for staff or student ─
function daGetStatus(personType) {
  const now  = new Date();
  const hhmm = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
  const lateTimeId = personType === 'student' ? 'da-student-late-time' : 'da-staff-late-time';
  const lateTime   = document.getElementById(lateTimeId)?.value || '';
  if (lateTime && hhmm > lateTime) return 'late';
  return 'present';
}

// ── Mark attendance by code ───────────────────────────────────
async function daProcessCode(code) {
  const date    = document.getElementById('da-date')?.value || attToday();
  const timeStr = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const resultEl = document.getElementById('da-result-card');
  if (resultEl) resultEl.innerHTML = `<div style="color:var(--text-muted);font-size:0.82rem;padding:14px">Marking…</div>`;

  // Detect person type from code prefix to pick the right late time
  const isStudent = code.toUpperCase().startsWith('IDL-STUDENT');
  const personType = isStudent ? 'student' : 'staff';
  const status  = daGetStatus(personType);
  const notes   = `Digital: ${timeStr}`;

  try {
    const res = await api('api/attendance.php', 'POST', { type: personType === 'staff' ? 'staff' : 'student', qr_mark: true, code, status, date, notes });
    daShowResult(res, status, timeStr);
    daAddLog(res, status, timeStr);
  } catch (e) {
    if (resultEl) resultEl.innerHTML = `<div class="da-result-err">⚠ ${escapeHtml(e.message || 'Error marking attendance')}</div>`;
  }
}

function daShowResult(res, status, timeStr) {
  const el = document.getElementById('da-result-card');
  if (!el) return;
  const initial = (res.name || '?')[0].toUpperCase();
  const dupl = res.already_marked ? `<span class="da-result-dup">Updated</span>` : '';
  el.innerHTML = `
    <div class="da-result-content">
      <div class="da-result-avatar">${escapeHtml(initial)}</div>
      <div class="da-result-info">
        <div class="da-result-name">${escapeHtml(res.name || '—')}</div>
        <div class="da-result-sub">${escapeHtml(res.sub || (res.person_type === 'staff' ? 'Staff' : 'Student'))}</div>
        <div class="da-result-footer">
          ${attStatusBadge(status)}
          <span class="da-result-time">${timeStr}</span>
          ${dupl}
        </div>
      </div>
    </div>`;
}

function daAddLog(res, status, timeStr) {
  _daLog.unshift({ name: res.name, sub: res.sub, status, time: timeStr });
  const listEl  = document.getElementById('da-log-list');
  const countEl = document.getElementById('da-log-count');
  if (countEl) countEl.textContent = `${_daLog.length} scanned`;
  if (!listEl) return;
  listEl.innerHTML = _daLog.map(e => `
    <div class="da-log-item">
      <span class="da-log-time">${escapeHtml(e.time.slice(0,5))}</span>
      <span class="da-log-name">${escapeHtml(e.name)}</span>
      ${attStatusBadge(e.status)}
    </div>`).join('');
}

async function daManualMark() {
  const inp = document.getElementById('da-manual-input');
  const code = inp?.value?.trim();
  if (!code) { toast('Enter a barcode value', 'warn'); return; }
  await daProcessCode(code);
  if (inp) inp.value = '';
}

// ── ID Cards ──────────────────────────────────────────────────
async function daLoadCards(mode) {
  _daMode = mode;
  document.getElementById('da-card-mode-staff')  ?.classList.toggle('active', mode === 'staff');
  document.getElementById('da-card-mode-student')?.classList.toggle('active', mode === 'student');
  const grid = document.getElementById('da-cards-grid');
  if (!grid) return;
  grid.innerHTML = `<div class="da-cards-loading"><div style="opacity:.4">Loading…</div></div>`;

  // Reset search/filter UI
  const srch = document.getElementById('idc-search');
  if (srch) srch.value = '';
  const filt = document.getElementById('idc-class-filter');

  try {
    let people;
    if (mode === 'staff') {
      const raw = await api('api/teachers.php');
      people = (raw || []).map(t => ({
        id:    t.id,
        type:  'staff',
        code:  `IDL-STAFF-${t.id}`,
        name:  ((t.title ? t.title + ' ' : '') + (t.name || '')).trim() || '—',
        role:  t.designation || 'Staff',
        phone: t.phone || '',
        blood: t.blood_group || '',
        photo: t.photo || ''
      }));
      if (filt) filt.style.display = 'none';
    } else {
      const res = await api('api/students.php');
      people = (res || []).map(s => ({
        id:    s.id,
        type:  'student',
        code:  `IDL-STUDENT-${s.id}`,
        name:  s.student_name || s.name || '—',
        role:  s.class_name || 'Student',
        gr:    s.gr_number || '',
        blood: s.blood_group || '',
        dob:   s.date_of_birth || '',
        photo: s.photo || '',
        classId: s.class_id || ''
      }));
      // Populate class filter dropdown
      if (filt) {
        const classes = [...new Map(people.filter(p => p.role && p.role !== 'Student').map(p => [p.role, p.role])).values()].sort();
        filt.innerHTML = '<option value="">All Classes</option>' +
          classes.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
        filt.style.display = '';
      }
    }
    _daCardAll  = people;
    _daCardData = people;
    daRenderCards(people);
  } catch (e) {
    if (grid) grid.innerHTML = `<div class="da-cards-loading" style="color:var(--danger)">Error: ${escapeHtml(e.message)}</div>`;
  }
}

// ── Live search / filter ──────────────────────────────────────
function daCardFilter() {
  const q   = (document.getElementById('idc-search')?.value || '').toLowerCase().trim();
  const cls = document.getElementById('idc-class-filter')?.value || '';
  let filtered = _daCardAll;
  if (q)   filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || (p.gr || '').toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
  if (cls) filtered = filtered.filter(p => p.role === cls);
  _daCardData = filtered;
  daRenderCards(filtered);
}

// ── Render the card grid ──────────────────────────────────────
function daRenderCards(people) {
  const grid = document.getElementById('da-cards-grid');
  if (!grid) return;

  const countEl = document.getElementById('idc-count');
  if (countEl) countEl.textContent = `${people.length} card${people.length !== 1 ? 's' : ''}`;

  if (!people.length) { grid.innerHTML = '<div class="da-cards-loading">No cards found</div>'; return; }

  const schoolName  = escapeHtml(((window.schoolSettings || {}).school_name || 'IDL School').toUpperCase());
  const issuedDate  = new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});

  grid.innerHTML = people.map((p, idx) => {
    const isStaff   = p.type === 'staff';
    const cardLabel = isStaff ? 'Teacher ID Card' : 'Student ID Card';
    const qrId      = `idc-qr-${p.id}-${isStaff ? 't' : 's'}`;
    const initial   = (p.name || '?')[0].toUpperCase();

    // Photo element
    const photoHtml = p.photo
      ? `<img src="${escapeHtml(p.photo)}" alt="" loading="lazy"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
         <span class="idc-photo-init" style="display:none">${initial}</span>`
      : `<span class="idc-photo-init">${initial}</span>`;

    // Info rows (right panel)
    let rows = '';
    if (isStaff) {
      rows += `<div class="idc-info-row"><span class="idc-info-lbl">Teacher ID</span><span class="idc-info-val">${escapeHtml(p.id || p.code)}</span></div>`;
      if (p.role)  rows += `<div class="idc-info-row"><span class="idc-info-lbl">Grade/Year</span><span class="idc-info-val">${escapeHtml(p.role)}</span></div>`;
      if (p.phone) rows += `<div class="idc-info-row"><span class="idc-info-lbl">Phone</span><span class="idc-info-val">${escapeHtml(p.phone)}</span></div>`;
      if (p.blood) rows += `<div class="idc-info-row"><span class="idc-info-lbl">Blood</span><span class="idc-info-val">${escapeHtml(p.blood)}</span></div>`;
    } else {
      if (p.gr)    rows += `<div class="idc-info-row"><span class="idc-info-lbl">GR#</span><span class="idc-info-val">${escapeHtml(p.gr)}</span></div>`;
      if (p.role)  rows += `<div class="idc-info-row"><span class="idc-info-lbl">Class</span><span class="idc-info-val">${escapeHtml(p.role)}</span></div>`;
      if (p.blood) rows += `<div class="idc-info-row"><span class="idc-info-lbl">Blood</span><span class="idc-info-val">${escapeHtml(p.blood)}</span></div>`;
      if (p.dob)   rows += `<div class="idc-info-row"><span class="idc-info-lbl">DOB</span><span class="idc-info-val">${escapeHtml(p.dob)}</span></div>`;
    }

    return `
    <div class="idc-wrap">
      <div class="idc-card" id="idc-card-${idx}">
        <!-- Left blue panel: photo + card type -->
        <div class="idc-left">
          <div class="idc-photo">${photoHtml}</div>
          <div class="idc-card-label">${escapeHtml(cardLabel)}</div>
        </div>
        <!-- Right white panel: details + QR -->
        <div class="idc-right">
          <div class="idc-school-name">${schoolName}</div>
          <div class="idc-name">${escapeHtml(p.name)}</div>
          <div class="idc-role">${escapeHtml(p.role)}</div>
          ${rows ? `<div class="idc-info">${rows}</div>` : ''}
          <div class="idc-bottom-row">
            <div class="idc-issued">Issued On<br><strong>${issuedDate}</strong></div>
            <div class="idc-qr" id="${qrId}"><svg id="${qrId}-svg"></svg></div>
          </div>
        </div>
      </div>
      <div class="idc-btn-row">
        <button class="btn-action btn-download" onclick="daCardPrint(${idx})" title="Print / Save PDF">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               style="vertical-align:middle;margin-right:4px">
            <polyline points="6 9 6 2 18 2 18 9"/>
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
            <rect x="6" y="14" width="12" height="8"/>
          </svg>Print / PDF
        </button>
      </div>
    </div>`;
  }).join('');

  // Generate barcodes after DOM is ready
  if (typeof JsBarcode === 'undefined') { console.warn('JsBarcode not loaded'); return; }
  people.forEach(p => {
    const qrId = `idc-qr-${p.id}-${p.type === 'staff' ? 't' : 's'}`;
    const el   = document.getElementById(qrId + '-svg');
    if (el) {
      try {
        JsBarcode(el, p.code, {
          format:      'CODE128',
          width:       1.4,
          height:      38,
          displayValue: false,
          margin:      2,
          background:  '#ffffff',
          lineColor:   '#000000',
        });
      } catch(e) { console.warn('JsBarcode error', e); }
    }
  });
}

// ── Individual card: open popup → print / save as PDF ─────────
function daCardPrint(idx) {
  const p = _daCardData[idx];
  if (!p) return;

  const schoolName  = ((window.schoolSettings || {}).school_name || 'IDL School').toUpperCase();
  const isStaff     = p.type === 'staff';
  const cardLabel   = isStaff ? 'TEACHER ID CARD' : 'STUDENT ID CARD';
  const issuedDate  = new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});

  const initial = (p.name || '?')[0].toUpperCase();
  const photoHtml = p.photo
    ? `<img src="${p.photo}" alt="" style="width:100%;height:100%;object-fit:cover;display:block"
           onerror="this.style.display='none';this.parentElement.querySelector('.init').style.display='flex'">`
      + `<div class="init" style="display:none;width:100%;height:100%;align-items:center;justify-content:center;font-size:22pt;font-weight:800;color:#fff;font-family:Georgia,serif">${initial}</div>`
    : `<div class="init" style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;font-size:22pt;font-weight:800;color:#fff;font-family:Georgia,serif">${initial}</div>`;

  let infoRows = '';
  if (isStaff) {
    infoRows += `<div class="irow"><span class="ilbl">Name</span><span class="ival">${p.name}</span></div>`;
    infoRows += `<div class="irow"><span class="ilbl">Teacher ID</span><span class="ival">${p.id || p.code}</span></div>`;
    if (p.role)  infoRows += `<div class="irow"><span class="ilbl">Grade/Year</span><span class="ival">${p.role}</span></div>`;
    if (p.phone) infoRows += `<div class="irow"><span class="ilbl">Phone</span><span class="ival">${p.phone}</span></div>`;
    if (p.blood) infoRows += `<div class="irow"><span class="ilbl">Blood</span><span class="ival">${p.blood}</span></div>`;
  } else {
    infoRows += `<div class="irow"><span class="ilbl">Name</span><span class="ival">${p.name}</span></div>`;
    if (p.gr)    infoRows += `<div class="irow"><span class="ilbl">GR#</span><span class="ival">${p.gr}</span></div>`;
    if (p.role)  infoRows += `<div class="irow"><span class="ilbl">Class</span><span class="ival">${p.role}</span></div>`;
    if (p.blood) infoRows += `<div class="irow"><span class="ilbl">Blood</span><span class="ival">${p.blood}</span></div>`;
    if (p.dob)   infoRows += `<div class="irow"><span class="ilbl">DOB</span><span class="ival">${p.dob}</span></div>`;
  }
  infoRows += `<div class="irow"><span class="ilbl">Issued On</span><span class="ival">${issuedDate}</span></div>`;

  const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<title>ID Card — ${p.name}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  @page{size:85.6mm 54mm landscape;margin:0}
  body{
    width:85.6mm; min-height:54mm;
    font-family:Arial,Helvetica,sans-serif;
    background:#e4e8f0;
    -webkit-print-color-adjust:exact; print-color-adjust:exact;
    display:flex; flex-direction:column; gap:6mm;
    padding:6mm;
  }
  @media print{
    body{ gap:0; padding:0; background:#fff; }
    .card{ page-break-after:always; }
    .card:last-child{ page-break-after:avoid; }
  }
  /* ── Shared card shell ── */
  .card{
    width:85.6mm; height:54mm; border-radius:3mm; overflow:hidden;
    display:flex; flex-direction:row;
    background:#fff;
    box-shadow:0 3mm 8mm rgba(0,0,0,0.25);
    -webkit-print-color-adjust:exact; print-color-adjust:exact;
    flex-shrink:0;
  }
  /* ── Left blue panel ── */
  .left{
    width:32mm; flex-shrink:0;
    background:linear-gradient(160deg,#2d3aad 0%,#3b4ec4 55%,#1e2d9e 100%);
    display:flex; flex-direction:column; align-items:center;
    justify-content:center; padding:4mm 3mm; position:relative;
    -webkit-print-color-adjust:exact; print-color-adjust:exact;
  }
  .left::after{
    content:''; position:absolute; top:2mm; right:2mm;
    width:8mm; height:5mm;
    background-image:radial-gradient(circle, rgba(255,255,255,0.32) 1px, transparent 1px);
    background-size:2mm 1.8mm;
  }
  .left::before{
    content:''; position:absolute; top:0; right:0;
    width:0; height:0; border-style:solid;
    border-width:0 8mm 18mm 0;
    border-color:transparent rgba(255,255,255,0.07) transparent transparent;
  }
  .photo{
    width:20mm; height:20mm; border-radius:50%; overflow:hidden;
    border:0.6mm solid rgba(255,255,255,0.75);
    background:rgba(255,255,255,0.15);
    display:flex; align-items:center; justify-content:center;
    margin-bottom:2.5mm; flex-shrink:0;
  }
  .clabel{
    font-size:5.5pt; color:rgba(255,255,255,0.88); letter-spacing:.5pt;
    text-transform:uppercase; font-weight:700; text-align:center; line-height:1.4;
  }
  /* ── Right white panel ── */
  .right{
    flex:1; display:flex; flex-direction:column;
    padding:4mm 4mm 3mm; background:#fff; position:relative; overflow:hidden;
  }
  .right::after{
    content:''; position:absolute; top:-9mm; right:-9mm;
    width:26mm; height:26mm; border-radius:50%;
    border:5mm solid #8fc43a; opacity:.16; pointer-events:none;
  }
  .right::before{
    content:''; position:absolute; bottom:0; left:0;
    width:0; height:0; border-style:solid;
    border-width:11mm 0 0 11mm;
    border-color:transparent transparent transparent #2d3aad;
    opacity:.10; pointer-events:none;
  }
  .school{
    font-family:'Cinzel',serif; font-size:6pt; font-weight:700;
    color:#2d3aad; letter-spacing:.4pt; text-transform:uppercase;
    margin-bottom:1mm; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  }
  .pname{ font-size:8.5pt; font-weight:800; color:#1a1a2e; margin-bottom:0.8mm; line-height:1.2; }
  .prole{ font-size:6pt; color:#2d3aad; letter-spacing:.3pt; text-transform:uppercase; font-weight:700; margin-bottom:2.5mm; }
  .irow{ display:flex; font-size:5.5pt; margin-bottom:1mm; line-height:1.4; }
  .ilbl{ color:#999; min-width:13mm; flex-shrink:0; font-weight:700; text-transform:uppercase; font-size:5pt; letter-spacing:.2pt; }
  .ival{ color:#1a1a2e; flex:1; }
  /* bottom row: issued + barcode */
  .brow{ margin-top:auto; display:flex; align-items:flex-end; justify-content:space-between; }
  .issued{ font-size:5pt; color:#aaa; line-height:1.6; }
  .issued strong{ color:#555; }
  .qrbox canvas{ border-radius:1mm; background:#fff; padding:0.5mm; box-shadow:0 0 0 0.3mm rgba(0,0,0,0.12); }

  /* ── Back of card ── */
  .back-card{
    width:85.6mm; height:54mm; border-radius:3mm; overflow:hidden;
    display:flex; flex-direction:row;
    background:#fff;
    box-shadow:0 3mm 8mm rgba(0,0,0,0.25);
    -webkit-print-color-adjust:exact; print-color-adjust:exact;
    flex-shrink:0;
  }
  .back-left{
    width:32mm; flex-shrink:0;
    background:linear-gradient(160deg,#2d3aad 0%,#3b4ec4 55%,#1e2d9e 100%);
    display:flex; flex-direction:column; align-items:center;
    justify-content:center; padding:4mm 3mm; position:relative;
    -webkit-print-color-adjust:exact; print-color-adjust:exact;
  }
  .back-left::after{
    content:''; position:absolute; top:2mm; right:2mm;
    width:8mm; height:5mm;
    background-image:radial-gradient(circle, rgba(255,255,255,0.32) 1px, transparent 1px);
    background-size:2mm 1.8mm;
  }
  .back-left-school{
    font-family:'Cinzel',serif; font-size:6.5pt; font-weight:900; color:#fff;
    text-align:center; text-transform:uppercase; letter-spacing:.5pt; line-height:1.4;
    margin-bottom:2mm;
  }
  .back-left-qr{ display:flex; align-items:center; justify-content:center; }
  .back-left-qr svg{ border-radius:1mm; background:#fff !important; padding:0.5mm; }
  .back-left-code{ font-size:4pt; color:rgba(255,255,255,0.55); margin-top:1.5mm; text-align:center; font-family:monospace; letter-spacing:.3pt; }
  .back-right{
    flex:1; display:flex; flex-direction:column;
    padding:4mm 4mm 3mm; background:#fff; position:relative; overflow:hidden;
  }
  .back-right::after{
    content:''; position:absolute; top:-9mm; right:-9mm;
    width:26mm; height:26mm; border-radius:50%;
    border:5mm solid #8fc43a; opacity:.16; pointer-events:none;
  }
  .back-right::before{
    content:''; position:absolute; bottom:0; left:0;
    width:0; height:0; border-style:solid;
    border-width:11mm 0 0 11mm;
    border-color:transparent transparent transparent #2d3aad;
    opacity:.10; pointer-events:none;
  }
  .tc-title{
    font-family:'Cinzel',serif; font-size:8pt; font-weight:900; color:#1a1a2e;
    text-align:center; letter-spacing:.6pt; text-transform:uppercase;
    margin-bottom:2mm; border-bottom:0.3mm solid #ddd; padding-bottom:1.5mm;
  }
  .tc-body{
    font-size:5pt; color:#555; line-height:1.55; text-align:center;
    margin-bottom:auto;
  }
  .tc-footer{
    display:flex; justify-content:space-between; align-items:flex-end;
    font-size:4.5pt; color:#888; margin-top:2mm;
    border-top:0.3mm solid #eee; padding-top:1.5mm;
  }
</style>
</head><body>

<!-- ═══ FRONT ═══ -->
<div class="card">
  <div class="left">
    <div class="photo">${photoHtml}</div>
    <div class="clabel">${cardLabel}</div>
  </div>
  <div class="right">
    <div class="school">${schoolName}</div>
    <div class="pname">${p.name}</div>
    <div class="prole">${p.role}</div>
    ${infoRows}
  </div>
</div>

<!-- ═══ BACK ═══ -->
<div class="back-card">
  <div class="back-left">
    <div class="back-left-school">${schoolName}</div>
    <div class="back-left-qr"><svg id="bcback"></svg></div>
    <div class="back-left-code">${p.code}</div>
  </div>
  <div class="back-right">
    <div class="tc-title">Terms &amp; Conditions</div>
    <div class="tc-body">
      This card is the property of the institution and must be
      carried at all times as a means of identification.
      The holder is responsible for keeping it in good condition.
      In the event of loss, resignation, or contract expiry,
      this card must be returned immediately.
    </div>
    <div class="tc-footer">
      <span>${schoolName}</span>
      <span>Issued: ${issuedDate}</span>
    </div>
  </div>
</div>

<script>
  window.addEventListener('load', function() {
    if (typeof JsBarcode !== 'undefined') {
      JsBarcode('#bcback', '${p.code}', {
        format:      'CODE128',
        width:       1.4,
        height:      34,
        displayValue: false,
        margin:      2,
        background:  '#ffffff',
        lineColor:   '#000000',
      });
    }
    setTimeout(function(){ window.print(); }, 900);
  });
<\/script>
</body></html>`;

  const win = window.open('', '_blank', 'width=450,height=560,scrollbars=no');
  if (!win) { toast('Allow pop-ups in your browser to print cards', 'warn'); return; }
  win.document.write(html);
  win.document.close();
}


// (end of attendance.js)
