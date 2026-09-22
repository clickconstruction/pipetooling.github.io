import { loadJsPDF } from '../loadJsPDF'
import { demandDate, demandMoney, letterheadContactLines } from './demandLetter'

/**
 * The three statutory lien instruments (v2.2645, Lien Instruments phase 3):
 *
 * 1. § 53.056 NOTICE OF CLAIM — the statute's (a-2) form rendered VERBATIM;
 *    the blanks are the only thing the app fills.
 * 2. § 53.054 LIEN AFFIDAVIT — the ten-paragraph sworn affidavit (claimant,
 *    property w/ legal description, contracted-with, work, period, owner +
 *    mailing, original contractor, amounts, notices sworn, lien claimed) with
 *    the notarial block.
 * 3. RELEASE OF RECORDED LIEN — releases a specific recorded instrument
 *    (county + recording number + filing date), notarized for re-filing.
 *
 * Pure paragraph models → HTML / text / print / PDF via one shared walker.
 * Wording ships to the attorney package with the demand letter; sworn text is
 * never free-edited per send.
 */

// ---------- shared block model ----------

export type FilingDocBlock =
  | { kind: 'letterhead'; company: string; licenseLine: string; contactLines: string[] }
  | { kind: 'refstrip'; items: string[] }
  | { kind: 'title'; lines: string[] }
  | { kind: 'jurisdiction'; county: string }
  /** `field` names the fields key the value came from (v2.3522) — the preview marks it; print and PDF ignore it. `ghost` (v2.3694): an optional line the desk shows empty so it can be typed; never emitted for print. */
  | { kind: 'formLine'; label: string; value: string; field?: string; ghost?: boolean }
  | { kind: 'paragraph'; text: string }
  | { kind: 'numbered'; n: number; text: string }
  | { kind: 'signature'; lines: string[] }
  | { kind: 'notarial'; who: string }
  | { kind: 'deliveryRecord'; lines: string[] }

/**
 * Dressing around the statutory text (v2.2663): the issuer letterhead, the
 * job/date reference strip, and the recorded-sends box. All optional — the
 * statutory blocks are unchanged with or without them (§ 53.056(a-2) requires
 * the notice be "substantially" in the prescribed form; these are the same
 * dressing a law firm's letterhead would add).
 */
export type FilingDocExtras = {
  letterhead?: { company: string; licenseLine: string; contactLines: string[] }
  refItems?: string[]
  deliveryLines?: string[]
}

function prependExtras(blocks: FilingDocBlock[], extras?: FilingDocExtras): FilingDocBlock[] {
  const head: FilingDocBlock[] = []
  if (extras?.letterhead && extras.letterhead.company.trim()) head.push({ kind: 'letterhead', ...extras.letterhead })
  if (extras?.refItems && extras.refItems.length > 0) head.push({ kind: 'refstrip', items: extras.refItems })
  const tail: FilingDocBlock[] = []
  if (extras?.deliveryLines && extras.deliveryLines.length > 0) tail.push({ kind: 'deliveryRecord', lines: extras.deliveryLines })
  return [...head, ...blocks, ...tail]
}

function esc(s: string): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const HTML_MUTED = '#7a756c'
/** Letterhead return address (v2.3474): a shade darker than labels — it is the reply address, not a footnote. */
const HTML_CONTACT = '#5f5a52'
const HTML_RULE = '#cfcbc2'
const HTML_LABEL_FONT = "font-family:'Helvetica Neue',Arial,sans-serif"

/**
 * The desk's marks on a form line (v2.3694): a `typed` value sits in a shaded box the office
 * clicks to change on the paper; `locked` is the same value once the notice has left drafted;
 * `derived` carries only a title saying where it is filled from. Print and PDF pass no marks
 * and get the statute's plain form.
 */
export type FilingFieldMark = { kind: 'typed' | 'locked' | 'derived'; changed?: boolean; title?: string }
export type FilingDocHtmlOptions = { marks?: Readonly<Record<string, FilingFieldMark>> }

const MARK_BOX = 'display:inline-block;max-width:100%;box-sizing:border-box;padding:0.1em 0.5em;border-radius:5px;'
const MARK_STYLE: Record<'typed' | 'typedChanged' | 'locked' | 'ghost', string> = {
  typed: `${MARK_BOX}background:#fffbeb;border:1px solid #fde68a;cursor:text`,
  typedChanged: `${MARK_BOX}background:#fef3c7;border:1px solid #f59e0b;cursor:text`,
  locked: `${MARK_BOX}background:#f3f4f6;border:1px dotted #9ca3af;color:#374151;cursor:not-allowed`,
  ghost: `${MARK_BOX}background:#fafafa;border:1px dashed #d1d5db;color:#9ca3af;font-style:italic;font-weight:400;cursor:text`,
}

