// ===== STUDENTS MANAGEMENT =====
let _studentsCache = [];

async function loadStudents() {
  const body = document.getElementById('students-body');
  try {
    _studentsCache = await api(API.students);
    initStudentColFilter();
    renderStudents(_studentsCache);
    refreshStudentNotifBadge();
  } catch(e) {
    _studentsCache = [];
    if (body) body.innerHTML = `<tr><td colspan="19" style="text-align:center;padding:24px;color:var(--danger)">${escapeHtml(e.message)}</td></tr>`;
  }
}

let _currentStudentsList = [];

function renderStudents(list) {
  _currentStudentsList = list; // full filtered list (used for exports)
  const body = document.getElementById('students-body');
  if (!body) return; // students page not in DOM — just cache the data
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'superadmin';

  // Apply sort
  const sortVal = (document.getElementById('students-sort')?.value) || '';
  let display = list.slice();
  if (sortVal === 'az') {
    display.sort((a, b) => {
      const na = ((a.first_name||'') + ' ' + (a.last_name||'')).trim().toLowerCase() || (a.student_name||'').toLowerCase();
      const nb = ((b.first_name||'') + ' ' + (b.last_name||'')).trim().toLowerCase() || (b.student_name||'').toLowerCase();
      return na.localeCompare(nb);
    });
  } else if (sortVal === 'za') {
    display.sort((a, b) => {
      const na = ((a.first_name||'') + ' ' + (a.last_name||'')).trim().toLowerCase() || (a.student_name||'').toLowerCase();
      const nb = ((b.first_name||'') + ' ' + (b.last_name||'')).trim().toLowerCase() || (b.student_name||'').toLowerCase();
      return nb.localeCompare(na);
    });
  }

  // Apply per-page limit
  const perPage = parseInt(document.getElementById('students-per-page')?.value || '0');
  const limited = perPage > 0 ? display.slice(0, perPage) : display;

  // Update count label
  const countEl = document.getElementById('students-count-label');
  if (countEl) {
    countEl.textContent = perPage > 0 && list.length > perPage
      ? `Showing ${limited.length} of ${list.length} records`
      : `${list.length} record${list.length !== 1 ? 's' : ''}`;
  }

  if (!limited.length) {
    body.innerHTML = '<tr><td colspan="19" style="text-align:center;padding:24px;color:var(--text-muted)">No Data Found</td></tr>';
    applyStudentColFilter();
    return;
  }

  function calcAge(dob) {
    if (!dob) return '—';
    const b = new Date(dob), now = new Date();
    let y = now.getFullYear() - b.getFullYear();
    const m = now.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < b.getDate())) y--;
    return y + ' yrs';
  }

  const btnBase = 'border:none;border-radius:8px;cursor:pointer;width:34px;height:34px;display:inline-flex;align-items:center;justify-content:center;font-size:1rem;color:#fff;transition:opacity .15s;vertical-align:middle';

  const req = s => `<span style="color:#e74c3c;font-style:italic;font-size:0.82rem">${s}</span>`;

  body.innerHTML = limited.map((s, idx) => {
    const fullName = escapeHtml(((s.first_name||'') + ' ' + (s.last_name||'')).trim() || s.student_name || '');
    const nameDisplay = fullName
      ? `<span onclick="openStudentBio(${s.id})" style="background:var(--accent);color:#05050e;padding:2px 12px;border-radius:12px;font-weight:700;font-size:0.93rem;display:inline-block;cursor:pointer" title="View student profile">${fullName}</span>`
      : req('Student Name');
    const cls = classes.find(c => c.id == s.class_id);
    const className = cls ? escapeHtml(cls.name) : `<span style="color:#7a8bbf;font-style:italic;font-size:0.82rem">Pre Admission Assessment</span>`;
    const fatherCnic = s.father_cnic ? escapeHtml(s.father_cnic) : req('Father/Guardian CNIC');
    const regDate = s.admission_date && s.admission_date !== '0000-00-00'
      ? s.admission_date.split('-').reverse().join('-')
      : '—';
    const regNo = s.gr_number
      ? `<span style="font-weight:700;color:var(--accent);background:var(--surface2);padding:2px 7px;border-radius:6px;font-size:0.88rem">${escapeHtml(s.gr_number)}</span>`
      : '—';
    const dob = s.date_of_birth ? s.date_of_birth.split('-').reverse().join('-') : req('Date of Birth');
    const age = calcAge(s.date_of_birth);
    const parentPhone = s.father_phone || s.guardian_phone || s.mother_phone || '';
    const testDetails = s.test_date ? s.test_date.split('-').reverse().join('-') : '—';
    const totalMarks = s.total_test_marks ? escapeHtml(s.total_test_marks) : '—';
    const obtainedMarks = s.total_obtained_marks ? escapeHtml(s.total_obtained_marks) : '—';
    const address = s.student_address ? escapeHtml(s.student_address) : req('Address');
    const prevSchool = s.previous_school ? escapeHtml(s.previous_school) : '—';
    const remarks = s.registration_remarks ? escapeHtml(s.registration_remarks) : '—';
    const handler = s.referred_by ? escapeHtml(s.referred_by) : '—';
    const parentNameDisplay = s.father_name
      ? `<span onclick="openParentBio('${escapeHtml(s.father_cnic||'').replace(/'/g,"\\'")}')" style="color:var(--accent2,#c87fff);cursor:pointer" title="View parent profile">${escapeHtml(s.father_name)}</span>`
      : req('Parent Name');
    const parentPhoneDisplay = parentPhone ? escapeHtml(parentPhone) : req('Parent Phone');

    const isPending = !s.registration_status || s.registration_status === 'pending';
    const statusBadge = isPending
      ? `<span class="badge badge-break" style="font-size:0.72rem">Pending</span>`
      : `<span class="badge badge-green" style="font-size:0.72rem">&#10003; Confirmed</span>`;

    // Colorful icon action buttons
    const safeName    = fullName.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    const btnView     = `<button onclick="openStudentBio(${s.id})" title="View Student Profile" style="${btnBase};background:#1565C0" onmouseenter="this.style.opacity='.8'" onmouseleave="this.style.opacity='1'">&#9432;</button>`;
    const btnEdit     = isAdmin ? `<button onclick="editStudent(${s.id})" title="Edit Student Record" style="${btnBase};background:#00897B" onmouseenter="this.style.opacity='.8'" onmouseleave="this.style.opacity='1'">&#9998;</button>` : '';
    const waNum       = parentPhone.replace(/[^0-9]/g,'');
    const btnWA       = parentPhone ? `<button onclick="window.open('https://wa.me/${waNum}','_blank')" title="Open WhatsApp Chat with Parent" style="${btnBase};background:#25D366" onmouseenter="this.style.opacity='.8'" onmouseleave="this.style.opacity='1'">&#128172;</button>` : '';
    const btnDownload = `<div style="position:relative;display:inline-block"><button onclick="toggleStudentDownloadMenu(event,${s.id})" title="Download / Print Options" style="${btnBase};background:#546E7A" onmouseenter="this.style.opacity='.8'" onmouseleave="this.style.opacity='1'">&#128438;</button></div>`;
    const btnConfirm  = (isAdmin && isPending) ? `<button onclick="confirmStudentRegistration(${s.id})" title="Confirm Registration" style="${btnBase};background:#43A047" onmouseenter="this.style.opacity='.8'" onmouseleave="this.style.opacity='1'">&#10004;</button>` : '';
    const btnAcct     = isAdmin ? `<button onclick="openQuickAccountModal('student',${s.id},'${safeName}')" title="Manage Login Account" style="${btnBase};background:#5C35A5" onmouseenter="this.style.opacity='.8'" onmouseleave="this.style.opacity='1'">&#128274;</button>` : '';
    const btnDelete   = isAdmin ? `<button onclick="deleteStudent(${s.id},'${safeName}')" title="Delete Student Record" style="${btnBase};background:#E53935" onmouseenter="this.style.opacity='.8'" onmouseleave="this.style.opacity='1'">&#128465;</button>` : '';

    const actions = `<div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;justify-content:center;max-width:120px">${btnView}${btnEdit}${btnWA}${btnDownload}${btnConfirm}${btnAcct}${btnDelete}</div>`;

    const photoCell = s.photo
      ? `<img src="${escapeHtml(s.photo)}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid rgba(201,168,76,0.3)">`
      : `<div style="width:36px;height:36px;border-radius:50%;background:rgba(201,168,76,0.08);border:2px solid rgba(201,168,76,0.2);display:inline-flex;align-items:center;justify-content:center;margin:auto"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>`;

    return `<tr style="vertical-align:middle;text-align:center;font-size:0.9rem">
      <td data-col="col-sr" style="padding:7px 6px;white-space:nowrap;font-weight:600;color:var(--text-muted)">${s.sr_number || idx+1}</td>
      <td data-col="col-photo" style="padding:7px 6px;text-align:center">${photoCell}</td>
      <td data-col="col-reg-date" style="padding:7px 6px;white-space:nowrap">${regDate}</td>
      <td data-col="col-reg-no" style="padding:7px 6px;white-space:nowrap">${regNo}</td>
      <td data-col="col-name" style="padding:7px 6px;white-space:nowrap">${nameDisplay}</td>
      <td data-col="col-class" style="padding:7px 6px;white-space:nowrap">${className}</td>
      <td data-col="col-dob" style="padding:7px 6px;white-space:nowrap">${dob}</td>
      <td data-col="col-age" style="padding:7px 6px;white-space:nowrap">${age}</td>
      <td data-col="col-parent-name" style="padding:7px 6px;white-space:nowrap">${parentNameDisplay}</td>
      <td data-col="col-father-cnic" style="padding:7px 6px;white-space:nowrap">${fatherCnic}</td>
      <td data-col="col-parent-phone" style="padding:7px 6px;white-space:nowrap">${parentPhoneDisplay}</td>
      <td data-col="col-total-marks" style="padding:7px 6px;white-space:nowrap">${totalMarks}</td>
      <td data-col="col-obtained-marks" style="padding:7px 6px;white-space:nowrap">${obtainedMarks}</td>
      <td data-col="col-address" style="padding:7px 6px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${address}</td>
      <td data-col="col-status" style="padding:7px 6px;white-space:nowrap">${statusBadge}</td>
      <td data-col="col-prev-school" style="padding:7px 6px;white-space:nowrap">${prevSchool}</td>
      <td data-col="col-remarks" style="padding:7px 6px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${remarks}</td>
      <td data-col="col-handler" style="padding:7px 6px;white-space:nowrap">${handler}</td>
      <td data-col="col-actions" style="padding:7px 6px">${actions}</td>
    </tr>`;
  }).join('');
  applyStudentColFilter();
}

