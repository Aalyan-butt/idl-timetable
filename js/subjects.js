// ===== CLASS SUBJECTS =====
// Close class-list in Add Subject modal when clicking outside its container
document.addEventListener('mousedown', function(e) {
  const group = document.getElementById('subject-modal-class-group');
  if (group && !group.contains(e.target)) {
    const list = document.getElementById('subject-modal-class-list');
    if (list) list.style.display = 'none';
  }
});

let _csClassId   = null;
let _csClassName = '';
let _csSubjects  = [];
let _csEditId    = null; // null = add mode, number = edit mode
let _smSelectedClassIds = new Set(); // classes selected inside the Add Subject modal

// Reuse the shared floating CE picker for class selection on this page
function openCSClassPicker() {
  _ceActiveSid = '__cs__'; // special sentinel
  const trigger = document.getElementById('cs-class-trigger');
  const picker  = document.getElementById('ce-float-picker');
  if (!trigger || !picker) return;

  const rect = trigger.getBoundingClientRect();
  const pickerW = Math.max(rect.width, 240);
  let left = rect.left;
  if (left + pickerW > window.innerWidth - 8) left = window.innerWidth - pickerW - 8;
  picker.style.top   = (rect.bottom + 4) + 'px';
  picker.style.left  = left + 'px';
  picker.style.width = pickerW + 'px';
  picker.style.display = 'block';

  const searchEl = document.getElementById('ce-float-search');
  searchEl.value = '';
  // Override: render classes list and handle selection for CS page
  const listEl = document.getElementById('ce-float-list');
  listEl.innerHTML = classes.map(c =>
    `<div onmousedown="selectCSClass(${c.id},'${escapeHtml(c.name).replace(/'/g,"&#39;")}')"
      style="padding:9px 14px;cursor:pointer;font-size:0.88rem;color:var(--text)"
      onmouseenter="this.style.background='rgba(201,168,76,0.12)'"
      onmouseleave="this.style.background=''">
      ${escapeHtml(c.name)}
    </div>`
  ).join('');
  // Override search to filter class list
  searchEl.oninput = function() {
    const q = this.value.trim().toLowerCase();
    const filtered = q ? classes.filter(c => c.name.toLowerCase().includes(q)) : classes;
    listEl.innerHTML = filtered.map(c =>
      `<div onmousedown="selectCSClass(${c.id},'${escapeHtml(c.name).replace(/'/g,"&#39;")}')"
        style="padding:9px 14px;cursor:pointer;font-size:0.88rem;color:var(--text)"
        onmouseenter="this.style.background='rgba(201,168,76,0.12)'"
        onmouseleave="this.style.background=''">
        ${escapeHtml(c.name)}
      </div>`
    ).join('') || `<div style="padding:10px 14px;color:var(--text-muted);font-size:0.85rem">No classes found</div>`;
  };
  setTimeout(() => searchEl.focus(), 50);
}

function selectCSClass(classId, className) {
  _csClassId   = classId;
  _csClassName = className;
  document.getElementById('cs-class-label').textContent = className;
  document.getElementById('cs-class-label').style.color = 'var(--text)';
  const badge = document.getElementById('cs-class-name-badge');
  badge.textContent = className;
  badge.style.display = '';
  document.getElementById('ce-float-picker').style.display = 'none';
  // Restore default float search handler
  document.getElementById('ce-float-search').oninput = function() { renderCEFloatList(this.value); };
  document.getElementById('cs-search-wrap').style.display = '';
  document.getElementById('cs-search').value = '';
  loadClassSubjectsForClass();
}

// Render checkbox list inside the Add Subject modal
function renderSMClassList(q) {
  const listEl   = document.getElementById('subject-modal-class-list');
  if (!listEl) return;
  const filtered = q ? classes.filter(c => c.name.toLowerCase().includes(q.toLowerCase())) : classes;
  if (!filtered.length) {
    listEl.innerHTML = `<div style="padding:10px 14px;color:var(--text-muted);font-size:0.85rem">No classes found</div>`;
    return;
  }
  listEl.innerHTML = filtered.map(c => `
    <label style="display:flex;align-items:center;gap:10px;padding:8px 12px;cursor:pointer;font-size:0.88rem;color:var(--text)"
      onmouseenter="this.style.background='rgba(201,168,76,0.08)'" onmouseleave="this.style.background=''">
      <input type="checkbox" value="${c.id}" ${_smSelectedClassIds.has(c.id) ? 'checked' : ''}
        onchange="toggleSMClass(${c.id},'${escapeHtml(c.name).replace(/'/g,"&#39;")}',this.checked)"
        style="accent-color:var(--accent);width:16px;height:16px;cursor:pointer">
      <span>${escapeHtml(c.name)}</span>
    </label>`).join('');
}

