import { describe, expect, it } from 'vitest'
import type { RunNotice, RunRecipient } from './lienDeskRun'
import {
  RUN_CLOSE_PAID_CAUTION,
  canClosePaidItem,
  fieldsWithClosedPaid,
  paperClaimOf,
  runClosePaidConfirm,
  runClosePaidPress,
  runClosedPaidOf,
  runClosedPaidWords,
  runNoticesClosed,
  runPaidFoldWords,
  runPaidNotices,
} from './lienRunClosePaid'
import { plainWordsFailures } from '../plainWords'

type N = Pick<RunNotice, 'itemId' | 'label' | 'kind' | 'amount' | 'fields' | 'printedAt' | 'recipients'>

const copy = (over: Partial<RunRecipient> = {}): RunRecipient => ({ key: 'owner', name: 'ZZ Owner', method: 'certified_mail', tracking: '', ...over }) as RunRecipient

const notice = (itemId: string, over: Partial<N> = {}): N => ({
  itemId,
  label: `90${itemId} · ZZ Test Job`,
  kind: 'notice_53_056',
  amount: 0,
  fields: { claimAmount: '2400.00' } as RunNotice['fields'],
  printedAt: '2026-10-08T15:00:00Z',
  recipients: [copy()],
  ...over,
})

describe('runPaidNotices', () => {
  it('takes the monthly notices whose job owes $0, and leaves the ones still owed alone', () => {
    const got = runPaidNotices([notice('1'), notice('2', { amount: 350 }), notice('3', { printedAt: null })])
    expect(got).toEqual({ ready: ['1', '3'], held: [] })
  })

  it('leaves a retainage notice and a notice with a Docsmit copy, each with its reason', () => {
    const got = runPaidNotices([
      notice('1'),
      notice('2', { kind: 'retainage_53_057' }),
      notice('3', { recipients: [copy({ via: 'docsmit', pieceId: 'p1', pieceStatus: 'mailed' })] }),
    ])
    expect(got.ready).toEqual(['1'])
    expect(got.held).toEqual([
      { itemId: '2', label: '902 · ZZ Test Job', why: 'A retainage notice is not closed from the run.' },
      { itemId: '3', label: '903 · ZZ Test Job', why: 'A copy went out through Docsmit, so it is not closed.' },
    ])
  })

  it('lists a notice once', () => {
    expect(runPaidNotices([notice('1'), notice('1')]).ready).toEqual(['1'])
  })
})

describe('the press and the fold', () => {
  it('counts what it will close, and says what stays', () => {
    expect(runClosePaidPress({ ready: 5, held: 0 })).toMatchObject({ button: 'Close 5 paid notices', dead: false, foot: null })
    expect(runClosePaidPress({ ready: 1, held: 0 }).button).toBe('Close 1 paid notice')
    expect(runClosePaidPress({ ready: 4, held: 1 }).button).toBe('Close 4 paid notices · 1 stays ▸')
    expect(runClosePaidPress({ ready: 2, held: 2 }).button).toBe('Close 2 paid notices · 2 stay ▸')
    expect(runClosePaidPress({ ready: 0, held: 1 })).toMatchObject({ dead: true })
  })

  it('names the fold by its count', () => {
    expect(runPaidFoldWords(5)).toBe('5 paid notices · nothing to send')
    expect(runPaidFoldWords(1)).toBe('1 paid notice · nothing to send')
  })
})

describe('runClosePaidConfirm', () => {
  it('says what happens to five, with the printed copies', () => {
    expect(runClosePaidConfirm({ count: 5, printed: 5 })).toEqual({
      title: 'Close the 5 paid notices?',
      lines: [
        'These jobs owe $0 now, so nothing is mailed.',
        'Each notice leaves the run and the desk.',
        'The copies that printed stay in each job’s Documents, filed as printed.',
        'A job that owes again comes back to the desk by itself.',
      ],
      button: 'Close 5 paid notices',
    })
  })

  it('says it for one, and drops the copy line when nothing printed', () => {
    const one = runClosePaidConfirm({ count: 1, printed: 1 })
    expect(one.title).toBe('Close the paid notice?')
    expect(one.lines[0]).toBe('The job owes $0 now, so nothing is mailed.')
    expect(one.lines[2]).toBe('The copy that printed stays in the job’s Documents, filed as printed.')
    expect(one.button).toBe('Close 1 paid notice')
    expect(runClosePaidConfirm({ count: 2, printed: 0 }).lines).toHaveLength(3)
  })

  it('keeps every sentence to the plain words rules', () => {
    const words = [...runClosePaidConfirm({ count: 5, printed: 5 }).lines, ...runClosePaidConfirm({ count: 1, printed: 1 }).lines, RUN_CLOSE_PAID_CAUTION, runClosedPaidWords(5), runClosedPaidWords(1)]
    for (const w of words) expect(plainWordsFailures(w), w).toEqual([])
  })
})

describe('the record on the item', () => {
  it('keeps every other field and reads back what it wrote', () => {
    const closed = { at: '2026-11-15T18:00:00Z', by: 'u1', byName: 'ZZ Office', printedAt: '2026-10-08T15:00:00Z', paperClaim: 2400 }
    const fields = fieldsWithClosedPaid({ notice: { claimAmount: '2400.00' }, gcEmail: 'x' }, closed)
    expect(fields).toMatchObject({ gcEmail: 'x', notice: { claimAmount: '2400.00' } })
    expect(runClosedPaidOf(fields)).toEqual(closed)
    expect(runClosedPaidOf({})).toBeNull()
    expect(runClosedPaidOf({ runClosedPaid: { by: 'u1' } })).toBeNull()
  })

  it('reads the paper’s claim from the stored draft', () => {
    expect(paperClaimOf({ notice: { claimAmount: '2400.00' } })).toBe(2400)
    expect(paperClaimOf({ notice: { claimAmount: '$6,150.75' } })).toBe(6150.75)
    expect(paperClaimOf({ notice: { claimAmount: '' } })).toBeNull()
    expect(paperClaimOf(null)).toBeNull()
  })

  it('closes only a live monthly notice', () => {
    expect(canClosePaidItem({ kind: 'notice_53_056', status: 'approved', voided_at: null })).toBe(true)
    expect(canClosePaidItem({ kind: 'notice_53_056', status: 'sent', voided_at: null })).toBe(false)
    expect(canClosePaidItem({ kind: 'notice_53_056', status: 'approved', voided_at: '2026-11-01T00:00:00Z' })).toBe(false)
    expect(canClosePaidItem({ kind: 'retainage_53_057', status: 'approved', voided_at: null })).toBe(false)
  })
})

describe('after the close', () => {
  it('says how many closed and takes them out of the window', () => {
    expect(runClosedPaidWords(5)).toBe('Closed 5 paid notices. Nothing was mailed.')
    expect(runClosedPaidWords(1)).toBe('Closed 1 paid notice. Nothing was mailed.')
    expect(runNoticesClosed([notice('1'), notice('2'), notice('3')], ['1', '3']).map((n) => n.itemId)).toEqual(['2'])
  })
})
