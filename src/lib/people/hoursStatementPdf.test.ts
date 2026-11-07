/**
 * The signed hours statement as a PDF with its form (punch list #212, PR 3), on node_modules' pdf-lib: the paper draws
 * with its facts, the schema it records validates and places every box on a page it has, the stated block carries a
 * box per cell for the seeded rows and the blank ones, the signature block's three boxes sit on the last page, a long
 * statement runs to a second page, and the schema fills and flattens through `fillFormPdf` with nothing skipped.
 */
import { describe, expect, it } from 'vitest'
import * as pdfLib from 'pdf-lib'
import type { PdfLibLike } from '../../../supabase/functions/_shared/jobContractPdf'
import { buildFillPlan, validateFormSchema, validateFormValues } from '../forms/formSchema'
import { fillFormPdf, type FormPdfLibLike } from '../forms/fillFormPdf'
import { buildHoursStatement, type HoursStatementInput } from './hoursStatement'
import { HS_FORM_KEYS, HS_PDF_PAGE, buildHoursStatementPdf, pdfSafeText } from './hoursStatementPdf'
import { statedBoxKeys, statedSeedValues } from './hoursStatementForm'

// Every name, job and number here is made up.
const lib = pdfLib as unknown as PdfLibLike
const fillLib = pdfLib as unknown as FormPdfLibLike

const baseInput: HoursStatementInput = {
  kind: 'clock',
  periodStart: '2026-06-01',
  periodEnd: '2026-06-13',
  rows: [
    { day: '2026-06-01', hours: 8, note: 'Rough-in', inLabel: '7:00 am', outLabel: '3:30 pm' },
    { day: '2026-06-02', hours: 8, note: 'Rough-in on the second floor, the long way round the stair', inLabel: '7:00 am', outLabel: '3:30 pm' },
    { day: '2026-06-03', hours: 4, note: 'Water lines', inLabel: '7:00 am', outLabel: '11:00 am', pending: true },
    { day: '2026-06-08', hours: 7.5, note: 'Trim', inLabel: '7:30 am', outLabel: '3:00 pm' },
  ],
  withPay: true,
  dayRates: { '2026-06-01': 24, '2026-06-02': 24, '2026-06-08': 25 },
  payGroups: [
    { key: 'stub-1', label: 'Week of May 31', from: '2026-05-31', to: '2026-06-06', due: 500, payments: [{ on: '2026-06-12', amount: 500, memo: null, sourceKind: 'cashapp', sourceId: 'D-7K2M4Q' }] },
    { key: 'stub-2', label: 'Week of June 7', from: '2026-06-07', to: '2026-06-13', due: 600, payments: [] },
  ],
  firstRecordedDay: '2026-03-12',
  worker: { name: 'Marcus Reyes' },
}

function ctxFor(input: HoursStatementInput, recordId = 'HS-1042-0007') {
  return {
    statement: buildHoursStatement(input),
    recordId,
    worker: { name: 'Marcus Reyes', standing: 'helper' },
    job: { number: '1042', name: 'Ridgeway Lofts', customer: 'Ridgeway Builders', site: '12 Elm St, Austin TX 78701' },
    approvedBy: 'Dana Office',
    preparedBy: 'Dana Office',
    preparedOn: 'November 2, 2026',
    asOf: 'November 2, 2026 3:12 pm',
  }
}

async function textOf(bytes: Uint8Array): Promise<{ pages: number; title: string | undefined }> {
  const doc = await pdfLib.PDFDocument.load(bytes, { ignoreEncryption: true })
  return { pages: doc.getPageCount(), title: doc.getTitle() }
}

