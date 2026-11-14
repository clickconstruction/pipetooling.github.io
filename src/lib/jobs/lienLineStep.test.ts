import { describe, expect, it } from 'vitest'
import { lienActFor } from './lienActWords'
import { lienLateNoticeOpen, lienLineStep, lienPhoneChipWords, type LienLineDeskState } from './lienLineStep'
import { buildLienPayRunway, type LienRunwayInput } from './lienPayRunway'
import { plainWordsFailures } from '../plainWords'

const TODAY = '2026-09-23'
// A commercial sub job last worked in August: the notice by Nov 16, the affidavit by Dec 15.
const runwayInput = (over: Partial<LienRunwayInput> = {}): LienRunwayInput => ({ todayYmd: TODAY, openBalance: 4200, lastWorkYmd: '2026-08-14', propertyKind: 'non_residential', expectedPayYmd: null, filedYmd: null, releasedYmd: null, isSub: true, ...over })
const noticeOwed = () => buildLienPayRunway(runwayInput())
const noticed = (over: Partial<LienRunwayInput> = {}) => buildLienPayRunway(runwayInput({ noticedMonths: ['2026-08'], ...over }))
const desk = (paper: 'notice' | 'affidavit' | 'retainage', act: ReturnType<typeof lienActFor>, dueOn: string | null = null): LienLineDeskState => ({ act, paper, dueOn })

describe('lienLineStep — the step a billed job’s lien line stands on (punch list #335, row 5)', () => {
  it('a sub job’s notice comes first: the line races the notice’s day and opens the notice tab', () => {
    const step = lienLineStep(TODAY, noticeOwed(), null)!
    expect(step).toMatchObject({ noticeFirst: true, lateNotice: false, own: false, rowPaper: 'notice', deadlineYmd: '2026-11-16', deadlineDays: 54, lineAct: null, tab: 'notice' })
  })

  it('the desk’s act names the line when it is a step toward the line’s own day', () => {
    const draft = lienActFor({ paper: 'notice', action: 'draft' })
    expect(lienLineStep(TODAY, noticeOwed(), desk('notice', draft))!.lineAct).toBe(draft)
    // An affidavit's act on a line that still races the notice is not that line's step.
    expect(lienLineStep(TODAY, noticeOwed(), desk('affidavit', lienActFor({ paper: 'affidavit', action: 'draft' })))!.lineAct).toBeNull()
    // Once the notice is out the line is the affidavit's, and a notice still to send before it is a step toward it.
    const late = lienActFor({ paper: 'notice', action: 'draft_late' })
    expect(lienLineStep(TODAY, noticed(), desk('notice', late))!).toMatchObject({ rowPaper: 'affidavit', deadlineYmd: '2026-12-15', lineAct: late, tab: 'notice' })
    expect(lienLineStep(TODAY, noticed(), desk('affidavit', lienActFor({ paper: 'affidavit', action: 'draft' })))!.tab).toBe('affidavit')
  })

  it('a retainage notice due before the clock’s own day takes the line with its own day', () => {
    const act = lienActFor({ paper: 'retainage', action: 'draft' })
    expect(lienLineStep(TODAY, noticed(), desk('retainage', act, '2026-10-05'))!).toMatchObject({ own: true, rowPaper: 'retainage', deadlineYmd: '2026-10-05', deadlineDays: 12, lineAct: act, tab: 'notice' })
    // One due after the clock's day leaves the line to the affidavit.
    expect(lienLineStep(TODAY, noticed(), desk('retainage', act, '2026-12-20'))!).toMatchObject({ own: false, rowPaper: 'affidavit', lineAct: null })
  })

  it('a notice window closed with the affidavit’s day ahead is a step, the late notice; closed for good is none', () => {
    const late = buildLienPayRunway(runwayInput({ todayYmd: '2026-11-20' }))
    expect(late).toMatchObject({ state: 'closed', closedBy: 'notice' })
    expect(lienLateNoticeOpen(late)).toBe(true)
    expect(lienLineStep('2026-11-20', late, null)!).toMatchObject({ lateNotice: true, rowPaper: 'affidavit', deadlineYmd: '2026-12-15', deadlineDays: 25, tab: 'notice' })
    const gone = buildLienPayRunway(runwayInput({ todayYmd: '2026-12-20' }))
    expect(lienLateNoticeOpen(gone)).toBe(false)
    expect(lienLineStep('2026-12-20', gone, null)).toBeNull()
  })

  it('no clock, or a lien on file, has no step', () => {
    expect(lienLineStep(TODAY, null, null)).toBeNull()
    expect(lienLineStep(TODAY, buildLienPayRunway(runwayInput({ openBalance: 0 })), null)).toBeNull()
    expect(lienLineStep(TODAY, buildLienPayRunway(runwayInput({ filedYmd: '2026-09-20' })), null)).toBeNull()
  })
})

