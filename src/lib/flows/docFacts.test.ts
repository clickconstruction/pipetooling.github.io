import { describe, expect, it } from 'vitest'
import { DOC_FACT_KINDS, docFact, docFactId, docFactOf, factsWords, isDocPaperId, stepFactById, type FactId } from './facts'
import { factRead, stepTrue } from './state'

const DOC = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'

describe('papers made in the New paper window, and the facts on them', () => {
  it('names a library paper doc:<uuid> and its facts doc:<uuid>:<kind>, and nothing else', () => {
    expect(isDocPaperId(`doc:${DOC}`)).toBe(true)
    expect(isDocPaperId('doc:napkin')).toBe(false)
    expect(isDocPaperId('w9')).toBe(false)
    expect(DOC_FACT_KINDS).toEqual(['on_file', 'current', 'signed', 'sent'])
    expect(docFactId(DOC, 'signed')).toBe(`doc:${DOC}:signed`)
    expect(docFactOf(`doc:${DOC}:current`)).toEqual({ docId: DOC, kind: 'current' })
    expect(docFactOf(`doc:${DOC}:eaten`)).toBeNull()
    expect(docFactOf(`doc:${DOC}`)).toBeNull()
    expect(docFactOf('w9_signed')).toBeNull()
  })

  it('reads a library paper’s fact like the list’s, in its words', () => {
    expect(docFact(docFactId(DOC, 'signed'), 'The safety plan')).toMatchObject({ text: 'The safety plan is signed', group: 'Papers', scope: 'person', kept: 'yes' })
    expect(docFact(docFactId(DOC, 'on_file')).text).toBe('the paper is on file')
    expect(docFact(docFactId(DOC, 'sent')).text).toBe('the paper went')
    expect(stepFactById('w9_signed')?.text).toBe('their W-9 is signed')
    expect(stepFactById(docFactId(DOC, 'current'), 'The license')?.text).toBe('The license is current')
    expect(stepFactById('nope')).toBeNull()
    expect(factsWords(['w9_signed', docFactId(DOC, 'signed')], 'and')).toBe('their W-9 is signed and the paper is signed')
  })

  it('reads a stamp on a library paper through factRead, and a step finishes on it', () => {
    const id = docFactId(DOC, 'signed') as unknown as FactId
    const r = factRead([{ fact: id, mark: 'ok', at: '2026-10-01', by: null, until: null }], id)
    expect([r.mark, r.at, r.fact.text]).toEqual(['ok', '2026-10-01', 'the paper is signed'])
    expect(factRead([], id).mark).toBe('no')
    expect(stepTrue({ join: 'and' }, [r])).toBe(true)
  })
})
