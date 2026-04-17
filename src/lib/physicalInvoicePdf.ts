import type { PhysicalInvoiceDocument } from './physicalInvoiceDocument'
import type { PhysicalInvoiceMaterialLine, PhysicalInvoiceServiceLine } from './physicalInvoiceLineItems'
import { loadJsPDF } from './loadJsPDF'

const PAGE_MARGIN = 18
const LINE_HEIGHT = 6
const MAX_TEXT_WIDTH_MM = 180
/** Below this y (mm), start a new page for more body text. */
const PAGE_CONTENT_MAX_Y = 265
/** Min space (mm) needed below cursor before starting detailed legal footer (tagline + license + text). */
const FOOTER_BLOCK_MIN_RESERVE_MM = 40
/** Gap (mm) before issuer block after max(left column bottom incl. service address + CONTACT, meta bottom). */
const POST_INVOICE_HEADER_GAP_MM = 1
/** Space (mm) between last narrative line and SERVICE ADDRESS label (left column). */
const NARRATIVE_TO_SERVICE_GAP_MM = 1.5
/** Space (mm) between SERVICE ADDRESS (or narrative) and CONTACT on the left stack. */
const CONTACT_AFTER_LEFT_STACK_GAP_MM = 1.5

const COL_DESC_W = 92
const COL_QTY_X = PAGE_MARGIN + 96
const COL_UNIT_X = PAGE_MARGIN + 112
const COL_AMT_X = PAGE_MARGIN + 148
/** Table horizontal bounds for line-item row rules (mm). */
const tableRightX = (pageW: number) => pageW - PAGE_MARGIN
/** Line items body: padding and baselines inside each row box (mm). */
const LINE_ITEM_ROW_PAD_TOP_MM = 1.2
const LINE_ITEM_ROW_PAD_BOTTOM_MM = 1.2
/** First description baseline below `rowTop + LINE_ITEM_ROW_PAD_TOP_MM` (9pt Helvetica). */
const LINE_ITEM_FIRST_BASELINE_MM = 3.35
/** Space below last description baseline before row bottom (descenders). */
const LINE_ITEM_DESCENDER_CLEAR_MM = 1.15
/** Qty / unit / amount: baseline offset from row vertical midpoint (9pt). */
const LINE_ITEM_NUM_VCENTER_OFFSET_MM = 1.28
const META_COL_X = 128
/** Value column start offset (mm); must match `drawMetaPair`. */
const META_VALUE_COL_OFFSET_MM = 38

function contentTextWidthMm(pageW: number): number {
  return pageW - 2 * PAGE_MARGIN
}

function drawLabelValue(
  doc: import('jspdf').jsPDF,
  y: number,
  label: string,
  value: string,
): number {
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(label, PAGE_MARGIN, y)
  doc.setFont('helvetica', 'normal')
  const wrapped = doc.splitTextToSize(value, MAX_TEXT_WIDTH_MM - 42)
  doc.text(wrapped, PAGE_MARGIN + 40, y)
  return y + Math.max(LINE_HEIGHT, wrapped.length * LINE_HEIGHT * 0.85)
}

function advanceYForWrappedLines(
  doc: import('jspdf').jsPDF,
  y: number,
  lines: string[],
  lineHeight: number,
): number {
  let nextY = y
  for (const line of lines) {
    if (nextY > PAGE_CONTENT_MAX_Y) {
      doc.addPage()
      nextY = PAGE_MARGIN + 10
    }
    doc.text(line, PAGE_MARGIN, nextY)
    nextY += lineHeight
  }
  return nextY
}

function drawMetaPair(doc: import('jspdf').jsPDF, y: number, label: string, value: string): number {
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text(label.toUpperCase(), META_COL_X, y)
  doc.setFont('helvetica', 'normal')
  const pageW = doc.internal.pageSize.getWidth()
  const wrapped = doc.splitTextToSize(value, pageW - META_COL_X - PAGE_MARGIN)
  doc.text(wrapped, META_COL_X + META_VALUE_COL_OFFSET_MM, y)
  return y + Math.max(4.5, wrapped.length * 4.2)
}

