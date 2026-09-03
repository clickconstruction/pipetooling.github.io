/**
 * Team Summary popup/standalone HTML document builder for People → Review.
 *
 * Pure: takes an explicit `TeamSummaryHtmlContext` (the enriched breakdowns
 * payload, the 90-day overhead rate + decomposition, the period label, and
 * the embedded/selection flags) and returns a standalone HTML document
 * string. Lifted VERBATIM out of `PeopleReviewTab.tsx`'s
 * `openTeamSummaryWindow` popup branch (Stage A of the Review-tab
 * sub-decomposition — see `docs/PEOPLE_REVIEW_TAB_ARCHITECTURE.md` §D);
 * the window management, cache check, and toasts stay with the component.
 *
 * The document is self-contained: CSS + table skeleton + an ES5 IIFE
 * `<script>` providing client-side sort/search, the per-cell drilldown
 * modals, and modal-only print mode. Intentional quirks preserved from the
 * move (do NOT "clean up"):
 *  - The `isEmbedded` branch (margin 0, hidden h1, `embeddedResizeScript`
 *    iframe-resize postMessage plumbing, `bridgeTarget()`) is DEAD on the
 *    live popup path — the inline iframe era ended when `TeamSummaryInline`
 *    landed — but is kept for the popup document's internal structure.
 *  - The script's formatters (`escH`, `fmtH`, `fmtPct`, `fmtMoney`, …)
 *    intentionally duplicate `teamSummary/formatters.ts` in ES5 — the popup
 *    document must stay self-contained, so do not import/unify them.
 *  - JSON payloads are `</`-escaped via `.replace(/</g, '\\u003c')` and the
 *    script is ES5-only (see RECENT_FEATURES v2.539).
 */

import type { TeamSummaryBreakdown } from '../../components/people/teamSummary/types'

/**
 * The 90-day rate decomposition exactly as the popup feeds it — the raw
 * `reviewOverheadRates` fields, which are null until loaded (and reset to
 * all-null on error). Deliberately WIDER than `OverheadRateDecomp`
 * (`teamSummary/types`), whose pool fields are non-null: the inline memo
 * coerces nulls to 0 (`?? 0`) but the popup has always serialized the raw
 * nulls into `overheadDecompJson` — preserved as-is.
 */
export type TeamSummaryHtmlOverheadDecomp = {
  ratePerHour: number | null
  ratePerRevenueDecimal: number | null
  ratePerLaborDollar: number | null
  windowStart: string | null
  windowEnd: string | null
  officeLabor90d: number | null
  bidLabor90d: number | null
  officeParts90d: number | null
  invoices90d: number | null
  fieldHours90d: number | null
  fieldLaborUsd90d: number | null
}

export type TeamSummaryHtmlContext = {
  /** Always false on the live popup path; the embedded branch is kept dead. */
  isEmbedded: boolean
  /** Pre-resolved `getReviewPeriodLabel()` text, e.g. "Last 30 days (2026-07-03 – 2026-08-01)". */
  periodLabel: string
  /** Enriched rows from `enrichTeamSummaryRowsForInline` (split overhead model). */
  breakdowns: TeamSummaryBreakdown[]
  /** Method A rate ($/field hour) or null while unloaded/unavailable. */
  overheadRate: number | null
  overheadRateLoading: boolean
  overheadDecomp: TeamSummaryHtmlOverheadDecomp
  /** Embedded only (dead path): initially-highlighted person; null for popups. */
  selectedPersonName: string | null
}

