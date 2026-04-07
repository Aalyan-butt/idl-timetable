// ===== IMAGE COMPRESSION =====
// Compress a base64 data URL to fit within DB/packet limits.
// maxW/maxH: max pixel dimensions. quality: JPEG 0-1.
function compressImage(dataUrl, maxW, maxH, quality) {
  return new Promise(function(resolve) {
    const img = new Image();
    img.onload = function() {
      let w = img.width, h = img.height;
      if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
      if (h > maxH) { w = Math.round(w * maxH / h); h = maxH; }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality || 0.72));
    };
    img.onerror = function() { resolve(dataUrl); }; // fallback: return original
    img.src = dataUrl;
  });
}

// ===== GENERIC EXCEL DOWNLOAD =====
function _generateExcel(headers, dataRows, sheetName, filename, logoBase64, studentInfo) {
  function x(v) {
    return String(v == null ? '' : v)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  const schoolName = (schoolSettings && schoolSettings.school_name) ? schoolSettings.school_name : 'Institute of Dynamic Learning';
  const now = new Date();
  const dateStr = `${now.getDate().toString().padStart(2,'0')}-${(now.getMonth()+1).toString().padStart(2,'0')}-${now.getFullYear()}`;
  const colCount = headers.length;
  const headerCells = headers.map(h =>
    `<th style="background:#1a1a5e;color:#c9a84c;font-weight:700;font-size:14pt;font-family:Calibri,Arial,sans-serif;padding:10px 14px;border:1px solid #3a3a8e;white-space:nowrap;text-align:center;vertical-align:middle;letter-spacing:0.5px">${x(h)}</th>`
  ).join('');
  const bodyRows = dataRows.map((row, i) => {
    const bg = i % 2 === 0 ? '#f0f0ff' : '#ffffff';
    const cells = row.map(val => {
      if (typeof val === 'string' && val.startsWith('__IMG__')) {
        const src = val.slice(7);
        return `<td style="background:${bg};padding:4px 12px;border:1px solid #d0d0e8;text-align:center;vertical-align:middle"><img src="${src}" width="40" height="40" style="border-radius:50%;vertical-align:middle"></td>`;
      }
      return `<td style="background:${bg};color:#1a1a2e;font-size:12pt;font-family:Calibri,Arial,sans-serif;padding:7px 12px;border:1px solid #d0d0e8;vertical-align:middle">${x(val)}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');
  const logoRow = logoBase64
    ? `<tr><td colspan="${colCount}" style="background:#0a0a30;text-align:center;padding:8px;border:2px solid #3a3a8e"><img src="${logoBase64}" width="52" height="52" style="border-radius:50%;border:2px solid #c9a84c;vertical-align:middle"></td></tr>`
    : '';
  const studentRow = studentInfo
    ? `<tr><td colspan="${colCount}" style="background:#eeeef8;text-align:center;padding:8px 14px;border:1px solid #c0c0de;font-family:Calibri,Arial,sans-serif">${studentInfo.photo ? `<img src="${x(studentInfo.photo)}" width="38" height="38" style="border-radius:50%;vertical-align:middle;margin-right:8px;border:2px solid #c9a84c">` : ''}<span style="font-size:13pt;font-weight:700;color:#0d0d40;vertical-align:middle">${x(studentInfo.name||'')}</span>${studentInfo.gr ? `<span style="font-size:10pt;color:#555;margin-left:8px;vertical-align:middle">GR: ${x(studentInfo.gr)}</span>` : ''}</td></tr>`
    : '';
  const xlsHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8">
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>${x(sheetName.slice(0,31))}</x:Name><x:WorksheetOptions><x:Selected/><x:FreezePanes/><x:FrozenNoSplit/>
<x:SplitHorizontal>3</x:SplitHorizontal><x:TopRowBottomPane>3</x:TopRowBottomPane><x:ActivePane>2</x:ActivePane>
</x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
<style>body{font-family:Calibri,Arial,sans-serif;}table{border-collapse:collapse;}</style></head><body>
<table>
  <thead>
    ${logoRow}
    <tr><th colspan="${colCount}" style="background:#0a0a30;color:#c9a84c;font-size:16pt;font-weight:700;font-family:Calibri,Arial,sans-serif;padding:14px 20px;border:2px solid #3a3a8e;text-align:center;letter-spacing:1.5px">${x(schoolName)}</th></tr>
    ${studentRow}
    <tr><th colspan="${colCount}" style="background:#1a1a5e;color:#9090cc;font-size:10pt;font-family:Calibri,Arial,sans-serif;padding:5px 20px;border:1px solid #3a3a8e;text-align:center">${x(sheetName)}</th></tr>
    <tr>${headerCells}</tr>
  </thead>
  <tbody>${bodyRows}</tbody>
</table></body></html>`;
  const blob = new Blob(['\uFEFF' + xlsHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${filename}_${dateStr}.xls`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

async function downloadGenericExcel(tbodyId, headers, sheetName, filename, studentInfo) {
  if (typeof _ensureLogo === 'function') await _ensureLogo();
  const tbody = document.getElementById(tbodyId);
  if (!tbody) { toast('No data table found', 'error'); return; }
  const table = tbody.closest('table');
  // Auto-detect visible, non-actions headers when table uses data-col
  let effectiveHeaders = headers;
  const visThs = table ? Array.from(table.querySelectorAll('thead th[data-col]'))
    .filter(th => th.style.display !== 'none' && !th.dataset.col.endsWith('-actions')) : [];
  if (visThs.length > 0) effectiveHeaders = visThs.map(th => th.textContent.trim());

  const rows = Array.from(tbody.querySelectorAll('tr')).filter(r =>
    r.style.display !== 'none' && !r.querySelector('td[colspan]') && r.querySelectorAll('td').length > 0
  );
  if (!rows.length) { toast('No data to download', 'error'); return; }

  // If table uses data-col, filter to visible non-actions cells
  const hasDataCol = rows[0]?.querySelector('td[data-col]');
  function _extractCellVal(td) {
    const img = td.querySelector('img');
    if (img && !td.textContent.trim()) return '__IMG__' + img.src;
    if (td.querySelector('svg') && !td.textContent.trim()) return '—';
    return td.textContent.trim();
  }
  const dataRows = hasDataCol
    ? rows.map(r => Array.from(r.querySelectorAll('td[data-col]'))
        .filter(td => td.style.display !== 'none' && !td.dataset.col.endsWith('-actions'))
        .map(td => _extractCellVal(td)))
    : rows.map(r => Array.from(r.querySelectorAll('td')).slice(0, effectiveHeaders.length).map(td => _extractCellVal(td)));

  const logo = (typeof _logoBase64 !== 'undefined' && _logoBase64) ? _logoBase64 : null;
  _generateExcel(effectiveHeaders, dataRows, sheetName, filename, logo, studentInfo || null);
}

function downloadTrackExcel() {
  if (!_trackDataCache) { toast('Load the Track view first, then download', 'error'); return; }
  let rows = [];
  if (_trackDataCache.singleTeacher) {
    const ts = _trackDataCache.singleTeacher;
    const name = `${normalizeTitle(ts.teacher.title)} ${ts.teacher.name}`;
    rows.push([name, ts.slots.length > 0 ? 'Busy' : 'Free',
      ts.slots.length > 0 ? ts.slots.map(sl=>`${sl.class_name} — ${sl.subject} (${formatTime(sl.start_time)}–${formatTime(sl.end_time)})`).join('; ') : 'Available']);
  } else {
    _trackDataCache.busy.forEach(t => rows.push([t.name, 'Busy', t.slots.join('; ') || '—']));
    _trackDataCache.free.forEach(t => rows.push([t.name, 'Free', 'Available']));
  }
  _generateExcel(['Teacher', 'Status', 'Class Details'], rows, 'Track Teachers', 'IDL_Track_Teachers');
}

function downloadSearchExcel() {
  if (!_searchSlotsCache) { toast('Search for a teacher first', 'error'); return; }
  const { teacherName, slots } = _searchSlotsCache;
  const rows = slots.map((s, i) => [String(i+1), s.subject||'—', s.class_name||'—', formatDays(s.days), `${formatTime(s.start_time)} – ${formatTime(s.end_time)}`, s.day_group||'—']);
  _generateExcel(['#', 'Subject', 'Class', 'Days', 'Time', 'Group'], rows, `${teacherName} Schedule`, `${(teacherName||'teacher').replace(/\s+/g,'_')}_schedule`);
}

function _getSETableData() {
  const tbody = document.getElementById('se-body');
  if (!tbody) return null;
  const table = tbody.closest('table');
  if (!table) return null;
  const headers = Array.from(table.querySelectorAll('thead th'))
    .map(th => th.textContent.trim())
    .filter(h => h !== 'Actions');
  const rows = Array.from(tbody.querySelectorAll('tr')).filter(r =>
    r.style.display !== 'none' && r.querySelectorAll('td').length > 0
  );
  const dataRows = rows.map(r =>
    Array.from(r.querySelectorAll('td')).slice(0, headers.length).map(td => td.textContent.trim())
  );
  return { headers, dataRows };
}

function downloadSEExcel() {
  const d = _getSETableData();
  if (!d || !d.dataRows.length) { toast('No data to download', 'error'); return; }
  _generateExcel(d.headers, d.dataRows, 'Subject Enrollment', 'IDL_Subject_Enrollment');
}

function downloadSEPDF(orientation, scale) {
  const d = _getSETableData();
  if (!d || !d.dataRows.length) { toast('No data to download', 'error'); return; }
  downloadTableDoc('se-body', 'subject_enrollment', d.headers, 'pdf', 'A4', orientation, scale || getMenuScale('se-dm'));
}

function _hideLoader() {
  const loader = document.getElementById('app-loader');
  if (!loader) return;
  loader.classList.add('fade-out');
  setTimeout(() => { loader.style.display = 'none'; }, 380);
}

function showSpinner() {
  const s = document.getElementById('page-spinner');
  if (s) s.style.display = 'block';
}

function hideSpinner() {
  const s = document.getElementById('page-spinner');
  if (s) s.style.display = 'none';
}

async function checkAuth() {
  // Fresh tab open (sessionStorage cleared) → always force login
  if (!sessionStorage.getItem('tab_active')) {
    try { await api(`${API.auth}?action=logout`, 'POST'); } catch {}
    currentUser = null;
    _hideLoader();
    showLogin();
    return;
  }
  // Page refresh → resume existing session
  try {
    const data = await api(`${API.auth}?action=check`);
    if (data.authenticated) {
      currentUser = {
        user_id:                data.user_id,
        username:               data.username,
        role:                   data.role,
        student_id:             data.student_id             || null,
        parent_id:              data.parent_id              || null,
        student_ids:            data.student_ids            || '',
        teacher_ids_perm:       data.teacher_ids_perm       || '',
        class_ids_perm:         data.class_ids_perm         || '',
        supervisor_teacher_ids: data.supervisor_teacher_ids || '',
        supervisor_class_ids:   data.supervisor_class_ids   || '',
        supervisor_user_ids:    data.supervisor_user_ids    || ''
      };
      showApp(false); // false = page refresh, restore last visited page
      _hideLoader();
      return;
    }
  } catch {}
  currentUser = null;
  sessionStorage.removeItem('tab_active');
  _hideLoader();
  showLogin();
}

// ===== TOAST =====
function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = (type === 'success' ? '✓ ' : '✕ ') + msg;
  el.className = `toast toast-${type} show`;
  setTimeout(() => el.classList.remove('show'), 5000);
}

// ===== UTILS =====
function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function formatTime(t) {
  if (!t) return '—';
  const [h, m] = t.split(':');
  const hour = parseInt(h);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
}
function formatDays(days) {
  if (!days) return '—';
  return days.split(',').map(d => d.trim().slice(0,3)).join(', ');
}

// ===== PAGE SEARCH FILTERS =====
// Generic table filter — all per-page filter functions delegate here
function filterTable(searchId, tbodyId, emptyLabel, colspan, perPageId, countLabelId) {
  const q = (document.getElementById(searchId)?.value || '').toLowerCase().trim();
  const perPage = perPageId ? parseInt(document.getElementById(perPageId)?.value ?? '0') : 0;
  const rows = document.querySelectorAll(`#${tbodyId} tr`);
  const matchingRows = [];
  rows.forEach(row => {
    if (row.classList.contains('filter-empty')) { row.remove(); return; }
    if (row.querySelector('td[colspan]')) return;
    const show = !q || row.textContent.toLowerCase().includes(q);
    if (show) matchingRows.push(row);
    else row.style.display = 'none';
  });
  matchingRows.forEach((row, i) => { row.style.display = (perPage === 0 || i < perPage) ? '' : 'none'; });
  const total = matchingRows.length;
  if (countLabelId) {
    const countEl = document.getElementById(countLabelId);
    if (countEl) countEl.textContent = total > 0 ? (perPage > 0 && total > perPage ? `Showing ${perPage} of ${total}` : `${total} record${total !== 1 ? 's' : ''}`) : '';
  }
  const existing = document.querySelector(`#${tbodyId} .filter-empty`);
  if (existing) existing.remove();
  if (total === 0 && q) {
    const tr = document.createElement('tr');
    tr.className = 'filter-empty';
    tr.innerHTML = `<td colspan="${colspan}" style="text-align:center;padding:28px;color:var(--text-muted)">${emptyLabel} &ldquo;${q}&rdquo;</td>`;
    document.getElementById(tbodyId).appendChild(tr);
  }
}

function filterTeachers() {
  const colspan = (currentUser?.role === 'admin' || currentUser?.role === 'superadmin' || currentUser?.role === 'supervisor') ? 9 : 8;
  filterTable('teachers-search', 'teachers-body', 'No teachers match', colspan, 'teachers-per-page', 'teachers-count-label');
}

// ===== FREE SLOT TOOLTIP =====
let _freeTooltipEl = null;
let _freeTooltipLocked = false;
let _freeTooltipLockedIcon = null;

function _buildFreeTooltip(iconEl) {
  let dayMap;
  try { dayMap = JSON.parse(iconEl.dataset.free); } catch { return null; }
  const dayOrder = ['Monday','Tuesday','Wednesday','Thursday','Friday'];

  const tip = document.createElement('div');
  tip.id = 'free-slot-tooltip';
  tip.style.cssText = `
    position:fixed;z-index:9999;
    background:#0d0d2e;border:1px solid rgba(255,170,0,0.35);border-radius:10px;
    padding:12px 16px;min-width:220px;max-width:320px;
    box-shadow:0 8px 32px rgba(0,0,0,0.5);
    font-size:0.82rem;color:var(--text);
    pointer-events:none;
  `;
  const title = document.createElement('div');
  title.style.cssText = 'font-weight:700;color:#ffaa00;margin-bottom:8px;font-size:0.85rem;display:flex;align-items:center;gap:6px';
  title.innerHTML = '⚠ Free Slots Available';
  tip.appendChild(title);

  const ordered = dayOrder.filter(d => dayMap[d]);
  ordered.forEach((day, i) => {
    const slots = dayMap[day];
    const row = document.createElement('div');
    row.style.cssText = `display:flex;flex-direction:column;gap:3px;${i < ordered.length-1 ? 'margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.06)' : ''}`;
    const dayLabel = document.createElement('div');
    dayLabel.style.cssText = 'font-weight:600;color:var(--text-muted);font-size:0.75rem;text-transform:uppercase;letter-spacing:.5px';
    dayLabel.textContent = day;
    row.appendChild(dayLabel);
    slots.forEach(s => {
      const pill = document.createElement('div');
      pill.style.cssText = 'display:inline-flex;align-items:center;gap:5px;background:rgba(255,170,0,0.1);border:1px solid rgba(255,170,0,0.25);border-radius:5px;padding:2px 8px;font-size:0.8rem;color:#ffcc55;width:fit-content';
      pill.innerHTML = `🕐 ${formatTime(s.from+':00')} – ${formatTime(s.to+':00')}`;
      row.appendChild(pill);
    });
    tip.appendChild(row);
  });

  document.body.appendChild(tip);

  // Position: prefer below-right of icon, flip if off-screen
  const rect = iconEl.getBoundingClientRect();
  const tipW = 280, tipH = tip.offsetHeight || 160;
  let left = rect.right + 8;
  let top  = rect.top;
  if (left + tipW > window.innerWidth - 12)  left = rect.left - tipW - 8;
  if (top  + tipH > window.innerHeight - 12) top  = window.innerHeight - tipH - 12;
  if (top < 8) top = 8;
  tip.style.left = left + 'px';
  tip.style.top  = top  + 'px';
  return tip;
}

function showFreeTooltip(event, iconEl) {
  if (_freeTooltipLocked) return; // respect locked state; don't replace on hover
  if (_freeTooltipEl) { _freeTooltipEl.remove(); _freeTooltipEl = null; }
  _freeTooltipEl = _buildFreeTooltip(iconEl);
}

function hideFreeTooltip() {
  if (_freeTooltipLocked) return; // don't hide on mouseleave when locked
  if (_freeTooltipEl) { _freeTooltipEl.remove(); _freeTooltipEl = null; }
}

function toggleFreeTooltipLock(event, iconEl) {
  event.stopPropagation();
  if (_freeTooltipLocked && _freeTooltipLockedIcon === iconEl) {
    // Same icon clicked again — release lock and hide
    _freeTooltipLocked = false;
    _freeTooltipLockedIcon = null;
    if (_freeTooltipEl) { _freeTooltipEl.remove(); _freeTooltipEl = null; }
    iconEl.style.background = 'rgba(255,170,0,0.15)';
    iconEl.style.borderColor = 'rgba(255,170,0,0.4)';
  } else {
    // Lock onto this icon — show or keep tooltip and pin it
    if (_freeTooltipLockedIcon && _freeTooltipLockedIcon !== iconEl) {
      // Release previous lock first
      _freeTooltipLockedIcon.style.background = 'rgba(255,170,0,0.15)';
      _freeTooltipLockedIcon.style.borderColor = 'rgba(255,170,0,0.4)';
    }
    if (_freeTooltipEl) { _freeTooltipEl.remove(); _freeTooltipEl = null; }
    _freeTooltipLocked = false; // allow build
    _freeTooltipEl = _buildFreeTooltip(iconEl);
    _freeTooltipLocked = true;
    _freeTooltipLockedIcon = iconEl;
    // Visual: highlight the icon while locked
    iconEl.style.background = 'rgba(255,170,0,0.35)';
    iconEl.style.borderColor = 'rgba(255,170,0,0.9)';
  }
}

// Dismiss locked tooltip when clicking anywhere outside it
document.addEventListener('click', function(e) {
  if (!_freeTooltipLocked) return;
  if (e.target.closest && e.target.closest('.free-slot-icon')) return; // handled by toggleFreeTooltipLock
  // Click outside — release lock and hide
  _freeTooltipLocked = false;
  if (_freeTooltipLockedIcon) {
    _freeTooltipLockedIcon.style.background = 'rgba(255,170,0,0.15)';
    _freeTooltipLockedIcon.style.borderColor = 'rgba(255,170,0,0.4)';
    _freeTooltipLockedIcon = null;
  }
  if (_freeTooltipEl) { _freeTooltipEl.remove(); _freeTooltipEl = null; }
});

function filterClasses() {
  const colspan = (currentUser?.role === 'admin' || currentUser?.role === 'superadmin' || currentUser?.role === 'supervisor') ? 3 : 2;
  filterTable('classes-search', 'classes-body', 'No classes match', colspan, 'classes-per-page', 'classes-count-label');
}

function filterUserClasses() {
  filterTable('user-classes-search', 'user-classes-body', 'No classes match', 2, null, null);
}

function filterUsers() {
  filterTable('users-search', 'users-body', 'No users match', 5, 'users-per-page', 'users-count-label');
}

// ===== SEARCHABLE SELECT =====
function makeSearchable(selectEl) {
  if (!selectEl || selectEl.dataset.ssInit) return;
  selectEl.dataset.ssInit = '1';
  const isMultiple = selectEl.multiple;
  const wrapper = document.createElement('div');
  wrapper.className = 'ss-wrapper';
  selectEl.parentNode.insertBefore(wrapper, selectEl);
  wrapper.appendChild(selectEl);
  selectEl.style.display = 'none';
  const display = document.createElement('div');
  display.className = 'ss-display';
  display.tabIndex = 0;
  display.setAttribute('role', 'combobox');
  const dropdown = document.createElement('div');
  dropdown.className = 'ss-dropdown';
  const searchDiv = document.createElement('div');
  searchDiv.className = 'ss-search';
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Type to search...';
  searchDiv.appendChild(searchInput);
  const list = document.createElement('div');
  list.className = 'ss-list';
  dropdown.appendChild(searchDiv);
  dropdown.appendChild(list);
  wrapper.appendChild(display);
  wrapper.appendChild(dropdown);

  function updateDisplay() {
    const sel = [...selectEl.selectedOptions];
    if (sel.length === 0) display.innerHTML = `<span style="color:var(--text-muted)">${selectEl.options[0]?.text || 'Select...'}</span><span style="color:var(--text-muted);font-size:0.75rem">▼</span>`;
    else if (isMultiple && sel.length > 1) display.innerHTML = `<span>${sel.map(o=>o.text).join(', ')}</span><span style="color:var(--text-muted);font-size:0.75rem">▼</span>`;
    else display.innerHTML = `<span>${sel[0].text}</span><span style="color:var(--text-muted);font-size:0.75rem">▼</span>`;
  }

  function buildList() {
    list.innerHTML = '';
    const opts = [...selectEl.options].filter(o => !o.disabled);
    if (!opts.filter(o => o.value !== '').length) { list.innerHTML = '<div class="ss-empty">No options available</div>'; return; }
    opts.forEach(opt => {
      if (!opt.value && opt.text.toLowerCase().includes('select') && !selectEl.dataset.keepPlaceholder) return;
      const item = document.createElement('div');
      item.className = 'ss-opt' + (opt.selected ? ' selected' : '');
      item.textContent = opt.text;
      item.dataset.value = opt.value;
      item.addEventListener('mousedown', e => {
        e.preventDefault();
        if (isMultiple) { opt.selected = !opt.selected; item.classList.toggle('selected', opt.selected); searchInput.value = ''; filterList(''); }
        else { [...selectEl.options].forEach(o => o.selected = false); list.querySelectorAll('.ss-opt').forEach(i => i.classList.remove('selected')); opt.selected = true; item.classList.add('selected'); closeDropdown(); }
        updateDisplay();
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
      });
      list.appendChild(item);
    });
  }

  function openDropdown() {
    const rect = display.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    dropdown.classList.toggle('ss-up', spaceBelow < 260 && spaceAbove > spaceBelow);
    dropdown.classList.add('open');
    display.classList.add('open');
    searchInput.value = '';
    buildList();
    filterList('');
    searchInput.focus();
  }
  function closeDropdown() { dropdown.classList.remove('open'); display.classList.remove('open'); }
  function filterList(query) {
    const q = query.toLowerCase();
    let visCount = 0;
    list.querySelectorAll('.ss-opt').forEach(item => { const match = item.textContent.toLowerCase().includes(q); item.classList.toggle('hidden', !match); if (match) visCount++; });
    let emptyEl = list.querySelector('.ss-empty');
    if (visCount === 0) { if (!emptyEl) { emptyEl = document.createElement('div'); emptyEl.className = 'ss-empty'; list.appendChild(emptyEl); } emptyEl.textContent = 'No results found'; emptyEl.style.display = ''; }
    else if (emptyEl) emptyEl.style.display = 'none';
  }

  display.addEventListener('click', () => { if (dropdown.classList.contains('open')) closeDropdown(); else openDropdown(); });
  display.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDropdown(); } if (e.key === 'Escape') closeDropdown(); });
  searchInput.addEventListener('input', () => filterList(searchInput.value));
  searchInput.addEventListener('keydown', e => { if (e.key === 'Escape') closeDropdown(); });
  document.addEventListener('click', e => { if (!wrapper.contains(e.target)) closeDropdown(); });
  const observer = new MutationObserver(() => { buildList(); updateDisplay(); });
  observer.observe(selectEl, { childList: true, subtree: true, attributes: true, attributeFilter: ['selected'] });
  updateDisplay();
  buildList();
  wrapper._ssRefresh = () => { buildList(); updateDisplay(); };
}

// Initialise every single-select in the app that needs to be searchable.
// Called once from showApp(). The MutationObserver inside makeSearchable()
// handles all subsequent option changes (dynamic population from API calls).
function initAllSelects() {
  const ids = [
    // ── Timetable page filters ──
    'tt-class-filter',
    // ── Track page ──
    'track-teacher-filter',
    // ── User timetable ──
    'user-tt-class-filter',
    // ── Search page ──
    'search-teacher', 'search-time-from', 'search-time-to',
    // ── Parent schedule ──
    'parent-child-select',
    // ── Teacher modal ──
    'tm-role', 'tm-employment-type', 'tm-gender', 'tm-marital-status', 'tm-blood-group',
    // ── User modal ──
    'user-role', 'user-student-id',
    // ── Timetable modal ──
    'tt-break-class',
    // ── Student modal ──
    'st-referred_by', 'st-class_id', 'st-gender',
    'st-fee_1_type', 'st-fee_2_type', 'st-fee_3_type', 'st-fee_4_type',
    'st-test_for_class',
    // ── Enrollment / assignment ──
    'assign-class-select',
    // ── Performance marks ──
    'pm-test-select',
    // ── Staff Attendance ──
    'ao-teacher', 'ao-status',
    // ── Student Attendance ──
    'statt-class',
    // ── Student Attendance Overview ──
    'sao-class', 'sao-student', 'sao-status',
  ];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) makeSearchable(el);
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ===== RESTRICT DATE INPUT YEAR TO 4 DIGITS =====
document.addEventListener('input', function(e) {
  if (e.target.type !== 'date' || !e.target.value) return;
  const parts = e.target.value.split('-');
  if (parts[0] && parts[0].length > 4) {
    parts[0] = parts[0].slice(0, 4);
    e.target.value = parts.join('-');
  }
}, true);
