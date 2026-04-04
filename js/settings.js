// ===== SETTINGS =====

var _addedClassIds = [];

// ── Smooth accordion (max-height based) ──────────────────────────────────────
function toggleAccordion(id) {
  const body  = document.getElementById(id);
  const arrow = document.getElementById(id + '-arrow');
  if (!body) return;
  const isOpen = body.classList.contains('accord-open');
  if (isOpen) {
    body.style.maxHeight = '0';
    body.classList.remove('accord-open');
    if (arrow) arrow.style.transform = '';
  } else {
    body.style.maxHeight = body.scrollHeight + 'px';
    body.classList.add('accord-open');
    if (arrow) arrow.style.transform = 'rotate(180deg)';
    // Re-expand after children change height (e.g. nested open)
    body.addEventListener('transitionend', () => {
      if (body.classList.contains('accord-open')) body.style.maxHeight = 'none';
    }, { once: true });
  }
}

// ── Searchable class dropdown ─────────────────────────────────────────────────
function settingsClassOpen() {
  const dd = document.getElementById('settings-class-dropdown');
  const dp = document.getElementById('settings-class-display');
  if (dd.classList.contains('open')) { _settingsClassClose(); return; }
  document.getElementById('settings-class-search').value = '';
  _settingsClassRender('');
  dd.classList.add('open');
  dp.classList.add('open');
  setTimeout(() => document.getElementById('settings-class-search').focus(), 50);
  setTimeout(() => document.addEventListener('click', _settingsClassOutside), 0);
}

function _settingsClassOutside(e) {
  if (!document.getElementById('settings-class-wrapper').contains(e.target)) _settingsClassClose();
}

function _settingsClassClose() {
  document.getElementById('settings-class-dropdown').classList.remove('open');
  document.getElementById('settings-class-display').classList.remove('open');
  document.removeEventListener('click', _settingsClassOutside);
}

function settingsClassFilter(q) { _settingsClassRender(q); }

function _settingsClassRender(q) {
  const list      = document.getElementById('settings-class-list');
  const available = classes.filter(c => !_addedClassIds.includes(c.id));
  const filtered  = q ? available.filter(c => c.name.toLowerCase().includes(q.toLowerCase())) : available;
  if (!available.length) {
    list.innerHTML = '<div style="padding:12px 14px;color:var(--text-muted);font-size:0.88rem">All classes already added</div>';
    return;
  }
  if (!filtered.length) {
    list.innerHTML = '<div style="padding:12px 14px;color:var(--text-muted);font-size:0.88rem">No classes match</div>';
    return;
  }
  const cur = document.getElementById('settings-class-value').value;
  list.innerHTML = filtered.map(c => {
    const sel = String(c.id) === String(cur);
    return `<div class="ss-opt" onmousedown="settingsClassSelect(${c.id},'${escapeHtml(c.name).replace(/'/g,"&#39;")}')"
      style="color:${sel ? 'var(--accent)' : 'var(--text)'};background:${sel ? 'rgba(201,168,76,0.12)' : 'transparent'}"
      onmouseenter="this.style.background='rgba(201,168,76,0.1)'"
      onmouseleave="this.style.background='${sel ? 'rgba(201,168,76,0.12)' : 'transparent'}'"
    >${escapeHtml(c.name)}</div>`;
  }).join('');
}

function settingsClassSelect(id, name) {
  document.getElementById('settings-class-value').value = id;
  document.getElementById('settings-class-display-text').textContent = name;
  document.getElementById('settings-class-display-text').style.color = 'var(--text)';
  _settingsClassClose();
}

function _settingsClassReset() {
  document.getElementById('settings-class-value').value = '';
  const txt = document.getElementById('settings-class-display-text');
  txt.textContent = 'Select a class...';
  txt.style.color = 'var(--text-muted)';
}

