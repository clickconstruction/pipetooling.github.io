import { describe, expect, it } from 'vitest'
import { NOTE_BODY_MAX, NOTE_STARTS, canSendNote, isNoteKind, noteBody, noteKindChip, noteStart, wordlessNoteLine } from './starts'

describe('the three starts', () => {
  it('are the owner’s two and the one for a fault, in that order', () => {
    expect(NOTE_STARTS.map((s) => s.label)).toEqual(['I want…', 'This page is confusing because…', 'Something went wrong when I…'])
    expect(NOTE_STARTS.map((s) => s.kind)).toEqual(['want', 'confusing', 'broken'])
  })

  it('each label is its lead with the dots', () => {
    for (const s of NOTE_STARTS) expect(s.label).toBe(`${s.lead}…`)
  })

  it('only I want needs words', () => {
    expect(NOTE_STARTS.filter((s) => s.needsWords).map((s) => s.kind)).toEqual(['want'])
  })

  it('knows a kind from another word', () => {
    expect(isNoteKind('broken')).toBe(true)
    expect(isNoteKind('guide')).toBe(false)
    expect(isNoteKind(null)).toBe(false)
    expect(noteStart('confusing').chip).toBe('Confusing')
  })

  it('chips a guide’s note and an unknown kind as Guide', () => {
    expect(noteKindChip('want')).toBe('Want')
    expect(noteKindChip('broken')).toBe('Went wrong')
    expect(noteKindChip('guide')).toBe('Guide')
    expect(noteKindChip(undefined)).toBe('Guide')
  })
})

describe('noteBody', () => {
  it('opens the note with the start’s words', () => {
    expect(noteBody('want', 'the PO number on the first line')).toBe('I want the PO number on the first line')
    expect(noteBody('broken', 'added a photo')).toBe('Something went wrong when I added a photo')
  })

  it('does not say the start twice', () => {
    expect(noteBody('want', 'i want a bigger button')).toBe('i want a bigger button')
  })

  it('folds line breaks and runs of spaces', () => {
    expect(noteBody('confusing', '  two totals\n\n sit   side by side ')).toBe('This page is confusing because two totals sit side by side')
  })

  it('keeps nothing typed as nothing, never the bare start', () => {
    expect(noteBody('confusing', '   ')).toBe('')
  })
})

describe('canSendNote', () => {
  it('sends confusing and went wrong with no words', () => {
    expect(canSendNote('confusing', '')).toEqual({ ok: true, body: '' })
    expect(canSendNote('broken', '  ')).toEqual({ ok: true, body: '' })
  })

  it('holds I want until there are words, with the reason', () => {
    expect(canSendNote('want', '')).toEqual({ ok: false, reason: 'Say what you want first.' })
    expect(canSendNote('want', 'a search box')).toEqual({ ok: true, body: 'I want a search box' })
  })

  it('holds a note longer than the table takes', () => {
    const r = canSendNote('want', 'x'.repeat(NOTE_BODY_MAX))
    expect(r.ok).toBe(false)
  })
})

describe('wordlessNoteLine', () => {
  it('says what a note with no words still says', () => {
    expect(wordlessNoteLine('broken')).toBe('No words. Something went wrong on this page.')
    expect(wordlessNoteLine('confusing')).toBe('No words. This page is confusing.')
    expect(wordlessNoteLine('guide')).toBe('No words.')
  })
})