/** Right edge (mm) of the meta block text (Invoice…Due date) for a content-width rule above AMOUNT DUE. */
function metaBlockMaxRightMm(
  doc: import('jspdf').jsPDF,
  pageW: number,
  rows: readonly { label: string; value: string }[],
): number {
  const valueMaxWidthMm = pageW - META_COL_X - PAGE_MARGIN
  let maxRight = META_COL_X
  doc.setFontSize(8)
  for (const { label, value } of rows) {
    doc.setFont('helvetica', 'bold')
    maxRight = Math.max(maxRight, META_COL_X + doc.getTextWidth(label.toUpperCase()))
    doc.setFont('helvetica', 'normal')
    const wrapped = doc.splitTextToSize(value, valueMaxWidthMm)
    for (const line of wrapped) {
      maxRight = Math.max(maxRight, META_COL_X + META_VALUE_COL_OFFSET_MM + doc.getTextWidth(line))
    }
  }
  const padded = maxRight + 0.5
  return Math.min(padded, pageW - PAGE_MARGIN)
}

function formatUsdPlain(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function lineItemRowHeightMm(descLineCount: number, lineStepMm: number): number {
  const n = Math.max(1, descLineCount)
  return (
    LINE_ITEM_ROW_PAD_TOP_MM +
    LINE_ITEM_FIRST_BASELINE_MM +
    (n - 1) * lineStepMm +
    LINE_ITEM_DESCENDER_CLEAR_MM +
    LINE_ITEM_ROW_PAD_BOTTOM_MM
  )
}

function drawLineItemsTable(
  doc: import('jspdf').jsPDF,
  y: number,
  sectionTitle: string,
  rows: PhysicalInvoiceServiceLine[] | PhysicalInvoiceMaterialLine[],
  bodyLineHeight: number,
  opts?: { mergeTitleIntoFirstHeader?: boolean },
): number {
  if (!rows.length) return y
  if (y > PAGE_CONTENT_MAX_Y - 30) {
    doc.addPage()
    y = PAGE_MARGIN + 10
  }
  const mergeTitleIntoFirstHeader = opts?.mergeTitleIntoFirstHeader ?? false
  const lineStepMm = bodyLineHeight * 0.92
  const pageW = doc.internal.pageSize.getWidth()
  const rightX = tableRightX(pageW)

  if (!mergeTitleIntoFirstHeader) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(0, 0, 0)
    doc.text(sectionTitle, PAGE_MARGIN, y)
    y += LINE_HEIGHT * 0.9
  }

  const headerRowY = y
  if (mergeTitleIntoFirstHeader) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(0, 0, 0)
    doc.text(sectionTitle, PAGE_MARGIN, headerRowY)
  } else {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(80, 80, 80)
    doc.text('Description', PAGE_MARGIN, headerRowY)
  }

  const numericHeaderY = mergeTitleIntoFirstHeader ? headerRowY + 0.65 : headerRowY
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(80, 80, 80)
  doc.text('Qty', COL_QTY_X, numericHeaderY, { align: 'right' })
  doc.text('Unit price', COL_UNIT_X, numericHeaderY, { align: 'right' })
  doc.text('Amount', COL_AMT_X, numericHeaderY, { align: 'right' })
  doc.setTextColor(0, 0, 0)
  y += 4
  doc.setDrawColor(220, 220, 220)
  doc.line(PAGE_MARGIN, y, rightX, y)
  doc.setDrawColor(0, 0, 0)
  y += 3
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  for (const r of rows) {
    const descLines = doc.splitTextToSize(r.description, COL_DESC_W)
    const rowHeight = lineItemRowHeightMm(descLines.length, lineStepMm)
    if (y + rowHeight > PAGE_CONTENT_MAX_Y) {
      doc.addPage()
      y = PAGE_MARGIN + 10
    }
    const rowTop = y
    const rowBottom = rowTop + rowHeight
    const firstDescBaseline = rowTop + LINE_ITEM_ROW_PAD_TOP_MM + LINE_ITEM_FIRST_BASELINE_MM
    for (let i = 0; i < descLines.length; i++) {
      doc.text(descLines[i] ?? '', PAGE_MARGIN, firstDescBaseline + i * lineStepMm)
    }
    const rowMidY = rowTop + rowHeight / 2
    const numBaselineY = rowMidY + LINE_ITEM_NUM_VCENTER_OFFSET_MM
    doc.text(String(r.qty), COL_QTY_X, numBaselineY, { align: 'right' })
    doc.text(formatUsdPlain(r.unitPrice), COL_UNIT_X, numBaselineY, { align: 'right' })
    doc.text(formatUsdPlain(r.amount), COL_AMT_X, numBaselineY, { align: 'right' })
    doc.setDrawColor(240, 240, 240)
    doc.line(PAGE_MARGIN, rowBottom, rightX, rowBottom)
    doc.setDrawColor(0, 0, 0)
    y = rowBottom
  }
  return y + 4
}