// ── Load settings ─────────────────────────────────────────────────────────────
async function loadSettings() {
  const s = await api(API.settings).catch(() => schoolSettings);
  schoolSettings = s;

  document.getElementById('settings-start').value = s.school_start || '08:00';
  document.getElementById('settings-end').value   = s.school_end   || '14:00';

  const days = ['Monday','Tuesday','Wednesday','Thursday','Friday'];

  // School hours by day
  document.getElementById('day-timings').innerHTML = days.map(day => buildDayRow(day, s, '')).join('');

  // Load classes
  if (!classes.length) classes = await api(API.classes).catch(() => []);

  // Clear DOM and state before re-rendering
  document.getElementById('class-entries').innerHTML = '';
  _addedClassIds = [];
  _settingsClassReset();

  // Restore saved class entries (only those with actual saved times)
  classes.forEach(c => {
    const hasSaved = s[`classid_${c.id}_start`] || s[`classid_${c.id}_end`]
      || days.some(d => s[`classid_${c.id}_${d.toLowerCase()}_start`] || s[`classid_${c.id}_${d.toLowerCase()}_end`]);
    if (hasSaved) renderClassEntry(c, s);
  });

  // Close any open accordions from previous visit
  document.querySelectorAll('.accord-body.accord-open').forEach(el => {
    el.classList.remove('accord-open');
    el.style.maxHeight = '0';
  });
  document.querySelectorAll('.accord-arrow').forEach(el => { el.style.transform = ''; });
}

// ── Day row builder ───────────────────────────────────────────────────────────
function buildDayRow(day, s, prefix) {
  const dk       = day.toLowerCase();
  const startVal = s[`${prefix}${dk}_start`] || '';
  const endVal   = s[`${prefix}${dk}_end`]   || '';
  return `<div class="settings-day-row">
    <div class="settings-day-label">${day}</div>
    <div class="settings-time-pair">
      <div class="settings-time-cell">
        <label class="settings-time-lbl">Start</label>
        <input type="time" id="${prefix}day-start-${dk}" value="${startVal}" class="settings-time-sm">
      </div>
      <div class="settings-time-cell">
        <label class="settings-time-lbl">End</label>
        <input type="time" id="${prefix}day-end-${dk}" value="${endVal}" class="settings-time-sm">
      </div>
    </div>
  </div>`;
}

// ── Add / render / remove class entry ────────────────────────────────────────
function addClassEntry() {
  const id = parseInt(document.getElementById('settings-class-value').value);
  if (!id) return;
  const c = classes.find(x => x.id == id);
  if (!c) return;
  renderClassEntry(c, schoolSettings || {});
  _settingsClassReset();
  _settingsClassRender('');
}

function renderClassEntry(c, s) {
  if (_addedClassIds.includes(c.id)) return;
  _addedClassIds.push(c.id);

  const days     = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
  const startVal = s[`classid_${c.id}_start`] || '';
  const endVal   = s[`classid_${c.id}_end`]   || '';

  const dayRows = days.map(day => {
    const dk = day.toLowerCase();
    const sv = s[`classid_${c.id}_${dk}_start`] || '';
    const ev = s[`classid_${c.id}_${dk}_end`]   || '';
    return `<div class="settings-day-row">
      <div class="settings-day-label">${day}</div>
      <div class="settings-time-pair">
        <div class="settings-time-cell">
          <label class="settings-time-lbl">Start</label>
          <input type="time" id="classid-${c.id}-day-start-${dk}" value="${sv}" class="settings-time-sm">
        </div>
        <div class="settings-time-cell">
          <label class="settings-time-lbl">End</label>
          <input type="time" id="classid-${c.id}-day-end-${dk}" value="${ev}" class="settings-time-sm">
        </div>
      </div>
    </div>`;
  }).join('');

  const el = document.createElement('div');
  el.id = `class-entry-${c.id}`;
  el.className = 'class-entry-block';
  el.innerHTML = `
    <div class="class-entry-header">
      <span class="class-entry-name">🎓 ${escapeHtml(c.name)}</span>
      <button class="class-entry-remove" onclick="removeClassEntry(${c.id})" title="Remove">×</button>
    </div>

    <div class="class-sub-accord">
      <div class="class-sub-accord-hdr" onclick="toggleAccordion('class-hours-${c.id}')">
        <div style="display:flex;align-items:center;gap:7px">
          <span>🕐</span>
          <span>School Hours — ${escapeHtml(c.name)}</span>
        </div>
        <span id="class-hours-${c.id}-arrow" class="accord-arrow">▼</span>
      </div>
      <div id="class-hours-${c.id}" class="accord-body" style="max-height:0">
        <div style="padding:14px 16px">
          <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">
            <div class="form-group" style="margin:0;flex:1;min-width:150px">
              <label style="margin-bottom:6px;font-size:0.82rem">Start Time</label>
              <input type="time" id="classid-start-${c.id}" value="${startVal}" class="settings-time-input">
            </div>
            <div style="color:var(--text-muted);font-size:1rem;padding-top:20px">→</div>
            <div class="form-group" style="margin:0;flex:1;min-width:150px">
              <label style="margin-bottom:6px;font-size:0.82rem">End Time</label>
              <input type="time" id="classid-end-${c.id}" value="${endVal}" class="settings-time-input">
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="class-sub-accord">
      <div class="class-sub-accord-hdr" onclick="toggleAccordion('class-day-${c.id}')">
        <div style="display:flex;align-items:center;gap:7px">
          <span>📅</span>
          <span>School Hours by Day — ${escapeHtml(c.name)}</span>
        </div>
        <span id="class-day-${c.id}-arrow" class="accord-arrow">▼</span>
      </div>
      <div id="class-day-${c.id}" class="accord-body" style="max-height:0">
        <div style="padding:10px 16px 8px">${dayRows}</div>
      </div>
    </div>
  `;

  document.getElementById('class-entries').appendChild(el);
}

