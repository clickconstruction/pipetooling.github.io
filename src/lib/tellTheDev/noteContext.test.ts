import { describe, expect, it } from 'vitest'
import { PAGE_PATH_MAX, buildNoteContext, noteContextChips, noteContextLines, notePagePath, openThatPagePath, parseNoteContext, type NoteContextInput } from './noteContext'

const NOW = 10_000_000

function input(over: Partial<NoteContextInput> = {}): NoteContextInput {
  return {
    pageLabel: 'Jobs · Stages',
    windowTitle: null,
    role: 'assistant',
    training: false,
    twin: false,
    viewingAs: false,
    isPhone: false,
    width: 1440,
    height: 900,
    modes: [],
    appVersion: 'v2.7650',
    door: 'wrench',
    trouble: { errors: [], refused: [] },
    ...over,
  }
}

describe('buildNoteContext', () => {
  it('carries the page, the seat and the screen', () => {
    const ctx = buildNoteContext(input(), NOW)
    expect(ctx).toMatchObject({ v: 1, page_label: 'Jobs · Stages', window: null, role: 'assistant', seat: {}, screen: { kind: 'desk', width: 1440, height: 900 }, app_version: 'v2.7650', door: 'wrench' })
  })

  it('marks a training account, a twin and a dev viewing as', () => {
    expect(buildNoteContext(input({ training: true, twin: true, viewingAs: true }), NOW).seat).toEqual({ training: true, twin: true, viewing_as: true })
  })

  it('says how long before the note each trouble was, newest first', () => {
    const ctx = buildNoteContext(
      input({
        trouble: {
          errors: [{ words: 'The file is too big to send.', at: NOW - 120_000 }],
          refused: [{ what: 'POST task-photos (files)', status: 413, at: NOW - 121_000 }],
        },
      }),
      NOW,
    )
    expect(ctx.errors).toEqual([{ words: 'The file is too big to send.', ago_s: 120 }])
    expect(ctx.refused).toEqual([{ what: 'POST task-photos (files)', status: 413, ago_s: 121 }])
  })

  it('clips a long window title and a long error line', () => {
    const ctx = buildNoteContext(input({ windowTitle: 'W'.repeat(400), trouble: { errors: [{ words: 'E'.repeat(900), at: NOW }], refused: [] } }), NOW)
    expect(ctx.window!.length).toBe(120)
    expect(ctx.errors[0]!.words.length).toBe(240)
  })

  it('keeps three error lines and five refusals at most', () => {
    const errors = Array.from({ length: 6 }, (_, i) => ({ words: `Line ${i}`, at: NOW }))
    const refused = Array.from({ length: 8 }, (_, i) => ({ what: `GET t${i}`, status: 500, at: NOW }))
    const ctx = buildNoteContext(input({ trouble: { errors, refused } }), NOW)
    expect(ctx.errors).toHaveLength(3)
    expect(ctx.refused).toHaveLength(5)
  })
})

describe('notePagePath', () => {
  it('keeps the path and its query', () => {
    expect(notePagePath('/jobs', '?tab=stages&gcReview=1')).toBe('/jobs?tab=stages&gcReview=1')
    expect(notePagePath('/dashboard', '')).toBe('/dashboard')
  })

  it('drops a key that is a pass', () => {
    expect(notePagePath('/rate', '?t=abc123&tab=x')).toBe('/rate?tab=x')
    expect(notePagePath('/x', '?access_token=aaa&code=bbb')).toBe('/x')
  })

  it('falls back to the path when the whole address is too long', () => {
    const long = `?q=${'a'.repeat(PAGE_PATH_MAX)}`
    expect(notePagePath('/bids', long)).toBe('/bids')
  })

  it('never returns an address that is not in the app', () => {
    expect(notePagePath('', '')).toBe('/')
  })
})

describe('openThatPagePath', () => {
  it('follows an in-app path and nothing else', () => {
    expect(openThatPagePath('/jobs?tab=stages')).toBe('/jobs?tab=stages')
    expect(openThatPagePath('//evil.example/x')).toBeNull()
    expect(openThatPagePath('https://evil.example')).toBeNull()
    expect(openThatPagePath('/\\evil')).toBeNull()
    expect(openThatPagePath(null)).toBeNull()
  })
})

