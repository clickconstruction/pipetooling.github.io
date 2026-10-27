import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import type { StageProgressRow } from './stageProgressReport'
import { DRAFT_WORDS, applyDraft, centsWords, draftNotesText, draftRequest, draftedLineWords, parseDraft, type ReportDraft } from './voiceDraft'

const row = (fixtureId: string, name: string, p: Partial<StageProgressRow> = {}): StageProgressRow =>
  ({ fixtureId, name, stage: null, stageOrder: null, isStage: false, drawPaid: false, recordedPct: null, ...p }) as unknown as StageProgressRow

const LINES: StageProgressRow[] = [row('f-rough', 'Rough In'), row('f-top', 'Top Out'), row('f-trim', 'Trim Set'), row('f-wh', 'Water heater', { drawPaid: true })]

const DRAFT: ReportDraft = {
  notes: { done: 'Rough-in is done. The tub is set.', parts: 'two 3/4 PEX couplings, one tub shoe', next: 'top-out tomorrow morning' },
  lines: [
    { id: 'f-rough', pct: 100, from: 'rough-in is done' },
    { id: 'f-wh', pct: 100, from: 'water heater is in' },
    { id: 'f-nope', pct: 50, from: 'the thing' },
  ],
  language: 'en',
}

describe('draftRequest', () => {
  it('sends the words, the job, the lines as they stand and the text fields', () => {
    const r = draftRequest({
      transcript: 'rough-in is done',
      lang: 'en-US',
      jobName: 'Whitfield (1104)',
      lines: LINES,
      picks: { 'f-top': 25 },
      fields: [
        { label: 'How complete is the job?', input_type: 'percent_0_100' },
        { label: 'Notes', input_type: 'long_text' },
        { label: 'Signature', input_type: 'signature_png' },
      ],
    })
    expect(r.lines).toEqual([
      { id: 'f-rough', name: 'Rough In', pct: 0 },
      { id: 'f-top', name: 'Top Out', pct: 25 },
      { id: 'f-trim', name: 'Trim Set', pct: 0 },
      { id: 'f-wh', name: 'Water heater', pct: 100 },
    ])
    expect(r.fields).toEqual(['Notes'])
    expect(r.jobName).toBe('Whitfield (1104)')
    expect(draftRequest({ transcript: 'x', lang: '', jobName: '', lines: null, picks: {}, fields: [] }).lines).toEqual([])
  })
})

describe('parseDraft', () => {
  it('reads the function’s answer and refuses anything else', () => {
    expect(parseDraft({ notes: { done: ' Done. ', parts: '', next: 'x' }, lines: [{ id: 'a', pct: 50.4, from: 'half' }, { id: 'b', pct: 'no' }], language: 'ES' })).toEqual({
      notes: { done: 'Done.', parts: '', next: 'x' },
      lines: [{ id: 'a', pct: 50, from: 'half' }],
      language: 'es',
    })
    expect(parseDraft(null)).toBeNull()
    expect(parseDraft({ lines: [] })).toBeNull()
  })
})

describe('applyDraft', () => {
  it('writes Notes in three lines under what it held, picks only the job’s open lines, and marks both', () => {
    const out = applyDraft(DRAFT, { notesLabel: 'Notes', notesValue: 'Typed first.', lines: LINES })
    expect(out.notesValue).toBe('Typed first.\n\nRough-in is done. The tub is set.\nParts: two 3/4 PEX couplings, one tub shoe\nNext: top-out tomorrow morning')
    expect(out.picks).toEqual([{ id: 'f-rough', pct: 100, from: 'rough-in is done' }])
    expect(out.draftedFields).toEqual(['Notes'])
    expect(out.draftedLines).toEqual(['f-rough'])
  })

  it('leaves Notes alone when the draft says nothing for it', () => {
    const out = applyDraft({ ...DRAFT, notes: { done: '', parts: '', next: '' } }, { notesLabel: 'Notes', notesValue: 'Typed.', lines: LINES })
    expect(out.notesValue).toBe('Typed.')
    expect(out.draftedFields).toEqual([])
    expect(draftNotesText({ done: 'Done.', parts: '', next: '' })).toBe('Done.')
  })

  it('lists the lines it set with the words they came from', () => {
    expect(draftedLineWords(DRAFT, LINES)).toEqual(['Rough In → 100, from “rough-in is done”', 'Water heater → 100, from “water heater is in”'])
  })
})

describe('the words', () => {
  it('hold to the plain-words rule and say the cost plainly', () => {
    for (const w of [DRAFT_WORDS.mark, DRAFT_WORDS.drafting, DRAFT_WORDS.noKey, DRAFT_WORDS.failed, DRAFT_WORDS.drafted(22, 0.6), DRAFT_WORDS.drafted(22, 2.4), DRAFT_WORDS.drafted(22, null)]) {
      expect(plainWordsFailures(w)).toEqual([])
    }
    expect(DRAFT_WORDS.drafted(21.6, 0.6)).toBe('Drafted from 22 seconds of talk. Less than a cent. Read it, then save.')
    expect(centsWords(1.2)).toBe('About 1 cent.')
    expect(centsWords(2.6)).toBe('About 3 cents.')
    expect(DRAFT_WORDS.foldTitle('es')).toBe('Lo que dijiste')
    expect(DRAFT_WORDS.foldTitle('en')).toBe('What you said')
  })
})
