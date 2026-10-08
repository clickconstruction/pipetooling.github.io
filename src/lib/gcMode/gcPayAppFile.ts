/**
 * GC mode — design spike: one pay application as a file, for ours to the owner and a trade's to us
 * (the owner, 2026-10-04, question 12; one builder agreed by the Owner Billing and Building lanes).
 * The Excel is the AIA G702 and G703 template the Jobs Stages tab fills
 * (`public/templates/aia-g702-g703-mission-hills.xlsx`): its header cells go through the app's own
 * filler, so they land where the Jobs tab puts them, then the 703 gets one row per line from row
 * 13 down. The PDF draws the same two pages and the notary block with jspdf.
 *
 * `payAppCells` is the kernel: what goes in which cell, tested without a file. Nothing here writes
 * the model or calls the server.
 */
import type { PayApplication } from './gcBuilding'
import { AIA_G702_SHEET, AIA_G703_SHEET, AIA_TEMPLATE_PUBLIC_PATH } from '../aiaG702G703Template'
import { fillAiaG702G703Workbook } from '../fillAiaG702G703Workbook'
import { money, shortDate } from './gcWords'
// What moved to main (the real build) is re-exported from there, so there is one copy.
import type { PayAppParties } from '../gc/payAppFile'
import { PAY_APP_FIRST_ROW, PAY_APP_LAST_ROW, payAppCells, payAppFileName } from '../gc/payAppFile'
export type { PayAppCells, PayAppParties, PayAppRow } from '../gc/payAppFile'
export { PAY_APP_FIRST_ROW, PAY_APP_LAST_ROW, payAppCells, payAppFileName, splitAddress } from '../gc/payAppFile'

/** The filled workbook: the template with its header through the app's filler, then the 703's rows. */
export async function payAppWorkbook(template: ArrayBuffer, app: PayApplication, parties: PayAppParties): Promise<ArrayBuffer> {
  const cells = payAppCells(app, parties)
  const headed = await fillAiaG702G703Workbook(template, cells.fields)
  const ExcelJS = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(headed)
  const g702 = wb.getWorksheet(AIA_G702_SHEET)
  const g703 = wb.getWorksheet(AIA_G703_SHEET)
  if (!g702 || !g703) throw new Error('The pay application template is missing a sheet.')
  g702.getCell('H40').value = cells.previousCertificates
  // The template says "TO OWNER": ours goes to the customer, who may be a GC or an owner's rep. The
  // property's owner, when someone else, goes in the empty row under the project's lines.
  g702.getCell('A5').value = 'TO CUSTOMER:'
  if (parties.propertyOwner) {
    g702.getCell('L8').value = 'PROJECT OWNER:'
    g702.getCell('N8').value = parties.propertyOwner
  }
  for (let row = PAY_APP_FIRST_ROW; row <= PAY_APP_LAST_ROW; row++) {
    const line = cells.rows.find((r) => r.row === row)
    const r = g703.getRow(row)
    r.getCell('C').value = line ? `${line.description}` : null
    r.getCell('D').value = line?.scheduled ?? 0
    r.getCell('E').value = line?.previous ?? 0
    r.getCell('F').value = line?.thisPeriod ?? 0
    r.getCell('G').value = line?.stored ?? 0
    if (line && line.retainage !== null) r.getCell('K').value = line.retainage
  }
  // Excel works the formulas out again when it opens the file.
  wb.calcProperties.fullCalcOnLoad = true
  const out = (await wb.xlsx.writeBuffer()) as unknown as ArrayBuffer | Uint8Array
  if (out instanceof ArrayBuffer) return out.slice(0)
  const ab = new ArrayBuffer(out.byteLength)
  new Uint8Array(ab).set(out)
  return ab
}

