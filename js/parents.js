// ===== PARENT COLUMN FILTER =====
const _PI_COLS = [
  { col: 'col-pi-fr',         label: 'Fr#',         def: true  },
  { col: 'col-pi-photo',      label: 'Photo',       def: true  },
  { col: 'col-pi-name',       label: 'Parent Name', def: true  },
  { col: 'col-pi-nic',        label: 'NIC Number',  def: true  },
  { col: 'col-pi-phone',      label: 'Phone',       def: true  },
  { col: 'col-pi-profession', label: 'Profession',  def: false },
  { col: 'col-pi-children',   label: 'Children',    def: true  },
];

function initParentColFilter() {
  const wrap = document.getElementById('pi-col-checkboxes');
  if (!wrap || wrap.dataset.built) return;
  wrap.dataset.built = '1';
  const saved = JSON.parse(localStorage.getItem('pi-col-vis') || 'null') || {};
  wrap.innerHTML = _PI_COLS.map(c => {
    const checked = (c.col in saved) ? saved[c.col] : c.def;
    return `<label style="display:flex;align-items:center;gap:5px;font-size:0.82rem;cursor:pointer;color:var(--text-muted)">
      <input type="checkbox" ${checked?'checked':''} data-col="${c.col}" onchange="saveParentColPrefs();applyParentColFilter()" style="accent-color:var(--accent)">
      ${c.label}
    </label>`;
  }).join('');
  applyParentColFilter();
}

function saveParentColPrefs() {
  const prefs = {};
  document.querySelectorAll('#pi-col-checkboxes input[data-col]').forEach(cb => {
    prefs[cb.dataset.col] = cb.checked;
  });
  localStorage.setItem('pi-col-vis', JSON.stringify(prefs));
}

function applyParentColFilter() {
  const table = document.getElementById('pi-table');
  if (!table) return;
  const checkboxes = document.querySelectorAll('#pi-col-checkboxes input[data-col]');
  if (!checkboxes.length) return;
  const vis = {};
  checkboxes.forEach(cb => { vis[cb.dataset.col] = cb.checked; });
  vis['col-pi-name']    = true;
  vis['col-pi-actions'] = true;
  table.querySelectorAll('[data-col]').forEach(el => {
    const col = el.dataset.col;
    if (col in vis) el.style.display = vis[col] ? '' : 'none';
  });
}

function toggleParentFilterPanel() {
  const body  = document.getElementById('pi-col-filter-body');
  const caret = document.getElementById('pi-filter-caret');
  if (!body) return;
  const open = body.style.display === 'none';
  body.style.display = open ? '' : 'none';
  if (caret) caret.style.transform = open ? 'rotate(180deg)' : '';
  if (open) {
    const wrap = document.getElementById('pi-col-checkboxes');
    if (wrap) wrap.dataset.built = '';
    initParentColFilter();
  }
}

function setAllParentCols(val) {
  document.querySelectorAll('#pi-col-checkboxes input[data-col]').forEach(cb => { cb.checked = val; });
  saveParentColPrefs();
  applyParentColFilter();
}

// ===== PARENT INFORMATION =====
let _piData = [];
let _piEditCnic = null;
let _piPhotoData = null; // base64 string or null
let _piDoc1Data  = null; // base64 or null
let _piDoc2Data  = null; // base64 or null

async function loadParentInformation() {
  const area = document.getElementById('pi-table-area');
  area.innerHTML = '<div class="card" style="text-align:center;padding:40px;color:var(--text-muted)">Loading…</div>';
  try {
    _piData = await api(API.parents);
    initParentColFilter();
    renderParentTable();
  } catch(e) {
    area.innerHTML = `<div class="card" style="text-align:center;padding:40px;color:var(--danger)">${escapeHtml(e.message)}</div>`;
  }
}

