// ===== CLASS DROPDOWN FOR TIMETABLE MODAL =====
let _ttSubjectList = [];

function ttClassOpen() {
  const dd = document.getElementById('tt-class-dropdown');
  const dp = document.getElementById('tt-class-display');
  if (dd.classList.contains('open')) { _ttClassClose(); return; }
  document.getElementById('tt-class-search').value = '';
  _ttClassRender('');
  dd.classList.add('open');
  dp.classList.add('open');
  setTimeout(() => document.getElementById('tt-class-search').focus(), 50);
  setTimeout(() => document.addEventListener('click', _ttClassOutside), 0);
}

function _ttClassOutside(e) {
  if (!document.getElementById('tt-class-wrapper').contains(e.target)) {
    _ttClassClose();
  }
}

function _ttClassClose() {
  document.getElementById('tt-class-dropdown').classList.remove('open');
  document.getElementById('tt-class-display').classList.remove('open');
  document.removeEventListener('click', _ttClassOutside);
}

function ttClassFilter(q) { _ttClassRender(q); }

function _ttClassRender(q) {
  const list    = document.getElementById('tt-class-list');
  const current = document.getElementById('tt-class').value;
  const filtered = q
    ? classes.filter(c => c.name.toLowerCase().includes(q.toLowerCase()))
    : classes;
  if (filtered.length === 0) {
    list.innerHTML = '<div style="padding:12px 14px;color:var(--text-muted);font-size:0.88rem">No classes found</div>';
    return;
  }
  list.innerHTML = filtered.map(c => {
    const sel = String(c.id) === String(current);
    return `<div onmousedown="ttClassSelect(${c.id},'${escapeHtml(c.name).replace(/'/g,"&#39;")}')"
      style="padding:10px 14px;cursor:pointer;font-size:0.9rem;color:${sel?'var(--accent)':'var(--text)'};background:${sel?'rgba(201,168,76,0.12)':'transparent'}"
      onmouseenter="this.style.background='rgba(201,168,76,0.1)'"
      onmouseleave="this.style.background='${sel?'rgba(201,168,76,0.12)':'transparent'}'"
    >${escapeHtml(c.name)}</div>`;
  }).join('');
}

function ttClassSelect(id, name) {
  document.getElementById('tt-class').value = id;
  document.getElementById('tt-class-display-text').textContent = name;
  document.getElementById('tt-class-display-text').style.color = 'var(--text)';
  document.getElementById('tt-class-clear').style.display = '';
  document.getElementById('tt-class-arrow').style.display = 'none';
  document.getElementById('tt-subject-class-err').style.display = 'none';
  _ttClassClose();
  // Load subjects for this class
  _ttSubjectReset('');
  _ttLoadSubjectsForClass(id);
  // Auto-fill timing based on class + currently selected days
  _ttAutoFillTiming(id);
}

function ttClassClear() {
  document.getElementById('tt-class').value = '';
  document.getElementById('tt-class-display-text').textContent = 'Select class...';
  document.getElementById('tt-class-display-text').style.color = 'var(--text-muted)';
  document.getElementById('tt-class-clear').style.display = 'none';
  document.getElementById('tt-class-arrow').style.display = '';
  _ttSubjectList = [];
  _ttSubjectReset('');
  _ttAutoFillTiming('');
}

function _ttClassReset(classId, className) {
  document.getElementById('tt-class').value = classId || '';
  const txt = document.getElementById('tt-class-display-text');
  txt.textContent = className || 'Select class...';
  txt.style.color = className ? 'var(--text)' : 'var(--text-muted)';
  document.getElementById('tt-class-clear').style.display = className ? '' : 'none';
  document.getElementById('tt-class-arrow').style.display = className ? 'none' : '';
}

// ===== SUBJECT DROPDOWN FOR TIMETABLE MODAL =====
async function _ttLoadSubjectsForClass(classId) {
  _ttSubjectList = [];
  if (!classId) return;
  try {
    const rows = await api(API.subjects + '?class_id=' + classId);
    _ttSubjectList = rows.map(r => ({ id: r.id, name: r.subject_name }));
  } catch(e) { _ttSubjectList = []; }
}

