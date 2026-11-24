import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { plainSentence } from '../valuesInPlace'
import type { LienGetItRight, LienRunLine } from './lienGetItRight'
import { LIEN_RUN_PRINT_WORDS, lienRunPrintedWords, lienRunPrintPlan, lienRunPrintPress } from './lienRunPrint'

function line(over: Partial<LienRunLine>): LienRunLine {
  return { key: `${over.kind ?? 'notice'}:${over.jobId ?? 'j'}`, kind: 'notice', jobId: 'j', label: '1001', title: 'ZZ Sample Shop', stage: 'Approved · to print', stageKey: 'to_print', detail: '', dueYmd: '2026-11-16', amount: 100, atRisk: false, standing: 'right', rowKey: null, press: null, leftOut: null, rightNow: false, ...over } as LienRunLine
}

function run(over: Partial<Pick<LienGetItRight, 'asked' | 'settle' | 'right' | 'leftOut'>>): LienGetItRight {
  const asked = over.asked ?? []
  const settle = over.settle ?? []
  const right = over.right ?? []
  const leftOut = over.leftOut ?? []
  return { day: '2026-11-16', dayWords: 'tomorrow', asked, settle, right, leftOut, counts: { papers: asked.length + settle.length + right.length, settle: asked.length + settle.length, right: right.length, leftOut: leftOut.length, toPrint: 0, toMail: 0, toFile: 0 }, totals: { run: 0, waits: 0, right: 0 }, step: 1, steps: [] as unknown as LienGetItRight['steps'], rightParts: '' }
}

const REASON = (l: LienRunLine) => (l.leftOut ? 'The customer is paying' : '')

describe('what the one print takes from the run', () => {
  it('takes the notices that are right and still to print, and the affidavits that are right', () => {
    const plan = lienRunPrintPlan(
      run({
        right: [
          line({ kind: 'notice', jobId: 'n1', stageKey: 'to_print' }),
          // Printed already: in the run, never printed again by the press.
          line({ kind: 'notice', jobId: 'n2', stageKey: 'in_mail', stage: 'Approved · to mail' }),
          line({ kind: 'affidavit', jobId: 'a1', stageKey: 'ready', stage: 'Ready to file' }),
        ],
      }),
      REASON,
    )
    expect([...plan.noticeJobIds]).toEqual(['n1'])
    expect([...plan.affidavitJobIds]).toEqual(['a1'])
    expect(plan.held).toBe(0)
    expect(plan.leftOut).toBe(0)
    expect(plan.affidavitLeftOut).toEqual([])
  })

  it('never takes a paper with an open question, one asked about again, or one left out, even when it could print', () => {
    const plan = lienRunPrintPlan(
      run({
        settle: [line({ kind: 'notice', jobId: 'n-sign', standing: 'settle', stageKey: 'to_sign', stage: 'Approved · to sign' }), line({ kind: 'affidavit', jobId: 'a-fact', standing: 'settle', stageKey: 'needs_property', stage: 'Needs the property facts', detail: 'Nobody has answered whether this home is a homestead', label: '1021', title: 'ZZ Home' })],
        asked: [line({ kind: 'affidavit', jobId: 'a-asked', standing: 'asked_again', stageKey: 'ready', stage: 'Ready to file', rightNow: true, label: '1030', title: 'ZZ Asked' })],
        leftOut: [line({ kind: 'affidavit', jobId: 'a-out', standing: 'left_out', stageKey: 'ready', stage: 'Ready to file', rightNow: true, label: '1040', title: 'ZZ Out', leftOut: { id: 'r1' } as LienRunLine['leftOut'] }), line({ kind: 'notice', jobId: 'n-out', standing: 'left_out', stageKey: 'to_print', rightNow: true })],
        right: [line({ kind: 'affidavit', jobId: 'a1', stageKey: 'ready', stage: 'Ready to file' })],
      }),
      REASON,
    )
    expect([...plan.noticeJobIds]).toEqual([])
    expect([...plan.affidavitJobIds]).toEqual(['a1'])
    expect(plan.held).toBe(3)
    expect(plan.leftOut).toBe(2)
    // The help sheet names each affidavit of the run that does not print, with its reason. A notice is not its paper.
    expect(plan.affidavitLeftOut).toEqual([
      { jobLabel: '1021 · ZZ Home', reason: 'Not right yet. Needs the property facts: Nobody has answered whether this home is a homestead.' },
      { jobLabel: '1030 · ZZ Asked', reason: 'Left out of an earlier run. Nobody has answered for this one yet.' },
      { jobLabel: '1040 · ZZ Out', reason: 'Left out of this run. The customer is paying.' },
    ])
  })
})

