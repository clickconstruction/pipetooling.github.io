/**
 * Printable call sheets for the Followup By-builder lens (v2.1387).
 * Pure HTML-string builders; the component hands the result to
 * printHtmlInNewWindow. Print surfaces stay light-themed by convention.
 */

export type CallSheetPerson = { name: string; phones: string[]; email: string | null; note: string | null }

export type CallSheetBidLine = {
  label: string
  sectionLabel: string
  dueLabel: string | null
  lastUpdateLabel: string | null
}

export type CallSheetBuilder = {
  name: string
  address: string | null
  phone: string | null
  lastContactLabel: string | null
  hitRatePct: number | null
  openValueLabel: string | null
  people: CallSheetPerson[]
  bids: CallSheetBidLine[]
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function builderSectionHtml(b: CallSheetBuilder): string {
  const meta: string[] = []
  if (b.lastContactLabel) meta.push(`last contact ${esc(b.lastContactLabel)}`)
  if (b.hitRatePct !== null) meta.push(`${b.hitRatePct}% hit rate`)
  if (b.openValueLabel) meta.push(`${esc(b.openValueLabel)} open`)
  const people =
    b.people.length > 0
      ? b.people
          .map(
            (p) =>
              `<div class="person"><strong>${esc(p.name)}</strong>${p.note ? ` <span class="dim">(${esc(p.note)})</span>` : ''}${
                p.phones.length > 0 ? ` — ${p.phones.map((ph) => `<a href="tel:${esc(ph)}">${esc(ph)}</a>`).join(' · ')}` : ''
              }${p.email ? ` · <a href="mailto:${esc(p.email)}">${esc(p.email)}</a>` : ''}</div>`,
          )
          .join('')
      : '<div class="dim">No contact people on file.</div>'
  const bids =
    b.bids.length > 0
      ? `<table><tr><th>Bid</th><th>Status</th><th>Due</th><th>Last update</th></tr>${b.bids
          .map(
            (line) =>
              `<tr><td>${esc(line.label)}</td><td>${esc(line.sectionLabel)}</td><td>${esc(line.dueLabel ?? '—')}</td><td>${esc(
                line.lastUpdateLabel ?? 'no update',
              )}</td></tr>`,
          )
          .join('')}</table>`
      : '<div class="dim">No open bids.</div>'
  return `<section>
    <h2>${esc(b.name)}${b.phone ? ` <a class="phone" href="tel:${esc(b.phone)}">${esc(b.phone)}</a>` : ''}</h2>
    ${b.address ? `<div class="dim">${esc(b.address)}</div>` : ''}
    ${meta.length > 0 ? `<div class="meta">${meta.join(' · ')}</div>` : ''}
    <h3>People</h3>${people}
    <h3>Open bids</h3>${bids}
    <h3>Notes from the call</h3><div class="lines"></div>
  </section>`
}

const SHEET_STYLE = `<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#111827;margin:24px;font-size:13px}
  h1{font-size:18px;margin:0 0 2px} .gen{color:#6b7280;font-size:11px;margin-bottom:14px}
  section{page-break-inside:avoid;border-top:2px solid #111827;padding-top:10px;margin-bottom:22px}
  h2{font-size:15px;margin:0 0 2px} h3{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#374151;margin:10px 0 4px}
  .dim{color:#6b7280} .meta{color:#374151;font-size:12px;margin-top:2px}
  .person{margin:2px 0} a{color:#1d4ed8;text-decoration:none} .phone{font-size:13px;margin-left:8px}
  table{border-collapse:collapse;width:100%;font-size:12px}
  th{text-align:left;border-bottom:1px solid #111827;padding:2px 8px 2px 0;font-size:11px}
  td{border-bottom:1px solid #e5e7eb;padding:3px 8px 3px 0}
  .lines{height:56px;background:repeating-linear-gradient(#fff,#fff 17px,#e5e7eb 18px)}
</style>`

/** One builder → a one-page call sheet. */
export function buildBuilderCallSheetHtml(builder: CallSheetBuilder, generatedLabel: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Call sheet — ${esc(builder.name)}</title>${SHEET_STYLE}</head><body>
    <h1>Builder call sheet</h1><div class="gen">${esc(generatedLabel)}</div>
    ${builderSectionHtml(builder)}
  </body></html>`
}

/** The whole queue → one document, a section per builder, queue order preserved. */
export function buildFollowupQueueCallSheetHtml(builders: CallSheetBuilder[], generatedLabel: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Followup call sheet</title>${SHEET_STYLE}</head><body>
    <h1>Followup call sheet — ${builders.length} builder${builders.length === 1 ? '' : 's'}</h1><div class="gen">${esc(generatedLabel)}</div>
    ${builders.map(builderSectionHtml).join('')}
  </body></html>`
}
