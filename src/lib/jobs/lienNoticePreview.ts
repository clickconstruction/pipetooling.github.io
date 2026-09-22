/**
 * The § 53.056 notice, previewed in its own window with the editable values marked (v2.3522).
 *
 * The form is the statute's, word for word; the app varies only nine values on it. Not all nine
 * are the same kind of value:
 *
 *  - four are WORDING the office may shape on the desk (typed): the type of labor (the default
 *    says plumbing; job 813 is electrical), the project description, the party contracted with
 *    if different from the GC, and the contact person who signs;
 *  - five are FACTS with a home elsewhere (derived): the date, the original contractor, the
 *    claim amount, and the claimant's name and address. The desk's rule for the demand letter
 *    applies: fix it at the source and the document re-reads it, so the two never disagree.
 *
 * The preview page is the same print HTML the packet uses plus a marking layer only this page
 * carries — a legend, the two tints, a list of what can change and where. The printed packet
 * and the PDF never carry a mark.
 *
 * The four typed values are editable here too (v2.3660). The desk stays the one source of truth:
 * a keystroke posts `{ field, value }` to the opener, the desk layers it onto its wording edits,
 * rebuilds the pages with its own builders and posts them back, and this page swaps them in — so
 * the preview never renders a notice of its own making. While the draft is locked, or once the
 * desk is gone, the boxes are read-only and a click on a typed value falls back to focusing the
 * desk's field.
 */
import type { LienNoticeFields } from '../jobsDocuments/lienFilingDocuments'
import { filingDocHtml, type FilingDocBlock } from '../jobsDocuments/lienFilingDocuments'

export type LienNoticeFieldKey = Exclude<keyof LienNoticeFields, 'homesteadStatement'>  // the § 53.254(g) flag (v2.3744) is not a printed value the office types

export type LienNoticeFieldGuide = {
  key: LienNoticeFieldKey
  /** How the desk names it. */
  label: string
  /** typed = changed on the desk's Wording line; derived = filled from the job, with its door. */
  kind: 'typed' | 'derived'
  /** Where a derived value comes from, in the office's words. */
  source: string
  /** The screen that owns a derived value, when one exists. */
  door: 'edit_job' | 'bill' | 'company' | null
}

/** The four values the office may change, in the order the Wording line shows them. */
export const LIEN_NOTICE_TYPED_FIELDS: ReadonlyArray<LienNoticeFieldKey> = ['laborMaterialsType', 'contactPerson', 'projectDescription', 'contractedWithIfDifferent']

export const LIEN_NOTICE_FIELD_GUIDE: ReadonlyArray<LienNoticeFieldGuide> = [
  { key: 'laborMaterialsType', label: 'Type of labor or materials', kind: 'typed', source: '"Plumbing labor and materials" unless you say otherwise', door: null },
  { key: 'projectDescription', label: 'Project description', kind: 'typed', source: 'the job name and address', door: null },
  { key: 'contractedWithIfDifferent', label: 'Party contracted with, if different from the GC', kind: 'typed', source: 'blank — we contracted with the GC directly', door: null },
  { key: 'contactPerson', label: 'Contact person (signs)', kind: 'typed', source: "the job's master, full name and title", door: null },
  { key: 'noticeDate', label: 'Date', kind: 'derived', source: 'the day it is drafted or sent', door: null },
  { key: 'originalContractorName', label: 'Original contractor', kind: 'derived', source: 'the GC on the job', door: 'edit_job' },
  { key: 'claimAmount', label: 'Claim amount', kind: 'derived', source: 'open on the job', door: 'bill' },
  { key: 'claimantName', label: "Claimant's name", kind: 'derived', source: 'Settings → Company', door: 'company' },
  { key: 'claimantAddress', label: "Claimant's address", kind: 'derived', source: 'Settings → Company', door: 'company' },
]

export function isTypedNoticeField(key: string): key is LienNoticeFieldKey {
  return (LIEN_NOTICE_TYPED_FIELDS as ReadonlyArray<string>).includes(key)
}

/** The typed fields whose current value differs from the job's default — the "edited" fact. */
export function noticeWordingDiff(current: LienNoticeFields, defaults: LienNoticeFields): LienNoticeFieldKey[] {
  return LIEN_NOTICE_TYPED_FIELDS.filter((k) => (current[k] ?? '').trim() !== (defaults[k] ?? '').trim())
}

