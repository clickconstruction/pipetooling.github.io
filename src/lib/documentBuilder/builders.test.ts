import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { DOCUMENT_BUILDER_TEAM, canUseDocumentBuilder } from './access'
import { BUILDER_PARAM, DOCUMENT_BUILDERS, DOCUMENT_BUILDER_WORDS, documentBuilderById, openBuilderFromSearch, type DocumentBuilderEntry } from './builders'
import { firstDraftOf } from './firstDrafts'
import { readPaperDef } from './definition'
import { parseSheetDef } from './sheet'

describe('who opens the Document builder', () => {
  it('is a dev and nobody else', () => {
    expect(DOCUMENT_BUILDER_TEAM).toEqual(['dev'])
    expect(canUseDocumentBuilder('dev')).toBe(true)
    for (const role of ['master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'helper', 'subcontractor', null, undefined, '']) {
      expect(canUseDocumentBuilder(role), String(role)).toBe(false)
    }
  })
})

describe('the registry', () => {
  it('lists the Sub NDA, a builder someone walks, and the insurance sheet, a builder each job fills', () => {
    expect(DOCUMENT_BUILDERS.map((b) => [b.id, b.kind, b.name])).toEqual([
      ['sub-nda', 'walked', 'Sub NDA'],
      ['insurance', 'filled', 'Insurance requirements for subs'],
    ])
  })

  it('gives every builder its own name in the address', () => {
    const ids = DOCUMENT_BUILDERS.map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9-]*$/)
  })

  it('finds a builder by its name, and nothing for a name it does not know', () => {
    expect(documentBuilderById('sub-nda')?.name).toBe('Sub NDA')
    expect(documentBuilderById('nope')).toBeNull()
    expect(documentBuilderById(null)).toBeNull()
    expect(documentBuilderById(undefined)).toBeNull()
  })

  it('opens the builder the address names, and the list for any other address', () => {
    expect(BUILDER_PARAM).toBe('builder')
    expect(openBuilderFromSearch('?tab=builder&builder=sub-nda')?.id).toBe('sub-nda')
    expect(openBuilderFromSearch('tab=builder&builder=sub-nda')?.id).toBe('sub-nda')
    expect(openBuilderFromSearch('?tab=builder')).toBeNull()
    expect(openBuilderFromSearch('?tab=builder&builder=nope')).toBeNull()
    expect(openBuilderFromSearch('')).toBeNull()
  })

  it('names who reads each builder before it goes out', () => {
    expect(documentBuilderById('sub-nda')?.reader).toMatchObject({ unread: 'Not read by an attorney', readBy: 'Read by', markIt: 'Mark it read', who: 'The attorney who read it' })
    expect(documentBuilderById('sub-nda')?.reader.markPress(2)).toBe('Mark revision 2 as read')
    expect(documentBuilderById('insurance')?.reader).toMatchObject({ unread: 'Not checked by your insurance agent', readBy: 'Checked by', markIt: 'Mark it checked' })
    expect(documentBuilderById('insurance')?.reader.markPress(1)).toBe('Mark your usual, revision 1, as checked')
  })

  it('has a first draft for every builder, and a walked builder’s reads as a paper that keeps every rule', () => {
    for (const b of DOCUMENT_BUILDERS) {
      const draft = firstDraftOf(b)
      expect(draft, b.id).not.toBeNull()
      if (b.kind === 'walked') expect(readPaperDef(JSON.parse(JSON.stringify(draft))), b.id).toMatchObject({ ok: true })
      if (b.kind === 'filled') expect(parseSheetDef(JSON.parse(JSON.stringify(draft))), b.id).toMatchObject({ ok: true })
    }
    expect(firstDraftOf({ ...DOCUMENT_BUILDERS[0], id: 'nope' } as DocumentBuilderEntry)).toBeNull()
  })

  it('reads in plain words', () => {
    const texts: string[] = [...Object.values(DOCUMENT_BUILDER_WORDS)]
    for (const b of DOCUMENT_BUILDERS) texts.push(b.name, b.says, b.reader.unread, b.reader.readBy, b.reader.markIt, b.reader.who, b.reader.markPress(3))
    expect(texts.flatMap((t) => plainWordsFailures(t))).toEqual([])
  })
})
