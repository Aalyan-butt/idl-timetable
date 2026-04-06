// ===== NAVIGATION =====
function toggleNavGroup(groupId) {
  const group = document.getElementById(groupId);
  if (!group) return;
  const header = group.querySelector('.nav-group-header');
  const body   = document.getElementById(groupId + '-body');
  const isOpen = body.classList.contains('open');
  header.classList.toggle('open', !isOpen);
  body.classList.toggle('open', !isOpen);
}

const _pageLoaded = new Set(['dashboard']);
var _currentPage  = 'dashboard';

async function showPage(name) {
  // Guard: if leaving performance-marks with unsaved marks, intercept and show dialog
  if (_currentPage === 'performance-marks' && name !== 'performance-marks') {
    if (typeof pmHasDirtyChanges === 'function' && pmHasDirtyChanges()) {
      if (typeof pmShowUnsavedGuard === 'function') pmShowUnsavedGuard(name);
      return;
    }
  }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.nav-sub-item').forEach(n => n.classList.remove('active'));

  if (!_pageLoaded.has(name)) {
    const container = document.getElementById(`page-${name}`);
    if (container) {
      try {
        const res = await fetch(`pages/${name}.html`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        container.innerHTML = await res.text();
        _pageLoaded.add(name);
        initAllSelects();
      } catch (err) {
        container.innerHTML = `<div class="empty-state" style="padding:48px;text-align:center;color:var(--text-muted)">Failed to load page.<br><button class="btn btn-secondary btn-sm" style="margin-top:12px" onclick="showPage('${name}')">Retry</button></div>`;
        return;
      }
    }
  }

  document.getElementById(`page-${name}`).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.getAttribute('onclick')?.includes(`'${name}'`)) item.classList.add('active');
  });
  const subItem = document.getElementById('subnav-' + name);
  if (subItem) {
    subItem.classList.add('active');
    const groupBody = subItem.closest('.nav-group-body');
    if (groupBody) {
      groupBody.classList.add('open');
      const groupId = groupBody.id.replace('-body', '');
      const header = document.querySelector(`#${groupId} .nav-group-header`);
      if (header) header.classList.add('open');
    }
  }
  if (window.innerWidth <= 768) closeSidebar();
  const searchMap = { teachers: 'teachers-search', classes: 'classes-search', users: 'users-search', students: 'students-search' };
  if (searchMap[name]) { const el = document.getElementById(searchMap[name]); if (el) el.value = ''; }
  try { localStorage.setItem('idl_last_page', name); } catch(e) {}
  _currentPage = name;
  history.replaceState(null, '', '#' + name);
  if (name === 'dashboard') loadDashboard();
  if (name === 'teachers')  loadTeachers();
  if (name === 'classes')   loadClasses();
  if (name === 'timetable') loadTimetable();
  if (name === 'break')     loadBreak();
  if (name === 'track')     loadTrack();
  if (name === 'search')    loadSearch();
  if (name === 'users')     loadUsers();
  if (name === 'settings') { loadSettings(); }
  if (name === 'user-classes')   loadUserClasses();
  if (name === 'user-timetable') loadUserTimetable();
  if (name === 'notifications')  loadNotifications();
  if (name === 'students')              loadStudents();
  if (name === 'student-notifications') loadStudentNotifications();
  if (name === 'class-enrollment')      loadClassEnrollment();
  if (name === 'class-subjects')        initClassSubjectsPage();
  if (name === 'class-list')            loadClassList();
  if (name === 'subject-enrollment')    loadSubjectEnrollment();
  if (name === 'student-profile') {}
  if (name === 'student-schedule') loadStudentSchedule();
  if (name === 'parent-schedule')      loadParentSchedule();
  if (name === 'parent-information')   loadParentInformation();
  if (name === 'performance-tests')    loadPerformanceTests();
  if (name === 'performance-marks')    loadPerformanceMarks();
  if (name === 'performance-analysis') loadPerformanceAnalysis();
}

// ===== DATA LOADING =====
async function loadAllData() {
  [teachers, classes, timetableSlots] = await Promise.all([
    api(API.teachers).catch(() => []),
    api(API.classes).catch(() => []),
    api(API.timetable).catch(() => [])
  ]);
}

// Helper: normalize title for display
function normalizeTitle(title) {
  if (!title) return '';
  return title;
}

async function loadDashboard() {
  // Parent role: show today's classes for all children
  if (currentUser?.role === 'parent') {
    document.getElementById('stats-grid').style.display        = 'none';
    document.getElementById('next-classes-card').style.display = 'none';
    document.getElementById('recent-tt-card').style.display    = 'none';
    document.getElementById('student-dashboard-section').style.display = 'none';
    document.getElementById('parent-dashboard-section').style.display  = '';
    _loadParentTodayDashboard();
    return;
  }

  // Student role: show only today's upcoming classes on the dashboard
  if (currentUser?.role === 'student') {
    document.getElementById('stats-grid').style.display       = 'none';
    document.getElementById('next-classes-card').style.display = 'none';
    document.getElementById('recent-tt-card').style.display   = 'none';
    document.getElementById('student-dashboard-section').style.display = '';
    document.getElementById('parent-dashboard-section').style.display  = 'none';
    _loadStudentTodayDashboard();
    return;
  }

  // Non-student/parent: hide student/parent sections
  document.getElementById('student-dashboard-section').style.display = 'none';
  document.getElementById('parent-dashboard-section').style.display  = 'none';

  await loadAllData();
  const pkNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));
  const pkDay = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][pkNow.getDay()];
  const pkHH = String(pkNow.getHours()).padStart(2,'0');
  const pkMM = String(pkNow.getMinutes()).padStart(2,'0');
  const pkTime = `${pkHH}:${pkMM}`;
  const pkTimeDisp = pkNow.toLocaleTimeString('en-PK', { hour:'2-digit', minute:'2-digit', timeZone:'Asia/Karachi' });
  document.getElementById('pk-time-display').textContent = `${pkTimeDisp} (${pkDay})`;

  const isSupvDash = currentUser?.role === 'supervisor';
  const isViewerDash = currentUser?.role === 'user';

  if (!isViewerDash) {
    if (isSupvDash) {
      const supvTIds = (currentUser.supervisor_teacher_ids||'').split(',').filter(Boolean);
      const supvCIds = (currentUser.supervisor_class_ids||'').split(',').filter(Boolean);
      const supvUIds = (currentUser.supervisor_user_ids||'').split(',').filter(Boolean);
      document.getElementById('stat-teachers').textContent = supvTIds.length;
      document.getElementById('stat-classes').textContent  = supvCIds.length;
      document.getElementById('stat-users').textContent    = supvUIds.length;
      const lblT = document.getElementById('stat-teachers-label'); if (lblT) lblT.textContent = 'Assigned Teachers';
      const lblC = document.getElementById('stat-classes-label');  if (lblC) lblC.textContent = 'Assigned Classes';
    } else {
      document.getElementById('stat-teachers').textContent = teachers.length;
      document.getElementById('stat-classes').textContent  = classes.length;
      try {
        const users = await api(API.users);
        document.getElementById('stat-users').textContent = users.length;
      } catch { document.getElementById('stat-users').textContent = '—'; }
    }
    // Sort by time then recent
    const recent = [...timetableSlots].sort((a,b) => (a.start_time||'').localeCompare(b.start_time||'')).slice(0,10);
    const tbody = document.getElementById('recent-tt-body');
    if (recent.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px">No Data Found</td></tr>';
    } else {
      tbody.innerHTML = recent.map(s => {
        if (s.is_break) return `<tr class="break-row"><td><span class="badge badge-blue">${s.class_name||'—'}</span></td><td colspan="2"><span class="break-label">☕ BREAK</span></td><td><span class="badge badge-blue">${formatDays(s.days)}</span></td><td>${formatTime(s.start_time)} – ${formatTime(s.end_time)}</td></tr>`;
        const ids = (s.teacher_ids ? s.teacher_ids.split(',') : [String(s.teacher_id)]);
        const teacherLabel = ids.map(tid => { const t = teachers.find(x=>String(x.id)===String(tid)); return t?`${normalizeTitle(t.title)} ${t.name}`:''; }).filter(Boolean).join(', ');
        return `<tr><td>${s.class_name}</td><td>${s.subject}</td><td><span class="badge badge-gold">${teacherLabel}</span></td><td><span class="badge badge-blue">${formatDays(s.days)}</span></td><td>${formatTime(s.start_time)} – ${formatTime(s.end_time)}</td></tr>`;
      }).join('');
    }
  }

  const nextClassesEl = document.getElementById('next-classes-body');
  const isUserRole = currentUser?.role === 'user';

  // User's assigned teacher IDs — their personal schedule filter
  const myTeacherIds = isUserRole
    ? (currentUser.teacher_ids_perm || '').split(',').map(x => x.trim()).filter(Boolean) : null;

  // For supervisors, filter by assigned class IDs
  const supervisorClassIds = currentUser?.role === 'supervisor'
    ? (currentUser.supervisor_class_ids||'').split(',').map(x=>x.trim()).filter(Boolean) : null;

  const todaySlots = timetableSlots.filter(s => !s.is_break).filter(s => {
    if (!s.days) return false;
    return s.days.split(',').map(d => d.trim()).includes(pkDay);
  }).filter(s => {
    // User role: show full day so past slots appear as DONE
    if (isUserRole) return true;
    return (s.end_time||'').substring(0,5) > pkTime;
  }).filter(s => {
    if (!isUserRole) {
      // Supervisor: restrict to assigned classes
      if (supervisorClassIds) return supervisorClassIds.includes(String(s.class_id));
      return true;
    }
    // User role: slot must include one of the user's teacher IDs
    if (!myTeacherIds || myTeacherIds.length === 0) return false;
    if (s.is_break) return false; // breaks are class-wide, not personal
    const slotTids = (s.teacher_ids ? s.teacher_ids.split(',') : [String(s.teacher_id)]).map(x => x.trim());
    return slotTids.some(tid => myTeacherIds.includes(tid));
  }).sort((a,b) => (a.start_time||'').localeCompare(b.start_time||''));

  // Update card title
  const cardTitleEl = document.querySelector('#next-classes-card .card-title span:first-child');
  if (cardTitleEl) cardTitleEl.textContent = isUserRole ? '📅 My Schedule Today' : '🕐 Upcoming Classes Today';

  if (todaySlots.length === 0) {
    if (isUserRole && (!myTeacherIds || myTeacherIds.length === 0)) {
      nextClassesEl.innerHTML = `<p style="text-align:center;padding:28px 0;color:var(--text-muted);font-size:1rem">No teachers assigned to your account yet.</p>`;
    } else {
      nextClassesEl.innerHTML = `<p style="text-align:center;padding:28px 0;color:var(--text-muted);font-size:1rem">No ${isUserRole ? '' : 'more '}classes scheduled for today (${pkDay}).</p>`;
    }
  } else {
    const slotCount = todaySlots.length;
    nextClassesEl.innerHTML = `<div style="display:flex;flex-direction:column;gap:10px">${todaySlots.map(s => {
      const startStr = s.start_time.substring(0,5);
      const endStr   = s.end_time.substring(0,5);
      const isNow    = startStr <= pkTime && endStr > pkTime;
      const isDone   = isUserRole && endStr <= pkTime;
      const doneStyle = isDone ? 'opacity:0.45;' : '';
      if (s.is_break) {
        return `<div style="${doneStyle}display:flex;justify-content:space-between;align-items:center;padding:14px 18px;background:rgba(255,165,0,0.06);border:1px solid rgba(255,165,0,0.2);border-radius:8px;flex-wrap:wrap;gap:8px">
          <div style="display:flex;align-items:center;gap:12px">
            <span style="font-size:1.1rem">☕</span>
            <span style="font-size:1.05rem;font-weight:700;color:#ffa500">Break</span>
            <span style="font-size:0.82rem;color:#7ab4ff;background:rgba(68,136,255,0.12);border:1px solid rgba(68,136,255,0.25);border-radius:20px;padding:2px 10px">${s.class_name}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;font-size:0.92rem;color:var(--text-muted)">
            ${isDone ? '<span style="font-size:0.7rem;color:#888;background:rgba(255,255,255,0.06);padding:2px 8px;border-radius:4px;letter-spacing:0.5px">DONE</span>' : ''}
            ${formatTime(s.start_time)} – ${formatTime(s.end_time)}
          </div>
        </div>`;
      }
      const ids = (s.teacher_ids ? s.teacher_ids.split(',') : [String(s.teacher_id)]);
      const displayIds = (isUserRole && myTeacherIds && myTeacherIds.length > 0)
        ? ids.filter(tid => myTeacherIds.includes(tid.trim()))
        : ids;
      const teacherNames = displayIds.map(tid => { const t = teachers.find(x=>String(x.id)===String(tid.trim())); return t?`${normalizeTitle(t.title)} ${t.name}`:''; }).filter(Boolean).join(', ');
      const background = isNow ? 'rgba(201,168,76,0.07)' : 'rgba(255,255,255,0.02)';
      const border = isNow ? 'rgba(201,168,76,0.35)' : 'rgba(255,255,255,0.06)';
      const color = isDone ? '#888' : '#ffffff';
      const style = `${doneStyle}display:flex;justify-content:space-between;align-items:center;padding:14px 18px;background:${background};border:1px solid ${border};border-radius:8px;flex-wrap:wrap;gap:8px`;
      return `<div style="${style}">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          ${isNow ? '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--accent);box-shadow:0 0 8px var(--accent);flex-shrink:0"></span>' : '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:rgba(255,255,255,0.12);flex-shrink:0"></span>'}
          <span style="font-size:1.05rem;font-weight:700;color:${color}">${s.subject}</span>
          ${isNow ? '<span style="font-size:0.72rem;color:var(--accent);font-weight:700;letter-spacing:1px;text-transform:uppercase;background:rgba(201,168,76,0.12);padding:2px 8px;border-radius:4px">NOW</span>' : ''}
          ${isDone ? '<span style="font-size:0.7rem;color:#888;background:rgba(255,255,255,0.06);padding:2px 8px;border-radius:4px;letter-spacing:0.5px">DONE</span>' : ''}
          <span style="font-size:0.82rem;color:#7ab4ff;background:rgba(68,136,255,0.12);border:1px solid rgba(68,136,255,0.25);border-radius:20px;padding:2px 10px">${s.class_name}</span>
        </div>
        <div style="font-size:0.92rem;color:var(--text-muted)">${teacherNames} &nbsp;·&nbsp; ${formatTime(s.start_time)} – ${formatTime(s.end_time)}</div>
      </div>`;
    }).join('')}${isUserRole ? `<p style="font-size:0.85rem;color:var(--text-muted);text-align:center;padding:6px 0">${slotCount} class${slotCount!==1?'es':''} scheduled for today</p>` : (slotCount > 8 ? `<p style="font-size:0.9rem;color:var(--text-muted);text-align:center;padding:8px">+${slotCount-8} more classes today</p>` : '')}</div>`;
    }
}

