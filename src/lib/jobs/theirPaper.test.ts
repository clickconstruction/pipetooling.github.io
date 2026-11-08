import { describe, expect, it } from 'vitest'
import {
  emptyTheirPaperDraft,
  insertContractTermsIntoNarrative,
  isTheirPaperRow,
  parseTheirPaperTerms,
  theirPaperColumnsFromDraft,
  theirPaperCountsAsSigned,
  theirPaperDraftFromRecord,
  theirPaperDraftProblem,
  theirPaperFromRow,
  theirPaperLine,
  theirPaperNarrativeMarkdown,
  theirPaperTermLine,
  theirPaperWords,
  type TheirPaperRowLike,
} from './theirPaper'

const row = (over: Partial<TheirPaperRowLike> = {}): TheirPaperRowLike => ({
  id: 'c-their',
  job_id: 'job-a',
  status: 'signed',
  kind: 'their_paper',
  voided_at: null,
  paper_title: 'Harrow Builders subcontract, their form',
  our_signer_name: 'D. Vasquez',
  our_signed_on: '2026-02-09',
  our_signed_how: 'their e-sign',
  their_signed_on: null,
  relied_on_on: null,
  relied_on_what: null,
  key_terms: [
    { key: 'termination', clause: '§14.2', words: 'for convenience, 48-hour notice' },
    { key: 'default_cure', clause: '§11', words: '5 days to cure after written notice' },
  ],
  signed_document_url: 'https://drive.google.com/file/d/abc/view',
  ...over,
})

