import { describe, expect, it } from 'vitest'
import { plainSentence, sentenceParts } from '../valuesInPlace'
import { lienDayValues, lienHasDayValue, lienHoursAfterHandDayValues, lienLastWorkSourceValues } from './lienDayValues'
import { lienHoursAfterHandDayWords, lienLastWorkDay, lienLastWorkSourceLine } from './lienLastWorkDay'
import { buildLienTimeline, keepDatesWhole, lienDateWords, type LienTimeline, type LienTimelineInput, type LienTimelineStep } from './lienTimeline'

const TODAY = '2026-09-23'

function base(over: Partial<LienTimelineInput> = {}): LienTimelineInput {
  return {
    todayYmd: TODAY,
    isSub: true,
    propertyKind: 'non_residential',
    lastMonth: '2026-08',
    lastMonthFromCreation: false,
    months: [
      { key: '2026-07', deadline: '2026-10-15', fromCreation: false, outcome: 'open', at: '' },
      { key: '2026-08', deadline: '2026-11-16', fromCreation: false, outcome: 'open', at: '' },
    ],
    noticeState: 'to_draft',
    retainage: null,
    affidavit: null,
    originalContractCompletedOn: null,
    releasedAt: null,
    paid: false,
    ...over,
  }
}

/** The values a marked sentence holds, as `kind:text`. */
const values = (marked: string): string[] => sentenceParts(marked).flatMap((p) => (typeof p === 'string' ? [] : [`${p.kind}:${p.text}`]))

/** Every sentence a timeline hands the strip: each step's three lines, a folded step's months, and the verdict band's. */
function sentences(t: LienTimeline): string[] {
  const of = (s: LienTimelineStep): string[] => [s.dateWords, s.words, s.opensWords ?? '', ...(s.fold ? s.fold.steps.flatMap(of) : [])]
  return [...t.steps.flatMap(of), t.next.words, t.next.aside, t.waitingOn?.words ?? '', t.windowsAside ?? ''].filter(Boolean)
}

describe('lienDayValues: a day in a sentence a lien kernel wrote', () => {
  it('marks a day, a day with its year, a work month and a count of days, each with its kind', () => {
    expect(values(lienDayValues('Oct 15'))).toEqual(['day:Oct 15'])
    expect(values(lienDayValues('Dec 15, 2027'))).toEqual(['day:Dec 15, 2027'])
    expect(values(lienDayValues('Aug 2026'))).toEqual(['month:Aug 2026'])
    expect(values(lienDayValues('22 days · to draft'))).toEqual(['days:22 days'])
    expect(values(lienDayValues('overdue 1 day · the fee clock runs'))).toEqual(['days:1 day'])
    expect(values(lienDayValues('+5 days'))).toEqual(['days:+5 days'])
    expect(values(lienDayValues('open Aug 1 → Oct 15 · 21 of 75 days left'))).toEqual(['day:Aug 1', 'day:Oct 15', 'days:21 of 75 days'])
  })

  it('leaves the word in front of a day as a word', () => {
    expect(lienDayValues('filed Oct 3')).toBe('filed ⟪day|Oct 3⟫')
    expect(lienDayValues('reply by Sep 28')).toBe('reply by ⟪day|Sep 28⟫')
    expect(lienDayValues('held · re-asks Oct 3')).toBe('held · re-asks ⟪day|Oct 3⟫')
    expect(lienDayValues('54 days · counsel by Nov 15, 2027')).toBe('⟪days|54 days⟫ · counsel by ⟪day|Nov 15, 2027⟫')
  })

  it('marks nothing that is not a day', () => {
    for (const words of ['—', 'none', 'now', 'when paid', 'clock hours', 'last day set by hand', 'today · to draft', 'tomorrow', 'window closed · not noted', '4 windows closed', '3 noted · 1 to note', 'Send the Jul + Aug notice late', 'the owner holds 10 %', 'A copy to the owner and the GC within five days of filing (§ 53.055).', 'payment · $8,940', 'Maya Jansen', '']) {
      expect(lienDayValues(words)).toBe(words)
      expect(lienHasDayValue(words)).toBe(false)
    }
    expect(lienDayValues(null)).toBe('')
    expect(lienDayValues(undefined)).toBe('')
  })

  it('reads a date whose spaces were made no-break, and keeps them', () => {
    const glued = keepDatesWhole('tomorrow · sent Sep 14 · counsel by Jan 17, 2028 · last work Sep 2026')
    const marked = lienDayValues(glued)
    expect(values(marked)).toEqual(['day:Sep 14', 'day:Jan 17, 2028', 'month:Sep 2026'])
    expect(plainSentence(marked)).toBe(glued)
  })

  it('says whether a sentence holds a day', () => {
    expect(lienHasDayValue('filed Oct 3')).toBe(true)
    expect(lienHasDayValue('+5 days')).toBe(true)
    expect(lienHasDayValue('when paid')).toBe(false)
  })
})

