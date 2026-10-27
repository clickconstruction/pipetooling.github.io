import { describe, expect, it } from 'vitest'
import { answersNarrativeMarkdown, autoContractGapAnswer, gapAnswerByline, gapAnswerCounts, gapAnswersByKey, insertAnswersIntoNarrative } from './legalGapAnswers'
import type { JobContractCoverage } from '../jobs/jobContractCoverage'

const notNeeded: JobContractCoverage = { kind: 'not_needed', at: '2026-05-02T15:00:00Z', reason: 'T&M service call, owner’s call' }

describe('autoContractGapAnswer', () => {
  it('reads the job’s contract-not-needed mark as an answer, nothing retyped', () => {
    const a = autoContractGapAnswer(notNeeded)
    expect(a).not.toBeNull()
    expect(a?.text).toBe('Marked contract not needed on the job: “T&M service call, owner’s call”.')
    expect(a?.ymd).toBe('2026-05-02')
    expect(a?.auto).toBe('contract_not_needed')
  })
  it('without a reason the line still reads, and other coverages answer nothing', () => {
    expect(autoContractGapAnswer({ kind: 'not_needed', at: '2026-05-02', reason: null })?.text).toBe('Marked contract not needed on the job.')
    expect(autoContractGapAnswer({ kind: 'none' })).toBeNull()
  })
})

describe('gapAnswersByKey', () => {
  it('keys the auto answers by the gap’s own key and lets a typed answer win over them', () => {
    const typed = { gapKey: 'contract:j1', text: 'Handshake at the walk of May 2.', by: 'Taunya', ymd: '2026-10-26', documentId: 'd1', documentTitle: 'Delivery tickets' }
    const map = gapAnswersByKey([typed, { gapKey: 'evidence:j1', text: '  ', by: null, ymd: '', documentId: null, documentTitle: '' }], [
      { jobId: 'j1', coverage: notNeeded },
      { jobId: 'j2', coverage: notNeeded },
    ])
    expect(map.get('contract:j1')?.text).toBe('Handshake at the walk of May 2.')
    expect(map.get('contract:j1')?.auto).toBeNull()
    expect(map.get('contract:j2')?.auto).toBe('contract_not_needed')
    expect(map.has('evidence:j1')).toBe(false)
  })
})

describe('gapAnswerCounts', () => {
  it('keeps every stop a stop, moves an answered warn out of the count, and counts every answer', () => {
    const a = { text: 'x', by: null, ymd: '', documentId: null, documentTitle: '', auto: null }
    expect(
      gapAnswerCounts([
        { severity: 'stop', answer: a },
        { severity: 'stop' },
        { severity: 'warn', answer: a },
        { severity: 'warn' },
      ]),
    ).toEqual({ stops: 2, warns: 1, answered: 2 })
  })
})

describe('gapAnswerByline', () => {
  it('names who and when, and where an auto answer was read from', () => {
    expect(gapAnswerByline({ text: 'x', by: 'Roxi', ymd: '2026-10-25', documentId: null, documentTitle: '', auto: null })).toBe('answered by Roxi · 2026-10-25')
    expect(gapAnswerByline({ text: 'x', by: null, ymd: '', documentId: null, documentTitle: '', auto: null })).toBe('answered')
    expect(gapAnswerByline({ text: 'x', by: null, ymd: '2026-05-02', documentId: null, documentTitle: '', auto: 'contract_not_needed' })).toBe('read from the job’s contract strip · nothing to retype')
  })
})

describe('answersNarrativeMarkdown + insertAnswersIntoNarrative (v2.5923)', () => {
  const a = { text: 'The work ran on a handshake.', by: 'Taunya', ymd: '2026-10-26', documentId: 'd1', documentTitle: 'Delivery tickets, May', auto: null }
  const gaps = [
    { label: 'No signed agreement on 714', answer: a },
    { label: 'Never asked when they would pay', answer: null },
    { label: 'No field evidence on 713', answer: { ...a, documentTitle: '', documentId: null } },
  ]
  it('lists only the answered gaps, the document named in parens', () => {
    expect(answersNarrativeMarkdown(gaps)).toBe(
      '- **No signed agreement on 714** — The work ran on a handshake. (Delivery tickets, May)\n- **No field evidence on 713** — The work ran on a handshake.',
    )
    expect(answersNarrativeMarkdown([{ label: 'x', answer: null }])).toBe('')
  })
  it('pastes under its own heading, idempotently, and appends to an existing section', () => {
    const md = answersNarrativeMarkdown(gaps)
    const once = insertAnswersIntoNarrative('## Why we will win\n\nBecause.', md)
    expect(once).toContain('## What the office already answered')
    expect(insertAnswersIntoNarrative(once, md)).toBe(once)
    const sectioned = insertAnswersIntoNarrative('## What the office already answered\n\n- **Old line** — kept.\n\n## Next\n\nText.', md)
    expect(sectioned.indexOf('- **Old line**')).toBeLessThan(sectioned.indexOf('- **No signed agreement on 714**'))
    expect(sectioned.indexOf('- **No field evidence on 713**')).toBeLessThan(sectioned.indexOf('## Next'))
  })
})
