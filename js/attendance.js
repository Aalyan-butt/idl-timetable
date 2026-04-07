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

function saUpdatePills() {
  const counts = { present: 0, absent: 0, late: 0, leave: 0, pending: 0, unmarked: 0 };
  _saData.forEach(t => {
    if (t.status && counts[t.status] !== undefined) counts[t.status]++;
    else if (!t.status) counts.unmarked++;
  });
  const el = (id, txt) => { const e = document.getElementById(id); if (e) e.textContent = txt; };
  el('sa-pill-present',  `${counts.present} Present`);
  el('sa-pill-absent',   `${counts.absent} Absent`);
  el('sa-pill-late',     `${counts.late} Late`);
  el('sa-pill-leave',    `${counts.leave} Leave`);
  el('sa-pill-pending',  `${counts.pending} Pending`);
  el('sa-pill-unmarked', `${counts.unmarked} Unmarked`);
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
}

async function stattLoad() {
  const classId = document.getElementById('statt-class')?.value || '';
  const date    = document.getElementById('statt-date')?.value  || attToday();
  const wrap    = document.getElementById('statt-table-wrap');
  const bulk    = document.getElementById('statt-bulk');
  const savebar = document.getElementById('statt-save-bar');
  const info    = document.getElementById('statt-enroll-info');
  // reset pending filter on reload
  _stattPendingFilter = false;
  const pb = document.getElementById('statt-pending-btn');
  if (pb) { pb.style.background = pb.style.borderColor = pb.style.color = ''; pb.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:4px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>View Pending'; }
  if (!classId) {
    if (info) info.textContent = '';
    if (wrap) wrap.style.display = '';
    if (bulk) bulk.style.display = 'none';
    if (savebar) savebar.style.display = 'none';
    const tbody = document.getElementById('statt-tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:48px 20px;color:var(--text-muted)">Select a class above to load students</td></tr>`;
    return;
  }
  const tbody = document.getElementById('statt-tbody');
  if (tbody) tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--text-muted)">Loading…</td></tr>`;
  if (wrap) wrap.style.display = '';
  if (bulk) bulk.style.display = 'flex';
  if (savebar) savebar.style.display = 'flex';
  try {
    const res = await api(`api/attendance.php?type=student&date=${encodeURIComponent(date)}&class_id=${classId}`);
    _stattData = res.students.map(s => ({ ...s, status: s.status || null, notes: s.notes || '' }));
    stattRenderTable();
    stattUpdatePills();
    if (info) info.textContent = `${_stattData.length} enrolled student${_stattData.length != 1 ? 's' : ''}`;
  } catch (e) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--danger)">Failed: ${e.message}</td></tr>`;
  }
}

