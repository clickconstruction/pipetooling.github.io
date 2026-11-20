/**
 * Before we start (punch list #382, PR 11): the days they gave, on paper. One sheet for a site: each stage where the
 * customer gave a day for ready, every day they gave oldest first with who said it, how and when, how far each one
 * moved, and the total. It is ours: it is printed by the office and is not on the GC's page (the owner's call 6).
 * Pure: the caller prints it (`printHtmlInNewWindow`).
 */
import { escapeHtml } from '../bidDocuments/escapeHtml'
import { monthDay, weekDay } from './startChecks'
import type { MovedSheet } from './timeLine'

export function movedSheetHtml(sheet: MovedSheet, head: { site: string; contact: string; printedOn: string; by: string }): string {
  const e = escapeHtml
  const stages = sheet.stages
    .map(
      (s) => `<section><h2>${e(s.name)}${s.job ? ` <span class="job">${e(s.job)}</span>` : ''}</h2>
<p class="ours">Our days: <b>${e(s.ours)}</b>${s.moved ? ` · <b class="moved">Moved ${s.moved} ${s.moved === 1 ? 'day' : 'days'}</b>` : ''}</p>
<table><thead><tr><th>Ready on</th><th>Said on</th><th>Who</th><th>How</th><th class="n">Moved</th></tr></thead><tbody>
${s.days.map((d) => `<tr><td>${e(weekDay(d.ready))}</td><td>${e(monthDay(d.said))}</td><td>${e(d.who)}</td><td>${e(d.how)}</td><td class="n${d.moved && d.moved > 0 ? ' moved' : ''}">${d.moved == null ? 'first day given' : d.moved === 0 ? 'no move' : `${d.moved > 0 ? '+' : ''}${d.moved} ${Math.abs(d.moved) === 1 ? 'day' : 'days'}`}</td></tr>`).join('\n')}
</tbody></table></section>`,
    )
    .join('\n')
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${e(head.site)}: the days they gave</title>
<style>
  body { font: 13px/1.45 -apple-system, 'Segoe UI', Roboto, sans-serif; color: #111; margin: 28px; }
  h1 { font-size: 20px; margin: 0 0 2px; }
  h2 { font-size: 15px; margin: 18px 0 2px; }
  .job { font-weight: 400; color: #444; }
  .head, .ours, .foot { margin: 0 0 6px; color: #333; }
  .total { font-size: 15px; font-weight: 700; margin: 10px 0 0; }
  table { border-collapse: collapse; width: 100%; }
  th, td { text-align: left; padding: 4px 8px; border-bottom: 1px solid #ccc; }
  th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; color: #444; }
  .n { text-align: right; white-space: nowrap; }
  .moved { color: #b42318; font-weight: 700; }
  section { break-inside: avoid; }
  .foot { margin-top: 18px; font-size: 11px; color: #555; }
</style></head><body>
<h1>${e(head.site)}: the days they gave</h1>
<p class="head">Each day ${e(head.contact)} gave for a stage to be ready, oldest first.</p>
<p class="total">${e(sheet.line)}</p>
${stages || '<p class="head">Nobody has given a day yet.</p>'}
<p class="foot">Printed ${e(weekDay(head.printedOn))}${head.by ? ` by ${e(head.by)}` : ''}. An office record. It is not sent to the customer.</p>
</body></html>`
}
