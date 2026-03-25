// ===== TEACHER COLUMN FILTER =====
const _TM_COLS = [
  { col: 'col-tm-photo',       label: 'Photo',           def: true  },
  { col: 'col-tm-title',       label: 'Title',           def: true  },
  { col: 'col-tm-name',        label: 'Name',            def: true  },
  { col: 'col-tm-designation', label: 'Designation',     def: false },
  { col: 'col-tm-phone',       label: 'Phone',           def: true  },
  { col: 'col-tm-employment',  label: 'Employment Type', def: false },
  { col: 'col-tm-joining',     label: 'Joining Date',    def: false },
  { col: 'col-tm-added',       label: 'Added',           def: true  },
];

function initTeacherColFilter() {
  const wrap = document.getElementById('tm-col-checkboxes');
  if (!wrap) return;
  const saved = JSON.parse(localStorage.getItem('tm-col-vis') || 'null') || {};
  wrap.innerHTML = _TM_COLS.map(c => {
    const checked = (c.col in saved) ? saved[c.col] : c.def;
    return `<label style="display:flex;align-items:center;gap:5px;font-size:0.82rem;cursor:pointer;color:var(--text-muted)">
      <input type="checkbox" ${checked?'checked':''} data-col="${c.col}" onchange="saveTeacherColPrefs();applyTeacherColFilter()" style="accent-color:var(--accent)">
      ${c.label}
    </label>`;
  }).join('');
  applyTeacherColFilter();
}

function saveTeacherColPrefs() {
  const prefs = {};
  document.querySelectorAll('#tm-col-checkboxes input[data-col]').forEach(cb => {
    prefs[cb.dataset.col] = cb.checked;
  });
  localStorage.setItem('tm-col-vis', JSON.stringify(prefs));
}

function applyTeacherColFilter() {
  const table = document.getElementById('teachers-table');
  if (!table) return;
  const checkboxes = document.querySelectorAll('#tm-col-checkboxes input[data-col]');
  if (!checkboxes.length) return;
  const vis = {};
  checkboxes.forEach(cb => { vis[cb.dataset.col] = cb.checked; });
  vis['col-tm-name']    = true;
  vis['col-tm-actions'] = true;
  table.querySelectorAll('[data-col]').forEach(el => {
    const col = el.dataset.col;
    if (col in vis) el.style.display = vis[col] ? '' : 'none';
  });
}

function toggleTeacherFilterPanel() {
  const body  = document.getElementById('tm-col-filter-body');
  const caret = document.getElementById('tm-filter-caret');
  if (!body) return;
  const open = body.style.display === 'none';
  body.style.display = open ? '' : 'none';
  if (caret) caret.style.transform = open ? 'rotate(180deg)' : '';
  if (open) {
    const wrap = document.getElementById('tm-col-checkboxes');
    if (wrap) wrap.dataset.built = '';
    initTeacherColFilter();
  }
}

function setAllTeacherCols(val) {
  document.querySelectorAll('#tm-col-checkboxes input[data-col]').forEach(cb => { cb.checked = val; });
  saveTeacherColPrefs();
  applyTeacherColFilter();
}

// ===== BREAK MODE TOGGLE =====
function toggleBreakMode() {
  const cb = document.getElementById('tt-is-break');
  const isBreak = cb.checked;
  document.getElementById('tt-non-break-fields').style.display = isBreak ? 'none' : '';
  document.getElementById('tt-break-class-field').style.display = isBreak ? '' : 'none';
  if (isBreak) {
    document.getElementById('tt-subject').value = '';
    // Clear teacher selection
    const tSel = document.getElementById('tt-teacher');
    Array.from(tSel.options).forEach(o => o.selected = false);
  }
}