function filterStudents() {
  const raw = document.getElementById('students-search').value;
  if (!raw.trim()) { renderStudents(_studentsCache); return; }
  // Split by comma for multi-search — match ANY term
  const terms = raw.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
  renderStudents(_studentsCache.filter(s => {
    const name    = ((s.first_name||'') + ' ' + (s.last_name||'')).trim().toLowerCase();
    const clsName = (classes.find(c=>c.id==s.class_id)?.name||'').toLowerCase();
    return terms.some(q =>
      name.includes(q) ||
      (s.father_name||'').toLowerCase().includes(q) ||
      (s.father_cnic||'').toLowerCase().includes(q) ||
      (s.gr_number||'').toLowerCase().includes(q) ||
      (s.father_phone||'').includes(q) ||
      (s.guardian_phone||'').includes(q) ||
      (s.mother_phone||'').includes(q) ||
      (s.student_address||'').toLowerCase().includes(q) ||
      (s.previous_school||'').toLowerCase().includes(q) ||
      (s.referred_by||'').toLowerCase().includes(q) ||
      clsName.includes(q)
    );
  }));
}

// ===== STUDENT NOTIFICATIONS =====

const _ST_REQUIRED_FIELDS = [
  { field: 'first_name',      label: 'Student Name' },
  { field: 'father_name',     label: 'Father Name' },
  { field: 'father_phone',    label: 'Parent/Guardian Mobile' },
  { field: 'father_cnic',     label: 'Father/Guardian CNIC' },
  { field: 'class_id',        label: 'Admission Class' },
  { field: 'gender',          label: 'Gender' },
  { field: 'date_of_birth',   label: 'Date of Birth' },
  { field: 'student_address', label: 'Address' },
];

function getStudentMissingFields(s) {
  return _ST_REQUIRED_FIELDS.filter(r => {
    const v = s[r.field];
    return !v || String(v).trim() === '' || v === '0000-00-00';
  });
}

function refreshStudentNotifBadge() {
  const count = (_studentsCache || []).filter(s => getStudentMissingFields(s).length > 0).length;
  const navBadge = document.getElementById('st-notif-nav-badge');
  const subBadge = document.getElementById('st-notif-sub-badge');
  [navBadge, subBadge].forEach(el => {
    if (!el) return;
    el.textContent = count;
    el.style.display = count > 0 ? '' : 'none';
  });
}

function renderStudentNotifications(incomplete) {
  const container = document.getElementById('st-notif-list');
  if (!container) return;

  if (!incomplete.length) {
    const q = (document.getElementById('st-notif-search')?.value || '').trim();
    container.innerHTML = q
      ? `<div class="card" style="text-align:center;padding:36px;color:var(--text-muted)">No results match "<strong>${escapeHtml(q)}</strong>".</div>`
      : `<div class="card" style="text-align:center;padding:40px">
           <div style="font-size:2.5rem;margin-bottom:12px">&#10003;</div>
           <div style="font-size:1.1rem;font-weight:600;color:var(--accent);margin-bottom:6px">All records complete</div>
           <div style="color:var(--text-muted);font-size:0.9rem">No students have missing required information.</div>
         </div>`;
    return;
  }

  container.innerHTML = incomplete.map(s => {
    const fullName = ((s.first_name||'') + ' ' + (s.last_name||'')).trim() || s.student_name || 'Unnamed Student';
    const missing  = getStudentMissingFields(s);
    const cls      = classes.find(c => c.id == s.class_id);
    const clsName  = cls ? cls.name : '—';
    const regDate  = s.admission_date && s.admission_date !== '0000-00-00' ? s.admission_date.split('-').reverse().join('-') : '—';
    const missingHtml = missing.map(r =>
      `<span style="display:inline-block;background:rgba(231,76,60,0.12);color:#e74c3c;border:1px solid rgba(231,76,60,0.3);border-radius:20px;padding:2px 10px;font-size:0.78rem;font-weight:600;margin:2px 3px 2px 0">${escapeHtml(r.label)}</span>`
    ).join('');

    return `<div class="card" style="padding:16px 20px;border-left:4px solid #e74c3c;display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap">
      <div style="flex:1;min-width:220px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;flex-wrap:wrap">
          <span style="font-size:1rem;font-weight:700;color:var(--text)">${escapeHtml(fullName)}</span>
          ${s.gr_number ? `<span style="background:var(--surface2);color:var(--accent);padding:1px 8px;border-radius:6px;font-size:0.8rem;font-weight:700">${escapeHtml(s.gr_number)}</span>` : ''}
          <span style="color:var(--text-muted);font-size:0.82rem">${escapeHtml(clsName)} &bull; ${regDate}</span>
        </div>
        <div style="margin-bottom:4px;font-size:0.8rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.5px">Missing fields:</div>
        <div>${missingHtml}</div>
      </div>
      <div style="flex-shrink:0;display:flex;align-items:center">
        <button onclick="editStudentFromNotif(${s.id})" style="background:#e74c3c;color:#fff;border:none;border-radius:8px;padding:8px 18px;cursor:pointer;font-size:0.88rem;font-weight:700;display:flex;align-items:center;gap:6px;transition:opacity .15s" onmouseenter="this.style.opacity='.8'" onmouseleave="this.style.opacity='1'">
          &#9998; Complete Record
        </button>
      </div>
    </div>`;
  }).join('');
}

function loadStudentNotifications() {
  refreshStudentNotifBadge();
  const q = (document.getElementById('st-notif-search')?.value || '').trim().toLowerCase();
  const all = (_studentsCache || []).filter(s => getStudentMissingFields(s).length > 0);
  if (!q) { renderStudentNotifications(all); return; }
  renderStudentNotifications(all.filter(s => {
    const name = ((s.first_name||'') + ' ' + (s.last_name||'')).trim().toLowerCase() || (s.student_name||'').toLowerCase();
    const cls  = (classes.find(c => c.id == s.class_id)?.name || '').toLowerCase();
    return name.includes(q) || (s.gr_number||'').toLowerCase().includes(q) || cls.includes(q) ||
           (s.father_name||'').toLowerCase().includes(q);
  }));
}

function filterStudentNotifications() {
  loadStudentNotifications();
}

function editStudentFromNotif(id) {
  showPage('students');
  // Wait for students page to render, then open edit modal
  setTimeout(() => { editStudent(id); }, 200);
}

// ===== STUDENT COLUMN FILTER =====
const _ST_COLS = [
  { col: 'col-photo',        label: 'Photo',             def: true  },
  { col: 'col-reg-date',     label: 'Registration Date', def: true  },
  { col: 'col-reg-no',       label: 'Reg#',              def: true  },
  { col: 'col-name',         label: 'Name',              def: true  },
  { col: 'col-class',        label: 'Class',             def: true  },
  { col: 'col-dob',          label: 'Date of Birth',     def: false },
  { col: 'col-age',          label: 'Current Age',       def: true  },
  { col: 'col-parent-name',  label: 'Parent Name',       def: true  },
  { col: 'col-father-cnic',  label: 'Father/Guardian CNIC', def: true  },
  { col: 'col-parent-phone', label: 'Parent Phone',      def: true  },
  { col: 'col-total-marks',  label: 'Total Marks',       def: false },
  { col: 'col-obtained-marks',label:'Obtained Marks',    def: false },
  { col: 'col-address',      label: 'Address',           def: false },
  { col: 'col-status',       label: 'Status',            def: true  },
  { col: 'col-prev-school',  label: 'Previous School',   def: false },
  { col: 'col-remarks',      label: 'Remarks',           def: false },
  { col: 'col-handler',      label: 'Enquiry Handled By',def: false },
];

function initStudentColFilter() {
  const wrap = document.getElementById('st-col-checkboxes');
  if (!wrap || wrap.dataset.built) return;
  wrap.dataset.built = '1';
  const saved = JSON.parse(localStorage.getItem('st-col-vis') || 'null') || {};
  wrap.innerHTML = _ST_COLS.map(c => {
    const checked = (c.col in saved) ? saved[c.col] : c.def;
    return `<label style="display:flex;align-items:center;gap:5px;font-size:0.82rem;cursor:pointer;color:var(--text-muted)">
      <input type="checkbox" ${checked?'checked':''} data-col="${c.col}" onchange="saveStudentColPrefs();applyStudentColFilter()" style="accent-color:var(--accent)">
      ${c.label}
    </label>`;
  }).join('');
  applyStudentColFilter();
}

function saveStudentColPrefs() {
  const prefs = {};
  document.querySelectorAll('#st-col-checkboxes input[data-col]').forEach(cb => {
    prefs[cb.dataset.col] = cb.checked;
  });
  localStorage.setItem('st-col-vis', JSON.stringify(prefs));
}