function filterSMClassList(q) {
  document.getElementById('subject-modal-class-list').style.display = '';
  renderSMClassList(q.trim());
}

function toggleSMClass(classId, className, checked) {
  if (checked) _smSelectedClassIds.add(classId);
  else         _smSelectedClassIds.delete(classId);
  // Rebuild tags
  const tagEl = document.getElementById('subject-modal-class-tags');
  if (!tagEl) return;
  const selected = [..._smSelectedClassIds].map(id => classes.find(c => c.id == id)).filter(Boolean);
  tagEl.innerHTML = selected.map(c =>
    `<span style="background:rgba(42,74,142,0.15);color:var(--accent);padding:2px 10px;border-radius:20px;font-size:0.81rem;font-weight:600">${escapeHtml(c.name)}</span>`
  ).join('');
}

function initClassSubjectsPage() {
  // Reset to clean state each time page is visited
  if (_csClassId) {
    loadClassSubjectsForClass();
  }
}

async function loadClassSubjectsForClass() {
  if (!_csClassId) return;
  const area = document.getElementById('cs-subjects-area');
  area.innerHTML = `<div class="card" style="text-align:center;padding:28px;color:var(--text-muted)">Loading subjects…</div>`;
  try {
    _csSubjects = await api(`${API.subjects}?class_id=${_csClassId}`);
    renderClassSubjects();
  } catch(e) {
    area.innerHTML = `<div class="card" style="text-align:center;padding:28px;color:var(--danger)">${escapeHtml(e.message)}</div>`;
  }
}

