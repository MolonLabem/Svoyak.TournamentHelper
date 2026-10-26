// Runs before styles: no theme flash, and no account/tournament information stored.
(() => {
  const key = 'svoyak-appearance';
  const modes = ['system', 'light', 'dark'];
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  let preference = 'system';
  try { const stored = localStorage.getItem(key); if (modes.includes(stored)) preference = stored; } catch {}
  function apply() {
    const resolved = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#1b222a' : '#f5f7f8');
    document.querySelectorAll('[data-appearance]').forEach(select => select.value = preference);
  }
  window.SvoyakAppearance = {
    get: () => preference,
    set(value) { if (!modes.includes(value)) return; preference = value; try { localStorage.setItem(key, value); } catch {} apply(); }
  };
  media.addEventListener('change', apply);
  window.addEventListener('storage', event => { if (event.key === key) { preference = modes.includes(event.newValue) ? event.newValue : 'system'; apply(); } });
  apply();
})();
