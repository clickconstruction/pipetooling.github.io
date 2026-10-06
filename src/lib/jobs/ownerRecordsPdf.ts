/**
 * The owner's records packet as a PDF to save (v2.4619, the owner's ask on seeing the window):
 * the same cover note and statement `ownerPacketHtml` prints, drawn with jsPDF so there is a
 * file to attach or keep. `ownerPacketPdfModel` is the pure half — every line and row, tested;
 * `ownerPacketPdfBlob` draws it. A download counts as a send, as a print does (v2.4554).
 */
import { loadJsPDF } from '../loadJsPDF'
import type { OwnerPacket, OwnerPacketPayment } from './ownerRecords'
import { ownerCoverNoteLines, ownerPaymentWhen, type OwnerRecordsDocFacts, type OwnerRecordsDocFormat } from './ownerRecordsDocs'

export type OwnerPdfRow = { label: string; amount: string; tone: 'plain' | 'muted' | 'pay' | 'sum' }

export type OwnerPacketPdfModel = {
  title: string
  /** The cover note, one paragraph a line. */
  cover: string[]
  statementTitle: string
  asOf: string
  /** Job · total · paid · owed, then the property line. */
  summary: { head: string[]; rows: string[][]; sum: string[] }
  jobs: Array<{ heading: string; sub: string; rows: OwnerPdfRow[] }>
}

const payRows = (pays: ReadonlyArray<OwnerPacketPayment>, fmt: OwnerRecordsDocFormat): OwnerPdfRow[] =>
  pays.map((p) => ({ label: `Payment · ${ownerPaymentWhen(p, fmt)}`, amount: fmt.money(p.amount), tone: 'pay' }))

/** Every line the PDF draws, in order — the mirror of `ownerPacketHtml`. */
export function ownerPacketPdfModel(packet: OwnerPacket, f: OwnerRecordsDocFacts, fmt: OwnerRecordsDocFormat): OwnerPacketPdfModel {
  const cover = [fmt.day(f.asOfYmd), f.owner, f.address, ...ownerCoverNoteLines(f, fmt), f.company]
  const summary = {
    head: ['Job', 'Job total', 'Paid', 'Still owed'],
    rows: packet.jobs.map((j) => [`${j.number} · ${j.name}`, fmt.money(j.total), fmt.money(j.paid), fmt.money(j.owed)]),
    sum: ['This property', fmt.money(packet.total), fmt.money(packet.paid), fmt.money(packet.owed)],
  }
  const jobs = packet.jobs.map((j) => {
    const rows: OwnerPdfRow[] = [{ label: 'Job total', amount: fmt.money(j.total), tone: 'plain' }]
    if (!j.bills.length && !j.loosePayments.length) rows.push({ label: 'No bill has gone out on this job yet.', amount: '', tone: 'muted' })
    for (const b of j.bills) {
      rows.push({ label: `${b.label}${b.billedOn ? ` · billed ${fmt.day(b.billedOn)}` : ''}`, amount: fmt.money(b.amount), tone: 'plain' })
      rows.push(...payRows(b.payments, fmt))
      rows.push({ label: `Open on ${b.label.toLowerCase()}`, amount: fmt.money(b.open), tone: 'muted' })
    }
    if (j.loosePayments.length) {
      rows.push({ label: 'Payments on the job that name no bill', amount: '', tone: 'muted' })
      rows.push(...payRows(j.loosePayments, fmt))
    }
    rows.push({ label: 'Paid on this job', amount: fmt.money(j.paid), tone: 'plain' })
    rows.push({ label: 'Still owed on this job', amount: fmt.money(j.owed), tone: 'sum' })
    return { heading: `${j.number} · ${j.name}`, sub: `${j.address}${j.gcName ? ` · billed to ${j.gcName}` : ''}`, rows }
  })
  return { title: `Records for ${f.address}`, cover, statementTitle: `Statement for ${f.address}`, asOf: `As of ${fmt.day(f.asOfYmd)}`, summary, jobs }
}

