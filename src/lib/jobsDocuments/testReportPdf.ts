import { loadJsPDF } from '../loadJsPDF'
import { buildTestReportBlocks, type TestReportBlock, type TestReportColumn, type TestReportData, type TestReportJobInfo, type TestReportSettings } from '../jobs/testReport'

/**
 * The test report as a real-text Letter PDF (v2.3296) — the hazmat-notice
 * pattern: the kernel's block model walked with a paging cursor. Replaces the
 * external app's html2canvas screenshot-in-a-PDF, so the text is selectable
 * and a long FAIL report paginates instead of clipping at 11 inches.
 */

const PAGE_MARGIN = 18
const CONTENT_W = 215.9 - 2 * PAGE_MARGIN
const PAGE_CONTENT_MAX_Y = 262
const COPPER: [number, number, number] = [176, 102, 47]
const INK: [number, number, number] = [22, 40, 60]
const MUTED: [number, number, number] = [90, 107, 126]
const HAIR: [number, number, number] = [221, 214, 200]
const GREEN: [number, number, number] = [31, 122, 58]
const RED: [number, number, number] = [180, 35, 24]
const KV_LABEL_W = 34

export async function buildTestReportPdfBlob(data: TestReportData, job: TestReportJobInfo, settings: TestReportSettings): Promise<Blob> {
  return renderTestReportPdf(buildTestReportBlocks(data, job, settings))
}

export async function renderTestReportPdf(blocks: TestReportBlock[]): Promise<Blob> {
  const JsPDF = await loadJsPDF()
  const doc = new JsPDF({ unit: 'mm', format: 'letter' })
  let y = PAGE_MARGIN

  const ensureRoom = (needed: number) => {
    if (y + needed > PAGE_CONTENT_MAX_Y) {
      doc.addPage()
      y = PAGE_MARGIN
    }
  }
  const writeWrapped = (text: string, lineHeight: number, x = PAGE_MARGIN, width = CONTENT_W) => {
    const lines = doc.splitTextToSize(text, width) as string[]
    for (const line of lines) {
      ensureRoom(lineHeight)
      doc.text(line, x, y)
      y += lineHeight
    }
  }
  const setInk = () => doc.setTextColor(INK[0], INK[1], INK[2])

  for (const block of blocks) {
    switch (block.kind) {
      case 'letterhead': {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(20)
        setInk()
        doc.text(block.companyName.toUpperCase(), PAGE_MARGIN, y + 6)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(MUTED[0], MUTED[1], MUTED[2])
        if (block.tagline.trim()) doc.text(block.tagline.toUpperCase(), PAGE_MARGIN, y + 11)
        // Title block, right-aligned.
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(12.5)
        setInk()
        doc.text(block.title, PAGE_MARGIN + CONTENT_W, y + 6, { align: 'right' })
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(MUTED[0], MUTED[1], MUTED[2])
        doc.text([block.dateLabel, block.jobLabel].filter(Boolean).join(' · '), PAGE_MARGIN + CONTENT_W, y + 11, { align: 'right' })
        y += 15
        doc.setDrawColor(COPPER[0], COPPER[1], COPPER[2])
        doc.setLineWidth(0.8)
        doc.line(PAGE_MARGIN, y, PAGE_MARGIN + CONTENT_W, y)
        doc.setLineWidth(0.2)
        y += 8
        setInk()
        break
      }
      case 'columns': {
        const colW = (CONTENT_W - 8) / 2
        const top = y
        let maxY = y
        const drawColumn = (col: TestReportColumn, x: number) => {
          y = top
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(8)
          doc.setTextColor(COPPER[0], COPPER[1], COPPER[2])
          doc.text(col.heading.toUpperCase(), x, y)
          y += 1.5
          doc.setDrawColor(HAIR[0], HAIR[1], HAIR[2])
          doc.line(x, y, x + colW, y)
          y += 5
          setInk()
          doc.setFontSize(10)
          for (const line of col.lines ?? []) {
            doc.setFont('helvetica', 'normal')
            writeWrapped(line, 5, x, colW)
          }
          for (const row of col.rows) {
            doc.setFont('helvetica', 'normal')
            doc.setTextColor(MUTED[0], MUTED[1], MUTED[2])
            doc.text(row.label, x, y)
            setInk()
            const lines = doc.splitTextToSize(row.value, colW - KV_LABEL_W + 10) as string[]
            for (const line of lines) {
              doc.text(line, x + KV_LABEL_W - 10, y)
              y += 5
            }
          }
          maxY = Math.max(maxY, y)
        }
        drawColumn(block.left, PAGE_MARGIN)
        drawColumn(block.right, PAGE_MARGIN + colW + 8)
        y = maxY + 3
        break
      }
      case 'section':
        ensureRoom(14)
        y += 3
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.setTextColor(COPPER[0], COPPER[1], COPPER[2])
        doc.text(block.text.toUpperCase(), PAGE_MARGIN, y)
        y += 1.5
        doc.setDrawColor(HAIR[0], HAIR[1], HAIR[2])
        doc.line(PAGE_MARGIN, y, PAGE_MARGIN + CONTENT_W, y)
        y += 5
        setInk()
        break
      case 'kv':
        doc.setFontSize(10)
        for (const row of block.rows) {
          const lines = doc.splitTextToSize(row.value, CONTENT_W - KV_LABEL_W) as string[]
          ensureRoom(5 * Math.max(1, lines.length))
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(MUTED[0], MUTED[1], MUTED[2])
          doc.text(row.label, PAGE_MARGIN, y)
          setInk()
          const isTotal = row.label === 'Total'
          doc.setFont('helvetica', isTotal ? 'bold' : 'normal')
          for (const line of lines) {
            doc.text(line, PAGE_MARGIN + KV_LABEL_W, y)
            y += 5
          }
        }
        y += 1
        break
      case 'verdict': {
        ensureRoom(8)
        const color = block.result === 'pass' ? GREEN : RED
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(12)
        doc.setTextColor(color[0], color[1], color[2])
        const word = block.result.toUpperCase()
        doc.text(word, PAGE_MARGIN, y)
        const w = doc.getTextWidth(word)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        setInk()
        doc.text(` — ${block.text}`, PAGE_MARGIN + w, y)
        y += 6.5
        break
      }
      case 'paragraph':
        doc.setFontSize(10)
        if (block.label) {
          ensureRoom(5)
          doc.setFont('helvetica', 'bold')
          doc.text(`${block.label}:`, PAGE_MARGIN, y)
          y += 5
        }
        doc.setFont('helvetica', 'normal')
        writeWrapped(block.text, 5)
        y += 1.5
        break
      case 'certification': {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9.5)
        const paras = block.text.split('\n\n')
        paras.forEach((para, i) => {
          for (const line of para.split('\n')) writeWrapped(line, 4.6)
          if (i < paras.length - 1) y += 2.5
        })
        break
      }
    }
  }

  return doc.output('blob')
}

export async function testReportPdfToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode(...buf.subarray(i, i + chunk))
  }
  return btoa(binary)
}