describe('lienPhoneChipWords — the phone row’s lien chip says the step (punch list #335, row 5)', () => {
  it('with the desk’s act the chip reads the act table’s words and the days left', () => {
    const near = '2026-11-12' // four days before the notice's last day
    const runway = buildLienPayRunway(runwayInput({ todayYmd: near }))
    expect(runway.chipLabel).toBe('notice in 4 d')
    const chip = lienPhoneChipWords(near, runway, desk('notice', lienActFor({ paper: 'notice', action: 'find_owner' })))
    expect(chip).toMatchObject({ label: 'Find the owner · 4 d', tab: 'notice', step: true })
    expect(chip.title).toBe('The notice needs the owner of record first. The last day is Nov 16. Tap to open the Lien window.')
  })

  it('an affidavit held by a fact reads the fact, and public property carries no day', () => {
    const near = '2026-12-11'
    const runway = noticed({ todayYmd: near })
    expect(runway.chipLabel).toBe('lien in 4 d')
    const homestead = lienActFor({ paper: 'affidavit', action: 'fix_property', missing: ['homestead_answer'] })
    expect(lienPhoneChipWords(near, runway, desk('affidavit', homestead)).label).toBe('Answer the homestead question · 4 d')
    const pub = lienPhoneChipWords(near, runway, desk('affidavit', lienActFor({ paper: 'affidavit', action: 'fix_property', missing: ['public_owner'] })))
    expect(pub.label).toBe('Public property, no lien')
    expect(pub.title).toBe('The owner of record is a public body. No lien attaches to public property. Ask the attorney about the bond. Tap to open the Lien window.')
    expect(lienPhoneChipWords(near, runway, desk('affidavit', lienActFor({ paper: 'affidavit', action: 'approve', waitingOn: 'Robert' }))).label).toBe('Waiting on Robert · 4 d')
    expect(lienPhoneChipWords(near, runway, desk('affidavit', lienActFor({ paper: 'affidavit', action: 'file_affidavit' })))).toMatchObject({ label: 'File the affidavit · 4 d', tab: 'affidavit' })
  })

  it('the last day itself reads today', () => {
    const runway = noticed({ todayYmd: '2026-12-15' })
    expect(lienPhoneChipWords('2026-12-15', runway, desk('affidavit', lienActFor({ paper: 'affidavit', action: 'draft' }))).label).toBe('Draft the affidavit · today')
  })

  it('a late notice that can still go is the step, never lien gone', () => {
    const runway = buildLienPayRunway(runwayInput({ todayYmd: '2026-11-20' }))
    expect(runway.chipLabel).toBe('lien gone')
    expect(lienPhoneChipWords('2026-11-20', runway, null)).toMatchObject({ label: 'Send the late notice · 25 d', tab: 'notice', step: true })
    expect(lienPhoneChipWords('2026-11-20', runway, desk('notice', lienActFor({ paper: 'notice', action: 'draft_late' }))).label).toBe('Draft the late notice · 25 d')
  })

  it('with no step to name the chip keeps the clock’s words', () => {
    const gone = buildLienPayRunway(runwayInput({ todayYmd: '2026-12-20' }))
    expect(lienPhoneChipWords('2026-12-20', gone, null)).toMatchObject({ label: 'lien gone', tab: 'notice', step: false })
    const fileFirst = noticed({ todayYmd: '2026-12-01', expectedPayYmd: '2026-12-28' })
    expect(lienPhoneChipWords('2026-12-01', fileFirst, null)).toMatchObject({ label: 'file first', tab: 'affidavit', step: false })
    expect(lienPhoneChipWords('2026-12-01', fileFirst, null).title).toBe(`${fileFirst.title} Tap to open the Lien window.`)
    // A reminder is no act: the courtesy notice leaves the clock's words.
    expect(lienPhoneChipWords('2026-12-01', fileFirst, desk('notice', lienActFor({ paper: 'notice', action: 'courtesy' }))).label).toBe('file first')
  })

  it('a day that is a guess says so after the tap', () => {
    const runway = buildLienPayRunway(runwayInput({ todayYmd: '2026-11-01', propertyKind: '', noticedMonths: ['2026-08'] }))
    const chip = lienPhoneChipWords('2026-11-01', runway, desk('affidavit', lienActFor({ paper: 'affidavit', action: 'draft' })))
    expect(chip.title.endsWith('Tap to open the Lien window. The property kind is not set, so the earlier day shows.')).toBe(true)
  })

  it('every step’s tip is plain words', () => {
    const near = '2026-12-11'
    const runway = noticed({ todayYmd: near })
    for (const missing of [['homestead_answer'], ['homestead'], ['contractor'], ['owner'], ['legal'], ['public_owner'], ['owner', 'legal']] as const) {
      const chip = lienPhoneChipWords(near, runway, desk('affidavit', lienActFor({ paper: 'affidavit', action: 'fix_property', missing: [...missing] })))
      expect(plainWordsFailures(chip.title), chip.title).toEqual([])
    }
  })
})
