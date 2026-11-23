import { describe, expect, it } from 'vitest'
import { contractEndedPatch } from '../../../supabase/functions/_shared/devMcpJobMarks'
import { plainSentence, sentenceParts } from '../valuesInPlace'
import { formatYmdMonthDay } from './billedExpectedPay'
import { retainageDeadlineFor } from './lienDeadlines'
import { LIEN_CONTRACT_ENDED_HOW, retainageDeadlineWords } from './lienDeskRetainage'
import {
  LIEN_CONTRACT_STATE_CHOICES,
  LIEN_CONTRACT_STILL_OPEN,
  LIEN_CONTRACT_STILL_OPEN_PATCH,
  LIEN_PAYMENT_BOND_CHOICES,
  lienContractDayPreview,
  lienContractEndedAsk,
  lienContractEndedPatch,
  lienContractEndedSavedWords,
  lienContractStartHint,
  lienContractStateText,
  lienContractStillOpenAsk,
  lienPaymentBondPatch,
  lienPaymentBondText,
  lienRetainageHeldPatch,
  lienRetainageHeldPreview,
  lienRetainageHeldText,
  lienRetainageHeldValue,
  retainageDeadlineValues,
} from './lienRetainageFacts'

/**
 * The retainage pane's facts as values in place (punch list #399). Every day here is made up. 2026-09-03 is a
 * Thursday, and 30 days after it is Saturday Oct 3, which § 53.003 rolls to Monday Oct 5.
 */
const TODAY = '2026-09-24'
const fmt = formatYmdMonthDay

describe('the choices and the words each value reads as', () => {
  it('the contract’s state lists Still open first, then the three ways it ends, in the kernel’s own order and words', () => {
    expect(LIEN_CONTRACT_STATE_CHOICES.map((c) => c.value)).toEqual([LIEN_CONTRACT_STILL_OPEN, ...LIEN_CONTRACT_ENDED_HOW.map((h) => h.key)])
    expect(LIEN_CONTRACT_STATE_CHOICES.map((c) => c.label)).toEqual(['Still open', 'Complete', 'Terminated', 'Abandoned'])
    expect(lienContractStateText(null)).toBe('still open')
    expect(LIEN_CONTRACT_ENDED_HOW.map((h) => lienContractStateText(h.key))).toEqual(['complete', 'terminated', 'abandoned'])
  })

  it('the bond reads yes, no or unknown, and its field lists the three', () => {
    expect(LIEN_PAYMENT_BOND_CHOICES.map((c) => c.value)).toEqual(['yes', 'no', 'unknown'])
    expect((['yes', 'no', 'unknown'] as const).map(lienPaymentBondText)).toEqual(['yes', 'no', 'unknown'])
  })

  it('the retainage reads as dollars, a 0 as $0, and an empty column as not recorded', () => {
    expect(lienRetainageHeldText(4200)).toBe('$4,200')
    expect(lienRetainageHeldText(0)).toBe('$0')
    expect(lienRetainageHeldText(null)).toBe('not recorded')
    expect(lienRetainageHeldValue(1678.04)).toBe('1678.04')
    expect(lienRetainageHeldValue('4200.00')).toBe('4200')
    expect(lienRetainageHeldValue(0)).toBe('0')
    expect(lienRetainageHeldValue(null)).toBe('')
    expect(lienRetainageHeldValue(undefined)).toBe('')
  })
})

describe('retainageDeadlineValues: the chip’s words with their value marked', () => {
  const cases: Array<{ deadline: string | null; daysLeft: number | null }> = [
    { deadline: null, daysLeft: null },
    { deadline: '2026-09-20', daysLeft: -4 },
    { deadline: TODAY, daysLeft: 0 },
    { deadline: '2026-09-25', daysLeft: 1 },
    { deadline: '2026-10-03', daysLeft: 9 },
    { deadline: '2026-10-08', daysLeft: 14 },
    { deadline: '2026-10-20', daysLeft: 26 },
  ]

  it('the plain words are the kernel’s, for every shape the chip takes', () => {
    for (const e of cases) expect(plainSentence(retainageDeadlineValues(e, fmt))).toBe(retainageDeadlineWords(e, fmt))
  })

  it('a count of days and a day are marked; words that name neither are not', () => {
    const values = (e: (typeof cases)[number]) => sentenceParts(retainageDeadlineValues(e, fmt)).filter((p) => typeof p !== 'string')
    expect(values(cases[4]!)).toEqual([{ kind: 'days', text: '9d' }])
    expect(values(cases[5]!)).toEqual([{ kind: 'days', text: '14d' }])
    expect(values(cases[6]!)).toEqual([{ kind: 'day', text: 'Oct 20' }])
    for (const e of cases.slice(0, 4)) expect(values(e)).toEqual([])
  })
})

