import { describe, expect, it, vi } from 'vitest'
import { DEMAND_LETTER_FIT_STEPS, DEMAND_LETTER_SET, buildDemandLetterPdfBlob, type DemandLetterFields } from './demandLetter'

/**
 * The demand letter's PDF, through a recording stand-in for jsPDF (as `lienFilingDocuments.pdf.test.ts` does):
 * how many pages a drawing took and the type size its running text was set in, not the bytes.
 * Every text is one line here, so a letter's length is its count of notices.
 */
class FakeJsPDF {
  /** How many letters were drawn since a test last set it to 0: one, or one more per tighter setting tried. */
  static made = 0
  pages = 1
  size = 0
  texts: string[] = []
  textSizes: number[] = []
  textPages: number[] = []
  constructor() {
    FakeJsPDF.made += 1
  }
  setFont() {}
  setFontSize(n: number) {
    this.size = n
  }
  setTextColor() {}
  setDrawColor() {}
  setLineWidth() {}
  setPage() {}
  addPage() {
    this.pages += 1
  }
  getNumberOfPages() {
    return this.pages
  }
  splitTextToSize(t: string) {
    return [t]
  }
  text(t: string) {
    this.texts.push(t)
    this.textSizes.push(this.size)
    this.textPages.push(this.pages)
  }
  line() {}
  rect() {}
  addImage() {}
  /** The blob names the drawing it came from, so a test can tell which of several drawings was kept. */
  output() {
    const at = (start: string) => this.texts.findIndex((t) => t.startsWith(start))
    return new Blob([`pages=${this.pages} body=${this.textSizes[at('Unless payment in full')] ?? 0} signature=${this.textSizes[at('Sincerely,')] ?? 0} signed-on-page=${this.textPages[at('Sincerely,')] ?? 0}`])
  }
}
vi.mock('../loadJsPDF', () => ({ loadJsPDF: async () => FakeJsPDF }))

const TODAY = '2026-11-12'

/** A made-up letter of the short form, as long as its notices. */
function letter(notices: number): DemandLetterFields {
  return {
    businessName: 'Sample Plumbing Co.',
    senderName: 'The office',
    businessAddress: 'Sample Plumbing Co.\nKyle, TX',
    businessPhone: '(512) 555-0100',
    businessEmail: 'office@example.com',
    recipientName: 'Sam Sample',
    recipientEmail: 'sam@example.com',
    recipientAddress: '100 Sample St\nKyle, TX 78640',
    invoiceNumber: '1042',
    invoiceDate: '2026-09-21',
    serviceDescription: 'Replace a water heater',
    invoiceTotal: '1850.00',
    paymentsReceived: '0.00',
    outstanding: '1850.00',
    deadlineDate: '2026-11-22',
    paymentMethod: '',
    includeSmallClaims: true,
    includeLien: false,
    lienFilingDeadline: '',
    includeTheftOfServices: false,
    includeLateFees: false,
    includeNotarial: false,
    priorNotices: Array.from({ length: notices }, (_, i) => ({ date: '2026-10-05', label: `Reminder ${i + 1} emailed` })),
  }
}

async function drawn(notices: number): Promise<{ words: string; made: number }> {
  FakeJsPDF.made = 0
  const blob = await buildDemandLetterPdfBlob(letter(notices), TODAY)
  return { words: await blob.text(), made: FakeJsPDF.made }
}

describe('the demand letter on one page (v2.7080)', () => {
  it('a letter that fits is drawn once, at the usual setting', async () => {
    expect(await drawn(4)).toEqual({ words: 'pages=1 body=11 signature=11 signed-on-page=1', made: 1 })
  })

  it('a letter that spills a little is drawn again with closer lines, at the same type size', async () => {
    // At the usual setting this letter put its signature on a second page.
    expect(await drawn(5)).toEqual({ words: 'pages=1 body=11 signature=11 signed-on-page=1', made: 2 })
    expect(DEMAND_LETTER_FIT_STEPS[0]!.size).toBe(DEMAND_LETTER_SET.size)
    expect(DEMAND_LETTER_FIT_STEPS[0]!.line).toBeLessThan(DEMAND_LETTER_SET.line)
  })

  it('a longer one steps the type down, and never below 10 pt', async () => {
    expect(await drawn(7)).toEqual({ words: 'pages=1 body=10.5 signature=10.5 signed-on-page=1', made: 3 })
    expect(await drawn(8)).toEqual({ words: 'pages=1 body=10 signature=10 signed-on-page=1', made: 4 })
    expect(Math.min(...DEMAND_LETTER_FIT_STEPS.map((s) => s.size))).toBe(10)
    // Each step is tighter than the one before it.
    const ladder = [DEMAND_LETTER_SET, ...DEMAND_LETTER_FIT_STEPS]
    for (let i = 1; i < ladder.length; i += 1) {
      expect(ladder[i]!.size).toBeLessThanOrEqual(ladder[i - 1]!.size)
      expect(ladder[i]!.line).toBeLessThan(ladder[i - 1]!.line)
    }
  })

  it('a letter no step holds on one page keeps the usual setting on its two pages', async () => {
    expect(await drawn(9)).toEqual({ words: 'pages=2 body=11 signature=11 signed-on-page=2', made: 4 })
    expect(await drawn(40)).toEqual({ words: 'pages=2 body=11 signature=11 signed-on-page=2', made: 4 })
  })
})