/** Layer the desk's typed edits over the base values; a typed field left undefined keeps the base. */
export function applyWordingEdits(base: LienNoticeFields, edits: Partial<Pick<LienNoticeFields, LienNoticeFieldKey>>): LienNoticeFields {
  const out: LienNoticeFields = { ...base }
  for (const k of LIEN_NOTICE_TYPED_FIELDS) {
    const v = edits[k]
    if (typeof v === 'string') out[k] = v
  }
  return out
}

/** "Wording · standard" or "Wording · edited (2) by Taunya". */
export function wordingLineText(diff: ReadonlyArray<LienNoticeFieldKey>, editedBy: string | null): string {
  if (diff.length === 0) return 'Nothing changed from the job’s wording'
  const who = (editedBy ?? '').trim()
  return `${diff.length} ${diff.length === 1 ? 'value' : 'values'} changed${who ? ` by ${who}` : ''}`
}

/** What the preview posts to its opener when a typed value is clicked and it cannot edit in place. */
export const LIEN_NOTICE_PREVIEW_MESSAGE = 'lien-notice-preview-field'
/** Preview → desk: a typed value changed (`{ field, value }`). */
export const LIEN_NOTICE_PREVIEW_EDIT_MESSAGE = 'lien-notice-preview-edit'
/** Preview → desk: save the draft (`{}`); the desk answers with a `saved` flag on its next pages message. */
export const LIEN_NOTICE_PREVIEW_SAVE_MESSAGE = 'lien-notice-preview-save'
/** Desk → preview: the pages as the desk now builds them, and which typed values differ from the job's. */
export const LIEN_NOTICE_PREVIEW_PAGES_MESSAGE = 'lien-notice-preview-pages'

export type LienNoticePreviewPages = {
  type: typeof LIEN_NOTICE_PREVIEW_PAGES_MESSAGE
  docHtml: string
  coverHtml: string
  diff: LienNoticeFieldKey[]
  /** The typed values as the desk holds them — a box the office is not typing in follows the desk. */
  values: Partial<Record<LienNoticeFieldKey, string>>
  editedBy: string | null
  /** Set on the message that follows a save the preview asked for. */
  saved?: 'ok' | 'failed'
}

/** The desk's answer to the preview: the same two pages the desk pane shows. */
export function lienNoticePreviewPages(input: Pick<LienNoticePreviewInput, 'blocks' | 'coverBlocks' | 'fields' | 'defaults' | 'editedBy'>, saved?: 'ok' | 'failed'): LienNoticePreviewPages {
  return {
    type: LIEN_NOTICE_PREVIEW_PAGES_MESSAGE,
    docHtml: filingDocHtml(input.blocks),
    coverHtml: input.coverBlocks && input.coverBlocks.length > 0 ? filingDocHtml(input.coverBlocks) : '',
    diff: noticeWordingDiff(input.fields, input.defaults),
    values: Object.fromEntries(LIEN_NOTICE_TYPED_FIELDS.map((k) => [k, input.fields[k] ?? ''])),
    editedBy: input.editedBy,
    ...(saved ? { saved } : {}),
  }
}