function ttSubjectOpen() {
  const classId = document.getElementById('tt-class').value;
  const errEl   = document.getElementById('tt-subject-class-err');
  if (!classId) { errEl.style.display = 'block'; return; }
  errEl.style.display = 'none';
  const dd = document.getElementById('tt-subject-dropdown');
  const dp = document.getElementById('tt-subject-display');
  if (dd.classList.contains('open')) {
    dd.classList.remove('open'); dp.classList.remove('open'); return;
  }
  document.getElementById('tt-subject-search').value = '';
  _ttSubjectRender('');
  dd.classList.add('open');
  dp.classList.add('open');
  setTimeout(() => document.getElementById('tt-subject-search').focus(), 50);
  setTimeout(() => document.addEventListener('click', _ttSubjectOutside), 0);
}

function _ttSubjectOutside(e) {
  if (!document.getElementById('tt-subject-wrapper').contains(e.target)) {
    document.getElementById('tt-subject-dropdown').classList.remove('open');
    document.getElementById('tt-subject-display').classList.remove('open');
    document.removeEventListener('click', _ttSubjectOutside);
  }
}

function ttSubjectFilter(q) { _ttSubjectRender(q); }

function _ttSubjectRender(q) {
  const list    = document.getElementById('tt-subject-list');
  const current = document.getElementById('tt-subject').value;
  const filtered = q
    ? _ttSubjectList.filter(s => s.name.toLowerCase().includes(q.toLowerCase()))
    : _ttSubjectList;
  if (_ttSubjectList.length === 0) {
    list.innerHTML = '<div style="padding:12px 14px;color:var(--text-muted);font-size:0.88rem">No subjects found for this class. Add them on the Class Subjects page.</div>';
    return;
  }
  if (filtered.length === 0) {
    list.innerHTML = '<div style="padding:12px 14px;color:var(--text-muted);font-size:0.88rem">No subjects match your search</div>';
    return;
  }
  list.innerHTML = filtered.map(s => {
    const sel = s.name === current;
    return `<div onmousedown="ttSubjectSelect('${escapeHtml(s.name).replace(/'/g,"&#39;")}')"
      style="padding:10px 14px;cursor:pointer;font-size:0.9rem;color:${sel?'var(--accent)':'var(--text)'};background:${sel?'rgba(201,168,76,0.12)':'transparent'}"
      onmouseenter="this.style.background='rgba(201,168,76,0.1)'"
      onmouseleave="this.style.background='${sel?'rgba(201,168,76,0.12)':'transparent'}'"
    >${escapeHtml(s.name)}</div>`;
  }).join('');
}

function ttSubjectSelect(name) {
  document.getElementById('tt-subject').value = name;
  document.getElementById('tt-subject-display-text').textContent = name;
  document.getElementById('tt-subject-display-text').style.color = 'var(--text)';
  document.getElementById('tt-subject-dropdown').classList.remove('open');
  document.getElementById('tt-subject-display').classList.remove('open');
  document.removeEventListener('click', _ttSubjectOutside);
}

function _ttSubjectReset(value) {
  document.getElementById('tt-subject').value = value || '';
  const txt = document.getElementById('tt-subject-display-text');
  txt.textContent = value || 'Select subject...';
  txt.style.color = value ? 'var(--text)' : 'var(--text-muted)';
  document.getElementById('tt-subject-class-err').style.display = 'none';
}