function applyStudentColFilter() {
  const table = document.getElementById('students-table');
  if (!table) return;
  const checkboxes = document.querySelectorAll('#st-col-checkboxes input[data-col]');
  if (!checkboxes.length) return;
  const vis = {};
  checkboxes.forEach(cb => { vis[cb.dataset.col] = cb.checked; });
  // Always show Sr# and Actions
  vis['col-sr']      = true;
  vis['col-actions'] = true;
  table.querySelectorAll('[data-col]').forEach(el => {
    const col = el.dataset.col;
    if (col in vis) el.style.display = vis[col] ? '' : 'none';
  });
}

function toggleStudentFilterPanel() {
  const body   = document.getElementById('st-col-filter-body');
  const caret  = document.getElementById('st-filter-caret');
  const open   = body.style.display === 'none';
  body.style.display = open ? '' : 'none';
  caret.style.transform = open ? 'rotate(180deg)' : '';
  if (open) initStudentColFilter();
}

function setAllStudentCols(val) {
  document.querySelectorAll('#st-col-checkboxes input[data-col]').forEach(cb => { cb.checked = val; });
  saveStudentColPrefs();
  applyStudentColFilter();
}


function openStudentModal(studentData, viewOnly = false) {
  // Pre-load parents cache so CNIC autocomplete works
  if (typeof _ensureParentsCache === 'function') _ensureParentsCache();
  const isEdit = !!studentData;
  const titles = viewOnly ? 'View Student Details' : (isEdit ? 'Edit Admission Enquiry' : 'Add Admission Enquiry');
  document.getElementById('student-modal-title').textContent = titles;
  // Show/hide save button
  const saveBtn = document.querySelector('#student-modal-overlay .modal-footer .btn-primary');
  if (saveBtn) saveBtn.style.display = viewOnly ? 'none' : '';
  // Toggle readonly on all inputs/selects/textareas inside modal
  document.querySelectorAll('#student-modal-overlay input, #student-modal-overlay select, #student-modal-overlay textarea').forEach(el => {
    if (viewOnly) { el.setAttribute('readonly',''); el.setAttribute('disabled',''); }
    else { el.removeAttribute('readonly'); el.removeAttribute('disabled'); }
  });
  document.getElementById('student-modal-error').style.display = 'none';
  document.getElementById('student-id').value = isEdit ? studentData.id : '';

  // Populate class dropdowns
  const classOpts = '<option value="">Select</option>' + classes.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  const classIdEl = document.getElementById('st-class_id'); if (classIdEl) classIdEl.innerHTML = classOpts;
  document.getElementById('st-test_for_class').innerHTML = classOpts;

  // Reset required-field labels to normal
  ['lbl-st-father_phone','lbl-st-first_name','lbl-st-class_id','lbl-st-gender','lbl-st-date_of_birth',
   'lbl-st-father_name','lbl-st-student_address'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.color = '';
  });

  // Registration date — always default to today for new entries
  const _now = new Date();
  const _y = _now.getFullYear();
  const _m = String(_now.getMonth() + 1).padStart(2, '0');
  const _d = String(_now.getDate()).padStart(2, '0');
  const todayStr = `${_y}-${_m}-${_d}`;
  document.getElementById('st-admission_date').value = (isEdit && studentData.admission_date && studentData.admission_date !== '0000-00-00')
    ? studentData.admission_date
    : todayStr;

  // Name fields
  document.getElementById('st-first_name').value = isEdit ? (studentData.first_name || '') : '';
  document.getElementById('st-last_name').value  = isEdit ? (studentData.last_name || '') : '';
  if (isEdit && studentData.student_name && !studentData.first_name) {
    const parts = studentData.student_name.split(' ');
    document.getElementById('st-first_name').value = parts[0] || '';
    document.getElementById('st-last_name').value  = parts.slice(1).join(' ') || '';
  }

  // Simple text/select fields
  const fields = ['referred_by','date_of_birth','gender','religion','caste','place_of_birth','nationality',
    'nic_passport','b_form','registration_no','previous_school','reason_for_leaving',
    'student_mobile','registration_remarks','campus_private_remarks',
    'mother_phone','mother_name','mother_profession','mother_nic',
    'guardian_phone','emergency_contact','student_address','student_city',
    'father_name','father_occupation','father_designation','father_email','father_address','father_relationship',
    'physical_handicap','blood_group',
    'fee_1_type','fee_1_amount','fee_2_type','fee_2_amount','fee_3_type','fee_3_amount','fee_4_type','fee_4_amount',
    'test_date','test_for_class','total_test_marks','total_obtained_marks'];
  const defaults = { nationality: 'Pakistani', father_relationship: 'Father' };
  fields.forEach(f => {
    const el = document.getElementById('st-' + f);
    if (el) el.value = isEdit ? (studentData[f] != null ? studentData[f] : '') : (defaults[f] || '');
  });

  // NIC / Father phone display
  const cnic = isEdit ? (studentData.father_cnic || '') : '';
  document.getElementById('st-father_cnic').value = cnic;
  document.getElementById('st-father_cnic_real').value = cnic;
  document.getElementById('st-father_cnic_display').value = isEdit ? (studentData.father_phone || '') : '';

  // class_id — reset toggle then set display
  const classToggle  = document.getElementById('st-class-edit-toggle');
  const classDisplay = document.getElementById('st-class-display');
  const classSelect  = document.getElementById('st-class_id');
  if (classToggle)  classToggle.checked = false;
  if (classSelect)  classSelect.style.display = 'none';
  if (classDisplay) classDisplay.style.display = '';
  if (isEdit && studentData.class_id) {
    const cls = (classes||[]).find(c => c.id == studentData.class_id);
    if (classDisplay) { classDisplay.textContent = cls ? cls.name : 'Unknown Class'; classDisplay.style.color = '#c9a84c'; classDisplay.style.fontStyle = 'normal'; }
    if (classSelect)  classSelect.value = studentData.class_id;
  } else {
    if (classDisplay) { classDisplay.textContent = 'Select a class'; classDisplay.style.color = '#9090b8'; classDisplay.style.fontStyle = 'italic'; }
    if (classSelect)  classSelect.value = '';
  }
  if (isEdit) document.getElementById('st-test_for_class').value = studentData.test_for_class || '';

  // GR#
  const srDisplay = document.getElementById('st-sr_number-display');
  const grDisplay = document.getElementById('st-gr_number-display');
  const grHidden  = document.getElementById('st-gr_number');
  if (isEdit && studentData.gr_number) {
    if (srDisplay) srDisplay.textContent = studentData.sr_number || '—';
    grDisplay.textContent = studentData.gr_number;
    grHidden.value = studentData.gr_number;
  } else {
    if (srDisplay) srDisplay.textContent = '…';
    grDisplay.textContent = '…';
    grHidden.value = '';
    api(`${API.students}?action=next_gr`).then(r => {
      if (srDisplay) srDisplay.textContent = r.next_sr || 'Auto';
      grDisplay.textContent = r.next_gr || 'Auto';
      grHidden.value = r.next_gr || '';
    }).catch(() => { if (srDisplay) srDisplay.textContent = 'Auto'; grDisplay.textContent = 'Auto'; });
  }

  // Photo
  const photoImg = document.getElementById('st-photo-img');
  const photoPlaceholder = document.getElementById('st-photo-placeholder');
  const photoData = document.getElementById('st-photo-data');
  const photoClear = document.getElementById('st-photo-clear');
  const stZoom = document.getElementById('st-photo-zoom');
  if (stZoom) stZoom.value = 100;
  photoImg.style.transform = 'scale(1)';
  const photoWrap = document.getElementById('st-photo-img-wrap');
  if (isEdit && studentData.photo) {
    photoImg.src = studentData.photo;
    if (photoWrap) photoWrap.style.display = '';
    photoPlaceholder.style.display = 'none'; photoClear.style.display = '';
    photoData.value = studentData.photo.startsWith('data:') ? studentData.photo : '';
  } else {
    photoImg.src = '';
    if (photoWrap) photoWrap.style.display = 'none';
    photoPlaceholder.style.display = ''; photoClear.style.display = 'none';
    photoData.value = '';
  }
  document.getElementById('st-photo-input').value = '';

  // Documents
  [1,2,3].forEach(n => {
    const img = document.getElementById(`st-doc${n}-img`);
    const ph  = document.getElementById(`st-doc${n}-placeholder`);
    const dat = document.getElementById(`st-doc${n}-data`);
    const clr = document.getElementById(`st-doc${n}-clear`);
    const inp = document.getElementById(`st-doc${n}-input`);
    const val = isEdit ? (studentData[`document${n}`] || '') : '';
    if (val) {
      img.src = val; img.style.display = ''; ph.style.display = 'none';
      dat.value = val; if (clr) clr.style.display = '';
    } else {
      img.src = ''; img.style.display = 'none'; ph.style.display = '';
      dat.value = ''; if (clr) clr.style.display = 'none';
    }
    if (inp) inp.value = '';
  });

  openModal('student-modal-overlay');
}

function searchStudentByParentPhone() {
  const phone = document.getElementById('st-father_phone').value.trim();
  if (!phone) return;
  const match = _studentsCache.find(s => s.father_phone === phone);
  if (match) {
    document.getElementById('st-father_name').value      = match.father_name || '';
    document.getElementById('st-father_cnic').value      = match.father_cnic || '';
    document.getElementById('st-father_cnic_real').value = match.father_cnic || '';
    document.getElementById('st-father_occupation').value = match.father_occupation || '';
    document.getElementById('st-student_address').value  = match.student_address || '';
    toast('Parent info filled from existing record', 'success');
  } else {
    toast('No existing parent found with that mobile', 'warning');
  }
}

