import { describe, expect, it } from 'vitest'
import { formatYmdMonthDay } from '../jobs/billedExpectedPay'
import {
  buildRetainageHeldSection,
  latestRetainageApplication,
  retainageAgeWords,
  lienRetainageMirror,
  retainageHeldLine,
  retainageReleaseDraft,
  retainageReleaseWords,
  retainageSourceFigure,
  retainageSourceWords,
  type RetainageApplication,
  type RetainageBill,
  type RetainageHeldInput,
} from './retainageHeld'

const TODAY = '2026-10-26'

// Noon in Chicago, so the saved day reads the same in summer and winter.
const app = (applicationNumber: number, retainageHeld: number, extra: Partial<RetainageApplication> = {}): RetainageApplication => ({
  applicationNumber,
  retainageHeld,
  updatedAt: `2026-10-${String(10 + applicationNumber).padStart(2, '0')}T17:00:00Z`,
  ...extra,
})

const bill = (id: string, amount: number, status: string): RetainageBill => ({ id, amount, status })

function input(partial: Partial<RetainageHeldInput> & { jobId: string }): RetainageHeldInput {
  return { applications: [], typedHeld: null, finishedOn: null, bills: [], releaseBillId: null, ...partial }
}

describe('retainageHeldLine — a job with pay applications (source C)', () => {
  it('reads the latest application’s retainage to date and ignores the typed figure', () => {
    const line = retainageHeldLine(input({ jobId: 'c1385', applications: [app(2, 5_840), app(1, 2_920)], typedHeld: 6_400 }), TODAY)
    expect(line).toMatchObject({
      source: 'pay_application',
      applicationNumber: 2,
      applicationSavedOn: '2026-10-12',
      held: 5_840,
      released: 0,
      owed: 5_840,
      release: { state: 'none', applicationNumber: null, invoiceId: null },
      cleared: false,
    })
  })

  it('a job still open is not aging', () => {
    const line = retainageHeldLine(input({ jobId: 'c1385', applications: [app(1, 2_920)] }), TODAY)
    expect(line?.finishedOn).toBeNull()
    expect(line?.ageDays).toBeNull()
    expect(retainageAgeWords(line!, formatYmdMonthDay)).toBe('job still open · not aging yet')
  })

  it('a step down partway reads as the latest application’s smaller figure', () => {
    const line = retainageHeldLine(input({ jobId: 'c1385', applications: [app(1, 4_000), app(2, 6_000), app(3, 3_500)] }), TODAY)
    expect(line?.held).toBe(3_500)
    expect(line?.owed).toBe(3_500)
    expect(line?.release.state).toBe('none')
  })

  it('applications that never held retainage make no line, whatever was typed', () => {
    expect(retainageHeldLine(input({ jobId: 'c1390', applications: [app(1, 0), app(2, 0)], typedHeld: 900 }), TODAY)).toBeNull()
  })

  it('rounds the figure to cents', () => {
    expect(retainageHeldLine(input({ jobId: 'c1385', applications: [app(1, 1234.5678)] }), TODAY)?.held).toBe(1234.57)
  })

  it('the source words name the application and the day it was saved', () => {
    const line = retainageHeldLine(input({ jobId: 'c1385', applications: [app(3, 5_840)] }), TODAY)!
    expect(retainageSourceWords(line, formatYmdMonthDay)).toBe('from pay application 3, saved Oct 13')
    expect(retainageSourceWords({ ...line, applicationSavedOn: null }, formatYmdMonthDay)).toBe('from pay application 3')
  })
})