async function _loadStudentTodayDashboard() {
  const bodyEl = document.getElementById('student-today-dashboard');
  const timeEl = document.getElementById('student-pk-time');
  if (!bodyEl) return;

  const pkNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));
  const pkDay = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][pkNow.getDay()];
  const pkHH  = String(pkNow.getHours()).padStart(2,'0');
  const pkMM  = String(pkNow.getMinutes()).padStart(2,'0');
  const pkTime = `${pkHH}:${pkMM}`;
  const pkTimeDisp = pkNow.toLocaleTimeString('en-PK', { hour:'2-digit', minute:'2-digit', timeZone:'Asia/Karachi' });
  if (timeEl) timeEl.textContent = `${pkTimeDisp} \u2014 ${pkDay}`;

  try {
    await loadAllData();
    const data = await api(`${API.students}?action=my_schedule`);

    if (!data.slots || !data.slots.length) {
      bodyEl.innerHTML = `<p style="text-align:center;padding:20px 0;color:var(--text-muted)">No schedule found for your class.</p>`;
      return;
    }

    const todaySlots = data.slots
      .filter(s => s.days && s.days.split(',').map(d => d.trim()).includes(pkDay))
      .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));

    if (!todaySlots.length) {
      bodyEl.innerHTML = `<p style="text-align:center;padding:20px 0;color:var(--text-muted)">No classes scheduled for today (${pkDay}).</p>`;
      return;
    }

    const items = todaySlots.map(s => {
      const startStr  = (s.start_time || '').substring(0, 5);
      const endStr    = (s.end_time   || '').substring(0, 5);
      const isNow     = startStr <= pkTime && endStr > pkTime;
      const isDone    = endStr <= pkTime;
      const doneStyle = isDone ? 'opacity:0.45;' : '';

      if (s.is_break) {
        return `<div style="${doneStyle}display:flex;justify-content:space-between;align-items:center;padding:14px 18px;background:rgba(255,165,0,0.06);border:1px solid rgba(255,165,0,0.2);border-radius:8px;flex-wrap:wrap;gap:8px">
          <div style="display:flex;align-items:center;gap:12px">
            <span style="font-size:1.1rem">&#9749;</span>
            <span style="font-size:1.05rem;font-weight:700;color:#ffa500">Break</span>
          </div>
          <div style="font-size:0.92rem;color:var(--text-muted)">${isDone ? '<span style="font-size:0.7rem;color:#888;background:rgba(255,255,255,0.06);padding:2px 8px;border-radius:4px;letter-spacing:.5px;margin-right:6px">DONE</span>' : ''}${formatTime(s.start_time)} \u2013 ${formatTime(s.end_time)}</div>
        </div>`;
      }

      const ids = (s.teacher_ids ? s.teacher_ids.split(',') : [String(s.teacher_id)]).filter(Boolean);
      const teacherNames = ids.map(tid => { const t = teachers.find(x => String(x.id) === String(tid.trim())); return t ? `${normalizeTitle(t.title)} ${t.name}` : ''; }).filter(Boolean).join(', ');
      const bg     = isNow ? 'rgba(201,168,76,0.07)' : 'rgba(255,255,255,0.02)';
      const border = isNow ? 'rgba(201,168,76,0.35)' : 'rgba(255,255,255,0.06)';
      const col    = isDone ? '#888' : '#ffffff';
      const dot    = isNow
        ? '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--accent);box-shadow:0 0 8px var(--accent);flex-shrink:0"></span>'
        : '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:rgba(255,255,255,0.12);flex-shrink:0"></span>';
      return `<div style="${doneStyle}display:flex;justify-content:space-between;align-items:center;padding:14px 18px;background:${bg};border:1px solid ${border};border-radius:8px;flex-wrap:wrap;gap:8px">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          ${dot}
          <span style="font-size:1.05rem;font-weight:700;color:${col}">${escapeHtml(s.subject || '')}</span>
          ${isNow ? '<span style="font-size:0.72rem;color:var(--accent);font-weight:700;letter-spacing:1px;text-transform:uppercase;background:rgba(201,168,76,0.12);padding:2px 8px;border-radius:4px">NOW</span>' : ''}
          ${isDone ? '<span style="font-size:0.7rem;color:#888;background:rgba(255,255,255,0.06);padding:2px 8px;border-radius:4px;letter-spacing:.5px">DONE</span>' : ''}
        </div>
        <div style="font-size:0.92rem;color:var(--text-muted)">${escapeHtml(teacherNames || '\u2014')} &nbsp;\u00b7&nbsp; ${formatTime(s.start_time)} \u2013 ${formatTime(s.end_time)}</div>
      </div>`;
    }).join('');

    const total = todaySlots.length;
    bodyEl.innerHTML = `<div style="display:flex;flex-direction:column;gap:10px">${items}</div>
      <p style="font-size:0.85rem;color:var(--text-muted);text-align:center;padding:10px 0 0">${total} class${total !== 1 ? 'es' : ''} scheduled today</p>`;
  } catch (e) {
    bodyEl.innerHTML = `<div class="alert alert-error">${escapeHtml(e.message)}</div>`;
  }
}