describe('the words', () => {
  it('lists everything the note carries, for the sender', () => {
    const ctx = buildNoteContext(input(), NOW)
    expect(noteContextLines(ctx, 'Dana Whitfield')).toEqual([
      { label: 'Page', value: 'Jobs · Stages' },
      { label: 'Window open', value: 'None' },
      { label: 'From', value: 'Dana Whitfield, Assistant' },
      { label: 'Screen', value: 'Desk, 1440 wide' },
      { label: 'App version', value: 'v2.7650' },
      { label: 'Last error line', value: 'None in the last 5 minutes' },
    ])
  })

  it('names the window, the phone and its mode, the seat and the trouble', () => {
    const ctx = buildNoteContext(
      input({
        windowTitle: 'Sign the tailgate sheet',
        role: 'helpers',
        training: true,
        isPhone: true,
        width: 390,
        modes: ['Job Mode'],
        trouble: { errors: [{ words: 'The file is too big to send.', at: NOW - 10_000 }], refused: [{ what: 'POST task-photos (files)', status: 413, at: NOW - 11_000 }] },
      }),
      NOW,
    )
    const lines = noteContextLines(ctx, null)
    expect(lines.find((l) => l.label === 'Window open')!.value).toBe('Sign the tailgate sheet')
    expect(lines.find((l) => l.label === 'From')!.value).toBe('You, Helper (training mode)')
    expect(lines.find((l) => l.label === 'Screen')!.value).toBe('Phone, Job Mode on')
    expect(lines.find((l) => l.label === 'Last error line')!.value).toBe('The file is too big to send. (just now)')
    expect(lines.find((l) => l.label === 'Refused by the server')!.value).toBe('POST task-photos (files) (413)')
  })

  it('says minutes for an older error line', () => {
    const ctx = buildNoteContext(input({ trouble: { errors: [{ words: 'A line', at: NOW - 180_000 }], refused: [] } }), NOW)
    expect(noteContextLines(ctx, 'A').find((l) => l.label === 'Last error line')!.value).toBe('A line (3 min ago)')
  })

  it('chips the page first and the trouble in its own tone', () => {
    const ctx = buildNoteContext(input({ door: 'error_line', trouble: { errors: [{ words: 'A line', at: NOW }], refused: [{ what: 'GET users', status: 500, at: NOW }] } }), NOW)
    const chips = noteContextChips(ctx)
    expect(chips[0]).toEqual({ text: 'Jobs · Stages', tone: 'page' })
    expect(chips.filter((c) => c.tone === 'trouble').map((c) => c.text)).toEqual(['Error: A line', 'Refused: GET users (500)'])
    expect(chips.some((c) => c.text === 'From the error line')).toBe(true)
  })
})

describe('parseNoteContext', () => {
  it('reads back what it built', () => {
    const ctx = buildNoteContext(input({ training: true, windowTitle: 'Edit Job', door: 'window', trouble: { errors: [{ words: 'A line', at: NOW }], refused: [{ what: 'GET users', status: 500, at: NOW }] } }), NOW)
    expect(parseNoteContext(JSON.parse(JSON.stringify(ctx)))).toEqual(ctx)
  })

  it('answers null for a guide’s empty state and for another shape', () => {
    expect(parseNoteContext({})).toBeNull()
    expect(parseNoteContext(null)).toBeNull()
    expect(parseNoteContext({ v: 2, page_label: 'x' })).toBeNull()
    expect(parseNoteContext('nope')).toBeNull()
  })

  it('is forgiving of a part it does not know', () => {
    const ctx = parseNoteContext({ v: 1, page_label: 'Bids', door: 'elsewhere', errors: [{ nope: 1 }, { words: 'kept' }], refused: 'x' })
    expect(ctx).toMatchObject({ page_label: 'Bids', door: 'wrench', errors: [{ words: 'kept', ago_s: 0 }], refused: [], screen: { kind: 'desk', width: 0, height: 0 } })
  })
})