export function filingDocHtml(blocks: FilingDocBlock[], opts?: FilingDocHtmlOptions): string {
  const parts: string[] = []
  for (const b of blocks) {
    switch (b.kind) {
      case 'letterhead':
        parts.push(
          `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1.5rem;margin:0 0 0.5em">` +
            `<div><div style="font-weight:700;font-size:1.12em">${esc(b.company)}</div>` +
            (b.licenseLine ? `<div style="${HTML_LABEL_FONT};font-size:0.72em;color:${HTML_MUTED};margin-top:0.15em">${esc(b.licenseLine)}</div>` : '') +
            `</div>` +
            `<div style="${HTML_LABEL_FONT};flex:0 0 auto;white-space:nowrap;text-align:right;font-size:0.8em;color:${HTML_CONTACT};line-height:1.45">${b.contactLines.map(esc).join('<br/>')}</div>` +
            `</div>`,
        )
        break
      case 'refstrip':
        parts.push(
          `<div style="${HTML_LABEL_FONT};display:flex;gap:1.4em;font-size:0.68em;color:${HTML_MUTED};letter-spacing:0.03em;text-transform:uppercase;border-top:1px solid ${HTML_RULE};border-bottom:1px solid ${HTML_RULE};padding:0.4em 0;margin:0 0 1.6em">${b.items.map((i) => `<span>${esc(i)}</span>`).join('')}</div>`,
        )
        break
      case 'title':
        parts.push(`<p style="text-align:center;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;margin:0 0 1em">${b.lines.map(esc).join('<br/>')}</p>`)
        break
      case 'jurisdiction':
        parts.push(`<p style="margin:0 0 0.9em"><strong>STATE OF TEXAS</strong><br/><strong>COUNTY OF ${esc(b.county.toUpperCase() || '___________')}</strong></p>`)
        break
      case 'formLine': {
        const mark = b.field ? opts?.marks?.[b.field] : undefined
        if (b.ghost && (!mark || mark.kind !== 'typed')) break
        const editable = mark?.kind === 'typed'
        const attrs =
          (b.field ? ` data-field="${esc(b.field)}"` : '') +
          (mark ? ` data-editable="${mark.kind === 'typed' ? 'yes' : mark.kind === 'locked' ? 'locked' : 'no'}"` : '') +
          (mark?.changed ? ' data-changed="yes"' : '') +
          (b.ghost ? ' data-ghost="yes"' : '') +
          (mark?.title ? ` title="${esc(mark.title)}"` : '')
        const boxStyle = b.ghost ? MARK_STYLE.ghost : mark?.kind === 'typed' ? (mark.changed ? MARK_STYLE.typedChanged : MARK_STYLE.typed) : mark?.kind === 'locked' ? MARK_STYLE.locked : ''
        const text = b.ghost ? '+ add one — left off the paper until you type' : b.value ? esc(b.value) : '&nbsp;'
        const sub =
          mark?.changed && !b.ghost
            ? `<div data-field-sub="${esc(b.field ?? '')}" style="${HTML_LABEL_FONT};font-size:0.68em;font-weight:400;color:#92400e;margin-top:0.25em">changed from the job’s wording${editable ? ` · <button type="button" data-reset="${esc(b.field ?? '')}" style="font:inherit;color:#2563eb;background:none;border:none;padding:0;cursor:pointer;font-weight:600">Back to the job’s wording</button>` : ''}</div>`
            : ''
        parts.push(
          `<div style="display:flex;align-items:baseline;gap:1em;margin:0 0 0.55em">` +
            `<div style="${HTML_LABEL_FONT};flex:0 0 38%;font-size:0.72em;color:${HTML_MUTED}${b.ghost ? ';font-style:italic' : ''}">${esc(b.label)}</div>` +
            `<div${attrs} style="flex:1;font-weight:600;border-bottom:1px solid ${HTML_RULE};padding-bottom:0.15em;${b.value || b.ghost ? '' : `color:${HTML_MUTED};font-weight:400`}">` +
            (boxStyle ? `<span data-field-text style="${boxStyle}">${text}</span>` : text) +
            sub +
            `</div>` +
            `</div>`,
        )
        break
      }
      case 'paragraph':
        parts.push(`<p style="margin:0 0 0.75em">${esc(b.text)}</p>`)
        break
      case 'numbered':
        parts.push(`<p style="margin:0 0 0.75em">${b.n}. ${esc(b.text)}</p>`)
        break
      case 'signature':
        parts.push(
          `<div style="margin:2em 0 0;display:flex;justify-content:flex-end"><div style="width:46%">` +
            `<div style="border-bottom:1px solid currentColor;height:1.6em"></div>` +
            `<div style="${HTML_LABEL_FONT};font-size:0.72em;color:${HTML_MUTED};margin-top:0.3em">${b.lines.map(esc).join('<br/>')}</div>` +
            `</div></div>`,
        )
        break
      case 'notarial':
        parts.push(
          `<p style="margin:2.2em 0 0">STATE OF TEXAS<br/>COUNTY OF ___________</p>` +
            `<p style="margin:0.8em 0 0">SWORN TO AND SUBSCRIBED BEFORE ME on this _____ day of _____________, ______, by ${esc(b.who || '_______________')}.</p>` +
            `<p style="margin:1.6em 0 0">________________________________<br/>Notary Public, State of Texas</p>`,
        )
        break
      case 'deliveryRecord':
        parts.push(
          `<div style="${HTML_LABEL_FONT};margin:1.6em 0 0;border:1px solid ${HTML_RULE};padding:0.65em 0.9em;font-size:0.74em">` +
            `<div style="font-weight:700;font-size:0.85em;letter-spacing:0.09em;text-transform:uppercase;color:${HTML_MUTED};margin-bottom:0.35em">Delivery record</div>` +
            b.lines.map((l) => `<div>${esc(l)}</div>`).join('') +
            `</div>`,
        )
        break
    }
  }
  return parts.join('')
}

