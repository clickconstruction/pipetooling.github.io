import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { DOCUMENT_BUILDER_TEAM, canUseDocumentBuilder } from './access'
import { BUILDER_PARAM, DOCUMENT_BUILDERS, DOCUMENT_BUILDER_WORDS, documentBuilderById, openBuilderFromSearch } from './builders'
import { firstDraftOf } from './firstDrafts'
import { readPaperDef } from './definition'

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
  it('lists the Sub NDA, a builder someone walks', () => {
    expect(DOCUMENT_BUILDERS.map((b) => [b.id, b.kind, b.name])).toEqual([['sub-nda', 'walked', 'Sub NDA']])
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
    expect(documentBuilderById('sub-nda')?.reader).toEqual({ unread: 'Not read by an attorney', readBy: 'Read by' })
    for (const b of DOCUMENT_BUILDERS) {
      expect(b.reader.unread.trim()).not.toBe('')
      expect(b.reader.readBy.trim()).not.toBe('')
    }
  })

  it('has a first draft for every builder, and a walked builder’s reads as a paper that keeps every rule', () => {
    for (const b of DOCUMENT_BUILDERS) {
      const draft = firstDraftOf(b)
      expect(draft, b.id).not.toBeNull()
      if (b.kind === 'walked') expect(readPaperDef(JSON.parse(JSON.stringify(draft))), b.id).toMatchObject({ ok: true })
    }
    expect(firstDraftOf({ id: 'nope', kind: 'filled', name: 'Nope', says: '', reader: { unread: '', readBy: '' } })).toBeNull()
  })

  it('reads in plain words', () => {
    const texts: string[] = [...Object.values(DOCUMENT_BUILDER_WORDS)]
    for (const b of DOCUMENT_BUILDERS) texts.push(b.name, b.says, b.reader.unread, b.reader.readBy)
    expect(texts.flatMap((t) => plainWordsFailures(t))).toEqual([])
  })
})