function renderParentTable() {
  const q = (document.getElementById('pi-search')?.value || '').toLowerCase().trim();
  const filtered = q ? _piData.filter(p =>
    (p.parent_name || '').toLowerCase().includes(q) ||
    (p.father_cnic || '').toLowerCase().includes(q) ||
    (p.family_code || '').includes(q) ||
    (p.parent_phone || '').toLowerCase().includes(q)
  ) : _piData;

  const area = document.getElementById('pi-table-area');
  if (!filtered.length) {
    area.innerHTML = '<div class="card" style="text-align:center;padding:40px;color:var(--text-muted)">' + (q ? 'No results found.' : 'No parent records yet. Click <b>+ Add Parent</b> to begin.') + '</div>';
    return;
  }

  const rows = filtered.map(p => {
    const photo = p.photo
      ? `<img src="${escapeHtml(p.photo)}" style="width:38px;height:38px;border-radius:50%;object-fit:cover;border:2px solid rgba(201,168,76,0.3);vertical-align:middle">`
      : `<div style="width:38px;height:38px;border-radius:50%;background:rgba(201,168,76,0.08);border:2px solid rgba(201,168,76,0.2);display:inline-flex;align-items:center;justify-content:center;vertical-align:middle"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>`;

    const childrenHtml = p.children && p.children.length
      ? p.children.map(c => {
          const childName = c.replace(/\s*\([^)]*\)\s*$/, '').trim();
          const st = (_studentsCache||[]).find(s => {
            const fn = ((s.first_name||'') + ' ' + (s.last_name||'')).trim() || s.student_name || '';
            return fn === childName || (s.student_name || '') === childName;
          });
          return `<div style="white-space:nowrap;margin:2px 0">${
            st
              ? `<span class="badge badge-blue" style="font-family:inherit;font-size:0.78rem;cursor:pointer" onclick="openStudentBio(${st.id})" title="View student profile">${escapeHtml(c)}</span>`
              : `<span class="badge badge-blue" style="font-family:inherit;font-size:0.78rem">${escapeHtml(c)}</span>`
          }</div>`;
        }).join('')
      : '<span style="color:var(--text-muted)">—</span>';

    const safeCnic = escapeHtml(p.father_cnic);
    const safeName = escapeHtml((p.parent_name || p.father_cnic || '').replace(/'/g, "&#39;"));

    return `<tr style="vertical-align:middle;text-align:center;font-size:0.9rem">
      <td data-col="col-pi-fr" style="white-space:nowrap;padding:7px 6px"><span class="badge badge-gold" style="font-family:monospace;letter-spacing:1px">${escapeHtml(p.family_code || '—')}</span></td>
      <td data-col="col-pi-photo" style="white-space:nowrap;padding:7px 6px">${photo}</td>
      <td data-col="col-pi-name" style="white-space:nowrap;padding:7px 6px"><span class="badge badge-gold" style="font-family:inherit;font-size:0.88rem;font-weight:600;cursor:pointer" onclick="openParentBio('${safeCnic}')" title="View parent profile">${escapeHtml(p.parent_name || '—')}</span></td>
      <td data-col="col-pi-nic" style="white-space:nowrap;padding:7px 6px;font-family:monospace;font-size:0.88rem;color:var(--accent)">${escapeHtml(p.father_cnic || '—')}</td>
      <td data-col="col-pi-phone" style="white-space:nowrap;padding:7px 6px">${escapeHtml(p.parent_phone || '—')}</td>
      <td data-col="col-pi-profession" style="white-space:nowrap;padding:7px 6px;color:var(--text-muted);font-size:0.9rem">${escapeHtml(p.profession || '—')}</td>
      <td data-col="col-pi-children" style="padding:7px 6px;text-align:left">${childrenHtml}</td>
      <td data-col="col-pi-actions" style="white-space:nowrap;padding:7px 6px">
        <button class="btn btn-secondary btn-sm" onclick="openParentBio('${safeCnic}')" title="View Profile">&#9432; View</button>
        <button class="btn btn-secondary btn-sm" onclick="openEditParentModal('${safeCnic}')">Edit</button>
        <button class="btn btn-secondary btn-sm" onclick="openQuickAccountModal('parent',${p.id},'${safeName}')" title="Manage Login Account" style="padding:4px 8px;font-size:1rem">&#128274;</button>
        <button class="btn btn-danger btn-sm" onclick="deleteParentFamily('${safeCnic}','${safeName}')">Delete</button>
      </td>
    </tr>`;
  }).join('');

  area.innerHTML = `<div class="card">
    <div class="table-wrap">
      <table id="pi-table">
        <thead>
          <tr>
            <th data-col="col-pi-fr">Fr#</th>
            <th data-col="col-pi-photo">Photo</th>
            <th data-col="col-pi-name">Parent Name</th>
            <th data-col="col-pi-nic">NIC Number</th>
            <th data-col="col-pi-phone">Phone</th>
            <th data-col="col-pi-profession">Profession</th>
            <th data-col="col-pi-children">Children</th>
            <th data-col="col-pi-actions">Actions</th>
          </tr>
        </thead>
        <tbody id="pi-table-body">
          ${rows}
        </tbody>
      </table>
    </div>
  </div>`;
  applyParentColFilter();
}

function openAddParentModal() {
  _piEditCnic = null;
  _piPhotoData = null;
  _piDoc1Data  = null;
  _piDoc2Data  = null;
  document.getElementById('parent-modal-title').textContent = 'Add Parent';
  document.getElementById('pm-save-btn').textContent = 'Add Parent';
  document.getElementById('pm-cnic-group').style.display = '';
  document.getElementById('pm-cnic-readonly-group').style.display = 'none';
  document.getElementById('pm-cnic').value       = '';
  document.getElementById('pm-name').value       = '';
  document.getElementById('pm-phone').value      = '';
  document.getElementById('pm-gender').value     = '';
  document.getElementById('pm-profession').value = '';
  document.getElementById('pm-email').value      = '';
  document.getElementById('pm-whatsapp').value   = '';
  document.getElementById('pm-address').value    = '';
  document.getElementById('pm-notes').value      = '';
  document.getElementById('pm-cnic-hint').style.display = 'none';
  document.getElementById('pm-error').style.display = 'none';
  const _nextFr = _piData && _piData.length
    ? String(Math.max(0, ..._piData.map(p => parseInt(p.family_code) || 0)) + 1).padStart(3, '0')
    : '001';
  document.getElementById('pm-fr-display').value = _nextFr;
  document.getElementById('pm-photo-zoom').value = 100;
  _resetParentPhotoUI();
  _resetParentDocUI(1);
  _resetParentDocUI(2);
  openModal('parent-modal-overlay');
  setTimeout(() => document.getElementById('pm-cnic').focus(), 100);
}

function openEditParentModal(cnic) {
  const p = _piData.find(x => x.father_cnic === cnic);
  if (!p) return;
  _piEditCnic  = cnic;
  _piPhotoData = p.photo || null;
  _piDoc1Data  = p.doc1  || null;
  _piDoc2Data  = p.doc2  || null;
  document.getElementById('parent-modal-title').textContent = 'Edit Parent';
  document.getElementById('pm-save-btn').textContent = 'Save Changes';
  document.getElementById('pm-cnic-group').style.display = 'none';
  document.getElementById('pm-cnic-readonly-group').style.display = '';
  document.getElementById('pm-cnic-display').textContent = p.father_cnic || '—';
  document.getElementById('pm-fr-display').value  = p.family_code  || '—';
  document.getElementById('pm-name').value        = p.parent_name  || '';
  document.getElementById('pm-phone').value       = p.parent_phone || '';
  document.getElementById('pm-gender').value      = p.gender       || '';
  document.getElementById('pm-profession').value  = p.profession   || '';
  document.getElementById('pm-email').value       = p.email        || '';
  document.getElementById('pm-whatsapp').value    = p.whatsapp     || '';
  document.getElementById('pm-address').value     = p.address      || '';
  document.getElementById('pm-notes').value       = p.notes        || '';
  document.getElementById('pm-error').style.display = 'none';
  document.getElementById('pm-photo-zoom').value = 100;
  if (p.photo) {
    const prev = document.getElementById('pm-photo-preview');
    prev.style.cssText = 'position:absolute;inset:8px;overflow:hidden';
    prev.innerHTML = `<img src="${escapeHtml(p.photo)}" style="width:100%;height:100%;object-fit:cover;transform-origin:center">`;
    document.getElementById('pm-photo-remove').style.display = '';
  } else {
    _resetParentPhotoUI();
  }
  if (p.doc1) _showDocPreview(1, p.doc1, 'Saved document'); else _resetParentDocUI(1);
  if (p.doc2) _showDocPreview(2, p.doc2, 'Saved document'); else _resetParentDocUI(2);
  openModal('parent-modal-overlay');
  setTimeout(() => document.getElementById('pm-name').focus(), 100);
}

function _resetParentPhotoUI() {
  _piPhotoData = null;
  const prev = document.getElementById('pm-photo-preview');
  prev.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;box-sizing:border-box;padding:10px';
  prev.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:8px;max-width:130px;pointer-events:none">
      <svg width="68" height="68" viewBox="0 0 100 100" fill="none" stroke="var(--text-muted)" stroke-width="2.5">
        <ellipse cx="50" cy="32" rx="20" ry="22"/><path d="M10 90c0-22.1 17.9-40 40-40s40 17.9 40 40"/>
      </svg>
      <span style="font-size:0.7rem;color:var(--text-muted);text-align:center;line-height:1.5">Select or Drag and Drop a picture on it.</span>
    </div>`;
  document.getElementById('pm-photo-remove').style.display = 'none';
  document.getElementById('pm-photo-input').value = '';
}

function _resetParentDocUI(n) {
  if (n === 1) { _piDoc1Data = null; } else { _piDoc2Data = null; }
  document.getElementById(`pm-doc${n}-placeholder`).style.display = '';
  document.getElementById(`pm-doc${n}-img-wrap`).style.display = 'none';
  document.getElementById(`pm-doc${n}-img`).src = '';
  const pdfWrap = document.getElementById(`pm-doc${n}-pdf-wrap`);
  pdfWrap.style.display = 'none';
  document.getElementById(`pm-doc${n}-pdf-name`).textContent = '';
  document.getElementById(`pm-doc${n}-frame`).style.borderColor = '';
  document.getElementById(`pm-doc${n}-remove`).style.display = 'none';
  document.getElementById(`pm-doc${n}-input`).value = '';
}

function _showDocPreview(n, dataUrl, filename) {
  if (n === 1) _piDoc1Data = dataUrl; else _piDoc2Data = dataUrl;
  const isImage = dataUrl && dataUrl.startsWith('data:image');
  document.getElementById(`pm-doc${n}-placeholder`).style.display = 'none';
  if (isImage) {
    document.getElementById(`pm-doc${n}-img`).src = dataUrl;
    document.getElementById(`pm-doc${n}-img-wrap`).style.display = '';
    document.getElementById(`pm-doc${n}-pdf-wrap`).style.display = 'none';
  } else {
    document.getElementById(`pm-doc${n}-img-wrap`).style.display = 'none';
    const pdfWrap = document.getElementById(`pm-doc${n}-pdf-wrap`);
    pdfWrap.style.display = 'flex';
    document.getElementById(`pm-doc${n}-pdf-name`).textContent = filename || 'Document';
  }
  document.getElementById(`pm-doc${n}-frame`).style.borderColor = 'var(--accent)';
  document.getElementById(`pm-doc${n}-remove`).style.display = '';
}

function parentDocDrop(event, n) {
  event.preventDefault();
  document.getElementById(`pm-doc${n}-frame`).style.borderColor = 'var(--border)';
  const file = event.dataTransfer.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/') && file.type !== 'application/pdf') { toast('Please drop an image or PDF', true); return; }
  previewParentDoc({ files: [file] }, n);
}

function previewParentDoc(input, n) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { toast('Document must be under 5MB', true); return; }
  const reader = new FileReader();
  reader.onload = e => {
    _showDocPreview(n, e.target.result, file.name);
  };
  reader.readAsDataURL(file);
}

function removeParentDoc(n) {
  _resetParentDocUI(n);
}

function previewParentPhoto(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { toast('Photo must be under 2MB', true); return; }
  const reader = new FileReader();
  reader.onload = e => {
    _piPhotoData = e.target.result;
    const prev = document.getElementById('pm-photo-preview');
    prev.style.cssText = 'position:absolute;inset:8px;overflow:hidden';
    prev.innerHTML = `<img src="${_piPhotoData}" style="width:100%;height:100%;object-fit:cover;transform-origin:center;transition:transform .15s">`;
    document.getElementById('pm-photo-remove').style.display = '';
    document.getElementById('pm-photo-zoom').value = 100;
  };
  reader.readAsDataURL(file);
}

function handleParentPhotoDrop(event) {
  event.preventDefault();
  document.getElementById('pm-photo-drop-area').style.borderColor = 'var(--border)';
  const file = event.dataTransfer.files[0];
  if (!file || !file.type.startsWith('image/')) { toast('Please drop an image file', true); return; }
  const fakeInput = { files: [file] };
  previewParentPhoto(fakeInput);
}

function scaleParentPhoto(val) {
  const img = document.querySelector('#pm-photo-preview img');
  if (img) img.style.transform = `scale(${val / 100})`;
}

function rotateParentPhoto(deg) {
  const img = document.querySelector('#pm-photo-preview img');
  if (!img || !_piPhotoData) return;
  const canvas = document.createElement('canvas');
  const image  = new Image();
  image.onload = () => {
    const rad = deg * Math.PI / 180;
    const sin = Math.abs(Math.sin(rad)), cos = Math.abs(Math.cos(rad));
    canvas.width  = image.height * sin + image.width  * cos;
    canvas.height = image.height * cos + image.width  * sin;
    const ctx = canvas.getContext('2d');
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(rad);
    ctx.drawImage(image, -image.width / 2, -image.height / 2);
    _piPhotoData = canvas.toDataURL('image/jpeg', 0.92);
    img.src = _piPhotoData;
    document.getElementById('pm-photo-zoom').value = 100;
    img.style.transform = 'scale(1)';
  };
  image.src = _piPhotoData;
}

function loadSampleParentPhoto() {
  // No-op: Sample button is UI placeholder
  toast('No sample image available', false);
}

function removeParentPhoto() {
  _piPhotoData = null;
  _resetParentPhotoUI();
}

async function autofillParentFromCnic() {
  const cnic = document.getElementById('pm-cnic').value.trim();
  const hint = document.getElementById('pm-cnic-hint');
  if (!cnic || cnic.length < 5) { hint.style.display = 'none'; return; }

  // If this CNIC already has a parent record, show that family's Fr#
  const existingParent = _piData ? _piData.find(p => (p.father_cnic || '').toLowerCase() === cnic.toLowerCase()) : null;
  if (existingParent && existingParent.family_code) {
    document.getElementById('pm-fr-display').value = existingParent.family_code;
  } else {
    // Restore next available Fr#
    const _nextFr = _piData && _piData.length
      ? String(Math.max(0, ..._piData.map(p => parseInt(p.family_code) || 0)) + 1).padStart(3, '0')
      : '001';
    document.getElementById('pm-fr-display').value = _nextFr;
  }

  const match = _studentsCache ? _studentsCache.find(s => (s.father_cnic || '').toLowerCase() === cnic.toLowerCase()) : null;
  if (match) {
    if (!document.getElementById('pm-name').value) {
      document.getElementById('pm-name').value = match.father_name || '';
    }
    if (!document.getElementById('pm-phone').value) {
      document.getElementById('pm-phone').value = match.father_phone || '';
    }
    hint.textContent = `Auto-filled from student: ${escapeHtml(match.student_name || '')}`;
    hint.style.display = 'block';
  } else {
    hint.style.display = 'none';
  }
}

async function saveParent() {
  const name       = document.getElementById('pm-name').value.trim();
  const phone      = document.getElementById('pm-phone').value.trim();
  const profession = document.getElementById('pm-profession').value.trim();
  const email      = document.getElementById('pm-email').value.trim();
  const address    = document.getElementById('pm-address').value.trim();
  const notes      = document.getElementById('pm-notes').value.trim();
  const errEl      = document.getElementById('pm-error');
  errEl.style.display = 'none';

  if (!name) { errEl.textContent = 'Parent name is required.'; errEl.style.display = 'block'; return; }

  const gender   = document.getElementById('pm-gender').value;
  const whatsapp = document.getElementById('pm-whatsapp').value.trim();
  const payload = { parent_name: name, parent_phone: phone, photo: _piPhotoData,
                    gender, profession, email, whatsapp, address, notes, doc1: _piDoc1Data, doc2: _piDoc2Data };
  try {
    if (_piEditCnic) {
      await api(API.parents, 'PUT', { ...payload, father_cnic: _piEditCnic });
      toast('Parent updated');
    } else {
      const cnic = document.getElementById('pm-cnic').value.trim();
      if (!cnic) { errEl.textContent = 'Father CNIC is required.'; errEl.style.display = 'block'; return; }
      await api(API.parents, 'POST', { ...payload, father_cnic: cnic });
      toast('Parent added');
    }
    closeModal('parent-modal-overlay');
    await loadParentInformation();
  } catch(e) {
    errEl.textContent = e.message;
    errEl.style.display = 'block';
  }
}

function deleteParentFamily(cnic, name) {
  document.getElementById('confirm-message').textContent = `Are you sure you want to delete the parent record for "${name}"? Student records will not be affected.`;
  document.getElementById('confirm-btn').onclick = async () => {
    try {
      await api(`${API.parents}?cnic=${encodeURIComponent(cnic)}`, 'DELETE');
      closeModal('confirm-modal-overlay');
      toast('Family record deleted');
      await loadParentInformation();
    } catch(e) {
      closeModal('confirm-modal-overlay');
      toast('Error: ' + e.message, true);
    }
  };
  openModal('confirm-modal-overlay');
}

