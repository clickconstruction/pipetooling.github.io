/**
 * All CSS for the inline Team Summary surface (table + drilldown modals).
 *
 * Injected once into `<head>` via a single `<style>` tag from
 * `TeamSummaryInline` so we get scoped class names without dragging in
 * a CSS Modules / styled-components build dependency. Class names are
 * prefixed `team-summary-*` to keep them out of any other component's
 * way.
 *
 * Print modes mirror the iframe version:
 *   - `body.printing-team-summary` — whole-table print. Hides every
 *     sibling outside `.team-summary-print-target`. Triggered from the
 *     toolbar Print button.
 *   - `body.printing-team-summary-modal` — drilldown-only print. Hides
 *     the page chrome AND the table; only `.team-summary-modal-portal`
 *     (added to `<body>` by `TeamSummaryDrilldownModal`) is visible.
 *     Triggered from the modal's Print button.
 */
export const TEAM_SUMMARY_INLINE_CSS = `
/* --- Toolbar (search / reset sort / Print / Open in new window) --- */
.team-summary-tools {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.5rem;
}
.team-summary-tools input[type="search"] {
  padding: 0.35rem 0.6rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font: inherit;
  min-width: 220px;
}
.team-summary-tools input[type="search"]:focus {
  outline: 2px solid #2563eb;
  outline-offset: -1px;
  border-color: #2563eb;
}
.team-summary-tools .team-summary-reset-sort-btn,
.team-summary-tools .team-summary-print-btn,
.team-summary-tools .team-summary-open-window-btn {
  padding: 0.3rem 0.6rem;
  border: 1px solid #d1d5db;
  background: #fff;
  color: #374151;
  border-radius: 4px;
  font-size: 0.8rem;
  cursor: pointer;
}
.team-summary-tools .team-summary-reset-sort-btn:hover,
.team-summary-tools .team-summary-print-btn:hover,
.team-summary-tools .team-summary-open-window-btn:hover { background: #f9fafb; }
/* Push "Print" + "Open in new window" to the far right of the tools
   row. Putting the auto margin on the first of the two siblings
   shoves both of them (and any remaining gap-sized space) to the
   right; the regular 0.5rem flex gap keeps them touching. The auto
   margin only consumes leftover main-axis space, so when the row
   wraps on narrow viewports they naturally drop to a new line
   instead of overflowing. */
.team-summary-tools .team-summary-print-btn { margin-left: auto; }
.team-summary-tools .team-summary-reset-sort-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.team-summary-tools .team-summary-filter-status { color: #6b7280; font-size: 0.85rem; }
.team-summary-meta { color: #6b7280; margin-bottom: 0.25rem; font-size: 0.85rem; }
.team-summary-meta-sub { color: #6b7280; margin-bottom: 0.75rem; font-size: 0.85rem; }
.team-summary-meta-sub-btn {
  background: none;
  border: 0;
  padding: 0;
  color: #2563eb;
  cursor: pointer;
  font: inherit;
  text-decoration: underline dotted;
  text-underline-offset: 2px;
}
.team-summary-meta-sub-btn:hover { color: #1d4ed8; }

/* --- Table --- */
.team-summary-table { border-collapse: collapse; table-layout: auto; }
.team-summary-table th,
.team-summary-table td { border: 1px solid #e5e7eb; white-space: nowrap; }
.team-summary-table th {
  padding: 0.5rem 0.75rem;
  text-align: left;
  background: #f9fafb;
  font-weight: 600;
  vertical-align: bottom;
  position: relative;
}
.team-summary-table th.num { text-align: center; }
/* The "Profit" header is a single short word; center it vertically so it
 * sits in the middle of the header row (which is sized for the two-line
 * labels around it) rather than bottom-aligned like the rest. */
.team-summary-table th[data-sort="profitAfterOverhead"] { vertical-align: middle; }
.team-summary-table th[data-sort] { cursor: pointer; user-select: none; }
.team-summary-table th[data-sort]:hover { background: #f3f4f6; }
.team-summary-table th[data-sort]:focus-visible { outline: 2px solid #2563eb; outline-offset: -2px; }
/* Sort indicator floats in the top-right corner of the header cell
 * (above the label text) instead of sitting inline after the last
 * word — so multi-line headers like "Profit/hr (after overhead)"
 * don't have a stray triangle dangling off whichever word happened
 * to wrap last. Parent th already has position:relative. */
.team-summary-table th .sort-indicator {
  position: absolute;
  top: 2px;
  right: 4px;
  color: #9ca3af;
  font-size: 0.7em;
  line-height: 1;
  pointer-events: none;
}
.team-summary-table th[aria-sort="ascending"] .sort-indicator,
.team-summary-table th[aria-sort="descending"] .sort-indicator { color: #1f2937; }
.team-summary-table tfoot td { border-top: 2px solid #d1d5db; }
.team-summary-table .empty-state td {
  padding: 1rem 0.75rem;
  text-align: center;
  color: #6b7280;
  font-style: italic;
  background: #fafafa;
}
.team-summary-table .click-cell:hover { background: #eff6ff; }
.team-summary-table .click-cell:focus-visible { outline: 2px solid #2563eb; outline-offset: -2px; }
.team-summary-person-name-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: none;
  border: 0;
  padding: 0;
  margin: 0;
  font: inherit;
  color: inherit;
  cursor: pointer;
  text-align: left;
}
.team-summary-person-name-btn .chevron {
  color: #6b7280;
  font-size: 0.8em;
  width: 0.7em;
  display: inline-block;
}
.team-summary-person-name-btn:hover .person-name-text { color: #2563eb; }
.team-summary-person-name-btn:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 1px;
  border-radius: 2px;
}
.team-summary-table tbody tr.selected-person td { background: #dbeafe; }
.team-summary-table tbody tr.selected-person .team-summary-person-name-btn .person-name-text {
  font-weight: 700;
  color: #1e3a8a;
}
.team-summary-table tbody tr.selected-person .team-summary-person-name-btn .chevron { color: #1e3a8a; }
.team-summary-footer-caption {
  color: #6b7280;
  font-size: 0.8rem;
  margin-top: 0.5rem;
}

/* --- Horizontal scroll wrapper (no vertical scroll — the page scrolls) --- */
.team-summary-scroll {
  overflow-x: auto;
  overflow-y: visible;
  width: 100%;
}

/* --- Modal shell (portal-rendered into <body>) --- */
.team-summary-modal-root {
  position: fixed;
  inset: 0;
  z-index: 9000;
  pointer-events: none;
}
.team-summary-modal-root > * { pointer-events: auto; }
.team-summary-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
}
.team-summary-modal {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #fff;
  border-radius: 8px;
  padding: 1rem 1.5rem 1.5rem;
  max-width: 90vw;
  max-height: 85vh;
  overflow: auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.25);
  min-width: 400px;
}
.team-summary-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
  gap: 1rem;
}
.team-summary-modal-header h2 { margin: 0; font-size: 1.1rem; }
.team-summary-modal-header-actions { display: flex; align-items: center; gap: 0.5rem; }
.team-summary-modal-print {
  background: #fff;
  border: 1px solid #d1d5db;
  padding: 0.25rem 0.6rem;
  border-radius: 4px;
  font-size: 0.8rem;
  cursor: pointer;
  color: #374151;
  line-height: 1.2;
}
.team-summary-modal-print:hover { background: #f9fafb; }
.team-summary-modal-print:focus-visible { outline: 2px solid #2563eb; outline-offset: 1px; }
.team-summary-modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  color: #6b7280;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}
.team-summary-modal-close:hover { background: #f3f4f6; color: #111827; }
.team-summary-modal-close:focus-visible { outline: 2px solid #2563eb; outline-offset: 1px; }
.team-summary-modal h3 {
  margin-top: 1.25rem;
  margin-bottom: 0.5rem;
  font-size: 0.95rem;
  color: #374151;
}
.team-summary-modal table { width: 100%; border-collapse: collapse; }
.team-summary-modal th,
.team-summary-modal td {
  padding: 0.35rem 0.6rem;
  white-space: normal;
  border: 1px solid #e5e7eb;
}
.team-summary-modal td.num,
.team-summary-modal th.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.team-summary-modal .caption {
  color: #6b7280;
  font-size: 0.85rem;
  margin-top: 1rem;
}

/* --- Hours breakdown (hierarchical day -> alloc layout, v2.547) --- */
.team-summary-modal .hours-day-list { display: block; }
.team-summary-modal .hours-day-section {
  padding: 0.45rem 0;
  border-bottom: 1px solid #f3f4f6;
}
.team-summary-modal .hours-day-section:last-child { border-bottom: none; }
.team-summary-modal .hours-day-header {
  color: #1f2937;
  font-weight: 600;
  font-size: 0.92rem;
}
.team-summary-modal .hours-day-header .day-hours { margin-left: 0.5rem; }
.team-summary-modal button.hours-day-header.day-link {
  display: block;
  width: 100%;
  text-align: left;
  background: none;
  border: 0;
  padding: 0.15rem 0.35rem;
  margin: -0.15rem -0.35rem;
  font: inherit;
  color: inherit;
  cursor: pointer;
  border-radius: 4px;
}
.team-summary-modal button.hours-day-header.day-link .day-link-date {
  color: #2563eb;
  text-decoration: underline dotted;
  text-underline-offset: 3px;
}
.team-summary-modal button.hours-day-header.day-link:hover { background: #eff6ff; }
.team-summary-modal button.hours-day-header.day-link:hover .day-link-date { color: #1d4ed8; }
.team-summary-modal button.hours-day-header.day-link:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 1px;
}
.team-summary-modal .hours-day-allocs {
  margin-left: 1.5rem;
  margin-top: 0.25rem;
  color: #374151;
  font-size: 0.9rem;
  line-height: 1.5;
}
.team-summary-modal .hours-day-alloc { padding: 0.02rem 0; }
.team-summary-modal .hours-day-alloc .alloc-pct {
  display: inline-block;
  min-width: 3.4rem;
  color: #6b7280;
  font-variant-numeric: tabular-nums;
}
.team-summary-modal .hours-day-alloc .alloc-jobnum {
  color: #1f2937;
  font-variant-numeric: tabular-nums;
}
.team-summary-modal .hours-day-alloc .alloc-jobname { color: #4b5563; }
.team-summary-modal .hours-day-alloc .alloc-address { color: #6b7280; }
.team-summary-modal .hours-day-alloc .alloc-counted {
  color: #6b7280;
  margin-left: 0.5rem;
  font-variant-numeric: tabular-nums;
}
.team-summary-modal .hours-day-noalloc {
  color: #9ca3af;
  font-style: italic;
  font-size: 0.85rem;
  padding: 0.05rem 0;
}
.team-summary-modal .hours-day-total {
  margin-top: 0.85rem;
  padding-top: 0.5rem;
  border-top: 2px solid #d1d5db;
  font-weight: 600;
  font-size: 0.95rem;
  color: #1f2937;
}

/* --- Print --- */
@media print {
  /* Whole-table print: hide page chrome outside the table section, but
     leave the table itself visible. The wrapper sets a class on body
     so the rule only applies during a print invoked from our toolbar
     (browser Ctrl+P falls through to the default print behavior). */
  body.printing-team-summary > :not(.team-summary-print-target):not(.team-summary-modal-portal) {
    display: none !important;
  }
  body.printing-team-summary .team-summary-tools { display: none !important; }
  body.printing-team-summary .team-summary-table th[data-sort] { cursor: default; }
  body.printing-team-summary .team-summary-table th .sort-indicator { display: none; }
  body.printing-team-summary .team-summary-table .click-cell {
    color: inherit !important;
    text-decoration: none !important;
    cursor: default !important;
  }
  body.printing-team-summary .team-summary-modal-portal { display: none !important; }

  /* Modal-only print: hide EVERYTHING except the modal body. Includes
     the table section AND all unrelated portals (toasts, other modals). */
  body.printing-team-summary-modal > :not(.team-summary-modal-portal) {
    display: none !important;
  }
  body.printing-team-summary-modal .team-summary-modal-backdrop,
  body.printing-team-summary-modal .team-summary-modal-print,
  body.printing-team-summary-modal .team-summary-modal-close {
    display: none !important;
  }
  body.printing-team-summary-modal .team-summary-modal-root {
    position: static !important;
  }
  body.printing-team-summary-modal .team-summary-modal {
    position: static !important;
    transform: none !important;
    box-shadow: none !important;
    border: none !important;
    padding: 0 !important;
    max-width: 100% !important;
    max-height: none !important;
    min-width: 0 !important;
    overflow: visible !important;
  }
}
`