export function filingDocText(blocks: FilingDocBlock[]): string {
  const out: string[] = []
  for (const b of blocks) {
    switch (b.kind) {
      case 'letterhead':
        out.push([b.company, b.licenseLine, ...b.contactLines].filter((l) => l).join('\n'))
        break
      case 'refstrip':
        out.push(b.items.join(' · '))
        break
      case 'title':
        // The print/PDF render uppercase; the text twin matches.
        out.push(b.lines.map((l) => (l.startsWith('(') ? l : l.toUpperCase())).join('\n'))
        break
      case 'jurisdiction':
        out.push(`STATE OF TEXAS\nCOUNTY OF ${b.county.toUpperCase() || '___________'}`)
        break
      case 'formLine':
        out.push(`${b.label} ${b.value || '_______________'}`)
        break
      case 'paragraph':
        out.push(b.text)
        break
      case 'numbered':
        out.push(`${b.n}. ${b.text}`)
        break
      case 'signature':
        out.push(`______________________________\n${b.lines.join('\n')}`)
        break
      case 'notarial':
        out.push(
          `STATE OF TEXAS\nCOUNTY OF ___________\n\nSWORN TO AND SUBSCRIBED BEFORE ME on this _____ day of _____________, ______, by ${b.who || '_______________'}.\n\n________________________________\nNotary Public, State of Texas`,
        )
        break
      case 'deliveryRecord':
        out.push(`DELIVERY RECORD\n${b.lines.join('\n')}`)
        break
    }
  }
  return out.join('\n\n')
}

/** Full standalone print document — pinned light like all customer-facing paper. */
export function filingDocPrintHtml(blocks: FilingDocBlock[], docTitle: string, footer?: string): string {
  const footerHtml = footer
    ? `<div style="${HTML_LABEL_FONT};margin-top:1.8em;padding-top:0.5em;border-top:1px solid ${HTML_RULE};font-size:0.68em;color:${HTML_MUTED}">${esc(footer)}</div>`
    : ''
  return `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><title>${esc(docTitle)}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; background: #fff; max-width: 44rem; margin: 2.5rem auto; padding: 0 1.5rem; font-size: 0.95rem; line-height: 1.75; }
  @media print { body { margin: 0.5in auto; } }
</style></head><body>${filingDocHtml(blocks)}${footerHtml}</body></html>`
}