// ===== CLASS FIELD TOGGLE =====
function toggleStudentClassEdit(checked) {
  const display = document.getElementById('st-class-display');
  const select  = document.getElementById('st-class_id');
  if (!display || !select) return;
  if (checked) {
    display.style.display = 'none';
    select.style.display  = '';
    // Sync select to whatever class is currently displayed
    if (!select.value) {
      const cls = (classes||[]).find(c => c.name === display.textContent);
      if (cls) select.value = cls.id;
    }
  } else {
    select.style.display  = 'none';
    display.style.display = '';
    // Update display to reflect any selection made
    const cls = (classes||[]).find(c => c.id == select.value);
    if (cls) { display.textContent = cls.name; display.style.color = '#c9a84c'; display.style.fontStyle = 'normal'; }
    else      { display.textContent = 'Select a class'; display.style.color = '#9090b8'; display.style.fontStyle = 'italic'; }
  }
}

// ===== CNIC AUTOCOMPLETE =====
function _cnicRenderDropdown(matches) {
  const dropdown = document.getElementById('st-cnic-dropdown');
  if (!dropdown) return;
  if (!matches.length) { dropdown.style.display = 'none'; return; }
  dropdown.innerHTML = matches.map(p => {
    const fr   = p.family_code ? `<span style="color:#c9a84c;font-weight:700;font-family:monospace;font-size:0.75rem">Fr# ${escapeHtml(p.family_code)}</span>` : '';
    const name = escapeHtml(p.parent_name || '—');
    const cnic = escapeHtml(p.father_cnic || '');
    const ph   = escapeHtml(p.parent_phone || '');
    const args = [cnic, p.parent_name||'', ph, p.profession||'', p.address||'', p.family_code||'']
      .map(v => `'${escapeHtml(String(v)).replace(/'/g,"\\'")}'`).join(',');
    return `<div onclick="selectParentCnic(${args})"
      style="padding:8px 12px;cursor:pointer;border-bottom:1px solid rgba(201,168,76,0.1);display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:0.82rem"
      onmouseenter="this.style.background='rgba(201,168,76,0.1)'" onmouseleave="this.style.background=''">
      ${fr}
      <span style="color:#e0e0f0;font-weight:600">${name}</span>
      <span style="color:#9090b8;font-family:monospace">${cnic}</span>
      ${ph ? `<span style="color:#4488ff">📞 ${ph}</span>` : ''}
    </div>`;
  }).join('');
  dropdown.style.display = 'block';
}

function cnicShowAll() {
  const parents = (typeof _piData !== 'undefined' && _piData.length) ? _piData : [];
  const val = (document.getElementById('st-father_cnic_real')?.value || '').trim();
  if (val) { cnicAutoSuggest(val); return; }
  _cnicRenderDropdown(parents.slice(0, 20));
}

function cnicAutoSuggest(val) {
  const dropdown = document.getElementById('st-cnic-dropdown');
  if (!dropdown) return;
  const q = (val || '').trim().toLowerCase();
  if (!q) { dropdown.style.display = 'none'; return; }
  const parents = (typeof _piData !== 'undefined' && _piData.length) ? _piData : [];
  const matches = parents.filter(p =>
    (p.father_cnic || '').toLowerCase().includes(q) ||
    (p.parent_name || '').toLowerCase().includes(q) ||
    (p.family_code || '').toLowerCase().includes(q) ||
    (p.parent_phone || '').includes(q)
  ).slice(0, 10);
  _cnicRenderDropdown(matches);
}

function selectParentCnic(cnic, name, phone, profession, address, familyCode) {
  document.getElementById('st-father_cnic_real').value = cnic;
  document.getElementById('st-father_cnic').value      = cnic;
  if (name)       document.getElementById('st-father_name').value        = name;
  if (phone)      { document.getElementById('st-father_phone').value     = phone;
                    document.getElementById('st-father_cnic_display').value = phone; }
  if (profession) document.getElementById('st-father_occupation').value  = profession;
  if (address)    document.getElementById('st-student_address').value    = address;
  const dropdown = document.getElementById('st-cnic-dropdown');
  if (dropdown) dropdown.style.display = 'none';
  if (familyCode) toast(`Family Fr# ${familyCode} linked`, 'success');
}

async function viewStudent(id) {
  try {
    const student = await api(`${API.students}?id=${id}`);
    openStudentModal(student, true); // true = view-only mode
  } catch (e) { toast(e.message, 'error'); }
}

async function editStudent(id) {
  try {
    const student = await api(`${API.students}?id=${id}`);
    openStudentModal(student, false);
  } catch (e) { toast(e.message, 'error'); }
}

async function saveStudent() {
  const errEl = document.getElementById('student-modal-error');
  errEl.style.display = 'none';
  const id = document.getElementById('student-id').value;

  const body = {};
  body.first_name = document.getElementById('st-first_name').value.trim();
  body.last_name  = document.getElementById('st-last_name').value.trim();
  body.class_id   = document.getElementById('st-class_id')?.value || '';
  body.photo      = document.getElementById('st-photo-data').value || '';
  body.document1  = document.getElementById('st-doc1-data').value || '';
  body.document2  = document.getElementById('st-doc2-data').value || '';
  body.document3  = document.getElementById('st-doc3-data').value || '';
  // Sync real CNIC from the editable input
  document.getElementById('st-father_cnic').value = document.getElementById('st-father_cnic_real').value;

  const fields = ['referred_by','date_of_birth','gender','religion','caste','place_of_birth','nationality',
    'nic_passport','b_form','admission_date','registration_no','previous_school','reason_for_leaving',
    'student_mobile','registration_remarks','campus_private_remarks',
    'mother_phone','mother_name','mother_profession','mother_nic',
    'guardian_phone','emergency_contact','student_address','student_city',
    'father_name','father_cnic','father_phone','father_occupation','father_designation',
    'father_email','father_address','father_relationship','physical_handicap','blood_group',
    'fee_1_type','fee_1_amount','fee_2_type','fee_2_amount','fee_3_type','fee_3_amount','fee_4_type','fee_4_amount',
    'test_date','test_for_class','total_test_marks','total_obtained_marks'];
  fields.forEach(f => { body[f] = document.getElementById('st-' + f)?.value ?? ''; });

  // Inline required-field validation — mark labels red instead of blocking with alert
  const required = [
    { field: 'father_phone',    label: 'lbl-st-father_phone',    value: body.father_phone },
    { field: 'first_name',      label: 'lbl-st-first_name',      value: body.first_name },
    { field: 'gender',          label: 'lbl-st-gender',          value: body.gender },
    { field: 'date_of_birth',   label: 'lbl-st-date_of_birth',   value: body.date_of_birth },
    { field: 'father_name',     label: 'lbl-st-father_name',     value: body.father_name },
    { field: 'father_cnic',     label: 'lbl-st-father_cnic',     value: body.father_cnic },
    { field: 'student_address', label: 'lbl-st-student_address', value: body.student_address }
  ];
  // Mark missing required fields red — but still allow saving
  required.forEach(r => {
    const lbl = document.getElementById(r.label);
    if (!r.value || !r.value.trim()) {
      if (lbl) lbl.style.color = 'var(--danger)';
    } else {
      if (lbl) lbl.style.color = '';
    }
  });

  try {
    if (id) {
      body.id = id;
      await api(API.students, 'PUT', body);
      toast('Student record updated');
    } else {
      await api(API.students, 'POST', body);
      toast('Admission enquiry saved');
    }
    closeModal('student-modal-overlay');
    await loadStudents();
    // Refresh notification page if currently open
    if (document.getElementById('page-student-notifications')?.classList.contains('active')) {
      loadStudentNotifications();
    }
  } catch (e) {
    errEl.textContent = e.message;
    errEl.style.display = 'flex';
  }
}

function previewStudentPhoto(input) {
  const file = input.files && input.files[0];
  const img  = document.getElementById('st-photo-img');
  const wrap = document.getElementById('st-photo-img-wrap');
  const placeholder = document.getElementById('st-photo-placeholder');
  const data = document.getElementById('st-photo-data');
  const clearBtn = document.getElementById('st-photo-clear');
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async function(e) {
    const compressed = await compressImage(e.target.result, 600, 700, 0.72);
    img.src = compressed;
    img.style.display = 'block';
    img.style.transform = 'scale(1)';
    if (wrap) wrap.style.display = '';
    placeholder.style.display = 'none';
    data.value = compressed;
    clearBtn.style.display = '';
    const zoom = document.getElementById('st-photo-zoom');
    if (zoom) zoom.value = 100;
  };
  reader.readAsDataURL(file);
}

function clearStudentPhoto() {
  const img  = document.getElementById('st-photo-img');
  const wrap = document.getElementById('st-photo-img-wrap');
  img.src = ''; img.style.transform = 'scale(1)';
  if (wrap) wrap.style.display = 'none';
  document.getElementById('st-photo-placeholder').style.display = '';
  document.getElementById('st-photo-data').value = '';
  document.getElementById('st-photo-input').value = '';
  document.getElementById('st-photo-clear').style.display = 'none';
  const zoom = document.getElementById('st-photo-zoom');
  if (zoom) zoom.value = 100;
}