function stattRenderTable() {
  const tbody = document.getElementById('statt-tbody');
  if (!tbody) return;
  if (!_stattData.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--text-muted)">No enrolled students found for this class.</td></tr>`;
    return;
  }
  tbody.innerHTML = _stattData.map((s, i) => {
    const rowCls = s.status ? `att-row-${s.status}` : '';
    return `<tr class="${rowCls}" id="statt-row-${s.id}">
      <td class="att-num">${i + 1}</td>
      <td>
        <div class="att-name-cell">${escapeHtml(s.full_name)}</div>
        ${s.reg_number ? `<div class="att-designation">${escapeHtml(s.reg_number)}</div>` : ''}
      </td>
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
  el('statt-pill-present',  `${counts.present} Present`);
  el('statt-pill-absent',   `${counts.absent} Absent`);
  el('statt-pill-late',     `${counts.late} Late`);
  el('statt-pill-leave',    `${counts.leave} Leave`);
  el('statt-pill-pending',  `${counts.pending} Pending`);
  el('statt-pill-unmarked', `${counts.unmarked} Unmarked`);
}

function stattUpdateProgress() {
  const marked = _stattData.filter(s => s.status).length;
  const el = document.getElementById('statt-progress');
  if (el) el.textContent = `${marked} / ${_stattData.length} marked`;
}

async function stattSave() {
  const date    = document.getElementById('statt-date')?.value || attToday();
  const classId = parseInt(document.getElementById('statt-class')?.value || '0');
  const records = _stattData.filter(s => s.status).map(s => ({ id: s.id, status: s.status, notes: s.notes || '' }));
  if (!classId) { toast('Select a class first', 'warn'); return; }
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
// DIGITAL ATTENDANCE — QR Scanner + ID Card Generator
// =============================================================
let _daMode       = 'staff';  // 'staff' | 'student'
let _daStream     = null;
let _daScanActive = false;
let _daLastCode   = '';
let _daLastCodeTs = 0;
let _daLog        = [];

function initDigitalAttendancePage() {
  const inp = document.getElementById('da-date');
  if (inp && !inp.value) inp.value = attToday();
}

function initStaffIdCardsPage()   { daLoadCards('staff'); }
function initStudentIdCardsPage() { daLoadCards('student'); }

function daSwitchTab(tab) {
  document.querySelectorAll('.da-tab').forEach((b, i) => b.classList.toggle('active', ['scanner','idcards'][i] === tab));
  document.querySelectorAll('.da-section').forEach(s => s.classList.remove('active'));
  const sec = document.getElementById(`da-${tab}-section`);
  if (sec) sec.classList.add('active');
  if (tab === 'idcards') daLoadCards(_daMode);
}

function daSetMode(mode) {
  _daMode = mode;
  document.getElementById('da-mode-staff')  ?.classList.toggle('active', mode === 'staff');
  document.getElementById('da-mode-student')?.classList.toggle('active', mode === 'student');
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

function daScanLoop() {
  if (!_daScanActive) return;
  const video  = document.getElementById('da-video');
  const canvas = document.getElementById('da-canvas');
  if (!video || !canvas || video.readyState < 2) { requestAnimationFrame(daScanLoop); return; }
  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  if (typeof jsQR !== 'undefined') {
    const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
    if (code && code.data) {
      const now = Date.now();
      if (code.data !== _daLastCode || now - _daLastCodeTs > 3000) {
        _daLastCode   = code.data;
        _daLastCodeTs = now;
        const statusEl = document.getElementById('da-cam-status');
        if (statusEl) statusEl.textContent = 'Code detected…';
        daProcessCode(code.data);
        setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 1500);
      }
    }
  }
  requestAnimationFrame(daScanLoop);
}

// ── Mark attendance by code ───────────────────────────────────
async function daProcessCode(code) {
  const status  = document.getElementById('da-status-select')?.value || 'present';
  const date    = document.getElementById('da-date')?.value || attToday();
  const timeStr = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const notes   = `Digital: ${timeStr}`;
  const resultEl = document.getElementById('da-result-card');
  if (resultEl) resultEl.innerHTML = `<div style="color:var(--text-muted);font-size:0.82rem;padding:14px">Marking…</div>`;
  try {
    const res = await api('api/attendance.php', 'POST', { type: 'staff', qr_mark: true, code, status, date, notes });
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
  if (!code) { toast('Enter a QR code value', 'warn'); return; }
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
  try {
    let people;
    if (mode === 'staff') {
      people = await api('api/teachers.php');
      people = people.map(t => ({
        id: t.id,
        code: `IDL-STAFF-${t.id}`,
        name: ((t.title ? t.title + ' ' : '') + t.name).trim(),
        sub: t.designation || 'Staff'
      }));
    } else {
      const res = await api('api/students.php');
      people = (res || []).map(s => ({
        id: s.id,
        code: `IDL-STUDENT-${s.id}`,
        name: s.student_name || s.name || '—',
        sub: s.class_name || s.gr_number || 'Student'
      }));
    }
    daRenderCards(people);
  } catch (e) {
    if (grid) grid.innerHTML = `<div class="da-cards-loading" style="color:var(--danger)">Error: ${escapeHtml(e.message)}</div>`;
  }
}

function daRenderCards(people) {
  const grid = document.getElementById('da-cards-grid');
  if (!grid) return;
  if (!people.length) { grid.innerHTML = '<div class="da-cards-loading">No records found</div>'; return; }
  grid.innerHTML = people.map(p => `
    <div class="da-id-card">
      <div class="da-id-card-logo">IDL</div>
      <div class="da-id-card-qr" id="da-qr-${p.id}-${p.code.startsWith('IDL-STAFF') ? 's' : 'p'}"></div>
      <div class="da-id-card-name">${escapeHtml(p.name)}</div>
      <div class="da-id-card-sub">${escapeHtml(p.sub)}</div>
      <div class="da-id-card-code">${escapeHtml(p.code)}</div>
    </div>`).join('');
  // Generate QR codes after DOM insertion
  if (typeof QRCode === 'undefined') { console.warn('QRCode.js not loaded'); return; }
  people.forEach(p => {
    const suffix = p.code.startsWith('IDL-STAFF') ? 's' : 'p';
    const el = document.getElementById(`da-qr-${p.id}-${suffix}`);
    if (el) new QRCode(el, { text: p.code, width: 100, height: 100, colorDark:'#000', colorLight:'#fff' });
  });
}


// (end of attendance.js)