export type LienNoticePreviewInput = {
  blocks: FilingDocBlock[]
  fields: LienNoticeFields
  defaults: LienNoticeFields
  /** "258 · Dudley Mason" */
  jobLabel: string
  /** Who changed the wording, when it differs from the defaults. */
  editedBy: string | null
  /** The cover page (the note, or the run's cover letter) when the draft carries one — page 1, ahead of the notice (v2.3540). */
  coverBlocks?: FilingDocBlock[]
  /** The office may change the wording right now (a drafted item, an office role) — the typed values become boxes (v2.3660). */
  editable?: boolean
  /** The claim set by hand (v2.3682): the amount reads yellow like a typed value, with this line beside it. */
  handSetClaim?: string
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * The preview page: the print HTML with a marking layer. Opened from the desk as a blob URL in
 * a new tab (same origin as the desk, so the click handler can post back to `window.opener`).
 */
export function buildLienNoticePreviewHtml(input: LienNoticePreviewInput): string {
  const diff = new Set(noticeWordingDiff(input.fields, input.defaults))
  const typed = LIEN_NOTICE_FIELD_GUIDE.filter((g) => g.kind === 'typed')
  const derived = LIEN_NOTICE_FIELD_GUIDE.filter((g) => g.kind === 'derived')
  const editable = input.editable === true
  const item = (g: LienNoticeFieldGuide) => {
    const v = (input.fields[g.key] ?? '').trim()
    const changed = diff.has(g.key)
    if (g.kind === 'typed' && editable) {
      return (
        `<li class="it typed"><span class="k"></span><label><b>${esc(g.label)}</b>` +
        `<input type="text" data-edit="${g.key}" value="${esc(input.fields[g.key] ?? '')}" placeholder="${esc(g.source)}" autocomplete="off" />` +
        `<small data-changed="${g.key}"${changed ? '' : ' hidden'}><em>changed from the default</em> · <button type="button" class="door" data-reset="${g.key}" data-default="${esc(input.defaults[g.key] ?? '')}">Back to the job's wording</button></small>` +
        `</label></li>`
      )
    }
    if (g.key === 'claimAmount' && input.handSetClaim) {
      return `<li class="it typed"><span class="k"></span><span><b>${esc(g.label)}</b><small>set by hand on the desk — ${esc(input.handSetClaim)}</small></span></li>`
    }
    const line = g.kind === 'typed' ? (v ? `“${v}”` : g.source) : g.source
    return (
      `<li class="it ${g.kind}"><span class="k"></span><span><b>${esc(g.label)}</b>` +
      `<small>${esc(line)}${changed ? ' · <em>changed from the default</em>' : ''}` +
      (g.kind === 'typed' ? ` · <button type="button" class="door" data-focus="${g.key}">${v ? 'Change ›' : 'Add ›'}</button>` : '') +
      `</small></span></li>`
    )
  }
  const editedText = (count: number, who: string | null) => `Wording edited (${count})${who ? ` by ${who}` : ''} — the leader sees this before approving.`
  const edited = editable
    ? `<div class="edited" data-edited${diff.size > 0 ? '' : ' hidden'}>${esc(editedText(diff.size, input.editedBy))}</div>`
    : diff.size > 0 ? `<div class="edited">Wording edited (${diff.size})${input.editedBy ? ` by ${esc(input.editedBy)}` : ''} — the leader sees this before approving.</div>` : ''
  const cover = input.coverBlocks && input.coverBlocks.length > 0 ? input.coverBlocks : null
  const pages = cover ? 2 : 1
  return `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Notice · ${esc(input.jobLabel)} · preview</title>
<style>
  body { margin: 0; background: #f3f4f6; color: #1a1a1a; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  .legend { position: sticky; top: 0; z-index: 2; display: flex; flex-wrap: wrap; gap: 0.6rem 1.25rem; align-items: center; padding: 0.55rem 1.25rem; background: #fffbeb; border-bottom: 1px solid #fcd34d; color: #92400e; font-size: 0.8125rem; }
  .legend .sw { display: inline-block; width: 1.6em; height: 0.85em; vertical-align: -0.1em; margin-right: 0.35em; border-radius: 2px; }
  .sw.typed, .doc [data-field].typed { background: #fef08a; outline: 1.5px dashed #ca8a04; outline-offset: -1px; border-radius: 2px; }
  .sw.derived, .doc [data-field].derived { background: #dbeafe; outline: 1.5px dotted #2563eb; outline-offset: -1px; border-radius: 2px; }
  .doc [data-field].typed { cursor: pointer; }
  .doc [data-field].typed:hover { background: #fde047; }
  .legend .print { margin-left: auto; font: inherit; padding: 0.25rem 0.7rem; border: 1px solid #bfdbfe; border-radius: 6px; background: #eff6ff; color: #1e40af; cursor: pointer; }
  .wrap { display: grid; grid-template-columns: minmax(0, 1fr) 19rem; gap: 1.25rem; max-width: 72rem; margin: 1.25rem auto; padding: 0 1rem; }
  .doc { background: #fff; border: 1px solid #d1d5db; box-shadow: 0 10px 30px -18px rgba(17,24,39,0.35); padding: 2.5rem 2.75rem; font-family: Georgia, 'Times New Roman', serif; font-size: 0.95rem; line-height: 1.75; }
  .side { font-size: 0.8125rem; color: #374151; }
  .side h3 { margin: 0.9rem 0 0.35rem; font-size: 0.68rem; letter-spacing: 0.08em; text-transform: uppercase; color: #6b7280; }
  .side h3:first-child { margin-top: 0; }
  .side ul { list-style: none; margin: 0; padding: 0; }
  .side .it { display: grid; grid-template-columns: 0.9rem 1fr; gap: 0.45rem; padding: 0.2rem 0; align-items: start; }
  .side .it .k { width: 0.8rem; height: 0.8rem; border-radius: 2px; margin-top: 0.25rem; }
  .side .it.typed .k { background: #fef08a; outline: 1.5px dashed #ca8a04; outline-offset: -1px; }
  .side .it.derived .k { background: #dbeafe; outline: 1.5px dotted #2563eb; outline-offset: -1px; }
  .side small { display: block; color: #6b7280; }
  .side .door { font: inherit; padding: 0; border: none; background: none; color: #2563eb; font-weight: 600; cursor: pointer; }
  .side label { display: grid; gap: 0.2rem; }
  .side input[type=text] { font: inherit; width: 100%; box-sizing: border-box; padding: 0.3rem 0.5rem; border: 1px solid #ca8a04; border-radius: 6px; background: #fefce8; color: #111827; }
  .side input[type=text]:focus { outline: 2px solid #2563eb; outline-offset: 1px; background: #fff; }
  .side input[type=text]:disabled { background: #f3f4f6; border-color: #d1d5db; color: #6b7280; }
  .side .save { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; margin-top: 0.9rem; }
  .side .save button { font: inherit; font-weight: 600; padding: 0.35rem 0.8rem; border: 1px solid transparent; border-radius: 6px; background: #2563eb; color: #fff; cursor: pointer; }
  .side .save button:disabled { opacity: 0.55; cursor: default; }
  .side .save span { color: #6b7280; }
  [hidden] { display: none !important; }
  .side .edited { margin-top: 0.9rem; padding: 0.5rem 0.7rem; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 6px; color: #92400e; }
  .side .note { margin-top: 0.9rem; color: #6b7280; }
  .pagelabel { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; font-size: 0.68rem; letter-spacing: 0.08em; text-transform: uppercase; color: #6b7280; margin: 0 0 0.4rem; }
  .doc + .pagelabel { margin-top: 1.25rem; }
  @media (max-width: 720px) { .wrap { grid-template-columns: 1fr; } .doc { padding: 1.5rem 1.25rem; } }
  @media print { .legend, .side, .pagelabel { display: none; } body { background: #fff; } .wrap { display: block; margin: 0; padding: 0; max-width: none; } .doc { border: none; box-shadow: none; padding: 0.5in; } .doc.cover { page-break-after: always; } .doc [data-field] { background: none !important; outline: none !important; } }
</style></head><body>
<div class="legend"><span><span class="sw typed"></span>${editable ? 'You can change this — here or on the desk' : 'You can change this on the desk'}</span><span><span class="sw derived"></span>Filled from the job · change it there</span><span>Everything else is the statute's form and prints as shown</span><button type="button" class="print" onclick="window.print()">Print this preview</button></div>
<div class="wrap">
  <div class="pages">${cover ? `<div class="pagelabel">Page 1 of ${pages} · cover note</div><div class="doc cover" data-page="cover">${filingDocHtml(cover)}</div>` : ''}<div class="pagelabel">Page ${pages} of ${pages} · the notice</div><div class="doc" data-page="notice">${filingDocHtml(input.blocks)}</div></div>
  <aside class="side">
    <h3>You can change · ${typed.length}</h3><ul>${typed.map(item).join('')}</ul>
    <h3>Filled from the job · ${derived.length}</h3><ul>${derived.map(item).join('')}</ul>
    ${edited}
    ${editable ? `<div class="save"><button type="button" data-save>Save draft</button><span data-save-note>What you type shows on the desk right away; Save draft keeps it.</span></div>` : ''}
    <div class="note">${cover ? 'The cover note is page 1, as the packet prints it; untick it on the desk and it leaves.' : 'No cover note — tick it on the desk and it appears here as page 1.'} The job's unpaid invoice follows the notice in the run's packet; <b>Print the packet</b> shows every page as mailed.</div>
  </aside>
</div>
<script>
(function () {
  var typed = ${JSON.stringify([...LIEN_NOTICE_TYPED_FIELDS, ...(input.handSetClaim ? ['claimAmount', 'claimSplit'] : [])])};
  var editable = ${editable ? 'true' : 'false'};
  var target = window.location.origin === 'null' ? '*' : window.location.origin;
  function mark() {
    var nodes = document.querySelectorAll('.doc [data-field]');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var f = n.getAttribute('data-field');
      var isTyped = typed.indexOf(f) >= 0;
      n.classList.add(isTyped ? 'typed' : 'derived');
      n.title = isTyped ? (editable ? 'Change this in the box on the right' : 'Change this on the desk') : 'Filled from the job';
    }
  }
  mark();
  function deskOpen() { return !!(window.opener && !window.opener.closed); }
  function post(msg) { if (deskOpen()) { window.opener.postMessage(msg, target); return true; } return false; }
  function tell(field) {
    if (post({ type: ${JSON.stringify(LIEN_NOTICE_PREVIEW_MESSAGE)}, field: field })) {
      try { window.opener.focus(); } catch (e) { /* the desk may refuse focus; the message still lands */ }
    }
  }
  function box(field) { return document.querySelector('input[data-edit="' + field + '"]'); }
  function note(text) { var el = document.querySelector('[data-save-note]'); if (el) el.textContent = text; }
  /** The desk is gone (closed, or moved to another job's tab): the boxes stop pretending they save anywhere. */
  function deskLost() {
    var inputs = document.querySelectorAll('input[data-edit]');
    for (var i = 0; i < inputs.length; i++) inputs[i].disabled = true;
    var save = document.querySelector('[data-save]'); if (save) save.disabled = true;
    note('The Lien desk is closed — open the preview from the desk again to change the wording.');
  }
  document.addEventListener('click', function (ev) {
    var t = ev.target;
    while (t && t !== document.body) {
      if (t.getAttribute) {
        var reset = t.getAttribute('data-reset');
        if (reset) { var b = box(reset); if (b) { b.value = t.getAttribute('data-default') || ''; send(reset, b.value); } return; }
        if (t.hasAttribute('data-save')) { if (post({ type: ${JSON.stringify(LIEN_NOTICE_PREVIEW_SAVE_MESSAGE)} })) note('Saving…'); else deskLost(); return; }
        var f = t.getAttribute('data-focus') || (t.classList && t.classList.contains('typed') && t.getAttribute('data-field'));
        if (f) {
          var input = editable ? box(f) : null;
          if (input && !input.disabled) { input.focus(); input.select(); } else tell(f);
          return;
        }
      }
      t = t.parentNode;
    }
  });
  function send(field, value) {
    if (!post({ type: ${JSON.stringify(LIEN_NOTICE_PREVIEW_EDIT_MESSAGE)}, field: field, value: value })) deskLost();
    else note('What you type shows on the desk right away; Save draft keeps it.');
  }
  document.addEventListener('input', function (ev) {
    var t = ev.target;
    var f = t && t.getAttribute && t.getAttribute('data-edit');
    if (f) send(f, t.value);
  });
  window.addEventListener('message', function (ev) {
    if (target !== '*' && ev.origin !== target) return;
    var d = ev.data;
    if (!d || d.type !== ${JSON.stringify(LIEN_NOTICE_PREVIEW_PAGES_MESSAGE)}) return;
    var notice = document.querySelector('[data-page="notice"]');
    if (notice && typeof d.docHtml === 'string') notice.innerHTML = d.docHtml;
    var coverEl = document.querySelector('[data-page="cover"]');
    if (coverEl && typeof d.coverHtml === 'string' && d.coverHtml) coverEl.innerHTML = d.coverHtml;
    mark();
    var diff = Array.isArray(d.diff) ? d.diff : [];
    for (var i = 0; i < typed.length; i++) {
      var c = document.querySelector('[data-changed="' + typed[i] + '"]');
      if (c) c.hidden = diff.indexOf(typed[i]) < 0;
      var b = box(typed[i]);
      if (b && d.values && typeof d.values[typed[i]] === 'string' && document.activeElement !== b) b.value = d.values[typed[i]];
    }
    var edited = document.querySelector('[data-edited]');
    if (edited) {
      edited.hidden = diff.length === 0;
      edited.textContent = 'Wording edited (' + diff.length + ')' + (d.editedBy ? ' by ' + d.editedBy : '') + ' — the leader sees this before approving.';
    }
    if (d.saved === 'ok') note('Draft saved.');
    if (d.saved === 'failed') note('Could not save — try Save draft on the desk.');
  });
})();
</script>
</body></html>`
}
