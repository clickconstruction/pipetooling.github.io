import { describe, expect, it } from 'vitest'
import { editQuickReply, versionWords, type QuickReply } from './kernel'
import { quickRepliesFromRows, versionsFromRows, type QuickReplyRow, type QuickReplyVersionRow } from './rows'
import { SHORTCUT_WORDS, shortcutHolder, shortcutTakenWords, shortcutWord } from './shortcut'

const line = (id: string, set: Partial<QuickReply> = {}): QuickReply => ({
  id,
  text: `Line ${id}.`,
  for: 'customer',
  stepId: null,
  scope: 'team',
  addedBy: 'u-rosa',
  addedAt: 0,
  removed: false,
  uses: {},
  lastUsed: null,
  ...set,
})

describe('shortcutWord: the word as set_quick_reply_shortcut keeps it', () => {
  it('takes off spaces and a leading /, and lowers the case', () => {
    expect(shortcutWord('  /Bill ')).toEqual({ word: 'bill' })
    expect(shortcutWord('//late')).toEqual({ word: 'late' })
    expect(shortcutWord('pay-2')).toEqual({ word: 'pay-2' })
  })

  it('reads a blank, or a / alone, as no shortcut', () => {
    expect(shortcutWord('')).toEqual({ word: null })
    expect(shortcutWord('  ')).toEqual({ word: null })
    expect(shortcutWord('/')).toEqual({ word: null })
  })

  it('refuses two words, a leading dash, odd marks and a word past 24', () => {
    for (const bad of ['two words', '-bill', 'bill!', 'café', 'a'.repeat(25)]) expect(shortcutWord(bad)).toEqual({ error: SHORTCUT_WORDS.bad })
    expect(shortcutWord('a'.repeat(24))).toEqual({ word: 'a'.repeat(24) })
  })
})

describe('shortcutHolder: who holds the word, as the function refuses it', () => {
  const LINES = [
    line('team-bill', { shortcut: 'bill' }),
    line('gone', { shortcut: 'paid', removed: true }),
    line('rosa-late', { scope: 'mine', addedBy: 'u-rosa', shortcut: 'late' }),
    line('ana-call', { scope: 'mine', addedBy: 'u-ana', shortcut: 'call' }),
  ]

  it('a live team line holds its word against any other line', () => {
    expect(shortcutHolder('bill', line('other'), LINES, 'u-rosa')?.id).toBe('team-bill')
    expect(shortcutHolder('bill', line('mine', { scope: 'mine' }), LINES, 'u-rosa')?.id).toBe('team-bill')
    expect(shortcutHolder('bill', LINES[0]!, LINES, 'u-rosa')).toBeNull()
  })

  it('a removed line frees its word', () => {
    expect(shortcutHolder('paid', line('other'), LINES, 'u-rosa')).toBeNull()
  })

  it('a line of one’s own keeps clear of one’s own other lines, and of nobody else’s', () => {
    expect(shortcutHolder('late', line('rosa-2', { scope: 'mine', addedBy: 'u-rosa' }), LINES, 'u-rosa')?.id).toBe('rosa-late')
    expect(shortcutHolder('call', line('rosa-2', { scope: 'mine', addedBy: 'u-rosa' }), LINES, 'u-rosa')).toBeNull()
    expect(shortcutHolder('late', line('team-2'), LINES, 'u-rosa')).toBeNull()
  })

  it('says the refusal in the function’s words', () => {
    expect(shortcutTakenWords('bill')).toBe("/bill is another line's shortcut.")
  })
})

describe('editQuickReply and versionWords: the shortcut in a Save and in the history', () => {
  it('a new word is one shortcut version, cleaned', () => {
    const q = line('a')
    const r = editQuickReply(q, { text: q.text, tags: { for: 'customer', stepId: null }, shortcut: ' /Bill' }, 'u-rosa', 5)
    expect('error' in r).toBe(false)
    if ('error' in r) return
    expect(r.line.shortcut).toBe('bill')
    expect(r.versions).toEqual([{ by: 'u-rosa', at: 5, kind: 'shortcut', toText: 'bill' }])
  })

  it('a cleared word and a changed word, and no version when it stays', () => {
    const q = line('a', { shortcut: 'bill' })
    const cleared = editQuickReply(q, { text: q.text, tags: { for: 'customer', stepId: null }, shortcut: '' }, 'u-rosa', 5)
    expect('error' in cleared ? cleared.error : cleared.versions).toEqual([{ by: 'u-rosa', at: 5, kind: 'shortcut', fromText: 'bill' }])
    const changed = editQuickReply(q, { text: q.text, tags: { for: 'customer', stepId: null }, shortcut: 'pay' }, 'u-rosa', 5)
    expect('error' in changed ? changed.error : changed.versions).toEqual([{ by: 'u-rosa', at: 5, kind: 'shortcut', fromText: 'bill', toText: 'pay' }])
    const same = editQuickReply(q, { text: q.text, tags: { for: 'customer', stepId: null }, shortcut: '/BILL' }, 'u-rosa', 5)
    expect('error' in same ? same.error : same.versions).toEqual([])
  })

  it('a word that is not one is the Save’s refusal', () => {
    const q = line('a')
    expect(editQuickReply(q, { text: q.text, tags: { for: 'customer', stepId: null }, shortcut: 'two words' }, 'u-rosa', 5)).toEqual({ error: SHORTCUT_WORDS.bad })
  })

  it('the history says what happened to the word', () => {
    expect(versionWords({ by: 'u', at: 0, kind: 'shortcut', toText: 'bill' }, {})).toEqual({ did: 'gave it a shortcut', struck: null, added: '/bill', note: null })
    expect(versionWords({ by: 'u', at: 0, kind: 'shortcut', fromText: 'bill' }, {})).toEqual({ did: 'cleared its shortcut', struck: '/bill', added: null, note: null })
    expect(versionWords({ by: 'u', at: 0, kind: 'shortcut', fromText: 'bill', toText: 'pay' }, {})).toEqual({ did: 'changed its shortcut', struck: '/bill', added: '/pay', note: null })
  })
})

describe('rows: the shortcut read from the table', () => {
  const row: QuickReplyRow = { id: 'q1', text: 'Hi.', for_kind: 'customer', step_key: null, scope: 'team', added_by: 'u', added_at: '2026-10-19T12:00:00Z', removed_at: null }

  it('reads the word, and none for a row read before the column', () => {
    expect(quickRepliesFromRows([{ ...row, shortcut: 'bill' }], [])[0]?.shortcut).toBe('bill')
    expect(quickRepliesFromRows([row], [])[0]?.shortcut).toBeNull()
  })

  it('keeps a shortcut version with its words before and after', () => {
    const v: QuickReplyVersionRow = { id: 1, quick_reply_id: 'q1', kind: 'shortcut', from_text: null, to_text: 'bill', from_for_kind: null, from_step_key: null, to_for_kind: null, to_step_key: null, by_user_id: 'u', at: '2026-10-19T12:00:00Z' }
    expect(versionsFromRows([v]).q1).toEqual([{ by: 'u', at: Date.parse('2026-10-19T12:00:00Z'), kind: 'shortcut', toText: 'bill' }])
  })
})
