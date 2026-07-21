import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import type { HazmatIncidentDraft } from '../hazmatFee'
import type { HazmatNoticeJobInfo } from './hazmatFeeNotice'
import { loadJsPDF } from '../loadJsPDF'

/**
 * PDF twin of the printable Biohazard Remediation Fee Notice
 * (`hazmatFeeNotice.ts` builds the HTML window variant; this builds a real PDF
 * for email attachments and downloads). A pure block model keeps the content
 * testable without jsPDF; the renderer walks the blocks with a paging cursor.
 */

export type HazmatNoticePdfBlock =
  | { kind: 'title'; text: string }
  | { kind: 'meta'; text: string }
  | { kind: 'fee'; text: string }
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'link'; label: string; url: string }
  | { kind: 'statement'; who: string; body: string }
  | { kind: 'clause'; text: string }

export function formatHazmatIncidentDateTime(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('en-US', { timeZone: APP_CALENDAR_TZ })
}

export function buildHazmatFeeNoticePdfModel(
  job: HazmatNoticeJobInfo,
  draft: HazmatIncidentDraft,
): HazmatNoticePdfBlock[] {
  const fee = draft.feeAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
  const blocks: HazmatNoticePdfBlock[] = [
    { kind: 'title', text: 'Biohazard Remediation Fee Notice' },
    { kind: 'meta', text: `Job ${job.jobNumber} — ${job.jobName}` },
    { kind: 'meta', text: job.jobAddress },
    { kind: 'meta', text: `Customer: ${job.customerName}` },
    { kind: 'fee', text: `Fee: ${fee}` },
    { kind: 'heading', text: 'Incident' },
    {
      kind: 'meta',
      text:
        `Date/time: ${formatHazmatIncidentDateTime(draft.incidentAt)}` +
        (draft.stageLabel ? ` · Stage: ${draft.stageLabel}` : ''),
    },
  ]
  if (draft.exposedPeople.trim()) {
    blocks.push({ kind: 'meta', text: `Personnel exposed: ${draft.exposedPeople}` })
  }
  blocks.push({ kind: 'paragraph', text: draft.description })
  blocks.push({ kind: 'heading', text: 'Photographic evidence' })
  draft.photoLinks.forEach((url, i) => {
    blocks.push({ kind: 'link', label: `Photo ${i + 1}: ${url}`, url })
  })
  blocks.push({ kind: 'heading', text: 'Technician statements' })
  for (const t of draft.testimonials) {
    const given = new Date(t.givenAt)
    const givenStr = Number.isNaN(given.getTime())
      ? t.givenAt
      : given.toLocaleDateString('en-US', { timeZone: APP_CALENDAR_TZ })
    blocks.push({ kind: 'statement', who: `${t.name} — ${givenStr}`, body: t.statement })
  }
  blocks.push({ kind: 'heading', text: 'Contractual basis' })
  blocks.push({ kind: 'clause', text: draft.tosClauseSnapshot })
  blocks.push({
    kind: 'meta',
    text:
      'The clause above is reproduced verbatim from the Click Plumbing and Electrical Terms & Conditions in effect at the time this notice was generated (clickplumbing.com/terms).',
  })
  return blocks
}

export function hazmatNoticePdfFilename(job: HazmatNoticeJobInfo): string {
  const slug = job.jobNumber.replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'job'
  return `biohazard-remediation-fee-notice-${slug}.pdf`
}

const PAGE_MARGIN = 18
const MAX_TEXT_WIDTH_MM = 180
const PAGE_CONTENT_MAX_Y = 265

export async function buildHazmatFeeNoticePdfBlob(
  job: HazmatNoticeJobInfo,
  draft: HazmatIncidentDraft,
): Promise<Blob> {
  const JsPDF = await loadJsPDF()
  const doc = new JsPDF({ unit: 'mm', format: 'letter' })
  let y = PAGE_MARGIN + 4

  const ensureRoom = (needed: number) => {
    if (y + needed > PAGE_CONTENT_MAX_Y) {
      doc.addPage()
      y = PAGE_MARGIN
    }
  }

  const writeWrapped = (text: string, lineHeight: number, indent = 0) => {
    const lines = doc.splitTextToSize(text, MAX_TEXT_WIDTH_MM - indent) as string[]
    for (const line of lines) {
      ensureRoom(lineHeight)
      doc.text(line, PAGE_MARGIN + indent, y)
      y += lineHeight
    }
  }

  for (const block of buildHazmatFeeNoticePdfModel(job, draft)) {
    switch (block.kind) {
      case 'title':
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(15)
        writeWrapped(block.text, 7)
        y += 1
        break
      case 'meta':
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(75, 85, 99)
        writeWrapped(block.text, 4.5)
        doc.setTextColor(17, 24, 39)
        break
      case 'fee':
        y += 2
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(12)
        writeWrapped(block.text, 6)
        break
      case 'heading':
        y += 4
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        ensureRoom(10)
        writeWrapped(block.text, 5.5)
        doc.setDrawColor(209, 213, 219)
        doc.line(PAGE_MARGIN, y - 3.5, PAGE_MARGIN + MAX_TEXT_WIDTH_MM, y - 3.5)
        y += 1
        break
      case 'paragraph':
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        writeWrapped(block.text, 5)
        y += 1
        break
      case 'link': {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(37, 99, 235)
        const lines = doc.splitTextToSize(block.label, MAX_TEXT_WIDTH_MM - 4) as string[]
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i] ?? ''
          ensureRoom(4.5)
          if (i === 0) {
            doc.textWithLink(line, PAGE_MARGIN + 4, y, { url: block.url })
          } else {
            doc.text(line, PAGE_MARGIN + 4, y)
          }
          y += 4.5
        }
        doc.setTextColor(17, 24, 39)
        break
      }
      case 'statement':
        y += 1
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9.5)
        writeWrapped(block.who, 4.5, 4)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        writeWrapped(block.body, 5, 4)
        break
      case 'clause':
        y += 1
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        writeWrapped(block.text, 4.5, 2)
        y += 1
        break
    }
  }

  return doc.output('blob')
}