/** `Records-9703-Lenox-Hill-San-Antonio-TX-2026-10-05.pdf` */
export function ownerPacketPdfFilename(address: string, asOfYmd: string): string {
  const slug = address.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
  return `Records-${slug || 'property'}-${asOfYmd}.pdf`
}

const MARGIN = 20
const WIDTH = 215.9 - MARGIN * 2
const MAX_Y = 262
const INK: [number, number, number] = [20, 20, 20]
const MUTED: [number, number, number] = [110, 110, 110]

export async function ownerPacketPdfBlob(packet: OwnerPacket, f: OwnerRecordsDocFacts, fmt: OwnerRecordsDocFormat): Promise<Blob> {
  const m = ownerPacketPdfModel(packet, f, fmt)
  const JsPDF = await loadJsPDF()
  const doc = new JsPDF({ unit: 'mm', format: 'letter' })
  let y = MARGIN
  const room = (needed: number) => {
    if (y + needed > MAX_Y) {
      doc.addPage()
      y = MARGIN
    }
  }
  const font = (o: { bold?: boolean; size?: number; muted?: boolean }) => {
    doc.setFont('helvetica', o.bold ? 'bold' : 'normal')
    doc.setFontSize(o.size ?? 10.5)
    doc.setTextColor(...(o.muted ? MUTED : INK))
  }
  const para = (text: string, o: { bold?: boolean; size?: number; muted?: boolean; after?: number } = {}) => {
    font(o)
    const lines = doc.splitTextToSize(text, WIDTH) as string[]
    const lh = (o.size ?? 10.5) * 0.5
    for (const line of lines) {
      room(lh)
      doc.text(line, MARGIN, y)
      y += lh
    }
    y += o.after ?? 2
  }
  const rule = () => {
    room(2)
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.25)
    doc.line(MARGIN, y, MARGIN + WIDTH, y)
    y += 2.5
  }
  const twoCol = (r: OwnerPdfRow) => {
    font({ bold: r.tone === 'sum', muted: r.tone === 'muted' || r.tone === 'pay', size: r.tone === 'pay' ? 9.5 : 10.5 })
    const labelLines = doc.splitTextToSize(r.label, WIDTH - 40) as string[]
    const lh = 5
    room(lh * labelLines.length)
    labelLines.forEach((line, i) => doc.text(line, MARGIN + (r.tone === 'pay' ? 4 : 0), y + lh * i))
    if (r.amount) doc.text(r.amount, MARGIN + WIDTH, y, { align: 'right' })
    y += lh * labelLines.length
  }

  // Cover note
  for (const line of m.cover.slice(0, 3)) para(line, { after: 0 })
  y += 4
  for (const line of m.cover.slice(3, -1)) para(line, { after: 3 })
  para(m.cover[m.cover.length - 1]!, { after: 0 })

  // Statement
  doc.addPage()
  y = MARGIN
  para(m.statementTitle, { bold: true, size: 15, after: 1 })
  para(m.asOf, { muted: true, after: 4 })
  const cols = [MARGIN, MARGIN + WIDTH * 0.55, MARGIN + WIDTH * 0.7, MARGIN + WIDTH * 0.85, MARGIN + WIDTH]
  const row4 = (cells: string[], o: { bold?: boolean; muted?: boolean }) => {
    font({ ...o, size: 10 })
    room(5.5)
    doc.text(doc.splitTextToSize(cells[0]!, WIDTH * 0.53)[0] as string, cols[0]!, y)
    doc.text(cells[1]!, cols[2]!, y, { align: 'right' })
    doc.text(cells[2]!, cols[3]!, y, { align: 'right' })
    doc.text(cells[3]!, cols[4]!, y, { align: 'right' })
    y += 5.5
  }
  row4(m.summary.head, { muted: true })
  rule()
  for (const r of m.summary.rows) row4(r, {})
  rule()
  row4(m.summary.sum, { bold: true })
  y += 6

  for (const j of m.jobs) {
    room(16)
    para(j.heading, { bold: true, size: 12, after: 0.5 })
    para(j.sub, { muted: true, size: 9.5, after: 2 })
    for (const r of j.rows) {
      if (r.tone === 'sum') rule()
      twoCol(r)
    }
    y += 6
  }
  return doc.output('blob')
}