const PAGE_MARGIN = 22
const MAX_TEXT_WIDTH_MM = 172
const PAGE_CONTENT_MAX_Y = 262
const RIGHT_EDGE = PAGE_MARGIN + MAX_TEXT_WIDTH_MM
const LABEL_COL_MM = 62
const VALUE_COL_X = PAGE_MARGIN + LABEL_COL_MM + 4
const VALUE_COL_MM = RIGHT_EDGE - VALUE_COL_X

const INK: [number, number, number] = [28, 26, 23]
const MUTED: [number, number, number] = [122, 117, 108]
const CONTACT: [number, number, number] = [95, 90, 82]
const RULE: [number, number, number] = [207, 203, 194]

export async function filingDocPdfBlob(blocks: FilingDocBlock[], opts?: { footer?: string }): Promise<Blob> {
  const JsPDF = await loadJsPDF()
  const doc = new JsPDF({ unit: 'mm', format: 'letter' })
  let y = PAGE_MARGIN
  const ensureRoom = (needed: number) => {
    if (y + needed > PAGE_CONTENT_MAX_Y) {
      doc.addPage()
      y = PAGE_MARGIN
    }
  }
  const write = (text: string, lh: number, opt?: { center?: boolean; bold?: boolean; size?: number; sans?: boolean; muted?: boolean; x?: number; width?: number }) => {
    doc.setFont(opt?.sans ? 'helvetica' : 'times', opt?.bold ? 'bold' : 'normal')
    doc.setFontSize(opt?.size ?? 11.5)
    doc.setTextColor(...(opt?.muted ? MUTED : INK))
    const lines = doc.splitTextToSize(text, opt?.width ?? MAX_TEXT_WIDTH_MM) as string[]
    for (const line of lines) {
      ensureRoom(lh)
      if (opt?.center) doc.text(line, PAGE_MARGIN + MAX_TEXT_WIDTH_MM / 2, y, { align: 'center' })
      else doc.text(line, opt?.x ?? PAGE_MARGIN, y)
      y += lh
    }
  }
  for (const b of blocks) {
    switch (b.kind) {
      case 'letterhead': {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(13)
        doc.setTextColor(...INK)
        doc.text(b.company, PAGE_MARGIN, y + 4.5)
        let leftY = y + 4.5
        if (b.licenseLine) {
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(7.5)
          doc.setTextColor(...MUTED)
          leftY += 4
          doc.text(b.licenseLine, PAGE_MARGIN, leftY)
        }
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(...CONTACT)
        let rightY = y + 3
        for (const l of b.contactLines) {
          doc.text(l, RIGHT_EDGE, rightY, { align: 'right' })
          rightY += 3.7
        }
        y = Math.max(leftY, rightY - 3.7) + 5
        break
      }
      case 'refstrip': {
        doc.setDrawColor(...RULE)
        doc.setLineWidth(0.25)
        doc.line(PAGE_MARGIN, y, RIGHT_EDGE, y)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.setTextColor(...MUTED)
        doc.text(b.items.map((i) => i.toUpperCase()).join('     ·     '), PAGE_MARGIN, y + 4)
        doc.line(PAGE_MARGIN, y + 6.2, RIGHT_EDGE, y + 6.2)
        y += 13
        break
      }
      case 'title':
        for (const l of b.lines) write(l.toUpperCase(), 7, { center: true, bold: true, size: 13.5 })
        y += 4
        break
      case 'jurisdiction':
        write('STATE OF TEXAS', 6, { bold: true })
        write(`COUNTY OF ${b.county.toUpperCase() || '___________'}`, 6, { bold: true })
        y += 3
        break
      case 'formLine': {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.5)
        const labelLines = doc.splitTextToSize(b.label, LABEL_COL_MM) as string[]
        doc.setFont('times', b.value ? 'bold' : 'normal')
        doc.setFontSize(11)
        const valueLines = doc.splitTextToSize(b.value || ' ', VALUE_COL_MM) as string[]
        const rows = Math.max(labelLines.length, valueLines.length)
        const rowH = 5.2
        ensureRoom(rows * rowH + 3)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.5)
        doc.setTextColor(...MUTED)
        labelLines.forEach((l, i) => doc.text(l, PAGE_MARGIN, y + i * rowH))
        doc.setFont('times', b.value ? 'bold' : 'normal')
        doc.setFontSize(11)
        doc.setTextColor(...INK)
        valueLines.forEach((l, i) => doc.text(l, VALUE_COL_X, y + i * rowH))
        const underY = y + (rows - 1) * rowH + 1.6
        doc.setDrawColor(...RULE)
        doc.setLineWidth(0.25)
        doc.line(VALUE_COL_X, underY, RIGHT_EDGE, underY)
        y = underY + 5
        break
      }
      case 'paragraph':
        write(b.text, 6.2)
        y += 2.5
        break
      case 'numbered':
        write(`${b.n}. ${b.text}`, 6.2)
        y += 2.5
        break
      case 'signature': {
        y += 10
        ensureRoom(20)
        const sigX = RIGHT_EDGE - 78
        doc.setDrawColor(...INK)
        doc.setLineWidth(0.3)
        doc.line(sigX, y, RIGHT_EDGE, y)
        y += 4.5
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.5)
        doc.setTextColor(...MUTED)
        for (const l of b.lines) {
          ensureRoom(4)
          doc.text(l, sigX, y)
          y += 3.8
        }
        break
      }
      case 'notarial':
        y += 8
        write('STATE OF TEXAS', 5.6)
        write('COUNTY OF ___________', 5.6)
        y += 3
        write(`SWORN TO AND SUBSCRIBED BEFORE ME on this _____ day of _____________, ______, by ${b.who || '_______________'}.`, 6)
        y += 10
        ensureRoom(14)
        doc.setDrawColor(...INK)
        doc.line(PAGE_MARGIN, y, PAGE_MARGIN + 75, y)
        y += 5
        write('Notary Public, State of Texas', 5.6)
        break
      case 'deliveryRecord': {
        const lineH = 4.3
        const boxH = 6.5 + b.lines.length * lineH + 2
        y += 5
        ensureRoom(boxH + 2)
        doc.setDrawColor(...RULE)
        doc.setLineWidth(0.25)
        doc.rect(PAGE_MARGIN, y, MAX_TEXT_WIDTH_MM, boxH)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(6.8)
        doc.setTextColor(...MUTED)
        doc.text('DELIVERY RECORD', PAGE_MARGIN + 4, y + 4.6)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8.2)
        doc.setTextColor(...INK)
        b.lines.forEach((l, i) => doc.text(l, PAGE_MARGIN + 4, y + 9 + i * lineH))
        y += boxH + 4
        break
      }
    }
  }
  // Page footer: statute citation left, page number right, on every page.
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setDrawColor(...RULE)
    doc.setLineWidth(0.25)
    doc.line(PAGE_MARGIN, 268, RIGHT_EDGE, 268)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)
    if (opts?.footer) doc.text(opts.footer, PAGE_MARGIN, 272)
    doc.text(`Page ${p} of ${pages}`, RIGHT_EDGE, 272, { align: 'right' })
  }
  return doc.output('blob')
}

