// ===== LOGO CACHE (loaded once from assets, avoids 688KB embedded base64) =====
let _logoBase64 = null;
async function _ensureLogo() {
  if (_logoBase64 !== null) return;
  try {
    const res  = await fetch('assets/logo.jpeg');
    const blob = await res.blob();
    _logoBase64 = await new Promise(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch(e) { _logoBase64 = ''; }
}

// ===== DOWNLOAD MENU =====
function openDownloadMenu(menuId, btn) {
  document.querySelectorAll('.download-menu').forEach(m => { if (m.id !== menuId) m.classList.remove('open'); });
  const menu = document.getElementById(menuId);
  if (!menu) return;
  const isOpen = menu.classList.contains('open');
  if (isOpen) {
    menu.classList.remove('open');
  } else {
    const parent = btn.parentElement;
    parent.style.position = 'relative';
    menu.style.left = '';
    menu.style.right = '0';
    requestAnimationFrame(() => {
      const rect = menu.getBoundingClientRect();
      const vw = window.innerWidth;
      const margin = 8;
      if (rect.left < margin) {
        menu.style.right = 'auto';
        menu.style.left = '0';
      } else if (rect.right > vw - margin) {
        const parentLeft = parent.getBoundingClientRect().left;
        const newLeft = Math.max(margin - parentLeft, vw - margin - rect.width - parentLeft);
        menu.style.right = 'auto';
        menu.style.left = `${newLeft}px`;
      }
    });
    menu.classList.add('open');
    setTimeout(() => document.addEventListener('click', function hideMenu(e) {
      if (!parent.contains(e.target)) { menu.classList.remove('open'); document.removeEventListener('click', hideMenu); }
    }), 0);
  }
}

function setMenuScale(e, btn) {
  e.stopPropagation();
  btn.closest('.dm-scale-btns').querySelectorAll('.dm-scale-btn').forEach(b => b.classList.remove('dm-scale-active'));
  btn.classList.add('dm-scale-active');
}
function getMenuScale(menuEl) {
  if (!menuEl) return 90;
  const active = menuEl.querySelector('.dm-scale-btn.dm-scale-active');
  return active ? parseInt(active.dataset.scale) : 90;
}

// ===== DAY RANGE HELPERS =====
function buildDayRange(days) {
  const order = ['Mon','Tue','Wed','Thu','Fri'];
  const sorted = days
    .map(d => d.trim().slice(0,3))
    .filter(d => order.includes(d))
    .sort((a,b) => order.indexOf(a) - order.indexOf(b));
  if (sorted.length === 0) return '';
  if (sorted.length === 1) return sorted[0];
  const runs = [];
  let run = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = order.indexOf(sorted[i-1]);
    const curr = order.indexOf(sorted[i]);
    if (curr === prev + 1) { run.push(sorted[i]); }
    else { runs.push(run); run = [sorted[i]]; }
  }
  runs.push(run);
  return runs.map(r => r.length === 1 ? r[0] : r[0] + ' - ' + r[r.length-1]).join(', ');
}
function buildDayRangeFilename(days) {
  return buildDayRange(days).replace(/\s*-\s*/g, '-').replace(/,\s*/g, '_');
}

// ===== PROFESSIONAL PDF/DOCX STYLES =====
function _getPrintStyles(pageSize, orientation, scale = 90) {
  const pageSizeMap = {
    'A4': 'A4',
    'Letter': 'letter',
    'A3': 'A3',
    'A5': 'A5'
  };
  const ps = pageSizeMap[pageSize] || 'A4';
  const ori = (orientation === 'landscape') ? 'landscape' : 'portrait';
  return `
    @page {
      size: ${ps} ${ori};
      margin: 8mm 8mm 8mm 8mm;
    }
    * { box-sizing: border-box; }
    html, body {
      font-family: 'Times New Roman', Times, serif;
      background: #fff; color: #1a1a2e;
      margin: 0; padding: 0; font-size: 16pt; line-height: 1.6;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    .doc-wrapper {
      padding: 6mm 0 0 0;
      max-width: 100%;
      border: 3px solid #0d0d40;
      min-height: 240mm;
      position: relative;
      zoom: ${Math.max(50, Math.min(100, scale || 90))}%;
    }
    .doc-header {
      border-bottom: 3px double #0d0d40;
      padding: 6mm 8mm 8px 8mm;
      margin-bottom: 16px;
    }
    .doc-header-inner {
      width: 100%;
      border-collapse: collapse;
      border: none;
    }
    .doc-header-logo {
      width: 22mm;
      height: 22mm;
      border-radius: 50%;
      object-fit: cover;
      border: 2.5px solid #c9a84c;
      display: block;
    }
    .doc-header-text {
      text-align: left;
      padding-left: 8mm;
      vertical-align: middle;
    }
    .doc-header .institution {
      font-size: 22pt; font-weight: 900;
      color: #0d0d40; letter-spacing: 3px;
      text-transform: uppercase; font-family: 'Times New Roman', serif;
      margin-bottom: 6px;
    }
    .doc-header .doc-class-name {
      font-size: 16pt; font-weight: 700;
      color: #8b6914; letter-spacing: 1.5px;
      font-family: 'Times New Roman', serif;
      margin-bottom: 2px;
    }
    .doc-divider { height: 2px; background: linear-gradient(to right, transparent, #c9a84c, transparent); margin: 4px 0 16px; }
    .doc-body { padding: 0 8mm 8mm 8mm; }
    .doc-header-inner, .doc-header-inner td, .doc-header-inner tr {
      border: none !important;
      background: transparent !important;
      font-size: inherit;
      padding: 0;
      margin: 0;
    }
    table {
      width: 100%; border-collapse: collapse;
      font-size: 14pt; margin-top: 6px;
      border: 2px solid #0d0d40;
      font-family: 'Times New Roman', Times, serif;
    }
    thead tr {
      background: #0d0d40 !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    th {
      background: #0d0d40 !important;
      color: #c9a84c !important;
      padding: 11px 14px;
      text-align: left;
      font-size: 16pt;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      font-weight: 800;
      border-right: 1px solid rgba(201,168,76,0.35);
      font-family: 'Times New Roman', serif;
    }
    th:last-child { border-right: none; }
    td {
      padding: 10px 14px;
      border-bottom: 1px solid #d8d8e8;
      border-right: 1px solid #e5e5f0;
      color: #1a1a2e;
      vertical-align: top;
      font-size: 14pt;
      font-family: 'Times New Roman', Times, serif;
    }
    td:last-child { border-right: none; }
    tr:last-child td { border-bottom: none; }
    tbody tr:nth-child(even) { background: #f5f5fc !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .break-row td { background: #fff8ee !important; color: #8b5000; font-weight: 700; font-family: 'Times New Roman', Times, serif; }
    .section-title {
      font-size: 13pt; font-weight: 800; color: #0d0d40;
      text-transform: uppercase; letter-spacing: 2px;
      margin: 16px 0 10px;
      padding-bottom: 5px;
      border-bottom: 2px solid #c9a84c;
      font-family: 'Times New Roman', serif;
      text-align: center;
    }
    .avail-table { width: 100%; border-collapse: collapse; font-size: 13pt; border: 2px solid #0d0d40; margin-top: 8px; font-family: 'Times New Roman', Times, serif; }
    .avail-table thead tr { background: #0d0d40 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .avail-table th { background: #0d0d40 !important; color: #c9a84c !important; padding: 10px 13px; font-size: 16pt; text-transform: uppercase; letter-spacing: 1px; font-weight: 800; font-family: 'Times New Roman', serif; }
    .avail-table td { padding: 10px 13px; border-bottom: 1px solid #e0e0ee; vertical-align: top; font-size: 13pt; font-family: 'Times New Roman', Times, serif; }
    .avail-table tr:nth-child(even) td { background: #f5f5fc !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .free-text { color: #155724; font-weight: 600; }
    .busy-text { color: #721c24; }
    .day-label { font-weight: 800; color: #0d0d40; font-size: 13pt; }
    @media print {
      html, body { background: #fff !important; }
      .no-print { display: none !important; }
    }
  `;
}

function _getPKTime() { return new Date().toLocaleString('en-PK', { timeZone:'Asia/Karachi', dateStyle:'long', timeStyle:'short' }); }

function _openPrintWindow(html) {
  const w = window.open('', '_blank', 'width=960,height=720');
  w.document.write(html);
  w.document.close();
}

function _buildDocHeader(title, subtitle, pageSize) {
  const logoSrc = _logoBase64 || '';
  return `
    <div class="doc-header">
      <table class="doc-header-inner" style="width:100%;border-collapse:collapse;border:none">
        <tr>
          <td style="width:26mm;vertical-align:middle;padding:0;border:none">
            <img class="doc-header-logo" src="${logoSrc}" alt="IDL Logo">
          </td>
          <td style="vertical-align:middle;border:none">
            <div class="doc-header-text">
              <div class="institution">Institute of Dynamic Learning</div>
              ${subtitle ? `<div class="doc-class-name">${subtitle}</div>` : ''}
            </div>
          </td>
        </tr>
      </table>
    </div>
    <div class="doc-body">
  `;
}

function _buildDocBodyClose() {
  return `</div>`;
}

function _buildDocFooter() {
  return '';
}

function _buildFullPrintDoc(bodyHtml, pageSize, printAuto, orientation, docTitle, scale = 90) {
  const titleTag = docTitle ? '<title>' + docTitle + '</title>' : '<title>IDL Timetable</title>';
  const printScript = printAuto ? '<script>window.onload=()=>{setTimeout(()=>window.print(),300);}<\/script>' : '';
  return '<!DOCTYPE html><html><head><meta charset="UTF-8">' + titleTag +
    '<style>' + _getPrintStyles(pageSize, orientation, scale) + '</style>' +
    printScript +
    '</head><body><div class="doc-wrapper">' + bodyHtml + '</div>\n</body></html>';
}

// ===== TABLE DOWNLOAD (Teachers, Classes) =====
async function downloadTableDoc(tbodyId, filename, headers, format, pageSize, orientation, scale = 90, title = null, studentInfo = null) {
  await _ensureLogo();
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  const table = tbody.closest('table');
  // Auto-detect visible, non-actions headers when table uses data-col
  let effectiveHeaders = headers;
  const visThs = table ? Array.from(table.querySelectorAll('thead th[data-col]'))
    .filter(th => th.style.display !== 'none' && !th.dataset.col.endsWith('-actions')) : [];
  if (visThs.length > 0) effectiveHeaders = visThs.map(th => th.textContent.trim());

  const rows = Array.from(tbody.querySelectorAll('tr')).filter(r => !r.querySelector('td[colspan]') && r.style.display !== 'none');
  if (rows.length === 0) { toast('No data to download', 'error'); return; }

  const hasDataCol = rows[0]?.querySelector('td[data-col]');
  const dataRows = hasDataCol
    ? rows.map(r => Array.from(r.querySelectorAll('td[data-col]'))
        .filter(td => td.style.display !== 'none' && !td.dataset.col.endsWith('-actions'))
        .map(td => td.querySelector('img,svg') && !td.textContent.trim() ? '' : td.textContent.trim()))
    : rows.map(r => Array.from(r.querySelectorAll('td')).slice(0, effectiveHeaders.length).map(td => td.textContent.trim()));

  const headerHtml = `<thead><tr>${effectiveHeaders.map(h=>`<th>${h}</th>`).join('')}</tr></thead>`;
  const bodyHtml = `<tbody>${dataRows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>`;
  const tableHtml = `<table>${headerHtml}${bodyHtml}</table>`;
  const displayTitle = title || filename.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());

  let studentHtml = '';
  if (studentInfo) {
    const photoHtml = studentInfo.photo
      ? `<img src="${studentInfo.photo}" style="width:22mm;height:22mm;border-radius:50%;object-fit:cover;border:2.5px solid #c9a84c;display:inline-block;vertical-align:middle;margin-right:10mm">`
      : '';
    const esc = v => String(v||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    studentHtml = `<div style="display:flex;align-items:center;gap:12px;padding:10px 0 16px;border-bottom:2px solid #c9a84c;margin-bottom:14px">
      ${photoHtml}
      <div style="display:inline-block;vertical-align:middle">
        <div style="font-size:17pt;font-weight:800;color:#0d0d40;font-family:Times New Roman,serif">${esc(studentInfo.name)}</div>
        ${studentInfo.gr ? `<div style="font-size:12pt;color:#555;margin-top:4px;font-family:Times New Roman,serif">GR: ${esc(studentInfo.gr)}${studentInfo.cls ? ' &nbsp;&bull;&nbsp; ' + esc(studentInfo.cls) : ''}</div>` : ''}
      </div>
    </div>`;
  }

  const docBody = `${_buildDocHeader(displayTitle, '', pageSize)}${studentHtml}<div class="section-title">${displayTitle}</div>${tableHtml}${_buildDocBodyClose()}`;

  if (format === 'pdf') {
    _openPrintWindow(_buildFullPrintDoc(docBody, pageSize, true, orientation, filename, scale));
  } else {
    const wordOrientation = orientation === 'landscape' ? 'landscape' : 'portrait';
    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset="UTF-8"><style>${_getPrintStyles('A4', wordOrientation)}</style></head><body><div class="doc-wrapper">${docBody}</div></body></html>`;
    const blob = new Blob([html], { type: 'application/msword' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${filename}.doc`; a.click();
  }
}

// ===== USER CLASS TIMETABLE DOWNLOAD =====
async function downloadUserClassesDoc(format, pageSize, orientation, scale = 90) {
  await _ensureLogo();
  const tbody = document.getElementById('user-classes-body');
  if (!tbody) return;
  const filterEl = document.getElementById('user-classes-filter');
  const filterSel = filterEl?.closest('.ss-wrapper')?.querySelector('select') || filterEl;

  const selectedDaysCbs = [...document.querySelectorAll('.user-classes-day-cb:checked')].map(cb => cb.value);
  const dayRangeStr = buildDayRange(selectedDaysCbs);

  let subtitle = '';
  if (filterSel && filterSel.value) {
    const opt = filterSel.options[filterSel.selectedIndex];
    if (opt) subtitle = dayRangeStr ? `${opt.text} — ${dayRangeStr}` : opt.text;
  } else if (dayRangeStr) {
    subtitle = dayRangeStr;
  }
  const headers = ['Class', 'Subject', 'Teacher(s)', 'Days', 'Time'];
  const rows = Array.from(tbody.querySelectorAll('tr')).filter(r => {
    if (r.style.display === 'none') return false;
    if (r.classList.contains('break-row')) return true;
    return !r.querySelector('td[colspan]');
  });
  if (rows.length === 0) { toast('No timetable data to download', 'error'); return; }

  const headerHtml = `<thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead>`;
  const bodyRows = rows.map(tr => {
    const tds = Array.from(tr.querySelectorAll('td'));
    const isBreak = tr.classList.contains('break-row');
    if (isBreak) {
      const className = tds[0]?.textContent?.trim() || '';
      const days = tds[3]?.textContent?.trim() || '';
      const time = tds[4]?.textContent?.trim() || '';
      return `<tr class="break-row"><td>${className}</td><td colspan="2" style="text-align:center;font-weight:bold;color:#8b5000">☕ BREAK</td><td>${days}</td><td style="white-space:nowrap">${time}</td></tr>`;
    }
    return `<tr>${tds.slice(0,5).map((td, i) => {
      const txt = td.innerHTML.replace(/<br\s*\/?>/gi, ', ').replace(/<[^>]+>/g,'').trim();
      return i === 4 ? `<td style="white-space:nowrap">${txt}</td>` : `<td>${txt}</td>`;
    }).join('')}</tr>`;
  }).join('');

  const tableHtml = `<table><colgroup><col style="width:18%"><col style="width:20%"><col style="width:24%"><col style="width:18%"><col style="width:20%"></colgroup>${headerHtml}<tbody>${bodyRows}</tbody></table>`;
  const docBody = `${_buildDocHeader('Class Timetable', subtitle, pageSize)}<div class="section-title">Class Timetable</div>${tableHtml}${_buildDocBodyClose()}`;

  const getClassName = () => {
    const sel = document.getElementById('user-classes-filter')?.closest('.ss-wrapper')?.querySelector('select') || document.getElementById('user-classes-filter');
    return (sel?.value && sel.options[sel.selectedIndex]?.text ? sel.options[sel.selectedIndex].text : 'all').replace(/\s+/g,'_').toLowerCase();
  };
  const getDayRange = () => buildDayRangeFilename([...document.querySelectorAll('.user-classes-day-cb:checked')].map(cb=>cb.value));

  if (format === 'pdf') {
    const pdfClass = getClassName();
    const pdfDayRange = getDayRange();
    const pdfTitle = pdfDayRange ? `${pdfClass}_class_timetable_${pdfDayRange}` : `${pdfClass}_class_timetable`;
    _openPrintWindow(_buildFullPrintDoc(docBody, pageSize, true, orientation, pdfTitle, scale));
  } else {
    const wordOri = orientation === 'landscape' ? 'landscape' : 'portrait';
    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset="UTF-8"><style>${_getPrintStyles('A4', wordOri)}</style></head><body><div class="doc-wrapper">${docBody}</div></body></html>`;
    const blob = new Blob([html], { type: 'application/msword' });
    const ttClassName = getClassName();
    const ttDayRange = getDayRange();
    const ttFilename = ttDayRange ? `${ttClassName}_class_timetable_${ttDayRange}` : `${ttClassName}_class_timetable`;
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${ttFilename}.doc`; a.click();
  }
}

// ===== USER TIMETABLE DOWNLOAD =====
async function downloadUserTimetableDoc(format, pageSize, orientation, scale = 90) {
  await _ensureLogo();
  const tbody = document.getElementById('user-timetable-body');
  if (!tbody) return;
  const filterEl = document.getElementById('user-tt-class-filter');
  const filterSel = filterEl?.closest('.ss-wrapper')?.querySelector('select') || filterEl;

  const selectedDaysCbs = [...document.querySelectorAll('.user-tt-day-cb:checked')].map(cb => cb.value);
  const dayRangeStr = buildDayRange(selectedDaysCbs);

  let subtitle = '';
  if (filterSel && filterSel.value) {
    const opt = filterSel.options[filterSel.selectedIndex];
    if (opt) subtitle = dayRangeStr ? `${opt.text} — ${dayRangeStr}` : opt.text;
  } else if (dayRangeStr) {
    subtitle = dayRangeStr;
  }
  const headers = ['Class', 'Subject', 'Teacher(s)', 'Days', 'Time'];
  const rows = Array.from(tbody.querySelectorAll('tr')).filter(r => {
    if (r.style.display === 'none') return false;
    if (r.classList.contains('break-row')) return true;
    return !r.querySelector('td[colspan]');
  });
  if (rows.length === 0) { toast('No timetable data to download', 'error'); return; }

  const headerHtml = `<thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead>`;
  const bodyRows = rows.map(tr => {
    const tds = Array.from(tr.querySelectorAll('td'));
    const isBreak = tr.classList.contains('break-row');
    if (isBreak) {
      const className = tds[0]?.textContent?.trim() || '';
      const days = tds[3]?.textContent?.trim() || '';
      const time = tds[4]?.textContent?.trim() || '';
      return `<tr class="break-row"><td>${className}</td><td colspan="2" style="text-align:center;font-weight:bold;color:#8b5000">☕ BREAK</td><td>${days}</td><td style="white-space:nowrap">${time}</td></tr>`;
    }
    return `<tr>${tds.slice(0,5).map((td, i) => {
      const txt = td.innerHTML.replace(/<br\s*\/?>/gi, ', ').replace(/<[^>]+>/g,'').trim();
      return i === 4 ? `<td style="white-space:nowrap">${txt}</td>` : `<td>${txt}</td>`;
    }).join('')}</tr>`;
  }).join('');

  const tableHtml = `<table><colgroup><col style="width:18%"><col style="width:20%"><col style="width:24%"><col style="width:18%"><col style="width:20%"></colgroup>${headerHtml}<tbody>${bodyRows}</tbody></table>`;
  const docBody = `${_buildDocHeader('Timetable', subtitle, pageSize)}<div class="section-title">My Class Timetable</div>${tableHtml}${_buildDocBodyClose()}`;

  const getClassName = () => {
    const sel = document.getElementById('user-tt-class-filter')?.closest('.ss-wrapper')?.querySelector('select') || document.getElementById('user-tt-class-filter');
    return (sel?.value && sel.options[sel.selectedIndex]?.text ? sel.options[sel.selectedIndex].text : 'all').replace(/\s+/g,'_').toLowerCase();
  };
  const getDayRange = () => buildDayRangeFilename([...document.querySelectorAll('.user-tt-day-cb:checked')].map(cb=>cb.value));

  if (format === 'pdf') {
    const pdfClass = getClassName();
    const pdfDayRange = getDayRange();
    const pdfTitle = pdfDayRange ? `${pdfClass}_timetable_${pdfDayRange}` : `${pdfClass}_timetable`;
    _openPrintWindow(_buildFullPrintDoc(docBody, pageSize, true, orientation, pdfTitle, scale));
  } else {
    const wordOri = orientation === 'landscape' ? 'landscape' : 'portrait';
    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset="UTF-8"><style>${_getPrintStyles('A4', wordOri)}</style></head><body><div class="doc-wrapper">${docBody}</div></body></html>`;
    const blob = new Blob([html], { type: 'application/msword' });
    const ttClassName = getClassName();
    const ttDayRange = getDayRange();
    const ttFilename = ttDayRange ? `${ttClassName}_timetable_${ttDayRange}` : `${ttClassName}_timetable`;
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${ttFilename}.doc`; a.click();
  }
}

// ===== TIMETABLE DOWNLOAD =====
async function downloadTimetableDoc(format, pageSize, orientation, scale = 90) {
  await _ensureLogo();
  const tbody = document.getElementById('timetable-body');
  if (!tbody) return;
  // Get class name from filter
  const filterEl = document.getElementById('tt-class-filter');
  const filterSel = filterEl?.closest('.ss-wrapper')?.querySelector('select') || filterEl;

  const selectedDaysCbs = [...document.querySelectorAll('.tt-day-cb:checked')].map(cb => cb.value);
  const dayRangeStr = buildDayRange(selectedDaysCbs);

  let subtitle = '';
  if (filterSel && filterSel.value) {
    const opt = filterSel.options[filterSel.selectedIndex];
    if (opt) subtitle = dayRangeStr ? `${opt.text} — ${dayRangeStr}` : opt.text;
  } else if (dayRangeStr) {
    subtitle = dayRangeStr;
  }
  const headers = ['Subject', 'Teacher(s)', 'Days', 'Time'];
  const rows = Array.from(tbody.querySelectorAll('tr')).filter(r => {
    if (r.style.display === 'none') return false;
    if (r.classList.contains('break-row')) return true; // always include break rows
    return !r.querySelector('td[colspan]'); // exclude empty state rows
  });
  if (rows.length === 0) { toast('No timetable data to download', 'error'); return; }
  
  const headerHtml = `<thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead>`;
  const bodyRows = rows.map(tr => {
    const tds = Array.from(tr.querySelectorAll('td'));
    const isBreak = tr.classList.contains('break-row');
    if (isBreak) {
      // Break row: tds: 0=class, 1=break(colspan2), 2=days, 3=time, [4=actions]
      const days = tds[2]?.textContent?.trim() || '';
      const time = tds[3]?.textContent?.trim() || '';
      return `<tr class="break-row"><td colspan="2" style="text-align:center;font-weight:bold;color:#8b5000">☕ BREAK</td><td>${days}</td><td style="white-space:nowrap">${time}</td></tr>`;
    }
    // Normal row: tds: 0=class(skip), 1=subject, 2=teachers, 3=days, 4=time, [5=actions]
    return `<tr>${tds.slice(1,5).map((td, i) => {
      let txt;
      if (i === 1) {
        const badges = Array.from(td.querySelectorAll('.badge'));
        txt = badges.length > 0 ? badges.map(b => b.textContent.trim()).filter(Boolean).join(', ') : td.textContent.trim();
      } else {
        txt = td.innerHTML.replace(/<br\s*\/?>/gi, ', ').replace(/<[^>]+>/g,'').trim();
      }
      return i === 3 ? `<td style="white-space:nowrap">${txt}</td>` : `<td>${txt}</td>`;
    }).join('')}</tr>`;
  }).join('');

  const tableHtml = `<table><colgroup><col style="width:22%"><col style="width:28%"><col style="width:22%"><col style="width:28%"></colgroup>${headerHtml}<tbody>${bodyRows}</tbody></table>`;
  const docBody = `${_buildDocHeader('Timetable', subtitle, pageSize)}<div class="section-title">Class Timetable</div>${tableHtml}${_buildDocBodyClose()}`;

  if (format === 'pdf') {
    const ttFilterElPdf = document.getElementById('tt-class-filter');
    const ttSelPdf = ttFilterElPdf?.closest('.ss-wrapper')?.querySelector('select') || ttFilterElPdf;
    const pdfClass = (ttSelPdf?.value && ttSelPdf.options[ttSelPdf.selectedIndex]?.text ? ttSelPdf.options[ttSelPdf.selectedIndex].text : 'all').replace(/\s+/g,'_').toLowerCase();
    const pdfDayRange = buildDayRangeFilename([...document.querySelectorAll('.tt-day-cb:checked')].map(cb=>cb.value));
    const pdfTitle = pdfDayRange ? `${pdfClass}_timetable_${pdfDayRange}` : `${pdfClass}_timetable`;
    _openPrintWindow(_buildFullPrintDoc(docBody, pageSize, true, orientation, pdfTitle, scale));
  } else {
    const wordOri = orientation === 'landscape' ? 'landscape' : 'portrait';
    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset="UTF-8"><style>${_getPrintStyles('A4', wordOri)}</style></head><body><div class="doc-wrapper">${docBody}</div></body></html>`;
    const blob = new Blob([html], { type: 'application/msword' });
    // Build filename from class filter and days
    const ttFilterEl = document.getElementById('tt-class-filter');
    const ttSel = ttFilterEl?.closest('.ss-wrapper')?.querySelector('select') || ttFilterEl;
    const ttClassName = (ttSel?.value && ttSel.options[ttSel.selectedIndex]?.text ? ttSel.options[ttSel.selectedIndex].text : 'all').replace(/\s+/g,'_').toLowerCase();
    const ttDayRange = buildDayRangeFilename([...document.querySelectorAll('.tt-day-cb:checked')].map(cb=>cb.value));
    const ttFilename = ttDayRange ? `${ttClassName}_timetable_${ttDayRange}` : `${ttClassName}_timetable`;
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${ttFilename}.doc`; a.click();
  }
}

// ===== SEARCH DOWNLOAD =====
async function downloadSearchDoc(format, pageSize, orientation, scale = 90) {
  await _ensureLogo();
  if (!_searchSlotsCache) { toast('No schedule data to download', 'error'); return; }
  const { teacherName, slots, checkedDays: dlDays } = _searchSlotsCache;
  function dlFilterDays(slotDays) {
    if (!slotDays) return '—';
    if (!dlDays || dlDays.length === 0 || dlDays.length >= 5) return formatDays(slotDays);
    const arr = slotDays.split(',').map(d => d.trim());
    const inter = arr.filter(d => dlDays.includes(d));
    return inter.length > 0 ? inter.map(d => d.slice(0,3)).join(', ') : formatDays(slotDays);
  }
  const headers = ['#', 'Subject', 'Class', 'Days', 'Time', 'Group'];
  const headerHtml = `<thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead>`;
  const bodyRows = slots.map((s,i) => `<tr>
    <td>${i+1}</td>
    <td>${s.subject||'—'}</td>
    <td>${s.class_name||'—'}</td>
    <td>${dlFilterDays(s.days)}</td>
    <td>${formatTime(s.start_time)} – ${formatTime(s.end_time)}</td>
    <td>${s.day_group||'—'}</td>
  </tr>`).join('');
  const tableHtml = `<table>${headerHtml}<tbody>${bodyRows}</tbody></table>`;
  const docBody = `${_buildDocHeader('Teacher Schedule', teacherName, pageSize)}<div class="section-title">Schedule — ${teacherName}</div>${tableHtml}${_buildDocBodyClose()}`;

  if (format === 'pdf') {
    _openPrintWindow(_buildFullPrintDoc(docBody, pageSize, true, orientation, `${teacherName.replace(/\s+/g,'_')}_schedule`, scale));
  } else {
    const wordOri = orientation === 'landscape' ? 'landscape' : 'portrait';
    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset="UTF-8"><style>${_getPrintStyles('A4', wordOri)}</style></head><body><div class="doc-wrapper">${docBody}</div></body></html>`;
    const blob = new Blob([html], { type: 'application/msword' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${teacherName.replace(/\s+/g,'_')}_schedule.doc`; a.click();
  }
}

// ===== AVAILABILITY DOWNLOAD =====
async function downloadAvailabilityDoc(teacherName, format, pageSize, orientation, scale = 90) {
  await _ensureLogo();
  if (!_availDataCache) { toast('No availability data', 'error'); return; }
  const rows = _availDataCache.rows;
  const headerHtml = `<thead><tr><th>Day</th><th>Free Periods</th><th>Classes Scheduled</th></tr></thead>`;
  const bodyRows = rows.map(r => {
    let freeText, classesText, cls;
    if (r.fullyAvailable) { freeText = '<span class="free-text">✓ Fully available all day</span>'; classesText = 'No classes'; cls = ''; }
    else if (r.fullyBooked) { freeText = '<span class="busy-text">✗ Fully booked</span>'; classesText = r.busySlots.map(s=>`${s.subject} (${s.className}, ${s.time})`).join('<br>'); cls = ''; }
    else { freeText = r.freeBlocks.map(b=>`<span class="free-text">✓ ${formatTime(b.from+':00')} – ${formatTime(b.to+':00')}</span>`).join('<br>'); classesText = r.busySlots.map(s=>`${s.subject} (${s.className}, ${s.time})`).join('<br>') || 'None'; cls = ''; }
    return `<tr ${cls}><td><span class="day-label">${r.day}</span></td><td>${freeText}</td><td style="font-size:10pt">${classesText}</td></tr>`;
  }).join('');
  const tableHtml = `<table class="avail-table">${headerHtml}<tbody>${bodyRows}</tbody></table>`;
  const docBody = `${_buildDocHeader('Availability', teacherName, pageSize)}<div class="section-title">Weekly Availability — ${teacherName}</div>${tableHtml}${_buildDocBodyClose()}`;

  if (format === 'pdf') {
    _openPrintWindow(_buildFullPrintDoc(docBody, pageSize, true, orientation, `${teacherName.replace(/\s+/g,'_')}_availability`, scale));
  } else {
    const wordOri = orientation === 'landscape' ? 'landscape' : 'portrait';
    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset="UTF-8"><style>${_getPrintStyles('A4', wordOri)}</style></head><body><div class="doc-wrapper">${docBody}</div></body></html>`;
    const blob = new Blob([html], { type: 'application/msword' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${teacherName.replace(/\s+/g,'_')}_availability.doc`; a.click();
  }
}

// ===== TRACK DOWNLOAD =====
async function downloadTrackDoc(format, pageSize, orientation, scale = 90) {
  await _ensureLogo();
  if (!_trackDataCache) { toast('Load the Track view first, then download', 'error'); return; }
  let rows = [];
  if (_trackDataCache.singleTeacher) {
    const ts = _trackDataCache.singleTeacher;
    const name = `${normalizeTitle(ts.teacher.title)} ${ts.teacher.name}`;
    rows.push({ name, status: ts.slots.length > 0 ? 'Busy' : 'Free', detail: ts.slots.length > 0 ? ts.slots.map(sl=>`${sl.class_name} — ${sl.subject} (${formatTime(sl.start_time)}–${formatTime(sl.end_time)}, ${formatDays(sl.days)})`).join('; ') : 'No classes in selected time range' });
  } else {
    _trackDataCache.busy.forEach(t => rows.push({ name: t.name, status: 'Busy', detail: t.slots.join('; ') || '—' }));
    _trackDataCache.free.forEach(t => rows.push({ name: t.name, status: 'Free', detail: 'Available' }));
  }
  const headerHtml = `<thead><tr><th>Teacher</th><th>Status</th><th>Class Details</th></tr></thead>`;
  const bodyRows = rows.map(r => `<tr><td>${r.name}</td><td style="color:${r.status==='Busy'?'#8B0000':'#155724'};font-weight:bold">${r.status}</td><td>${r.detail}</td></tr>`).join('');
  const tableHtml = `<table>${headerHtml}<tbody>${bodyRows}</tbody></table>`;
  const docBody = `${_buildDocHeader('Track Teachers', '', pageSize)}<div class="section-title">Teacher Status</div>${tableHtml}${_buildDocBodyClose()}`;

  if (format === 'pdf') {
    _openPrintWindow(_buildFullPrintDoc(docBody, pageSize, true, orientation, 'teachers_track', scale));
  } else {
    const wordOri = orientation === 'landscape' ? 'landscape' : 'portrait';
    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset="UTF-8"><style>${_getPrintStyles('A4', wordOri)}</style></head><body><div class="doc-wrapper">${docBody}</div></body></html>`;
    const blob = new Blob([html], { type: 'application/msword' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'teachers_track.doc'; a.click();
  }
}

// ===== IMPORT CSV / EXCEL =====
const API_IMPORT = 'api/import.php';

let _importActiveTab  = 'teachers';
let _importDidSucceed = false;   // true after at least 1 row inserted
let _pendingConflicts = [];      // conflicts waiting for user decision
let _pendingConflictRows = [];   // original rows array for re-submit

function openImportModal(tab = 'teachers') {
  _importActiveTab  = tab;
  _importDidSucceed = false;
  switchImportTab(tab);
  document.getElementById('import-result').style.display = 'none';
  openModal('import-modal-overlay');
}

function closeImportModal() {
  if (_importDidSucceed) {
    // Clear all textarea data after a completed import
    ['teachers','classes','timetable'].forEach(t => {
      document.getElementById('import-csv-' + t).value = '';
    });
    _importDidSucceed = false;
  }
  _pendingConflicts    = [];
  _pendingConflictRows = [];
  closeModal('import-modal-overlay');
}

function switchImportTab(tab) {
  _importActiveTab = tab;
  ['teachers','classes','timetable'].forEach(t => {
    document.getElementById('itab-' + t).classList.toggle('active', t === tab);
    document.getElementById('ipanel-' + t).style.display = t === tab ? '' : 'none';
  });
  document.getElementById('import-result').style.display = 'none';
}

function downloadImportTemplate(type) {
  const templates = {
    teachers:  'Title,Name\nSir,Ahmed Khan\nMs.,Sara Ali\nSir,Usman Malik',
    classes:   'Name\nLevel 4J\nLevel 5A\nBCS 3rd Semester',
    timetable: 'Class,Subject,Teacher,Days,Start,End\nLevel 4J,Mathematics,Sir Ahmed Khan,Mon-Tue,08:00,09:00\nLevel 4J,BREAK,,Mon-Tue,09:00,09:30\nLevel 4J,Physics,Ms. Sara Ali,Wed-Thu,08:00,09:00\nLevel 4J,Computer,Sir Ahmed Khan|Ms. Sara Ali,Fri,08:00,10:00'
  };
  const csv  = templates[type] || '';
  const blob = new Blob([csv], { type: 'text/csv' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `import_${type}_template.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Excel / CSV file upload ──────────────────────────────────────────────────
function handleImportFile(type, input) {
  const file = input.files[0];
  if (!file) return;
  const name = file.name.toLowerCase();
  const reader = new FileReader();

  if (name.endsWith('.csv')) {
    reader.onload = e => { document.getElementById('import-csv-' + type).value = e.target.result.trim(); };
    reader.readAsText(file);
  } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    reader.onload = e => {
      try {
        const wb  = XLSX.read(e.target.result, { type: 'array' });
        const ws  = wb.Sheets[wb.SheetNames[0]];
        const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false });
        // Remove the header row from timetable/classes CSV since the textarea
        // now works WITHOUT a header row (we inject known headers in parseCSV)
        document.getElementById('import-csv-' + type).value = csv.trim();
        toast('File loaded — review the data below then click Import.', 'success');
      } catch(err) {
        toast('Could not read Excel file: ' + err.message, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  } else {
    toast('Unsupported file type. Use .xlsx, .xls or .csv', 'error');
  }
  // reset input so same file can be re-selected
  input.value = '';
}

// ── CSV parser (no header row required — we auto-inject based on tab) ─────────
function parseCSV(text, type) {
  // Strip BOM if present
  text = text.replace(/^\uFEFF/, '');
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length === 0) return { rows: [] };

  // Only these fields are required per type — everything else is ignored
  const knownHeaders = {
    teachers:  ['title','name'],
    classes:   ['name'],
    timetable: ['class','subject','teacher','days','start','end'],
  };
  const expectedH = knownHeaders[type] || [];

  // Helper: split one CSV line respecting quoted fields
  const parseLine = line => {
    const cols = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    cols.push(cur.trim());
    return cols;
  };

  // Detect if the first line looks like a header row
  // (it must contain at least one of the required field names as an exact token)
  const firstCols     = parseLine(lines[0]).map(c => c.toLowerCase());
  const looksLikeHeader = expectedH.some(h => firstCols.includes(h));

  // colMap: required field name → column index to read from each data row
  let colMap, dataLines;

  if (looksLikeHeader) {
    // Map each required field to its column index by exact name match.
    // Extra columns in the file are simply never read.
    colMap    = {};
    expectedH.forEach(eh => {
      const idx = firstCols.indexOf(eh);
      if (idx !== -1) colMap[eh] = idx;
      // If a required field isn't present, its value will default to ''
    });
    dataLines = lines.slice(1);
  } else {
    // No header row — required fields occupy the first N columns by position.
    // Extra columns beyond the required count are ignored.
    colMap    = {};
    expectedH.forEach((eh, i) => { colMap[eh] = i; });
    dataLines = lines;
  }

  const rows = dataLines.map(line => {
    const cols = parseLine(line);
    const obj  = {};
    // Only populate the required fields; ignore everything else
    expectedH.forEach(eh => { obj[eh] = cols[colMap[eh]] ?? ''; });
    return obj;
  }).filter(r => Object.values(r).some(v => v !== ''));

  return { rows };
}

// ── Main import runner ────────────────────────────────────────────────────────
async function runImport(force_rows = []) {
  const tab    = _importActiveTab;
  const raw    = document.getElementById('import-csv-' + tab).value.trim();
  const resEl  = document.getElementById('import-result');
  const btn    = document.getElementById('import-run-btn');

  // Block new import if there are unresolved conflict notifications
  if (_pendingConflicts.length > 0) {
    resEl.innerHTML = '<div class="import-result-box import-result-err">⚠ Please resolve all scheduling conflicts above before importing again.</div>';
    resEl.style.display = '';
    return;
  }

  if (!raw) {
    resEl.innerHTML = '<div class="import-result-box import-result-err">⚠ Please paste CSV data or upload a file first.</div>';
    resEl.style.display = '';
    return;
  }

  const { rows } = parseCSV(raw, tab);
  if (!rows || rows.length === 0) {
    resEl.innerHTML = '<div class="import-result-box import-result-err">⚠ No data rows found. Check your data — blank rows are ignored.</div>';
    resEl.style.display = '';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Importing…';
  resEl.style.display = 'none';

  try {
    const result = await api(`${API_IMPORT}?type=${tab}`, 'POST', { rows, force_rows });
    const { inserted = 0, skipped = 0, errors = [], conflicts = [] } = result;
    let html = '';

    // Summary
    if (inserted > 0 || skipped > 0) {
      const parts = [];
      if (inserted > 0) parts.push(`<strong>${inserted}</strong> imported successfully`);
      if (skipped  > 0) parts.push(`<strong>${skipped}</strong> skipped (already exist)`);
      html += `<div class="import-result-box import-result-ok">✅ ${parts.join(' &nbsp;|&nbsp; ')}</div>`;
    }
    if (errors.length > 0) {
      html += `<div class="import-result-box import-result-warn">⚠ <strong>${errors.length}</strong> row${errors.length > 1 ? 's' : ''} had errors:<div class="import-errors-list">${errors.map(e => e.replace(/</g,'&lt;')).join('\n')}</div></div>`;
    }
    if (inserted === 0 && skipped === 0 && errors.length === 0 && conflicts.length === 0) {
      html += '<div class="import-result-box import-result-warn">No rows were processed.</div>';
    }

    // Conflict resolution UI
    if (conflicts.length > 0) {
      _pendingConflicts    = conflicts;
      _pendingConflictRows = rows;
      html += _buildConflictUI(conflicts);
    }

    resEl.innerHTML = html;
    resEl.style.display = '';

    if (inserted > 0) {
      _importDidSucceed = true;
      if (tab === 'teachers')  { teachers = await api(API.teachers).catch(() => teachers); loadTeachers(); }
      if (tab === 'classes')   { classes  = await api(API.classes).catch(() => classes);  loadClasses(); }
      if (tab === 'timetable') { loadTimetable(); }
    }
  } catch (e) {
    resEl.innerHTML = `<div class="import-result-box import-result-err">Error: ${e.message}</div>`;
    resEl.style.display = '';
  } finally {
    btn.disabled = false;
    btn.textContent = '⬆ Import';
  }
}

// ── Conflict UI builder ───────────────────────────────────────────────────────
function _buildConflictUI(conflicts) {
  let html = '<div class="import-result-box import-result-warn" style="margin-top:10px" id="iconf-container">' +
    '<strong>⚠ Scheduling conflict' + (conflicts.length > 1 ? 's' : '') + ' found — review each:</strong>';

  conflicts.forEach((c, idx) => {
    html +=
    '<div class="import-conflict-item" id="iconf-' + idx + '">' +
      '<div class="conflict-msg">' +
        '⚠ ' + c.teacher_name + ' already has a class in <em>' + c.class_name + '</em> at ' + c.conflict_time + '.' +
      '</div>' +
      '<div class="conflict-detail">' +
        'Row ' + c.row_num + ': Adding <strong>' + c.subject + '</strong> in <strong>' + c.target_class + '</strong>' +
        ' &mdash; ' + c.days + ', ' + c.start + ' &ndash; ' + c.end +
      '</div>' +
      '<div class="import-conflict-btns">' +
        '<button class="icb-yes" onclick="decideConflict(' + idx + ', true, this)">Yes, Add Anyway</button>' +
        '<button class="icb-no"  onclick="decideConflict(' + idx + ', false, this)">No, Skip</button>' +
      '</div>' +
    '</div>';
  });

  html += '</div>';
  return html;
}

async function decideConflict(idx, accept, btn) {
  const item = document.getElementById('iconf-' + idx);
  // Disable buttons immediately to prevent double-click
  item.querySelectorAll('button').forEach(b => { b.disabled = true; });

  if (accept) {
    const conflict = _pendingConflicts[idx];
    const row = _pendingConflictRows[conflict.row_index];
    try {
      await api(`${API_IMPORT}?type=${_importActiveTab}`, 'POST', { rows: [row], force_rows: [0] });
      _importDidSucceed = true;
      toast('Slot added successfully.', 'success');
    } catch(e) {
      toast('Failed to add slot: ' + e.message, 'error');
      item.querySelectorAll('button').forEach(b => { b.disabled = false; });
      return;
    }
  }

  // Animate removal
  item.style.transition = 'opacity 0.22s ease, transform 0.22s ease';
  item.style.opacity = '0';
  item.style.transform = 'translateX(12px)';
  setTimeout(() => {
    item.remove();
    // When all conflicts resolved, clear textarea and reset state
    const container = document.getElementById('iconf-container');
    if (container && !container.querySelector('.import-conflict-item')) {
      container.style.transition = 'opacity 0.2s';
      container.style.opacity = '0';
      setTimeout(() => {
        container.remove();
        const textarea = document.getElementById('import-csv-' + _importActiveTab);
        if (textarea) textarea.value = '';
        _pendingConflicts    = [];
        _pendingConflictRows = [];
      }, 200);
    }
  }, 230);
}

