/**
 * Theme Module
 * Handles switching between the dark (default) and light color themes
 */

const STORAGE_KEY = 'theme';

const SUN_ICON = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="4.5" stroke="currentColor" stroke-width="1.6"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
const MOON_ICON = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';

function isLightTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light';
}

function applyTheme(theme) {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) {}
}

function updateButton(button) {
  const light = isLightTheme();
  // Icon shown is the theme a click switches TO, not the current one.
  button.innerHTML = light ? MOON_ICON : SUN_ICON;
  const label = light ? 'Switch to dark theme' : 'Switch to light theme';
  button.setAttribute('aria-label', label);
  button.title = label;
}

/**
 * Wires a button element up as the light/dark theme toggle.
 * @param {HTMLElement} button
 */
export function initThemeToggle(button) {
  if (!button) return;
  updateButton(button);
  button.addEventListener('click', () => {
    applyTheme(isLightTheme() ? 'dark' : 'light');
    updateButton(button);
  });
}
