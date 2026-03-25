// ===== FREE SLOT TOOLTIP =====
// _freeTooltipEl, _freeTooltipLocked, _freeTooltipLockedIcon declared in utils.js
// filterTeachers, filterClasses, filterUserClasses, filterUsers defined in utils.js via filterTable()

function _buildFreeTooltip(iconEl) {
  let dayMap;
  try { dayMap = JSON.parse(iconEl.dataset.free); } catch { return null; }
  const dayOrder = ['Monday','Tuesday','Wednesday','Thursday','Friday'];

  const tip = document.createElement('div');
  tip.id = 'free-slot-tooltip';
  tip.style.cssText = `
    position:fixed;z-index:9999;
    background:#0d0d2e;border:1px solid rgba(255,170,0,0.35);border-radius:10px;
    padding:12px 16px;min-width:220px;max-width:320px;
    box-shadow:0 8px 32px rgba(0,0,0,0.5);
    font-size:0.82rem;color:var(--text);
    pointer-events:none;
  `;
  const title = document.createElement('div');
  title.style.cssText = 'font-weight:700;color:#ffaa00;margin-bottom:8px;font-size:0.85rem;display:flex;align-items:center;gap:6px';
  title.innerHTML = '⚠ Free Slots Available';
  tip.appendChild(title);

  const ordered = dayOrder.filter(d => dayMap[d]);
  ordered.forEach((day, i) => {
    const slots = dayMap[day];
    const row = document.createElement('div');
    row.style.cssText = `display:flex;flex-direction:column;gap:3px;${i < ordered.length-1 ? 'margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.06)' : ''}`;
    const dayLabel = document.createElement('div');
    dayLabel.style.cssText = 'font-weight:600;color:var(--text-muted);font-size:0.75rem;text-transform:uppercase;letter-spacing:.5px';
    dayLabel.textContent = day;
    row.appendChild(dayLabel);
    slots.forEach(s => {
      const pill = document.createElement('div');
      pill.style.cssText = 'display:inline-flex;align-items:center;gap:5px;background:rgba(255,170,0,0.1);border:1px solid rgba(255,170,0,0.25);border-radius:5px;padding:2px 8px;font-size:0.8rem;color:#ffcc55;width:fit-content';
      pill.innerHTML = `🕐 ${formatTime(s.from+':00')} – ${formatTime(s.to+':00')}`;
      row.appendChild(pill);
    });
    tip.appendChild(row);
  });

  document.body.appendChild(tip);

  // Position: prefer below-right of icon, flip if off-screen
  const rect = iconEl.getBoundingClientRect();
  const tipW = 280, tipH = tip.offsetHeight || 160;
  let left = rect.right + 8;
  let top  = rect.top;
  if (left + tipW > window.innerWidth - 12)  left = rect.left - tipW - 8;
  if (top  + tipH > window.innerHeight - 12) top  = window.innerHeight - tipH - 12;
  if (top < 8) top = 8;
  tip.style.left = left + 'px';
  tip.style.top  = top  + 'px';
  return tip;
}

function showFreeTooltip(event, iconEl) {
  if (_freeTooltipLocked) return; // respect locked state; don't replace on hover
  if (_freeTooltipEl) { _freeTooltipEl.remove(); _freeTooltipEl = null; }
  _freeTooltipEl = _buildFreeTooltip(iconEl);
}

function hideFreeTooltip() {
  if (_freeTooltipLocked) return; // don't hide on mouseleave when locked
  if (_freeTooltipEl) { _freeTooltipEl.remove(); _freeTooltipEl = null; }
}

function toggleFreeTooltipLock(event, iconEl) {
  event.stopPropagation();
  if (_freeTooltipLocked && _freeTooltipLockedIcon === iconEl) {
    // Same icon clicked again — release lock and hide
    _freeTooltipLocked = false;
    _freeTooltipLockedIcon = null;
    if (_freeTooltipEl) { _freeTooltipEl.remove(); _freeTooltipEl = null; }
    iconEl.style.background = 'rgba(255,170,0,0.15)';
    iconEl.style.borderColor = 'rgba(255,170,0,0.4)';
  } else {
    // Lock onto this icon — show or keep tooltip and pin it
    if (_freeTooltipLockedIcon && _freeTooltipLockedIcon !== iconEl) {
      // Release previous lock first
      _freeTooltipLockedIcon.style.background = 'rgba(255,170,0,0.15)';
      _freeTooltipLockedIcon.style.borderColor = 'rgba(255,170,0,0.4)';
    }
    if (_freeTooltipEl) { _freeTooltipEl.remove(); _freeTooltipEl = null; }
    _freeTooltipLocked = false; // allow build
    _freeTooltipEl = _buildFreeTooltip(iconEl);
    _freeTooltipLocked = true;
    _freeTooltipLockedIcon = iconEl;
    // Visual: highlight the icon while locked
    iconEl.style.background = 'rgba(255,170,0,0.35)';
    iconEl.style.borderColor = 'rgba(255,170,0,0.9)';
  }
}

// Dismiss locked tooltip when clicking anywhere outside it
// (duplicate listener removed — authoritative copy is in utils.js)