describe('retainageHeldLine — a job without pay applications', () => {
  it('reads the typed figure and ages from the day the job finished', () => {
    const line = retainageHeldLine(input({ jobId: 'c1377', typedHeld: 3_120, finishedOn: '2026-09-30' }), TODAY)
    expect(line).toMatchObject({ source: 'lien_details', applicationNumber: null, applicationSavedOn: null, held: 3_120, released: 0, owed: 3_120, finishedOn: '2026-09-30', ageDays: 26, cleared: false })
    expect(line?.release.state).toBe('none')
    expect(retainageSourceWords(line!, formatYmdMonthDay)).toBe("typed in the job's lien details")
    expect(retainageAgeWords(line!, formatYmdMonthDay)).toBe('26d since the job finished · Sep 30')
  })

  it('finished today reads so; a finish in the future reads as no days yet', () => {
    expect(retainageAgeWords(retainageHeldLine(input({ jobId: 'j', typedHeld: 10, finishedOn: TODAY }), TODAY)!, formatYmdMonthDay)).toBe('finished today')
    expect(retainageHeldLine(input({ jobId: 'j', typedHeld: 10, finishedOn: '2026-11-02' }), TODAY)?.ageDays).toBe(0)
  })

  it('nothing typed, or zero, is no line', () => {
    expect(retainageHeldLine(input({ jobId: 'j' }), TODAY)).toBeNull()
    expect(retainageHeldLine(input({ jobId: 'j', typedHeld: 0 }), TODAY)).toBeNull()
    expect(retainageHeldLine(input({ jobId: 'j', typedHeld: -5 }), TODAY)).toBeNull()
  })
})

describe('retainageHeldLine — a job whose retainage was released (release C)', () => {
  const held = [app(1, 2_920), app(2, 5_840)]

  it('the final application at zero with no bill yet: released on paper, still owed', () => {
    const line = retainageHeldLine(input({ jobId: 'c1385', applications: [...held, app(3, 0)] }), TODAY)
    expect(line).toMatchObject({ held: 5_840, released: 0, owed: 5_840, applicationNumber: 2, release: { state: 'unbilled', applicationNumber: 3, invoiceId: null }, cleared: false })
    expect(retainageReleaseWords(line!.release)).toBe('released on application 3 · no bill yet')
  })

  it('the final application’s bill drafted and not sent: nothing is billed early', () => {
    const line = retainageHeldLine(input({ jobId: 'c1385', applications: [...held, app(3, 0, { invoiceId: 'b4' })], bills: [bill('b4', 14_500, 'ready_to_bill')] }), TODAY)
    expect(line).toMatchObject({ held: 5_840, released: 0, owed: 5_840, release: { state: 'drafted', applicationNumber: 3, invoiceId: 'b4' }, cleared: false })
    expect(retainageReleaseWords(line!.release)).toBe('release drafted · not sent yet')
  })

  it('the final application’s bill out: released, the GC has been asked, the line stays until paid', () => {
    const line = retainageHeldLine(input({ jobId: 'c1385', applications: [...held, app(3, 0, { invoiceId: 'b4' })], bills: [bill('b4', 14_500, 'billed')] }), TODAY)
    expect(line).toMatchObject({ held: 5_840, released: 5_840, owed: 0, release: { state: 'billed', applicationNumber: 3, invoiceId: 'b4' }, cleared: false })
    expect(retainageReleaseWords(line!.release)).toBe('release billed · awaiting payment')
  })

  it('the final application’s bill paid: the line is cleared', () => {
    const line = retainageHeldLine(input({ jobId: 'c1385', applications: [...held, app(3, 0, { invoiceId: 'b4' })], bills: [bill('b4', 14_500, 'paid')] }), TODAY)
    expect(line).toMatchObject({ held: 5_840, released: 5_840, owed: 0, release: { state: 'paid' }, cleared: true })
    expect(retainageReleaseWords(line!.release)).toBe('release paid')
  })

  it('a tied bill the job no longer lists reads as no bill', () => {
    const line = retainageHeldLine(input({ jobId: 'c1385', applications: [...held, app(3, 0, { invoiceId: 'gone' })], bills: [] }), TODAY)
    expect(line?.release).toEqual({ state: 'unbilled', applicationNumber: 3, invoiceId: null })
  })

  it('a job without applications: the release bill drafted, then billed, then paid', () => {
    const base = { jobId: 'c1377', typedHeld: 3_120, finishedOn: '2026-09-30', releaseBillId: 'b9' }
    const drafted = retainageHeldLine(input({ ...base, bills: [bill('b9', 3_120, 'ready_to_bill')] }), TODAY)
    expect(drafted).toMatchObject({ held: 3_120, released: 0, owed: 3_120, release: { state: 'drafted', applicationNumber: null, invoiceId: 'b9' }, cleared: false })
    const billed = retainageHeldLine(input({ ...base, bills: [bill('b9', 3_120, 'billed')] }), TODAY)
    expect(billed).toMatchObject({ held: 3_120, released: 3_120, owed: 0, release: { state: 'billed', invoiceId: 'b9' }, cleared: false })
    const paid = retainageHeldLine(input({ ...base, bills: [bill('b9', 3_120, 'paid')] }), TODAY)
    expect(paid).toMatchObject({ owed: 0, release: { state: 'paid' }, cleared: true })
  })

  it('a release bill for less than the held figure leaves the rest owed; one for more releases only what was held', () => {
    const less = retainageHeldLine(input({ jobId: 'j', typedHeld: 3_120, releaseBillId: 'b9', bills: [bill('b9', 2_000, 'billed')] }), TODAY)
    expect(less).toMatchObject({ held: 3_120, released: 2_000, owed: 1_120 })
    const more = retainageHeldLine(input({ jobId: 'j', typedHeld: 3_120, releaseBillId: 'b9', bills: [bill('b9', 4_000, 'billed')] }), TODAY)
    expect(more).toMatchObject({ held: 3_120, released: 3_120, owed: 0 })
  })

  it('the typed figure cleared after the release bill was drafted: the bill still records what was held', () => {
    const line = retainageHeldLine(input({ jobId: 'j', typedHeld: null, releaseBillId: 'b9', bills: [bill('b9', 3_120, 'billed')] }), TODAY)
    expect(line).toMatchObject({ source: 'lien_details', held: 3_120, released: 3_120, owed: 0, release: { state: 'billed' } })
  })

  it('a release bill id the job does not list is no release', () => {
    const line = retainageHeldLine(input({ jobId: 'j', typedHeld: 3_120, releaseBillId: 'gone', bills: [] }), TODAY)
    expect(line?.release).toEqual({ state: 'none', applicationNumber: null, invoiceId: null })
    expect(line?.owed).toBe(3_120)
  })
})