function drawPaymentHistory(
  doc: import('jspdf').jsPDF,
  y: number,
  docModel: PhysicalInvoiceDocument,
  bodyLineHeight: number,
): number {
  const rows = docModel.paymentHistory
  if (!rows.length) return y
  if (y > PAGE_CONTENT_MAX_Y - 24) {
    doc.addPage()
    y = PAGE_MARGIN + 10
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Payment history', PAGE_MARGIN, y)
  y += LINE_HEIGHT * 0.85
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  for (const p of rows) {
    if (y > PAGE_CONTENT_MAX_Y) {
      doc.addPage()
      y = PAGE_MARGIN + 10
    }
    doc.text(`${p.dateDisplay}  ${p.method}`, PAGE_MARGIN, y)
    doc.text(p.amountFormatted, doc.internal.pageSize.getWidth() - PAGE_MARGIN, y, { align: 'right' })
    y += bodyLineHeight
  }
  return y + 6
}

function drawPageFooters(doc: import('jspdf').jsPDF): void {
  const n = doc.getNumberOfPages()
  const pageW = doc.internal.pageSize.getWidth()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(120, 120, 120)
    doc.text(`-- ${i} of ${n} --`, pageW / 2, 287, { align: 'center' })
    doc.setTextColor(0, 0, 0)
  }
}