describe('the press', () => {
  it('with nothing held it is the run, with its count', () => {
    expect(lienRunPrintPress({ notices: 6, affidavits: 10, held: 0, reading: false })).toEqual({ label: 'Print the run · 16 papers', dead: false, foot: null, papers: 16 })
    expect(lienRunPrintPress({ notices: 1, affidavits: 0, held: 0, reading: false }).label).toBe('Print the run · 1 paper')
  })

  it('with some held it prints what is right and says what it held: a hold on one paper never stops the rest', () => {
    const p = lienRunPrintPress({ notices: 2, affidavits: 10, held: 4, reading: false })
    expect(p.label).toBe('Print 12 papers · 4 wait on step 1 ▸')
    expect(p.dead).toBe(false)
    expect(plainSentence(p.foot!)).toBe('4 papers are not right yet. Settle each above, or leave it out. The 12 that are right print now.')
    const one = lienRunPrintPress({ notices: 1, affidavits: 0, held: 1, reading: false })
    expect(one.label).toBe('Print 1 paper · 1 waits on step 1 ▸')
    expect(plainSentence(one.foot!)).toBe('1 paper is not right yet. Settle it above, or leave it out. The 1 that is right prints now.')
  })

  it('is dead only when nothing is right, and says why', () => {
    const none = lienRunPrintPress({ notices: 0, affidavits: 0, held: 3, reading: false })
    expect(none).toMatchObject({ label: 'Print the run ▸', dead: true, papers: 0 })
    expect(plainSentence(none.foot!)).toBe('No paper is right yet. Settle the 3 above, or leave each out.')
    expect(lienRunPrintPress({ notices: 0, affidavits: 0, held: 0, reading: false })).toEqual({ label: 'Print the run', dead: true, foot: null, papers: 0 })
  })

  it('waits for the notices’ bills: a notice never prints without its enclosures', () => {
    const p = lienRunPrintPress({ notices: 6, affidavits: 10, held: 0, reading: true })
    expect(p.dead).toBe(true)
    expect(p.label).toBe('Print the run · reading the bills…')
    expect(p.papers).toBe(16)
  })

  it('keeps to plain words', () => {
    const feet = [lienRunPrintPress({ notices: 2, affidavits: 10, held: 4, reading: false }).foot!, lienRunPrintPress({ notices: 0, affidavits: 0, held: 3, reading: false }).foot!, lienRunPrintPress({ notices: 6, affidavits: 0, held: 0, reading: true }).foot!]
    for (const f of feet) for (const sentence of plainSentence(f).split(/(?<=\.)\s+/)) expect(plainWordsFailures(sentence)).toEqual([])
    for (const w of [LIEN_RUN_PRINT_WORDS.twoPrints, LIEN_RUN_PRINT_WORDS.cannotStack, LIEN_RUN_PRINT_WORDS.nothing, LIEN_RUN_PRINT_WORDS.next, LIEN_RUN_PRINT_WORDS.nextNotices, LIEN_RUN_PRINT_WORDS.nextAffidavits]) for (const sentence of w.split(/(?<=\.)\s+/)) expect(plainWordsFailures(sentence)).toEqual([])
  })
})

describe('after the press', () => {
  it('says when it printed and what, each count a value', () => {
    expect(plainSentence(lienRunPrintedWords({ notices: 6, affidavits: 10, atWords: '10:02 AM' }))).toBe('Printed at 10:02 AM: 6 notices and 10 affidavits.')
    expect(plainSentence(lienRunPrintedWords({ notices: 1, affidavits: 0, atWords: '10:02 AM' }))).toBe('Printed at 10:02 AM: 1 notice.')
    expect(plainSentence(lienRunPrintedWords({ notices: 0, affidavits: 1, atWords: '10:02 AM' }))).toBe('Printed at 10:02 AM: 1 affidavit.')
  })
})
