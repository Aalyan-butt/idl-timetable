// ===== CLASS CRUD =====
function openClassModal() {
  document.getElementById('class-id').value = '';
  document.getElementById('class-name').value = '';
  document.getElementById('class-modal-title').textContent = 'Add Class';
  document.getElementById('class-modal-error').style.display = 'none';
  openModal('class-modal-overlay');
}

async function editClass(id) {
  if (!classes.length) classes = await api(API.classes).catch(() => []);
  const c = classes.find(x => x.id == id);
  if (!c) { toast('Could not load class data. Please try again.', 'error'); return; }
  document.getElementById('class-id').value = c.id;
  document.getElementById('class-name').value = c.name;
  document.getElementById('class-modal-title').textContent = 'Edit Class';
  document.getElementById('class-modal-error').style.display = 'none';
  openModal('class-modal-overlay');
}

async function saveClass() {
  const id = document.getElementById('class-id').value;
  const name = document.getElementById('class-name').value.trim();
  const errEl = document.getElementById('class-modal-error');
  errEl.style.display = 'none';
  if (!name) { errEl.textContent = 'Please enter a class name'; errEl.style.display = 'flex'; return; }
  try {
    if (id) await api(`${API.classes}?id=${id}`, 'PUT', { name });
    else await api(API.classes, 'POST', { name });
    closeModal('class-modal-overlay');
    toast('Class saved successfully', 'success');
    loadClasses();
  } catch (e) { errEl.textContent = e.message; errEl.style.display = 'flex'; }
}