// ===== TIMETABLE CRUD =====
async function openTimetableModal() {
  await loadAllData();
  document.getElementById('tt-id').value = '';
  _ttClassReset('', '');
  _ttSubjectList = [];
  _ttSubjectReset('');
  document.getElementById('tt-start').value = schoolSettings.school_start || '08:00';
  document.getElementById('tt-end').value   = schoolSettings.school_end   || '14:00';
  document.getElementById('tt-modal-title').textContent = 'Add Timetable Slot';
  document.getElementById('tt-modal-error').style.display = 'none';
  document.getElementById('tt-is-break').checked = false;
  document.getElementById('tt-non-break-fields').style.display = '';
  document.getElementById('tt-break-class-field').style.display = 'none';
  clearDays();
  const classOpts = '<option value="">Select class...</option>' + classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  document.getElementById('tt-break-class').innerHTML = classOpts;
  document.getElementById('tt-teacher').innerHTML = teachers.map(t => `<option value="${t.id}">${normalizeTitle(t.title)} ${t.name}</option>`).join('');
  openModal('tt-modal-overlay');
}

async function editTimetable(id) {
  await loadAllData();
  const s = timetableSlots.find(x => x.id == id);
  if (!s) return;
  document.getElementById('tt-id').value = s.id;
  document.getElementById('tt-modal-title').textContent = 'Edit Timetable Slot';
  document.getElementById('tt-modal-error').style.display = 'none';

  const isBreak = !!s.is_break;
  document.getElementById('tt-is-break').checked = isBreak;
  document.getElementById('tt-non-break-fields').style.display = isBreak ? 'none' : '';
  document.getElementById('tt-break-class-field').style.display = isBreak ? '' : 'none';

  const classOpts = '<option value="">Select class...</option>' + classes.map(c => `<option value="${c.id}" ${c.id==s.class_id?'selected':''}>${c.name}</option>`).join('');
  document.getElementById('tt-break-class').innerHTML = classOpts;

  // Set class dropdown
  const cls = classes.find(c => c.id == s.class_id);
  _ttClassReset(s.class_id || '', cls ? cls.name : '');

  // Load subjects for this class then restore selected subject
  await _ttLoadSubjectsForClass(s.class_id);
  _ttSubjectReset(s.subject || '');

  const teacherIds = (s.teacher_ids ? s.teacher_ids.split(',') : [String(s.teacher_id)]);
  document.getElementById('tt-teacher').innerHTML = teachers.map(t => `<option value="${t.id}" ${teacherIds.includes(String(t.id))?'selected':''}>${normalizeTitle(t.title)} ${t.name}</option>`).join('');
  document.getElementById('tt-start').value = s.start_time.substring(0,5);
  document.getElementById('tt-end').value = s.end_time.substring(0,5);
  clearDays();
  if (s.days) {
    s.days.split(',').forEach(day => {
      document.querySelectorAll('.day-btn').forEach(btn => { if (btn.dataset.day === day.trim()) btn.classList.add('selected'); });
    });
  }
  document.getElementById('tt-day-group').value = s.day_group || '';
  openModal('tt-modal-overlay');
}

