/**
 * The estimate's PDF (v2.5993, punch list #206 PR 3): `estimatePaperModel`'s lines drawn with jsPDF
 * on letter paper, the owner's records packet's pattern (`jobs/ownerRecordsPdf.ts`). The logo is
 * optional: the caller fetches the brand's PNG and hands it over; a fetch that fails draws the
 * company's name instead. Page numbers and the company sit in every page's foot.
 */
import { loadJsPDF } from '../loadJsPDF'
import type { EstimatePaperBlock, EstimatePaperModel } from './estimatePaper'

export type EstimatePaperLogo = { dataUrl: string; width: number; height: number }

const MARGIN = 20
const PAGE_W = 215.9
const WIDTH = PAGE_W - MARGIN * 2
const MAX_Y = 258
const FOOT_Y = 270
const INK: [number, number, number] = [20, 20, 20]
const MUTED: [number, number, number] = [110, 110, 110]
const ACCENT: [number, number, number] = [234, 88, 12]

/** The brand's PNG as a data URL with its size, or null when it cannot be read (the paper then names the company). */
export async function loadEstimateBrandLogo(src: string | null): Promise<EstimatePaperLogo | null> {
  if (!src || typeof fetch !== 'function' || typeof document === 'undefined') return null
  try {
    const res = await fetch(src)
    if (!res.ok) return null
    const blob = await res.blob()
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result))
      r.onerror = () => reject(r.error)
      r.readAsDataURL(blob)
    })
    const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
      img.onerror = () => reject(new Error('image'))
      img.src = dataUrl
    })
    if (!size.width || !size.height) return null
    return { dataUrl, ...size }
  } catch {
    return null
  }
}

