import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { plainSentence } from '../valuesInPlace'
import type { LienRunLine } from './lienGetItRight'
import { buildLienRunOut, LIEN_RUN_OUT_WORDS, lienRunOutClerkLabel } from './lienRunOut'

function line(kind: LienRunLine['kind'], jobId: string, stageKey: LienRunLine['stageKey'], amount = 1000): LienRunLine {
  return { key: `${kind}:${jobId}`, kind, jobId, label: `ZZ-${jobId}`, title: `ZZ Job ${jobId}`, stage: '', stageKey, detail: '', dueYmd: '2026-11-16', amount, atRisk: false, standing: 'right', rowKey: null, press: null, leftOut: null, rightNow: false }
}
const right = [line('notice', 'n1', 'in_mail'), line('notice', 'n2', 'in_mail'), line('notice', 'n3', 'to_print'), line('affidavit', 'a1', 'ready'), line('affidavit', 'a2', 'ready'), line('affidavit', 'a3', 'ready')]
const counties: Record<string, string> = { a1: 'Marlow', a2: 'Alder', a3: 'marlow' }
const build = (over: Partial<Parameters<typeof buildLienRunOut>[0]> = {}) => buildLienRunOut({ run: { right, counts: { papers: 7, settle: 1, right: 6, leftOut: 1, toPrint: 1, toMail: 2, toFile: 3, affidavitsPrinted: 2, noticesStopped: 0 } }, printedAffidavitJobIds: new Set(['a1', 'a3']), countyOf: (id) => counties[id], changed: 1, ...over })

describe('Out the door (punch list #362, step 8)', () => {
  it('the printed notices are to mail, with the run window’s own press and its count', () => {
    const out = build()
    expect(out.show).toBe(true)
    expect(out.mail.count).toBe(2)
    expect(out.mail.lines.map((l) => l.jobId)).toEqual(['n1', 'n2'])
    expect(out.mail.press).toBe('Enter mail numbers · 2')
  })

  it('the printed affidavits are to file, a stop a clerk, by county as the batch lies, and an unprinted one is not here', () => {
    const out = build()
    expect(out.file.count).toBe(2)
    expect(out.file.clerks.map((c) => [c.label, c.lines.map((l) => l.jobId)])).toEqual([['Marlow County clerk', ['a1', 'a3']]])
    const three = build({ printedAffidavitJobIds: new Set(['a1', 'a2', 'a3']) })
    expect(three.file.clerks.map((c) => [c.label, c.lines.map((l) => l.jobId)])).toEqual([['Alder County clerk', ['a2']], ['Marlow County clerk', ['a1', 'a3']]])
  })

  it('a paper with no county on it is filed last, under its own head', () => {
    const out = build({ printedAffidavitJobIds: new Set(['a1', 'a2']), countyOf: (id) => (id === 'a1' ? '' : 'Alder') })
    expect(out.file.clerks.map((c) => c.label)).toEqual(['Alder County clerk', LIEN_RUN_OUT_WORDS.clerkUnknown])
  })

  it('a county that already says County takes clerk alone', () => {
    expect(lienRunOutClerkLabel('Bexar County')).toBe('Bexar County clerk')
    expect(lienRunOutClerkLabel(' Bexar ')).toBe('Bexar County clerk')
    expect(lienRunOutClerkLabel('')).toBe(LIEN_RUN_OUT_WORDS.clerkUnknown)
  })

  it('the tally says what printed and what is left, each value marked, and leaves out a zero', () => {
    expect(plainSentence(build().tally)).toBe('Printed 4 · 2 to mail · 2 to file · 1 left out · 1 changed since printed')
    expect(build().tally).toContain('⟪count|4⟫')
    const quiet = build({ printedAffidavitJobIds: new Set(), changed: 0, run: { right: right.slice(0, 2), counts: { papers: 2, settle: 0, right: 2, leftOut: 0, toPrint: 0, toMail: 2, toFile: 0, affidavitsPrinted: 0, noticesStopped: 0 } } })
    expect(plainSentence(quiet.tally)).toBe('Printed 2 · 2 to mail')
  })

  it('with nothing of the run printed the card is not drawn', () => {
    const out = build({ printedAffidavitJobIds: new Set(), changed: 0, run: { right: [right[2]!, right[3]!], counts: { papers: 2, settle: 0, right: 2, leftOut: 0, toPrint: 2, toMail: 0, toFile: 1, affidavitsPrinted: 0, noticesStopped: 0 } } })
    expect(out.show).toBe(false)
    expect(out.mail.count + out.file.count).toBe(0)
    expect(plainSentence(out.tally)).toBe('Printed 0')
  })

  it('the words a person reads are plain', () => {
    const words = [LIEN_RUN_OUT_WORDS.mailLead, LIEN_RUN_OUT_WORDS.fileLead, LIEN_RUN_OUT_WORDS.clerkUnknown, ...plainSentence(build().tally).split(' · ')]
    expect(words.flatMap((w) => plainWordsFailures(w))).toEqual([])
  })
})