async function _loadParentTodayDashboard() {
  const bodyEl = document.getElementById('parent-today-dashboard');
  const timeEl = document.getElementById('parent-pk-time');
  if (!bodyEl) return;

  const pkNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));
  const pkDay = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][pkNow.getDay()];
  const pkHH  = String(pkNow.getHours()).padStart(2,'0');
  const pkMM  = String(pkNow.getMinutes()).padStart(2,'0');
  const pkTime = `${pkHH}:${pkMM}`;
  const pkTimeDisp = pkNow.toLocaleTimeString('en-PK', { hour:'2-digit', minute:'2-digit', timeZone:'Asia/Karachi' });
  if (timeEl) timeEl.textContent = `${pkTimeDisp} \u2014 ${pkDay}`;

  try {
    await loadAllData();
    const data = await api(`${API.students}?action=my_children`);
    const children = data.children || [];

    if (!children.length) {
      bodyEl.innerHTML = `<p style="text-align:center;padding:20px 0;color:var(--text-muted)">No children linked to your account.</p>`;
      return;
    }

    // Fetch schedule for each child in parallel
    const schedules = await Promise.all(children.map(c =>
      api(`${API.students}?action=my_schedule&child_id=${c.id}`).catch(() => ({ slots: [] }))
    ));

    let html = '';
    let totalToday = 0;

    children.forEach((child, idx) => {
      const slots = schedules[idx]?.slots || [];
      const todaySlots = slots
        .filter(s => s.days && s.days.split(',').map(d => d.trim()).includes(pkDay))
        .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));

      const childName = `${child.first_name || ''} ${child.last_name || ''}`.trim();
      const cls = child.class_name || '';
      html += `<div style="margin-bottom:${idx < children.length - 1 ? '18px' : '0'}">
        <div style="font-size:0.82rem;font-weight:700;color:var(--accent);letter-spacing:.5px;text-transform:uppercase;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid rgba(201,168,76,0.15)">
          ${escapeHtml(childName)}${cls ? ` <span style="font-weight:400;color:var(--text-muted);font-size:0.78rem;text-transform:none;letter-spacing:0">— ${escapeHtml(cls)}</span>` : ''}
        </div>`;

      if (!todaySlots.length) {
        html += `<p style="padding:8px 0;color:var(--text-muted);font-size:0.9rem">No classes today (${pkDay}).</p>`;
      } else {
        totalToday += todaySlots.length;
        html += `<div style="display:flex;flex-direction:column;gap:8px">`;
        todaySlots.forEach(s => {
          const startStr = (s.start_time || '').substring(0, 5);
          const endStr   = (s.end_time   || '').substring(0, 5);
          const isNow    = startStr <= pkTime && endStr > pkTime;
          const isDone   = endStr <= pkTime;
          const doneStyle = isDone ? 'opacity:0.45;' : '';

          if (s.is_break) {
            html += `<div style="${doneStyle}display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:rgba(255,165,0,0.06);border:1px solid rgba(255,165,0,0.2);border-radius:8px">
              <span style="font-size:0.95rem">&#9749; <strong style="color:#ffa500">Break</strong></span>
              <span style="font-size:0.85rem;color:var(--text-muted)">${isDone ? '<span style="font-size:0.7rem;color:#888;background:rgba(255,255,255,0.06);padding:2px 6px;border-radius:4px;margin-right:6px">DONE</span>' : ''}${formatTime(s.start_time)} \u2013 ${formatTime(s.end_time)}</span>
            </div>`;
            return;
          }

          const ids = (s.teacher_ids ? s.teacher_ids.split(',') : [String(s.teacher_id)]).filter(Boolean);
          const teacherNames = ids.map(tid => { const t = teachers.find(x => String(x.id) === String(tid.trim())); return t ? `${normalizeTitle(t.title)} ${t.name}` : ''; }).filter(Boolean).join(', ');
          const bg     = isNow ? 'rgba(201,168,76,0.07)' : 'rgba(255,255,255,0.02)';
          const border = isNow ? 'rgba(201,168,76,0.35)' : 'rgba(255,255,255,0.06)';
          const col    = isDone ? '#888' : '#ffffff';
          const dot    = isNow
            ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--accent);box-shadow:0 0 6px var(--accent);flex-shrink:0"></span>'
            : '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,0.12);flex-shrink:0"></span>';
          html += `<div style="${doneStyle}display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:${bg};border:1px solid ${border};border-radius:8px;flex-wrap:wrap;gap:6px">
            <div style="display:flex;align-items:center;gap:10px">
              ${dot}
              <span style="font-size:0.97rem;font-weight:700;color:${col}">${escapeHtml(s.subject || '')}</span>
              ${isNow ? '<span style="font-size:0.7rem;color:var(--accent);font-weight:700;letter-spacing:1px;text-transform:uppercase;background:rgba(201,168,76,0.12);padding:2px 7px;border-radius:4px">NOW</span>' : ''}
              ${isDone ? '<span style="font-size:0.7rem;color:#888;background:rgba(255,255,255,0.06);padding:2px 7px;border-radius:4px;letter-spacing:.5px">DONE</span>' : ''}
            </div>
            <div style="font-size:0.85rem;color:var(--text-muted)">${escapeHtml(teacherNames || '\u2014')} &nbsp;\u00b7&nbsp; ${formatTime(s.start_time)} \u2013 ${formatTime(s.end_time)}</div>
          </div>`;
        });
        html += `</div>`;
      }
      html += `</div>`;
    });

    bodyEl.innerHTML = html +
      (totalToday > 0 ? `<p style="font-size:0.85rem;color:var(--text-muted);text-align:center;padding:12px 0 0">${totalToday} class${totalToday !== 1 ? 'es' : ''} scheduled today across all children</p>` : '');
  } catch (e) {
    bodyEl.innerHTML = `<div class="alert alert-error">${escapeHtml(e.message)}</div>`;
  }
}

