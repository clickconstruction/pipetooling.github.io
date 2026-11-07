import { describe, expect, it } from 'vitest'
import type { BoardItem } from './todoBoard'
import { countsLine, renderShortlistMarkdown, shortlistFrom, sizeBucket, stripParens } from './punchListShortlist'

const row = (over: Partial<BoardItem>): BoardItem => ({
  slug: 'a',
  number: 1,
  flagged: false,
  group: 'ready',
  name: 'A row',
  file: 'to-dos/a.md',
  pointer: false,
  summary: 's',
  next: 'n',
  size: 'S',
  blocker: 'none',
  ver: '',
  opinion: '',
  mockups: [],
  artifacts: [],
  mockup: 'waiting',
  mockupNote: '',
  ...over,
})

describe('sizeBucket', () => {
  it('reads a bare letter and a letter with words after it', () => {
    expect(sizeBucket('S')).toBe('S')
    expect(sizeBucket('XS each')).toBe('XS')
    expect(sizeBucket('M each, gated')).toBe('M')
    expect(sizeBucket('XL (29 items; 1–11 are S each, 12–21 M, 22–29 S–M)')).toBe('XL')
  })

  it("takes a train's whole letter over its parts in parentheses", () => {
    expect(sizeBucket('L as a train of seven (S · M · M · S · M · S · M)')).toBe('L')
    expect(sizeBucket('M as a train of five (S · M · M · S · S)')).toBe('M')
    expect(sizeBucket('M (four PRs: S, M, S, XS; one migration; four function redeploys)')).toBe('M')
  })

  it('takes the biggest part when the card lists parts', () => {
    expect(sizeBucket('XS (PR 1) · S (PR 2) · M (PR 3)')).toBe('M')
    expect(sizeBucket('S (PR 1 the tables) + M (PR 2 the job section) + S (PR 4 the bid)')).toBe('M')
    expect(sizeBucket('M+S+L+M (PR 1 a notice; PR 2 the cue; PR 3 Bid it?; PR 4 the tie)')).toBe('L')
    expect(sizeBucket('S per PR · XL for the whole queue')).toBe('XL')
    expect(sizeBucket('built: PR 1 S · PR 2 M · PR 3 M · PR 4 S')).toBe('M')
    expect(sizeBucket('S for PR 1; M for the signing flow; S for the Spanish copy')).toBe('M')
  })

  it('lets a left clause win over the whole train', () => {
    expect(sizeBucket('L as a train of nine (S · XS · S · M), eight built; two migrations; left: PR 7 (S)')).toBe('S')
    expect(sizeBucket('L, shipped as four PRs and four fixes; each leftover is S')).toBe('S')
  })

  it('skips a conditional clause', () => {
    expect(sizeBucket('S (A) + M (B); C would be L with a guard migration')).toBe('M')
    expect(sizeBucket('S (PR 1 the rule) + S (PR 2 Needs a reply, if wanted)')).toBe('S')
    expect(sizeBucket('S (the card) + M (PR 1) + S (PR 2, three cards to other tabs, if wanted)')).toBe('M')
  })

  it('falls back to a letter inside parentheses when none stands outside', () => {
    expect(sizeBucket('one PR (S)')).toBe('S')
  })

  it('is null for a size with no letter', () => {
    expect(sizeBucket('a sitting')).toBeNull()
    expect(sizeBucket('change 1 one PR with a migration · change 2 one PR · change 3 a train of three')).toBeNull()
    expect(sizeBucket('')).toBeNull()
    expect(sizeBucket(undefined)).toBeNull()
  })

  it('never reads a letter out of a word', () => {
    expect(sizeBucket('a Mondays sweep, Large plans')).toBeNull()
    expect(stripParens('M (a (nested) note) · S')).toBe('M   · S')
  })
})

describe('shortlistFrom', () => {
  const items: BoardItem[] = [
    row({ slug: 'p', number: 5, group: 'gated', pointer: true, size: 'a sitting', name: 'Pointer' }),
    row({ slug: 'a', number: 46, group: 'ready', size: 'S per PR · XL for the whole queue', name: 'Queue' }),
    row({ slug: 'b', number: 227, group: 'ready', size: 'S', name: 'Recordings' }),
    row({ slug: 'c', number: 114, group: 'ready', size: 'M (one migration)', name: 'Bio' }),
    row({ slug: 'd', number: 253, group: 'ready', size: 'S', name: 'Licenses', flagged: true }),
    row({ slug: 'e', number: 176, group: 'close', size: 'change 1 one PR · change 2 one PR', name: 'Five changes' }),
    row({ slug: 'f', number: 76, group: 'close', size: 'XS (two live steps, no code)', name: 'Returned checks' }),
    row({ slug: 'g', number: 189, group: 'gated', size: 'L as a train of nine, eight built; left: PR 7 (S)', name: 'Phone first' }),
  ]
  const list = shortlistFrom(items)

  it('leaves the pointer out and counts the open rows by bucket', () => {
    expect(list.open).toBe(7)
    expect(list.counts).toEqual({ XS: 1, S: 3, M: 1, L: 0, XL: 1 })
    expect(list.unsized).toBe(1)
    expect(countsLine(list)).toBe('1 XS · 3 S · 1 M · 1 XL · 1 unsized')
  })

  it('sorts each group smallest first, then by number, an unsized row last, a flagged row in its group', () => {
    expect(list.groups.map((g) => g.group)).toEqual(['ready', 'close', 'gated'])
    expect(list.groups[0]!.rows.map((r) => `${r.item.number} ${r.bucket}`)).toEqual(['227 S', '253 S', '114 M', '46 XL'])
    expect(list.groups[1]!.rows.map((r) => `${r.item.number} ${r.bucket}`)).toEqual(['76 XS', '176 null'])
    expect(list.groups[2]!.rows.map((r) => `${r.item.number} ${r.bucket}`)).toEqual(['189 S'])
  })

  it('renders the markdown a chat pastes: the counts, then one table per group', () => {
    const md = renderShortlistMarkdown(list, { date: '2026-11-06', version: 'v2.6614' })
    expect(md).toContain('# Punch list shortlist — 2026-11-06 at v2.6614')
    expect(md).toContain('7 open items, smallest first in each group. 1 XS · 3 S · 1 M · 1 XL · 1 unsized.')
    expect(md).toContain('| XL | 1 |')
    expect(md).toContain('| unsized | 1 |')
    expect(md).toContain('**Ready to build (4)**')
    expect(md).toContain('| 227 | S | Recordings |')
    expect(md).toContain('| 176 | — | Five changes |')
    expect(md.indexOf('| 227 | S |')).toBeLessThan(md.indexOf('| 46 | XL |'))
    expect(md).not.toContain('Pointer')
  })
})