describe('the line under an open field', () => {
  it('a drafted day says when the notice would be due, by the desk’s own deadline', () => {
    expect(retainageDeadlineFor('2026-09-03')).toBe('2026-10-05')
    expect(plainSentence(lienContractDayPreview('2026-09-03', TODAY, fmt))).toBe('The § 53.057 notice would be due by Oct 5.')
    expect(sentenceParts(lienContractDayPreview('2026-09-03', TODAY, fmt))).toContainEqual({ kind: 'day', text: 'Oct 5' })
  })

  it('a day whose 30 days are over says so, and a half-typed day says nothing', () => {
    expect(plainSentence(lienContractDayPreview('2026-08-03', TODAY, fmt))).toBe(`The 30 days would have closed ${fmt(retainageDeadlineFor('2026-08-03'))}.`)
    expect(lienContractDayPreview('', TODAY, fmt)).toBe('')
    expect(lienContractDayPreview('2026-09', TODAY, fmt)).toBe('')
  })

  it('a drafted figure says what the notice would claim; a 0 says no notice goes; a half-typed one says nothing', () => {
    expect(plainSentence(lienRetainageHeldPreview('5000'))).toBe('The notice would claim $5,000.')
    expect(sentenceParts(lienRetainageHeldPreview('5000'))).toContainEqual({ kind: 'amount', text: '$5,000' })
    expect(lienRetainageHeldPreview('0')).toBe('A 0 means the GC holds none. No notice goes then.')
    expect(lienRetainageHeldPreview('')).toBe('')
    expect(lienRetainageHeldPreview('-4')).toBe('')
    expect(lienRetainageHeldPreview('abc')).toBe('')
  })

  it('the start hint names the way picked, and the last approved clock day when the job has one', () => {
    expect(lienContractStartHint('complete', '2026-09-02T00:00:00', fmt)).toBe('The day our contract was complete. The last approved clock day is Sep 2.')
    expect(lienContractStartHint('abandoned', null, fmt)).toBe('The day our contract was abandoned.')
  })
})

describe('the window that asks first', () => {
  it('starting the clock names the day, how it ended and the day the notice is then due', () => {
    expect(lienContractEndedAsk({ how: 'complete', day: '2026-09-03', was: '', todayYmd: TODAY, formatDay: fmt })).toEqual({
      title: 'Start the 30-day clock?',
      message: 'Our contract on this job was complete on Sep 3. The § 53.057 retainage notice is then due by Oct 5.',
      confirmLabel: 'Start the clock',
    })
  })

  it('moving the day says where the deadline goes and where it was', () => {
    expect(lienContractEndedAsk({ how: 'terminated', day: '2026-09-10', was: '2026-09-03', todayYmd: TODAY, formatDay: fmt })).toEqual({
      title: 'Move the day our contract ended?',
      message: `The day moves from Sep 3 to Sep 10. The § 53.057 retainage notice is then due by ${fmt(retainageDeadlineFor('2026-09-10'))}. It was due by Oct 5.`,
      confirmLabel: 'Move the day',
    })
  })

  it('a move that leaves the deadline where the weekend rolled it says it is still due then', () => {
    // Fri Sep 4 + 30 is Sun Oct 4, which rolls to Mon Oct 5, the day Thu Sep 3 rolls to as well.
    expect(retainageDeadlineFor('2026-09-04')).toBe('2026-10-05')
    expect(lienContractEndedAsk({ how: 'complete', day: '2026-09-04', was: '2026-09-03', todayYmd: TODAY, formatDay: fmt }).message).toBe('The day moves from Sep 3 to Sep 4. The § 53.057 retainage notice is still due by Oct 5.')
  })

  it('a day whose window is already over says the day has passed', () => {
    expect(lienContractEndedAsk({ how: 'complete', day: '2026-08-03', was: '', todayYmd: TODAY, formatDay: fmt }).message).toMatch(/ That day has already passed\.$/)
    expect(lienContractEndedAsk({ how: 'complete', day: '2026-09-03', was: '', todayYmd: TODAY, formatDay: fmt }).message).not.toContain('already passed')
  })

  it('marking it still open says the day comes off, the clock stops, and when the notice was due', () => {
    expect(lienContractStillOpenAsk({ was: '2026-09-03', formatDay: fmt })).toEqual({
      title: 'Mark our contract still open?',
      message: 'The day our contract ended comes off the job, and the 30-day clock stops. The § 53.057 retainage notice was due by Oct 5.',
      confirmLabel: 'Mark it still open',
    })
  })

  it('no confirm button says OK, and each names its act', () => {
    const labels = [lienContractEndedAsk({ how: 'complete', day: '2026-09-03', was: '', todayYmd: TODAY, formatDay: fmt }), lienContractEndedAsk({ how: 'complete', day: '2026-09-04', was: '2026-09-03', todayYmd: TODAY, formatDay: fmt }), lienContractStillOpenAsk({ was: '2026-09-03', formatDay: fmt })].map((a) => a.confirmLabel)
    expect(labels).toEqual(['Start the clock', 'Move the day', 'Mark it still open'])
  })
})

describe('the patches', () => {
  const NOW = '2026-09-24T16:00:00.000Z'
  const WHO = 'ffffffff-1111-4111-8111-111111111111'

  it('the day and how it ended are the dev seat’s patch, column for column, with the person stamped', () => {
    const seat = contractEndedPatch({ action: 'contract_ended', job_id: 'j1', ended_on: '2026-09-03', how: 'complete' } as Parameters<typeof contractEndedPatch>[0], { userId: WHO }, NOW)
    expect(lienContractEndedPatch('2026-09-03', 'complete', WHO, NOW)).toEqual(seat)
  })

  it('still open empties the four ended columns, as the dev seat’s clear does', () => {
    expect(LIEN_CONTRACT_STILL_OPEN_PATCH).toEqual(contractEndedPatch({ action: 'contract_ended', job_id: 'j1', clear: true } as Parameters<typeof contractEndedPatch>[0], { userId: WHO }, NOW))
  })

  it('the retainage and the bond each write their one column', () => {
    expect(lienRetainageHeldPatch(5000)).toEqual({ lien_retainage_held: 5000 })
    expect(lienRetainageHeldPatch(0)).toEqual({ lien_retainage_held: 0 })
    expect(lienPaymentBondPatch('yes')).toEqual({ lien_payment_bond: 'yes' })
  })

  it('the words after a save name the day and the day the notice is due', () => {
    expect(lienContractEndedSavedWords('complete', '2026-09-03', fmt)).toBe('Our contract: complete Sep 3. The retainage notice is due by Oct 5.')
  })
})