describe('retainageSourceFigure — the number the lien details show', () => {
  it('an application’s figure where one exists, even zero; else the typed figure; else nothing', () => {
    expect(retainageSourceFigure([app(1, 2_920), app(2, 5_840)], 6_400)).toEqual({ source: 'pay_application', amount: 5_840, applicationNumber: 2 })
    expect(retainageSourceFigure([app(1, 2_920), app(2, 0)], 6_400)).toEqual({ source: 'pay_application', amount: 0, applicationNumber: 2 })
    expect(retainageSourceFigure([], 6_400)).toEqual({ source: 'lien_details', amount: 6_400, applicationNumber: null })
    expect(retainageSourceFigure([], null)).toBeNull()
  })

  it('the latest application is the highest number, whatever the order given', () => {
    expect(latestRetainageApplication([app(2, 1), app(7, 1), app(3, 1)])?.applicationNumber).toBe(7)
    expect(latestRetainageApplication([])).toBeNull()
  })
})

describe('buildRetainageHeldSection — AR’s section', () => {
  it('drops cleared lines and jobs with nothing, sums what is owed, and puts the oldest finish first with open jobs last', () => {
    const section = buildRetainageHeldSection(
      [
        input({ jobId: 'open', applications: [app(3, 5_840)] }),
        input({ jobId: 'old', typedHeld: 3_120, finishedOn: '2026-09-30' }),
        input({ jobId: 'older', typedHeld: 500, finishedOn: '2026-08-01' }),
        input({ jobId: 'paid', applications: [app(1, 900), app(2, 0, { invoiceId: 'b' })], bills: [bill('b', 9_000, 'paid')] }),
        input({ jobId: 'billed', applications: [app(1, 700), app(2, 0, { invoiceId: 'b' })], bills: [bill('b', 7_000, 'billed')], finishedOn: '2026-10-20' }),
        input({ jobId: 'nothing' }),
      ],
      TODAY,
    )
    expect(section.lines.map((l) => l.jobId)).toEqual(['older', 'old', 'billed', 'open'])
    expect(section.total).toBe(5_840 + 3_120 + 500)
    expect(section.releasedCount).toBe(1)
  })

  it('among jobs of one age the larger figure comes first, then the job id', () => {
    const section = buildRetainageHeldSection(
      [input({ jobId: 'b', typedHeld: 100, finishedOn: '2026-10-01' }), input({ jobId: 'a', typedHeld: 100, finishedOn: '2026-10-01' }), input({ jobId: 'c', typedHeld: 900, finishedOn: '2026-10-01' })],
      TODAY,
    )
    expect(section.lines.map((l) => l.jobId)).toEqual(['c', 'a', 'b'])
  })

  it('an empty AR has no lines and a zero total', () => {
    expect(buildRetainageHeldSection([], TODAY)).toEqual({ lines: [], total: 0, releasedCount: 0 })
  })
})

