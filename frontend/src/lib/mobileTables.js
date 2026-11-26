// frontend/src/lib/mobileTables.js — on phones every data table is shown as a stack of cards.
// The CSS does the layout; this labels each cell with its column header (data-label) so the
// card can show "Amount  AED 7,500" without every page having to repeat its headers.
import { useEffect } from 'react';

function labelTable(table) {
  const heads = [...table.querySelectorAll(':scope > thead th')].map(th => th.textContent.trim());
  if (!heads.length) return;
  for (const tr of table.querySelectorAll(':scope > tbody > tr, :scope > tfoot > tr')) {
    let col = 0;
    for (const td of tr.children) {
      const span = Number(td.getAttribute('colspan') || 1);
      const label = span > 1 ? '' : (heads[col] || '');
      if (td.getAttribute('data-label') !== label) td.setAttribute('data-label', label);
      col += span;
    }
  }
}

export function labelAllTables(root = document) {
  root.querySelectorAll('table.table').forEach(labelTable);
}

export function useMobileTables() {
  useEffect(() => {
    let queued = false;
    const run = () => { queued = false; labelAllTables(); };
    const obs = new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(run); } });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    run();
    return () => obs.disconnect();
  }, []);
}