// ===== TEACHER CRUD =====
function tmClearForm() {
  ['teacher-id','teacher-name','tm-relationship-name','tm-designation','tm-religion',
   'tm-joining-date','tm-nic','tm-work-experience','tm-qualification','tm-phone',
   'tm-whatsapp','tm-email','tm-dob','tm-place-of-birth','tm-address',
   'tm-starting-salary','tm-current-salary','tm-per-lecture','tm-bank-name','tm-bank-account','tm-notes',
   'tm-photo-data','tm-cnic-front-data','tm-cnic-back-data'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  ['tm-gender','tm-marital-status','tm-blood-group'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('tm-role').value = 'Teacher';
  document.getElementById('tm-employment-type').value = 'Permanent';
  document.getElementById('title-sir').checked = true;
  const acctRadio = document.querySelector('input[name="tm-bank-account-type"][value="account"]');
  if (acctRadio) { acctRadio.checked = true; tmToggleBankLabel(); }
  // Reset photo previews
  ['tm-photo','tm-cnic-front','tm-cnic-back'].forEach(prefix => {
    const img  = document.getElementById(prefix+'-img');
    const wrap = document.getElementById(prefix+'-img-wrap');
    const ph   = document.getElementById(prefix+'-placeholder');
    const clr  = document.getElementById(prefix+'-clear');
    const inp  = document.getElementById(prefix+'-input');
    if (img)  { img.src = ''; img.style.display = 'none'; }
    if (wrap) wrap.style.display = 'none';
    if (ph)   ph.style.display = '';
    if (clr)  clr.style.display = 'none';
    if (inp)  inp.value = '';
  });
}

function tmToggleBankLabel() {
  const type = document.querySelector('input[name="tm-bank-account-type"]:checked')?.value || 'account';
  const lbl  = document.getElementById('tm-bank-account-label');
  const inp  = document.getElementById('tm-bank-account');
  if (lbl) lbl.textContent = type === 'iban' ? 'IBAN' : 'Account No.';
  if (inp) inp.placeholder = type === 'iban' ? 'PK00XXXX0000000000000000' : 'Account number';
}

// ===== TEACHER FORM DRAFT (auto-save) =====
const TM_DRAFT_KEY = 'tm_form_draft';

function tmSaveDraft() {
  // Only save draft for new teachers (no id set)
  if (document.getElementById('teacher-id').value) return;
  const titleEl = document.querySelector('input[name="teacher-title"]:checked');
  const draft = {
    title:            titleEl ? titleEl.value : 'Sir',
    name:             document.getElementById('teacher-name').value,
    relationship_name:document.getElementById('tm-relationship-name').value,
    designation:      document.getElementById('tm-designation').value,
    religion:         document.getElementById('tm-religion').value,
    gender:           document.getElementById('tm-gender').value,
    joining_date:     document.getElementById('tm-joining-date').value,
    nic:              document.getElementById('tm-nic').value,
    employment_type:  document.getElementById('tm-employment-type').value,
    per_lecture:      document.getElementById('tm-per-lecture').value,
    role:             document.getElementById('tm-role').value,
    work_experience:  document.getElementById('tm-work-experience').value,
    qualification:    document.getElementById('tm-qualification').value,
    marital_status:   document.getElementById('tm-marital-status').value,
    phone:            document.getElementById('tm-phone').value,
    whatsapp:         document.getElementById('tm-whatsapp').value,
    blood_group:      document.getElementById('tm-blood-group').value,
    email:            document.getElementById('tm-email').value,
    dob:              document.getElementById('tm-dob').value,
    place_of_birth:   document.getElementById('tm-place-of-birth').value,
    address:          document.getElementById('tm-address').value,
    starting_salary:  document.getElementById('tm-starting-salary').value,
    current_salary:   document.getElementById('tm-current-salary').value,
    bank_name:        document.getElementById('tm-bank-name').value,
    bank_account_type:document.querySelector('input[name="tm-bank-account-type"]:checked')?.value || 'account',
    bank_account:     document.getElementById('tm-bank-account').value,
    notes:            document.getElementById('tm-notes').value,
    photo:            document.getElementById('tm-photo-data').value,
    cnic_front:       document.getElementById('tm-cnic-front-data').value,
    cnic_back:        document.getElementById('tm-cnic-back-data').value,
  };
  try {
    localStorage.setItem(TM_DRAFT_KEY, JSON.stringify(draft));
  } catch (e) {
    // If storage is full (e.g., large images), save without images
    const draftNoImages = { ...draft };
    delete draftNoImages.photo;
    delete draftNoImages.cnic_front;
    delete draftNoImages.cnic_back;
    try {
      localStorage.setItem(TM_DRAFT_KEY, JSON.stringify(draftNoImages));
    } catch (e2) {
      // If still fails, don't save
    }
  }
}

function tmRestoreDraft() {
  let draft;
  try { draft = JSON.parse(localStorage.getItem(TM_DRAFT_KEY)); } catch(e) {}
  if (!draft) return;
  // Check if there's any meaningful content worth restoring
  const hasContent = draft.name || draft.phone || draft.nic || draft.designation;
  if (!hasContent) return;
  // Restore text/select fields
  const fieldMap = {
    'teacher-name': draft.name, 'tm-relationship-name': draft.relationship_name,
    'tm-designation': draft.designation, 'tm-religion': draft.religion,
    'tm-joining-date': draft.joining_date, 'tm-nic': draft.nic,
    'tm-employment-type': draft.employment_type, 'tm-per-lecture': draft.per_lecture,
    'tm-role': draft.role, 'tm-work-experience': draft.work_experience,
    'tm-qualification': draft.qualification, 'tm-marital-status': draft.marital_status,
    'tm-phone': draft.phone, 'tm-whatsapp': draft.whatsapp,
    'tm-blood-group': draft.blood_group, 'tm-email': draft.email,
    'tm-dob': draft.dob, 'tm-place-of-birth': draft.place_of_birth,
    'tm-address': draft.address, 'tm-starting-salary': draft.starting_salary,
    'tm-current-salary': draft.current_salary, 'tm-bank-name': draft.bank_name, 'tm-bank-account': draft.bank_account,
    'tm-notes': draft.notes, 'tm-gender': draft.gender,
  };
  Object.entries(fieldMap).forEach(([id, val]) => {
    const el = document.getElementById(id); if (el && val) el.value = val;
  });
  // Restore title radio
  const titleMap = {'Sir':'title-sir','Ms.':'title-ms'};
  const titleId = titleMap[draft.title];
  if (titleId) document.getElementById(titleId).checked = true;
  // Restore bank account type radio
  if (draft.bank_account_type) {
    const r = document.querySelector(`input[name="tm-bank-account-type"][value="${draft.bank_account_type}"]`);
    if (r) { r.checked = true; tmToggleBankLabel(); }
  }
  // Restore images
  ['photo','cnic_front','cnic_back'].forEach(key => {
    const prefix = key === 'photo' ? 'tm-photo' : 'tm-'+key.replace('_','-');
    const data = draft[key];
    if (data) {
      const img = document.getElementById(prefix+'-img');
      const ph  = document.getElementById(prefix+'-placeholder');
      const clr = document.getElementById(prefix+'-clear');
      const dataEl = document.getElementById(prefix+'-data');
      if (img) {
        img.src = data; img.style.display = 'block';
        img.style.width = '100%'; img.style.height = '100%';
        img.style.objectFit = 'contain'; img.style.objectPosition = 'center';
        if (key !== 'photo') { img.style.position = 'absolute'; img.style.top = '0'; img.style.left = '0'; }
        else { img.style.borderRadius = '8px'; }
      }
      if (ph)  ph.style.display = 'none';
      if (clr) clr.style.display = 'block';
      if (dataEl) dataEl.value = data;
    }
  });
  toast('Draft restored — your previous changes are back.', 'info');
}

function tmClearDraft() {
  try { localStorage.removeItem(TM_DRAFT_KEY); } catch(e) {}
}

function tmAttachDraftListeners() {
  // Auto-save draft on any input/change in the teacher modal
  const modal = document.getElementById('teacher-modal-overlay');
  if (!modal) return;
  modal.addEventListener('input', tmSaveDraft);
  modal.addEventListener('change', tmSaveDraft);
}

function tmPreviewImage(input, imgId, phId, dataId) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = async function(e) {
    // Photo: 600×700, CNIC scans: 900×600 — compress to keep under DB packet limit
    const isPhoto = imgId === 'tm-photo-img';
    const compressed = await compressImage(e.target.result, isPhoto ? 600 : 900, isPhoto ? 700 : 600, 0.72);
    const img = document.getElementById(imgId);
    const wrap = document.getElementById(imgId + '-wrap');
    if (img) { img.src = compressed; img.style.display = 'block'; img.style.transform = 'scale(1)'; }
    if (wrap) wrap.style.display = '';
    const ph = document.getElementById(phId);
    if (ph) ph.style.display = 'none';
    document.getElementById(dataId).value = compressed;
    const clearBtn = document.getElementById(imgId.replace('-img', '-clear'));
    if (clearBtn) clearBtn.style.display = '';
    const zoom = document.getElementById(imgId.replace('-img', '-zoom'));
    if (zoom) zoom.value = 100;
  };
  reader.readAsDataURL(file);
}

function tmClearImage(imgId, phId, dataId, inputId, clearBtnId) {
  const img = document.getElementById(imgId);
  const wrap = document.getElementById(imgId + '-wrap');
  if (img) { img.src = ''; img.style.transform = 'scale(1)'; }
  if (wrap) wrap.style.display = 'none';
  const ph = document.getElementById(phId);
  if (ph) ph.style.display = '';
  document.getElementById(dataId).value = '';
  const inp = document.getElementById(inputId);
  if (inp) inp.value = '';
  const clearBtn = document.getElementById(clearBtnId);
  if (clearBtn) clearBtn.style.display = 'none';
  const zoom = document.getElementById(imgId.replace('-img', '-zoom'));
  if (zoom) zoom.value = 100;
}

function tmHandlePhotoDrop(event) {
  event.preventDefault();
  document.getElementById('tm-photo-drop-area').style.borderColor = 'var(--border)';
  const file = event.dataTransfer.files[0];
  if (!file || !file.type.startsWith('image/')) { toast('Please drop an image file', true); return; }
  tmPreviewImage({ files: [file] }, 'tm-photo-img', 'tm-photo-placeholder', 'tm-photo-data');
}

function tmScalePhoto(val) {
  const img = document.getElementById('tm-photo-img');
  if (img && img.src) img.style.transform = `scale(${val / 100})`;
}

function tmRotatePhoto(deg) {
  const dataInput = document.getElementById('tm-photo-data');
  const img = document.getElementById('tm-photo-img');
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
    document.getElementById('tm-photo-zoom').value = 100;
    img.style.transform = 'scale(1)';
  };
  image.src = dataInput.value;
}