function stPreviewDoc(input, n) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async function(e) {
    const img = document.getElementById(`st-doc${n}-img`);
    const ph  = document.getElementById(`st-doc${n}-placeholder`);
    const dat = document.getElementById(`st-doc${n}-data`);
    const clr = document.getElementById(`st-doc${n}-clear`);
    if (file.type.startsWith('image/')) {
      const compressed = await compressImage(e.target.result, 900, 700, 0.72);
      img.src = compressed; img.style.display = ''; ph.style.display = 'none';
      dat.value = compressed;
    } else {
      img.style.display = 'none'; ph.style.display = '';
      ph.innerHTML = '&#128196;<br>PDF Attached';
      dat.value = e.target.result;
    }
    if (clr) clr.style.display = '';
  };
  reader.readAsDataURL(file);
}

function stClearDoc(n) {
  const img = document.getElementById(`st-doc${n}-img`);
  const ph  = document.getElementById(`st-doc${n}-placeholder`);
  const dat = document.getElementById(`st-doc${n}-data`);
  const clr = document.getElementById(`st-doc${n}-clear`);
  const inp = document.getElementById(`st-doc${n}-input`);
  img.src = ''; img.style.display = 'none';
  ph.innerHTML = `&#128196;<br>Document ${n}`; ph.style.display = '';
  dat.value = ''; if (inp) inp.value = '';
  if (clr) clr.style.display = 'none';
}

function stAppendDateRemark(e, ta) {
  if (e.key !== 'Enter' || e.shiftKey) return;
  e.preventDefault();
  const now = new Date();
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dateStr = `[${now.getDate()}-${months[now.getMonth()]}-${now.getFullYear()}]`;
  const pos = ta.selectionStart;
  const before = ta.value.substring(0, pos);
  const after  = ta.value.substring(ta.selectionEnd);
  // Append date at END of current line, then newline — next entry goes on new line
  const prefix = (before.length > 0 && !before.endsWith('\n')) ? ' ' : '';
  ta.value = before + prefix + dateStr + '\n' + after;
  const newPos = (before + prefix + dateStr + '\n').length;
  ta.selectionStart = ta.selectionEnd = newPos;
}

function stHandlePhotoDrop(event) {
  event.preventDefault();
  document.getElementById('st-photo-drop-area').style.borderColor = 'var(--border)';
  const file = event.dataTransfer.files[0];
  if (!file || !file.type.startsWith('image/')) { toast('Please drop an image file', true); return; }
  previewStudentPhoto({ files: [file] });
}

function stScalePhoto(val) {
  const img = document.getElementById('st-photo-img');
  if (img) img.style.transform = `scale(${val / 100})`;
}

function stRotatePhoto(deg) {
  const dataInput = document.getElementById('st-photo-data');
  const img = document.getElementById('st-photo-img');
  if (!dataInput.value) return;
  const canvas = document.createElement('canvas');
  const image = new Image();
  image.onload = () => {
    const rad = deg * Math.PI / 180;
    const sin = Math.abs(Math.sin(rad)), cos = Math.abs(Math.cos(rad));
    canvas.width  = image.height * sin + image.width  * cos;
    canvas.height = image.height * cos + image.width  * sin;
    const ctx = canvas.getContext('2d');
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(rad);
    ctx.drawImage(image, -image.width / 2, -image.height / 2);
    const newData = canvas.toDataURL('image/jpeg', 0.92);
    img.src = newData;
    dataInput.value = newData;
    document.getElementById('st-photo-zoom').value = 100;
    img.style.transform = 'scale(1)';
  };
  image.src = dataInput.value;
}

async function deleteStudent(id, name) {
  document.getElementById('confirm-message').innerHTML = `Are you sure you want to delete student <strong>${escapeHtml(name)}</strong>?`;
  document.getElementById('confirm-btn').onclick = async () => {
    try {
      await api(API.students, 'DELETE', { id });
      closeModal('confirm-modal-overlay');
      toast('Student deleted');
      loadStudents();
    } catch (e) { toast(e.message, 'error'); }
  };
  openModal('confirm-modal-overlay');
}

async function confirmStudentRegistration(id) {
  const s = _studentsCache.find(x => x.id === id);
  const name = s ? ((s.first_name||'') + ' ' + (s.last_name||'')).trim() || s.student_name : `#${id}`;
  document.getElementById('confirm-message').innerHTML = `Confirm registration for <strong>${escapeHtml(name)}</strong>? This will mark the enquiry as confirmed.`;
  document.getElementById('confirm-btn').textContent = 'Confirm';
  document.getElementById('confirm-btn').className = 'btn btn-success';
  document.getElementById('confirm-btn').onclick = async () => {
    try {
      await api(`${API.students}?action=confirm`, 'POST', { id });
      closeModal('confirm-modal-overlay');
      document.getElementById('confirm-btn').className = 'btn btn-danger';
      document.getElementById('confirm-btn').textContent = 'Delete';
      toast('Registration confirmed', 'success');
      loadStudents();
    } catch (e) { toast(e.message, 'error'); }
  };
  openModal('confirm-modal-overlay');
}

let _dlStudentId = null;

function toggleStudentDownloadMenu(event, id) {
  event.stopPropagation();
  _dlStudentId = id;
  const menu = document.getElementById('student-dl-menu');
  const btn  = event.currentTarget;
  const rect = btn.getBoundingClientRect();
  menu.style.top  = (rect.bottom + 6) + 'px';
  menu.style.left = Math.max(4, rect.right - 170) + 'px';
  menu.classList.toggle('open');
}
document.addEventListener('click', () => {
  const m = document.getElementById('student-dl-menu');
  if (m) m.classList.remove('open');
});

function _getStudentForDownload(id) {
  // Try cache first (loose equality handles string/number mismatch)
  const s = _studentsCache.find(x => x.id == id);
  return s || null;
}

function studentDownloadPDF() {
  document.getElementById('student-dl-menu').classList.remove('open');
  downloadStudentForm(_dlStudentId, 'pdf');
}

function studentDownloadExcel() {
  document.getElementById('student-dl-menu').classList.remove('open');
  downloadStudentForm(_dlStudentId, 'excel');
}

// ===== BULK DOWNLOAD MENU (top of students page) =====
function toggleBulkDownloadMenu(event) {
  event.stopPropagation();
  const menu = document.getElementById('st-bulk-dl-menu');
  const btn  = event.currentTarget;
  const rect = btn.getBoundingClientRect();
  menu.style.top  = (rect.bottom + 6) + 'px';
  menu.style.left = Math.max(4, rect.right - 200) + 'px';
  menu.classList.toggle('open');
}
document.addEventListener('click', () => {
  const m = document.getElementById('st-bulk-dl-menu');
  if (m) m.classList.remove('open');
});
function bulkDownloadPDF(orientation) {
  document.getElementById('st-bulk-dl-menu').classList.remove('open');
  exportStudentsPDF(_currentStudentsList, orientation);
}
function bulkDownloadExcel() {
  document.getElementById('st-bulk-dl-menu').classList.remove('open');
  exportStudentsExcel(_currentStudentsList);
}

// Returns visible col keys (respects column filter checkboxes)
function getVisibleColKeys() {
  const saved = JSON.parse(localStorage.getItem('st-col-vis') || 'null') || {};
  const visible = ['col-sr'];
  _ST_COLS.forEach(c => {
    const on = (c.col in saved) ? saved[c.col] : c.def;
    if (on) visible.push(c.col);
  });
  return visible;
}

// Full column map: data-col key → { label, width, get }
function buildColDefs() {
  const calcAge = dob => {
    if (!dob) return '';
    const b = new Date(dob), now = new Date();
    let y = now.getFullYear() - b.getFullYear();
    if (now.getMonth() - b.getMonth() < 0 || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) y--;
    return y + ' yrs';
  };
  return {
    'col-sr':            { label: 'Sr #',                   w: 55,  get: r => r.sr_number || '' },
    'col-photo':         { label: 'Photo',                  w: 60,  get: r => r.photo ? '[Photo]' : '' },
    'col-reg-date':      { label: 'Registration Date',      w: 120, get: r => r.admission_date && r.admission_date !== '0000-00-00' ? r.admission_date : '' },
    'col-reg-no':        { label: 'GR #',                   w: 70,  get: r => r.gr_number || '' },
    'col-name':          { label: 'Student Name',           w: 180, get: r => ((r.first_name||'') + ' ' + (r.last_name||'')).trim() || r.student_name || '' },
    'col-class':         { label: 'Class',                  w: 160, get: r => { const c = classes.find(cc=>cc.id==r.class_id); return c?c.name:''; } },
    'col-dob':           { label: 'Date of Birth',          w: 110, get: r => r.date_of_birth || '' },
    'col-age':           { label: 'Current Age',            w: 90,  get: r => calcAge(r.date_of_birth) },
    'col-parent-name':   { label: 'Father / Guardian Name', w: 170, get: r => r.father_name || '' },
    'col-father-cnic':   { label: 'Father / Guardian CNIC', w: 160, get: r => r.father_cnic || '' },
    'col-parent-phone':  { label: 'Parent Phone',           w: 130, get: r => r.father_phone || r.guardian_phone || r.mother_phone || '' },
    'col-total-marks':   { label: 'Total Marks',            w: 100, get: r => r.total_test_marks || '' },
    'col-obtained-marks':{ label: 'Obtained Marks',         w: 100, get: r => r.total_obtained_marks || '' },
    'col-address':       { label: 'Address',                w: 210, get: r => r.student_address || '' },
    'col-status':        { label: 'Registration Status',    w: 120, get: r => r.registration_status || '' },
    'col-prev-school':   { label: 'Previous School',        w: 170, get: r => r.previous_school || '' },
    'col-remarks':       { label: 'Registration Remarks',   w: 180, get: r => r.registration_remarks || '' },
    'col-handler':       { label: 'Enquiry Handled By',     w: 140, get: r => r.referred_by || '' },
  };
}

