/**
 * A sheet as one printed page (punch list #404, step 3): the HTML the **Print the sheet** press hands to the print
 * window, and the copy that is filed under Sent copies. It carries its own styles and no script, and it is the same
 * page the screen draws (`SheetPaper.tsx`): the name at the top, the title, the opening lines, who must be named and
 * where, the certificate holder, the coverage beside its least amount, and the line at the foot.
 *
 * Every piece of words is escaped: a sheet's words are typed by a person. Pure: no React, no DOM.
 */
import { escapeHtml } from '../bidDocuments/escapeHtml'
import type { ResolvedSheet } from './sheet'

/** The kind a printed or sent sheet is filed as under Sent copies. */
export const SHEET_SENT_KIND = 'insurance_sheet'

export function sheetPrintTitle(sheet: ResolvedSheet): string {
  return `${sheet.title} ${sheet.subtitle}`.replace(/\s+/g, ' ').trim()
}

export function sheetPrintHtml(sheet: ResolvedSheet, stamp: string): string {
  const e = escapeHtml
  const open = sheet.open.map((line) => `<p>${e(line)}</p>`).join('')
  const insured = sheet.insured.map((name) => `<div class="name">${e(name)}</div>`).join('')
  const cover = sheet.cover.map((c) => `<tr><td class="what">${e(c.label)}</td><td>${e(c.limit)}</td></tr>`).join('')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${e(sheetPrintTitle(sheet))}</title>
<style>
  @page { size: letter; margin: 0.6in; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #1a1a1a; font: 13px/1.5 -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
  p { margin: 0 0 8px; }
  .head { text-align: center; padding-bottom: 10px; border-bottom: 2px solid #111827; margin-bottom: 12px; }
  .head b { font-size: 16px; letter-spacing: 0.02em; display: block; }
  .head span { font-size: 12px; color: #4b5563; display: block; }
  .title { text-align: center; margin-bottom: 12px; }
  .title b { font-size: 16px; letter-spacing: 0.04em; display: block; }
  .title span { font-weight: 600; }
  .must { border: 1.5px solid #111827; border-radius: 4px; padding: 10px 12px; text-align: center; margin: 12px 0; }
  .must .name { font-size: 14px; font-weight: 700; }
  .holder { display: grid; grid-template-columns: auto 1fr; gap: 2px 14px; margin-bottom: 12px; }
  table { border-collapse: collapse; width: 100%; }
  th { text-align: left; font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; color: #4b5563; padding: 4px 0; border-bottom: 1px solid #6b7280; }
  td { padding: 7px 0; border-bottom: 1px solid #d1d5db; vertical-align: top; }
  td.what { font-weight: 700; width: 46%; padding-right: 12px; }
  .foot { font-size: 12px; color: #4b5563; margin-top: 12px; }
  .stamp { font-size: 11.5px; color: #4b5563; border-top: 1px solid #d1d5db; padding-top: 8px; margin-top: 12px; }
</style>
</head>
<body>
  <div class="head"><b>${e(sheet.co)}</b><span>${e(sheet.addr1)}</span><span>${e(sheet.addr2)}</span></div>
  <div class="title"><b>${e(sheet.title)}</b><span>${e(sheet.subtitle)}</span></div>
  ${open}
  <div class="must"><div>${e(sheet.lead)}</div>${insured}<div>${e(sheet.at)} ${e(sheet.place)}</div></div>
  <div class="holder"><div>${e(sheet.holder)}</div><div><b>${e(sheet.hName)}</b><br>${e(sheet.hAddr1)}<br>${e(sheet.hAddr2)}</div></div>
  <table><thead><tr><th>${e(sheet.colA)}</th><th>${e(sheet.colB)}</th></tr></thead><tbody>${cover}</tbody></table>
  <p class="foot">* ${e(sheet.foot)}</p>
  <div class="stamp">${e(stamp)}</div>
</body>
</html>`
}