export async function estimatePaperPdfBlob(m: EstimatePaperModel, logo: EstimatePaperLogo | null = null): Promise<Blob> {
  const JsPDF = await loadJsPDF()
  const doc = new JsPDF({ unit: 'mm', format: 'letter' })
  let y = MARGIN
  const room = (needed: number) => {
    if (y + needed > MAX_Y) {
      doc.addPage()
      y = MARGIN
    }
  }
  const font = (o: { bold?: boolean; size?: number; muted?: boolean; accent?: boolean }) => {
    doc.setFont('helvetica', o.bold ? 'bold' : 'normal')
    doc.setFontSize(o.size ?? 10.5)
    doc.setTextColor(...(o.accent ? ACCENT : o.muted ? MUTED : INK))
  }
  const para = (text: string, o: { bold?: boolean; size?: number; muted?: boolean; accent?: boolean; after?: number; width?: number; x?: number } = {}) => {
    font(o)
    const lines = doc.splitTextToSize(text, o.width ?? WIDTH) as string[]
    const lh = (o.size ?? 10.5) * 0.5
    for (const line of lines) {
      room(lh)
      doc.text(line, o.x ?? MARGIN, y)
      y += lh
    }
    y += o.after ?? 2
  }
  const rule = (light = false) => {
    room(2)
    doc.setDrawColor(...(light ? [225, 225, 225] : [190, 190, 190]) as [number, number, number])
    doc.setLineWidth(0.25)
    doc.line(MARGIN, y, MARGIN + WIDTH, y)
    y += 2.5
  }

  // Header: the title left, the logo (or the company's name) right.
  const logoW = 40
  const titleW = WIDTH - logoW - 6
  const headTop = y
  if (logo) {
    const h = Math.min(16, (logo.height / logo.width) * logoW)
    try {
      doc.addImage(logo.dataUrl, 'PNG', MARGIN + WIDTH - logoW, headTop - 3, logoW, h)
    } catch {
      font({ bold: true, size: 11 })
      doc.text(m.company, MARGIN + WIDTH, headTop + 2, { align: 'right' })
    }
  } else {
    font({ bold: true, size: 11 })
    doc.text(m.company, MARGIN + WIDTH, headTop + 2, { align: 'right' })
  }
  para(m.title, { bold: true, size: 17, after: 1, width: titleW })
  para(m.kindLine, { muted: true, size: 9.5, after: 0.5 })
  if (m.forLine) para(m.forLine, { size: 10, after: 0.5 })
  if (m.goodThrough) para(m.goodThrough, { size: 10, after: 0.5 })
  y = Math.max(y, headTop + 18)
  y += 2
  rule()

  for (const l of m.changeOrder) para(l, { size: 10, after: 0.5 })
  if (m.changeOrder.length) y += 2

  // The lines: a block per option, or the one block.
  para(m.linesHeading, { bold: true, size: 12.5, after: 2 })
  const colCount = MARGIN + WIDTH * 0.66
  const colUnit = MARGIN + WIDTH * 0.83
  const colAmt = MARGIN + WIDTH
  const nameW = WIDTH * 0.62
  const headerRow = () => {
    font({ muted: true, size: 8.5 })
    room(5)
    doc.text('Line item', MARGIN, y)
    doc.text('Count', colCount, y, { align: 'right' })
    doc.text('Unit price', colUnit, y, { align: 'right' })
    doc.text('Amount', colAmt, y, { align: 'right' })
    y += 2
    rule(true)
  }
  const block = (b: EstimatePaperBlock) => {
    if (b.heading) {
      room(14)
      font({ bold: true, size: 11.5 })
      const headLines = doc.splitTextToSize(b.heading, WIDTH - 40) as string[]
      doc.text(headLines[0] ?? '', MARGIN, y)
      if (b.total) doc.text(b.total, MARGIN + WIDTH, y, { align: 'right' })
      y += 5.5
      if (b.tags.length) {
        font({ accent: true, size: 8.5, bold: true })
        doc.text(b.tags.join('   ·   '), MARGIN, y)
        y += 4.5
      }
      if (b.pitch) para(b.pitch, { muted: true, size: 9.5, after: 1.5 })
    }
    headerRow()
    for (const l of b.lines) {
      font({ size: 10 })
      const nameLines = doc.splitTextToSize(l.name, nameW) as string[]
      font({ muted: true, size: 9 })
      const descLines = l.description ? (doc.splitTextToSize(l.description, nameW) as string[]) : []
      const h = nameLines.length * 5 + descLines.length * 4.2 + 2
      room(h)
      font({ size: 10 })
      nameLines.forEach((t, i) => doc.text(t, MARGIN, y + i * 5))
      doc.text(l.count, colCount, y, { align: 'right' })
      doc.text(l.unit, colUnit, y, { align: 'right' })
      doc.text(l.amount, colAmt, y, { align: 'right' })
      y += nameLines.length * 5
      if (descLines.length) {
        font({ muted: true, size: 9 })
        descLines.forEach((t, i) => doc.text(t, MARGIN, y + i * 4.2))
        y += descLines.length * 4.2
      }
      y += 1.5
      rule(true)
    }
    if (b.heading && b.total) {
      font({ bold: true, size: 10 })
      room(6)
      doc.text(`${b.heading.replace(/^Option \d+ · /, '')} total`, MARGIN, y)
      doc.text(b.total, MARGIN + WIDTH, y, { align: 'right' })
      y += 6
    }
    y += 4
  }
  for (const b of m.blocks) block(b)

  // The total.
  room(12)
  rule()
  font({ bold: true, size: 12.5 })
  doc.text(m.totalLine, MARGIN + WIDTH, y + 1, { align: 'right' })
  y += 7
  if (m.totalNote) para(m.totalNote, { muted: true, size: 9.5, after: 1 })
  if (m.acceptedLine) para(m.acceptedLine, { size: 10, bold: true, after: 1 })
  y += 4

  // The terms.
  if (m.terms.length || m.termsLink) {
    room(14)
    para(m.termsHeading, { bold: true, size: 12.5, after: 1.5 })
    for (const p of m.terms) para(p, { size: 9.5, after: 2 })
    if (m.termsLink) para(m.termsLink, { muted: true, size: 9, after: 1 })
    y += 3
  }

  // How to approve.
  if (m.approve) {
    room(12)
    rule()
    para(m.approve, { size: 10, bold: true, after: 1 })
  }

  // Every page's foot: the company's lines left, the page right.
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    font({ muted: true, size: 8 })
    const foot = [m.company, ...m.footer.filter((l) => l !== m.company)].slice(0, 3).join(' · ')
    doc.text(doc.splitTextToSize(foot, WIDTH - 30)[0] as string, MARGIN, FOOT_Y)
    doc.text(`Page ${p} of ${pages}`, MARGIN + WIDTH, FOOT_Y, { align: 'right' })
  }
  return doc.output('blob')
}
