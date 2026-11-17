import { describe, expect, it } from 'vitest'
import { noteBrief } from './brief'
import { buildNoteContext } from './noteContext'

const ctx = buildNoteContext(
  {
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
  },
  1,
)

describe('noteBrief', () => {
  it('names the role and never the sender', () => {
    const brief = noteBrief({ kind: 'confusing', body: 'This page is confusing because two totals sit side by side', page_path: '/jobs?tab=stages', created_at: '2026-11-17T15:12:00Z', context: ctx })
    expect(brief).toContain('Kind: Confusing')
    expect(brief).toContain('From: An assistant')
    expect(brief).toContain('Page: Jobs · Stages (/jobs?tab=stages)')
    expect(brief).toContain('Window open: none')
    expect(brief).toContain('Screen: desk, 1440 wide')
    expect(brief).toContain('They wrote: "This page is confusing because two totals sit side by side"')
  })

  it('ends with the rule about real names', () => {
    const brief = noteBrief({ kind: 'want', body: 'I want a search box', page_path: null, created_at: null, context: ctx })
    expect(brief.trim().endsWith('The repo is public.')).toBe(true)
    expect(brief).toContain('three lenses')
  })

  it('says what a note with no words still says, with its trouble', () => {
    const withTrouble = buildNoteContext(
      {
        pageLabel: 'Dashboard',
        windowTitle: 'Add a photo',
        role: 'helpers',
        training: true,
        twin: false,
        viewingAs: false,
        isPhone: true,
        width: 390,
        height: 800,
        modes: ['Job Mode'],
        appVersion: null,
        door: 'error_line',
        trouble: { errors: [{ words: 'The file is too big to send.', at: 1 }], refused: [{ what: 'POST task-photos (files)', status: 413, at: 1 }] },
      },
      1,
    )
    const brief = noteBrief({ kind: 'broken', body: '', page_path: '/dashboard', created_at: null, context: withTrouble })
    expect(brief).toContain('From: A helper, in training mode')
    expect(brief).toContain('Screen: phone, Job Mode on')
    expect(brief).toContain('Error lines shown: "The file is too big to send."')
    expect(brief).toContain('Refused by the server: POST task-photos (files) (413)')
    expect(brief).toContain('No words. Something went wrong on this page.')
    expect(brief).not.toContain('App version')
  })

  it('still reads for a guide’s note with no state', () => {
    const brief = noteBrief({ kind: 'guide', body: 'The second step is out of date.', page_path: null, created_at: null, context: null })
    expect(brief).toContain('Kind: Guide')
    expect(brief).toContain('They wrote: "The second step is out of date."')
  })
})
