import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import {
  FILE_LINK_WORDS,
  fileLinkRequestUrl,
  fileLinkTokenShape,
  fileLinkView,
  fileLinkWords,
  readFileLinkAnswer,
} from './fileLinkPage'

// The mock-up's link and file (files-out-mockups.html, screen 7).
const TOKEN = 'k3Pw9xQaB7cD2eF4gH6iJ8'
const STREAM = `https://abc.supabase.co/functions/v1/drive-link?t=${TOKEN}&raw=1`

describe('the page a file’s own link opens (Messages, cut 7d)', () => {
  it('knows a link token by the function’s own rule', () => {
    expect(fileLinkTokenShape(TOKEN)).toBe(true)
    expect(fileLinkTokenShape('short')).toBe(false)
    expect(fileLinkTokenShape('has a space in it here')).toBe(false)
  })

  it('asks the open door, with the office’s preview flag when it is there', () => {
    expect(fileLinkRequestUrl('https://abc.supabase.co/', TOKEN, false)).toBe(`https://abc.supabase.co/functions/v1/drive-link?t=${TOKEN}`)
    expect(fileLinkRequestUrl('https://abc.supabase.co', TOKEN, true)).toBe(`https://abc.supabase.co/functions/v1/drive-link?t=${TOKEN}&preview=1`)
  })

  it('reads the open door’s three answers and refuses anything else', () => {
    expect(readFileLinkAnswer({ kind: 'drive', url: 'https://drive.google.com/file/d/x/view', name: 'Boerne plans, rev 2.pdf' })).toEqual({
      kind: 'drive',
      url: 'https://drive.google.com/file/d/x/view',
      name: 'Boerne plans, rev 2.pdf',
    })
    expect(readFileLinkAnswer({ kind: 'stream', url: STREAM, name: 'Rock clause, marked up.pdf' })?.kind).toBe('stream')
    expect(readFileLinkAnswer({ kind: 'off', why: 'cut' })).toEqual({ kind: 'off', why: 'cut' })
    expect(readFileLinkAnswer({ kind: 'off', why: 'gone' })).toBeNull()
    expect(readFileLinkAnswer({ kind: 'drive', url: 'javascript:alert(1)', name: 'x.pdf' })).toBeNull()
    expect(readFileLinkAnswer({ kind: 'drive', url: 'http://drive.google.com/x', name: 'x.pdf' })).toBeNull()
    expect(readFileLinkAnswer({ kind: 'stream', url: STREAM, name: '  ' })).toBeNull()
    expect(readFileLinkAnswer({ error: 'failed' })).toBeNull()
    expect(readFileLinkAnswer(null)).toBeNull()
  })

  it('opens the file with its name and who it is from', () => {
    const view = fileLinkView({ kind: 'stream', url: STREAM, name: 'Rock clause, marked up.pdf' }, 'en', 'Click Construction')
    expect(view).toEqual({ step: 'opening', lines: ['Opening Rock clause, marked up.pdf…', 'From Click Construction.'], go: STREAM })
  })

  it('says a link cut off and one that ended the same way, and names the other two', () => {
    const cut = fileLinkView({ kind: 'off', why: 'cut' }, 'en', 'Click Construction')
    expect(cut).toEqual({ step: 'off', lines: ['This link was turned off.', 'Ask Click Construction for a new one.'] })
    expect(fileLinkView({ kind: 'off', why: 'ended' }, 'en', 'Click Construction')).toEqual(cut)
    expect(fileLinkView({ kind: 'off', why: 'unknown' }, 'en', 'Click Construction').lines).toEqual(['This link does not open a file. Check that it was copied whole.'])
    expect(fileLinkView({ kind: 'off', why: 'tooBig' }, 'en', 'Click Construction').lines).toEqual([
      'This file is too big to open from a link. Ask Click Construction to send it another way.',
    ])
  })

  it('offers to try again when the read failed', () => {
    expect(fileLinkView(null, 'en', 'Click Construction')).toEqual({ step: 'failed', lines: ['The link did not open. Try again in a minute.'], retry: 'Try again' })
  })

  it('says every line in Spanish too', () => {
    expect(fileLinkView({ kind: 'off', why: 'cut' }, 'es', 'Click Construction').lines).toEqual(['Este enlace se desactivó.', 'Pida uno nuevo a Click Construction.'])
    for (const [key, words] of Object.entries(FILE_LINK_WORDS)) {
      expect(words.es, key).not.toBe(words.en)
      expect(words.es.match(/\{\w+\}/g) ?? [], key).toEqual(words.en.match(/\{\w+\}/g) ?? [])
    }
    expect(fileLinkWords('es', 'opening', { name: 'Planos.pdf' })).toBe('Abriendo Planos.pdf…')
  })

  it('holds every English line to plain words', () => {
    const lines = Object.values(FILE_LINK_WORDS).map((w) => w.en.replace(/\{(\w+)\}/g, 'Click Construction'))
    expect(lines.flatMap((l) => plainWordsFailures(l))).toEqual([])
  })
})