// ---------- 1 · § 53.056 notice ----------

export type LienNoticeFields = {
  /** YYYY-MM-DD */
  noticeDate: string
  projectDescription: string
  claimantName: string
  laborMaterialsType: string
  originalContractorName: string
  /** '' when the claimant contracted directly with the original contractor. */
  contractedWithIfDifferent: string
  claimAmount: string
  /** "July 2026 $0.00 · August 2026 $5,900.00" — printed only when a person gave a month its own figure (v2.3682). */
  claimSplit?: string
  contactPerson: string
  claimantAddress: string
}

/** The § 53.056(a-2) form, verbatim — values are the only variable part. `ghostOptional` (v2.3694): the desk shows the blank optional line so it can be typed; print never asks for it. */
export function buildLienNoticeBlocks(f: LienNoticeFields, extras?: FilingDocExtras, opts?: { ghostOptional?: boolean }): FilingDocBlock[] {
  const blocks: FilingDocBlock[] = [
    { kind: 'title', lines: ['Notice of Claim for Unpaid Labor or Materials', '(Tex. Prop. Code § 53.056)'] },
    { kind: 'formLine', label: 'Date:', value: demandDate(f.noticeDate), field: 'noticeDate' },
    { kind: 'formLine', label: 'Project description and/or address:', value: f.projectDescription.trim(), field: 'projectDescription' },
    { kind: 'formLine', label: "Claimant's name:", value: f.claimantName.trim(), field: 'claimantName' },
    { kind: 'formLine', label: 'Type of labor or materials provided:', value: f.laborMaterialsType.trim(), field: 'laborMaterialsType' },
    { kind: 'formLine', label: "Original contractor's name:", value: f.originalContractorName.trim(), field: 'originalContractorName' },
    // Included only when it applies (owner decision 2026-09-02): blank means
    // the claimant contracted with the original contractor directly, and the
    // inapplicable prescribed line is omitted rather than rendered empty.
    ...(f.contractedWithIfDifferent.trim()
      ? [
          {
            kind: 'formLine',
            label: 'Party with whom claimant contracted if different from original contractor:',
            value: f.contractedWithIfDifferent.trim(),
            field: 'contractedWithIfDifferent',
          } as FilingDocBlock,
        ]
      : opts?.ghostOptional
        ? [{ kind: 'formLine', label: 'Party with whom claimant contracted, if different:', value: '', field: 'contractedWithIfDifferent', ghost: true } as FilingDocBlock]
        : []),
    { kind: 'formLine', label: 'Claim amount:', value: demandMoney(f.claimAmount), field: 'claimAmount' },
    ...((f.claimSplit ?? '').trim() ? [{ kind: 'formLine', label: 'Of which, by month:', value: (f.claimSplit ?? '').trim(), field: 'claimSplit' } as FilingDocBlock] : []),
    { kind: 'formLine', label: "(Claimant's contact person)", value: f.contactPerson.trim(), field: 'contactPerson' },
    { kind: 'formLine', label: "(Claimant's address)", value: f.claimantAddress.trim(), field: 'claimantAddress' },
    { kind: 'signature', lines: [f.contactPerson.trim(), f.claimantName.trim()].filter((l) => l) },
  ]
  return prependExtras(blocks, extras)
}