function tmFillForm(t) {
  // Fill the teacher form with data for editing
  document.getElementById('teacher-id').value = t.id || '';
  document.getElementById('teacher-name').value = t.name || '';
  document.getElementById('tm-relationship-name').value = t.relationship_name || '';
  document.getElementById('tm-designation').value = t.designation || '';
  document.getElementById('tm-religion').value = t.religion || '';
  document.getElementById('tm-joining-date').value = t.joining_date ? t.joining_date.substring(0,10) : '';
  document.getElementById('tm-nic').value = t.nic_number || '';
  document.getElementById('tm-employment-type').value = t.employment_type || 'Permanent';
  document.getElementById('tm-per-lecture').value = t.per_lecture_amount || '';
  document.getElementById('tm-role').value = t.role || 'Teacher';
  document.getElementById('tm-work-experience').value = t.work_experience || '';
  document.getElementById('tm-qualification').value = t.qualification || '';
  document.getElementById('tm-marital-status').value = t.marital_status || '';
  document.getElementById('tm-phone').value = t.phone || '';
  document.getElementById('tm-whatsapp').value = t.whatsapp || '';
  document.getElementById('tm-blood-group').value = t.blood_group || '';
  document.getElementById('tm-email').value = t.email || '';
  document.getElementById('tm-dob').value = t.date_of_birth ? t.date_of_birth.substring(0,10) : '';
  document.getElementById('tm-place-of-birth').value = t.place_of_birth || '';
  document.getElementById('tm-address').value = t.address || '';
  document.getElementById('tm-starting-salary').value = t.starting_salary || '';
  document.getElementById('tm-current-salary').value = t.current_salary || '';
  document.getElementById('tm-bank-name').value    = t.bank_name || '';
  document.getElementById('tm-bank-account').value = t.bank_account_no || '';
  const bankTypeRadio = document.querySelector(`input[name="tm-bank-account-type"][value="${t.bank_account_type || 'account'}"]`);
  if (bankTypeRadio) { bankTypeRadio.checked = true; tmToggleBankLabel(); }
  document.getElementById('tm-notes').value = t.notes || '';
  document.getElementById('tm-gender').value = t.gender || '';
  // title
  const titleVal = t.title || 'Sir';
  const titleMap = {'Sir':'title-sir','Ms.':'title-ms'};
  document.getElementById(titleMap[titleVal] || 'title-sir').checked = true;
  // photos
  document.getElementById('tm-photo-zoom').value = 100;
  if (t.photo) {
    const i = document.getElementById('tm-photo-img');
    const w = document.getElementById('tm-photo-img-wrap');
    i.src = t.photo; i.style.transform = 'scale(1)';
    if (w) w.style.display = '';
    document.getElementById('tm-photo-placeholder').style.display = 'none';
    document.getElementById('tm-photo-data').value = t.photo;
    document.getElementById('tm-photo-clear').style.display = '';
  }
  if (t.cnic_front) { 
    const i=document.getElementById('tm-cnic-front-img'); 
    i.src=t.cnic_front; 
    i.style.display='block';
    i.style.position='absolute';
    i.style.top='0';
    i.style.left='0';
    i.style.width='100%';
    i.style.height='100%';
    i.style.objectFit='contain';
    i.style.objectPosition='center';
    document.getElementById('tm-cnic-front-placeholder').style.display='none'; 
    document.getElementById('tm-cnic-front-data').value=t.cnic_front; 
    document.getElementById('tm-cnic-front-clear').style.display='block';
  }
  if (t.cnic_back) { 
    const i=document.getElementById('tm-cnic-back-img'); 
    i.src=t.cnic_back; 
    i.style.display='block';
    i.style.position='absolute';
    i.style.top='0';
    i.style.left='0';
    i.style.width='100%';
    i.style.height='100%';
    i.style.objectFit='contain';
    i.style.objectPosition='center';
    document.getElementById('tm-cnic-back-placeholder').style.display='none'; 
    document.getElementById('tm-cnic-back-data').value=t.cnic_back; 
    document.getElementById('tm-cnic-back-clear').style.display='block';
  }
}