describe('their paper (punch list #173)', () => {
  it('reads the row: the signer fields, no countersignature, the terms in the record order', () => {
    const rec = theirPaperFromRow(row({ key_terms: [{ key: 'venue', clause: '§19', words: 'Brazos County, TX' }, { key: 'termination', clause: '§14.2', words: 'for convenience' }] }))
    expect(rec.title).toBe('Harrow Builders subcontract, their form')
    expect(rec.ourSigner).toBe('D. Vasquez')
    expect(rec.ourSignedOn).toBe('2026-02-09')
    expect(rec.theirSignedOn).toBeNull()
    expect(rec.reliedOn).toBeNull()
    expect(rec.documentUrl).toBe('https://drive.google.com/file/d/abc/view')
    expect(rec.terms.map((t) => t.key)).toEqual(['termination', 'venue'])
    expect(isTheirPaperRow(row())).toBe(true)
    expect(isTheirPaperRow(row({ kind: 'contract' }))).toBe(false)
    expect(isTheirPaperRow(row({ voided_at: '2026-03-01T00:00:00Z' }))).toBe(false)
    expect(isTheirPaperRow(row({ status: 'draft' }))).toBe(false)
  })

  it('the terms list drops an unknown key, a duplicate and an empty term; a non-list reads as no terms', () => {
    expect(parseTheirPaperTerms(null)).toEqual([])
    expect(parseTheirPaperTerms('x')).toEqual([])
    expect(parseTheirPaperTerms([{ key: 'rent', clause: '§1', words: 'x' }, { key: 'venue', clause: '', words: '' }, { key: 'venue', clause: '§19', words: 'Brazos' }, { key: 'venue', clause: '§20', words: 'dup' }, 7])).toEqual([{ key: 'venue', clause: '§19', words: 'Brazos' }])
  })

  it('the Can we sue rule: signed by us only does not count until they rely on it, or countersign', () => {
    const usOnly = theirPaperFromRow(row())
    expect(theirPaperCountsAsSigned(usOnly)).toBe(false)
    expect(theirPaperLine(usOnly)).toBe('Their paper · signed by us only · not relied on yet')
    const relied = theirPaperFromRow(row({ relied_on_on: '2026-10-02', relied_on_what: 'their notice of termination' }))
    expect(theirPaperCountsAsSigned(relied)).toBe(true)
    expect(relied.reliedOn).toEqual({ on: '2026-10-02', what: 'their notice of termination' })
    expect(theirPaperLine(relied)).toBe('Their paper · signed by us only · they rely on it')
    const both = theirPaperFromRow(row({ their_signed_on: '2026-02-12' }))
    expect(theirPaperCountsAsSigned(both)).toBe(true)
    expect(theirPaperLine(both)).toBe('Their paper · signed by both')
    // A relied-on flag with only its words still counts: the office said so; the date is what the form asks for.
    expect(theirPaperCountsAsSigned(theirPaperFromRow(row({ relied_on_what: 'their pay application #4' })))).toBe(true)
  })

  it('the record in one sentence, and a term in one line', () => {
    expect(theirPaperWords(theirPaperFromRow(row({ relied_on_on: '2026-10-02', relied_on_what: 'their notice of termination' })))).toBe(
      'Harrow Builders subcontract, their form, signed for us by D. Vasquez on Feb 9, 2026 (their e-sign), not countersigned. They rely on it: their notice of termination (Oct 2, 2026).',
    )
    expect(theirPaperWords(theirPaperFromRow(row({ paper_title: null, our_signed_how: null })))).toBe('Their paper, signed for us by D. Vasquez on Feb 9, 2026, not countersigned. Nothing recorded yet of them relying on it.')
    expect(theirPaperTermLine({ key: 'termination', clause: '§14.2', words: 'for convenience, 48-hour notice' })).toBe('Termination §14.2 — for convenience, 48-hour notice')
    expect(theirPaperTermLine({ key: 'venue', clause: '', words: 'Brazos County' })).toBe('Venue — Brazos County')
    expect(theirPaperTermLine({ key: 'venue', clause: '§19', words: '' })).toBe('Venue §19')
  })

  it('the draft: a signer is required, a relied-on flag needs its what and its day, a link must be a link; the columns follow', () => {
    const d = emptyTheirPaperDraft()
    expect(theirPaperDraftProblem(d)).toBe('Name who signed it for us.')
    d.ourSigner = 'D. Vasquez'
    expect(theirPaperDraftProblem(d)).toBeNull()
    d.reliedOn = true
    expect(theirPaperDraftProblem(d)).toMatch(/what they relied on it for/)
    d.reliedOnWhat = 'their notice of termination'
    expect(theirPaperDraftProblem(d)).toBe('Give the day they relied on it.')
    d.reliedOnOn = '2026-10-02'
    expect(theirPaperDraftProblem(d)).toBeNull()
    d.link = 'drive.google.com/x'
    expect(theirPaperDraftProblem(d)).toMatch(/not a link yet/)
    d.link = 'https://drive.google.com/file/d/x/view'
    d.terms.termination = { clause: '§14.2', words: 'for convenience' }
    d.terms.venue = { clause: '  ', words: '' }
    const cols = theirPaperColumnsFromDraft(d)
    expect(cols).toEqual({
      kind: 'their_paper',
      status: 'signed',
      paper_title: null,
      our_signer_name: 'D. Vasquez',
      our_signed_on: null,
      our_signed_how: null,
      their_signed_on: null,
      relied_on_on: '2026-10-02',
      relied_on_what: 'their notice of termination',
      key_terms: [{ key: 'termination', clause: '§14.2', words: 'for convenience' }],
      signed_document_url: 'https://drive.google.com/file/d/x/view',
    })
    // Untick the flag: its date and words are cleared, not kept hidden.
    d.reliedOn = false
    expect(theirPaperColumnsFromDraft(d).relied_on_on).toBeNull()
    expect(theirPaperColumnsFromDraft(d).relied_on_what).toBeNull()
    // A record opens back into the same draft.
    const back = theirPaperDraftFromRecord(theirPaperFromRow(row({ relied_on_on: '2026-10-02', relied_on_what: 'their notice' })))
    expect(back.reliedOn).toBe(true)
    expect(back.reliedOnOn).toBe('2026-10-02')
    expect(back.terms.termination).toEqual({ clause: '§14.2', words: 'for convenience, 48-hour notice' })
    expect(back.terms.venue).toEqual({ clause: '', words: '' })
  })

  it('the narrative insert: the paper in one line and a list of its terms under The contract, never twice', () => {
    const rec = theirPaperFromRow(row({ relied_on_on: '2026-10-02', relied_on_what: 'their notice of termination' }))
    const md = theirPaperNarrativeMarkdown([{ jobLabel: '891', record: rec }])
    expect(md).toBe(
      '**Harrow Builders subcontract, their form** on 891: signed for us by D. Vasquez on Feb 9, 2026 (their e-sign), not countersigned. They rely on it: their notice of termination (Oct 2, 2026).\n- Termination §14.2 — for convenience, 48-hour notice\n- Default and cure §11 — 5 days to cure after written notice',
    )
    expect(theirPaperNarrativeMarkdown([])).toBe('')
    const empty = insertContractTermsIntoNarrative('', md)
    expect(empty).toBe(`## The contract\n\n${md}\n`)
    const existing = '## The parties\n\nClick was the sub.\n\n## The contract\n\nTheir form.\n\n## What happened\n\n**Oct 2** — they terminated.\n'
    const once = insertContractTermsIntoNarrative(existing, md)
    expect(once).toContain('## The contract\n\nTheir form.\n\n**Harrow Builders subcontract, their form** on 891')
    expect(once.indexOf('## What happened')).toBeGreaterThan(once.indexOf('- Default and cure §11'))
    expect(insertContractTermsIntoNarrative(once, md)).toBe(once)
    expect(insertContractTermsIntoNarrative('## A\n\nx', '')).toBe('## A\n\nx')
  })
})
