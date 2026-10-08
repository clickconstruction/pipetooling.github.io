/**
 * GC mode, the real build, Owner Billing's O4a: one pay application as a file, the Excel and the PDF, from
 * `payAppCells` (`payAppFile.ts`). The Excel goes through the app's own AIA filler (`fillAiaG702G703Workbook`),
 * the one the Jobs Stages tab uses, with the GC form's options: "TO CUSTOMER", the architect's certificate, the
 * property's owner, the notary's state and each row's own retainage when a step lowers it partway. The PDF draws
 * the same two pages with jspdf. The prototype's writers (branch spike/gc-mode, `gcPayAppFile.ts`) wrote the rows
 * themselves; these hand them to the filler, so only the PDF is drawn here.
 */
import { AIA_TEMPLATE_PUBLIC_PATH } from '../aiaG702G703Template'
import type { PayApplicationLine } from '../aiaPayApplicationLines'
import { type AiaGcForm, AiaTooManyRows, fillAiaG702G703Workbook } from '../fillAiaG702G703Workbook'
import { loadJsPDF } from '../loadJsPDF'
import { saveBlobAs } from '../storageSave'
import type { PayApplication } from './building'
import { type PayAppCells, type PayAppParties, payAppCells, payAppFileName } from './payAppFile'
import { money, shortDate } from './words'

/** Ours goes to the customer, who may be a GC or an owner's rep, and the architect certifies it. Signed in Texas. */
export function payAppGcForm(parties: PayAppParties): AiaGcForm {
  return { to: 'TO CUSTOMER:', certifier: 'ARCHITECT:', projectOwner: parties.propertyOwner ?? null, notaryState: 'Texas' }
}

/** The 703's rows as the filler's lines, in order, and each row's own retainage when one differs from the one rate. */
export function payAppFillerLines(cells: PayAppCells): { lines: PayApplicationLine[]; rowRetainage?: (number | null)[] } {
  const lines = cells.rows.map((r) => ({
    id: `row-${r.row}`,
    label: r.description,
    scheduledValue: r.scheduled,
    labor: null,
    stage: null,
    fromPrevious: r.previous,
    thisPeriod: r.thisPeriod,
    stored: r.stored,
  }))
  return cells.rows.some((r) => r.retainage !== null) ? { lines, rowRetainage: cells.rows.map((r) => r.retainage) } : { lines }
}

/**
 * The filled workbook. More lines than the 703's 34 rows throws the filler's `AiaTooManyRows`: a file that
 * dropped lines would ask the customer for the wrong amount.
 */
export async function payAppWorkbook(template: ArrayBuffer, app: PayApplication, parties: PayAppParties): Promise<ArrayBuffer> {
  const cells = payAppCells(app, parties)
  if (cells.left > 0) throw new AiaTooManyRows(cells.rows.length + cells.left)
  const { lines, rowRetainage } = payAppFillerLines(cells)
  return fillAiaG702G703Workbook(template, { ...cells.fields, g702_h40_less_previous_certificates: cells.previousCertificates }, lines, {
    ...(rowRetainage ? { rowRetainage } : {}),
    gcForm: payAppGcForm(parties),
  })
}

/** Fetches the template, fills it and saves the Excel file. */
export async function downloadPayAppExcel(app: PayApplication, parties: PayAppParties): Promise<void> {
  const res = await fetch(AIA_TEMPLATE_PUBLIC_PATH)
  if (!res.ok) throw new Error(`Could not load the pay application template (${res.status}).`)
  const book = await payAppWorkbook(await res.arrayBuffer(), app, parties)
  saveBlobAs(new Blob([book], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), payAppFileName(parties, 'xlsx'))
}

/** The two pages as a PDF: the 702 with the notary block, then the 703. */
export async function payAppPdf(app: PayApplication, parties: PayAppParties): Promise<ArrayBuffer> {
  const JsPDF = await loadJsPDF()
  const doc = new JsPDF({ unit: 'pt', format: 'letter', orientation: 'landscape' })
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
  saveBlobAs(new Blob([await payAppPdf(app, parties)], { type: 'application/pdf' }), payAppFileName(parties, 'pdf'))
}