function openTeacherModal() {
  tmClearForm();
  document.getElementById('teacher-modal-title').textContent = '➕ Add Staff Member';
  document.getElementById('teacher-modal-error').style.display = 'none';
  // Restore any unsaved draft (only for new teacher, not edit)
  tmRestoreDraft();
  openModal('teacher-modal-overlay');
}

async function quickEditTeacher(id) {
  if (!teachers.length) teachers = await api(API.teachers).catch(() => []);
  const t = teachers.find(x => x.id == id);
  if (!t) { toast('Could not load teacher data.', 'error'); return; }
  document.getElementById('quick-teacher-id').value = t.id;
  document.getElementById('quick-teacher-name').value = t.name;
  document.getElementById('quick-teacher-error').style.display = 'none';
  const radio = document.querySelector(`input[name="quick-teacher-title"][value="${t.title}"]`);
  if (radio) radio.checked = true;
  openModal('quick-teacher-modal-overlay');
}

async function saveQuickTeacher() {
  const id    = document.getElementById('quick-teacher-id').value;
  const title = document.querySelector('input[name="quick-teacher-title"]:checked')?.value;
  const name  = document.getElementById('quick-teacher-name').value.trim();
  const errEl = document.getElementById('quick-teacher-error');
  errEl.style.display = 'none';
  if (!title || !name) { errEl.textContent = 'Please select a title and enter a name'; errEl.style.display = 'flex'; return; }
  // Merge with existing teacher data so PUT doesn’t wipe other fields
  const existing = teachers.find(x => x.id == id) || {};
  const payload = { ...existing, title, name };
  try {
    await api(`${API.teachers}?id=${id}`, 'PUT', payload);
    closeModal('quick-teacher-modal-overlay');
    toast('Teacher updated', 'success');
    loadTeachers();
  } catch(e) { errEl.textContent = e.message; errEl.style.display = 'flex'; }
}