function renderClassSubjects() {
  const area = document.getElementById('cs-subjects-area');
  if (!area) return;
  if (!_csClassId) {
    area.innerHTML = `<div class="card" style="text-align:center;padding:40px;color:var(--text-muted)">Select a class above to view its subjects.</div>`;
    return;
  }

  const q = (document.getElementById('cs-search')?.value || '').trim().toLowerCase();
  const list = q ? _csSubjects.filter(s => s.subject_name.toLowerCase().includes(q)) : _csSubjects;

  if (!_csSubjects.length) {
    area.innerHTML = `<div class="card" style="text-align:center;padding:40px;color:var(--text-muted)">No subjects found for this class.</div>`;
    return;
  }
  if (!list.length) {
    area.innerHTML = `<div class="card" style="text-align:center;padding:28px;color:var(--text-muted)">No subjects match "<strong>${escapeHtml(q)}</strong>".</div>`;
    return;
  }

  area.innerHTML = `
    <div style="margin-bottom:8px;font-size:0.82rem;color:var(--text-muted)">${list.length} subject${list.length!==1?'s':''}</div>
    <div class="card" style="padding:0;overflow:hidden">
      <table style="width:100%">
        <thead><tr>
          <th style="min-width:40px">#</th>
          <th style="text-align:left;padding:12px 16px">Subject Name</th>
          <th style="min-width:140px">Actions</th>
        </tr></thead>
        <tbody id="cs-body">
          ${list.map((s, idx) => `
            <tr style="font-size:0.9rem;vertical-align:middle">
              <td style="padding:10px 8px;text-align:center;color:var(--text-muted);font-weight:600">${idx+1}</td>
              <td style="padding:10px 16px;font-weight:600;color:var(--text)">${escapeHtml(s.subject_name)}</td>
              <td style="padding:10px 8px;text-align:center">
                <div style="display:flex;gap:6px;justify-content:center">
                  <button onclick="openEditSubjectModal(${s.id},'${escapeHtml(s.subject_name).replace(/'/g,"&#39;")}')"
                    style="background:#00897B;color:#fff;border:none;border-radius:7px;width:32px;height:32px;cursor:pointer;font-size:0.95rem;display:inline-flex;align-items:center;justify-content:center;transition:opacity .15s"
                    title="Edit Subject" onmouseenter="this.style.opacity='.8'" onmouseleave="this.style.opacity='1'">&#9998;</button>
                  <button onclick="deleteSubject(${s.id},'${escapeHtml(s.subject_name).replace(/'/g,"&#39;")}')"
                    style="background:#E53935;color:#fff;border:none;border-radius:7px;width:32px;height:32px;cursor:pointer;font-size:0.95rem;display:inline-flex;align-items:center;justify-content:center;transition:opacity .15s"
                    title="Delete Subject" onmouseenter="this.style.opacity='.8'" onmouseleave="this.style.opacity='1'">&#128465;</button>
                </div>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function openAddSubjectModal() {
  _csEditId = null;
  _smSelectedClassIds = new Set();

  document.getElementById('subject-modal-title').textContent = 'Add Subject';
  document.getElementById('subject-modal-class-group').style.display = '';
  document.getElementById('subject-modal-class-readonly').style.display = 'none';
  document.getElementById('subject-modal-class-search').value = '';
  document.getElementById('subject-modal-name').value = '';
  document.getElementById('subject-modal-error').style.display = 'none';
  document.getElementById('subject-modal-class-tags').innerHTML = '';

  renderSMClassList('');
  document.getElementById('subject-modal-class-list').style.display = 'none';

  openModal('subject-modal-overlay');
  setTimeout(() => document.getElementById('subject-modal-name').focus(), 100);
}

function openEditSubjectModal(id, name) {
  _csEditId = id;
  document.getElementById('subject-modal-title').textContent = 'Edit Subject';
  document.getElementById('subject-modal-class-group').style.display = 'none';
  document.getElementById('subject-modal-class-readonly').style.display = '';
  document.getElementById('subject-modal-class-display').textContent = _csClassName || '—';
  document.getElementById('subject-modal-name').value = name;
  document.getElementById('subject-modal-error').style.display = 'none';
  openModal('subject-modal-overlay');
  setTimeout(() => document.getElementById('subject-modal-name').focus(), 100);
}

async function saveSubject() {
  const name  = document.getElementById('subject-modal-name').value.trim();
  const errEl = document.getElementById('subject-modal-error');
  errEl.style.display = 'none';

  if (!name) { errEl.textContent = 'Subject name is required.'; errEl.style.display = 'block'; return; }

  try {
    if (_csEditId) {
      await api(API.subjects, 'PUT', { id: _csEditId, subject_name: name });
      toast('Subject updated');
    } else {
      if (_smSelectedClassIds.size === 0) {
        errEl.textContent = 'Please select at least one class.'; errEl.style.display = 'block'; return;
      }
      const selectedIds = [..._smSelectedClassIds];
      for (const classId of selectedIds) {
        try {
          await api(API.subjects, 'POST', { class_id: classId, subject_name: name });
        } catch(e) {
          if (!e.message.toLowerCase().includes('already exists')) throw e;
        }
      }
      const count = selectedIds.length;
      toast(`Subject added to ${count} class${count > 1 ? 'es' : ''}`);

      // If currently viewing one of the selected classes, reload it; otherwise switch to first
      if (!_csClassId || !_smSelectedClassIds.has(_csClassId)) {
        const firstClass = classes.find(c => c.id == selectedIds[0]);
        if (firstClass) {
          _csClassId   = firstClass.id;
          _csClassName = firstClass.name;
          const lbl = document.getElementById('cs-class-label');
          if (lbl) { lbl.textContent = firstClass.name; lbl.style.color = 'var(--text)'; }
          const badge = document.getElementById('cs-class-name-badge');
          if (badge) { badge.textContent = firstClass.name; badge.style.display = ''; }
          const sw = document.getElementById('cs-search-wrap');
          if (sw) sw.style.display = '';
        }
      }
    }
    closeModal('subject-modal-overlay');
    await loadClassSubjectsForClass();
  } catch(e) {
    errEl.textContent = e.message;
    errEl.style.display = 'block';
  }
}

function deleteSubject(id, name) {
  document.getElementById('confirm-message').textContent = `Are you sure you want to delete subject "${name}"? This action cannot be undone.`;
  document.getElementById('confirm-btn').onclick = async () => {
    try {
      await api(`${API.subjects}?id=${id}`, 'DELETE');
      closeModal('confirm-modal-overlay');
      toast('Subject deleted');
      await loadClassSubjectsForClass();
    } catch(e) {
      closeModal('confirm-modal-overlay');
      toast('Error: ' + e.message, true);
    }
  };
  openModal('confirm-modal-overlay');
}

