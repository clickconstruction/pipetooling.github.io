import { loadJsPDF } from '../loadJsPDF'
import { demandDate, demandMoney } from './demandLetter'

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
  | { kind: 'title'; lines: string[] }
  | { kind: 'jurisdiction'; county: string }
  | { kind: 'formLine'; label: string; value: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'numbered'; n: number; text: string }
  | { kind: 'signature'; lines: string[] }
  | { kind: 'notarial'; who: string }

function esc(s: string): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function filingDocHtml(blocks: FilingDocBlock[]): string {
  const parts: string[] = []
  for (const b of blocks) {
    switch (b.kind) {
      case 'title':
        parts.push(`<p style="text-align:center;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;margin:0 0 1em">${b.lines.map(esc).join('<br/>')}</p>`)
        break
      case 'jurisdiction':
        parts.push(`<p style="margin:0 0 0.9em"><strong>STATE OF TEXAS</strong><br/><strong>COUNTY OF ${esc(b.county.toUpperCase() || '___________')}</strong></p>`)
        break
      case 'formLine':
        parts.push(`<p style="margin:0 0 0.55em">${esc(b.label)} <strong>${b.value ? esc(b.value) : '_______________'}</strong></p>`)
        break
      case 'paragraph':
        parts.push(`<p style="margin:0 0 0.75em">${esc(b.text)}</p>`)
        break
      case 'numbered':
        parts.push(`<p style="margin:0 0 0.75em">${b.n}. ${esc(b.text)}</p>`)
        break
      case 'signature':
        parts.push(`<p style="margin:2em 0 0">______________________________<br/>${b.lines.map(esc).join('<br/>')}</p>`)
        break
      case 'notarial':
        parts.push(
          `<p style="margin:2.2em 0 0">STATE OF TEXAS<br/>COUNTY OF ___________</p>` +
            `<p style="margin:0.8em 0 0">SWORN TO AND SUBSCRIBED BEFORE ME on this _____ day of _____________, ______, by ${esc(b.who || '_______________')}.</p>` +
            `<p style="margin:1.6em 0 0">________________________________<br/>Notary Public, State of Texas</p>`,
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
    }
  }
  return out.join('\n\n')
}

/** Full standalone print document — pinned light like all customer-facing paper. */
export function filingDocPrintHtml(blocks: FilingDocBlock[], docTitle: string): string {
  return `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><title>${esc(docTitle)}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; background: #fff; max-width: 42rem; margin: 2.5rem auto; padding: 0 1.5rem; font-size: 0.95rem; line-height: 1.75; }
  @media print { body { margin: 0.5in auto; } }
</style></head><body>${filingDocHtml(blocks)}</body></html>`
}

const PAGE_MARGIN = 22
const MAX_TEXT_WIDTH_MM = 172
const PAGE_CONTENT_MAX_Y = 265

export async function filingDocPdfBlob(blocks: FilingDocBlock[]): Promise<Blob> {
  const JsPDF = await loadJsPDF()
  const doc = new JsPDF({ unit: 'mm', format: 'letter' })
  let y = PAGE_MARGIN + 6
  const ensureRoom = (needed: number) => {
    if (y + needed > PAGE_CONTENT_MAX_Y) {
      doc.addPage()
      y = PAGE_MARGIN
    }
  }
  const write = (text: string, lh: number, opts?: { center?: boolean; bold?: boolean; size?: number }) => {
    doc.setFont('times', opts?.bold ? 'bold' : 'normal')
    doc.setFontSize(opts?.size ?? 11.5)
    const lines = doc.splitTextToSize(text, MAX_TEXT_WIDTH_MM) as string[]
    for (const line of lines) {
      ensureRoom(lh)
      if (opts?.center) doc.text(line, PAGE_MARGIN + MAX_TEXT_WIDTH_MM / 2, y, { align: 'center' })
      else doc.text(line, PAGE_MARGIN, y)
      y += lh
    }
  }
  for (const b of blocks) {
    switch (b.kind) {
      case 'title':
        for (const l of b.lines) write(l.toUpperCase(), 7, { center: true, bold: true, size: 13.5 })
        y += 4
        break
      case 'jurisdiction':
        write('STATE OF TEXAS', 6, { bold: true })
        write(`COUNTY OF ${b.county.toUpperCase() || '___________'}`, 6, { bold: true })
        y += 3
        break
      case 'formLine':
        write(`${b.label} ${b.value || '_______________'}`, 6.4)
        break
      case 'paragraph':
        write(b.text, 6.2)
        y += 2.5
        break
      case 'numbered':
        write(`${b.n}. ${b.text}`, 6.2)
        y += 2.5
        break
      case 'signature':
        y += 10
        ensureRoom(20)
        doc.setDrawColor(26, 26, 26)
        doc.line(PAGE_MARGIN, y, PAGE_MARGIN + 75, y)
        y += 5
        for (const l of b.lines) write(l, 5.6)
        break
      case 'notarial':
        y += 8
        write('STATE OF TEXAS', 5.6)
        write('COUNTY OF ___________', 5.6)
        y += 3
        write(`SWORN TO AND SUBSCRIBED BEFORE ME on this _____ day of _____________, ______, by ${b.who || '_______________'}.`, 6)
        y += 10
        ensureRoom(14)
        doc.line(PAGE_MARGIN, y, PAGE_MARGIN + 75, y)
        y += 5
        write('Notary Public, State of Texas', 5.6)
        break
    }
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
  contactPerson: string
  claimantAddress: string
}

/** The § 53.056(a-2) form, verbatim — values are the only variable part. */
export function buildLienNoticeBlocks(f: LienNoticeFields): FilingDocBlock[] {
  return [
    { kind: 'title', lines: ['Notice of Claim for Unpaid Labor or Materials', '(Tex. Prop. Code § 53.056)'] },
    { kind: 'formLine', label: 'Date:', value: demandDate(f.noticeDate) },
    { kind: 'formLine', label: 'Project description and/or address:', value: f.projectDescription.trim() },
    { kind: 'formLine', label: "Claimant's name:", value: f.claimantName.trim() },
    { kind: 'formLine', label: 'Type of labor or materials provided:', value: f.laborMaterialsType.trim() },
    { kind: 'formLine', label: "Original contractor's name:", value: f.originalContractorName.trim() },
    {
      kind: 'formLine',
      label: 'Party with whom claimant contracted if different from original contractor:',
      value: f.contractedWithIfDifferent.trim() || '—',
    },
    { kind: 'formLine', label: 'Claim amount:', value: demandMoney(f.claimAmount) },
    { kind: 'formLine', label: "(Claimant's contact person)", value: f.contactPerson.trim() },
    { kind: 'formLine', label: "(Claimant's address)", value: f.claimantAddress.trim() },
  ]
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

export function buildLienAffidavitBlocks(f: LienAffidavitFields): FilingDocBlock[] {
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
  return blocks
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

export function buildReleaseOfRecordBlocks(f: ReleaseOfRecordFields): FilingDocBlock[] {
  return [
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
  ]
}

export function filingPdfFilename(kind: string, jobNumber: string): string {
  const slug = jobNumber.replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'job'
  return `${kind.replace(/_/g, '-')}-${slug}.pdf`
}