// ===== PDF EXPORT (table view, visible cols + filtered records) =====
function exportStudentsPDF(list, orientation) {
  if (!list || !list.length) { toast('No students to export', 'error'); return; }
  const visKeys = getVisibleColKeys();
  const colMap  = buildColDefs();
  const cols    = visKeys.map(k => colMap[k]).filter(Boolean);
  function xe(v) { return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  const headerCells = cols.map(c => `<th>${xe(c.label)}</th>`).join('');
  const dataRows = list.map((r,i) => {
    const cells = cols.map(c => `<td>${xe(c.get(r))}</td>`).join('');
    return `<tr class="${i%2===0?'even':'odd'}">${cells}</tr>`;
  }).join('');

  const pdfHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <style>
    @page{size:${orientation==='landscape'?'landscape':'portrait'};margin:10mm}
    body{font-family:Arial,sans-serif;font-size:9px;color:#000;margin:0}
    h2{text-align:center;font-size:13px;margin:0 0 2px;letter-spacing:1px;color:#1a1a5e}
    .sub{text-align:center;font-size:9px;color:#555;margin-bottom:10px}
    table{width:100%;border-collapse:collapse;font-size:9px}
    th{background:#1a1a5e;color:#fff;padding:5px 7px;border:1px solid #3a3a8e;white-space:nowrap;text-align:center;font-size:9px}
    td{padding:4px 7px;border:1px solid #ccc;white-space:nowrap;vertical-align:middle}
    tr.even td{background:#eef4ff}
    tr.odd  td{background:#f8fbff}
    @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style></head><body>
  <h2>Institute of Dynamic Learning — Students Register</h2>
  <div class="sub">Total Records: ${list.length}</div>
  <table><thead><tr>${headerCells}</tr></thead><tbody>${dataRows}</tbody></table>
  <script>window.onload=()=>{setTimeout(()=>window.print(),400)}<\/script>
  </body></html>`;

  const w = window.open('', '_blank', 'width=1100,height=750');
  if (w) { w.document.write(pdfHtml); w.document.close(); }
  else toast('Please allow popups to print', 'error');
}

// ===== BEAUTIFUL EXCEL EXPORT — visible columns only =====
function exportStudentsExcel(list) {
  if (!list || !list.length) { toast('No students to export', 'error'); return; }
  const visKeys = getVisibleColKeys();
  const colMap  = buildColDefs();
  const cols    = visKeys.map(k => colMap[k]).filter(Boolean);

  function x(v) {
    return String(v == null ? '' : v)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  const colStyles = cols.map(c =>
    `<col style="width:${c.w}px;mso-width-source:userset;mso-width-alt:${Math.round(c.w*36.57)}">`
  ).join('');

  const headerCells = cols.map(c =>
    `<th style="background:#b8d0f0;color:#0d2a5e;font-weight:700;font-size:14pt;font-family:Calibri,Arial,sans-serif;padding:9px 12px;border:1px solid #7a9fd4;white-space:nowrap;text-align:center;vertical-align:middle">${x(c.label)}</th>`
  ).join('');

  const dataRows = list.map((row, i) => {
    const bg    = i % 2 === 0 ? '#eef4ff' : '#f8fbff';
    const cells = cols.map(c => {
      const val = c.get(row);
      return `<td style="background:${bg};color:#1a1a2e;font-size:12pt;font-family:Calibri,Arial,sans-serif;padding:7px 10px;border:1px solid #c8d8f0;white-space:nowrap;vertical-align:middle">${x(val)}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  const now = new Date();
  const dateStr = `${now.getDate().toString().padStart(2,'0')}-${(now.getMonth()+1).toString().padStart(2,'0')}-${now.getFullYear()}`;

  const xlsHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8">
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>Students</x:Name><x:WorksheetOptions><x:Selected/><x:FreezePanes/><x:FrozenNoSplit/>
<x:SplitHorizontal>2</x:SplitHorizontal><x:TopRowBottomPane>2</x:TopRowBottomPane>
<x:ActivePane>2</x:ActivePane></x:WorksheetOptions></x:ExcelWorksheet>
</x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
<style>
  body { font-family: Calibri, Arial, sans-serif; }
  table { border-collapse: collapse; }
</style>
</head><body>
<table>
  <thead>
    <tr>
      <th colspan="${cols.length}" style="background:#dce8ff;color:#1a1a5e;font-size:14pt;font-weight:700;font-family:Calibri,Arial,sans-serif;padding:12px 16px;border:2px solid #7a9fd4;text-align:center;letter-spacing:1px">
        Institute of Dynamic Learning — Students Register
      </th>
    </tr>
    <tr>${headerCells}</tr>
  </thead>
  <tbody>${dataRows}</tbody>
</table>
</body></html>`;

  const blob = new Blob(['\uFEFF' + xlsHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  const fname = list.length === 1
    ? `Student_${(((list[0].first_name||'')+(list[0].last_name?'_'+list[0].last_name:'')).trim()||list[0].gr_number||list[0].id).toString().replace(/[^a-zA-Z0-9]/g,'_')}_${dateStr}.xls`
    : `IDL_Students_Register_${dateStr}.xls`;
  a.download = fname;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadStudentForm(id, mode) {
  const s = _getStudentForDownload(id);
  if (!s) { toast('Student data not found — please refresh the page', 'error'); return; }
  const cls = classes.find(c => c.id == s.class_id);
  const name = ((s.first_name||'') + ' ' + (s.last_name||'')).trim() || s.student_name || '—';
  const feeRows = [1,2,3,4].map(i => {
    const t = s[`fee_${i}_type`]; const a = s[`fee_${i}_amount`];
    return (t || a) ? `<tr><td>${escapeHtml(t||'')}</td><td style="text-align:right">Rs. ${a||0}</td></tr>` : '';
  }).join('');
  const totalFee = [1,2,3,4].reduce((sum,i) => sum + (parseFloat(s[`fee_${i}_amount`])||0), 0);
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Admission Enquiry — ${escapeHtml(name)}</title>
  <style>
    body{font-family:'Times New Roman',Times,serif;font-size:13px;color:#000;margin:0;padding:0}
    .page{width:210mm;min-height:297mm;margin:0 auto;padding:15mm 18mm;box-sizing:border-box}
    h1{text-align:center;font-size:18px;margin:0 0 4px;text-transform:uppercase;letter-spacing:2px}
    .subtitle{text-align:center;font-size:11px;color:#555;margin-bottom:16px;letter-spacing:1px}
    .gr-badge{text-align:center;margin-bottom:14px}
    .gr-badge span{background:#1a1a5e;color:#c9a84c;padding:4px 18px;border-radius:20px;font-weight:700;font-size:14px;letter-spacing:2px}
    .section-head{background:#1a1a5e;color:#fff;padding:5px 10px;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;margin:12px 0 0;border-radius:3px 3px 0 0}
    table.fields{width:100%;border-collapse:collapse;border:1px solid #ccc;border-top:none;margin-bottom:0}
    table.fields td{padding:5px 8px;border:1px solid #ddd;font-size:12px;vertical-align:top;width:25%}
    table.fields td.lbl{color:#555;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;background:#f8f8f8;width:18%}
    table.fields td.val{width:32%}
    table.fee{width:100%;border-collapse:collapse;border:1px solid #ccc;border-top:none}
    table.fee td,table.fee th{padding:5px 8px;border:1px solid #ddd;font-size:12px}
    table.fee th{background:#f0f0f0;font-weight:700;text-align:left;font-size:10.5px;text-transform:uppercase}
    table.fee .total{font-weight:700;background:#f8f4e8}
    .status{display:inline-block;padding:3px 12px;border-radius:12px;font-size:11px;font-weight:700}
    .status.confirmed{background:#d4edda;color:#155724;border:1px solid #c3e6cb}
    .status.pending{background:#fff3cd;color:#856404;border:1px solid #ffeeba}
    .photo-box{float:right;margin:-10px 0 10px 14px;width:80px;text-align:center}
    .photo-box img{width:80px;height:90px;object-fit:cover;border:2px solid #1a1a5e;border-radius:4px}
    @media print{@page{size:${mode==='pdf-landscape'?'landscape':'portrait'};margin:10mm}body{margin:0}}
  </style></head><body>
  <div class="page">
    <h1>Institute of Dynamic Learning</h1>
    <div class="subtitle">Admission Enquiry Form</div>
    <div class="gr-badge"><span>GR# ${escapeHtml(s.gr_number||'—')}</span>
    &nbsp;&nbsp;<span class="status ${s.registration_status==='confirmed'?'confirmed':'pending'}">${s.registration_status==='confirmed'?'✓ Confirmed':'⏳ Pending'}</span></div>
    ${s.photo ? `<div class="photo-box"><img src="${escapeHtml(s.photo)}" alt="Photo"></div>` : ''}

    <div class="section-head">Student's Data</div>
    <table class="fields"><tbody>
      <tr><td class="lbl">Name</td><td class="val" colspan="3"><strong>${escapeHtml(name)}</strong></td></tr>
      <tr><td class="lbl">Date of Birth</td><td class="val">${escapeHtml(s.date_of_birth||'—')}</td>
          <td class="lbl">Gender</td><td class="val">${escapeHtml(s.gender||'—')}</td></tr>
      <tr><td class="lbl">Admission In</td><td class="val">${escapeHtml(cls?cls.name:'—')}</td>
          <td class="lbl">Place of Birth</td><td class="val">${escapeHtml(s.place_of_birth||'—')}</td></tr>
      <tr><td class="lbl">Nationality</td><td class="val">${escapeHtml(s.nationality||'—')}</td>
          <td class="lbl">Religion</td><td class="val">${escapeHtml(s.religion||'—')}</td></tr>
      <tr><td class="lbl">Caste</td><td class="val">${escapeHtml(s.caste||'—')}</td>
          <td class="lbl">B-Form</td><td class="val">${escapeHtml(s.b_form||'—')}</td></tr>
      <tr><td class="lbl">Prev. School</td><td class="val">${escapeHtml(s.previous_school||'—')}</td>
          <td class="lbl">Student Mobile</td><td class="val">${escapeHtml(s.student_mobile||'—')}</td></tr>
      <tr><td class="lbl">Referred By</td><td class="val">${escapeHtml(s.referred_by||'—')}</td>
          <td class="lbl">Reg. Date</td><td class="val">${escapeHtml(s.created_at?s.created_at.substring(0,10):'—')}</td></tr>
      ${s.registration_remarks ? `<tr><td class="lbl">Remarks</td><td class="val" colspan="3">${escapeHtml(s.registration_remarks)}</td></tr>` : ''}
    </tbody></table>

    <div class="section-head">Parent's / Guardian's Data</div>
    <table class="fields"><tbody>
      <tr><td class="lbl">Name</td><td class="val">${escapeHtml(s.father_name||'—')}</td>
          <td class="lbl">Mobile</td><td class="val">${escapeHtml(s.father_phone||'—')}</td></tr>
      <tr><td class="lbl">Profession</td><td class="val">${escapeHtml(s.father_occupation||'—')}</td>
          <td class="lbl">NIC</td><td class="val">${escapeHtml(s.father_cnic||'—')}</td></tr>
      <tr><td class="lbl">Address</td><td class="val" colspan="3">${escapeHtml(s.student_address||'—')}</td></tr>
    </tbody></table>

    <div class="section-head">Mother's Data</div>
    <table class="fields"><tbody>
      <tr><td class="lbl">Name</td><td class="val">${escapeHtml(s.mother_name||'—')}</td>
          <td class="lbl">Mobile</td><td class="val">${escapeHtml(s.mother_phone||'—')}</td></tr>
      <tr><td class="lbl">Profession</td><td class="val">${escapeHtml(s.mother_profession||'—')}</td>
          <td class="lbl">NIC</td><td class="val">${escapeHtml(s.mother_nic||'—')}</td></tr>
    </tbody></table>

    ${feeRows ? `<div class="section-head">Student's Fee Information</div>
    <table class="fee"><thead><tr><th>Fee Type</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${feeRows}<tr class="total"><td>Total</td><td style="text-align:right">Rs. ${totalFee.toLocaleString()}</td></tr></tbody></table>` : ''}

    ${(s.test_date||s.test_for_class) ? `<div class="section-head">Entry Test Details</div>
    <table class="fields"><tbody>
      <tr><td class="lbl">Test Date</td><td class="val">${escapeHtml(s.test_date||'—')}</td>
          <td class="lbl">Test for Class</td><td class="val">${escapeHtml(s.test_for_class||'—')}</td></tr>
      <tr><td class="lbl">Total Marks</td><td class="val">${escapeHtml(s.total_test_marks||'—')}</td>
          <td class="lbl">Obtained Marks</td><td class="val">${escapeHtml(s.total_obtained_marks||'—')}</td></tr>
    </tbody></table>` : ''}

  </div>
  <script>window.onload=()=>{setTimeout(()=>window.print(),400)}<\/script>
  </body></html>`;

  if (mode === 'excel') {
    exportStudentsExcel([s]);
    return;
  }

  // PDF / Print
  const w = window.open('', '_blank', 'width=900,height=700');
  if (w) { w.document.write(html); w.document.close(); }
  else toast('Please allow popups to print the form', 'error');
}

// ===== STUDENT PROFILE =====
async function viewStudentProfile(id) {
  showPage('student-profile');
  const body = document.getElementById('student-profile-body');
  body.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:28px">Loading…</p>';
  try {
    const student = await api(`${API.students}?id=${id}`);
    const cls = classes.find(c => c.id == student.class_id);
    document.getElementById('student-profile-title').textContent = ((student.first_name||'') + ' ' + (student.last_name||'')).trim() || '—';

    let html = '';
    // Helper to show missing fields in red
    function missingField(label) {
      return `<span style=\"color:#e74c3c;font-weight:600\">${label}</span>`;
    }
    // Student Info Card
    html += `<div class="card"><div class="card-title">📋 Student Information</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;font-size:0.88rem">`;
    const infoFields = [
      ['Class', cls ? cls.name : missingField('Class')],
      ['Date of Birth', student.date_of_birth || missingField('Date of Birth')],
      ['Gender', student.gender || missingField('Gender')],
      ['Religion', student.religion || missingField('Religion')],
      ['Place of Birth', student.place_of_birth || missingField('Place of Birth')],
      ['Nationality', student.nationality || missingField('Nationality')],
      ['NIC / Passport', student.nic_passport || missingField('NIC / Passport')],
      ['Admission Date', student.admission_date || missingField('Admission Date')],
      ['Registration No', student.registration_no || missingField('Registration No')],
      ['Blood Group', student.blood_group || missingField('Blood Group')],
      ['Physical Handicap', student.physical_handicap || missingField('Physical Handicap')],
      ['Previous School', student.previous_school || missingField('Previous School')],
    ];
    infoFields.forEach(([label, val]) => { html += `<div><span style="color:var(--text-muted)">${label}:</span> <strong>${typeof val === 'string' ? val : escapeHtml(val)}</strong></div>`; });
    html += '</div></div>';

    // Contact Card
    html += `<div class="card"><div class="card-title">📞 Contact Numbers</div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:0.88rem">`;
    html += `<div><span style="color:var(--text-muted)">Mother's Phone:</span><br><strong>${student.mother_phone ? escapeHtml(student.mother_phone) : missingField('Mother\'s Phone')}</strong></div>`;
    html += `<div><span style="color:var(--text-muted)">Guardian's Phone:</span><br><strong>${student.guardian_phone ? escapeHtml(student.guardian_phone) : missingField('Guardian\'s Phone')}</strong></div>`;
    html += `<div><span style="color:var(--text-muted)">Emergency Contact:</span><br><strong>${student.emergency_contact ? escapeHtml(student.emergency_contact) : missingField('Emergency Contact')}</strong></div>`;
    html += '</div></div>';

    // Father / Guardian Card
    html += `<div class="card"><div class="card-title">👨 Father / Guardian Details</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;font-size:0.88rem">`;
    const fatherFields = [
      ['Father Name', student.father_name ? escapeHtml(student.father_name) : missingField('Father Name')],
      ['CNIC', student.father_cnic ? escapeHtml(student.father_cnic) : missingField('Father CNIC')],
      ['Phone', student.father_phone ? escapeHtml(student.father_phone) : missingField('Father Phone')],
      ['Occupation', student.father_occupation ? escapeHtml(student.father_occupation) : missingField('Occupation')],
      ['Designation', student.father_designation ? escapeHtml(student.father_designation) : missingField('Designation')],
      ['Email', student.father_email ? escapeHtml(student.father_email) : missingField('Father Email')],
      ['Address', student.father_address ? escapeHtml(student.father_address) : missingField('Father Address')],
      ['Relationship', student.father_relationship ? escapeHtml(student.father_relationship) : missingField('Relationship')],
    ];
    fatherFields.forEach(([label, val]) => { html += `<div><span style=\"color:var(--text-muted)\">${label}:</span> <strong>${val}</strong></div>`; });
    html += '</div></div>';

    // Siblings Card
    html += `<div class="card"><div class="card-title">👨‍👩‍👧‍👦 Siblings (same Father CNIC)</div><div id="student-siblings-body"><p style="color:var(--text-muted)">Loading…</p></div></div>`;

    // Comments Card (admin only)
    if (currentUser.role === 'admin' || currentUser.role === 'superadmin') {
      html += `<div class="card"><div class="card-title">💬 Comments</div>`;
      html += `<div style="display:flex;gap:8px;margin-bottom:12px"><input type="text" id="student-comment-input" placeholder="Add a comment…" style="flex:1"> <button class="btn btn-primary btn-sm" onclick="addStudentComment(${student.id})">Add</button></div>`;
      html += `<div id="student-comments-body"><p style="color:var(--text-muted)">Loading…</p></div></div>`;
    }

    body.innerHTML = html;

    // Load siblings
    loadStudentSiblings(student.father_cnic, student.id);
    // Load comments
    if (currentUser.role === 'admin' || currentUser.role === 'superadmin') {
      loadStudentComments(student.id);
    }
  } catch (e) {
    body.innerHTML = `<div class="alert alert-error">${escapeHtml(e.message)}</div>`;
  }
}

async function loadStudentSiblings(fatherCnic, currentStudentId) {
  const container = document.getElementById('student-siblings-body');
  try {
    const siblings = await api(`${API.students}?action=siblings&father_cnic=${encodeURIComponent(fatherCnic)}`);
    const others = siblings.filter(s => s.id != currentStudentId);
    if (!others.length) { container.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem">No siblings found.</p>'; return; }
    container.innerHTML = others.map(s => {
      const cls = classes.find(c => c.id == s.class_id);
      return `<div style="display:flex;align-items:center;gap:12px;padding:6px 0;border-bottom:1px solid var(--border)">
        <span style="font-weight:600">${escapeHtml(((s.first_name||'') + ' ' + (s.last_name||'')).trim())}</span>
        <span class="badge badge-blue">${s.class_name ? escapeHtml(s.class_name) : (cls ? escapeHtml(cls.name) : '—')}</span>
        <button class="btn btn-secondary btn-sm" onclick="viewStudentProfile(${s.id})" style="margin-left:auto">View</button>
      </div>`;
    }).join('');
  } catch { container.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem">Could not load siblings.</p>'; }
}

async function loadStudentComments(studentId) {
  const container = document.getElementById('student-comments-body');
  try {
    const comments = await api(`${API.students}?action=comments&student_id=${studentId}`);
    if (!comments.length) { container.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem">No comments yet.</p>'; return; }
    container.innerHTML = comments.map(c => `<div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:0.88rem">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div><strong>${escapeHtml(c.author_username)}</strong> <span class="badge badge-purple" style="font-size:0.7rem">${escapeHtml(c.author_role)}</span></div>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="color:var(--text-muted);font-size:0.75rem">${new Date(c.created_at).toLocaleString()}</span>
          <button class="btn btn-danger btn-sm" onclick="deleteStudentComment(${c.id},${studentId})" title="Delete" style="padding:2px 6px;font-size:0.7rem">✕</button>
        </div>
      </div>
      <div style="margin-top:4px;color:var(--text)">${escapeHtml(c.comment)}</div>
    </div>`).join('');
  } catch { container.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem">Could not load comments.</p>'; }
}

async function addStudentComment(studentId) {
  const input = document.getElementById('student-comment-input');
  const comment = input.value.trim();
  if (!comment) return;
  try {
    await api(`${API.students}?action=comments`, 'POST', { student_id: studentId, comment });
    input.value = '';
    loadStudentComments(studentId);
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteStudentComment(commentId, studentId) {
  try {
    await api(`${API.students}?action=comments`, 'DELETE', { id: commentId });
    loadStudentComments(studentId);
  } catch (e) { toast(e.message, 'error'); }
}

// ===== STUDENT SCHEDULE (student role) =====
async function loadStudentSchedule() {
  const body = document.getElementById('student-schedule-body');
  body.innerHTML = '<div class="card"><p style="color:var(--text-muted);text-align:center;padding:28px">Loading…</p></div>';
  await loadAllData();
  try {
    const data = await api(`${API.students}?action=my_schedule`);
    const subtitle = document.getElementById('student-schedule-subtitle');
    if (data.student) subtitle.textContent = `${((data.student.first_name||'') + ' ' + (data.student.last_name||'')).trim()} — ${data.class_name || 'No class assigned'}`;

    if (!data.slots || !data.slots.length) {
      body.innerHTML = '<div class="card"><p style="color:var(--text-muted);text-align:center;padding:28px">No schedule found for your class.</p></div>';
      return;
    }
    body.innerHTML = renderScheduleTable(data.slots);
  } catch (e) {
    body.innerHTML = `<div class="alert alert-error">${escapeHtml(e.message)}</div>`;
  }
}

function getParentSchedTitle() {
  return document.getElementById('parent-schedule-subtitle')?.textContent?.trim() || 'Child Schedule';
}
function getParentSchedFilename() {
  const t = getParentSchedTitle().replace(/[^a-zA-Z0-9\s\-]/g, '').replace(/\s+/g, '_');
  return t || 'Child_Schedule';
}

// ===== PARENT SCHEDULE (parent role) =====
async function loadParentSchedule() {
  const body = document.getElementById('parent-schedule-body');
  const selector = document.getElementById('parent-children-selector');
  body.innerHTML = '<div class="card"><p style="color:var(--text-muted);text-align:center;padding:28px">Loading…</p></div>';
  await loadAllData();
  try {
    const data = await api(`${API.students}?action=my_children`);
    if (!data.children || !data.children.length) {
      body.innerHTML = '<div class="card"><p style="color:var(--text-muted);text-align:center;padding:28px">No children linked to your account.</p></div>';
      selector.style.display = 'none';
      return;
    }

    // Populate child selector
    const select = document.getElementById('parent-child-select');
    select.innerHTML = data.children.map(c => {
      const cls = classes.find(cl => cl.id == c.class_id);
      return `<option value="${c.id}">${escapeHtml(((c.first_name||'') + ' ' + (c.last_name||'')).trim())}${cls ? ' — ' + escapeHtml(cls.name) : (c.class_name ? ' — ' + escapeHtml(c.class_name) : '')}</option>`;
    }).join('');
    selector.style.display = '';

    // Load schedule for first child
    loadParentChildSchedule();
  } catch (e) {
    body.innerHTML = `<div class="alert alert-error">${escapeHtml(e.message)}</div>`;
  }
}

let _parentScheduleSlots = [];

async function loadParentChildSchedule() {
  const body = document.getElementById('parent-schedule-body');
  const childId = document.getElementById('parent-child-select').value;
  if (!childId) return;
  body.innerHTML = '<div class="card"><p style="color:var(--text-muted);text-align:center;padding:28px">Loading…</p></div>';
  _parentScheduleSlots = [];
  try {
    const data = await api(`${API.students}?action=my_schedule&child_id=${childId}`);
    if (!data.slots || !data.slots.length) {
      body.innerHTML = '<div class="card"><p style="color:var(--text-muted);text-align:center;padding:28px">No schedule found for this class.</p></div>';
      return;
    }
    const subtitle = document.getElementById('parent-schedule-subtitle');
    subtitle.textContent = `${((data.student?.first_name||'') + ' ' + (data.student?.last_name||'')).trim()} — ${data.class_name || ''}`;
    _parentScheduleSlots = data.slots;
    applyParentScheduleFilter();
  } catch (e) {
    body.innerHTML = `<div class="alert alert-error">${escapeHtml(e.message)}</div>`;
  }
}

function applyParentScheduleFilter() {
  const body = document.getElementById('parent-schedule-body');
  if (!body) return;
  const selectedDays = [...document.querySelectorAll('.ps-day-cb:checked')].map(cb => cb.value);
  const subjectQ = (document.getElementById('ps-subject-filter')?.value || '').toLowerCase().trim();

  const filtered = [];
  _parentScheduleSlots.forEach(s => {
    const slotDays = s.days ? s.days.split(',').map(d => d.trim()) : [];
    const matchingDays = slotDays.filter(d => selectedDays.includes(d));
    if (!matchingDays.length) return;
    if (!s.is_break && subjectQ && !(s.subject || '').toLowerCase().includes(subjectQ)) return;
    filtered.push({ ...s, days: matchingDays.join(', ') });
  });

  body.innerHTML = renderScheduleTable(filtered);
}

// Shared: render a timetable grid from slots array
function renderScheduleTable(slots) {
  if (!slots.length) return '<div class="card"><p style="color:var(--text-muted);text-align:center;padding:28px">No schedule found.</p></div>';

  // Sort by day order then start_time
  const dayRank = {Monday:0,Tuesday:1,Wednesday:2,Thursday:3,Friday:4,Saturday:5};
  slots.sort((a,b) => {
    const aD = dayRank[a.days?.split(',')[0]?.trim()] ?? 99;
    const bD = dayRank[b.days?.split(',')[0]?.trim()] ?? 99;
    return aD !== bD ? aD - bD : (a.start_time||'').localeCompare(b.start_time||'');
  });

  let html = '<div class="card"><div class="table-wrap"><table><thead><tr><th>Subject</th><th>Teacher</th><th>Days</th><th>Time</th></tr></thead><tbody id="sched-table-body">';
  slots.forEach(s => {
    if (s.is_break) {
      html += `<tr class="break-row"><td colspan="2"><span class="break-label">☕ BREAK</span></td><td>${formatDays(s.days)}</td><td>${formatTime(s.start_time)} – ${formatTime(s.end_time)}</td></tr>`;
      return;
    }
    const ids = (s.teacher_ids ? s.teacher_ids.split(',') : [String(s.teacher_id)]).filter(Boolean);
    const teacherLabel = ids.map(tid => { const t = teachers.find(x => String(x.id) === String(tid)); return t ? `${normalizeTitle(t.title)} ${t.name}` : ''; }).filter(Boolean).join(', ');
    html += `<tr><td><strong>${escapeHtml(s.subject || '')}</strong></td><td><span class="badge badge-gold">${escapeHtml(teacherLabel || '—')}</span></td><td>${formatDays(s.days)}</td><td>${formatTime(s.start_time)} – ${formatTime(s.end_time)}</td></tr>`;
  });
  html += '</tbody></table></div></div>';
  return html;
}

// ===== INIT =====
// ===== ASSIGN CLASS MODAL =====
function openAssignClassModal(studentId) {
  const student = _studentsCache.find(s => s.id === studentId);
  if (!student) return toast('Student not found', 'error');
  const select = document.getElementById('assign-class-select');
  select.innerHTML = classes.map(c => `<option value="${c.id}"${c.id == student.class_id ? ' selected' : ''}>${escapeHtml(c.name)}</option>`).join('');
  document.getElementById('assign-class-student-name').textContent = ((student.first_name||'') + ' ' + (student.last_name||'')).trim();
  document.getElementById('assign-class-student-id').value = student.id;
  document.getElementById('assign-class-modal-error').style.display = 'none';
  openModal('assign-class-modal-overlay');
}

async function saveAssignClass() {
  const errEl = document.getElementById('assign-class-modal-error');
  errEl.style.display = 'none';
  const studentId = document.getElementById('assign-class-student-id').value;
  const classId = document.getElementById('assign-class-select').value;
  if (!classId) {
    errEl.textContent = 'Please select a class.';
    errEl.style.display = 'flex';
    return;
  }
  try {
    await api(API.students, 'PUT', { id: studentId, class_id: classId });
    closeModal('assign-class-modal-overlay');
    loadStudents();
    toast('Class assigned successfully');
  } catch (e) {
    errEl.textContent = e.message;
    errEl.style.display = 'flex';
  }
}

function closeAssignClassModal() {
  closeModal('assign-class-modal-overlay');
}