async function buildPhysicalInvoicePdfBlobDetailed(docModel: PhysicalInvoiceDocument): Promise<Blob> {
  const JsPDF = await loadJsPDF()
  const doc = new JsPDF({ unit: 'mm', format: 'letter' })
  let y = PAGE_MARGIN + 6
  const pageW = doc.internal.pageSize.getWidth()
  const bodyLineHeight = LINE_HEIGHT * 0.85
  const issuerName = (docModel.issuer.companyName ?? '').trim()
  const tagline = (docModel.issuer.tagline ?? '').trim()

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  if (issuerName) {
    doc.text(issuerName, PAGE_MARGIN, y)
  }
  y += 8

  doc.setFontSize(18)
  doc.text('INVOICE', PAGE_MARGIN, y)
  y += 10

  const metaStartY = y
  let leftY = y
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  if (docModel.narrativeTitle.trim()) {
    const narrativeLines = doc.splitTextToSize(docModel.narrativeTitle, 105)
    for (const line of narrativeLines) {
      if (leftY > PAGE_CONTENT_MAX_Y) {
        doc.addPage()
        leftY = PAGE_MARGIN + 10
      }
      doc.text(line, PAGE_MARGIN, leftY)
      leftY += bodyLineHeight
    }
  }

  let metaY = metaStartY
  metaY = drawMetaPair(doc, metaY, 'Invoice', docModel.invoiceNumberDisplay)
  metaY = drawMetaPair(doc, metaY, 'Service date', docModel.serviceDateDisplay)
  metaY = drawMetaPair(doc, metaY, 'Payment terms', docModel.paymentTerms)
  metaY = drawMetaPair(doc, metaY, 'Due date', docModel.dueDateDisplay)
  const metaRows = [
    { label: 'Invoice', value: docModel.invoiceNumberDisplay },
    { label: 'Service date', value: docModel.serviceDateDisplay },
    { label: 'Payment terms', value: docModel.paymentTerms },
    { label: 'Due date', value: docModel.dueDateDisplay },
  ] as const
  const amountDueRuleEndX = metaBlockMaxRightMm(doc, pageW, metaRows)
  const amountDueRuleY = metaY - 3.5
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.15)
  doc.line(META_COL_X, amountDueRuleY, amountDueRuleEndX, amountDueRuleY)
  doc.setLineWidth(0.2)
  doc.setDrawColor(0, 0, 0)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('AMOUNT DUE', META_COL_X, metaY)
  doc.setFontSize(11)
  doc.text(docModel.amountFormatted, META_COL_X + META_VALUE_COL_OFFSET_MM, metaY)
  doc.setFont('helvetica', 'normal')
  metaY += 10

  const afterNarrativeY = leftY
  const serviceAddressWrapMm = META_COL_X - PAGE_MARGIN - 2
  const serviceAddressText = (docModel.serviceAddress ?? '').trim()
  let yAfterService: number
  if (serviceAddressText) {
    let yAddr = afterNarrativeY + NARRATIVE_TO_SERVICE_GAP_MM
    if (yAddr > PAGE_CONTENT_MAX_Y - 16) {
      doc.addPage()
      yAddr = PAGE_MARGIN + 10
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('SERVICE ADDRESS', PAGE_MARGIN, yAddr)
    yAddr += 4.5
    doc.setFont('helvetica', 'normal')
    for (const line of doc.splitTextToSize(serviceAddressText, serviceAddressWrapMm)) {
      if (yAddr > PAGE_CONTENT_MAX_Y) {
        doc.addPage()
        yAddr = PAGE_MARGIN + 10
      }
      doc.text(line, PAGE_MARGIN, yAddr)
      yAddr += 4.2
    }
    yAfterService = yAddr + 4
  } else {
    yAfterService = afterNarrativeY
  }

  const hasContact = docModel.customerName || docModel.customerEmail || docModel.customerPhone
  let yAfterContact: number
  if (hasContact) {
    let yC = yAfterService + CONTACT_AFTER_LEFT_STACK_GAP_MM
    if (yC > PAGE_CONTENT_MAX_Y - 16) {
      doc.addPage()
      yC = PAGE_MARGIN + 10
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('CONTACT', PAGE_MARGIN, yC)
    yC += 4.5
    doc.setFont('helvetica', 'normal')
    const contactWrapMm = serviceAddressWrapMm
    const drawContactWrapped = (raw: string | null | undefined) => {
      const t = (raw ?? '').trim()
      if (!t) return
      for (const line of doc.splitTextToSize(t, contactWrapMm)) {
        if (yC > PAGE_CONTENT_MAX_Y) {
          doc.addPage()
          yC = PAGE_MARGIN + 10
        }
        doc.text(line, PAGE_MARGIN, yC)
        yC += 4.2
      }
    }
    if (docModel.customerName) drawContactWrapped(docModel.customerName)
    if (docModel.customerEmail) drawContactWrapped(docModel.customerEmail)
    if (docModel.customerPhone) drawContactWrapped(docModel.customerPhone)
    yAfterContact = yC + 6
  } else {
    yAfterContact = yAfterService
  }

  y = Math.max(yAfterContact, metaY) + POST_INVOICE_HEADER_GAP_MM

  const addrLines = (docModel.issuer.addressText ?? '').split('\n').map((s) => s.trim()).filter(Boolean)
  if (issuerName || addrLines.length || docModel.issuer.phone || docModel.issuer.email) {
    if (y > PAGE_CONTENT_MAX_Y - 20) {
      doc.addPage()
      y = PAGE_MARGIN + 10
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    if (issuerName) doc.text(issuerName, PAGE_MARGIN, y)
    y += 4.5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    for (const line of addrLines) {
      doc.text(line, PAGE_MARGIN, y)
      y += 4.2
    }
    if (docModel.issuer.phone) {
      doc.text(docModel.issuer.phone, PAGE_MARGIN, y)
      y += 4.2
    }
    if (docModel.issuer.email) {
      doc.text(docModel.issuer.email, PAGE_MARGIN, y)
      y += 4.2
    }
    y += 6
  }

  y = drawLineItemsTable(doc, y, 'Services', docModel.serviceLines, bodyLineHeight, {
    mergeTitleIntoFirstHeader: true,
  })
  y = drawLineItemsTable(doc, y, 'Materials', docModel.materialLines, bodyLineHeight)

  if (y > PAGE_CONTENT_MAX_Y - 20) {
    doc.addPage()
    y = PAGE_MARGIN + 10
  }
  doc.setFontSize(10)
  doc.text(`Subtotal`, PAGE_MARGIN, y)
  doc.text(docModel.subtotalFormatted, COL_AMT_X, y, { align: 'right' })
  y += LINE_HEIGHT
  doc.setFont('helvetica', 'bold')
  doc.text(`Amount due`, PAGE_MARGIN, y)
  doc.text(docModel.amountFormatted, COL_AMT_X, y, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  y += 8

  y = drawPaymentHistory(doc, y, docModel, bodyLineHeight)

  if (docModel.memo) {
    if (y > PAGE_CONTENT_MAX_Y - 16) {
      doc.addPage()
      y = PAGE_MARGIN + 10
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('Memo', PAGE_MARGIN, y)
    y += LINE_HEIGHT
    doc.setFont('helvetica', 'normal')
    const memoLines = doc.splitTextToSize(docModel.memo, MAX_TEXT_WIDTH_MM)
    y = advanceYForWrappedLines(doc, y, memoLines, bodyLineHeight)
    y += 4
  }

  const licenseTrim = (docModel.issuer.licenseLine ?? '').trim()
  const footerTrim = docModel.footer.trim()
  const shouldDrawIssuerTail = Boolean(tagline || issuerName || licenseTrim || footerTrim)
  if (shouldDrawIssuerTail) {
    if (y > PAGE_CONTENT_MAX_Y - FOOTER_BLOCK_MIN_RESERVE_MM) {
      doc.addPage()
      y = PAGE_MARGIN + 10
    }
    const contentW = contentTextWidthMm(pageW)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    if (tagline) {
      for (const line of doc.splitTextToSize(tagline, contentW)) {
        doc.text(line, PAGE_MARGIN, y)
        y += 6
      }
    } else if (issuerName) {
      for (const line of doc.splitTextToSize(issuerName, contentW)) {
        doc.text(line, PAGE_MARGIN, y)
        y += 6
      }
    }
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    if (licenseTrim) {
      for (const line of doc.splitTextToSize(licenseTrim, contentW)) {
        doc.text(line, PAGE_MARGIN, y)
        y += 4.5
      }
      y += 4
    }
    if (footerTrim) {
      y += 5
      const footerLines = doc.splitTextToSize(docModel.footer, contentW)
      y = advanceYForWrappedLines(doc, y, footerLines, bodyLineHeight)
    }
  }

  drawPageFooters(doc)

  const pageCount = doc.getNumberOfPages()
  doc.setPage(pageCount)
  doc.setFontSize(8)
  doc.setTextColor(100, 100, 100)
  doc.text('PipeTooling', PAGE_MARGIN, 280)
  doc.setTextColor(0, 0, 0)

  return doc.output('blob')
}

async function buildPhysicalInvoicePdfBlobSimple(docModel: PhysicalInvoiceDocument): Promise<Blob> {
  const JsPDF = await loadJsPDF()
  const doc = new JsPDF({ unit: 'mm', format: 'letter' })
  let y = 20

  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Invoice', PAGE_MARGIN, y)
  y += 12

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text(`Amount due: ${docModel.amountFormatted}`, PAGE_MARGIN, y)
  y += 10

  y = drawLabelValue(doc, y, 'Bill to', docModel.customerName)
  y = drawLabelValue(doc, y, 'Email', docModel.customerEmail || '—')
  y += 2
  y = drawLabelValue(doc, y, 'Job', docModel.jobName)
  y = drawLabelValue(doc, y, 'Job #', docModel.hcpLabel)
  y = drawLabelValue(doc, y, 'Invoice date', docModel.invoiceDateDisplay)
  y = drawLabelValue(doc, y, 'Due date', docModel.dueDateDisplay)
  y += 4

  const bodyLineHeight = LINE_HEIGHT * 0.85
  if (docModel.lineDescription.trim()) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('Description', PAGE_MARGIN, y)
    y += LINE_HEIGHT
    doc.setFont('helvetica', 'normal')
    const descLines = doc.splitTextToSize(docModel.lineDescription, MAX_TEXT_WIDTH_MM)
    y = advanceYForWrappedLines(doc, y, descLines, bodyLineHeight)
    y += 6
  }

  if (docModel.memo) {
    if (y > PAGE_CONTENT_MAX_Y - 16) {
      doc.addPage()
      y = PAGE_MARGIN + 10
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('Memo', PAGE_MARGIN, y)
    y += LINE_HEIGHT
    doc.setFont('helvetica', 'normal')
    const memoLines = doc.splitTextToSize(docModel.memo, MAX_TEXT_WIDTH_MM)
    y = advanceYForWrappedLines(doc, y, memoLines, bodyLineHeight)
  }

  if (docModel.footer) {
    if (y > PAGE_CONTENT_MAX_Y - 16) {
      doc.addPage()
      y = PAGE_MARGIN + 10
    }
    y += 4
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const pageW = doc.internal.pageSize.getWidth()
    const contentW = contentTextWidthMm(pageW)
    const footerLines = doc.splitTextToSize(docModel.footer, contentW)
    y = advanceYForWrappedLines(doc, y, footerLines, bodyLineHeight)
  }

  drawPageFooters(doc)

  const pageCount = doc.getNumberOfPages()
  doc.setPage(pageCount)
  doc.setFontSize(8)
  doc.setTextColor(100, 100, 100)
  doc.text('PipeTooling', PAGE_MARGIN, 280)
  doc.setTextColor(0, 0, 0)

  return doc.output('blob')
}

export async function buildPhysicalInvoicePdfBlob(docModel: PhysicalInvoiceDocument): Promise<Blob> {
  if (docModel.layout === 'detailed') {
    return buildPhysicalInvoicePdfBlobDetailed(docModel)
  }
  return buildPhysicalInvoicePdfBlobSimple(docModel)
}

export async function physicalInvoicePdfToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

export function physicalInvoicePdfFilename(hcpNumber: string | null, invoiceDateYmd: string): string {
  const hcp = (hcpNumber ?? '').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 40) || 'job'
  const date = invoiceDateYmd.trim().replace(/[^0-9-]/g, '') || 'invoice'
  return `Invoice-${hcp}-${date}.pdf`
}