async function loadTeachers() {
  teachers = await api(API.teachers).catch(() => []);
  const canManage    = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
  const isPrivileged = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
  const tbody = document.getElementById('teachers-body');
  const colCount = canManage ? 9 : 8;
  if (teachers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${colCount}" style="text-align:center;padding:36px;color:var(--text-muted)">No Data Found</td></tr>`;
    initTeacherColFilter();
    return;
  }
  tbody.innerHTML = teachers.map(t => {
    const displayTitle = normalizeTitle(t.title);
    const profileBtn = isPrivileged
      ? `<button class="btn btn-secondary btn-sm" onclick="editTeacher(${t.id})" title="View / Edit Full Profile" style="padding:4px 8px;font-size:1rem">&#128100;</button>`
      : '';
    const safeName = (displayTitle + ' ' + t.name).replace(/'/g, "\\'");
    const acctBtn = isPrivileged
      ? `<button class="btn btn-secondary btn-sm" onclick="openQuickAccountModal('teacher',${t.id},'${safeName}')" title="Manage Login Account" style="padding:4px 8px;font-size:1rem">&#128274;</button>`
      : '';
    const badgeClass = t.title === 'Sir' ? 'badge-blue' : 'badge-gold';
    const photoCell = t.photo
      ? `<img src="${t.photo}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid rgba(201,168,76,0.3)">`
      : `<div style="width:36px;height:36px;border-radius:50%;background:rgba(201,168,76,0.08);border:2px solid rgba(201,168,76,0.2);display:inline-flex;align-items:center;justify-content:center;margin:auto"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>`;
    const nameCell = `<span onclick="openTeacherBio(${t.id})" style="cursor:pointer;color:inherit" title="View staff profile">${escapeHtml(t.name)}</span>`;
    const joiningDate = t.joining_date ? t.joining_date.substring(0,10).split('-').reverse().join('-') : '—';
    return `<tr style="vertical-align:middle;text-align:center;font-size:0.9rem">
      <td data-col="col-tm-photo" style="padding:7px 6px;text-align:center">${photoCell}</td>
      <td data-col="col-tm-title" style="padding:7px 6px;white-space:nowrap"><span class="badge ${badgeClass}">${displayTitle}</span></td>
      <td data-col="col-tm-name" style="padding:7px 6px;white-space:nowrap">${nameCell}</td>
      <td data-col="col-tm-designation" style="padding:7px 6px;white-space:nowrap;color:var(--text-muted);font-size:0.85rem">${escapeHtml(t.designation||'—')}</td>
      <td data-col="col-tm-phone" style="padding:7px 6px;white-space:nowrap">${escapeHtml(t.phone||'—')}</td>
      <td data-col="col-tm-employment" style="padding:7px 6px;white-space:nowrap">${escapeHtml(t.employment_type||'—')}</td>
      <td data-col="col-tm-joining" style="padding:7px 6px;white-space:nowrap;color:var(--text-muted);font-size:0.82rem">${joiningDate}</td>
      <td data-col="col-tm-added" style="padding:7px 6px;white-space:nowrap;color:var(--text-muted);font-size:0.82rem">${formatDate(t.created_at)}</td>
      ${canManage ? `<td data-col="col-tm-actions" style="padding:7px 6px;white-space:nowrap"><button class="btn btn-secondary btn-sm" onclick="openTeacherBio(${t.id})" title="View Profile">&#9432; View</button> <button class="btn btn-secondary btn-sm" onclick="quickEditTeacher(${t.id})">Edit</button>${profileBtn}${acctBtn}<button class="btn btn-danger btn-sm" onclick="confirmDelete('teacher',${t.id},'${(displayTitle + ' ' + t.name).replace(/'/g, '&#39;')}')">Delete</button></td>` : ''}
    </tr>`;
  }).join('');
  initTeacherColFilter();
  filterTeachers();
}

async function loadClasses() {
  classes = await api(API.classes).catch(() => []);
  const canManage = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
  const isViewer  = currentUser?.role === 'user';
  const tbody = document.getElementById('classes-body');
  if (classes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${canManage?3:2}" style="text-align:center;padding:36px;color:var(--text-muted)">No Data Found</td></tr>`;
    return;
  }

  // Build free-slot map per class (only for non-viewers)
  const classFreeSlots = {}; // classId -> { day -> [ {from, to}, ... ] }
  if (!isViewer) {
    const days = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
    classes.forEach(c => {
      const classSlots = timetableSlots.filter(s => s.class_id == c.id);
      const dayMap = {};
      days.forEach(day => {
        const dk = day.toLowerCase();
        const DAY_START = (schoolSettings[`${dk}_start`] && schoolSettings[`${dk}_start`] !== '') ? schoolSettings[`${dk}_start`] : (schoolSettings.school_start || '08:00');
        const DAY_END   = (schoolSettings[`${dk}_end`]   && schoolSettings[`${dk}_end`]   !== '') ? schoolSettings[`${dk}_end`]   : (schoolSettings.school_end   || '14:00');
        if (!DAY_START || !DAY_END || DAY_START === DAY_END) return; // non-school day
        const daySlots = classSlots.filter(s => s.days && s.days.split(',').map(d=>d.trim()).includes(day));
        const sorted = [...daySlots].sort((a,b) => (a.start_time||'').localeCompare(b.start_time||''));
        // Merge overlapping/adjacent slots
        const merged = [];
        sorted.forEach(s => {
          const sS = (s.start_time||'').substring(0,5);
          const sE = (s.end_time||'').substring(0,5);
          if (merged.length && sS <= merged[merged.length-1].end) {
            merged[merged.length-1].end = sE > merged[merged.length-1].end ? sE : merged[merged.length-1].end;
          } else { merged.push({ start: sS, end: sE }); }
        });
        // Find gaps
        const free = [];
        let cursor = DAY_START;
        merged.forEach(b => {
          if (cursor < b.start) free.push({ from: cursor, to: b.start });
          if (b.end > cursor) cursor = b.end;
        });
        if (cursor < DAY_END) free.push({ from: cursor, to: DAY_END });
        if (free.length) dayMap[day] = free;
      });
      if (Object.keys(dayMap).length) classFreeSlots[c.id] = dayMap;
    });
  }

  tbody.innerHTML = classes.map(c => {
    let freeIcon = '';
    if (!isViewer && classFreeSlots[c.id]) {
      const dayMap = classFreeSlots[c.id];
      const tooltipLines = Object.entries(dayMap).map(function(entry) {
        var day = entry[0];
        var slots = entry[1];
        var slotStrs = slots.map(function(s) { return formatTime(s.from+':00') + ' – ' + formatTime(s.to+':00'); }).join(', ');
        return day.slice(0,3) + ': ' + slotStrs;
      }).join('&#10;');
      freeIcon = `<span class="free-slot-icon" title="${tooltipLines}" style="display:inline-flex;align-items:center;justify-content:center;margin-left:8px;width:20px;height:20px;border-radius:50%;background:rgba(255,170,0,0.15);border:1px solid rgba(255,170,0,0.4);color:#ffaa00;font-size:0.7rem;cursor:pointer;flex-shrink:0;position:relative;vertical-align:middle;transition:background 0.15s,border-color 0.15s" onmouseenter="showFreeTooltip(event,this)" onmouseleave="hideFreeTooltip()" onclick="toggleFreeTooltipLock(event,this)" data-free='${JSON.stringify(dayMap)}'>⚠</span>`;
    }
    return `<tr><td><span class="badge badge-blue">${c.name}</span>${freeIcon}</td><td style="color:var(--text-muted);font-size:0.82rem">${formatDate(c.created_at)}</td>${canManage ? `<td><button class="btn btn-secondary btn-sm" onclick="editClass(${c.id})">Edit</button><button class="btn btn-danger btn-sm" onclick="confirmDelete('class',${c.id},'${c.name.replace(/'/g, '&#39;')}')">Delete</button></td>` : ''}</tr>`;
  }).join('');
  filterClasses();
}

async function loadTimetable() {
  await loadAllData();
  const filterEl = document.getElementById('tt-class-filter');
  const sel = filterEl.value;
  filterEl.innerHTML = '<option value="">All Classes</option>' + classes.map(c => `<option value="${c.id}" ${sel==c.id?'selected':''}>${c.name}</option>`).join('');
  filterEl.value = sel;
  if (!filterEl.dataset.ssInit) makeSearchable(filterEl);
  else { const w = filterEl.closest('.ss-wrapper'); if (w?._ssRefresh) w._ssRefresh(); }

  const classFilter = filterEl.value;
  const selectedDays = [...document.querySelectorAll('.tt-day-cb:checked')].map(cb => cb.value);
  const timeFrom = document.getElementById('tt-time-from')?.value || '';
  const timeTo   = document.getElementById('tt-time-to')?.value || '';

  // Sort by start_time then day
  const dayRankMap = {Monday:0,Tuesday:1,Wednesday:2,Thursday:3,Friday:4};
  const sorted = [...timetableSlots].sort((a,b) => {
    const aD = dayRankMap[a.days?.split(',')[0]?.trim()] ?? 99;
    const bD = dayRankMap[b.days?.split(',')[0]?.trim()] ?? 99;
    if (aD !== bD) return aD - bD;
    return (a.start_time||'').localeCompare(b.start_time||'');
  });

  let filtered = classFilter ? sorted.filter(s => s.class_id == classFilter) : sorted;

  // Day filter
  if (selectedDays.length > 0 && selectedDays.length < 5) {
    filtered = filtered.filter(s => {
      if (!s.days) return false;
      return s.days.split(',').some(d => selectedDays.includes(d.trim()));
    });
  }

  // Time filter
  if (timeFrom) filtered = filtered.filter(s => (s.start_time||'').substring(0,5) >= timeFrom);
  if (timeTo)   filtered = filtered.filter(s => (s.end_time||'').substring(0,5) <= timeTo);

  const canManage = currentUser?.role === 'admin' || currentUser?.role === 'superadmin' || currentUser?.role === 'supervisor';
  const tbody = document.getElementById('timetable-body');

  const ttPerPage = parseInt(document.getElementById('tt-per-page')?.value ?? '0');
  const ttTotal = filtered.length;
  const ttCountEl = document.getElementById('tt-count-label');
  if (ttCountEl) ttCountEl.textContent = ttTotal > 0 ? (ttPerPage > 0 && ttTotal > ttPerPage ? `Showing ${ttPerPage} of ${ttTotal}` : `${ttTotal} record${ttTotal !== 1 ? 's' : ''}`) : '';
  if (ttPerPage > 0) filtered = filtered.slice(0, ttPerPage);

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${canManage?6:5}" style="text-align:center;padding:36px;color:var(--text-muted)">No Data Found</td></tr>`;
    return;
  }
  // When days are filtered, show only the matching days in the Days column
  const allDays = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
  const daysAreFiltered = selectedDays.length > 0 && selectedDays.length < allDays.length;
  function getDisplayDays(slotDays) {
    if (!slotDays) return '—';
    if (!daysAreFiltered) return formatDays(slotDays);
    const slotDayArr = slotDays.split(',').map(d => d.trim());
    const intersection = slotDayArr.filter(d => selectedDays.includes(d));
    return intersection.length > 0 ? intersection.map(d => d.slice(0,3)).join(', ') : formatDays(slotDays);
  }

  tbody.innerHTML = filtered.map(s => {
    if (s.is_break) {
      return `<tr class="break-row"><td><span class="badge badge-blue">${s.class_name}</span></td><td colspan="2" style="text-align:center"><span class="break-label">☕ BREAK</span></td><td style="white-space:nowrap;font-size:0.82rem">${getDisplayDays(s.days)}</td><td style="white-space:nowrap;font-size:0.82rem">${formatTime(s.start_time)} – ${formatTime(s.end_time)}</td>${canManage ? `<td style="white-space:nowrap"><button class="btn btn-secondary btn-sm" onclick="editTimetable(${s.id})">Edit</button><button class="btn btn-danger btn-sm" onclick="confirmDelete('timetable',${s.id},'Break in ${String(s.class_name).replace(/'/g, '&#39;')}')">Delete</button></td>` : ''}</tr>`;
    }
    const ids = (s.teacher_ids ? s.teacher_ids.split(',') : [String(s.teacher_id)]);
    const teacherBadges = ids.map(function(tid) {
      const t = teachers.find(function(x) { return String(x.id) === String(tid); });
      return t ? `<div style="white-space:nowrap;margin:2px 0"><span class="badge badge-gold" onclick="openTeacherBio(${t.id})" style="cursor:pointer" title="View staff profile">${normalizeTitle(t.title)} ${t.name}</span></div>` : '';
    }).join('');
    return `<tr><td><span class="badge badge-blue">${s.class_name}</span></td><td style="white-space:nowrap"><strong>${String(s.subject).replace(/'/g, '&#39;')}</strong></td><td>${teacherBadges}</td><td style="white-space:nowrap;font-size:0.82rem">${getDisplayDays(s.days)}</td><td style="white-space:nowrap;font-size:0.82rem">${formatTime(s.start_time)} – ${formatTime(s.end_time)}</td>${canManage ? `<td style="white-space:nowrap"><button class="btn btn-secondary btn-sm" onclick="editTimetable(${s.id})">Edit</button><button class="btn btn-danger btn-sm" onclick="confirmDelete('timetable',${s.id},'${String(s.subject).replace(/'/g, '&#39;')} in ${String(s.class_name).replace(/'/g, '&#39;')}')">Delete</button></td>` : ''}</tr>`;
  }).join('');
}

// ===== BREAK SCHEDULE =====
async function loadBreak() {
  await loadAllData();

  const filterEl = document.getElementById('brk-class-filter');
  if (!filterEl) return;
  const sel = filterEl.value;
  filterEl.innerHTML = '<option value="">All Classes</option>' + classes.map(c => `<option value="${c.id}" ${sel==c.id?'selected':''}>${c.name}</option>`).join('');
  filterEl.value = sel;
  if (!filterEl.dataset.ssInit) makeSearchable(filterEl);
  else { const w = filterEl.closest('.ss-wrapper'); if (w?._ssRefresh) w._ssRefresh(); }

  const classFilter = filterEl.value;
  const selectedDays = [...document.querySelectorAll('.brk-day-cb:checked')].map(cb => cb.value);
  const searchQ = (document.getElementById('brk-search')?.value || '').toLowerCase().trim();

  // Only break slots
  let breakSlots = timetableSlots.filter(s => s.is_break);

  // Class filter
  if (classFilter) breakSlots = breakSlots.filter(s => s.class_id == classFilter);

  // Text search by class name
  if (searchQ) breakSlots = breakSlots.filter(s => (s.class_name || '').toLowerCase().includes(searchQ));

  // Day filter
  if (selectedDays.length > 0 && selectedDays.length < 5) {
    breakSlots = breakSlots.filter(s => {
      if (!s.days) return false;
      return s.days.split(',').some(d => selectedDays.includes(d.trim()));
    });
  }

  // Sort: specific class → by day order then time; all classes → closest to current time first
  const dayRankMap = { Monday:0, Tuesday:1, Wednesday:2, Thursday:3, Friday:4 };
  const toMins = t => { if (!t) return 0; const [h, m] = t.split(':'); return +h * 60 + +m; };

  if (classFilter) {
    breakSlots.sort((a, b) => {
      const aD = dayRankMap[a.days?.split(',')[0]?.trim()] ?? 99;
      const bD = dayRankMap[b.days?.split(',')[0]?.trim()] ?? 99;
      if (aD !== bD) return aD - bD;
      return (a.start_time || '').localeCompare(b.start_time || '');
    });
  } else {
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const upcoming = breakSlots.filter(s => toMins(s.start_time) >= nowMins)
      .sort((a, b) => toMins(a.start_time) - toMins(b.start_time));
    const past = breakSlots.filter(s => toMins(s.start_time) < nowMins)
      .sort((a, b) => toMins(b.start_time) - toMins(a.start_time));
    breakSlots = [...upcoming, ...past];
  }

  const canManage = currentUser?.role === 'admin' || currentUser?.role === 'superadmin' || currentUser?.role === 'supervisor';
  const tbody = document.getElementById('break-body');
  if (!tbody) return;

  const perPage = parseInt(document.getElementById('brk-per-page')?.value ?? '0');
  const total = breakSlots.length;
  const countEl = document.getElementById('brk-count-label');
  if (countEl) countEl.textContent = total > 0 ? (perPage > 0 && total > perPage ? `Showing ${perPage} of ${total}` : `${total} record${total !== 1 ? 's' : ''}`) : '';

  const paged = perPage > 0 ? breakSlots.slice(0, perPage) : breakSlots;

  if (paged.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${canManage ? 5 : 4}" style="text-align:center;padding:36px;color:var(--text-muted)">No breaks found</td></tr>`;
    return;
  }

  const allDays = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
  const daysFiltered = selectedDays.length > 0 && selectedDays.length < allDays.length;
  function getDisplayDays(slotDays) {
    if (!slotDays) return '—';
    if (!daysFiltered) return formatDays(slotDays);
    const arr = slotDays.split(',').map(d => d.trim());
    const inter = arr.filter(d => selectedDays.includes(d));
    return inter.length > 0 ? inter.map(d => d.slice(0, 3)).join(', ') : formatDays(slotDays);
  }

  function getDuration(start, end) {
    const diff = toMins(end) - toMins(start);
    if (diff <= 0) return '—';
    if (diff < 60) return `${diff} min`;
    const h = Math.floor(diff / 60), m = diff % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }

  tbody.innerHTML = paged.map(s => {
    const dur = getDuration(s.start_time, s.end_time);
    const actions = canManage
      ? `<td style="white-space:nowrap"><button class="btn btn-secondary btn-sm" onclick="editTimetable(${s.id})">Edit</button><button class="btn btn-danger btn-sm" onclick="confirmDelete('timetable',${s.id},'Break in ${String(s.class_name).replace(/'/g, '&#39;')}')">Delete</button></td>`
      : '';
    return `<tr class="break-row">
      <td><span class="badge badge-blue">${escapeHtml(s.class_name || '—')}</span></td>
      <td style="white-space:nowrap;font-size:0.82rem">${getDisplayDays(s.days)}</td>
      <td style="white-space:nowrap;font-size:0.82rem">${formatTime(s.start_time)} – ${formatTime(s.end_time)}</td>
      <td style="white-space:nowrap;font-size:0.82rem"><span class="badge" style="background:rgba(201,168,76,0.15);color:var(--accent);border:1px solid rgba(201,168,76,0.3)">${dur}</span></td>
      ${actions}
    </tr>`;
  }).join('');
}

async function openBreakModal() {
  await openTimetableModal();
  const cb = document.getElementById('tt-is-break');
  if (cb && !cb.checked) {
    cb.checked = true;
    toggleBreakMode();
  }
}

async function downloadBreakDoc(format, pageSize, orientation, scale = 90) {
  await _ensureLogo();
  const tbody = document.getElementById('break-body');
  if (!tbody) return;

  const filterEl = document.getElementById('brk-class-filter');
  const filterSel = filterEl?.closest('.ss-wrapper')?.querySelector('select') || filterEl;
  const selectedDaysCbs = [...document.querySelectorAll('.brk-day-cb:checked')].map(cb => cb.value);
  const dayRangeStr = buildDayRange(selectedDaysCbs);

  let subtitle = '';
  if (filterSel && filterSel.value) {
    const opt = filterSel.options[filterSel.selectedIndex];
    if (opt) subtitle = dayRangeStr ? `${opt.text} — ${dayRangeStr}` : opt.text;
  } else if (dayRangeStr) {
    subtitle = dayRangeStr;
  }

  const rows = Array.from(tbody.querySelectorAll('tr')).filter(r =>
    r.style.display !== 'none' && !r.querySelector('td[colspan]')
  );
  if (rows.length === 0) { toast('No break data to download', 'error'); return; }

  const headers = ['Class', 'Days', 'Time', 'Duration'];
  const headerHtml = `<thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>`;
  const bodyRows = rows.map(tr => {
    const tds = Array.from(tr.querySelectorAll('td'));
    return `<tr>${tds.slice(0, 4).map(td => `<td>${td.textContent.trim()}</td>`).join('')}</tr>`;
  }).join('');

  const tableHtml = `<table>${headerHtml}<tbody>${bodyRows}</tbody></table>`;
  const docBody = `${_buildDocHeader('Class Breaks', subtitle, pageSize)}<div class="section-title">Class Break Schedule</div>${tableHtml}${_buildDocBodyClose()}`;

  if (format === 'pdf') {
    const brkClass = (filterSel?.value && filterSel.options[filterSel.selectedIndex]?.text
      ? filterSel.options[filterSel.selectedIndex].text : 'all').replace(/\s+/g, '_').toLowerCase();
    const pdfTitle = dayRangeStr ? `${brkClass}_breaks_${buildDayRangeFilename(selectedDaysCbs)}` : `${brkClass}_breaks`;
    _openPrintWindow(_buildFullPrintDoc(docBody, pageSize, true, orientation, pdfTitle, scale));
  }
}

async function loadTrack() {
  await loadAllData();
  const filterSel = document.getElementById('track-teacher-filter');
  const prevVal = filterSel.value;
  filterSel.innerHTML = '<option value="">All Teachers</option>' +
    teachers.map(t => `<option value="${t.id}" ${prevVal==t.id?'selected':''}>${normalizeTitle(t.title)} ${t.name}</option>`).join('');
  if (!filterSel.dataset.ssInit) makeSearchable(filterSel);
  else { const w = filterSel.closest('.ss-wrapper'); if (w?._ssRefresh) w._ssRefresh(); }

  const selectedDays    = [...document.querySelectorAll('.track-day-cb:checked')].map(cb => cb.value);
  const timeFrom        = document.getElementById('track-time-from').value;
  const timeTo          = document.getElementById('track-time-to').value;
  const teacherFilterId = filterSel.value;
  const container       = document.getElementById('track-container');

  if (selectedDays.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:24px">Please select at least one day.</p>';
    return;
  }

  function slotBelongsTo(s, t) {
    if (s.is_break) return false;
    if (String(s.teacher_id) === String(t.id)) return true;
    if (s.teacher_ids) return s.teacher_ids.split(',').map(x=>x.trim()).includes(String(t.id));
    return false;
  }

  const visibleTeachers = teacherFilterId ? teachers.filter(t => String(t.id) === String(teacherFilterId)) : teachers;
  const teacherStatus = visibleTeachers.map(t => {
    const activeSlots = timetableSlots.filter(s => {
      if (!slotBelongsTo(s, t)) return false;
      const slotDays = s.days.split(',');
      if (!selectedDays.some(d => slotDays.includes(d))) return false;
      const sStart = s.start_time.substring(0,5);
      const sEnd   = s.end_time.substring(0,5);
      const from   = timeFrom || '00:00';
      const to     = timeTo   || '23:59';
      return sStart < to && sEnd > from;
    });
    return { teacher: t, slots: activeSlots };
  });

  const busy = teacherStatus.filter(ts => ts.slots.length > 0);
  const free = teacherStatus.filter(ts => ts.slots.length === 0);

  if (teacherFilterId && visibleTeachers.length === 1) {
    const ts = teacherStatus[0];
    const isBusy = ts.slots.length > 0;
    const cardStyle = `display:flex;align-items:center;gap:14px;${isBusy ? 'margin-bottom:20px;' : 'margin-bottom:0;'}`;
    const statusDotClass = `status-dot ${isBusy ? 'busy' : 'free'}`;
    const statusColor = isBusy ? 'var(--danger)' : 'var(--success)';
    container.innerHTML = `
      <div class="card">
        <div style="${cardStyle}">
          <div class="${statusDotClass}" style="width:14px;height:14px;flex-shrink:0"></div>
          <div>
            <div style="font-size:1.1rem;font-weight:700">${normalizeTitle(ts.teacher.title)} ${ts.teacher.name}</div>
            <div style="font-size:0.85rem;color:${statusColor};margin-top:2px">
              ${isBusy ? `Busy — ${ts.slots.length} class${ts.slots.length > 1 ? 'es' : ''} in selected time` : 'Free — No classes in selected time'}
            </div>
          </div>
        </div>
        ${isBusy ? `<div style="display:flex;flex-direction:column;gap:8px">
          ${ts.slots.map(sl => {
            const ids = (sl.teacher_ids ? sl.teacher_ids.split(',') : [String(sl.teacher_id)]);
            const names = ids.map(tid => { const t = teachers.find(x => String(x.id)===String(tid)); return t ? `${normalizeTitle(t.title)} ${t.name}` : ''; }).filter(Boolean).join(', ');
            return `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:12px 16px">
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
                <div><strong>${sl.subject}</strong> <span class="badge badge-blue" style="margin-left:6px">${sl.class_name}</span></div>
                <div style="font-size:0.85rem;color:var(--text-muted)">${formatTime(sl.start_time)} – ${formatTime(sl.end_time)}</div>
              </div>
              <div style="font-size:0.8rem;color:var(--text-muted);margin-top:6px">
                📅 ${formatDays(sl.days)}${ids.length > 1 ? ` &nbsp;·&nbsp; 👥 ${names}` : ''}
              </div>
            </div>`;
          }).join('')}
        </div>` : `<div style="text-align:center;padding:24px 0 8px;color:var(--text-muted)"><div style="font-size:2rem;margin-bottom:8px">✅</div>No classes in the selected day/time range.</div>`}
      </div>
    `;
    _trackDataCache = { busy: [], free: [], singleTeacher: ts };
    return;
  }

  container.innerHTML = `
    <div class="track-cols" style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div>
        <div class="card-title" style="color:var(--danger);margin-bottom:14px">● Busy (${busy.length})</div>
        ${busy.length === 0 ? '<p style="color:var(--text-muted);font-size:0.88rem">No teachers are busy</p>' :
          busy.map(ts => `
            <div class="teacher-status-card">
              <div class="status-dot busy"></div>
              <div style="flex:1">
                <div class="teacher-status-name">${normalizeTitle(ts.teacher.title)} ${ts.teacher.name}</div>
                ${ts.slots.map(sl => `<div class="teacher-status-info">${sl.class_name} — ${sl.subject} (${formatTime(sl.start_time)}–${formatTime(sl.end_time)})</div>`).join('')}
              </div>
            </div>`).join('')}
      </div>
      <div>
        <div class="card-title" style="color:var(--success);margin-bottom:14px">● Free (${free.length})</div>
        ${free.length === 0 ? '<p style="color:var(--text-muted);font-size:0.88rem">All teachers are busy</p>' :
          free.map(ts => `
            <div class="teacher-status-card">
              <div class="status-dot free"></div>
              <div class="teacher-status-name">${normalizeTitle(ts.teacher.title)} ${ts.teacher.name}</div>
              <div class="teacher-status-info">Available</div>
            </div>`).join('')}
      </div>
    </div>`;

  _trackDataCache = {
    busy: busy.map(ts => ({
      name: `${normalizeTitle(ts.teacher.title)} ${ts.teacher.name}`,
      slots: ts.slots.map(sl => `${sl.class_name} — ${sl.subject} (${formatTime(sl.start_time)}–${formatTime(sl.end_time)}, ${formatDays(sl.days)})`)
    })),
    free: free.map(ts => ({ name: `${normalizeTitle(ts.teacher.title)} ${ts.teacher.name}` })),
    singleTeacher: teacherFilterId ? teacherStatus[0] : null
  };
}

async function loadSearch() {
  teachers = await api(API.teachers).catch(() => []);
  const sel = document.getElementById('search-teacher');
  let allowedTeachers = teachers;
  if (currentUser && currentUser.role === 'user') {
    const allowedIds = currentUser.teacher_ids_perm.split(',').map(x=>x.trim()).filter(Boolean);
    allowedTeachers = teachers.filter(t => allowedIds.includes(String(t.id)));
  }
  sel.innerHTML = '<option value="">Select a teacher...</option>' + allowedTeachers.map(t => `<option value="${t.id}">${normalizeTitle(t.title)} ${t.name}</option>`).join('');
  if (!sel.dataset.ssInit) makeSearchable(sel);
  else { const w = sel.closest('.ss-wrapper'); if (w?._ssRefresh) w._ssRefresh(); }
  sel.onchange = searchTeacher;
}

async function searchTeacher() {
  const id = document.getElementById('search-teacher').value;
  const results = document.getElementById('search-results');
  if (!id) {
    results.innerHTML = '<div class="card"><p style="color:var(--text-muted);text-align:center;padding:32px">Please select a teacher to view their schedule.</p></div>';
    return;
  }
  results.innerHTML = '<div class="card"><p style="color:var(--text-muted);text-align:center;padding:32px">Loading...</p></div>';
  let data;
  try {
    const res = await fetch(`${API.search}?teacher_id=${encodeURIComponent(id)}`, { method: 'GET', credentials: 'include' });
    data = await res.json();
  } catch (e) {
    results.innerHTML = `<div class="card"><p style="color:var(--danger);text-align:center;padding:32px">Network error: ${e.message}</p></div>`;
    return;
  }
  if (data.error) { results.innerHTML = `<div class="card"><p style="color:var(--danger);text-align:center;padding:32px">Error: ${data.error}</p></div>`; return; }

  const teacher  = data.teacher;
  const allSlots = Array.isArray(data.slots) ? data.slots : [];
  const teacherName = `${normalizeTitle(teacher.title)} ${teacher.name}`;

  const checkedDays = [...document.querySelectorAll('.search-day-cb:checked')].map(cb => cb.value);
  const timeFrom = document.getElementById('search-time-from')?.value || '';
  const timeTo   = document.getElementById('search-time-to')?.value || '';

  let slots = allSlots;
  if (checkedDays.length > 0)
    slots = slots.filter(s => s.days && s.days.split(',').some(d => checkedDays.includes(d.trim())));
  if (timeFrom) slots = slots.filter(s => s.start_time && s.start_time.substring(0,5) >= timeFrom);
  if (timeTo)   slots = slots.filter(s => s.end_time && s.end_time.substring(0,5) <= timeTo);

  if (allSlots.length === 0) {
    results.innerHTML = `<div class="card" style="text-align:center;padding:48px"><div style="font-size:2.5rem;margin-bottom:12px">📭</div><div style="font-weight:600;font-size:1.05rem;margin-bottom:8px">${teacherName} has no scheduled classes</div><div style="color:var(--text-muted);font-size:0.88rem">Add a timetable slot assigned to this teacher from the Timetable page.</div></div>`;
    return;
  }
  if (slots.length === 0) {
    results.innerHTML = `<div class="card"><p style="color:var(--text-muted);text-align:center;padding:32px">No classes match the selected filters. ${allSlots.length} total slot(s) exist for ${teacherName}.</p></div>`;
    return;
  }

  const dayRank = {Monday:0,Tuesday:1,Wednesday:2,Thursday:3,Friday:4,Saturday:5,Sunday:6};
  slots.sort((a,b) => {
    const aD = dayRank[a.days?.split(',')[0]?.trim()] ?? 99;
    const bD = dayRank[b.days?.split(',')[0]?.trim()] ?? 99;
    return aD !== bD ? aD - bD : (a.start_time||'').localeCompare(b.start_time||'');
  });

  const dayOrder = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
  const byDay = {};
  dayOrder.forEach(d => byDay[d] = []);
  allSlots.forEach(s => {
    if (s.days) s.days.split(',').forEach(d => { const day = d.trim(); if (byDay[day] !== undefined) byDay[day].push(s); });
  });

  const uniqueDays    = [...new Set(allSlots.flatMap(s => s.days ? s.days.split(',').map(d=>d.trim()) : []))];
  const uniqueClasses = [...new Set(allSlots.map(s => s.class_name).filter(Boolean))];

  // Show only the filtered days in the Days column (same logic as timetable page)
  function filterDisplayDays(slotDays, activeDays) {
    if (!slotDays) return '—';
    if (!activeDays || activeDays.length === 0 || activeDays.length >= 5) return formatDays(slotDays);
    const slotArr = slotDays.split(',').map(d => d.trim());
    const intersection = slotArr.filter(d => activeDays.includes(d));
    return intersection.length > 0 ? intersection.map(d => d.slice(0,3)).join(', ') : formatDays(slotDays);
  }

  results.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
        <span>All Classes — ${teacherName}</span>
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:0.8rem;color:var(--text-muted);font-weight:400">${slots.length} record${slots.length!==1?'s':''}</span>
          <div style="position:relative;display:inline-block">
            <button class="btn btn-pdf btn-sm" onclick="openDownloadMenu('search-res-dm', this)">⬇ Download</button>
            <div id="search-res-dm" class="download-menu">
              <div class="dm-scale-row"><span class="dm-scale-label">Page Scale</span><div class="dm-scale-btns"><button type="button" class="dm-scale-btn" data-scale="70" onclick="setMenuScale(event,this)">70%</button><button type="button" class="dm-scale-btn" data-scale="80" onclick="setMenuScale(event,this)">80%</button><button type="button" class="dm-scale-btn dm-scale-active" data-scale="90" onclick="setMenuScale(event,this)">90%</button><button type="button" class="dm-scale-btn" data-scale="100" onclick="setMenuScale(event,this)">100%</button></div></div>
              <div class="download-divider"></div>
              <div class="download-opt" onclick="downloadSearchDoc('pdf','A4','portrait',getMenuScale(this.closest('.download-menu')))">📄 PDF — A4 Portrait</div>
              <div class="download-opt" onclick="downloadSearchDoc('pdf','A4','landscape',getMenuScale(this.closest('.download-menu')))">📄 PDF — A4 Landscape</div>
            </div>
          </div>
        </div>
      </div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="border-bottom:2px solid var(--border)">
              <th style="text-align:left;padding:10px 14px;font-size:0.76rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px">#</th>
              <th style="text-align:left;padding:10px 14px;font-size:0.76rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px">Subject</th>
              <th style="text-align:left;padding:10px 14px;font-size:0.76rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px">Class</th>
              <th style="text-align:left;padding:10px 14px;font-size:0.76rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px">Days</th>
              <th style="text-align:left;padding:10px 14px;font-size:0.76rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px">Time</th>
              <th style="text-align:left;padding:10px 14px;font-size:0.76rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px">Group</th>
            </tr>
          </thead>
          <tbody>
            ${slots.map((s,i) => `
              <tr style="border-bottom:1px solid var(--border)" onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background=''">
                <td style="padding:12px 14px;font-size:0.82rem;color:var(--text-muted)">${i+1}</td>
                <td style="padding:12px 14px"><strong style="font-size:0.93rem">${s.subject||'—'}</strong></td>
                <td style="padding:12px 14px"><span class="badge badge-blue">${s.class_name||'—'}</span></td>
                <td style="padding:12px 14px;font-size:0.88rem;color:var(--text)">${filterDisplayDays(s.days, checkedDays)}</td>
                <td style="padding:12px 14px;font-size:0.88rem;color:var(--text-muted);white-space:nowrap">${formatTime(s.start_time)} – ${formatTime(s.end_time)}</td>
                <td style="padding:12px 14px;font-size:0.82rem;color:var(--text-muted)">${s.day_group||'—'}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
    <div class="card">
      <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
        <span>📅 Weekly Availability — When is ${teacherName} free?</span>
        <div style="position:relative;display:inline-block">
          <button class="btn btn-pdf btn-sm" onclick="openDownloadMenu('avail-dm', this)">⬇ Download</button>
          <div id="avail-dm" class="download-menu">
            <div class="dm-scale-row"><span class="dm-scale-label">Page Scale</span><div class="dm-scale-btns"><button type="button" class="dm-scale-btn" data-scale="70" onclick="setMenuScale(event,this)">70%</button><button type="button" class="dm-scale-btn" data-scale="80" onclick="setMenuScale(event,this)">80%</button><button type="button" class="dm-scale-btn dm-scale-active" data-scale="90" onclick="setMenuScale(event,this)">90%</button><button type="button" class="dm-scale-btn" data-scale="100" onclick="setMenuScale(event,this)">100%</button></div></div>
            <div class="download-divider"></div>
            <div class="download-opt" onclick="downloadAvailabilityDoc('${teacherName}','pdf','A4','portrait',getMenuScale(this.closest('.download-menu')))">📄 PDF — A4 Portrait</div>
            <div class="download-opt" onclick="downloadAvailabilityDoc('${teacherName}','pdf','A4','landscape',getMenuScale(this.closest('.download-menu')))">📄 PDF — A4 Landscape</div>
          </div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:0">
        ${dayOrder.map((day, di) => {
          const busy = byDay[day]||[];
          const dk = day.toLowerCase();
          const DAY_START = (schoolSettings[`${dk}_start`] && schoolSettings[`${dk}_start`] !== '') ? schoolSettings[`${dk}_start`] : (schoolSettings.school_start || '08:00');
          const DAY_END   = (schoolSettings[`${dk}_end`]   && schoolSettings[`${dk}_end`]   !== '') ? schoolSettings[`${dk}_end`]   : (schoolSettings.school_end   || '14:00');
          const sorted = [...busy].sort((a,b) => (a.start_time||'').localeCompare(b.start_time||''));
          const merged = [];
          sorted.forEach(s => {
            const sS = (s.start_time||'').substring(0,5);
            const sE = (s.end_time||'').substring(0,5);
            if (merged.length && sS <= merged[merged.length-1].end) {
              merged[merged.length-1].end = sE > merged[merged.length-1].end ? sE : merged[merged.length-1].end;
            } else { merged.push({ start: sS, end: sE }); }
          });
          const freeBlocks = [];
          let cursor = DAY_START;
          merged.forEach(b => {
            if (cursor < b.start) freeBlocks.push({ from: cursor, to: b.start });
            if (b.end > cursor) cursor = b.end;
          });
          if (cursor < DAY_END) freeBlocks.push({ from: cursor, to: DAY_END });
          const isLast = di === dayOrder.length - 1;
          const dayStyle = 'display:flex;align-items:flex-start;gap:16px;padding:14px 0;' + (isLast ? '' : 'border-bottom:1px solid var(--border);');
          return `<div style="${dayStyle}">
            <div style="min-width:48px;font-weight:700;font-size:0.82rem;color:var(--accent);text-transform:uppercase;letter-spacing:.5px;padding-top:2px">${day.slice(0,3)}</div>
            <div style="flex:1">
              ${busy.length === 0
                ? `<span style="font-size:0.88rem;color:var(--success)">✅ Fully available all day (${formatTime(DAY_START+':00')} – ${formatTime(DAY_END+':00')})</span>`
                : freeBlocks.length === 0
                  ? `<span style="font-size:0.88rem;color:var(--danger)">🔴 Fully booked (no free time)</span>`
                  : freeBlocks.map(b => `<span style="display:inline-block;background:rgba(34,197,94,0.12);color:var(--success);border:1px solid rgba(34,197,94,0.25);border-radius:6px;padding:3px 10px;font-size:0.84rem;margin:2px 4px 2px 0">✓ ${formatTime(b.from+':00')} – ${formatTime(b.to+':00')}</span>`).join('')
              }
            </div>
            <div style="font-size:0.78rem;color:var(--text-muted);white-space:nowrap;padding-top:4px">${busy.length} class${busy.length!==1?'es':''}</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;

  _searchSlotsCache = { teacherName, slots, checkedDays };
  _availDataCache = {
    teacherName,
    rows: dayOrder.map(day => {
      const dk = day.toLowerCase();
      const DAY_START2 = (schoolSettings[`${dk}_start`] && schoolSettings[`${dk}_start`] !== '') ? schoolSettings[`${dk}_start`] : (schoolSettings.school_start || '08:00');
      const DAY_END2   = (schoolSettings[`${dk}_end`]   && schoolSettings[`${dk}_end`]   !== '') ? schoolSettings[`${dk}_end`]   : (schoolSettings.school_end   || '14:00');
      const busyDay = byDay[day] || [];
      const sorted2 = [...busyDay].sort((a,b) => (a.start_time||'').localeCompare(b.start_time||''));
      const merged2 = [];
      sorted2.forEach(s => {
        const sS = (s.start_time||'').substring(0,5);
        const sE = (s.end_time||'').substring(0,5);
        if (merged2.length && sS <= merged2[merged2.length-1].end)
          merged2[merged2.length-1].end = sE > merged2[merged2.length-1].end ? sE : merged2[merged2.length-1].end;
        else merged2.push({ start: sS, end: sE });
      });
      const freeBlocks2 = [];
      let cursor2 = DAY_START2;
      merged2.forEach(b => { if (cursor2 < b.start) freeBlocks2.push({ from: cursor2, to: b.start }); if (b.end > cursor2) cursor2 = b.end; });
      if (cursor2 < DAY_END2) freeBlocks2.push({ from: cursor2, to: DAY_END2 });
      return {
        day,
        busyCount: busyDay.length,
        busySlots: busyDay.map(s => ({ subject: s.subject, className: s.class_name, time: `${formatTime(s.start_time)} – ${formatTime(s.end_time)}`, days: formatDays(s.days) })),
        freeBlocks: freeBlocks2,
        fullyAvailable: busyDay.length === 0,
        fullyBooked: freeBlocks2.length === 0 && busyDay.length > 0
      };
    })
  };
}

// ===== MOBILE SIDEBAR =====
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const hamburger = document.getElementById('hamburger-btn');
  const isOpen = sidebar.classList.contains('open');
  if (isOpen) {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
    hamburger.classList.remove('open');
    setTimeout(() => { overlay.classList.remove('visible'); }, 320);
  } else {
    overlay.classList.add('visible');
    setTimeout(() => overlay.classList.add('open'), 10);
    sidebar.classList.add('open');
    hamburger.classList.add('open');
  }
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const hamburger = document.getElementById('hamburger-btn');
  sidebar.classList.remove('open');
  overlay.classList.remove('open');
  hamburger.classList.remove('open');
  setTimeout(() => overlay.classList.remove('visible'), 320);
}

function checkMobileHeader() {
  const mobileHeader = document.getElementById('mobile-header');
  if (window.innerWidth <= 768) { mobileHeader.style.display = 'flex'; }
  else {
    mobileHeader.style.display = 'none';
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('open', 'visible');
    document.getElementById('hamburger-btn').classList.remove('open');
  }
}

window.addEventListener('resize', checkMobileHeader);
checkMobileHeader();

// ===== USER CLASSES & TIMETABLE (viewer role - read only) =====
async function loadUserClasses() {
  await loadAllData();
  const classIdsPerm = (currentUser?.class_ids_perm || '').split(',').map(x => x.trim()).filter(Boolean);
  const myClasses = classes.filter(c => classIdsPerm.includes(String(c.id)));

  const sel = document.getElementById('user-classes-filter');
  const currentVal = sel.value;
  sel.innerHTML = '<option value="">All My Classes</option>' +
    myClasses.map(c => `<option value="${c.id}" ${currentVal == c.id ? 'selected' : ''}>${c.name}</option>`).join('');
  if (!sel.dataset.ssInit) makeSearchable(sel);
  else { const w = sel.closest('.ss-wrapper'); if (w?._ssRefresh) w._ssRefresh(); }

  document.querySelectorAll('.user-classes-day-cb').forEach(cb => { cb.onchange = renderUserClassTimetable; });
  renderUserClassTimetable();
}

function renderUserClassTimetable() {
  const classIdsPerm = (currentUser?.class_ids_perm || '').split(',').map(x => x.trim()).filter(Boolean);
  let slots = timetableSlots.filter(s => classIdsPerm.includes(String(s.class_id)));

  const filterEl = document.getElementById('user-classes-filter');
  const filterSel = filterEl?.closest('.ss-wrapper')?.querySelector('select') || filterEl;
  const classFilter = filterSel?.value || '';
  if (classFilter) slots = slots.filter(s => String(s.class_id) === classFilter);

  const checkedDays = [...document.querySelectorAll('.user-classes-day-cb:checked')].map(cb => cb.value);
  if (checkedDays.length > 0) {
    slots = slots.filter(s => s.days && s.days.split(',').some(d => checkedDays.includes(d.trim())));
  }

  const timeFrom = document.getElementById('user-classes-time-from')?.value;
  const timeTo = document.getElementById('user-classes-time-to')?.value;
  if (timeFrom) slots = slots.filter(s => (s.start_time || '') >= timeFrom);
  if (timeTo) slots = slots.filter(s => (s.end_time || '') <= timeTo);

  const dayRank = {Monday:0,Tuesday:1,Wednesday:2,Thursday:3,Friday:4};
  slots.sort((a,b) => {
    const aD = dayRank[a.days?.split(',')[0]?.trim()] ?? 99;
    const bD = dayRank[b.days?.split(',')[0]?.trim()] ?? 99;
    return aD !== bD ? aD - bD : (a.start_time||'').localeCompare(b.start_time||'');
  });

  const ucPerPage = parseInt(document.getElementById('user-classes-per-page')?.value ?? '0');
  const ucTotal = slots.length;
  const ucCountEl = document.getElementById('user-classes-count-label');
  if (ucCountEl) ucCountEl.textContent = ucTotal > 0 ? (ucPerPage > 0 && ucTotal > ucPerPage ? `Showing ${ucPerPage} of ${ucTotal}` : `${ucTotal} record${ucTotal !== 1 ? 's' : ''}`) : '';
  if (ucPerPage > 0) slots = slots.slice(0, ucPerPage);

  const tbody = document.getElementById('user-classes-body');
  if (slots.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:36px;color:var(--text-muted)">No Data Found</td></tr>';
    return;
  }
  tbody.innerHTML = slots.map(s => {
    if (s.is_break) {
      return `<tr class="break-row"><td style="max-width:130px"><span class="badge badge-blue" style="white-space:normal;display:inline-block">${s.class_name||'—'}</span></td>
        <td colspan="2"><span class="break-label">☕ BREAK</span></td>
        <td style="white-space:nowrap"><span class="badge badge-blue">${formatDays(s.days)}</span></td>
        <td style="white-space:nowrap">${formatTime(s.start_time)} – ${formatTime(s.end_time)}</td></tr>`;
    }
    const ids = (s.teacher_ids ? s.teacher_ids.split(',') : [String(s.teacher_id)]);
    const teacherBadges = ids.map(tid => { const t = teachers.find(x => String(x.id) === String(tid)); return t ? `<div style="white-space:nowrap;margin:2px 0"><span class="badge badge-gold" onclick="openTeacherBio(${t.id})" style="cursor:pointer" title="View staff profile">${normalizeTitle(t.title)} ${t.name}</span></div>` : ''; }).filter(Boolean).join('');
    return `<tr>
      <td style="max-width:130px">${s.class_name ? `<span class="badge badge-blue" style="white-space:normal;display:inline-block">${s.class_name}</span>` : '—'}</td>
      <td style="white-space:nowrap">${s.subject}</td>
      <td>${teacherBadges || '—'}</td>
      <td style="white-space:nowrap">${formatDays(s.days)}</td>
      <td style="white-space:nowrap">${formatTime(s.start_time)} – ${formatTime(s.end_time)}</td>
    </tr>`;
  }).join('');
}

async function loadUserTimetable() {
  await loadAllData();
  const classIdsPerm = (currentUser?.class_ids_perm || '').split(',').map(x => x.trim()).filter(Boolean);
  const myClasses = classes.filter(c => classIdsPerm.includes(String(c.id)));

  const sel = document.getElementById('user-tt-class-filter');
  const currentVal = sel.value;
  sel.innerHTML = '<option value="">All My Classes</option>' +
    myClasses.map(c => `<option value="${c.id}" ${currentVal == c.id ? 'selected' : ''}>${c.name}</option>`).join('');
  if (!sel.dataset.ssInit) makeSearchable(sel);
  else { const w = sel.closest('.ss-wrapper'); if (w?._ssRefresh) w._ssRefresh(); }

  document.querySelectorAll('.user-tt-day-cb').forEach(cb => { cb.onchange = renderUserTimetable; });
  renderUserTimetable();
}

function renderUserTimetable() {
  const classIdsPerm = (currentUser?.class_ids_perm || '').split(',').map(x => x.trim()).filter(Boolean);
  let slots = timetableSlots.filter(s => classIdsPerm.includes(String(s.class_id)));

  const filterEl = document.getElementById('user-tt-class-filter');
  const filterSel = filterEl?.closest('.ss-wrapper')?.querySelector('select') || filterEl;
  const classFilter = filterSel?.value || '';
  if (classFilter) slots = slots.filter(s => String(s.class_id) === classFilter);

  const checkedDays = [...document.querySelectorAll('.user-tt-day-cb:checked')].map(cb => cb.value);
  if (checkedDays.length > 0) {
    slots = slots.filter(s => s.days && s.days.split(',').some(d => checkedDays.includes(d.trim())));
  }

  const dayRank = {Monday:0,Tuesday:1,Wednesday:2,Thursday:3,Friday:4};
  slots.sort((a,b) => {
    const aD = dayRank[a.days?.split(',')[0]?.trim()] ?? 99;
    const bD = dayRank[b.days?.split(',')[0]?.trim()] ?? 99;
    return aD !== bD ? aD - bD : (a.start_time||'').localeCompare(b.start_time||'');
  });

  const tbody = document.getElementById('user-timetable-body');
  if (slots.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:36px;color:var(--text-muted)">No Data Found</td></tr>';
    return;
  }
  tbody.innerHTML = slots.map(s => {
    if (s.is_break) {
      return `<tr class="break-row"><td style="white-space:nowrap"><span class="badge badge-blue">${s.class_name||'—'}</span></td>
        <td colspan="2"><span class="break-label">☕ BREAK</span></td>
        <td style="white-space:nowrap"><span class="badge badge-blue">${formatDays(s.days)}</span></td>
        <td style="white-space:nowrap">${formatTime(s.start_time)} – ${formatTime(s.end_time)}</td></tr>`;
    }
    const ids = (s.teacher_ids ? s.teacher_ids.split(',') : [String(s.teacher_id)]);
    const teacherLabel = ids.map(tid => { const t = teachers.find(x => String(x.id) === String(tid)); return t ? `${normalizeTitle(t.title)} ${t.name}` : ''; }).filter(Boolean).join(', ');
    return `<tr>
      <td style="white-space:nowrap"><span class="badge badge-blue">${s.class_name}</span></td>
      <td style="white-space:nowrap">${s.subject}</td>
      <td style="white-space:nowrap"><span class="badge badge-gold">${teacherLabel || '—'}</span></td>
      <td style="white-space:nowrap">${formatDays(s.days)}</td>
      <td style="white-space:nowrap">${formatTime(s.start_time)} – ${formatTime(s.end_time)}</td>
    </tr>`;
  }).join('');
}

async function loadUsers() {
  const users = await api(API.users).catch(() => []);
  usersCache = users;
  const tbody = document.getElementById('users-body');
  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:36px;color:var(--text-muted)">No Data Found</td></tr>';
    return;
  }
  const isSA = currentUser?.role === 'superadmin';
  tbody.innerHTML = users.map(u => {
    const canEdit = isSA || u.role !== 'superadmin';
    const badgeClass = u.role === 'superadmin' ? 'badge-gold' : u.role === 'admin' ? 'badge-red' : u.role === 'supervisor' ? 'badge-purple' : u.role === 'student' ? 'badge-green' : u.role === 'parent' ? 'badge-teal' : 'badge-blue';
    const roleLabel = { superadmin: 'Super Admin', admin: 'Admin', supervisor: 'Supervisor', user: 'User', student: 'Student', parent: 'Parent' }[u.role] || u.role;
    const schedAccess = u.role === 'supervisor'
      ? `<span style="color:#c87fff;font-size:0.82rem">Supervisor</span>`
      : u.role === 'student'
        ? `<span style="color:#4ade80;font-size:0.82rem">Student${u.student_id ? ' (Linked)' : ''}</span>`
        : u.role === 'parent'
          ? `<span style="color:#2dd4bf;font-size:0.82rem">Parent${u.student_id ? ' (Linked)' : ''}</span>`
          : u.role === 'user'
        ? (() => {
            const tRestricted = u.teacher_ids_perm ? '🔒 Teachers' : '';
            const cRestricted = u.class_ids_perm ? '🔒 Classes' : '';
            const parts = [tRestricted, cRestricted].filter(Boolean);
            return parts.length ? parts.join(', ') : 'Full Access';
          })()
        : 'Full Access';
    return `<tr><td>${u.username}</td><td><span class="badge ${badgeClass}">${roleLabel}</span></td><td style="color:var(--text-muted);font-size:0.82rem">${schedAccess}</td><td style="color:var(--text-muted);font-size:0.82rem">${formatDate(u.created_at)}</td><td>${canEdit ? `<button class="btn btn-secondary btn-sm" onclick="editUser(${u.id})">Edit</button><button class="btn btn-danger btn-sm" onclick="confirmDelete('user',${u.id},'${String(u.username).replace(/'/g, '&#39;')}')">Delete</button>` : '<span style=\"color:var(--text-muted);font-size:0.82rem\">Protected</span>'}</td></tr>`;
  }).join('');
  filterUsers();
}

// loadSettings / saveSettings moved to js/settings.js

// ===== HASH-BASED ROUTING =====
window.addEventListener('hashchange', () => {
  if (!currentUser) return; // not logged in — ignore
  const name = window.location.hash.replace('#', '').trim();
  if (name && document.getElementById('page-' + name)) showPage(name);
});
       