async function saveTimetable() {
  const id       = document.getElementById('tt-id').value;
  const isBreak  = document.getElementById('tt-is-break').checked;
  const errEl    = document.getElementById('tt-modal-error');
  errEl.style.display = 'none';

  const start_time = document.getElementById('tt-start').value;
  const end_time   = document.getElementById('tt-end').value;
  const selectedDays = [...document.querySelectorAll('.day-btn.selected')].map(b => b.dataset.day);
  const days = selectedDays.join(',');
  const day_group = computeDayGroup(selectedDays);

  if (selectedDays.length === 0 || !start_time || !end_time) {
    errEl.textContent = 'Please select days and times';
    errEl.style.display = 'flex';
    return;
  }

  // School timing validation
  {
    const toMins = t => { const [h, m] = (t || '00:00').split(':'); return +h * 60 + +m; };
    const dayKeyMap = { Monday:'monday', Tuesday:'tuesday', Wednesday:'wednesday', Thursday:'thursday', Friday:'friday', Saturday:'saturday', Sunday:'sunday' };
    const startMins = toMins(start_time);
    const endMins   = toMins(end_time);
    let offendingDay = null;
    for (const day of selectedDays) {
      const dk = dayKeyMap[day] || day.toLowerCase();
      const ds = (schoolSettings[dk + '_start'] && schoolSettings[dk + '_start'] !== '') ? schoolSettings[dk + '_start'] : (schoolSettings.school_start || '08:00');
      const de = (schoolSettings[dk + '_end']   && schoolSettings[dk + '_end']   !== '') ? schoolSettings[dk + '_end']   : (schoolSettings.school_end   || '14:00');
      if (startMins < toMins(ds) || endMins > toMins(de)) {
        offendingDay = { day, start: ds, end: de };
        break;
      }
    }
    if (offendingDay) {
      const fmt = t => { const [h,m]=t.split(':'); const hr=+h; return `${hr%12||12}:${m} ${hr>=12?'PM':'AM'}`; };
      const msg = `This slot\'s time is outside ${offendingDay.day}\'s school hours (${fmt(offendingDay.start)} \u2013 ${fmt(offendingDay.end)}). Please check the time again.`;
      toast('\u23f0 Time is outside school hours. Please check the time again.', 'warning');
      errEl.textContent = msg;
      errEl.style.display = 'flex';
      return;
    }
  }

  let payload;
  if (isBreak) {
    const class_id = document.getElementById('tt-break-class').value;
    if (!class_id) { errEl.textContent = 'Please select a class for the break'; errEl.style.display = 'flex'; return; }
    payload = { class_id: +class_id, teacher_ids: [], subject: '', start_time, end_time, days, day_group, is_break: true };
  } else {
    const class_id = document.getElementById('tt-class').value;
    const teacherSelect = document.getElementById('tt-teacher');
    const teacher_ids = [...teacherSelect.selectedOptions].map(o => +o.value);
    const subject = document.getElementById('tt-subject').value.trim();
    if (!class_id || teacher_ids.length === 0 || !subject) {
      errEl.textContent = 'All fields are required — select class, at least one teacher, and enter subject';
      errEl.style.display = 'flex';
      return;
    }
    payload = { class_id: +class_id, teacher_ids, subject, start_time, end_time, days, day_group, is_break: false };
  }

  try {
    const url = id ? `${API.timetable}?id=${id}` : API.timetable;
    const method = id ? 'PUT' : 'POST';
    let resp;
    try {
      resp = await api(url, method, payload);
    } catch (e) {
      // Class-level time overlap warning — server already restricts this to admin/superadmin
      if (e._raw && e._raw.overlap_warning) {
        document.getElementById('conflict-msg').textContent = e._raw.message;
        document.getElementById('conflict-confirm-overlay').classList.add('open');
        window._pendingConflictPayload = { url, method, payload, _isOverlap: true };
        return;
      }
      // Teacher conflict warning — server already restricts this to admin/superadmin
      if (e._raw && e._raw.warning) {
        const msg = e._raw.message || `${e._raw.teacher_name} is already assigned to ${e._raw.class_name} at this time. Are you sure you want to add this too?`;
        document.getElementById('conflict-msg').textContent = msg;
        document.getElementById('conflict-confirm-overlay').classList.add('open');
        window._pendingConflictPayload = { url, method, payload, _isOverlap: false };
        return;
      }
      errEl.textContent = e.message;
      errEl.style.display = 'flex';
      return;
    }
    closeModal('tt-modal-overlay');
    toast('Timetable slot saved successfully', 'success');
    loadTimetable();
  } catch (e) { errEl.textContent = e.message; errEl.style.display = 'flex'; }
}

async function confirmConflict() {
  document.getElementById('conflict-confirm-overlay').classList.remove('open');
  if (!window._pendingConflictPayload) return;
  const { url, method, payload } = window._pendingConflictPayload;
  window._pendingConflictPayload = null;
  // Set both force flags so ALL conflict checks (class overlap + teacher conflict) are
  // bypassed in a single re-submit — prevents an infinite confirmation chain.
  payload.force_overlap   = true;
  payload.force_conflict  = true;
  try {
    await api(url, method, payload);
    closeModal('tt-modal-overlay');
    toast('Timetable slot saved (conflict override)', 'success');
    loadTimetable();
  } catch (e) {
    document.getElementById('tt-modal-error').textContent = e.message;
    document.getElementById('tt-modal-error').style.display = 'flex';
  }
}