async function editTeacher(id) {
  if (!teachers.length) teachers = await api(API.teachers).catch(() => []);
  const t = teachers.find(x => x.id == id);
  if (!t) { toast('Could not load teacher data. Please try again.', 'error'); return; }
  tmClearForm();
  tmFillForm(t);
  document.getElementById('teacher-modal-title').textContent = '✏️ Edit Staff Member';
  document.getElementById('teacher-modal-error').style.display = 'none';
  openModal('teacher-modal-overlay');
}

async function saveTeacher() {
  // Save teacher data to the server
  const id = document.getElementById('teacher-id').value;
  const title = document.querySelector('input[name="teacher-title"]:checked')?.value;
  const name = document.getElementById('teacher-name').value.trim();
  const errEl = document.getElementById('teacher-modal-error');
  errEl.style.display = 'none';
  if (!title || !name) { errEl.textContent = 'Please select title and enter name'; errEl.style.display = 'flex'; return; }
  const payload = {
    title, name,
    designation:        document.getElementById('tm-designation').value.trim(),
    religion:           document.getElementById('tm-religion').value.trim(),
    gender:             document.getElementById('tm-gender').value,
    joining_date:       document.getElementById('tm-joining-date').value || null,
    nic_number:         document.getElementById('tm-nic').value.trim(),
    employment_type:    document.getElementById('tm-employment-type').value,
    per_lecture_amount: document.getElementById('tm-per-lecture').value || null,
    role:               document.getElementById('tm-role').value,
    work_experience:    document.getElementById('tm-work-experience').value.trim(),
    qualification:      document.getElementById('tm-qualification').value.trim(),
    marital_status:     document.getElementById('tm-marital-status').value,
    phone:              document.getElementById('tm-phone').value.trim(),
    whatsapp:           document.getElementById('tm-whatsapp').value.trim(),
    blood_group:        document.getElementById('tm-blood-group').value,
    email:              document.getElementById('tm-email').value.trim(),
    date_of_birth:      document.getElementById('tm-dob').value || null,
    place_of_birth:     document.getElementById('tm-place-of-birth').value.trim(),
    address:            document.getElementById('tm-address').value.trim(),
    starting_salary:    document.getElementById('tm-starting-salary').value || null,
    current_salary:     document.getElementById('tm-current-salary').value || null,
    bank_name:          document.getElementById('tm-bank-name').value.trim(),
    bank_account_type:  document.querySelector('input[name="tm-bank-account-type"]:checked')?.value || 'account',
    bank_account_no:    document.getElementById('tm-bank-account').value.trim(),
    notes:              document.getElementById('tm-notes').value.trim(),
    photo:              document.getElementById('tm-photo-data').value,
    cnic_front:         document.getElementById('tm-cnic-front-data').value,
    cnic_back:          document.getElementById('tm-cnic-back-data').value,
    relationship_name:  document.getElementById('tm-relationship-name').value.trim(),
    leaving_date:       document.getElementById('tm-leaving-date')?.value || null,
    leaving_reason:     document.getElementById('tm-leaving-reason')?.value || null,
  };
  try {
    if (id) await api(`${API.teachers}?id=${id}`, 'PUT', payload);
    else await api(API.teachers, 'POST', payload);
    tmClearDraft(); // Clear draft on successful save
    closeModal('teacher-modal-overlay');
    toast('Staff member saved successfully', 'success');
    loadTeachers();
  } catch (e) { errEl.textContent = e.message; errEl.style.display = 'flex'; }
}