describe('the statement as a PDF (punch list #212, PR 3)', () => {
  it('draws one Letter page for a short statement, titled by the paper, with a valid schema whose boxes sit on it', async () => {
    const out = await buildHoursStatementPdf(lib, ctxFor(baseInput))
    expect(String.fromCharCode(...out.bytes.slice(0, 5))).toBe('%PDF-')
    const meta = await textOf(out.bytes)
    expect(meta.pages).toBe(1)
    expect(out.pageCount).toBe(1)
    expect(meta.title).toBe('Statement of hours worked and paid · Marcus Reyes · Job 1042 · June 1 – June 13, 2026')
    expect(out.schema.pages).toEqual([HS_PDF_PAGE])
    expect(validateFormSchema(out.schema)).toEqual([])
    for (const b of out.schema.boxes) {
      expect(b.page).toBe(1)
      expect(b.rect.x).toBeGreaterThanOrEqual(0)
      expect(b.rect.y).toBeGreaterThanOrEqual(0)
      expect(b.rect.x + b.rect.w).toBeLessThanOrEqual(HS_PDF_PAGE.width)
      expect(b.rect.y + b.rect.h).toBeLessThanOrEqual(HS_PDF_PAGE.height)
    }
  })

  it('with no gap and the switch off, the form is the signature block alone: the printed name, the signature and today’s date', async () => {
    const out = await buildHoursStatementPdf(lib, ctxFor(baseInput))
    expect(out.schema.boxes.map((b) => b.key).sort()).toEqual([HS_FORM_KEYS.printedName, HS_FORM_KEYS.signature, HS_FORM_KEYS.signedOn].sort())
    const name = out.schema.boxes.find((b) => b.key === HS_FORM_KEYS.printedName)!
    expect(name).toMatchObject({ type: 'text', required: true, prefill: 'person_name' })
    expect(out.schema.boxes.find((b) => b.key === HS_FORM_KEYS.signature)).toMatchObject({ type: 'signature', required: true })
    expect(out.schema.boxes.find((b) => b.key === HS_FORM_KEYS.signedOn)).toMatchObject({ type: 'date', dateMode: 'today' })
    // The three sit on one rule: the same bottom, left to right.
    const box = (k: string) => out.schema.boxes.find((b) => b.key === k)!
    const sig = box(HS_FORM_KEYS.signature)
    const pn = box(HS_FORM_KEYS.printedName)
    const dt = box(HS_FORM_KEYS.signedOn)
    expect(sig.rect.y).toBe(pn.rect.y)
    expect(pn.rect.y).toBe(dt.rect.y)
    expect(sig.rect.x).toBeLessThan(pn.rect.x)
    expect(pn.rect.x).toBeLessThan(dt.rect.x)
  })

  it('a span before the app’s first day draws the stated block as boxes: a row per day the office stated, then three blank rows', async () => {
    const input: HoursStatementInput = { ...baseInput, periodStart: '2025-09-15', statedDays: [{ day: '2025-09-15', hours: 8, note: 'Rough-in', statedBy: 'Office, 2026-11-02' }] }
    const out = await buildHoursStatementPdf(lib, ctxFor(input))
    const stated = out.schema.boxes.filter((b) => b.key.startsWith('stated_'))
    expect(stated).toHaveLength(4 * 3)
    for (let i = 1; i <= 4; i += 1) {
      const k = statedBoxKeys(i)
      const day = stated.find((b) => b.key === k.day)!
      const hours = stated.find((b) => b.key === k.hours)!
      const note = stated.find((b) => b.key === k.note)!
      expect(day).toMatchObject({ type: 'text', label: `Day ${i}`, maxLength: 12 })
      expect(hours).toMatchObject({ type: 'text', align: 'right' })
      expect(note.label).toBe(`What you were working on, day ${i}`)
      // One row: the same bottom, the cells left to right.
      expect(day.rect.y).toBe(hours.rect.y)
      expect(hours.rect.y).toBe(note.rect.y)
      expect(day.rect.x).toBeLessThan(hours.rect.x)
      expect(hours.rect.x).toBeLessThan(note.rect.x)
    }
    // Rows go down the page; the lens walks them before the signature.
    expect(stated.find((b) => b.key === 'stated_1_day')!.rect.y).toBeGreaterThan(stated.find((b) => b.key === 'stated_2_day')!.rect.y)
    expect(Math.max(...stated.map((b) => b.order))).toBeLessThan(out.schema.boxes.find((b) => b.key === HS_FORM_KEYS.printedName)!.order)
    expect(validateFormSchema(out.schema)).toEqual([])
  })

  it('a long statement runs to a second page and the signature block lands on the last one', async () => {
    const rows: HoursStatementInput['rows'] = []
    for (let d = 1; d <= 28; d += 1) {
      const day = `2026-06-${String(d).padStart(2, '0')}`
      rows.push({ day, hours: 8, note: `Day ${d}: rough-in, water lines and the trim on the second floor`, inLabel: '7:00 am', outLabel: '3:30 pm' })
      rows.push({ day, hours: 2, note: 'Second session, clean-up', inLabel: '4:00 pm', outLabel: '6:00 pm' })
    }
    const input: HoursStatementInput = { ...baseInput, periodStart: '2026-06-01', periodEnd: '2026-06-30', rows, addStatedBlock: true }
    const out = await buildHoursStatementPdf(lib, ctxFor(input))
    expect(out.pageCount).toBeGreaterThan(1)
    expect((await textOf(out.bytes)).pages).toBe(out.pageCount)
    expect(out.schema.pages).toHaveLength(out.pageCount)
    const sig = out.schema.boxes.find((b) => b.key === HS_FORM_KEYS.signature)!
    expect(sig.page).toBe(out.pageCount)
    expect(validateFormSchema(out.schema)).toEqual([])
  })

  it('fills and flattens through the Contract Forms executor with nothing skipped: the seeds, two typed days, the name and a typed signature', async () => {
    const statedDays = [{ day: '2025-09-15', hours: 8, note: 'Rough-in', statedBy: 'Office, 2026-11-02' }]
    const input: HoursStatementInput = { ...baseInput, periodStart: '2025-09-15', statedDays }
    const out = await buildHoursStatementPdf(lib, ctxFor(input))
    const values = { ...statedSeedValues(statedDays), stated_2_day: '9/16/2025', stated_2_hours: '8', stated_2_note: 'Water lines', stated_3_day: '9/17/2025', stated_3_hours: '6.5', stated_3_note: 'Trim', printed_name: 'Marcus Reyes' }
    expect(validateFormValues(out.schema, values)).toEqual([])
    expect(validateFormValues(out.schema, { stated_1_day: '2025-09-15' })).toEqual([{ key: 'printed_name', message: 'Your name, printed is required' }])
    const plan = buildFillPlan(out.schema, values, { todayLabel: 'Nov 2, 2026', signature: { mode: 'type', text: 'Marcus Reyes' } })
    expect(plan.filter((op) => op.kind === 'drawText')).toHaveLength(3 + 3 + 3 + 1 + 1 + 1)
    const filled = await fillFormPdf(fillLib, out.bytes, plan, { flatten: true })
    expect(filled.skipped).toEqual([])
    expect((await textOf(filled.bytes)).pages).toBe(out.pageCount)
  })

  it('hours only: no rate or amount columns in the title, and the sheet kind names the sheet column', async () => {
    const out = await buildHoursStatementPdf(lib, ctxFor({ ...baseInput, withPay: false }))
    expect((await textOf(out.bytes)).title).toContain('Statement of hours worked ·')
    const sheet = await buildHoursStatementPdf(lib, ctxFor({ ...baseInput, kind: 'sheet', rows: [{ day: '2026-06-01', hours: 6, note: 'Set 3 lavatories', rate: 40, amount: 240, group: { key: 'sh-1', label: 'Sheet 1042-A · agreed May 4' }, inLabel: null, outLabel: null }], worker: { name: 'Rosa Pérez', company: 'Pérez Plumbing' } }))
    expect(validateFormSchema(sheet.schema)).toEqual([])
    expect(sheet.pageCount).toBe(1)
  })

  it('draws the print’s columns (v2.6629): In – Out as one cell, the Rate column only when the rate changes, Amount with the pay', async () => {
    const changing = await buildHoursStatementPdf(lib, ctxFor(baseInput))
    expect(changing.title).toBe('Statement of hours worked and paid')
    expect(changing.columns).toEqual(['Day', 'In – Out', 'Hours', 'What they were working on', 'Rate', 'Amount'])
    expect(changing.facts.map((f) => f[0])).toEqual(['Worker', 'Period', 'Job', 'Customer', 'Approved by', 'Site'])
    const uniform = await buildHoursStatementPdf(lib, ctxFor({ ...baseInput, dayRates: { '2026-06-01': 24, '2026-06-02': 24, '2026-06-08': 24 } }))
    expect(uniform.columns).toEqual(['Day', 'In – Out', 'Hours', 'What they were working on', 'Amount'])
    expect(uniform.facts).toContainEqual(['Rate', '$24.00 an hour'])
    const hoursOnly = await buildHoursStatementPdf(lib, ctxFor({ ...baseInput, withPay: false }))
    expect(hoursOnly.title).toBe('Statement of hours worked')
    expect(hoursOnly.columns).toEqual(['Day', 'In – Out', 'Hours', 'What they were working on'])
    expect(hoursOnly.facts.some((f) => f[0] === 'Rate')).toBe(false)
  })

  it('a sheet draws Day · Line · Hours · Amount, the sheet’s one rate in the band', async () => {
    const sheet = await buildHoursStatementPdf(lib, ctxFor({ ...baseInput, kind: 'sheet', rows: [{ day: '2026-06-01', hours: 6, note: 'Set 3 lavatories', rate: 40, amount: 240, group: { key: 'sh-1', label: 'Sheet 1042-A · agreed May 4' }, inLabel: null, outLabel: null }], worker: { name: 'Rosa Pérez', company: 'Pérez Plumbing' } }))
    expect(sheet.columns).toEqual(['Day', 'Line', 'Hours', 'Amount'])
    expect(sheet.facts).toContainEqual(['Rate', '$40.00 an hour'])
  })

  it('the charged paper signs as a statement of hours charged with the Rate and Amount columns, as the print draws it', async () => {
    const input: HoursStatementInput = {
      kind: 'clock',
      periodStart: '2026-04-20',
      periodEnd: '2026-04-26',
      basis: 'charged',
      chargeWords: 'master with a helper throughout · $285.00 the crew’s hour',
      rows: [
        { day: '2026-04-20', hours: 9.93, note: 'with Zed · master with a helper · the job’s rule', inLabel: '8:00 am', outLabel: '5:00 pm', chargeRate: 285 },
        { day: '2026-04-25', hours: 9.44, note: 'alone · a tech alone · adjusted', inLabel: '8:00 am', outLabel: '5:26 pm', chargeRate: 185 },
      ],
      withPay: true,
      worker: { name: 'Marcus Reyes' },
    }
    const out = await buildHoursStatementPdf(lib, ctxFor(input))
    expect(out.title).toBe('Statement of hours charged')
    expect(out.columns).toEqual(['Day', 'In – Out', 'Hours', 'What they were working on', 'Rate', 'Amount'])
    expect((await textOf(out.bytes)).title).toBe('Statement of hours charged · Marcus Reyes · Job 1042 · April 20 – April 26, 2026')
    expect(out.pageCount).toBe(1)
    expect(validateFormSchema(out.schema)).toEqual([])
    // The signature block still closes the form.
    expect(out.schema.boxes.map((b) => b.key).sort()).toEqual([HS_FORM_KEYS.printedName, HS_FORM_KEYS.signature, HS_FORM_KEYS.signedOn].sort())
  })

  it('drops what Helvetica cannot encode instead of throwing', () => {
    expect(pdfSafeText('Week of June 1 · $756.00 earned – paid ’in full’')).toBe('Week of June 1 · $756.00 earned – paid ’in full’')
    expect(pdfSafeText('a ≥ b ✓ 中')).toBe('a  b  ')
  })
})