function cancelConflict() {
  document.getElementById('conflict-confirm-overlay').classList.remove('open');
  window._pendingConflictPayload = null;
}

async function deleteConflictingSlot(conflictId) {
  const errEl = document.getElementById('tt-modal-error');
  try {
    await api(`${API.timetable}?id=${conflictId}`, 'DELETE');
    toast('Conflicting slot deleted', 'success');
    // Retry the original save
    if (window._pendingRetry) {
      const { url, method, payload } = window._pendingRetry;
      window._pendingRetry = null;
      try {
        await api(url, method, payload);
        closeModal('tt-modal-overlay');
        toast('Timetable slot saved successfully', 'success');
        loadTimetable();
      } catch (e2) {
        errEl.textContent = e2.message;
        errEl.style.display = 'flex';
        errEl.style.flexDirection = '';
      }
    } else {
      closeModal('tt-modal-overlay');
      loadTimetable();
    }
  } catch (e) {
    errEl.textContent = 'Failed to delete conflicting slot: ' + e.message;
    errEl.style.display = 'flex';
    errEl.style.flexDirection = '';
  }
}

// Inline update for timetable fields
async function updateTimetableField(el, field, id) {
  const newValue = el.textContent.trim();
  if (!newValue) {
    toast('Subject cannot be empty', 'error');
    // Revert
    const current = timetableSlots.find(s => s.id == id);
    el.textContent = current ? current[field] : '';
    return;
  }

  // Fetch current data
  const current = timetableSlots.find(s => s.id == id);
  if (!current) return;

  if (current[field] === newValue) return; // No change

  try {
    let payload = { ...current };
    payload[field] = newValue;

    // Send update
    await api(`${API.timetable}?id=${id}`, 'PUT', payload);
    toast('Updated successfully', 'success');
    // Update local data
    current[field] = newValue;
  } catch (e) {
    toast('Update failed: ' + e.message, 'error');
    // Revert
    el.textContent = current[field];
  }
}

