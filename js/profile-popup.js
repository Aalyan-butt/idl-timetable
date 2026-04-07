// ===== BIO PROFILE POPUPS =====
// Opens dark-theme bio popups for students, teachers, and parents

function closeBioPopup() {
  const ov = document.getElementById('bio-popup-overlay');
  if (!ov) return;
  ov.classList.remove('open');
  // Hide after transition
  setTimeout(() => { if (!ov.classList.contains('open')) ov.style.display = 'none'; }, 300);
}

// Close on overlay backdrop click
(function() {
  const ov = document.getElementById('bio-popup-overlay');
  if (ov) ov.addEventListener('click', function(e) {
    if (e.target === ov) closeBioPopup();
  });
})();

// ── Helpers ──────────────────────────────────────────────────────────────────

function _bioFmtDate(d) {
  if (!d || d === '0000-00-00') return '—';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const [y, m, dy] = d.split('-');
  return `${parseInt(dy,10)}-${months[parseInt(m,10)-1]}-${y}`;
}

function _bioFmtMoney(v) {
  return v && parseFloat(v) ? 'Rs. ' + parseFloat(v).toLocaleString() : 'Rs. 0';
}

function _bioDocCell(src, label) {
  const lbl = label || '';
  if (src && (src.startsWith('data:image') || src.startsWith('http') || src.startsWith('/'))) {
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px">
      <img src="${escapeHtml(src)}" style="width:120px;height:85px;object-fit:cover;border-radius:6px;border:1px solid rgba(201,168,76,0.3);cursor:zoom-in"
        onclick="this.style.width=this.style.width==='100%'?'120px':'100%';this.style.height=this.style.height==='auto'?'85px':'auto';this.style.cursor=this.style.cursor==='zoom-in'?'zoom-out':'zoom-in'">
      ${lbl ? `<span style="font-size:0.72rem;color:#9090b8">${lbl}</span>` : ''}
    </div>`;
  }
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px">
    <div style="width:120px;height:85px;border:2px dashed rgba(201,168,76,0.25);border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:#555;background:#080818">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#444" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9l4-4 4 4 4-6 5 7"/><circle cx="8.5" cy="8.5" r="1.5"/></svg>
      <span style="font-size:0.66rem;text-align:center;line-height:1.3;color:#555">NO IMAGE<br>AVAILABLE</span>
    </div>
    ${lbl ? `<span style="font-size:0.72rem;color:#9090b8">${lbl}</span>` : ''}
  </div>`;
}

// Dark-theme 2-column row
function _bioRow2(l1, v1, l2, v2) {
  return `<tr>
    <td style="padding:6px 10px;background:#111132;color:#9090b8;font-size:0.79rem;font-weight:600;white-space:nowrap;border:1px solid rgba(201,168,76,0.15);width:18%">${l1}</td>
    <td style="padding:6px 10px;border:1px solid rgba(201,168,76,0.15);font-size:0.87rem;color:#e0e0f0;background:#080818;width:32%">${v1||'—'}</td>
    <td style="padding:6px 10px;background:#111132;color:#9090b8;font-size:0.79rem;font-weight:600;white-space:nowrap;border:1px solid rgba(201,168,76,0.15);width:18%">${l2||''}</td>
    <td style="padding:6px 10px;border:1px solid rgba(201,168,76,0.15);font-size:0.87rem;color:#e0e0f0;background:#080818;width:32%">${l2 ? (v2||'—') : ''}</td>
  </tr>`;
}

// Dark-theme full-width row
function _bioRow1(l1, v1) {
  return `<tr>
    <td style="padding:6px 10px;background:#111132;color:#9090b8;font-size:0.79rem;font-weight:600;white-space:nowrap;border:1px solid rgba(201,168,76,0.15)">${l1}</td>
    <td colspan="3" style="padding:6px 10px;border:1px solid rgba(201,168,76,0.15);font-size:0.87rem;color:#e0e0f0;background:#080818">${v1||'—'}</td>
  </tr>`;
}

function _bioPhotoCircle(src, size) {
  const sz = size || 88;
  if (src && (src.startsWith('data:image') || src.startsWith('http') || src.startsWith('/'))) {
    return `<img src="${escapeHtml(src)}" style="width:${sz}px;height:${sz}px;border-radius:50%;object-fit:cover;border:2px solid rgba(201,168,76,0.5);flex-shrink:0">`;
  }
  return `<div style="width:${sz}px;height:${sz}px;border-radius:50%;background:#0d0d22;border:2px solid rgba(201,168,76,0.4);display:flex;align-items:center;justify-content:center;flex-shrink:0">
    <svg width="${Math.round(sz*0.48)}" height="${Math.round(sz*0.48)}" viewBox="0 0 24 24" fill="none" stroke="#444" stroke-width="1.5">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  </div>`;
}

function _bioHeader(title) {
  return `<div style="background:linear-gradient(135deg,#1a1a5e,#0d0d3b);color:#fff;padding:12px 18px;border-radius:10px 10px 0 0;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(201,168,76,0.3)">
    <div style="font-size:1rem;font-weight:700;letter-spacing:0.5px;color:#c9a84c">${escapeHtml(title)}</div>
    <button onclick="closeBioPopup()" style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:#fff;font-size:1.1rem;width:28px;height:28px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1">&#10005;</button>
  </div>`;
}

function _bioFooter(leftBtn, rightBtn) {
  return `<div style="padding:10px 18px;border-top:1px solid rgba(201,168,76,0.2);display:flex;justify-content:space-between;align-items:center;background:#0d0d22;border-radius:0 0 10px 10px;gap:10px">
    ${leftBtn}
    ${rightBtn || ''}
  </div>`;
}

function _bioShow(html) {
  const inner = document.getElementById('bio-popup-inner');
  const ov    = document.getElementById('bio-popup-overlay');
  if (inner) inner.innerHTML = html;
  if (ov) {
    ov.style.display = 'flex';
    // Force reflow so transition fires
    ov.offsetHeight; // eslint-disable-line no-unused-expressions
    ov.classList.add('open');
  }
}

// Fetch users if not already loaded
async function _ensureUsersCache() {
  if (typeof usersCache !== 'undefined' && Array.isArray(usersCache) && usersCache.length > 0) {
    return usersCache;
  }
  try {
    const fetched = await api(API.users);
    if (typeof usersCache !== 'undefined') usersCache = fetched;
    return fetched || [];
  } catch(e) { return []; }
}

async function _ensureParentsCache() {
  if (typeof _piData !== 'undefined' && Array.isArray(_piData) && _piData.length > 0) {
    return _piData;
  }
  try {
    const fetched = await api(API.parents);
    if (typeof _piData !== 'undefined') _piData = fetched;
    return fetched || [];
  } catch(e) { return []; }
}

// ── Student Bio Popup ─────────────────────────────────────────────────────────

async function openStudentBio(id) {
  _bioShow('<div style="text-align:center;padding:48px;color:#9090b8;font-size:0.95rem;font-family:\'Segoe UI\',sans-serif;background:#05050e">Loading…</div>');
  try {
    const [s, uc, piData] = await Promise.all([
      api(`${API.students}?id=${id}`),
      _ensureUsersCache(),
      _ensureParentsCache()
    ]);
    const cls = (classes||[]).find(c => c.id == s.class_id);
    const fullName = ((s.first_name||'') + ' ' + (s.last_name||'')).trim() || s.student_name || '—';
    const isAdmin = currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin');
    const admDate = _bioFmtDate(s.admission_date);
    const dob     = _bioFmtDate(s.date_of_birth);
    const isConfirmed = s.registration_status === 'confirmed';
    const statusColor = isConfirmed ? '#44cc88' : '#f39c12';
    const statusText  = isConfirmed ? `Active ${admDate}` : 'Pending';

    // Fr# from parents cache
    const parentEntry = piData.find(p => p.father_cnic === s.father_cnic || p.cnic === s.father_cnic);
    const frNum = parentEntry?.family_code || '';

    // Account email
    const studentAccount = uc.find(u => u.student_id && String(u.student_id) === String(s.id));
    const accountEmail = studentAccount ? escapeHtml(studentAccount.username) : '—';

    // Fee rows
    const feeData = [1,2,3,4].map(i => ({ type: s[`fee_${i}_type`], amt: parseFloat(s[`fee_${i}_amount`])||0 })).filter(r => r.type || r.amt);
    const totalFee = feeData.reduce((sum,r) => sum + r.amt, 0);
    const feeRowsHtml = feeData.map(r =>
      `<tr>
        <td style="padding:5px 10px;border:1px solid rgba(201,168,76,0.15);background:#080818;color:#e0e0f0">${escapeHtml(r.type||'')}</td>
        <td style="padding:5px 10px;border:1px solid rgba(201,168,76,0.15);text-align:right;background:#080818;color:#e0e0f0">${r.amt.toLocaleString()}</td>
        <td style="padding:5px 10px;border:1px solid rgba(201,168,76,0.15);text-align:right;color:#ff5555;background:#080818">0</td>
        <td style="padding:5px 10px;border:1px solid rgba(201,168,76,0.15);font-weight:600;text-align:right;background:#080818;color:#44cc88">${r.amt.toLocaleString()}</td>
      </tr>`).join('');

    const editBtn = isAdmin ? `<button onclick="closeBioPopup();editStudent(${s.id})" style="background:#c9a84c;color:#05050e;border:none;border-radius:6px;padding:3px 10px;cursor:pointer;font-size:0.8rem;margin-left:8px;vertical-align:middle;font-weight:600">Edit</button>` : '';
    const parentClickStyle = s.father_cnic ? `style="color:#c9a84c;cursor:pointer;font-weight:600" onclick="openParentBio('${escapeHtml(s.father_cnic).replace(/'/g,"\\'")}')"` : '';

    const html = `<div style="font-family:'Segoe UI',Arial,sans-serif;color:#e0e0f0;background:#05050e;border-radius:10px">
      ${_bioHeader('Institute of Dynamic Learning')}

      <!-- Student header -->
      <div style="padding:14px 18px;background:#0d0d22;border-bottom:1px solid rgba(201,168,76,0.2);display:flex;gap:14px;align-items:flex-start">
        <div style="flex-shrink:0">${_bioPhotoCircle(s.photo, 84)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:0.78rem;color:#9090b8;margin-bottom:2px">
            (GR# <strong style="color:#ff5555">${escapeHtml(s.gr_number||'—')}</strong>)
            ${frNum ? `&nbsp;(Fr# <strong style="color:#c9a84c">${escapeHtml(frNum)}</strong>)` : ''}
          </div>
          <div style="font-size:1.2rem;font-weight:700;color:#c9a84c">${escapeHtml(fullName)} ${editBtn}</div>
          <div style="font-size:0.87rem;color:#9090b8;margin-top:2px">Class <span style="color:#e0e0f0">${escapeHtml(cls ? cls.name : '—')}</span></div>
          <div style="margin-top:3px;font-size:0.82rem;color:${statusColor};font-weight:600">( ${statusText} )</div>
        </div>
        <!-- Siblings -->
        <div style="flex-shrink:0;border:1px solid rgba(201,168,76,0.3);border-radius:8px;padding:8px 10px;text-align:center;max-width:340px;background:#080818">
          <div style="font-size:0.68rem;color:#c9a84c;font-weight:700;letter-spacing:1px;margin-bottom:8px;text-transform:uppercase">Siblings</div>
          <div id="bp-siblings" style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;align-items:flex-start">
            <span style="color:#555;font-size:0.75rem">…</span>
          </div>
        </div>
      </div>

      <!-- Info table -->
      <div style="padding:12px 18px">
        <table style="width:100%;border-collapse:collapse">
          <tbody>
            ${_bioRow2('Account Email', `<span style="color:#4488ff;font-family:monospace">${accountEmail}</span>`, 'Caste', escapeHtml(s.caste||''))}
            ${_bioRow2('Admission Date', `<span style="color:#4488ff">${admDate}</span>`, 'Birth Place', `<span style="color:#4488ff">${escapeHtml(s.place_of_birth||'')}</span>`)}
            ${_bioRow2('Address', `<span style="color:#4488ff">${escapeHtml(s.student_address||'')}</span>`, 'Gender', `<span style="color:#c9a84c;font-weight:600">${escapeHtml(s.gender||'')}</span>`)}
            <tr>
              <td style="padding:6px 10px;background:#111132;color:#9090b8;font-size:0.79rem;font-weight:600;white-space:nowrap;border:1px solid rgba(201,168,76,0.15)">
                <div style="display:flex;align-items:center;gap:6px">
                  ${isAdmin ? `<label style="display:inline-flex;align-items:center;cursor:pointer;gap:0" title="Edit class">
                    <input type="checkbox" id="bio-class-toggle" style="display:none" onchange="toggleBioClassEdit(${s.id},this.checked)">
                    <span id="bio-class-chk-icon" style="width:14px;height:14px;border:2px solid rgba(201,168,76,0.5);border-radius:3px;display:inline-flex;align-items:center;justify-content:center;transition:all .2s;flex-shrink:0;background:transparent">
                      <svg id="bio-class-chk-tick" width="9" height="9" viewBox="0 0 10 8" style="display:none"><polyline points="1,4 4,7 9,1" fill="none" stroke="#c9a84c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </span>
                  </label>` : ''}
                  <span>Class</span>
                </div>
              </td>
              <td colspan="3" style="padding:6px 10px;border:1px solid rgba(201,168,76,0.15);font-size:0.87rem;color:#e0e0f0;background:#080818">
                <span id="bio-class-display" style="color:${cls ? '#c9a84c' : '#666'};font-weight:${cls ? '600' : '400'};font-style:${cls ? 'normal' : 'italic'}">${cls ? escapeHtml(cls.name) : 'Select a class'}</span>
                <div id="bio-class-select-wrap" style="display:none">
                  <select id="bio-class-select">
                    <option value="">— Select Class —</option>
                    ${(classes||[]).map(c => `<option value="${c.id}"${s.class_id==c.id?' selected':''}>${escapeHtml(c.name)}</option>`).join('')}
                  </select>
                </div>
              </td>
            </tr>
            ${_bioRow2('Previous School', escapeHtml(s.previous_school||''), 'DOB', `<span style="color:#44cc88">${dob}</span>`)}
            ${_bioRow2('Profession', escapeHtml(s.father_occupation||''), 'Religion', escapeHtml(s.religion||''))}
            ${_bioRow2('Parent Name', `<span ${parentClickStyle}>${escapeHtml(s.father_name||'')}</span>`, 'Parent Email', s.father_email ? `<a href="mailto:${escapeHtml(s.father_email)}" style="color:#4488ff">${escapeHtml(s.father_email)}</a>` : '—')}
            ${_bioRow2('Parent Phone', escapeHtml(s.father_phone||''), 'Parent NIC', `<span style="font-family:monospace;color:#9090b8">${escapeHtml(s.father_cnic||'')}</span>`)}
            ${_bioRow2('Mother Name', escapeHtml(s.mother_name||''), 'Mother Phone', escapeHtml(s.mother_phone||s.guardian_phone||''))}
            ${s.registration_remarks ? _bioRow1('Registration Remarks', `<span style="white-space:pre-wrap;color:#e0e0f0">${escapeHtml(s.registration_remarks)}</span>`) : ''}
            ${s.campus_private_remarks ? _bioRow1('Private Remarks', `<span style="white-space:pre-wrap;color:#c87fff">${escapeHtml(s.campus_private_remarks)}</span>`) : ''}
          </tbody>
        </table>
      </div>

      ${feeRowsHtml ? `
      <!-- Fee table -->
      <div style="padding:0 18px 12px">
        <table style="width:100%;border-collapse:collapse;font-size:0.85rem">
          <thead>
            <tr style="background:#111132">
              <th style="padding:6px 10px;border:1px solid rgba(201,168,76,0.2);text-align:left;font-size:0.78rem;color:#9090b8">Fee Category</th>
              <th style="padding:6px 10px;border:1px solid rgba(201,168,76,0.2);text-align:right;font-size:0.78rem;color:#9090b8">Total</th>
              <th style="padding:6px 10px;border:1px solid rgba(201,168,76,0.2);text-align:right;font-size:0.78rem;color:#ff5555">Discount</th>
              <th style="padding:6px 10px;border:1px solid rgba(201,168,76,0.2);font-weight:700;text-align:right;font-size:0.78rem;color:#c9a84c">Net</th>
            </tr>
          </thead>
          <tbody>
            ${feeRowsHtml}
            <tr style="background:#0d0d22;font-weight:700">
              <td style="padding:5px 10px;border:1px solid rgba(201,168,76,0.2);color:#e0e0f0">TOTALS</td>
              <td style="padding:5px 10px;border:1px solid rgba(201,168,76,0.2);text-align:right;color:#e0e0f0">${totalFee.toLocaleString()}</td>
              <td style="padding:5px 10px;border:1px solid rgba(201,168,76,0.2);text-align:right;color:#ff5555">0</td>
              <td style="padding:5px 10px;border:1px solid rgba(201,168,76,0.2);font-weight:700;text-align:right;color:#44cc88">${totalFee.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>` : ''}

      <!-- Documents -->
      <div style="padding:0 18px 12px;display:flex;gap:12px;flex-wrap:wrap">
        ${_bioDocCell(s.photo, 'Photo')}
        ${_bioDocCell(s.document1||null, 'Document 1')}
        ${_bioDocCell(s.document2||null, 'Document 2')}
        ${_bioDocCell(s.document3||null, 'Document 3')}
      </div>

      ${_bioFooter(
        `<button onclick="closeBioPopup()" style="background:transparent;border:1px solid rgba(201,168,76,0.3);color:#9090b8;padding:7px 18px;border-radius:6px;cursor:pointer;font-size:0.88rem">Close</button>`,
        `<button onclick="downloadStudentForm(${s.id},'pdf')" style="background:#1a4db8;color:#fff;border:none;padding:7px 18px;border-radius:6px;cursor:pointer;font-size:0.88rem;font-weight:600">&#128438; Print Student Bio Data</button>`
      )}
    </div>`;

    _bioShow(html);

    // Load siblings asynchronously
    if (s.father_cnic) {
      api(`${API.students}?action=siblings&father_cnic=${encodeURIComponent(s.father_cnic)}`).then(siblings => {
        const cont = document.getElementById('bp-siblings');
        if (!cont) return;
        const others = (siblings||[]).filter(sib => sib.id != id);
        if (!others.length) { cont.innerHTML = '<span style="color:#444;font-size:0.72rem">None</span>'; return; }
        cont.innerHTML = others.map(sib => {
          const sn = ((sib.first_name||'') + ' ' + (sib.last_name||'')).trim() || sib.student_name || '';
          const firstName = sn.split(' ')[0] || sn;
          return `<div onclick="openStudentBio(${sib.id})" title="${escapeHtml(sn)}" style="cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px">
            ${_bioPhotoCircle(sib.photo, 36)}
            <div style="font-size:0.62rem;color:#c9a84c;max-width:38px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center">${escapeHtml(firstName)}</div>
          </div>`;
        }).join('');
      }).catch(() => {
        const cont = document.getElementById('bp-siblings');
        if (cont) cont.innerHTML = '<span style="color:#444;font-size:0.72rem">—</span>';
      });
    } else {
      const cont = document.getElementById('bp-siblings');
      if (cont) cont.innerHTML = '<span style="color:#444;font-size:0.72rem">None</span>';
    }
  } catch(e) {
    _bioShow(`<div style="padding:40px;text-align:center;color:#ff5555;font-family:sans-serif;background:#05050e;border-radius:10px">${escapeHtml(e.message)}</div>`);
  }
}

// ── Student Bio: inline class edit ────────────────────────────────────────────
function toggleBioClassEdit(studentId, checked) {
  const display  = document.getElementById('bio-class-display');
  const wrap     = document.getElementById('bio-class-select-wrap');
  const icon     = document.getElementById('bio-class-chk-icon');
  const tick     = document.getElementById('bio-class-chk-tick');
  if (!display || !wrap) return;

  // Update custom checkbox visual
  if (icon) icon.style.background  = checked ? 'rgba(201,168,76,0.15)' : 'transparent';
  if (icon) icon.style.borderColor = checked ? '#c9a84c' : 'rgba(201,168,76,0.5)';
  if (tick) tick.style.display     = checked ? '' : 'none';

  if (checked) {
    display.style.display = 'none';
    wrap.style.display    = '';
    // Init searchable select once
    const sel = document.getElementById('bio-class-select');
    if (sel && !sel.dataset.ssInit) makeSearchable(sel);
  } else {
    // Auto-save on uncheck
    saveBioStudentClass(studentId);
  }
}

async function saveBioStudentClass(studentId) {
  const select  = document.getElementById('bio-class-select');
  const display = document.getElementById('bio-class-display');
  const wrap    = document.getElementById('bio-class-select-wrap');
  if (!select) return;
  const classId = select.value;
  try {
    await api(`${API.students}?action=set_class`, 'PUT', { id: studentId, class_id: classId || null });
    const cls = (classes||[]).find(c => c.id == classId);
    if (display) {
      display.textContent        = cls ? cls.name : 'Select a class';
      display.style.color        = cls ? '#c9a84c' : '#666';
      display.style.fontWeight   = cls ? '600' : '400';
      display.style.fontStyle    = cls ? 'normal' : 'italic';
      display.style.display      = '';
    }
    if (wrap) wrap.style.display = 'none';
    if (typeof loadStudents === 'function') loadStudents();
    toast('Class updated', 'success');
  } catch(e) { toast(e.message, 'error'); }
}

// ── Teacher Bio Popup ─────────────────────────────────────────────────────────

async function openTeacherBio(id) {
  _bioShow('<div style="text-align:center;padding:48px;color:#9090b8;font-size:0.95rem;font-family:\'Segoe UI\',sans-serif;background:#05050e">Loading…</div>');
  try {
    let t = (teachers||[]).find(x => x.id == id);
    if (!t) t = await api(`${API.teachers}?id=${id}`);
    if (!t) throw new Error('Teacher not found');

    // Load account username for this teacher
    const uc = await _ensureUsersCache();
    const acct = (uc||[]).find(u => u.teacher_id == id);
    const acctLogin = acct ? escapeHtml(acct.username) : '—';

    const isAdmin = currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin');
    const displayTitle = normalizeTitle ? normalizeTitle(t.title) : (t.title || '');
    const joinDate = _bioFmtDate(t.joining_date);
    const dob      = _bioFmtDate(t.date_of_birth);
    const isActive = !t.leaving_date;
    const statusColor = isActive ? '#44cc88' : '#ff5555';
    const statusText  = isActive ? 'Active Status' : `Left ${_bioFmtDate(t.leaving_date)}`;

    const editBtn = isAdmin ? `<button onclick="closeBioPopup();editTeacher(${t.id})" style="background:#c9a84c;color:#05050e;border:none;border-radius:6px;padding:3px 10px;cursor:pointer;font-size:0.8rem;margin-left:8px;vertical-align:middle;font-weight:600">Edit</button>` : '';

    const html = `<div style="font-family:'Segoe UI',Arial,sans-serif;color:#e0e0f0;background:#05050e;border-radius:10px">
      ${_bioHeader('Institute of Dynamic Learning')}

      <!-- Teacher header -->
      <div style="padding:14px 18px;background:#0d0d22;border-bottom:1px solid rgba(201,168,76,0.2);display:flex;gap:14px;align-items:flex-start">
        <div style="flex-shrink:0">${_bioPhotoCircle(t.photo, 84)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:1.2rem;font-weight:700;color:#c9a84c">${escapeHtml(t.name)} ${editBtn}</div>
          <div style="font-size:0.87rem;color:#4488ff;margin-top:2px">
            ${escapeHtml(t.designation||'')} ${t.role ? `<span style="color:#9090b8;font-size:0.82rem">(${escapeHtml(t.role)})</span>` : ''}
          </div>
          <div style="font-size:0.87rem;color:#9090b8;margin-top:2px">Phone: <span style="color:#e0e0f0">${escapeHtml(t.phone||'—')}</span></div>
          <div style="margin-top:3px;font-size:0.82rem;color:${statusColor};font-weight:600">( ${statusText} )</div>
        </div>
        <!-- Documents -->
        <div style="display:flex;gap:8px;flex-shrink:0">
          ${_bioDocCell(t.cnic_front, 'CNIC Front')}
          ${_bioDocCell(t.cnic_back,  'CNIC Back')}
          ${_bioDocCell(null, 'Doc 3')}
        </div>
      </div>

      <!-- Info table -->
      <div style="padding:12px 18px">
        <table style="width:100%;border-collapse:collapse">
          <tbody>
            ${_bioRow2('Phone Number', escapeHtml(t.phone||''), 'Email', acct ? `<a href="mailto:${acctLogin}" style="color:#4488ff">${acctLogin}</a>` : (t.email ? `<a href="mailto:${escapeHtml(t.email)}" style="color:#4488ff">${escapeHtml(t.email)}</a>` : '—'))}
            ${_bioRow2('Account Login', `<span style="color:#c9a84c;font-family:monospace;font-weight:600">${acctLogin}</span>`, 'Account Role', acct ? `<span style="background:rgba(201,168,76,0.12);color:#c9a84c;padding:1px 8px;border-radius:10px;font-size:0.8rem;font-weight:600">${escapeHtml(acct.role||'')}</span>` : '')}
            ${_bioRow2('Gender', `<span style="color:#c9a84c;font-weight:600">${escapeHtml(t.gender||'')}</span>`, 'Religion', escapeHtml(t.religion||''))}
            ${_bioRow2('Designation', `<span style="color:#4488ff">${escapeHtml(t.designation||'')}</span>`, 'Appointment Date', `<span style="color:#4488ff">${joinDate}${joinDate !== '—' ? ` <span style="color:#9090b8;font-size:0.78rem">(${_bioCalcTenure(t.joining_date)})</span>` : ''}</span>`)}
            ${_bioRow2('Qualification', `<span style="color:#4488ff">${escapeHtml(t.qualification||'')}</span>`, 'Blood Group', escapeHtml(t.blood_group||''))}
            ${_bioRow1('Address', `<span style="color:#4488ff">${escapeHtml(t.address||'')}</span>`)}
            ${_bioRow2('Date of Birth', `<span style="color:#44cc88">${dob}</span>`, 'Place of Birth', `<span style="color:#4488ff">${escapeHtml(t.place_of_birth||'')}</span>`)}
            ${_bioRow2('NIC Number', `<span style="font-family:monospace;color:#9090b8">${escapeHtml(t.nic_number||'')}</span>`, 'Employment Type', `<span style="color:#4488ff">${escapeHtml(t.employment_type||'')}</span>`)}
            ${_bioRow2('Initial Salary', `<span style="color:#ff5555">${_bioFmtMoney(t.starting_salary)}</span>`, 'Current Salary', `<span style="color:#ff5555">${_bioFmtMoney(t.current_salary)}</span>`)}
            ${_bioRow1('Subjects Taught', escapeHtml(t.work_experience||''))}
            ${_bioRow1('Detailed Notes', escapeHtml(t.notes||''))}
          </tbody>
        </table>
      </div>

      ${_bioFooter(
        `<button onclick="closeBioPopup()" style="background:transparent;border:1px solid rgba(201,168,76,0.3);color:#9090b8;padding:7px 18px;border-radius:6px;cursor:pointer;font-size:0.88rem">Close</button>`,
        `<button onclick="_bioPrintTeacher(${t.id})" style="background:#1a4db8;color:#fff;border:none;padding:7px 18px;border-radius:6px;cursor:pointer;font-size:0.88rem;font-weight:600">&#128438; Print Staff Bio Data</button>`
      )}
    </div>`;

    _bioShow(html);
  } catch(e) {
    _bioShow(`<div style="padding:40px;text-align:center;color:#ff5555;font-family:sans-serif;background:#05050e;border-radius:10px">${escapeHtml(e.message)}</div>`);
  }
}

function _bioCalcTenure(joinDate) {
  if (!joinDate || joinDate === '0000-00-00') return '';
  const start = new Date(joinDate), now = new Date();
  let y = now.getFullYear() - start.getFullYear();
  let m = now.getMonth() - start.getMonth();
  if (m < 0) { y--; m += 12; }
  const parts = [];
  if (y > 0) parts.push(y + ' Year' + (y !== 1 ? 's' : ''));
  if (m > 0) parts.push(m + ' Month' + (m !== 1 ? 's' : ''));
  const d = now.getDate() - start.getDate();
  if (d > 0 && !y && !m) parts.push(d + ' Day' + (d !== 1 ? 's' : ''));
  return parts.join(' ') || 'Today';
}

function _bioPrintTeacher(id) {
  let t = (teachers||[]).find(x => x.id == id);
  if (!t) { toast('Teacher data not found', 'error'); return; }
  const displayTitle = normalizeTitle ? normalizeTitle(t.title) : (t.title || '');
  const joinDate = _bioFmtDate(t.joining_date);
  const dob      = _bioFmtDate(t.date_of_birth);
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Staff Bio — ${escapeHtml(t.name)}</title>
  <style>
    body{font-family:'Times New Roman',Times,serif;font-size:13px;color:#000;margin:0;padding:0}
    .page{width:210mm;min-height:297mm;margin:0 auto;padding:14mm 18mm;box-sizing:border-box}
    h1{text-align:center;font-size:18px;margin:0 0 4px;text-transform:uppercase;letter-spacing:2px}
    .subtitle{text-align:center;font-size:11px;color:#555;margin-bottom:14px;letter-spacing:1px}
    .section-head{background:#1a1a5e;color:#fff;padding:5px 10px;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;margin:12px 0 0;border-radius:3px 3px 0 0}
    table.fields{width:100%;border-collapse:collapse;border:1px solid #ccc;border-top:none;margin-bottom:0}
    table.fields td{padding:5px 8px;border:1px solid #ddd;font-size:12px;vertical-align:top}
    table.fields td.lbl{color:#555;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;background:#f8f8f8;width:20%}
    .photo-box{float:right;margin:-10px 0 10px 14px;width:80px;text-align:center}
    .photo-box img{width:80px;height:90px;object-fit:cover;border:2px solid #1a1a5e;border-radius:4px}
    @media print{@page{size:portrait;margin:10mm}body{margin:0}}
  </style></head><body>
  <div class="page">
    <h1>Institute of Dynamic Learning</h1>
    <div class="subtitle">Staff Bio Data</div>
    ${t.photo ? `<div class="photo-box"><img src="${escapeHtml(t.photo)}" alt="Photo"></div>` : ''}
    <div class="section-head">Personal Information</div>
    <table class="fields"><tbody>
      <tr><td class="lbl">Name</td><td colspan="3"><strong>${escapeHtml(displayTitle + ' ' + t.name)}</strong></td></tr>
      <tr><td class="lbl">Designation</td><td>${escapeHtml(t.designation||'—')}</td><td class="lbl">Role</td><td>${escapeHtml(t.role||'—')}</td></tr>
      <tr><td class="lbl">Gender</td><td>${escapeHtml(t.gender||'—')}</td><td class="lbl">Religion</td><td>${escapeHtml(t.religion||'—')}</td></tr>
      <tr><td class="lbl">Date of Birth</td><td>${dob}</td><td class="lbl">Place of Birth</td><td>${escapeHtml(t.place_of_birth||'—')}</td></tr>
      <tr><td class="lbl">NIC Number</td><td>${escapeHtml(t.nic_number||'—')}</td><td class="lbl">Blood Group</td><td>${escapeHtml(t.blood_group||'—')}</td></tr>
      <tr><td class="lbl">Phone</td><td>${escapeHtml(t.phone||'—')}</td><td class="lbl">Email</td><td>${escapeHtml(t.email||'—')}</td></tr>
      <tr><td class="lbl">Address</td><td colspan="3">${escapeHtml(t.address||'—')}</td></tr>
    </tbody></table>
    <div class="section-head">Employment Details</div>
    <table class="fields"><tbody>
      <tr><td class="lbl">Joining Date</td><td>${joinDate}</td><td class="lbl">Employment Type</td><td>${escapeHtml(t.employment_type||'—')}</td></tr>
      <tr><td class="lbl">Qualification</td><td>${escapeHtml(t.qualification||'—')}</td><td class="lbl">Marital Status</td><td>${escapeHtml(t.marital_status||'—')}</td></tr>
      <tr><td class="lbl">Initial Salary</td><td>${_bioFmtMoney(t.starting_salary)}</td><td class="lbl">Current Salary</td><td>${_bioFmtMoney(t.current_salary)}</td></tr>
      ${t.work_experience ? `<tr><td class="lbl">Experience</td><td colspan="3">${escapeHtml(t.work_experience)}</td></tr>` : ''}
      ${t.notes ? `<tr><td class="lbl">Notes</td><td colspan="3">${escapeHtml(t.notes)}</td></tr>` : ''}
    </tbody></table>
  </div>
  <script>window.onload=()=>{setTimeout(()=>window.print(),400)}<\/script>
  </body></html>`;
  const w = window.open('', '_blank', 'width=900,height=700');
  if (w) { w.document.write(html); w.document.close(); }
  else toast('Please allow popups to print', 'error');
}

// ── Parent Bio Popup ──────────────────────────────────────────────────────────

async function openParentBio(cnic) {
  _bioShow('<div style="text-align:center;padding:48px;color:#9090b8;font-size:0.95rem;font-family:\'Segoe UI\',sans-serif;background:#05050e">Loading…</div>');
  try {
    let p = null;
    if (typeof _piData !== 'undefined' && _piData.length) {
      p = _piData.find(x => x.father_cnic === cnic || x.cnic === cnic);
    }
    if (!p) {
      const all = await api(API.parents);
      p = all.find(x => x.father_cnic === cnic || x.cnic === cnic);
    }
    if (!p) throw new Error('Parent record not found');

    const uc = await _ensureUsersCache();

    const isAdmin = currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin');
    const editBtn = isAdmin ? `<button onclick="closeBioPopup();openEditParentModal('${escapeHtml(cnic).replace(/'/g,"\\'")}')" style="background:#c9a84c;color:#05050e;border:none;border-radius:6px;padding:3px 10px;cursor:pointer;font-size:0.8rem;margin-left:6px;vertical-align:middle;font-weight:600">Edit</button>` : '';

    // Parent account email: find user with role='parent' linked to one of the parent's children
    let parentEmail = '—';
    if (uc.length && p.children && p.children.length) {
      const childrenIds = (p.children || []).map(childEntry => {
        const childName = childEntry.replace(/\s*\([^)]*\)\s*$/, '').trim();
        const st = (_studentsCache||[]).find(s => {
          const fn = ((s.first_name||'') + ' ' + (s.last_name||'')).trim() || s.student_name || '';
          return fn === childName || (s.student_name || '') === childName;
        });
        return st ? String(st.id) : null;
      }).filter(Boolean);
      const parentUser = uc.find(u => u.role === 'parent' && childrenIds.includes(String(u.student_id)));
      if (parentUser) parentEmail = escapeHtml(parentUser.username);
    }

    // Children HTML
    const childrenHtml = p.children && p.children.length
      ? `<div style="display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start;padding:14px 18px">
          ${p.children.map(childEntry => {
            const childName = childEntry.replace(/\s*\([^)]*\)\s*$/, '').trim();
            const classInParens = (childEntry.match(/\(([^)]*)\)$/) || [])[1] || '';
            const st = (_studentsCache||[]).find(s => {
              const fn = ((s.first_name||'') + ' ' + (s.last_name||'')).trim() || s.student_name || '';
              return fn === childName || (s.student_name || '') === childName;
            });
            const cls = st ? (classes||[]).find(c => c.id == st.class_id) : null;
            const clsLabel = cls ? cls.name : classInParens;
            const clickFn = st ? `openStudentBio(${st.id})` : '';
            return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px${clickFn ? ';cursor:pointer' : ''}" ${clickFn ? `onclick="${clickFn}"` : ''}>
              ${_bioPhotoCircle(st ? st.photo : null, 48)}
              <div style="text-align:center;max-width:90px">
                <div style="font-size:0.78rem;font-weight:600;color:#e0e0f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(childName)}</div>
                ${clsLabel ? `<div style="font-size:0.72rem;color:#9090b8">( ${escapeHtml(clsLabel)} )</div>` : ''}
              </div>
            </div>`;
          }).join('')}
        </div>`
      : `<div style="padding:12px 18px;color:#9090b8;font-size:0.85rem">No children linked.</div>`;

    const familyId = p.family_code || p.father_cnic || '—';

    const html = `<div style="font-family:'Segoe UI',Arial,sans-serif;color:#e0e0f0;background:#05050e;border-radius:10px">
      ${_bioHeader('Institute of Dynamic Learning')}

      <!-- Parent header -->
      <div style="padding:14px 18px;background:#0d0d22;border-bottom:1px solid rgba(201,168,76,0.2);display:flex;gap:14px;align-items:flex-start">
        <div style="flex-shrink:0">${_bioPhotoCircle(p.photo, 84)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:1.2rem;font-weight:700;color:#c9a84c">${escapeHtml(p.parent_name||'—')} ${editBtn}</div>
          <div style="font-size:0.87rem;color:#9090b8;margin-top:2px">Phone: <span style="color:#e0e0f0">${escapeHtml(p.parent_phone||p.phone||'—')}</span></div>
          <div style="margin-top:3px;font-size:0.82rem;color:#44cc88;font-weight:600">( Active Status )</div>
        </div>
        <!-- Documents -->
        <div style="display:flex;gap:8px;flex-shrink:0">
          ${_bioDocCell(p.doc1, 'CNIC Front')}
          ${_bioDocCell(p.doc2, 'CNIC Back')}
          ${_bioDocCell(null, 'Doc 3')}
        </div>
      </div>

      <!-- Info table -->
      <div style="padding:12px 18px">
        <table style="width:100%;border-collapse:collapse">
          <tbody>
            ${_bioRow2('Account Email', `<span style="color:#4488ff;font-family:monospace">${parentEmail}</span>`, 'Gender', `<span style="color:#c9a84c;font-weight:600">${escapeHtml(p.gender||'')}</span>`)}
            ${_bioRow2('Profession', escapeHtml(p.profession||''), 'Parent NIC', `<span style="font-family:monospace;color:#9090b8">${escapeHtml(p.father_cnic||p.cnic||'')}</span>`)}
            ${_bioRow2('Parent Phone', `<a href="tel:${escapeHtml(p.parent_phone||p.phone||'')}" style="color:#4488ff">${escapeHtml(p.parent_phone||p.phone||'')}</a>`, 'Fr#', `<span style="color:#c9a84c;font-weight:700">${escapeHtml(familyId)}</span>`)}
            ${_bioRow1('Address', `<span style="color:#4488ff">${escapeHtml(p.address||'')}</span>`)}
            ${_bioRow1('Detailed Notes', escapeHtml(p.notes||''))}
          </tbody>
        </table>
      </div>

      <!-- Children section -->
      <div style="border-top:1px solid rgba(201,168,76,0.2)">
        <div style="padding:8px 18px;background:#0d0d22;border-bottom:1px dashed rgba(200,127,255,0.3);text-align:center">
          <span style="font-size:0.85rem;color:#c87fff;font-weight:600">Children Studying in the Campus — Fr# <strong style="color:#c9a84c">${escapeHtml(familyId)}</strong></span>
        </div>
        ${childrenHtml}
      </div>

      ${_bioFooter(
        `<button onclick="closeBioPopup()" style="background:transparent;border:1px solid rgba(201,168,76,0.3);color:#9090b8;padding:7px 18px;border-radius:6px;cursor:pointer;font-size:0.88rem">Close</button>`,
        ''
      )}
    </div>`;

    _bioShow(html);
  } catch(e) {
    _bioShow(`<div style="padding:40px;text-align:center;color:#ff5555;font-family:sans-serif;background:#05050e;border-radius:10px">${escapeHtml(e.message)}</div>`);
  }
}
