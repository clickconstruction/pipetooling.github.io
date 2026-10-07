import { describe, expect, it } from 'vitest'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'

import { approvedPartsGoingOn, decisionsAsText, describeDecisions, itemsSentBack, resubmitCaption, resubmitChooser, resubmitHasChoice, resubmitLabel, resubmitOneKind, resubmitNothingSent, resubmitSplit, rowCallWords, startDraftLabel, summarizeDecisions } from './reviewDecisions'

const it_ = (o: Record<string, unknown>) => ({ tag: 'X-1', status: 'alternate', submitted_label: 'THING', submitted_model: null, review_decision: null, review_note: null, reviewed_by_name: null, reviewed_at: null, ...o })

describe('reviewDecisions', () => {
  const items = [
    it_({ tag: 'WC-1', status: 'as_specified' }),
    it_({ tag: 'DWH-1', review_decision: 'approved', reviewed_by_name: 'Dana W.', reviewed_at: '2026-09-16T15:00:00Z' }),
    it_({ tag: 'FV-1', status: 'design_change', review_decision: 'revise', review_note: 'hold 1.0 gpf', reviewed_by_name: 'Dana W.', reviewed_at: '2026-09-16T15:00:00Z' }),
    it_({ tag: 'RD-2', review_decision: 'rejected', reviewed_by_name: 'Tom R.', reviewed_at: '2026-09-17T15:00:00Z' }),
    it_({ tag: 'RPZ-1' }),
    it_({ tag: 'PRV-1', status: 'missing' }),
  ]
  it('summarizes: decided, the three kinds, the open differing rows, who decided', () => {
    const s = summarizeDecisions(items)
    // Of the three rows with no answer, PRV-1 has no product: there is nothing on it for the reviewer to answer.
    expect(s).toEqual({ decided: 3, approved: 1, revise: 1, rejected: 1, open: 1, noAnswer: 3, noProduct: 1, sentBack: 2, byName: ['Dana W.', 'Tom R.'], entered: 0, enteredBy: [] })
    expect(describeDecisions(s)).toBe('1 approved · 1 revise · 1 rejected · by Dana W., Tom R.')
    expect(describeDecisions(summarizeDecisions([it_({})]))).toBe('')
  })
  it('writes the copyable text and picks the rows sent back', () => {
    expect(decisionsAsText(items, 'Rev 2 · BP398 ZZ Test', APP_CALENDAR_TZ)).toBe(['Rev 2 · BP398 ZZ Test', 'DWH-1 · THING — Approved (Dana W. · Sep 16)', 'FV-1 · THING — Revise: "hold 1.0 gpf" (Dana W. · Sep 16)', 'RD-2 · THING — Rejected (Tom R. · Sep 17)'].join('\n'))
    expect(decisionsAsText([it_({})], 'Rev 1', APP_CALENDAR_TZ)).toBe('Rev 1\n(no decisions yet)')
    expect(itemsSentBack(items).map((i) => i.tag)).toEqual(['FV-1', 'RD-2'])
  })

  it('entered decisions (5b) count, name who typed them, and read so in the text', () => {
    const entered = [
      it_({ tag: 'DWH-1', review_decision: 'approved', reviewed_by_name: 'Dana W.', reviewed_at: '2026-09-17T15:00:00Z', decision_source: 'entered', decision_entered_by_name: 'Wendi' }),
      it_({ tag: 'RD-2', review_decision: 'revise', reviewed_by_name: 'Dana W.', reviewed_at: '2026-09-17T15:00:00Z', decision_source: 'entered', decision_entered_by_name: null }),
      it_({ tag: 'FV-1', review_decision: 'rejected', reviewed_by_name: 'Tom R.', reviewed_at: '2026-09-17T15:00:00Z', decision_source: 'room' }),
    ]
    const s = summarizeDecisions(entered)
    expect(s.entered).toBe(2)
    expect(s.enteredBy).toEqual(['Wendi', 'the office'])
    expect(describeDecisions(s)).toBe('1 approved · 1 revise · 1 rejected · by Dana W., Tom R. · 2 entered by Wendi, the office')
    expect(decisionsAsText(entered, 'Rev 2', APP_CALENDAR_TZ).split('\n')[1]).toBe('DWH-1 · THING — Approved (Dana W. · entered by Wendi · Sep 17)')
  })
  it('2026-10-03 · a resubmit leaves only the approved rows behind: a row with no answer goes on with the rows sent back', () => {
    const split = resubmitSplit(items)
    expect(split.sentBack.map((i) => i.tag)).toEqual(['FV-1', 'RD-2'])
    expect(split.approved.map((i) => i.tag)).toEqual(['DWH-1'])
    // As specified, missing or differing: a row nobody answered is not approved, so it is carried.
    expect(split.noAnswer.map((i) => i.tag)).toEqual(['WC-1', 'RPZ-1', 'PRV-1'])
  })

  it('2026-10-05 · the button says what it does, and the line beside it says the rows are chosen next and nothing is sent', () => {
    expect(resubmitLabel(3)).toBe('Start a Rev 3 draft…')
    expect(resubmitNothingSent(2)).toBe('Nothing is sent. The GC sees Rev 2 only after you press Share.')
    expect(resubmitCaption(2)).toBe('You choose the rows next. Nothing is sent. The GC sees Rev 2 only after you press Share.')
    expect(startDraftLabel(1)).toBe('Start the draft with 1 row')
    expect(startDraftLabel(14)).toBe('Start the draft with 14 rows')
    expect(startDraftLabel(23, true)).toBe('Start the draft with all 23 rows')
    expect(startDraftLabel(1, true)).toBe('Start the draft with 1 row')
  })
  it('2026-10-05 · one button, and the question holds the choice: the rows that need it, or every row, each beside what happens to the approved rows', () => {
    // Four sent back, ten with no answer, nine approved.
    expect(resubmitChooser(1, { sentBack: 4, noAnswer: 10, approved: 9, needTotal: 14, everyTotal: 23 })).toEqual({
      title: 'Start a Rev 2 draft',
      lead: 'Which rows go on Rev 2?',
      choices: [
        { key: 'need', label: 'Only the rows that need it', detail: '4 sent back and 10 with no answer. The 9 rows approved stay on Rev 1 and on the procurement log.' },
        { key: 'every', label: 'Every row', detail: 'The 9 rows approved go on Rev 2 too. The GC answers every row and every part again. Use it when a product changed.' },
      ],
      foot: 'Rev 2 starts as a draft. Nothing is sent. The GC sees Rev 2 only after you press Share.',
      confirmLabel: { need: 'Start the draft with 14 rows', every: 'Start the draft with all 23 rows' },
    })
    // No row approved, but a part was: the rows are the same, and Every row asks that part again.
    expect(resubmitChooser(1, { sentBack: 1, noAnswer: 0, approved: 0, approvedParts: 2, needTotal: 1, everyTotal: 1 }).choices.map((c) => c.detail)).toEqual([
      'The 1 row sent back. No row was approved on Rev 1.',
      'The same rows go on it. The GC answers every part again, the approved parts too. Use it when a product changed.',
    ])
    // One sent back, thirteen approved, and a row the GC never sees: it rides along either way.
    const late = resubmitChooser(2, { sentBack: 1, noAnswer: 0, approved: 13, orderOnly: 1, needTotal: 2, everyTotal: 15 })
    expect(late.title).toBe('Start a Rev 3 draft')
    expect(late.choices.map((c) => c.detail)).toEqual([
      'The 1 row sent back. 1 row you buy without the GC goes on it too. The 13 rows approved stay on Rev 2 and on the procurement log.',
      'The 13 rows approved go on Rev 3 too. The GC answers every row and every part again. Use it when a product changed.',
    ])
    expect(late.confirmLabel).toEqual({ need: 'Start the draft with 2 rows', every: 'Start the draft with all 15 rows' })
    expect(resubmitChooser(1, { sentBack: 1, noAnswer: 1, approved: 1, needTotal: 2, everyTotal: 3 }).choices.map((c) => c.detail)).toEqual([
      '1 sent back and 1 with no answer. The 1 row approved stays on Rev 1 and on the procurement log.',
      'The 1 row approved goes on Rev 2 too. The GC answers every row and every part again. Use it when a product changed.',
    ])
  })
  it('2026-10-05 · with nothing approved both drafts are the same one, so there is no choice and the question is asked once', () => {
    expect(resubmitHasChoice({ approved: 0 })).toBe(false)
    expect(resubmitHasChoice({ approved: 0, approvedParts: 0 })).toBe(false)
    expect(resubmitHasChoice({ approved: 1 })).toBe(true)
    expect(resubmitHasChoice({ approved: 0, approvedParts: 1 })).toBe(true)
    // BP375 on 2026-10-05: four sent back, ten with no answer, nothing approved.
    expect(resubmitOneKind(1, { sentBack: 4, noAnswer: 10, approved: 0, needTotal: 14, everyTotal: 14 })).toEqual({
      title: 'Start a Rev 2 draft',
      message: 'Every row goes on Rev 2. 4 sent back and 10 with no answer. No row was approved on Rev 1. Rev 2 starts as a draft. Nothing is sent. The GC sees Rev 2 only after you press Share.',
      confirmLabel: 'Start the draft with 14 rows',
    })
    // Approved parts count only on rows that go on, and only parts the GC sees.
    const rows = [
      { id: 'a', review_decision: 'approved' },
      { id: 'b', review_decision: 'rejected' },
      { id: 'c', review_decision: null },
    ]
    const part = (review_decision: string | null, on_submittal = true) => ({ on_submittal, review_decision })
    const partsOf = new Map([
      ['a', [part('approved'), part('approved')]],
      ['b', [part('approved'), part('rejected'), part('approved', false)]],
      ['c', [part(null), part('approved')]],
    ])
    expect(approvedPartsGoingOn(rows, partsOf)).toBe(2)
    expect(approvedPartsGoingOn(rows, new Map())).toBe(0)
  })
  it('2026-10-03 · a row says what each part got: one word only when every part the GC sees has the same answer', () => {
    const part = (review_decision: string | null, on_submittal = true) => ({ on_submittal, review_decision })
    // BP375's LAV-1: one faucet rejected, the sink and the grid drain not answered.
    expect(rowCallWords('rejected', [part(null), part('rejected'), part(null)])).toEqual({ head: '1 of 3 rejected', tone: 'rejected', rest: '2 with no answer yet' })
    expect(rowCallWords('rejected', [part('rejected'), part('rejected')])).toEqual({ head: 'Rejected', tone: 'rejected', rest: '' })
    expect(rowCallWords('revise', [part('approved'), part('revise'), part('approved'), part(null)])).toEqual({ head: '1 of 4 to revise', tone: 'revise', rest: '2 approved · 1 with no answer yet' })
    expect(rowCallWords('rejected', [part('approved'), part('revise'), part('rejected')])).toEqual({ head: '1 of 3 rejected', tone: 'rejected', rest: '1 approved · 1 to revise' })
    // Some approved and the rest open: the row itself has no call yet.
    expect(rowCallWords(null, [part('approved'), part(null)])).toEqual({ head: '1 of 2 approved', tone: 'approved', rest: '1 with no answer yet' })
    expect(rowCallWords('approved', [part('approved'), part('approved'), part(null, false)])).toEqual({ head: 'Approved', tone: 'approved', rest: '' })
    // No parts the GC sees: the row's own word. Nothing answered: nothing to say.
    expect(rowCallWords('revise')).toEqual({ head: 'Revise', tone: 'revise', rest: '' })
    expect(rowCallWords(null, [part(null), part(null)])).toBeNull()
    expect(rowCallWords(null)).toBeNull()
  })

  it('2026-10-03 · the summary counts a row sent back for one part apart from a row sent back whole', () => {
    const rows = [
      it_({ id: 'lav', tag: 'LAV-1', review_decision: 'rejected', reviewed_by_name: 'structura' }),
      it_({ id: 'mop', tag: 'MOP', review_decision: 'rejected', reviewed_by_name: 'structura' }),
      it_({ id: 'wc', tag: 'WC-1', review_decision: 'revise', reviewed_by_name: 'structura' }),
      it_({ id: 'fd', tag: 'FD' }),
    ]
    const parts = new Map([
      ['lav', [{ on_submittal: true, review_decision: null }, { on_submittal: true, review_decision: 'rejected' }]],
      ['mop', [{ on_submittal: true, review_decision: 'rejected' }, { on_submittal: false, review_decision: null }]],
      ['wc', [{ on_submittal: true, review_decision: 'revise' }, { on_submittal: true, review_decision: 'approved' }]],
    ])
    const s = summarizeDecisions(rows, parts)
    expect(s).toMatchObject({ rejected: 2, revise: 1, sentBack: 3, rejectedInPart: 1, reviseInPart: 1 })
    expect(describeDecisions(s)).toBe('1 with a part to revise · 1 rejected · 1 with a part rejected · by structura')
    // With no parts given the words are what they were.
    expect(describeDecisions(summarizeDecisions(rows))).toBe('1 revise · 2 rejected · by structura')
  })
})