function save(data: ArrayBuffer, name: string, type: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Fetches the template, fills it and saves the Excel file. */
export async function downloadPayAppExcel(app: PayApplication, parties: PayAppParties): Promise<void> {
  const res = await fetch(AIA_TEMPLATE_PUBLIC_PATH)
  if (!res.ok) throw new Error(`Could not load the pay application template (${res.status}).`)
  const book = await payAppWorkbook(await res.arrayBuffer(), app, parties)
  save(book, payAppFileName(parties, 'xlsx'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
}

/** The two pages as a PDF: the 702 with the notary block, then the 703. */
export async function payAppPdf(app: PayApplication, parties: PayAppParties): Promise<ArrayBuffer> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'landscape' })
  const s = app.summary
  const W = doc.internal.pageSize.getWidth()
  const M = 36
  const text = (t: string, x: number, y: number, o: { size?: number; bold?: boolean; align?: 'left' | 'right' | 'center' } = {}) => {
    doc.setFont('helvetica', o.bold ? 'bold' : 'normal')
    doc.setFontSize(o.size ?? 9)
    doc.text(t, x, y, { align: o.align ?? 'left' })
  }
  // Page 1: the G702.
  text('APPLICATION AND CERTIFICATE FOR PAYMENT', W / 2, M + 6, { size: 14, bold: true, align: 'center' })
  text('AIA DOCUMENT G702 · PAGE 1 OF 2', W / 2, M + 20, { size: 8, align: 'center' })
  let y = M + 44
  const pair = (label: string, value: string, x: number) => {
    text(label.toUpperCase(), x, y, { size: 7 })
    text(value, x, y + 11)
  }
  pair('To the customer', `${parties.to.name}${parties.to.address ? `, ${parties.to.address}` : ''}`, M)
  pair('Application no.', parties.applicationNo, W - M - 200)
  y += 26
  pair('From the contractor', `${parties.from.name}${parties.from.address ? `, ${parties.from.address}` : ''}`, M)
  pair('Period to', shortDate(parties.periodTo), W - M - 200)
  y += 26
  pair('Project', parties.project, M)
  pair('Contract date', parties.contractDate ? shortDate(parties.contractDate) : '', W - M - 200)
  y += 26
  if (parties.propertyOwner) {
    pair('Project owner', parties.propertyOwner, M)
    y += 26
  }
  if (parties.architect) {
    pair('Via architect', parties.architect, M)
    y += 26
  }
  y += 8
  const lines: [string, string, number][] = [
    ['1', 'Original contract sum', s.originalSum],
    ['2', 'Net change by change orders', s.changeOrders],
    ['3', 'Contract sum to date', s.sumToDate],
    ['4', 'Total completed and stored to date, from the 703', s.completedToDate],
    ['5', app.final ? 'Retainage, released on this final application' : `Retainage, ${parties.retainageWords ?? `${s.retainagePct}% of completed and stored work`}`, s.retainage],
    ['6', 'Total earned less retainage', s.earnedLessRetainage],
    ['7', 'Less previous certificates for payment', s.previousCertificates],
    ['8', 'Current payment due', s.currentDue],
    ['9', 'Balance to finish, including retainage', s.balanceToFinish],
  ]
  const half = W / 2 - 10
  for (const [n, words, amount] of lines) {
    text(n, M, y, { bold: n === '8' })
    text(words, M + 16, y, { bold: n === '8' })
    text(money(amount), half, y, { align: 'right', bold: n === '8' })
    y += 15
  }
  // The contractor's signature and the notary block, on the right as the form has them.
  let ry = M + 150
  const rx = W / 2 + 20
  text("CONTRACTOR'S CERTIFICATION", rx, ry, { bold: true })
  ry += 14
  text('The work covered by this application is complete as shown, and earlier', rx, ry, { size: 8 })
  ry += 10
  text('payments for it were paid to whom they were owed.', rx, ry, { size: 8 })
  ry += 22
  text(`Contractor: ${parties.from.name}`, rx, ry)
  ry += 18
  text('By: ______________________________   Date: ____________', rx, ry)
  ry += 26
  text('State of Texas.   County of ______________________', rx, ry)
  ry += 16
  text('Subscribed and sworn to before me this ____ day of ______________, 20____.', rx, ry)
  ry += 22
  text('Notary public: ______________________________', rx, ry)
  ry += 16
  text('My commission expires: ____________________', rx, ry)
  ry += 30
  text("ARCHITECT'S CERTIFICATE FOR PAYMENT", rx, ry, { bold: true })
  ry += 16
  text('Amount certified: ____________________', rx, ry)
  ry += 16
  text(`Architect: ${parties.architect ?? '______________________'}   By: ____________   Date: ________`, rx, ry)

  // Page 2: the G703.
  doc.addPage()
  text('CONTINUATION SHEET', W / 2, M + 6, { size: 14, bold: true, align: 'center' })
  text(`AIA DOCUMENT G703 · PAGE 2 OF 2 · ${parties.project} · application ${parties.applicationNo} · period to ${shortDate(parties.periodTo)}`, W / 2, M + 20, { size: 8, align: 'center' })
  // Right edges, with room for the widest amount in each column.
  const cols: [string, number, 'left' | 'right'][] = [
    ['A Item', M, 'left'],
    ['B Work', M + 34, 'left'],
    ['C Scheduled', M + 284, 'right'],
    ['D Previous', M + 356, 'right'],
    ['E This period', M + 428, 'right'],
    ['F Stored', M + 488, 'right'],
    ['G To date', M + 564, 'right'],
    ['%', M + 602, 'right'],
    ['H Balance', M + 662, 'right'],
  ]
  y = M + 46
  for (const [h, x, align] of cols) text(h, x, y, { size: 7, bold: true, align })
  text('I Retainage', W - M, y, { size: 7, bold: true, align: 'right' })
  y += 6
  doc.line(M, y, W - M, y)
  y += 12
  const row = (cells: string[], bold = false) => {
    cells.slice(0, cols.length).forEach((c, i) => {
      const col = cols[i]
      if (col) text(c, col[1], y, { size: 8, bold, align: col[2] })
    })
    text(cells[cols.length] ?? '', W - M, y, { size: 8, bold, align: 'right' })
    y += 13
  }
  for (const l of app.lines) {
    if (y > doc.internal.pageSize.getHeight() - M - 30) {
      doc.addPage()
      y = M + 20
    }
    row([String(l.item), l.label.length > 40 ? `${l.label.slice(0, 39)}…` : l.label, money(l.scheduled), money(l.fromPrevious), money(l.thisPeriod), money(l.stored), money(l.toDate), `${l.pct}%`, money(l.balance), money(l.retainage)])
  }
  doc.line(M, y - 8, W - M, y - 8)
  y += 2
  const t = app.totals
  row(['', 'Grand total', money(t.scheduled), money(t.fromPrevious), money(t.thisPeriod), money(t.stored), money(t.toDate), `${t.pct}%`, money(t.balance), money(t.retainage)], true)
  return doc.output('arraybuffer')
}

/** Draws and saves the PDF. */
export async function downloadPayAppPdf(app: PayApplication, parties: PayAppParties): Promise<void> {
  save(await payAppPdf(app, parties), payAppFileName(parties, 'pdf'), 'application/pdf')
}
