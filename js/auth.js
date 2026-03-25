// ===== AUTHENTICATION FUNCTIONS =====
// Handles user login by sending credentials to server and setting up session
async function doLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';
  try {
    const data = await api(`${API.auth}?action=login`, 'POST', { username, password });
    currentUser = { user_id: data.user_id, username: data.username, role: data.role, student_id: data.student_id || null, parent_id: data.parent_id || null, student_ids: data.student_ids || '', teacher_ids_perm: data.teacher_ids_perm || '', class_ids_perm: data.class_ids_perm || '', supervisor_teacher_ids: data.supervisor_teacher_ids || '', supervisor_class_ids: data.supervisor_class_ids || '', supervisor_user_ids: data.supervisor_user_ids || '' };
    sessionStorage.setItem('tab_active', '1');
    showApp(true); // true = fresh login, always go to dashboard
  } catch (e) { errEl.textContent = e.message; errEl.style.display = 'flex'; }
}

async function doLogout() {
  _stopIdleTimer();
  clearInterval(_notifPollInterval);
  _notifPollInterval = null;
  sessionStorage.removeItem('tab_active');
  await api(`${API.auth}?action=logout`, 'POST');
  currentUser = null;
  showLogin();
}

document.getElementById('login-password').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

function showLogin() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}

function showApp(fromLogin = false) {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  _startIdleTimer();
  const isSA   = currentUser.role === 'superadmin';
  const isAdmin = currentUser.role === 'admin' || isSA;
  const isSupv  = currentUser.role === 'supervisor';
  const isStudentRole = currentUser.role === 'student';
  const isParentRole  = currentUser.role === 'parent';
  document.getElementById('user-display-name').textContent = currentUser.username;
  document.getElementById('user-display-role').textContent = isSA ? 'Super Admin' : isAdmin ? 'Administrator' : isSupv ? 'Supervisor' : isStudentRole ? 'Student' : isParentRole ? 'Parent' : 'Viewer';
  document.getElementById('user-avatar').textContent = currentUser.username[0].toUpperCase();
  document.querySelectorAll('.admin-only').forEach(el => { el.style.display = isAdmin ? '' : 'none'; });
  // Show superadmin-only elements
  document.querySelectorAll('.superadmin-only').forEach(el => { el.style.display = isSA ? '' : 'none'; });
  // Show admin-or-supervisor elements
  document.querySelectorAll('.admin-or-supervisor').forEach(el => { el.style.display = (isAdmin || isSupv) ? '' : 'none'; });
  // Show supervisor-only elements (not for admin — admin sees grouped nav instead)
  document.querySelectorAll('.supervisor-only').forEach(el => { el.style.display = isSupv ? '' : 'none'; });
  // Show user-only elements (viewer role)
  const isViewer = currentUser.role === 'user';
  document.querySelectorAll('.user-only').forEach(el => { el.style.display = isViewer ? '' : 'none'; });
  // Show student-only and parent-only elements
  document.querySelectorAll('.student-only').forEach(el => { el.style.display = isStudentRole ? '' : 'none'; });
  document.querySelectorAll('.parent-only').forEach(el => { el.style.display = isParentRole ? '' : 'none'; });
  // Hide settings nav for supervisors, viewers, students, parents
  const settingsNav = document.getElementById('settings-nav');
  if (settingsNav) settingsNav.style.display = (isSupv || isViewer || isStudentRole || isParentRole) ? 'none' : '';
  // Stat-users-card: hidden for viewers, students, parents
  const usersCard = document.getElementById('stat-users-card');
  if (usersCard) usersCard.style.display = (isViewer || isStudentRole || isParentRole) ? 'none' : '';
  const usersCardLabel = usersCard ? usersCard.querySelector('.stat-label') : null;
  if (usersCardLabel) usersCardLabel.textContent = isSupv ? 'Assigned Users' : 'System Users';
  document.querySelectorAll('.track-day-cb').forEach(cb => { cb.checked = true; });
  api(API.settings).then(s => {
    schoolSettings = s;
    document.getElementById('track-time-from').value = s.school_start || '08:00';
    document.getElementById('track-time-to').value   = s.school_end   || '14:00';
    document.getElementById('settings-start').value  = s.school_start || '08:00';
    document.getElementById('settings-end').value    = s.school_end   || '14:00';
    const ttFrom = document.getElementById('tt-time-from');
    const ttTo   = document.getElementById('tt-time-to');
    if (ttFrom) ttFrom.value = s.school_start || '08:00';
    if (ttTo)   ttTo.value   = s.school_end   || '14:00';
  }).catch(() => {});
  // Determine which page to show
  let lastPage = 'dashboard';
  // Students default to student-schedule, parents default to parent-schedule
  if (isStudentRole) lastPage = 'student-schedule';
  else if (isParentRole) lastPage = 'parent-schedule';
  // On page refresh (not fresh login) restore from URL hash, fall back to localStorage
  if (!fromLogin) {
    const hash = window.location.hash.replace('#', '').trim();
    const candidate = hash || (() => { try { return localStorage.getItem('idl_last_page'); } catch { return null; } })();
    if (candidate && document.getElementById('page-' + candidate)) {
      if (isStudentRole && (candidate === 'student-schedule' || candidate === 'dashboard')) lastPage = candidate;
      else if (isParentRole && (candidate === 'parent-schedule' || candidate === 'dashboard')) lastPage = candidate;
      else if (!isStudentRole && !isParentRole) lastPage = candidate;
    }
  }
  if (!document.getElementById('page-' + lastPage)) lastPage = 'dashboard';
  showPage(lastPage);
  loadAllData();
  initAllSelects();
  // Superadmin: load notification badge and start 60s poll
  if (isSA) {
    api('api/notifications.php').then(data => {
      _notificationsCache = data;
      updateNotificationBadge(data.filter(n => n.id > _notifLastSeenId).length);
    }).catch(() => {});
    clearInterval(_notifPollInterval);
    _notifPollInterval = setInterval(() => {
      if (currentUser?.role !== 'superadmin') { clearInterval(_notifPollInterval); return; }
      api('api/notifications.php').then(data => {
        _notificationsCache = data;
        updateNotificationBadge(data.filter(n => n.id > _notifLastSeenId).length);
      }).catch(() => {});
    }, 60000);
  }
}