function removeClassEntry(id) {
  const el = document.getElementById(`class-entry-${id}`);
  if (el) el.remove();
  _addedClassIds = _addedClassIds.filter(x => x !== id);
  _settingsClassRender('');
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function _timeToMinutes(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}
function _fmtTime(t) {
  if (!t) return t;
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

// ── Styled timing-change confirmation modal ───────────────────────────────────
var _timingConfirmResolve = null;

function _showTimingConfirm(summaryHtml) {
  return new Promise(resolve => {
    document.getElementById('timing-confirm-summary').innerHTML = summaryHtml;
    _timingConfirmResolve = (confirmed) => {
      document.getElementById('timing-confirm-overlay').classList.remove('open');
      _timingConfirmResolve = null;
      resolve(confirmed);
    };
    document.getElementById('timing-confirm-overlay').classList.add('open');
  });
}

// ── Save ──────────────────────────────────────────────────────────────────────
async function saveSettings() {
  const school_start = document.getElementById('settings-start').value;
  const school_end   = document.getElementById('settings-end').value;
  const msgEl        = document.getElementById('settings-msg');
  msgEl.style.display = 'none';

  const days    = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
  const payload = { school_start, school_end };

  // School hours by day
  days.forEach(day => {
    const dk = day.toLowerCase();
    payload[`${dk}_start`] = document.getElementById(`day-start-${dk}`)?.value || '';
    payload[`${dk}_end`]   = document.getElementById(`day-end-${dk}`)?.value   || '';
  });

  // Class-specific: default + by day
  _addedClassIds.forEach(id => {
    payload[`classid_${id}_start`] = document.getElementById(`classid-start-${id}`)?.value || '';
    payload[`classid_${id}_end`]   = document.getElementById(`classid-end-${id}`)?.value   || '';
    days.forEach(day => {
      const dk = day.toLowerCase();
      payload[`classid_${id}_${dk}_start`] = document.getElementById(`classid-${id}-day-start-${dk}`)?.value || '';
      payload[`classid_${id}_${dk}_end`]   = document.getElementById(`classid-${id}-day-end-${dk}`)?.value   || '';
    });
  });

  // ── Detect timing changes and ask for timetable update ────────────────────
  const oldStart = (schoolSettings.school_start || '08:00').substring(0, 5);
  const newStart = school_start.substring(0, 5);
  const defaultShiftMins = _timeToMinutes(newStart) - _timeToMinutes(oldStart);

  let classShiftExists = false;
  _addedClassIds.forEach(id => {
    const nv = (document.getElementById(`classid-start-${id}`)?.value || '').substring(0, 5);
    const ov = (schoolSettings[`classid_${id}_start`] || '').substring(0, 5);
    if (nv !== ov) classShiftExists = true;
  });

  // Detect per-day default changes (extra shift beyond the default)
  let dayShiftExists = false;
  days.forEach(day => {
    const dk     = day.toLowerCase();
    const nv     = (document.getElementById(`day-start-${dk}`)?.value || '').substring(0, 5);
    const ov     = (schoolSettings[`${dk}_start`] || '').substring(0, 5);
    const effOld = _timeToMinutes(ov || oldStart);
    const effNew = _timeToMinutes(nv || newStart);
    if ((effNew - effOld) - defaultShiftMins !== 0) dayShiftExists = true;
  });

  // Detect per-day class-specific changes
  let classDayShiftExists = false;
  _addedClassIds.forEach(id => {
    const classOld = (schoolSettings[`classid_${id}_start`] || '').substring(0, 5);
    const classNew = (document.getElementById(`classid-start-${id}`)?.value || '').substring(0, 5);
    const classShiftMins = _timeToMinutes(classNew || newStart) - _timeToMinutes(classOld || oldStart);
    days.forEach(day => {
      const dk     = day.toLowerCase();
      const nv     = (document.getElementById(`classid-${id}-day-start-${dk}`)?.value || '').substring(0, 5);
      const ov     = (schoolSettings[`classid_${id}_${dk}_start`] || '').substring(0, 5);
      const effOld = _timeToMinutes(ov || classOld || (schoolSettings[`${dk}_start`] || '') || oldStart);
      const effNew = _timeToMinutes(nv || classNew || (document.getElementById(`day-start-${dk}`)?.value || '') || newStart);
      if ((effNew - effOld) - classShiftMins !== 0) classDayShiftExists = true;
    });
  });

  if (defaultShiftMins !== 0 || classShiftExists || dayShiftExists || classDayShiftExists) {
    let lines = [];
    if (defaultShiftMins !== 0) {
      const absM = Math.abs(defaultShiftMins);
      const absH = absM / 60;
      const dir  = defaultShiftMins > 0 ? '▶ forward' : '◀ back';
      const hLabel = Number.isInteger(absH) ? `${absH} hr` : `${absM} min`;
      const oldFmt = _fmtTime(oldStart);
      const newFmt = _fmtTime(newStart);
      lines.push(`<strong>Default school start:</strong> ${oldFmt} → ${newFmt} <span style="color:var(--accent)">(${dir} ${hLabel})</span>`);
    }
    if (dayShiftExists) {
      lines.push(`<strong>School hours by day</strong> have been updated.`);
    }
    if (classShiftExists) {
      lines.push(`<strong>Class-specific hours</strong> have also been updated.`);
    }
    if (classDayShiftExists) {
      lines.push(`<strong>Class-specific hours by day</strong> have been updated.`);
    }
    const summaryHtml = lines.join('<br>');
    const confirmed = await _showTimingConfirm(summaryHtml);
    if (!confirmed) return;
    payload.update_timetable = true;
  }

  try {
    const result = await api(API.settings, 'POST', payload);
    schoolSettings = { ...schoolSettings, ...payload };
    const trackFrom = document.getElementById('track-time-from');
    const trackTo   = document.getElementById('track-time-to');
    if (trackFrom) trackFrom.value = school_start;
    if (trackTo)   trackTo.value   = school_end;

    let successMsg = '✓ Settings saved successfully';
    if (result.timetable_updated > 0) {
      successMsg += ` — ${result.timetable_updated} timetable slot(s) updated`;
    }
    msgEl.className   = 'alert alert-success';
    msgEl.textContent = successMsg;
    msgEl.style.display = 'flex';
    setTimeout(() => { msgEl.style.display = 'none'; }, 4000);
    toast(result.timetable_updated > 0
      ? `Settings saved · ${result.timetable_updated} timetable slots updated`
      : 'Settings saved', 'success');
  } catch(e) {
    msgEl.className   = 'alert alert-error';
    msgEl.textContent = e.message;
    msgEl.style.display = 'flex';
  }
}