describe('retainageReleaseDraft — the release bill a line offers (release C)', () => {
  it('a job with no applications, still held: the whole figure, once', () => {
    const line = retainageHeldLine(input({ jobId: 'c1377', typedHeld: 3_120, finishedOn: '2026-09-30' }), TODAY)!
    expect(retainageReleaseDraft(line)).toEqual({ amount: 3_120, memo: 'Retainage release' })
  })

  it('no offer once a release bill exists in any state, on an application job, or with nothing owed', () => {
    const base = { jobId: 'c1377', typedHeld: 3_120, releaseBillId: 'b9' }
    for (const status of ['ready_to_bill', 'billed', 'paid']) {
      expect(retainageReleaseDraft(retainageHeldLine(input({ ...base, bills: [bill('b9', 3_120, status)] }), TODAY)!)).toBeNull()
    }
    expect(retainageReleaseDraft(retainageHeldLine(input({ jobId: 'c1385', applications: [app(1, 2_920), app(2, 5_840)] }), TODAY)!)).toBeNull()
    expect(retainageReleaseDraft({ source: 'lien_details', owed: 0, release: { state: 'none', applicationNumber: null, invoiceId: null } })).toBeNull()
  })
})

describe('lienRetainageMirror — what the lien details mirror on an application job (PR 4)', () => {
  it('the latest application’s figure; the released figure while its bill is unpaid; zero once paid or never held', () => {
    expect(lienRetainageMirror(input({ jobId: 'j', applications: [app(1, 2_920), app(2, 5_840)], typedHeld: 6_400 }), TODAY)).toBe(5_840)
    expect(lienRetainageMirror(input({ jobId: 'j', applications: [app(1, 2_920), app(2, 5_840), app(3, 0, { invoiceId: 'b' })], bills: [bill('b', 9_000, 'billed')] }), TODAY)).toBe(5_840)
    expect(lienRetainageMirror(input({ jobId: 'j', applications: [app(1, 2_920), app(2, 5_840), app(3, 0, { invoiceId: 'b' })], bills: [bill('b', 9_000, 'paid')] }), TODAY)).toBe(0)
    expect(lienRetainageMirror(input({ jobId: 'j', applications: [app(1, 0)], typedHeld: 900 }), TODAY)).toBe(0)
  })
  it('a job with no applications is the office’s to type: nothing to mirror', () => {
    expect(lienRetainageMirror(input({ jobId: 'j', typedHeld: 3_120 }), TODAY)).toBeNull()
    expect(lienRetainageMirror(input({ jobId: 'j' }), TODAY)).toBeNull()
  })
})