// Parse time string like "9:00 AM" to "09:00"
function parseTime(str) {
  str = str.trim();
  const match = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;
  let hour = parseInt(match[1]);
  const min = match[2];
  const ampm = match[3]?.toUpperCase();
  if (ampm) {
    if (ampm === 'PM' && hour !== 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
  }
  return `${hour.toString().padStart(2,'0')}:${min}`;
}

// Inline update for timetable time
async function updateTimetableTime(el, id) {
  const text = el.textContent.trim();
  const match = text.match(/^(.+?)\s*-\s*(.+)$/);
  if (!match) {
    toast('Invalid time format. Use "Start Time - End Time" e.g. "9:00 AM - 10:00 AM"', 'error');
    revert();
    return;
  }
  const startStr = match[1].trim();
  const endStr = match[2].trim();
  const startTime = parseTime(startStr);
  const endTime = parseTime(endStr);
  if (!startTime || !endTime) {
    toast('Invalid time format', 'error');
    revert();
    return;
  }
  if (startTime >= endTime) {
    toast('End time must be after start time', 'error');
    revert();
    return;
  }
  const current = timetableSlots.find(s => s.id == id);
  if (!current) return;
  if (current.start_time === startTime && current.end_time === endTime) return; // No change
  try {
    const payload = { ...current, start_time: startTime, end_time: endTime };
    await api(`${API.timetable}?id=${id}`, 'PUT', payload);
    toast('Time updated successfully', 'success');
    current.start_time = startTime;
    current.end_time = endTime;
  } catch (e) {
    toast('Update failed: ' + e.message, 'error');
    revert();
  }
  function revert() {
    el.textContent = `${formatTime(current.start_time)} – ${formatTime(current.end_time)}`;
  }
}

// ===== AUTO TIMING FROM CLASS + DAY SETTINGS =====
function _ttAutoFillTiming(classId) {
  const s = schoolSettings || {};
  const toMins = t => { if (!t) return 0; const [h, m] = t.split(':'); return +h * 60 + +m; };
  const dayMap  = { Monday:'monday', Tuesday:'tuesday', Wednesday:'wednesday', Thursday:'thursday', Friday:'friday', Saturday:'saturday', Sunday:'sunday' };

  const selectedDays = [...document.querySelectorAll('.day-btn.selected')].map(b => b.dataset.day);

  // Resolve timing for a given class + day.
  // Priority: class-day override > class default > school-day override > school default
  function resolveFor(cid, day) {
    const dk = dayMap[day] || day.toLowerCase();
    const classDay   = { start: s[`classid_${cid}_${dk}_start`]  || '', end: s[`classid_${cid}_${dk}_end`]   || '' };
    const classDef   = { start: s[`classid_${cid}_start`]         || '', end: s[`classid_${cid}_end`]          || '' };
    const schoolDay  = { start: s[`${dk}_start`]                  || '', end: s[`${dk}_end`]                   || '' };
    const schoolDef  = { start: s.school_start                    || '08:00', end: s.school_end               || '14:00' };

    const start = classDay.start || classDef.start || schoolDay.start || schoolDef.start;
    const end   = classDay.end   || classDef.end   || schoolDay.end   || schoolDef.end;
    return { start, end };
  }

  let start, end;

  if (selectedDays.length === 1) {
    // Single day — use that day's resolved timing
    const t = resolveFor(classId, selectedDays[0]);
    start = t.start; end = t.end;
  } else if (selectedDays.length > 1) {
    // Multiple days — use class default (or school default); can't be per-day
    const dk   = '';
    const classDef  = { start: s[`classid_${classId}_start`] || '', end: s[`classid_${classId}_end`] || '' };
    const schoolDef = { start: s.school_start || '08:00', end: s.school_end || '14:00' };
    start = classDef.start || schoolDef.start;
    end   = classDef.end   || schoolDef.end;
  } else {
    // No day selected — use class default or school default
    const classDef  = { start: s[`classid_${classId}_start`] || '', end: s[`classid_${classId}_end`] || '' };
    const schoolDef = { start: s.school_start || '08:00', end: s.school_end || '14:00' };
    start = classDef.start || schoolDef.start;
    end   = classDef.end   || schoolDef.end;
  }

  if (start) document.getElementById('tt-start').value = start;
  if (end)   document.getElementById('tt-end').value   = end;
}

// ===== DAYS LOGIC =====
function toggleDay(el) {
  el.classList.toggle('selected');
  const classId = document.getElementById('tt-class').value;
  _ttAutoFillTiming(classId);
}

function applyPreset(preset) {
  clearDays();
  const presets = {
    'mon-tue': ['Monday','Tuesday'], 'wed-thu': ['Wednesday','Thursday'],
    'fri': ['Friday'], 'mon-thu': ['Monday','Tuesday','Wednesday','Thursday'],
    'mon-fri': ['Monday','Tuesday','Wednesday','Thursday','Friday']
  };
  const days = presets[preset] || [];
  document.querySelectorAll('.day-btn').forEach(btn => { if (days.includes(btn.dataset.day)) btn.classList.add('selected'); });
  document.getElementById('tt-day-group').value = preset;
}

function clearDays() {
  document.querySelectorAll('.day-btn').forEach(btn => btn.classList.remove('selected'));
  document.getElementById('tt-day-group').value = '';
}

function computeDayGroup(days) {
  const d = [...days].sort();
  const s = d.join(',');
  if (s === 'Friday') return 'fri';
  if (s === 'Monday,Tuesday') return 'mon-tue';
  if (s === 'Wednesday,Thursday') return 'wed-thu';
  if (d.every(x => ['Monday','Tuesday','Wednesday','Thursday'].includes(x)) && d.length === 4) return 'mon-thu';
  if (d.length === 5) return 'mon-fri';
  return s;
}