export function buildTeamSummaryHtml(ctx: TeamSummaryHtmlContext): string {
  const {
    isEmbedded,
    periodLabel,
    breakdowns: breakdownsPayload,
    overheadRate,
    overheadRateLoading,
    overheadDecomp,
    selectedPersonName: initialSelectedPersonName,
  } = ctx
  const escapeHtml = (s: string) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  const overheadMetaText = overheadRateLoading
    ? 'Overhead Method A: loading…'
    : overheadRate == null
      ? 'Overhead Method A: unavailable'
      : `Overhead Method A: $${overheadRate.toFixed(2)} per field hour (rolling 90-day rate)`
  const overheadMetaClickable = !overheadRateLoading && overheadRate != null
  const overheadMetaHtml = overheadMetaClickable
    ? `<button type="button" id="overhead-meta-btn" class="meta-sub-btn" title="Click for rate decomposition">${escapeHtml(overheadMetaText)} <span aria-hidden="true">&#9432;</span></button>`
    : escapeHtml(overheadMetaText)

  const breakdownsJson = JSON.stringify(breakdownsPayload).replace(/</g, '\\u003c')
  const overheadRateJson = overheadRate == null ? 'null' : String(overheadRate)
  const overheadDecompJson = JSON.stringify(overheadDecomp).replace(/</g, '\\u003c')
  const selectedPersonNameJson = JSON.stringify(initialSelectedPersonName).replace(/</g, '\\u003c')

  const embeddedResizeScript = isEmbedded
    ? `<script>(function(){
              if (window.parent === window) return;
              var lastH = 0;
              function postH(h){ var r = Math.ceil(h); if (r === lastH) return; lastH = r; try { parent.postMessage({ type: 'team-summary-resize', height: r }, '*'); } catch(e) {} }
              function reportHeight(){
                var modal = document.getElementById('modal');
                var open = modal && modal.classList.contains('open');
                var bodyH = document.documentElement.scrollHeight || document.body.scrollHeight || 0;
                if (open) { postH(Math.max(bodyH, modal.offsetHeight + 100)); } else { postH(bodyH); }
              }
              reportHeight();
              if (typeof ResizeObserver === 'function') { try { new ResizeObserver(reportHeight).observe(document.body); } catch(e) {} }
              window.addEventListener('load', reportHeight);
              setTimeout(reportHeight, 100); setTimeout(reportHeight, 500);
              var m = document.getElementById('modal');
              if (m && typeof MutationObserver === 'function') { try { new MutationObserver(reportHeight).observe(m, { attributes: true, attributeFilter: ['class'] }); } catch(e) {} }
            })();</script>`
    : ''

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Team Summary</title><style>
      html, body { background: transparent; }
      body { font-family: sans-serif; margin: ${isEmbedded ? '0' : '1in'}; }
      h1 { margin-bottom: 0.25rem;${isEmbedded ? ' display: none;' : ''} }
      .meta { color: #6b7280; margin-bottom: 0.25rem;${isEmbedded ? ' font-size: 0.85rem;' : ''} }
      .meta-sub { color: #6b7280; margin-bottom: 0.75rem;${isEmbedded ? ' font-size: 0.85rem;' : ' font-size: 0.9rem;'} }
      .meta-sub-btn { background: none; border: 0; padding: 0; color: #2563eb; cursor: pointer; font: inherit; text-decoration: underline dotted; text-underline-offset: 2px; }
      .meta-sub-btn:hover { color: #1d4ed8; }
      .tools { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.5rem; }
      .tools input[type="search"] { padding: 0.35rem 0.6rem; border: 1px solid #d1d5db; border-radius: 4px; font: inherit; min-width: 220px; }
      .tools input[type="search"]:focus { outline: 2px solid #2563eb; outline-offset: -1px; border-color: #2563eb; }
      .tools .reset-sort-btn { padding: 0.3rem 0.6rem; border: 1px solid #d1d5db; background: #fff; color: #374151; border-radius: 4px; font-size: 0.8rem; cursor: pointer; }
      .tools .reset-sort-btn:hover { background: #f9fafb; }
      .tools .reset-sort-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .tools .filter-status { color: #6b7280; font-size: 0.85rem; }
      table { width: auto; border-collapse: collapse; table-layout: auto; }
      th, td { border: 1px solid #e5e7eb; white-space: nowrap; }
      th { padding: 0.5rem 0.75rem; text-align: left; background: #f9fafb; font-weight: 600; vertical-align: bottom; position: relative; }
      th.num { text-align: center; }
      th[data-sort] { cursor: pointer; user-select: none; }
      th[data-sort]:hover { background: #f3f4f6; }
      th[data-sort]:focus-visible { outline: 2px solid #2563eb; outline-offset: -2px; }
      th .sort-indicator { display: inline-block; width: 0.7em; margin-left: 0.25em; color: #9ca3af; font-size: 0.75em; vertical-align: middle; }
      th[aria-sort="ascending"] .sort-indicator,
      th[aria-sort="descending"] .sort-indicator { color: #1f2937; }
      tfoot td { border-top: 2px solid #d1d5db; }
      tbody.empty-state td { padding: 1rem 0.75rem; text-align: center; color: #6b7280; font-style: italic; background: #fafafa; }
      .click-cell:hover { background: #eff6ff; }
      .click-cell:focus-visible { outline: 2px solid #2563eb; outline-offset: -2px; }
      /* Toggleable name cell — picks the person to expand below the table
         (the iframe posts team-summary-select-person and the parent React
         app mounts the per-person panel). Whole row tints when selected so
         the eye sees the active person instantly even on wide tables. */
      .person-name-btn {
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
      .person-name-btn .chevron { color: #6b7280; font-size: 0.8em; width: 0.7em; display: inline-block; }
      .person-name-btn:hover .person-name-text { color: #2563eb; }
      .person-name-btn:focus-visible { outline: 2px solid #2563eb; outline-offset: 1px; border-radius: 2px; }
      tbody tr.selected-person td { background: #dbeafe; }
      tbody tr.selected-person .person-name-btn .person-name-text { font-weight: 700; color: #1e3a8a; }
      tbody tr.selected-person .person-name-btn .chevron { color: #1e3a8a; }
      .footer-caption { color: #6b7280; font-size: 0.8rem; margin-top: 0.5rem; }
      .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: none; z-index: 9; }
      .modal-backdrop.open { display: block; }
      .modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; border-radius: 8px; padding: 1rem 1.5rem 1.5rem; max-width: 90vw; max-height: 85vh; overflow: auto; box-shadow: 0 10px 40px rgba(0,0,0,0.25); display: none; z-index: 10; min-width: 400px; }
      .modal.open { display: block; }
      .modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; gap: 1rem; }
      .modal-header h2 { margin: 0; font-size: 1.1rem; }
      .modal-header-actions { display: flex; align-items: center; gap: 0.5rem; }
      .modal-print { background: #fff; border: 1px solid #d1d5db; padding: 0.25rem 0.6rem; border-radius: 4px; font-size: 0.8rem; cursor: pointer; color: #374151; line-height: 1.2; }
      .modal-print:hover { background: #f9fafb; }
      .modal-print:focus-visible { outline: 2px solid #2563eb; outline-offset: 1px; }
      .modal-close { background: none; border: none; font-size: 1.5rem; line-height: 1; cursor: pointer; color: #6b7280; padding: 0.25rem 0.5rem; border-radius: 4px; }
      .modal-close:hover { background: #f3f4f6; color: #111827; }
      .modal-close:focus-visible { outline: 2px solid #2563eb; outline-offset: 1px; }
      .modal h3 { margin-top: 1.25rem; margin-bottom: 0.5rem; font-size: 0.95rem; color: #374151; }
      .modal table { width: 100%; }
      .modal th, .modal td { padding: 0.35rem 0.6rem; white-space: normal; }
      .modal td.num, .modal th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
      .modal .caption { color: #6b7280; font-size: 0.85rem; margin-top: 1rem; }
      /* Hours breakdown — hierarchical Day -> (pct) Job # | Job Name layout (v2.543). */
      .modal .hours-day-list { display: block; }
      .modal .hours-day-section { padding: 0.45rem 0; border-bottom: 1px solid #f3f4f6; }
      .modal .hours-day-section:last-child { border-bottom: none; }
      .modal .hours-day-header { color: #1f2937; font-weight: 600; font-size: 0.92rem; }
      /* Match the date's typography exactly so "6.8 hrs" reads the same as
         "Mon 2026-05-04"; only nudge for spacing. */
      .modal .hours-day-header .day-hours { margin-left: 0.5rem; }
      /* Clickable day-header variant: the whole row is a <button> that bridges
         out to the parent app to open DashboardMyTimeDayEditorModal for that
         (person, work_date). Only the date text gets the underline so the
         affordance is obvious without making the whole row visually noisy. */
      .modal button.hours-day-header.day-link {
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
      .modal button.hours-day-header.day-link .day-link-date {
        color: #2563eb;
        text-decoration: underline dotted;
        text-underline-offset: 3px;
      }
      .modal button.hours-day-header.day-link:hover { background: #eff6ff; }
      .modal button.hours-day-header.day-link:hover .day-link-date { color: #1d4ed8; }
      .modal button.hours-day-header.day-link:focus-visible {
        outline: 2px solid #2563eb;
        outline-offset: 1px;
      }
      .modal .hours-day-allocs { margin-left: 1.5rem; margin-top: 0.25rem; color: #374151; font-size: 0.9rem; line-height: 1.5; }
      .modal .hours-day-alloc { padding: 0.02rem 0; }
      .modal .hours-day-alloc .alloc-pct { display: inline-block; min-width: 3.4rem; color: #6b7280; font-variant-numeric: tabular-nums; }
      .modal .hours-day-alloc .alloc-jobnum { color: #1f2937; font-variant-numeric: tabular-nums; }
      .modal .hours-day-alloc .alloc-jobname { color: #4b5563; }
      .modal .hours-day-alloc .alloc-address { color: #6b7280; }
      .modal .hours-day-alloc .alloc-counted { color: #6b7280; margin-left: 0.5rem; font-variant-numeric: tabular-nums; }
      .modal .hours-day-noalloc { color: #9ca3af; font-style: italic; font-size: 0.85rem; padding: 0.05rem 0; }
      .modal .hours-day-total { margin-top: 0.85rem; padding-top: 0.5rem; border-top: 2px solid #d1d5db; font-weight: 600; font-size: 0.95rem; color: #1f2937; }
      @media print {
        body { margin: 0.5in; }
        .tools { display: none !important; }
        th[data-sort] { cursor: default; }
        th .sort-indicator { display: none; }
        .click-cell { color: inherit !important; text-decoration: none !important; cursor: default !important; }
        /* Default print: hide all modal chrome (whole-table print). */
        body:not(.printing-modal) .modal-backdrop,
        body:not(.printing-modal) .modal { display: none !important; }
        /* Modal-only print mode: hide everything except the modal body. */
        body.printing-modal h1,
        body.printing-modal .meta,
        body.printing-modal .meta-sub,
        body.printing-modal .tools,
        body.printing-modal > table,
        body.printing-modal .footer-caption,
        body.printing-modal .modal-backdrop,
        body.printing-modal .modal-print,
        body.printing-modal .modal-close { display: none !important; }
        body.printing-modal .modal {
          position: static !important;
          transform: none !important;
          box-shadow: none !important;
          border: none !important;
          padding: 0 !important;
          max-width: 100% !important;
          max-height: none !important;
          min-width: 0 !important;
          display: block !important;
          overflow: visible !important;
        }
      }
    </style></head><body>
      <h1>Team Summary</h1>
      <div class="meta">${escapeHtml(periodLabel)} &middot; ${breakdownsPayload.length} ${breakdownsPayload.length === 1 ? 'person' : 'people'}</div>
      <div class="meta-sub">${overheadMetaHtml}</div>
      <div class="tools" id="tools">
        <input type="search" id="search-input" placeholder="Search by name…" aria-label="Filter people by name">
        <span class="filter-status" id="filter-status" aria-live="polite"></span>
        <button type="button" id="reset-sort" class="reset-sort-btn" title="Sort by Profit (after overhead), descending">Reset sort</button>
      </div>
      <table>
        <thead><tr>
          <th data-sort="name" tabindex="0" role="columnheader" aria-sort="none">Name<span class="sort-indicator" aria-hidden="true"></span></th>
          <th class="num" data-sort="totalHours" tabindex="0" role="columnheader" aria-sort="none">Hours<span class="sort-indicator" aria-hidden="true"></span></th>
          <th class="num" data-sort="overheadHours" tabindex="0" role="columnheader" aria-sort="none">Overhead<br>hrs<span class="sort-indicator" aria-hidden="true"></span></th>
          <th class="num" data-sort="overheadLaborCost" tabindex="0" role="columnheader" aria-sort="none">Overhead<br>labor<span class="sort-indicator" aria-hidden="true"></span></th>
          <th class="num" data-sort="overheadBurden" tabindex="0" role="columnheader" aria-sort="none">Overhead<br>Burden<span class="sort-indicator" aria-hidden="true"></span></th>
          <th class="num" data-sort="fieldHours" tabindex="0" role="columnheader" aria-sort="none">Field<br>hrs<span class="sort-indicator" aria-hidden="true"></span></th>
          <th class="num" data-sort="gross" tabindex="0" role="columnheader" aria-sort="none">Gross<br>Revenue<span class="sort-indicator" aria-hidden="true"></span></th>
          <th class="num" data-sort="net" tabindex="0" role="columnheader" aria-sort="none">Net<br>Revenue<span class="sort-indicator" aria-hidden="true"></span></th>
          <th class="num" data-sort="profitAfterOverhead" tabindex="0" role="columnheader" aria-sort="descending">Profit<br>(after overhead)<span class="sort-indicator" aria-hidden="true"></span></th>
          <th class="num" data-sort="revPerHour" tabindex="0" role="columnheader" aria-sort="none">Gross<br>Revenue/hr<span class="sort-indicator" aria-hidden="true"></span></th>
          <th class="num" data-sort="netPerHour" tabindex="0" role="columnheader" aria-sort="none">Net<br>Revenue/hr<span class="sort-indicator" aria-hidden="true"></span></th>
          <th class="num" data-sort="profitPerHourAfterOverhead" tabindex="0" role="columnheader" aria-sort="none">Profit/hr<br>(after overhead)<span class="sort-indicator" aria-hidden="true"></span></th>
        </tr></thead>
        <tbody id="tbody"></tbody>
        <tfoot id="tfoot"></tfoot>
      </table>
      <p class="footer-caption" id="footer-caption"></p>
      <div class="modal-backdrop" id="modal-backdrop"></div>
      <div class="modal" id="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal-header">
          <h2 id="modal-title"></h2>
          <div class="modal-header-actions">
            <button class="modal-print" id="modal-print" type="button" aria-label="Print this breakdown" title="Print only this breakdown">Print</button>
            <button class="modal-close" id="modal-close" type="button" aria-label="Close">&times;</button>
          </div>
        </div>
        <div id="modal-body"></div>
      </div>
      <script>(function(){
        var breakdowns = ${breakdownsJson};
        var overheadRate = ${overheadRateJson};
        var overheadDecomp = ${overheadDecompJson};
        // Currently-expanded person (or null). Set by the parent at render
        // time (initial paint) and mutated locally on toggle clicks; the
        // parent re-affirms it on each iframe srcDoc refresh by re-encoding
        // it into this JSON literal, so an auto-refresh never loses the
        // highlight or accidentally surfaces a stale selection.
        var selectedPersonName = ${selectedPersonNameJson};
        function escH(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
        function fmtH(n){ return (Math.round(n*10)/10).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
        function fmtPct(n){ return Math.round(n) + '%'; }
        function fmtPct1(n){ return (Math.round(n*10)/10).toFixed(1) + '%'; }
        function fmtMoney(n){ return (n < 0 ? '-$' : '$') + Math.round(Math.abs(n)).toLocaleString('en-US', { maximumFractionDigits: 0 }); }

        // ---- Cell HTML builders (iframe-side; mirror the pre-v2.541 TS versions) ----
        var CELL_STYLE_BASE = 'padding:0.4rem 0.75rem;border:1px solid #e5e7eb;text-align:center;font-variant-numeric:tabular-nums;';
        var CELL_STYLE_DASH = 'padding:0.4rem 0.75rem;border:1px solid #e5e7eb;text-align:center;color:#9ca3af;';
        var CELL_STYLE_NAME = 'padding:0.4rem 0.75rem;border:1px solid #e5e7eb;';
        function negS(n){ return n < 0 ? 'color:#b91c1c;' : ''; }
        function dashTd(){ return '<td style="' + CELL_STYLE_DASH + '">\u2014</td>'; }
        function plainMoneyTd(n){ return '<td style="' + CELL_STYLE_BASE + negS(n) + '">' + fmtMoney(n) + '</td>'; }
        function plainHoursTd(n){ return '<td style="' + CELL_STYLE_BASE + '">' + fmtH(n) + '</td>'; }
        function moneyOrDashTd(n){ return n == null ? dashTd() : plainMoneyTd(n); }
        // The name cell renders either as plain text (popup mode -- no
        // per-person detail panel exists outside the iframe) or as a toggle
        // button (embedded mode) that asks the parent React app to expand
        // the per-person panel below the Team Summary. We can't compute
        // nameClickable up here because bridgeTarget() hasn't been
        // defined yet during hoisting; we check at render time instead.
        function nameTd(s){
          if (!nameToggleableForRender()) {
            return '<td style="' + CELL_STYLE_NAME + '">' + escH(s) + '</td>';
          }
          var isSel = (selectedPersonName != null && s === selectedPersonName);
          // \u25BE = ▾ (expanded), \u25B8 = ▸ (collapsed). Mirrors the chevron
          // convention used in other collapse/expand toggles in the app.
          var chev = isSel ? '\u25BE' : '\u25B8';
          var title = isSel ? 'Hide breakdown' : 'Show breakdown';
          return '<td style="' + CELL_STYLE_NAME + '">'
            + '<button type="button" class="person-name-btn"'
            + ' data-action="toggle-person" data-person="' + escH(s) + '"'
            + ' aria-pressed="' + (isSel ? 'true' : 'false') + '"'
            + ' title="' + escH(title) + '">'
            + '<span class="chevron" aria-hidden="true">' + chev + '</span>'
            + '<span class="person-name-text">' + escH(s) + '</span>'
            + '</button></td>';
        }
        // Lazily checks the bridge so we don't depend on definition order
        // inside the IIFE. Embedded iframe -> true; popup window -> false
        // (no detail panel lives outside the popup, so a toggle would be a
        // dead button).
        function nameToggleableForRender(){
          // bridgeTarget() is defined later in this IIFE; function
          // declarations are hoisted so this works even when invoked from
          // buildRowHtml() called during initial renderTable().
          var bt = bridgeTarget();
          return !!(bt && bt.kind === 'parent');
        }
        // Clickable + keyboard-focusable cell. type drives modal routing; ariaLabel
        // is the screen-reader description (e.g. "Hours breakdown for Robert: 38.5").
        function clickCellTd(opts){
          var color = opts.colored === false ? '' : 'color:#2563eb;';
          var dec = 'text-decoration:underline dotted;text-underline-offset:2px;';
          return '<td class="click-cell" data-idx="' + opts.idx + '" data-type="' + opts.type
            + '" tabindex="0" role="button" aria-label="' + escH(opts.ariaLabel)
            + '" title="' + escH(opts.title || 'Click for breakdown')
            + '" style="' + CELL_STYLE_BASE + 'cursor:pointer;' + color + dec + (opts.extraStyle || '') + '">'
            + opts.content + '</td>';
        }
        function hoursClickableTd(n, idx, name, isSalary){
          // For salaried people we render "(s)" instead of the assumed
          // 8 hrs/weekday total — see TeamSummaryInline.Row for the
          // matching inline-component logic. The numeric value still
          // flows through r.totalHours, so the footer keeps summing.
          var content = isSalary ? '(s)' : fmtH(n);
          var aria = isSalary
            ? 'Hours breakdown for ' + name + ': salary (' + fmtH(n) + ' hours assumed)'
            : 'Hours breakdown for ' + name + ': ' + fmtH(n) + ' hours';
          var title = isSalary
            ? 'Salaried \u2014 ' + fmtH(n) + ' hrs assumed (8 hrs/weekday). Click for breakdown.'
            : 'Click for breakdown';
          return clickCellTd({ idx: idx, type: 'hours', content: content,
            ariaLabel: aria, title: title });
        }
        function overheadHoursClickableTd(n, idx, name){
          if (n <= 0) return dashTd();
          return clickCellTd({ idx: idx, type: 'overhead_hours', content: fmtH(n),
            ariaLabel: 'Overhead hours breakdown for ' + name + ': ' + fmtH(n) + ' hours',
            title: 'Click for office vs bid breakdown' });
        }
        function overheadLaborClickableTd(n, idx, name){
          if (!(n < 0)) return dashTd();
          return clickCellTd({ idx: idx, type: 'overhead_labor', content: fmtMoney(n),
            ariaLabel: 'Overhead labor breakdown for ' + name + ': ' + fmtMoney(n),
            title: 'Click for overhead-labor breakdown',
            colored: false, extraStyle: negS(n) });
        }
        function overheadBurdenTd(n){
          // Plain (non-clickable) cell — the inline surface has a full
          // OverheadBurdenBody drilldown; here a tooltip explains the number.
          if (n == null || !(n < 0)) return dashTd();
          return '<td style="' + CELL_STYLE_BASE + negS(n) + '" title="Field-hour share of office parts (field hrs × parts rate)">' + fmtMoney(n) + '</td>';
        }
        function fieldHoursClickableTd(n, idx, name){
          if (n <= 0) return dashTd();
          return clickCellTd({ idx: idx, type: 'field_hours', content: fmtH(n),
            ariaLabel: 'Field hours breakdown for ' + name + ': ' + fmtH(n) + ' hours',
            title: 'Click for field-hours breakdown' });
        }
        function grossClickableTd(n, idx, name){
          return clickCellTd({ idx: idx, type: 'gross', content: fmtMoney(n),
            ariaLabel: 'Gross revenue breakdown for ' + name + ': ' + fmtMoney(n),
            extraStyle: negS(n) });
        }
        function netClickableTd(n, idx, name){
          return clickCellTd({ idx: idx, type: 'net', content: fmtMoney(n),
            ariaLabel: 'Net revenue breakdown for ' + name + ': ' + fmtMoney(n),
            extraStyle: negS(n) });
        }
        function profitClickableTd(n, idx, name){
          if (n == null) return dashTd();
          return clickCellTd({ idx: idx, type: 'profit', content: fmtMoney(n),
            ariaLabel: 'Profit after overhead breakdown for ' + name + ': ' + fmtMoney(n),
            extraStyle: negS(n) });
        }
        function grossPerHrClickableTd(n, idx, name){
          return clickCellTd({ idx: idx, type: 'rev_per_hr', content: fmtMoney(n),
            ariaLabel: 'Gross revenue per hour breakdown for ' + name + ': ' + fmtMoney(n) + ' per hour',
            extraStyle: negS(n) });
        }
        function netPerHrClickableTd(n, idx, name){
          return clickCellTd({ idx: idx, type: 'net_per_hr', content: fmtMoney(n),
            ariaLabel: 'Net revenue per hour breakdown for ' + name + ': ' + fmtMoney(n) + ' per hour',
            extraStyle: negS(n) });
        }
        function profitPerHrClickableTd(n, idx, name){
          if (n == null) return dashTd();
          return clickCellTd({ idx: idx, type: 'profit_per_hr', content: fmtMoney(n),
            ariaLabel: 'Profit per hour after overhead breakdown for ' + name + ': ' + fmtMoney(n) + ' per hour',
            extraStyle: negS(n) });
        }
        function buildRowHtml(r){
          var i = r.idx;
          var hasHours = r.totalHours > 0;
          // Light-blue row tint marks the currently-expanded person so the
          // eye finds them even on wide tables. Matches .person-name-btn
          // bold/blue text via the tr.selected-person selector.
          var rowAttrs = (selectedPersonName != null && r.name === selectedPersonName)
            ? ' class="selected-person"'
            : '';
          return '<tr' + rowAttrs + '>'
            + nameTd(r.name)
            + hoursClickableTd(r.totalHours, i, r.name, r.payConfigSource === 'salary')
            + overheadHoursClickableTd(r.overheadHours, i, r.name)
            + overheadLaborClickableTd(r.overheadLaborCost, i, r.name)
            + overheadBurdenTd(r.overheadBurden)
            + fieldHoursClickableTd(r.fieldHours, i, r.name)
            + grossClickableTd(r.gross, i, r.name)
            + netClickableTd(r.net, i, r.name)
            + profitClickableTd(r.profitAfterOverhead, i, r.name)
            + (hasHours ? grossPerHrClickableTd(r.revPerHour, i, r.name) : dashTd())
            + (hasHours ? netPerHrClickableTd(r.netPerHour, i, r.name) : dashTd())
            + (hasHours ? profitPerHrClickableTd(r.profitPerHourAfterOverhead, i, r.name) : dashTd())
            + '</tr>';
        }
        function buildFooterHtml(visibleRows){
          var totals = { hours: 0, overheadHours: 0, fieldHours: 0, overheadLaborCost: 0, overheadBurden: null, gross: 0, net: 0, profit: null };
          for (var i = 0; i < visibleRows.length; i++) {
            var r = visibleRows[i];
            totals.hours += r.totalHours;
            totals.overheadHours += r.overheadHours;
            totals.fieldHours += r.fieldHours;
            totals.overheadLaborCost += r.overheadLaborCost;
            if (r.overheadBurden != null) totals.overheadBurden = (totals.overheadBurden || 0) + r.overheadBurden;
            totals.gross += r.gross;
            totals.net += r.net;
            if (r.profitAfterOverhead != null) totals.profit = (totals.profit || 0) + r.profitAfterOverhead;
          }
          var n = visibleRows.length;
          var totalN = breakdowns.length;
          var label = (n === totalN)
            ? n + ' ' + (n === 1 ? 'person' : 'people')
            : 'Filtered total \u00b7 ' + n + ' of ' + totalN + ' ' + (totalN === 1 ? 'person' : 'people');
          var teamGrossPerHr = totals.hours > 0 ? totals.gross / totals.hours : 0;
          var teamNetPerHr = totals.hours > 0 ? totals.net / totals.hours : 0;
          var teamProfitPerHr = (totals.profit != null && totals.hours > 0) ? totals.profit / totals.hours : null;
          var html = '<tr style="font-weight:600;background:#f9fafb;">';
          html += '<td style="padding:0.5rem 0.75rem;border:1px solid #e5e7eb;">' + escH(label) + '</td>';
          html += plainHoursTd(totals.hours);
          html += plainHoursTd(totals.overheadHours);
          html += plainMoneyTd(totals.overheadLaborCost);
          html += moneyOrDashTd(totals.overheadBurden);
          html += plainHoursTd(totals.fieldHours);
          html += plainMoneyTd(totals.gross);
          html += plainMoneyTd(totals.net);
          html += moneyOrDashTd(totals.profit);
          html += (totals.hours > 0 ? plainMoneyTd(teamGrossPerHr) : dashTd());
          html += (totals.hours > 0 ? plainMoneyTd(teamNetPerHr) : dashTd());
          html += (totals.hours > 0 ? moneyOrDashTd(teamProfitPerHr) : dashTd());
          html += '</tr>';
          return html;
        }

        // ---- Sort + filter state ----
        // Default sort matches the pre-v2.541 server order: profit (after overhead) desc.
        // null sort values (e.g. r.profitAfterOverhead === null when overheadRate hasn't
        // loaded) sort to the bottom regardless of direction so they don't claim ranks.
        var sortKey = 'profitAfterOverhead';
        var sortDir = 'desc';
        var searchQuery = '';
        function compareRows(a, b){
          var av = a[sortKey];
          var bv = b[sortKey];
          var aN = (av == null);
          var bN = (bv == null);
          if (aN && bN) return a.name.localeCompare(b.name);
          if (aN) return 1;
          if (bN) return -1;
          var d;
          if (sortKey === 'name') {
            d = String(av).localeCompare(String(bv));
          } else {
            d = (av < bv ? -1 : av > bv ? 1 : 0);
          }
          if (d === 0) return a.name.localeCompare(b.name);
          return sortDir === 'asc' ? d : -d;
        }
        function getVisibleRows(){
          var q = searchQuery.trim().toLowerCase();
          var arr = q
            ? breakdowns.filter(function(r){ return r.name.toLowerCase().indexOf(q) >= 0; })
            : breakdowns.slice();
          arr.sort(compareRows);
          return arr;
        }
        function updateSortIndicators(){
          var ths = document.querySelectorAll('th[data-sort]');
          for (var i = 0; i < ths.length; i++) {
            var th = ths[i];
            var key = th.getAttribute('data-sort');
            var span = th.querySelector('.sort-indicator');
            if (key === sortKey) {
              th.setAttribute('aria-sort', sortDir === 'asc' ? 'ascending' : 'descending');
              if (span) span.textContent = sortDir === 'asc' ? '\u25B2' : '\u25BC';
            } else {
              th.setAttribute('aria-sort', 'none');
              if (span) span.textContent = '';
            }
          }
          var resetBtn = document.getElementById('reset-sort');
          if (resetBtn) {
            var atDefault = (sortKey === 'profitAfterOverhead' && sortDir === 'desc');
            resetBtn.disabled = atDefault;
          }
        }
        function updateFilterStatus(visible){
          var status = document.getElementById('filter-status');
          if (!status) return;
          var totalN = breakdowns.length;
          if (!searchQuery.trim()) {
            status.textContent = '';
            return;
          }
          status.textContent = 'Showing ' + visible.length + ' of ' + totalN + (totalN === 1 ? ' person' : ' people');
        }
        function updateFooterCaption(visible){
          var cap = document.getElementById('footer-caption');
          if (!cap) return;
          var notes = [];
          if (searchQuery.trim() && visible.length < breakdowns.length) {
            notes.push('Footer totals reflect only the people shown above.');
          }
          notes.push('Workers archived or external-only contribute to job revenue but are not in this table; their share of those jobs is not summed here.');
          cap.textContent = notes.join(' ');
        }
        function attachClickCellHandlers(){
          var cells = document.querySelectorAll('.click-cell');
          for (var i = 0; i < cells.length; i++) {
            (function(cell){
              cell.addEventListener('click', function(){
                var idx = parseInt(cell.getAttribute('data-idx') || '-1', 10);
                var type = cell.getAttribute('data-type') || '';
                if (idx >= 0) openModal(idx, type);
              });
              cell.addEventListener('keydown', function(e){
                if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
                  e.preventDefault();
                  var idx = parseInt(cell.getAttribute('data-idx') || '-1', 10);
                  var type = cell.getAttribute('data-type') || '';
                  if (idx >= 0) openModal(idx, type);
                }
              });
            })(cells[i]);
          }
        }
        function renderTable(){
          var visible = getVisibleRows();
          var tbody = document.getElementById('tbody');
          var tfoot = document.getElementById('tfoot');
          if (!tbody || !tfoot) return;
          if (visible.length === 0) {
            tbody.className = 'empty-state';
            tbody.innerHTML = '<tr><td colspan="11">No matches' + (searchQuery.trim() ? ' for \u201C' + escH(searchQuery.trim()) + '\u201D' : '') + '.</td></tr>';
          } else {
            tbody.className = '';
            var rowHtml = '';
            for (var i = 0; i < visible.length; i++) rowHtml += buildRowHtml(visible[i]);
            tbody.innerHTML = rowHtml;
          }
          tfoot.innerHTML = buildFooterHtml(visible);
          updateSortIndicators();
          updateFilterStatus(visible);
          updateFooterCaption(visible);
          attachClickCellHandlers();
        }
        // v2.543 — Hours breakdown renders each day as its own block with the
        // crew allocations indented underneath in the format
        //   (percent) Job # | Job Name
        // (vs the older single-row table where allocations were a comma-joined
        // string in a third column). Hierarchy reads better when there are 3+
        // jobs in a day and matches the way operators describe the day verbally.
        function dowShort(dateStr){
          // Local-noon parse to dodge UTC drift, e.g. 2026-05-12T12:00:00.
          if (!dateStr) return '';
          var dt = new Date(dateStr + 'T12:00:00');
          if (isNaN(dt.getTime())) return '';
          return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dt.getDay()];
        }
        function dayHeaderLabel(dateStr){
          var dow = dowShort(dateStr);
          return (dow ? dow + ' ' : '') + escH(dateStr);
        }
        function buildAllocLineHtml(a, opts){
          var jobName = a.jobName ? escH(a.jobName) : '<span style="color:#9ca3af;">\u2014</span>';
          var html = '<div class="hours-day-alloc">'
            + '<span class="alloc-pct">(' + fmtPct1(a.pct) + ')</span> '
            + '<span class="alloc-jobnum">' + escH(a.hcp) + '</span> | '
            + '<span class="alloc-jobname">' + jobName + '</span>';
          // Render the address only when present so blank addresses on
          // Office / future jobs don't trail with a dangling "- ".
          if (a.address) {
            html += ' <span class="alloc-address">- ' + escH(a.address) + '</span>';
          }
          if (opts && opts.showCounted) {
            html += '<span class="alloc-counted">\u00b7 ' + fmtH(a.hours) + ' hrs counted</span>';
          }
          html += '</div>';
          return html;
        }
        function buildDaySectionHtml(d, opts){
          var html = '<div class="hours-day-section">';
          var headerInner = '<span class="day-link-date">' + dayHeaderLabel(d.date) + '</span>'
            + '<span class="day-hours">\u00b7 ' + fmtH(d.hours) + ' hrs</span>';
          if (opts && opts.showCounted) {
            var counted = d.crewAllocations.reduce(function(s,a){ return s + a.hours; }, 0);
            headerInner += '<span class="day-hours">\u00b7 ' + fmtH(counted) + ' hrs counted</span>';
          }
          // Render the header as a <button> when the parent app is reachable
          // (embedded mode, or popup that still has window.opener). Clicking
          // the button posts a message asking the parent to open
          // DashboardMyTimeDayEditorModal for (personName, d.date).
          var clickable = opts && opts.clickableDay && opts.personName;
          if (clickable) {
            html += '<button type="button" class="hours-day-header day-link"'
              + ' data-action="open-day-editor"'
              + ' data-person="' + escH(opts.personName) + '"'
              + ' data-date="' + escH(d.date) + '"'
              + ' title="Open My Time for this day"'
              + ' aria-label="Open My Time for ' + escH(opts.personName) + ' on ' + escH(d.date) + '">'
              + headerInner
              + '</button>';
          } else {
            html += '<div class="hours-day-header">' + headerInner + '</div>';
          }
          html += '<div class="hours-day-allocs">';
          if (d.crewAllocations.length === 0) {
            html += '<div class="hours-day-noalloc">No crew assignment</div>';
          } else {
            // Sort allocations within the day by descending pct so the
            // biggest job rises to the top of each day's list.
            var allocs = d.crewAllocations.slice().sort(function(a,b){ return b.pct - a.pct; });
            for (var ai = 0; ai < allocs.length; ai++) {
              html += buildAllocLineHtml(allocs[ai], opts);
            }
          }
          html += '</div>';
          html += '</div>';
          return html;
        }
        function buildHoursBody(hb, modalOpts){
          // modalOpts: { personName, clickableDay } — flows from openModal()
          // into buildDaySectionHtml so day headers can render as clickable
          // buttons that bridge to DashboardMyTimeDayEditorModal in the parent.
          var personName = (modalOpts && modalOpts.personName) || '';
          var clickableDay = !!(modalOpts && modalOpts.clickableDay && personName);
          var sectionOpts = function(showCounted){
            return { showCounted: showCounted, clickableDay: clickableDay, personName: personName };
          };
          var srcLabel = hb.source === 'salary' ? 'Salaried (8 hrs/weekday)' : hb.source === 'hourly' ? 'Hourly (from people_hours / clock sessions)' : 'Unknown (no pay config row)';
          var modeLabel = hb.onlyPaidJobs ? 'Only paid jobs (sub labor + crew assignments)' : 'All days in period (clocked / salary)';
          var html = '';
          html += '<div style="margin-bottom:0.75rem;color:#374151;">';
          html += '<div><strong>Source:</strong> ' + escH(srcLabel) + '</div>';
          html += '<div><strong>Counting mode:</strong> ' + escH(modeLabel) + '</div>';
          html += '</div>';
          // Sort dailyRows by date asc so the day-by-day story reads naturally.
          var sortedDailyRows = hb.dailyRows.slice().sort(function(a,b){ return (a.date || '').localeCompare(b.date || ''); });
          if (hb.onlyPaidJobs) {
            var hasCrew = sortedDailyRows.some(function(d){ return d.crewAllocations.length > 0; });
            if (hasCrew) {
              html += '<h3>Crew jobs (per day)</h3>';
              html += '<div class="hours-day-list">';
              for (var i = 0; i < sortedDailyRows.length; i++) {
                var d = sortedDailyRows[i];
                if (d.crewAllocations.length === 0) continue;
                html += buildDaySectionHtml(d, sectionOpts(true));
              }
              html += '</div>';
              html += '<div class="hours-day-total">Crew subtotal: ' + fmtH(hb.totals.crew) + ' hrs</div>';
            }
            if (hb.subLaborRows.length > 0) {
              html += '<h3>Sub labor jobs</h3>';
              html += '<table><thead><tr><th>Date</th><th>Job #</th><th class="num">Hours</th></tr></thead><tbody>';
              var sub = hb.subLaborRows.slice().sort(function(a,b){ return (a.date || '').localeCompare(b.date || ''); });
              for (var k=0; k<sub.length; k++) {
                var s = sub[k];
                html += '<tr><td>' + escH(s.date) + '</td><td>' + escH(s.hcp) + '</td><td class="num">' + fmtH(s.hours) + '</td></tr>';
              }
              html += '</tbody><tfoot><tr><td colspan="2" style="text-align:right;font-weight:600;">Sub labor subtotal</td><td class="num" style="font-weight:600;">' + fmtH(hb.totals.subLabor) + '</td></tr></tfoot></table>';
            }
            html += '<p class="caption">Total = crew (' + fmtH(hb.totals.crew) + ') + sub labor (' + fmtH(hb.totals.subLabor) + ') = ' + fmtH(hb.totals.totalHours) + ' hrs. Each crew line shows <em>(pct) Job # | Job Name</em>; pct is the share of the day attributed to that job.</p>';
          } else {
            if (sortedDailyRows.length > 0) {
              html += '<div class="hours-day-list">';
              for (var i2 = 0; i2 < sortedDailyRows.length; i2++) {
                html += buildDaySectionHtml(sortedDailyRows[i2], sectionOpts(false));
              }
              html += '</div>';
            } else {
              html += '<p class="caption">No daily hours recorded in this period.</p>';
            }
            if (hb.subLaborRows.length > 0) {
              html += '<h3 style="margin-top:1.5rem;">Sub labor jobs (informational \u2014 not counted in this mode)</h3>';
              html += '<table><thead><tr><th>Date</th><th>Job #</th><th class="num">Hours</th></tr></thead><tbody>';
              var sub2 = hb.subLaborRows.slice().sort(function(a,b){ return (a.date || '').localeCompare(b.date || ''); });
              for (var k2=0; k2<sub2.length; k2++) {
                var s2 = sub2[k2];
                html += '<tr><td>' + escH(s2.date) + '</td><td>' + escH(s2.hcp) + '</td><td class="num">' + fmtH(s2.hours) + '</td></tr>';
              }
              html += '</tbody><tfoot><tr><td colspan="2" style="text-align:right;font-weight:600;">Sub labor subtotal</td><td class="num" style="font-weight:600;">' + fmtH(hb.totals.subLabor) + '</td></tr></tfoot></table>';
            }
            // Always-on discoverability hint for the Review-level toggle, even
            // when this period has no sub-labor rows -- they may exist in
            // other periods and the toggle still affects how Hours is counted.
            html += '<p class="caption">Sub labor hours are not added in this mode \u2014 toggle "Only paid jobs" in Review to count them.</p>';
          }
          return html;
        }
        function buildGrossBody(gb) {
          var html = '';
          if (!gb.jobs || gb.jobs.length === 0) {
            html += '<p class="caption">No jobs contributed to revenue in this period.</p>';
            html += '<p class="caption">Gross Revenue is each job\\'s <strong>Value Created</strong> (Total Bill &times; % Complete) multiplied by your <strong>share</strong> on that job (your labor cost in this period &divide; total labor on the job, all-time).</p>';
            return html;
          }
          // Center every column header and cell so the table reads as a
          // centered grid (numbers still tabular-aligned via font-variant).
          html += '<table>';
          html += '<thead><tr>';
          html += '<th class="num" style="text-align:center;">Job #</th>';
          html += '<th style="text-align:center;">Job</th>';
          html += '<th class="num" style="text-align:center;">Total Bill</th>';
          html += '<th class="num" style="text-align:center;">% Complete</th>';
          html += '<th class="num" style="text-align:center;">Value Created</th>';
          html += '<th class="num" style="text-align:center;">Your cost<br>(period)</th>';
          html += '<th class="num" style="text-align:center;">Total labor<br>(lifetime)</th>';
          html += '<th class="num" style="text-align:center;">Share</th>';
          html += '<th class="num" style="text-align:center;">Allocated</th>';
          html += '</tr></thead><tbody>';
          for (var i = 0; i < gb.jobs.length; i++) {
            var j = gb.jobs[i];
            var pctSuffix = j.pctCompleteSource === 'assumed' ? ' (assumed)' : '';
            html += '<tr>';
            html += '<td class="num" style="text-align:center;">' + escH(j.hcp) + '</td>';
            html += '<td style="text-align:center;">' + escH(j.jobName || '—') + '</td>';
            html += '<td class="num" style="text-align:center;">' + fmtMoney(j.totalBill) + '</td>';
            html += '<td class="num" style="text-align:center;">' + fmtPct(j.pctComplete) + escH(pctSuffix) + '</td>';
            html += '<td class="num" style="text-align:center;">' + fmtMoney(j.valueCreated) + '</td>';
            html += '<td class="num" style="text-align:center;">' + fmtMoney(j.costInPeriod) + '</td>';
            html += '<td class="num" style="text-align:center;">' + fmtMoney(j.totalLaborOnJob) + '</td>';
            html += '<td class="num" style="text-align:center;">' + fmtPct1(j.ratio * 100) + '</td>';
            html += '<td class="num" style="text-align:center;">' + fmtMoney(j.allocatedRevenue) + '</td>';
            html += '</tr>';
          }
          html += '</tbody>';
          html += '<tfoot><tr><td colspan="8" style="text-align:right;font-weight:600;">Total</td><td class="num" style="text-align:center;font-weight:600;">' + fmtMoney(gb.total) + '</td></tr></tfoot>';
          html += '</table>';
          html += '<p class="caption">Allocated = Value Created &times; (Your cost &divide; Total labor). Sorted by allocated revenue.</p>';
          html += '<p class="caption">Gross Revenue is each job\\'s <strong>Value Created</strong> (Total Bill &times; % Complete) multiplied by your <strong>share</strong> on that job (your labor cost in this period &divide; total labor on the job, all-time).</p>';
          return html;
        }
        function buildNetBody(nb) {
          var html = '';
          if (!nb.jobs || nb.jobs.length === 0) {
            html += '<p class="caption">No jobs contributed to net revenue in this period.</p>';
            html += '<p class="caption">Net Revenue is each job\\'s <strong>Net Revenue (before overhead)</strong> &mdash; Value Created minus parts and total labor &mdash; multiplied by your <strong>share</strong> on that job (your labor cost in this period &divide; total labor on the job, all-time).</p>';
            return html;
          }
          html += '<table>';
          html += '<thead><tr>';
          html += '<th class="num">Job #</th>';
          html += '<th>Job</th>';
          html += '<th class="num">Value<br>Created</th>';
          html += '<th class="num">&minus; Parts</th>';
          html += '<th class="num">&minus; Total<br>labor</th>';
          html += '<th class="num">= Net Rev<br>(job)</th>';
          html += '<th class="num">Your cost<br>(period)</th>';
          html += '<th class="num">Share</th>';
          html += '<th class="num">Allocated</th>';
          html += '</tr></thead><tbody>';
          for (var i = 0; i < nb.jobs.length; i++) {
            var j = nb.jobs[i];
            html += '<tr>';
            html += '<td class="num">' + escH(j.hcp) + '</td>';
            html += '<td>' + escH(j.jobName || '—') + '</td>';
            html += '<td class="num">' + fmtMoney(j.valueCreated) + '</td>';
            html += '<td class="num">' + fmtMoney(-(j.partsCost || 0)) + '</td>';
            html += '<td class="num">' + fmtMoney(-(j.totalLaborOnJob || 0)) + '</td>';
            html += '<td class="num"' + (j.revenueBeforeOverhead < 0 ? ' style="color:#b91c1c;"' : '') + '>' + fmtMoney(j.revenueBeforeOverhead) + '</td>';
            html += '<td class="num">' + fmtMoney(j.costInPeriod) + '</td>';
            html += '<td class="num">' + fmtPct1(j.ratio * 100) + '</td>';
            html += '<td class="num"' + (j.allocatedNet < 0 ? ' style="color:#b91c1c;"' : '') + '>' + fmtMoney(j.allocatedNet) + '</td>';
            html += '</tr>';
          }
          html += '</tbody>';
          html += '<tfoot><tr><td colspan="8" style="text-align:right;font-weight:600;">Total</td><td class="num"' + (nb.total < 0 ? ' style="color:#b91c1c;font-weight:600;"' : ' style="font-weight:600;"') + '>' + fmtMoney(nb.total) + '</td></tr></tfoot>';
          html += '</table>';
          html += '<p class="caption">Allocated = Net Rev (job) &times; (Your cost &divide; Total labor). Net Rev (job) = Value Created &minus; Parts &minus; Total labor. Sorted by allocated net.</p>';
          html += '<p class="caption">Net Revenue is each job\\'s <strong>Net Revenue (before overhead)</strong> &mdash; Value Created minus parts and total labor &mdash; multiplied by your <strong>share</strong> on that job (your labor cost in this period &divide; total labor on the job, all-time).</p>';
          return html;
        }
        function buildProfitBody(entry) {
          // Split overhead model — mirrors drilldowns.tsx ProfitBody: the
          // person's OWN office/bid wages (overheadLaborCost, negative) are
          // charged directly, and only the non-labor pool (office parts) is
          // spread across field hours (overheadBurden, negative). All three
          // figures come pre-computed from enrichTeamSummaryRowsForInline,
          // so this bottom line always equals the table cell.
          var pb = entry.pb;
          var net = pb.totalNet;
          var overheadLabor = entry.overheadLaborCost;
          var burden = entry.overheadBurden;
          var profit = entry.profitAfterOverhead;
          var html = '';
          html += '<div style="margin-bottom:0.75rem;color:#374151;">';
          if (burden == null || profit == null) {
            html += '<div style="margin-bottom:0.5rem;color:#b91c1c;">Overhead rate is unavailable. Open the Review tab and let the rate finish loading, then reopen Team Summary.</div>';
            html += '<div style="font-size:1.05rem;"><strong>Net Revenue: ' + fmtMoney(net) + '</strong></div>';
            html += '</div>';
            return html;
          }
          var partsRate = (overheadDecomp && overheadDecomp.fieldHours90d > 0) ? overheadDecomp.officeParts90d / overheadDecomp.fieldHours90d : 0;
          html += '<div style="margin-bottom:0.25rem;"><strong>Net Revenue (before overhead):</strong> ' + fmtMoney(net) + '</div>';
          html += '<div style="margin-bottom:0.25rem;"><strong>&minus; Overhead labor</strong> (your office + bid wages): <span' + (overheadLabor < 0 ? ' style="color:#b91c1c;"' : '') + '>' + fmtMoney(overheadLabor) + '</span></div>';
          html += '<div style="margin-bottom:0.25rem;"><strong>&minus; Overhead burden</strong> (your share of office parts): <span' + (burden < 0 ? ' style="color:#b91c1c;"' : '') + '>' + fmtMoney(burden) + '</span><span style="color:#6b7280;"> (' + fmtH(entry.fieldHours) + ' field hrs &times; $' + partsRate.toFixed(2) + '/hr)</span></div>';
          html += '<div style="font-size:1.05rem;"><strong>= Profit (after overhead): <span' + (profit < 0 ? ' style="color:#b91c1c;"' : '') + '>' + fmtMoney(profit) + '</span></strong></div>';
          html += '</div>';
          var rows = (pb.jobs || []).slice().sort(function(a, b){ return b.allocatedNet - a.allocatedNet; });
          if (rows.length > 0) {
            html += '<table>';
            html += '<thead><tr>';
            html += '<th>Job</th>';
            html += '<th class="num">Net Rev<br>(allocated)</th>';
            html += '<th class="num">Your hours<br>(period)</th>';
            html += '</tr></thead><tbody>';
            for (var i = 0; i < rows.length; i++) {
              var r = rows[i];
              html += '<tr>';
              html += '<td>' + (r.hcp ? '<span style="color:#6b7280;font-variant-numeric:tabular-nums;">' + escH(r.hcp) + '</span> ' : '') + escH(r.jobName || '—') + '</td>';
              html += '<td class="num"' + (r.allocatedNet < 0 ? ' style="color:#b91c1c;"' : '') + '>' + fmtMoney(r.allocatedNet) + '</td>';
              html += '<td class="num">' + fmtH(r.hoursInPeriod) + '</td>';
              html += '</tr>';
            }
            html += '</tbody></table>';
          }
          html += '<p class="caption">Split overhead model: Profit = Net Revenue &minus; <strong>your own overhead labor</strong> (office + bid wages) &minus; <strong>overhead burden</strong> (your field-hour share of office parts). Office and bid labor are charged directly to whoever logged them; only the non-labor pool (office parts) is spread across field hours. The two deductions are disjoint, so the team total reconciles to the overhead pool exactly once. The job rows above show how your Net Revenue was allocated (before overhead).</p>';
          return html;
        }
        function fmtMoneyPerHr(n) { return fmtMoney(n) + '/hr'; }
        function buildGrossPerHourBody(entry) {
          var gb = entry.gb;
          var pb = entry.pb;
          var totalHours = pb.totalHours;
          var totalGross = gb.total;
          var rate = totalHours > 0 ? totalGross / totalHours : 0;
          var html = '';
          html += '<div style="margin-bottom:0.75rem;color:#374151;">';
          html += '<div style="margin-bottom:0.25rem;"><strong>Gross Revenue:</strong> ' + fmtMoney(totalGross) + '</div>';
          html += '<div style="margin-bottom:0.25rem;"><strong>Total hours:</strong> ' + fmtH(totalHours) + '</div>';
          html += '<div style="font-size:1.05rem;"><strong>Gross Revenue/hr: ' + fmtMoneyPerHr(rate) + '</strong></div>';
          html += '</div>';
          if (!gb.jobs || gb.jobs.length === 0) {
            html += '<p class="caption">No jobs contributed to revenue in this period.</p>';
            return html;
          }
          var hoursByJob = {};
          for (var i = 0; i < pb.jobs.length; i++) hoursByJob[pb.jobs[i].jobId] = pb.jobs[i].hoursInPeriod;
          var rows = gb.jobs.map(function(j){
            var h = hoursByJob[j.jobId] || 0;
            var perHr = h > 0 ? j.allocatedRevenue / h : null;
            return { hcp: j.hcp, jobName: j.jobName, allocatedRevenue: j.allocatedRevenue, hoursInPeriod: h, perHr: perHr };
          });
          rows.sort(function(a, b){ return (b.perHr == null ? -1 : b.perHr) - (a.perHr == null ? -1 : a.perHr); });
          html += '<table>';
          html += '<thead><tr>';
          html += '<th class="num">Job #</th>';
          html += '<th>Job</th>';
          html += '<th class="num">Allocated<br>Gross Rev</th>';
          html += '<th class="num">Your hours<br>(period)</th>';
          html += '<th class="num">$/hr<br>(this job)</th>';
          html += '</tr></thead><tbody>';
          for (var k = 0; k < rows.length; k++) {
            var r = rows[k];
            html += '<tr>';
            html += '<td class="num">' + escH(r.hcp) + '</td>';
            html += '<td>' + escH(r.jobName || '—') + '</td>';
            html += '<td class="num">' + fmtMoney(r.allocatedRevenue) + '</td>';
            html += '<td class="num">' + fmtH(r.hoursInPeriod) + '</td>';
            html += '<td class="num">' + (r.perHr == null ? '<span style="color:#9ca3af;">—</span>' : fmtMoneyPerHr(r.perHr)) + '</td>';
            html += '</tr>';
          }
          if (pb.unaccountedHours > 0.01) {
            html += '<tr style="background:#fff7ed;">';
            html += '<td class="num">&mdash;</td>';
            html += '<td><em>Unallocated hours</em><div style="color:#6b7280;font-size:0.8rem;">Hours worked in the period that weren\\'t tied to a job &mdash; they dilute the headline rate but contribute no revenue.</div></td>';
            html += '<td class="num">' + fmtMoney(0) + '</td>';
            html += '<td class="num">' + fmtH(pb.unaccountedHours) + '</td>';
            html += '<td class="num"><span style="color:#9ca3af;">&mdash;</span></td>';
            html += '</tr>';
          }
          html += '</tbody>';
          html += '<tfoot><tr>';
          html += '<td colspan="2" style="text-align:right;font-weight:600;">Total</td>';
          html += '<td class="num" style="font-weight:600;">' + fmtMoney(totalGross) + '</td>';
          html += '<td class="num" style="font-weight:600;">' + fmtH(totalHours) + '</td>';
          html += '<td class="num" style="font-weight:600;">' + fmtMoneyPerHr(rate) + '</td>';
          html += '</tr></tfoot>';
          html += '</table>';
          html += '<p class="caption">Headline rate = Total Gross Revenue &divide; Total hours (including any unallocated hours). Per-job rate = Allocated Gross &divide; Your hours on that job. Sorted by per-job rate.</p>';
          html += '<p class="caption">Gross Revenue/hr is your <strong>total Gross Revenue</strong> divided by your <strong>total hours</strong> in the period. Per-job rates show how much each job paid per hour you spent on it.</p>';
          return html;
        }
        function buildNetPerHourBody(entry) {
          var nb = entry.nb;
          var pb = entry.pb;
          var totalHours = pb.totalHours;
          var totalNet = nb.total;
          var rate = totalHours > 0 ? totalNet / totalHours : 0;
          var html = '';
          html += '<div style="margin-bottom:0.75rem;color:#374151;">';
          html += '<div style="margin-bottom:0.5rem;">Net Revenue/hr is your <strong>total Net Revenue (before overhead)</strong> divided by your <strong>total hours</strong> in the period. Per-job rates show how much each job kept (after parts and labor) per hour you spent on it.</div>';
          html += '<div style="margin-bottom:0.25rem;"><strong>Net Revenue:</strong> ' + fmtMoney(totalNet) + '</div>';
          html += '<div style="margin-bottom:0.25rem;"><strong>Total hours:</strong> ' + fmtH(totalHours) + '</div>';
          html += '<div style="font-size:1.05rem;"><strong>Net Revenue/hr: <span' + (rate < 0 ? ' style="color:#b91c1c;"' : '') + '>' + fmtMoneyPerHr(rate) + '</span></strong></div>';
          html += '</div>';
          if (!nb.jobs || nb.jobs.length === 0) {
            html += '<p class="caption">No jobs contributed to net revenue in this period.</p>';
            return html;
          }
          var hoursByJob = {};
          for (var i = 0; i < pb.jobs.length; i++) hoursByJob[pb.jobs[i].jobId] = pb.jobs[i].hoursInPeriod;
          var rows = nb.jobs.map(function(j){
            var h = hoursByJob[j.jobId] || 0;
            var perHr = h > 0 ? j.allocatedNet / h : null;
            return { hcp: j.hcp, jobName: j.jobName, allocatedNet: j.allocatedNet, hoursInPeriod: h, perHr: perHr };
          });
          rows.sort(function(a, b){ return (b.perHr == null ? -Infinity : b.perHr) - (a.perHr == null ? -Infinity : a.perHr); });
          html += '<table>';
          html += '<thead><tr>';
          html += '<th class="num">Job #</th>';
          html += '<th>Job</th>';
          html += '<th class="num">Allocated<br>Net Rev</th>';
          html += '<th class="num">Your hours<br>(period)</th>';
          html += '<th class="num">$/hr<br>(this job)</th>';
          html += '</tr></thead><tbody>';
          for (var k = 0; k < rows.length; k++) {
            var r = rows[k];
            html += '<tr>';
            html += '<td class="num">' + escH(r.hcp) + '</td>';
            html += '<td>' + escH(r.jobName || '—') + '</td>';
            html += '<td class="num"' + (r.allocatedNet < 0 ? ' style="color:#b91c1c;"' : '') + '>' + fmtMoney(r.allocatedNet) + '</td>';
            html += '<td class="num">' + fmtH(r.hoursInPeriod) + '</td>';
            html += '<td class="num"' + (r.perHr != null && r.perHr < 0 ? ' style="color:#b91c1c;"' : '') + '>' + (r.perHr == null ? '<span style="color:#9ca3af;">—</span>' : fmtMoneyPerHr(r.perHr)) + '</td>';
            html += '</tr>';
          }
          if (pb.unaccountedHours > 0.01) {
            html += '<tr style="background:#fff7ed;">';
            html += '<td class="num">&mdash;</td>';
            html += '<td><em>Unallocated hours</em><div style="color:#6b7280;font-size:0.8rem;">Hours worked in the period that weren\\'t tied to a job &mdash; they dilute the headline rate but contribute no net revenue.</div></td>';
            html += '<td class="num">' + fmtMoney(0) + '</td>';
            html += '<td class="num">' + fmtH(pb.unaccountedHours) + '</td>';
            html += '<td class="num"><span style="color:#9ca3af;">&mdash;</span></td>';
            html += '</tr>';
          }
          html += '</tbody>';
          html += '<tfoot><tr>';
          html += '<td colspan="2" style="text-align:right;font-weight:600;">Total</td>';
          html += '<td class="num"' + (totalNet < 0 ? ' style="color:#b91c1c;font-weight:600;"' : ' style="font-weight:600;"') + '>' + fmtMoney(totalNet) + '</td>';
          html += '<td class="num" style="font-weight:600;">' + fmtH(totalHours) + '</td>';
          html += '<td class="num"' + (rate < 0 ? ' style="color:#b91c1c;font-weight:600;"' : ' style="font-weight:600;"') + '>' + fmtMoneyPerHr(rate) + '</td>';
          html += '</tr></tfoot>';
          html += '</table>';
          html += '<p class="caption">Headline rate = Total Net Revenue &divide; Total hours (including any unallocated hours). Per-job rate = Allocated Net &divide; Your hours on that job. Sorted by per-job rate.</p>';
          return html;
        }
        function buildProfitPerHourBody(entry) {
          // Mirrors drilldowns.tsx ProfitPerHourBody (split overhead model):
          // Overhead/hr blends the person's own overhead labor + their parts
          // burden over every hour worked, so the bottom line always equals
          // the table cell (profitPerHourAfterOverhead comes pre-computed
          // from the shared enrichTeamSummaryRowsForInline).
          var totalHours = entry.pb.totalHours;
          var totalNet = entry.nb.total;
          var netPerHr = entry.netPerHour;
          var profit = entry.profitAfterOverhead;
          var profitPerHr = entry.profitPerHourAfterOverhead;
          var html = '';
          html += '<div style="margin-bottom:0.75rem;color:#374151;">';
          if (profit == null || profitPerHr == null) {
            html += '<div style="margin-bottom:0.5rem;color:#b91c1c;">Overhead rate is unavailable. Open the Review tab and let the rate finish loading, then reopen Team Summary.</div>';
            html += '<div><strong>Net Revenue:</strong> ' + fmtMoney(totalNet) + '</div>';
            html += '<div><strong>Total hours:</strong> ' + fmtH(totalHours) + '</div>';
            html += '</div>';
            return html;
          }
          var overheadPerHr = totalHours > 0 ? (entry.overheadLaborCost + (entry.overheadBurden || 0)) / totalHours : 0;
          html += '<div style="margin-bottom:0.25rem;"><strong>Net Revenue/hr (before overhead):</strong> ' + fmtMoneyPerHr(netPerHr) + '</div>';
          html += '<div style="margin-bottom:0.25rem;"><strong>&minus; Overhead/hr:</strong> <span' + (overheadPerHr < 0 ? ' style="color:#b91c1c;"' : '') + '>' + fmtMoneyPerHr(overheadPerHr) + '</span><span style="color:#6b7280;"> (own overhead labor + parts burden &divide; ' + fmtH(totalHours) + ' hrs)</span></div>';
          html += '<div style="font-size:1.05rem;"><strong>= Profit/hr (after overhead): <span' + (profitPerHr < 0 ? ' style="color:#b91c1c;"' : '') + '>' + fmtMoneyPerHr(profitPerHr) + '</span></strong></div>';
          html += '</div>';
          html += '<p class="caption">Profit/hr (after overhead) = Profit (after overhead) &divide; total hours. Overhead/hr blends this person&rsquo;s own overhead labor (office + bid wages) and their field-hour share of office parts over every hour worked. See the Profit (after overhead) breakdown for the dollar waterfall.</p>';
          return html;
        }
        function buildOverheadSessionsSection(label, sessions, bucketTotalHrs) {
          // sessions: array of pre-formatted OverheadSessionLine entries with
          // a single bucket (office or bid). Renders a hierarchical layout
          // matching the Hours breakdown modal: per-day header + indented
          // per-session lines. (pct) on each session is its share of that
          // day's bucket total. bucketTotalHrs is rendered next to the
          // section label so e.g. "Office \u00b7 17.7 hrs".
          var html = '';
          if (!sessions || sessions.length === 0) return '';
          var headerHtml = escH(label);
          if (typeof bucketTotalHrs === 'number') {
            // Match the section label typography exactly (no muted color /
            // weight / size); just nudge with margin-left for spacing.
            headerHtml += '<span style="margin-left:0.5rem;">\u00b7 ' + fmtH(bucketTotalHrs) + ' hrs</span>';
          }
          html += '<h3 style="text-align:center;">' + headerHtml + '</h3>';
          html += '<div class="hours-day-list">';
          // Group by workDate, preserving the parent-side sort order.
          var byDate = {};
          var datesInOrder = [];
          for (var i = 0; i < sessions.length; i++) {
            var s = sessions[i];
            if (!byDate[s.workDate]) {
              byDate[s.workDate] = [];
              datesInOrder.push(s.workDate);
            }
            byDate[s.workDate].push(s);
          }
          for (var di = 0; di < datesInOrder.length; di++) {
            var dateKey = datesInOrder[di];
            var daySessions = byDate[dateKey];
            var dayTotal = 0;
            for (var si = 0; si < daySessions.length; si++) dayTotal += (daySessions[si].hours || 0);
            html += '<div class="hours-day-section">';
            html += '<div class="hours-day-header">' + dayHeaderLabel(dateKey)
              + '<span class="day-hours">\u00b7 ' + fmtH(dayTotal) + ' hrs</span>'
              + '</div>';
            html += '<div class="hours-day-allocs">';
            for (var sj = 0; sj < daySessions.length; sj++) {
              var ss = daySessions[sj];
              var pct = dayTotal > 0 ? (ss.hours / dayTotal) * 100 : 0;
              html += '<div class="hours-day-alloc">';
              html += '<span class="alloc-pct">(' + fmtPct1(pct) + ')</span> ';
              if (ss.bucket === 'bid') {
                // Match the Hours breakdown convention: B# | Project Name - address.
                var bidName = ss.bidName ? escH(ss.bidName) : '<span style="color:#9ca3af;">\u2014</span>';
                html += '<span class="alloc-jobnum">' + escH(ss.bidHcp || 'B?') + '</span> | ';
                html += '<span class="alloc-jobname">' + bidName + '</span>';
                if (ss.bidAddress) {
                  html += ' <span class="alloc-address">- ' + escH(ss.bidAddress) + '</span>';
                }
              } else {
                // Office sessions: time range + hours act as the "session details".
                if (ss.startTime && ss.endTime) {
                  html += '<span class="alloc-jobname">' + escH(ss.startTime + ' \u2192 ' + ss.endTime) + '</span>';
                } else {
                  html += '<span class="alloc-jobname">Office session</span>';
                }
              }
              html += '<span class="alloc-counted">\u00b7 ' + fmtH(ss.hours) + ' hrs</span>';
              html += '</div>';
            }
            html += '</div>';
            html += '</div>';
          }
          return html;
        }
        function buildOverheadHoursBody(entry) {
          var officeHrs = entry.officeHours || 0;
          var bidHrs = entry.bidHours || 0;
          var totalOverhead = officeHrs + bidHrs;
          var totalWork = (entry.hb && entry.hb.totals && entry.hb.totals.totalHours) || 0;
          var fieldHrs = entry.fieldHours || 0;
          var sessions = entry.overheadSessions || [];
          var officeSessions = [];
          var bidSessions = [];
          for (var oi = 0; oi < sessions.length; oi++) {
            if (sessions[oi].bucket === 'office') officeSessions.push(sessions[oi]);
            else if (sessions[oi].bucket === 'bid') bidSessions.push(sessions[oi]);
          }
          var html = '';
          if (officeSessions.length === 0 && bidSessions.length === 0) {
            html += '<p class="caption">No approved office or bid sessions in this period.</p>';
          } else {
            html += buildOverheadSessionsSection('Office', officeSessions, officeHrs);
            html += buildOverheadSessionsSection('Bids', bidSessions, bidHrs);
          }
          html += '<table>';
          html += '<thead><tr><th>Bucket</th><th class="num">Hours</th><th class="num" style="text-align:left;">Share of total work</th></tr></thead>';
          html += '<tbody>';
          html += '<tr><td>Overhead (office + bid)</td><td class="num">' + fmtH(totalOverhead) + '</td><td class="num" style="text-align:left;">' + (totalWork > 0 ? fmtPct1((totalOverhead / totalWork) * 100) : '<span style="color:#9ca3af;">&mdash;</span>') + '</td></tr>';
          html += '<tr><td>Field (residual)</td><td class="num">' + fmtH(fieldHrs) + '</td><td class="num" style="text-align:left;">' + (totalWork > 0 ? fmtPct1((fieldHrs / totalWork) * 100) : '<span style="color:#9ca3af;">&mdash;</span>') + '</td></tr>';
          html += '</tbody>';
          html += '<tfoot><tr><td style="text-align:right;font-weight:600;">Total work</td><td class="num" style="font-weight:600;">' + fmtH(totalWork) + '</td><td></td></tr></tfoot>';
          html += '</table>';
          html += '<p class="caption">Field hrs = Total work hrs &minus; Overhead hrs. For salaried people, total work is their weekday salary days (8 hrs/weekday); for hourly, it is people_hours / clock sessions. <strong>Every hour worked is charged the per-hour overhead in the &ldquo;Profit (after overhead)&rdquo; column</strong> &mdash; field, office, and bid hours all incur the same rate.</p>';
          html += '<p class="caption">Overhead hours are approved clock sessions on the configured Office job or on any bid &mdash; the same buckets that feed the rolling 90-day overhead rate.</p>';
          return html;
        }
        function buildOverheadLaborBody(entry) {
          var officeHrs = entry.officeHours || 0;
          var bidHrs = entry.bidHours || 0;
          var fieldHrs = entry.fieldHours || 0;
          var overheadHrs = officeHrs + bidHrs;
          var wage = entry.overheadWage || entry.hourlyWage || 0;
          var overheadLaborCost = entry.overheadLaborCost || 0;
          var src = entry.payConfigSource || 'unknown';
          var srcLabel = src === 'salary' ? 'Salaried (weekday hrs \u00d7 hourly_wage from people_pay_config)' : src === 'hourly' ? 'Hourly (people_hours / clock sessions \u00d7 hourly_wage)' : 'Unknown (no people_pay_config row \u2014 wage treated as $0)';
          var html = '';
          html += '<div style="margin-bottom:0.75rem;color:#374151;">';
          html += '<div><strong>Source:</strong> ' + escH(srcLabel) + '</div>';
          html += '<div><strong>Hourly wage:</strong> ' + (wage > 0 ? '$' + wage.toFixed(2) + '/hr' : '<span style="color:#9ca3af;">not configured</span>') + '</div>';
          html += '<div style="margin-top:0.5rem;font-size:1.05rem;text-align:center;"><strong>Overhead labor: ' + fmtMoney(overheadLaborCost) + '</strong> (' + fmtH(overheadHrs) + ' overhead hrs \u00d7 $' + (wage || 0).toFixed(2) + '/hr)</div>';
          html += '</div>';
          html += '<table>';
          html += '<thead><tr><th>Bucket</th><th class="num">Hours</th><th class="num">Cost</th><th class="num" style="text-align:left;">Share</th></tr></thead>';
          html += '<tbody>';
          var officeCost = -(officeHrs * wage);
          var bidCost = -(bidHrs * wage);
          var hasCost = overheadLaborCost < 0;
          html += '<tr><td>Office (configured office job)</td><td class="num">' + fmtH(officeHrs) + '</td><td class="num">' + fmtMoney(officeCost) + '</td><td class="num" style="text-align:left;">' + (hasCost ? fmtPct1((officeCost / overheadLaborCost) * 100) : '<span style="color:#9ca3af;">&mdash;</span>') + '</td></tr>';
          html += '<tr><td>Bid (any bid_id)</td><td class="num">' + fmtH(bidHrs) + '</td><td class="num">' + fmtMoney(bidCost) + '</td><td class="num" style="text-align:left;">' + (hasCost ? fmtPct1((bidCost / overheadLaborCost) * 100) : '<span style="color:#9ca3af;">&mdash;</span>') + '</td></tr>';
          html += '</tbody>';
          html += '<tfoot><tr><td style="text-align:right;font-weight:600;">Total overhead labor</td><td class="num" style="font-weight:600;">' + fmtH(overheadHrs) + '</td><td class="num" style="font-weight:600;">' + fmtMoney(overheadLaborCost) + '</td><td></td></tr></tfoot>';
          html += '</table>';
          html += '<h3>For context: this person\\'s field labor</h3>';
          html += '<table>';
          html += '<thead><tr><th>Bucket</th><th class="num">Hours</th><th class="num">Cost</th><th>Where it shows up</th></tr></thead>';
          html += '<tbody>';
          html += '<tr><td>Field (everything not Office or Bid)</td><td class="num">' + fmtH(fieldHrs) + '</td><td class="num" style="color:#9ca3af;">' + fmtMoney(-(fieldHrs * wage)) + '</td><td style="color:#6b7280;">Already in <strong>Net Revenue</strong>.</td></tr>';
          html += '</tbody>';
          html += '</table>';
          if (wage <= 0) {
            html += '<p class="caption" style="color:#b45309;">No <code>hourly_wage</code> is set for this person in <code>people_pay_config</code>, so the cost columns above show as $0. Set their wage on the People \u2192 Hours \u2192 Pay config row to make this column meaningful.</p>';
          }
          html += '<p class="caption">Overhead labor is what the company paid this person for hours that are <strong>not</strong> billed to a field job \u2014 the configured Office job and any time clocked into a bid. Field labor is excluded here on purpose: it is already subtracted at the per-job level inside Net Revenue (<code>job net = revenue \u2212 parts \u2212 total labor</code>), so showing it again would visually double-count.</p>';
          html += '<p class="caption">Split overhead model: this person\\'s own office + bid wages (this column) are deducted directly in &ldquo;Profit (after overhead)&rdquo;, and the non-labor pool (office parts) is spread across field hours as the Overhead Burden column. Office and bid wages are charged to whoever logged them &mdash; they are not spread across the team.</p>';
          return html;
        }
        function buildFieldHoursBody(entry) {
          var hb = entry.hb || { totals: { totalHours: 0 }, source: 'unknown' };
          var pb = entry.pb || { jobs: [], unaccountedHours: 0 };
          var totalWork = (hb.totals && hb.totals.totalHours) || 0;
          var officeHrs = entry.officeHours || 0;
          var bidHrs = entry.bidHours || 0;
          var overheadHrs = officeHrs + bidHrs;
          var fieldHrs = entry.fieldHours || 0;
          var allocatedFieldHrs = 0;
          var jobs = (pb.jobs || []).slice();
          for (var i = 0; i < jobs.length; i++) allocatedFieldHrs += (jobs[i].hoursInPeriod || 0);
          var unaccountedFieldHrs = pb.unaccountedHours || 0;
          var srcLabel = hb.source === 'salary'
            ? 'Salaried (8 hrs/weekday)'
            : hb.source === 'hourly'
              ? 'Hourly (from people_hours / clock sessions)'
              : 'Unknown (no pay config row)';
          var modeLabel = (hb.onlyPaidJobs)
            ? 'Only paid jobs (sub labor + crew assignments on jobs marked paid in full)'
            : 'All days in period (clocked / salary, minus office + bid)';
          var ohRateNote = (typeof overheadRate === 'number' && overheadRate != null)
            ? '$' + overheadRate.toFixed(2) + ' per hour &times; ' + fmtH(fieldHrs + officeHrs + bidHrs) + ' all hours = ' + fmtMoney((fieldHrs + officeHrs + bidHrs) * overheadRate) + ' overhead charged in &ldquo;Profit (after overhead)&rdquo; (field component: ' + fmtH(fieldHrs) + ' &times; $' + overheadRate.toFixed(2) + ' = ' + fmtMoney(fieldHrs * overheadRate) + ')'
            : 'Overhead rate unavailable &mdash; reload Review.';
          var html = '';
          html += '<div style="margin-bottom:0.75rem;color:#374151;">';
          html += '<div><strong>Source:</strong> ' + escH(srcLabel) + '</div>';
          html += '<div><strong>Counting mode:</strong> ' + escH(modeLabel) + '</div>';
          html += '</div>';
          html += '<table>';
          html += '<thead><tr><th>How field hrs is computed</th><th class="num">Hours</th></tr></thead><tbody>';
          if (hb.onlyPaidJobs) {
            html += '<tr><td>Sub labor + crew hours on paid-in-full jobs</td><td class="num">' + fmtH(totalWork) + '</td></tr>';
            html += '<tr><td><em>Office + bid hours are not in this mode by construction</em></td><td class="num"><span style="color:#9ca3af;">&mdash;</span></td></tr>';
          } else {
            html += '<tr><td>Total work hrs (' + escH(hb.source === 'salary' ? 'salary days' : 'people_hours / clock sessions') + ')</td><td class="num">' + fmtH(totalWork) + '</td></tr>';
            html += '<tr><td>&minus; Office hrs (clock on configured office job)</td><td class="num">' + fmtH(officeHrs) + '</td></tr>';
            html += '<tr><td>&minus; Bid hrs (clock on any bid)</td><td class="num">' + fmtH(bidHrs) + '</td></tr>';
          }
          html += '</tbody>';
          html += '<tfoot><tr><td style="text-align:right;font-weight:600;">= Field hrs</td><td class="num" style="font-weight:600;">' + fmtH(fieldHrs) + '</td></tr></tfoot>';
          html += '</table>';
          html += '<h3 style="text-align:center;">Where the field hrs went</h3>';
          if (jobs.length === 0 && unaccountedFieldHrs < 0.01) {
            html += '<p class="caption">No field hours were recorded against any job in this period.</p>';
          } else {
            html += '<table>';
            html += '<thead><tr><th class="num">Job #</th><th>Job</th><th class="num">Your field hrs<br>(period)</th><th class="num" style="text-align:left;">Share of<br>field hrs</th></tr></thead><tbody>';
            var jobsForDisplay = jobs.slice().sort(function(a, b){ return (b.hoursInPeriod || 0) - (a.hoursInPeriod || 0); });
            for (var k = 0; k < jobsForDisplay.length; k++) {
              var j = jobsForDisplay[k];
              if ((j.hoursInPeriod || 0) <= 0.005) continue;
              var share = fieldHrs > 0 ? (j.hoursInPeriod / fieldHrs) * 100 : 0;
              html += '<tr>';
              html += '<td class="num">' + escH(j.hcp) + '</td>';
              html += '<td>' + escH(j.jobName || '\u2014') + '</td>';
              html += '<td class="num">' + fmtH(j.hoursInPeriod) + '</td>';
              html += '<td class="num" style="text-align:left;">' + (fieldHrs > 0 ? fmtPct1(share) : '<span style="color:#9ca3af;">&mdash;</span>') + '</td>';
              html += '</tr>';
            }
            if (unaccountedFieldHrs > 0.005) {
              var unShare = fieldHrs > 0 ? (unaccountedFieldHrs / fieldHrs) * 100 : 0;
              html += '<tr style="background:#fff7ed;">';
              html += '<td class="num">&mdash;</td>';
              html += '<td><em>Unallocated field hrs</em><div style="color:#6b7280;font-size:0.8rem;">Field-type hours not tied to a specific job allocation (e.g. salary day with no crew assignment).</div></td>';
              html += '<td class="num">' + fmtH(unaccountedFieldHrs) + '</td>';
              html += '<td class="num" style="text-align:left;">' + (fieldHrs > 0 ? fmtPct1(unShare) : '<span style="color:#9ca3af;">&mdash;</span>') + '</td>';
              html += '</tr>';
            }
            html += '</tbody>';
            html += '<tfoot><tr><td colspan="2" style="text-align:right;font-weight:600;">Total field hrs</td><td class="num" style="font-weight:600;">' + fmtH(allocatedFieldHrs + unaccountedFieldHrs) + '</td><td></td></tr></tfoot>';
            html += '</table>';
          }
          html += '<p class="caption">Each crew assignment\\'s hours = day total \u00d7 pct. The day total is <code>peopleHours</code> (or 8 hrs on a salary weekday). Office time has its own crew row and is filtered from this field-revenue rollup; its share of the day appears as overhead. ' + ohRateNote + '</p>';
          return html;
        }
        function buildOverheadRateBody() {
          var d = overheadDecomp || {};
          var officeLabor = d.officeLabor90d || 0;
          var bidLabor = d.bidLabor90d || 0;
          var officeParts = d.officeParts90d || 0;
          var fieldHours = d.fieldHours90d || 0;
          var fieldLaborUsd = d.fieldLaborUsd90d || 0;
          var invoices = d.invoices90d || 0;
          var totalOverhead = officeLabor + bidLabor + officeParts;
          var ratePerHour = d.ratePerHour;
          var ratePerLaborDollar = d.ratePerLaborDollar;
          var ratePerRevenueDecimal = d.ratePerRevenueDecimal;
          var html = '';
          html += '<div style="margin-bottom:0.75rem;color:#374151;">';
          html += '<div style="margin-bottom:0.5rem;">Rolling 90-day overhead rate. Method A is <strong>$ per field hour</strong>: it spreads the whole overhead pool (office labor, bid labor, office parts) over billable field hours &mdash; a reference rate. The Team Summary&rsquo;s &ldquo;Profit (after overhead)&rdquo; column uses the <strong>split model</strong> instead: each person&rsquo;s own office/bid wages are charged directly, and only the office-parts pool is spread across field hours (the Overhead Burden column).</div>';
          if (d.windowStart && d.windowEnd) {
            html += '<div style="margin-bottom:0.25rem;"><strong>Window:</strong> ' + escH(d.windowStart) + ' &rarr; ' + escH(d.windowEnd) + '</div>';
          }
          html += '<div style="font-size:1.05rem;"><strong>Rate:</strong> ' + (ratePerHour == null ? '<span style="color:#9ca3af;">unavailable</span>' : '$' + Number(ratePerHour).toFixed(2) + ' per field hour') + '</div>';
          html += '</div>';
          html += '<h3>Numerator &mdash; overhead $ pool (90d)</h3>';
          html += '<table>';
          html += '<thead><tr><th>Component</th><th class="num">$ (90d)</th><th class="num">Share</th></tr></thead><tbody>';
          var components = [
            { label: 'Office labor (approved clock to office job)', value: officeLabor },
            { label: 'Bid labor (approved clock to any bid)', value: bidLabor },
            { label: 'Office parts (Tally on office job)', value: officeParts }
          ];
          for (var i = 0; i < components.length; i++) {
            var c = components[i];
            var share = totalOverhead > 0 ? (c.value / totalOverhead) * 100 : 0;
            html += '<tr><td>' + escH(c.label) + '</td><td class="num">' + fmtMoney(c.value) + '</td><td class="num">' + (totalOverhead > 0 ? fmtPct1(share) : '<span style="color:#9ca3af;">&mdash;</span>') + '</td></tr>';
          }
          html += '</tbody>';
          html += '<tfoot><tr><td style="text-align:right;font-weight:600;">Total overhead</td><td class="num" style="font-weight:600;">' + fmtMoney(totalOverhead) + '</td><td></td></tr></tfoot>';
          html += '</table>';
          html += '<h3>Denominator &mdash; field labor (90d)</h3>';
          html += '<table>';
          html += '<thead><tr><th>Measure</th><th class="num">Value</th></tr></thead><tbody>';
          html += '<tr><td>Field hours (approved clock on non-office, non-bid jobs)</td><td class="num">' + fmtH(fieldHours) + ' hrs</td></tr>';
          html += '<tr><td>Field labor $ (same sessions &times; wage)</td><td class="num">' + fmtMoney(fieldLaborUsd) + '</td></tr>';
          html += '</tbody></table>';
          html += '<h3>Resulting rates</h3>';
          html += '<table>';
          html += '<thead><tr><th>Rate</th><th class="num">Value</th><th>How it is used</th></tr></thead><tbody>';
          html += '<tr><td>Method A &mdash; per field hour</td><td class="num">' + (ratePerHour == null ? '<span style="color:#9ca3af;">&mdash;</span>' : '$' + Number(ratePerHour).toFixed(2) + '/hr') + '</td><td>Reference rate: whole pool &divide; field hours. The Profit (after overhead) column uses the split model &mdash; own office/bid wages charged directly + field-hour share of office parts &mdash; not this rate.</td></tr>';
          html += '<tr><td>Method B &mdash; per revenue $ (invoices sent)</td><td class="num">' + (ratePerRevenueDecimal == null ? '<span style="color:#9ca3af;">&mdash;</span>' : (Number(ratePerRevenueDecimal) * 100).toFixed(1) + '% of revenue') + '</td><td>Reference only: invoices sent in window = ' + fmtMoney(invoices) + '. Matches the &ldquo;B. Overhead by revenue&rdquo; rows in Jobs Worked.</td></tr>';
          html += '<tr><td>Method C &mdash; per field labor $</td><td class="num">' + (ratePerLaborDollar == null ? '<span style="color:#9ca3af;">&mdash;</span>' : '$' + Number(ratePerLaborDollar).toFixed(2) + ' / $1 labor') + '</td><td>Reference only: ratio of overhead pool to field labor dollars. Matches the &ldquo;C. Overhead by direct labor cost&rdquo; rows in Jobs Worked.</td></tr>';
          html += '</tbody></table>';
          html += '<p class="caption">Method A is the headline rate. Sessions used: approved, not revoked, not rejected, with a clock-out. Wages come from <code>people_pay_config.hourly_wage</code>. Office job is the one configured in People &rarr; Overhead settings. All three rates are computed by the shared kernel <code>src/lib/overheadRateMethods.ts</code> &mdash; the same code behind the Overhead tab&rsquo;s &ldquo;three lenses&rdquo; strip, so the two surfaces always agree.</p>';
          return html;
        }
        // Track which cell opened the modal so we can return focus to it on close
        // (keyboard a11y: never trap focus, never lose the trigger after closing).
        var lastFocusedTrigger = null;
        // Embedded-parent only: used by team-summary-modal-open/close so the
        // popup window doesn't accidentally toggle the embedded iframe's
        // refresh guard via its own opener. Day-editor dispatch goes through
        // postBridge() below, which DOES post to opener in popup mode.
        function postParent(type){
          if (window.parent === window) return;
          try { parent.postMessage({ type: type }, '*'); } catch(e) {}
        }
        // Popup-only build: no live bridge back to the React app exists
        // any more (the inline path renders via <TeamSummaryInline> and
        // talks to the parent directly without postMessage). Returning
        // null here makes nameToggleableForRender()/hasBridge below
        // resolve to false, so the popup renders name cells + Hours-day
        // headers as static text — appropriate for a "Open in new window"
        // surface whose job is print/share, not further interaction.
        function bridgeTarget(){
          return null;
        }
        function postBridge(type, payload){
          var bt = bridgeTarget();
          if (!bt) return null;
          var msg = { type: type };
          if (payload) {
            for (var k in payload) {
              if (Object.prototype.hasOwnProperty.call(payload, k)) msg[k] = payload[k];
            }
          }
          try { bt.win.postMessage(msg, '*'); } catch(e) {}
          return bt;
        }
        // Day-header click bridge (Hours breakdown -> DashboardMyTimeDayEditorModal).
        // Delegated from document so it survives openModal() innerHTML resets;
        // no per-render re-attachment needed.
        function isDayLinkEl(el){
          return !!(el && el.nodeType === 1 && el.getAttribute && el.getAttribute('data-action') === 'open-day-editor');
        }
        // Name-cell toggle bridge (Team Summary row -> per-person detail panel
        // in the parent React app). Optimistically mutates selectedPersonName
        // and re-renders the table so the highlight feels instant; the parent
        // listener updates selectedReviewPersonIndex on its end.
        function isPersonToggleEl(el){
          return !!(el && el.nodeType === 1 && el.getAttribute && el.getAttribute('data-action') === 'toggle-person');
        }
        function dispatchDayEditorFromEl(el){
          var person = el.getAttribute('data-person') || '';
          var dateStr = el.getAttribute('data-date') || '';
          if (!person || !dateStr) return;
          var bt = postBridge('team-summary-open-day-editor', { personName: person, workDate: dateStr });
          if (!bt) return;
          // Popup: bring the original tab forward so the user sees the modal
          // mount on the People page they opened the summary from.
          if (bt.kind === 'opener') {
            try { bt.win.focus(); } catch(e) {}
          }
        }
        function dispatchPersonToggleFromEl(el){
          var person = el.getAttribute('data-person') || '';
          if (!person) return;
          // Toggle off when clicking the already-expanded row; matches the
          // parent's reducer so we and the parent never diverge.
          selectedPersonName = (selectedPersonName === person) ? null : person;
          renderTable();
          postBridge('team-summary-select-person', { personName: person });
        }
        document.addEventListener('click', function(e){
          var t = e.target;
          // Walk up a few levels in case the click landed on an inner <span>.
          for (var i = 0; i < 4 && t; i++) {
            if (isDayLinkEl(t)) { e.preventDefault(); dispatchDayEditorFromEl(t); return; }
            if (isPersonToggleEl(t)) { e.preventDefault(); dispatchPersonToggleFromEl(t); return; }
            t = t.parentNode;
          }
        });
        document.addEventListener('keydown', function(e){
          if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
          var t = document.activeElement;
          if (isDayLinkEl(t)) { e.preventDefault(); dispatchDayEditorFromEl(t); return; }
          if (isPersonToggleEl(t)) { e.preventDefault(); dispatchPersonToggleFromEl(t); return; }
        });
        // Parent -> iframe: re-open the Hours drilldown for a specific person
        // after the editor saves and the Team Summary re-renders with fresh
        // numbers. The parent stashes personName in a ref and posts this
        // message from the iframe's onLoad once the new srcDoc has painted.
        window.addEventListener('message', function(e){
          var d = e.data;
          if (!d || typeof d !== 'object') return;
          if (d.type !== 'team-summary-open-hours-drilldown') return;
          var pn = typeof d.personName === 'string' ? d.personName : '';
          if (!pn) return;
          var idx = -1;
          for (var i = 0; i < breakdowns.length; i++) {
            if (breakdowns[i].name === pn) { idx = i; break; }
          }
          if (idx >= 0) openModal(idx, 'hours');
        });
        // True when this window can reach the parent app to mount the editor
        // (embedded iframe -> parent, popup -> opener). Day headers in the
        // Hours breakdown render as <button> when true, plain <div> otherwise
        // (so a popup whose opener was already closed stays inert).
        var hasBridge = !!bridgeTarget();
        function openModal(idx, type) {
          var entry = breakdowns[idx];
          if (!entry && type !== 'overhead_rate') return;
          var title = '';
          var body = '';
          if (type === 'hours') {
            // v2.547 -- running total moved into the title (e.g. "Hours
            // breakdown -- Abraham . 50.8 hrs"); the redundant Total: N hrs
            // line is dropped from buildHoursBody so the value appears once.
            title = 'Hours breakdown \\u2014 ' + entry.name + ' \\u00b7 ' + fmtH(entry.hb.totals.totalHours) + ' hrs';
            body = buildHoursBody(entry.hb, { personName: entry.name, clickableDay: hasBridge });
          } else if (type === 'overhead_hours') {
            // v2.547 -- running total moved into the title (matches Hours
            // breakdown), and the per-bucket totals move into the Office /
            // Bids section headers (see buildOverheadHoursBody).
            var ohTotalHrs = (entry.officeHours || 0) + (entry.bidHours || 0);
            title = 'Overhead hours breakdown \\u2014 ' + entry.name + ' \\u00b7 ' + fmtH(ohTotalHrs) + ' hrs';
            body = buildOverheadHoursBody(entry);
          } else if (type === 'field_hours') {
            // v2.547 -- field-hrs running total moved into the title to match
            // the Hours / Overhead-hours modals.
            title = 'Field hours breakdown \\u2014 ' + entry.name + ' \\u00b7 ' + fmtH(entry.fieldHours || 0) + ' hrs';
            body = buildFieldHoursBody(entry);
          } else if (type === 'overhead_labor') {
            // Append the hourly_wage to the title so reviewers see the
            // rate driving the cost column without opening the modal.
            // Matches TeamSummaryInline.drilldownTitleFor.
            var olWage = entry.overheadWage || entry.hourlyWage || 0;
            var olWageSuffix = olWage > 0
              ? ' \\u00b7 $' + olWage.toFixed(2) + '/hr'
              : ' \\u00b7 no wage configured';
            title = 'Overhead labor breakdown \\u2014 ' + entry.name + olWageSuffix;
            body = buildOverheadLaborBody(entry);
          } else if (type === 'gross') {
            // v2.547 -- running total moved into the title to match Hours /
            // Overhead-hours / Field-hours modals; redundant Total line removed
            // from buildGrossBody.
            title = 'Gross Revenue breakdown \\u2014 ' + entry.name + ' \\u00b7 ' + fmtMoney((entry.gb && entry.gb.total) || 0);
            body = buildGrossBody(entry.gb);
          } else if (type === 'net') {
            title = 'Net Revenue breakdown \\u2014 ' + entry.name + ' \\u00b7 ' + fmtMoney((entry.nb && entry.nb.total) || 0);
            body = buildNetBody(entry.nb);
          } else if (type === 'profit') {
            title = 'Profit (after overhead) breakdown \\u2014 ' + entry.name;
            body = buildProfitBody(entry);
          } else if (type === 'rev_per_hr') {
            title = 'Gross Revenue/hr breakdown \\u2014 ' + entry.name;
            body = buildGrossPerHourBody(entry);
          } else if (type === 'net_per_hr') {
            title = 'Net Revenue/hr breakdown \\u2014 ' + entry.name;
            body = buildNetPerHourBody(entry);
          } else if (type === 'profit_per_hr') {
            title = 'Profit/hr (after overhead) breakdown \\u2014 ' + entry.name;
            body = buildProfitPerHourBody(entry);
          } else if (type === 'overhead_rate') {
            title = 'Overhead rate decomposition (rolling 90 days)';
            body = buildOverheadRateBody();
          } else {
            return;
          }
          document.getElementById('modal-title').textContent = title;
          document.getElementById('modal-body').innerHTML = body;
          document.getElementById('modal-backdrop').classList.add('open');
          document.getElementById('modal').classList.add('open');
          lastFocusedTrigger = (document.activeElement && typeof document.activeElement.focus === 'function') ? document.activeElement : null;
          var closeBtn = document.getElementById('modal-close');
          if (closeBtn) try { closeBtn.focus(); } catch(e) {}
          postParent('team-summary-modal-open');
        }
        function closeModal() {
          var wasOpen = document.getElementById('modal').classList.contains('open');
          document.getElementById('modal-backdrop').classList.remove('open');
          document.getElementById('modal').classList.remove('open');
          // Defensive cleanup: if user closes the modal while it was in
          // print mode (e.g. they cancelled the print dialog and the
          // browser didn't fire afterprint), strip the body class so the
          // screen view doesn't look broken.
          document.body.classList.remove('printing-modal');
          if (wasOpen) {
            if (lastFocusedTrigger) {
              try { lastFocusedTrigger.focus(); } catch(e) {}
            }
            lastFocusedTrigger = null;
            postParent('team-summary-modal-close');
          }
        }
        // ---- Header sort / search wiring ----
        var ths = document.querySelectorAll('th[data-sort]');
        for (var t = 0; t < ths.length; t++) {
          (function(th){
            function toggleSort(){
              var key = th.getAttribute('data-sort');
              if (!key) return;
              if (key === sortKey) {
                sortDir = (sortDir === 'asc') ? 'desc' : 'asc';
              } else {
                sortKey = key;
                // Sensible default direction by column type: text asc, numbers desc.
                sortDir = (key === 'name') ? 'asc' : 'desc';
              }
              renderTable();
            }
            th.addEventListener('click', toggleSort);
            th.addEventListener('keydown', function(e){
              if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
                e.preventDefault();
                toggleSort();
              }
            });
          })(ths[t]);
        }
        var searchInput = document.getElementById('search-input');
        if (searchInput) {
          searchInput.addEventListener('input', function(e){
            searchQuery = e.target.value || '';
            renderTable();
          });
        }
        var resetSortBtn = document.getElementById('reset-sort');
        if (resetSortBtn) {
          resetSortBtn.addEventListener('click', function(){
            sortKey = 'profitAfterOverhead';
            sortDir = 'desc';
            renderTable();
          });
        }
        var overheadMetaBtn = document.getElementById('overhead-meta-btn');
        if (overheadMetaBtn) {
          overheadMetaBtn.addEventListener('click', function(){ openModal(-1, 'overhead_rate'); });
        }
        document.getElementById('modal-backdrop').addEventListener('click', closeModal);
        document.getElementById('modal-close').addEventListener('click', closeModal);
        // Modal-only print: add a body class so @media print rules in <style>
        // hide everything except .modal, then call window.print(). The
        // afterprint event removes the class so the screen view comes back
        // identical to before (works in Chrome / Firefox / Safari; older
        // browsers without afterprint just keep the class until the next
        // closeModal, which clears it via the cleanup below).
        var modalPrintBtn = document.getElementById('modal-print');
        function clearPrintingModalClass(){
          document.body.classList.remove('printing-modal');
        }
        if (modalPrintBtn) {
          modalPrintBtn.addEventListener('click', function(){
            document.body.classList.add('printing-modal');
            function onAfterPrint(){
              clearPrintingModalClass();
              window.removeEventListener('afterprint', onAfterPrint);
            }
            window.addEventListener('afterprint', onAfterPrint);
            try { window.print(); } catch (e) { clearPrintingModalClass(); }
          });
        }
        document.addEventListener('keydown', function(e){ if (e.key === 'Escape') { clearPrintingModalClass(); closeModal(); } });
        // Initial paint.
        renderTable();
      })();</script>
      ${embeddedResizeScript}
    </body></html>`
  return html
}
