const SESSION_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes of inactivity
const _ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];

async function _doSessionExpire() {
  sessionStorage.removeItem('tab_active');
  _stopIdleTimer();
  try { await api(`${API.auth}?action=logout`, 'POST'); } catch {}
  currentUser = null;
  showLogin();
  const errEl = document.getElementById('login-error');
  if (errEl) { errEl.textContent = 'Your session expired due to inactivity. Please log in again.'; errEl.style.display = 'flex'; }
}

function _resetIdleTimer() {
  clearTimeout(_idleTimer);
  _idleTimer = setTimeout(_doSessionExpire, SESSION_TIMEOUT_MS);
}

function _onVisibilityChange() {
  if (document.hidden) {
    // Tab hidden — start a parallel countdown (in case device sleeps / browser throttles events)
    _awayTimer = setTimeout(_doSessionExpire, SESSION_TIMEOUT_MS);
  } else {
    // Tab visible again — cancel the away countdown; activity timer still runs
    clearTimeout(_awayTimer);
    _awayTimer = null;
    _resetIdleTimer(); // refresh the main idle timer on return
  }
}

function _startIdleTimer() {
  document.addEventListener('visibilitychange', _onVisibilityChange);
  _ACTIVITY_EVENTS.forEach(evt => document.addEventListener(evt, _resetIdleTimer, { passive: true }));
  _resetIdleTimer(); // kick off the first countdown
}

function _stopIdleTimer() {
  document.removeEventListener('visibilitychange', _onVisibilityChange);
  _ACTIVITY_EVENTS.forEach(evt => document.removeEventListener(evt, _resetIdleTimer));
  clearTimeout(_awayTimer);
  clearTimeout(_idleTimer);
  _awayTimer = null;
  _idleTimer = null;
}