// ---------- 2 · § 53.054 affidavit ----------

export type LienAffidavitFields = {
  county: string
  claimantPersonName: string
  claimantCompany: string
  claimantAddress: string
  legalDescription: string
  propertyAddress: string
  /** The party the labor/materials were furnished under contract with. */
  contractedWithName: string
  workDescription: string
  /** YYYY-MM-DD */
  workStart: string
  workEnd: string
  ownerName: string
  ownerAddress: string
  originalContractorName: string
  originalContractorAddress: string
  contractAmount: string
  paidAmount: string
  unpaidAmount: string
  /** ¶9 — sworn only when notices are recorded (subs) or not required (originals). */
  includeNoticesSworn: boolean
}

export function buildLienAffidavitBlocks(f: LienAffidavitFields, extras?: FilingDocExtras): FilingDocBlock[] {
  const unpaid = demandMoney(f.unpaidAmount)
  const blocks: FilingDocBlock[] = [
    { kind: 'title', lines: ["Mechanic's and Materialman's Lien Affidavit"] },
    { kind: 'jurisdiction', county: f.county },
    {
      kind: 'paragraph',
      text: `BEFORE ME, the undersigned authority, on this day personally appeared ${f.claimantPersonName.trim() || '_______________'}, who being by me duly sworn, upon oath states the following:`,
    },
    {
      kind: 'numbered',
      n: 1,
      text: `My name is ${f.claimantPersonName.trim() || '_______________'}. I am authorized to make this affidavit on behalf of ${f.claimantCompany.trim() || '_______________'} ("Claimant"), located at ${f.claimantAddress.trim() || '_______________'}.`,
    },
    {
      kind: 'numbered',
      n: 2,
      text: `Claimant furnished labor and/or materials for the improvement of the following described property in ${f.county.trim() || '_______'} County, Texas — Legal description: ${f.legalDescription.trim() || '_______________'}; Property address: ${f.propertyAddress.trim() || '_______________'}.`,
    },
    { kind: 'numbered', n: 3, text: `The labor and/or materials were furnished under a contract with ${f.contractedWithName.trim() || '_______________'}.` },
    { kind: 'numbered', n: 4, text: `The kind of work and/or materials furnished by Claimant was: ${f.workDescription.trim() || '_______________'}.` },
    {
      kind: 'numbered',
      n: 5,
      text: `The work was performed and/or materials delivered during the period from ${demandDate(f.workStart)} through ${demandDate(f.workEnd)}.`,
    },
    {
      kind: 'numbered',
      n: 6,
      text: `The name and last known address of the owner or reputed owner of the land and improvements is: ${f.ownerName.trim() || '_______________'}, ${f.ownerAddress.trim() || '_______________'}.`,
    },
    {
      kind: 'numbered',
      n: 7,
      text: `The name and address of the original contractor is: ${f.originalContractorName.trim() || '_______________'}${f.originalContractorAddress.trim() ? `, ${f.originalContractorAddress.trim()}` : ''}.`,
    },
    {
      kind: 'numbered',
      n: 8,
      text: `The original contract amount was ${demandMoney(f.contractAmount)}. The amount paid to date is ${demandMoney(f.paidAmount)}. The amount currently due and unpaid is ${unpaid}.`,
    },
  ]
  let n = 9
  if (f.includeNoticesSworn) {
    blocks.push({
      kind: 'numbered',
      n,
      text: 'All statutory notices required by the Texas Property Code have been sent to the owner and/or original contractor in the time and manner required.',
    })
    n += 1
  }
  blocks.push({
    kind: 'numbered',
    n,
    text: `Claimant claims a lien against all the above described property and improvements thereon in the amount of ${unpaid}, together with all interest, costs, and attorney's fees allowed by law.`,
  })
  blocks.push({ kind: 'signature', lines: [f.claimantPersonName.trim(), f.claimantCompany.trim()].filter((l) => l) })
  blocks.push({ kind: 'notarial', who: f.claimantPersonName.trim() })
  return prependExtras(blocks, extras)
}

