import { describe, expect, it } from 'vitest'
import { buildBidStory, buildSiblingLines, storyEntryVisible, storyMethodIcon, type StorySourceEntry } from './followupStorySoFar'

const entry = (over: Partial<StorySourceEntry>): StorySourceEntry => ({
  id: 'e1',
  gcCustomerId: null,
  method: 'Phone',
  text: 'Left message.',
  iso: '2026-08-27T10:00:00Z',
  byLine: 'By Wendi',
  ...over,
})

describe('storyMethodIcon', () => {
  it('maps the quick-pick methods', () => {
    expect(storyMethodIcon('Phone')).toBe('📞')
    expect(storyMethodIcon('Email')).toBe('✉️')
    expect(storyMethodIcon('Text')).toBe('💬')
    expect(storyMethodIcon('In person')).toBe('🤝')
    expect(storyMethodIcon(null)).toBe('📝')
    expect(storyMethodIcon('Fax')).toBe('📝')
  })
})

describe('storyEntryVisible — the notes-popover rule', () => {
  it('whole-bid entries show everywhere; GC-scoped only on that GC row', () => {
    expect(storyEntryVisible({ gcCustomerId: null }, null)).toBe(true)
    expect(storyEntryVisible({ gcCustomerId: null }, 'gc1')).toBe(true)
    expect(storyEntryVisible({ gcCustomerId: 'gc1' }, 'gc1')).toBe(true)
    expect(storyEntryVisible({ gcCustomerId: 'gc1' }, null)).toBe(false)
    expect(storyEntryVisible({ gcCustomerId: 'gc1' }, 'gc2')).toBe(false)
  })
})

describe('buildBidStory', () => {
  const entries = [
    entry({ id: 'a', iso: '2026-08-27T10:00:00Z', text: 'Left message.' }),
    entry({ id: 'b', iso: '2026-08-12T10:00:00Z', text: 'Still pending.', method: 'Phone' }),
    entry({ id: 'c', iso: '2026-07-18T10:00:00Z', text: 'Emailed revised alternate.', method: 'Email', byLine: 'By Robert' }),
    entry({ id: 'other-gc', iso: '2026-08-20T10:00:00Z', gcCustomerId: 'gc-other', text: 'Their note.' }),
  ]

  it('newest first, sent anchor at its chronological spot, scoped rule applied', () => {
    const { items, total } = buildBidStory({ entries, gcId: null, sentIso: '2026-06-30', sentValue: 40244, cap: Infinity })
    expect(items.map((i) => i.key)).toEqual(['entry-a', 'entry-b', 'entry-c', 'sent'])
    expect(total).toBe(4)
    expect(items[3]!.text).toBe('Letter sent · $40,244.00')
    expect(items[0]!.icon).toBe('📞')
    expect(items[2]!.icon).toBe('✉️')
  })

  it('a GC row sees its scoped entries plus whole-bid ones', () => {
    const { items } = buildBidStory({ entries, gcId: 'gc-other', sentIso: null, sentValue: 0, cap: Infinity })
    expect(items.map((i) => i.key)).toEqual(['entry-a', 'entry-other-gc', 'entry-b', 'entry-c'])
  })

  it('cap limits items but total keeps the real count', () => {
    const { items, total } = buildBidStory({ entries, gcId: null, sentIso: '2026-06-30', sentValue: 0, cap: 2 })
    expect(items).toHaveLength(2)
    expect(total).toBe(4)
  })

  it('a send newer than every entry leads the list; no send, no anchor', () => {
    const { items } = buildBidStory({ entries: [entry({ id: 'x', iso: '2026-06-01T00:00:00Z' })], gcId: null, sentIso: '2026-06-30', sentValue: 0, cap: Infinity })
    expect(items.map((i) => i.kind)).toEqual(['sent', 'entry'])
    expect(buildBidStory({ entries: [], gcId: null, sentIso: null, sentValue: 0, cap: 5 }).total).toBe(0)
  })
})

describe('buildSiblingLines', () => {
  it('spoken-to rows newest first, then untouched oldest-send first', () => {
    const lines = buildSiblingLines(
      [
        { rowKey: 'r1', bidId: 'b1', title: 'UTSA', sentIso: '2026-08-01' },
        { rowKey: 'r2', bidId: 'b2', title: 'TXST', sentIso: '2026-07-02' },
        { rowKey: 'r3', bidId: 'b3', title: 'BLANCO', sentIso: '2026-07-20' },
      ],
      {
        b1: [entry({ id: 'u1', iso: '2026-08-25T10:00:00Z', text: 'Budget review this week.' })],
        b3: [entry({ id: 'u3', iso: '2026-08-10T10:00:00Z', text: 'Asked for W-9.' })],
      },
    )
    expect(lines.map((l) => l.rowKey)).toEqual(['r1', 'r3', 'r2'])
    expect(lines[0]!.kind).toBe('entry')
    expect(lines[0]!.text).toBe('Budget review this week.')
    expect(lines[2]!.kind).toBe('untouched')
    expect(lines[2]!.sentIso).toBe('2026-07-02')
  })

  it('a sibling whose only entries are GC-scoped counts as untouched at bid level', () => {
    const lines = buildSiblingLines(
      [{ rowKey: 'r1', bidId: 'b1', title: 'UTSA', sentIso: '2026-08-01' }],
      { b1: [entry({ id: 's', gcCustomerId: 'gc9' })] },
    )
    expect(lines[0]!.kind).toBe('untouched')
  })
})