describe('lienDayValues over the timeline the desk builds', () => {
  const lines: Array<[string, LienTimeline]> = [
    ['two open months', buildLienTimeline(base())],
    ['a filed and served affidavit', buildLienTimeline(base({ months: [{ key: '2026-07', deadline: '2026-10-15', fromCreation: false, outcome: 'sent', at: '2026-09-02' }], lastMonth: '2026-07', affidavit: { deadline: '2026-11-16', filedAt: '2026-09-10', recordingNumber: '2026-0001', county: 'Travis', servedAt: '2026-09-12', serveDue: '2026-09-15', missingGates: [] } }))],
    ['closed months, folded', buildLienTimeline(base({ months: ['2026-02', '2026-03', '2026-04', '2026-05'].map((key, i) => ({ key, deadline: `2026-0${i + 5}-15`, fromCreation: false, outcome: 'missed' as const, at: i === 0 ? '2026-06-01' : '' })), lastMonth: '2026-05' }))],
    ['a contract that ended, a held notice', buildLienTimeline(base({ noticeState: 'held', holdUntil: '2026-10-01', retainage: { contractEndedOn: '2026-09-10', deadline: '2026-10-12', noticed: false }, originalContractCompletedOn: '2026-09-15' }))],
    ['released', buildLienTimeline(base({ releasedAt: '2026-09-20', paid: true }))],
    ['a demand letter out', buildLienTimeline(base({ demandLetters: [{ sentAt: '2026-09-14', deadlineDate: '2026-09-28', amount: 8940, openRemaining: 8940, debtorParty: 'gc' }] }))],
  ]

  it.each(lines)('%s: no word changes, and every sentence reads the same plain', (_name, t) => {
    const all = sentences(t)
    expect(all.length).toBeGreaterThan(5)
    for (const words of all) expect(plainSentence(lienDayValues(words))).toBe(words)
  })

  it.each(lines)('%s: the day a step is dated on is marked wherever its date line prints it', (_name, t) => {
    for (const s of t.steps) {
      if (!s.date || s.fold) continue
      const day = s.kind === 'last_work' ? '' : lienDateWords(s.date, t.todayYmd)
      if (day && s.dateWords.includes(day)) expect(values(lienDayValues(s.dateWords))).toContain(`day:${day}`)
    }
  })

  it('the two open months: each date line, each count and the verdict', () => {
    const t = buildLienTimeline(base())
    const by = Object.fromEntries(t.steps.map((s) => [s.key, s]))
    expect(lienDayValues(by['last_work']!.dateWords)).toBe('⟪month|Aug 2026⟫')
    expect(lienDayValues(by['last_work']!.words)).toBe('clock hours')
    expect(lienDayValues(by['notice:2026-07']!.dateWords)).toBe('⟪day|Oct 15⟫')
    expect(lienDayValues(by['notice:2026-07']!.words)).toBe('⟪days|22 days⟫ · to draft')
    expect(lienDayValues(by['notice:2026-07']!.opensWords)).toBe('open since ⟪day|Aug 1⟫')
    expect(lienDayValues(by['affidavit']!.words)).toBe('⟪days|83 days⟫')
    expect(lienDayValues(by['serve']!.dateWords)).toBe('⟪days|+5 days⟫')
    expect(lienDayValues(by['suit']!.dateWords)).toBe('⟪day|Dec 15, 2027⟫')
    expect(values(lienDayValues(t.next.words))).toEqual(['days:22 days'])
  })
})

describe('the last-day line, its values marked', () => {
  it('names who set the day and when, apart from the source words', () => {
    const d = lienLastWorkDay({ last_work_date: '2026-09-24', lien_last_work_on: '2026-09-30', lien_last_work_note: 'punch day', lien_last_work_set_at: '2026-10-06T14:00:00Z', lien_last_work_set_by: 'u1' })
    expect(lienLastWorkSourceValues(d, 'Robert')).toBe('set by hand · ⟪who|Robert⟫ · ⟪when|Oct 6⟫')
    expect(lienLastWorkSourceValues(d, null)).toBe('set by hand · ⟪when|Oct 6⟫')
    expect(lienLastWorkSourceValues({ ...d, setAt: null }, '  Robert  ')).toBe('set by hand · ⟪who|Robert⟫')
    expect(lienLastWorkSourceValues({ ...d, setAt: null }, '')).toBe('set by hand')
  })

  it('a day the app worked out has no one and no day to name', () => {
    expect(lienLastWorkSourceValues(lienLastWorkDay({ last_work_date: '2026-09-24' }), 'Robert')).toBe('from clock hours')
    expect(lienLastWorkSourceValues(lienLastWorkDay({ created_at: '2026-07-01T15:00:00Z' }), 'Robert')).toBe("from the job's creation")
    expect(lienLastWorkSourceValues(lienLastWorkDay(null))).toBe('no day yet')
  })

  it('reads plain as the line the mirrored kernel writes, in every case', () => {
    const jobs = [
      { last_work_date: '2026-09-24', lien_last_work_on: '2026-09-30', lien_last_work_set_at: '2026-10-06T14:00:00Z' },
      { lien_last_work_on: '2026-09-30' },
      { last_work_date: '2026-09-24' },
      { created_at: '2026-07-01T15:00:00Z' },
      {},
    ]
    for (const job of jobs) {
      const d = lienLastWorkDay(job)
      for (const name of ['Robert', '  Dana Whitlow ', '', null, undefined]) expect(plainSentence(lienLastWorkSourceValues(d, name))).toBe(lienLastWorkSourceLine(d, name))
    }
  })

  it('marks the later hours’ last day inside the kernel’s own sentence', () => {
    expect(lienHoursAfterHandDayValues('2026-10-20')).toBe('Hours were approved after it, through ⟪hours|Oct 20⟫. They do not move it.')
    expect(plainSentence(lienHoursAfterHandDayValues('2026-10-20'))).toBe(lienHoursAfterHandDayWords('2026-10-20'))
    expect(lienHoursAfterHandDayValues('')).toBe('')
  })
})