// ---------- 3 · release of recorded lien ----------

export type ReleaseOfRecordFields = {
  county: string
  claimantCompany: string
  claimantPersonName: string
  recordingNumber: string
  /** YYYY-MM-DD the affidavit was filed. */
  filedDate: string
  legalDescription: string
  propertyAddress: string
  ownerName: string
  /** YYYY-MM-DD payment/satisfaction date. */
  paymentDate: string
}

export function buildReleaseOfRecordBlocks(f: ReleaseOfRecordFields, extras?: FilingDocExtras): FilingDocBlock[] {
  return prependExtras([
    { kind: 'title', lines: ["Release of Mechanic's and Materialman's Lien"] },
    { kind: 'jurisdiction', county: f.county },
    {
      kind: 'paragraph',
      text: `${f.claimantCompany.trim() || '_______________'} ("Claimant") is the holder of a mechanic's and materialman's lien recorded under instrument number ${f.recordingNumber.trim() || '_______________'}, filed on ${demandDate(f.filedDate)} in the Official Public Records of ${f.county.trim() || '_______'} County, Texas, against the property of ${f.ownerName.trim() || '_______________'} described as: ${f.legalDescription.trim() || '_______________'} (${f.propertyAddress.trim() || '_______________'}).`,
    },
    {
      kind: 'paragraph',
      text: `Claimant acknowledges payment and satisfaction of the claim secured by the lien as of ${demandDate(f.paymentDate)}, and hereby fully and unconditionally RELEASES and DISCHARGES the above-referenced lien and all claims secured by it. The County Clerk is authorized to record this release against the referenced instrument.`,
    },
    { kind: 'signature', lines: [f.claimantPersonName.trim(), f.claimantCompany.trim()].filter((l) => l) },
    { kind: 'notarial', who: f.claimantPersonName.trim() },
  ], extras)
}

/** Letterhead extras from the shared invoice-issuer settings (company, license, contact). */
export function filingLetterheadFromIssuer(
  issuer: { companyName: string; addressText: string; phone: string; email: string; licenseLine: string } | null,
): FilingDocExtras['letterhead'] | undefined {
  const company = (issuer?.companyName ?? '').trim()
  if (!company) return undefined
  return {
    company,
    licenseLine: (issuer?.licenseLine ?? '').trim(),
    // v2.3474: line for line as typed — street, city/state/ZIP, phone, email.
    contactLines: letterheadContactLines(issuer?.addressText ?? '', issuer?.phone ?? '', issuer?.email ?? ''),
  }
}

/** Page-footer citation per instrument kind (PDF footer + print footer line). */
export function filingDocFooter(kind: 'notice_53_056' | 'affidavit' | 'release_of_record'): string {
  if (kind === 'notice_53_056') return 'Given pursuant to Texas Property Code § 53.056'
  if (kind === 'affidavit') return 'Filed pursuant to Texas Property Code §§ 53.052–53.055'
  return "Release of mechanic's lien — Texas Property Code, Chapter 53"
}

export function filingPdfFilename(kind: string, jobNumber: string): string {
  const slug = jobNumber.replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'job'
  return `${kind.replace(/_/g, '-')}-${slug}.pdf`
}
