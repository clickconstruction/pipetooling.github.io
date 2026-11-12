import { describe, expect, it } from 'vitest'
import { lookAskedWords, lookCards, lookCounts, lookStanding, lookWordsFor, textedKind, textedSince, type ThreadLook, type ThreadLookFile } from './card'

const look = (over: Partial<ThreadLook> = {}): ThreadLook => ({
  id: 'L1',
  contact_id: 'dana',
  asked_by_name: 'Rosa',
  made_at: '2026-11-12T15:00:00.000Z',
  expires_at: '2026-11-19T15:00:00.000Z',
  opened_at: null,
  sent_at: null,
  looked_at: null,
  closed_at: null,
  place: null,
  words: null,
  ...over,
})
const file = (over: Partial<ThreadLookFile> = {}): ThreadLookFile => ({ id: 'F1', look_id: 'L1', kind: 'photo', mime: 'image/jpeg', storage_path: 'L1/F1.jpg', bytes: 500_000, seconds: null, finished_at: '2026-11-12T15:10:00.000Z', ...over })
const lineFile = (id: string, mime: string | null, name: string, kept = 'copy') => ({ id, name, mime, size: 1, kept, url: null, icon: 'image', paper: null, paperAnswer: null, paperAnsweredBy: null, paperAnsweredAt: null }) as never
const line = (contactId: string, direction: 'in' | 'out', at: string, files: never[]) => ({ contactId, direction, at, files })
const NOW = '2026-11-12T16:00:00.000Z'
const at = (iso: string) => `at ${iso.slice(11, 16)}`

describe('a First look card on a thread (punch list #319 PR 1)', () => {
  it('a file on a line is a photo, a video, or not drawn', () => {
    expect(textedKind({ mime: 'image/jpeg', kept: 'copy', name: 'a.jpg' })).toBe('photo')
    expect(textedKind({ mime: 'video/mp4', kept: 'copy', name: 'a.mp4' })).toBe('video')
    expect(textedKind({ mime: null, kept: 'copy', name: 'IMG_2.HEIC' })).toBe('photo')
    expect(textedKind({ mime: null, kept: 'copy', name: 'clip.MOV' })).toBe('video')
    expect(textedKind({ mime: 'application/pdf', kept: 'copy', name: 'bid.pdf' })).toBeNull()
    expect(textedKind({ mime: 'image/jpeg', kept: 'quoNotCopied', name: 'a.jpg' })).toBeNull()
    expect(textedKind({ mime: null, kept: 'link', name: 'a.jpg' })).toBeNull()
  })

  it('gathers what they sent in since the ask, never ours and never another person', () => {
    const lines = [
      line('dana', 'in', '2026-11-12T14:00:00.000Z', [lineFile('before', 'image/jpeg', 'a.jpg')]),
      line('dana', 'out', '2026-11-12T15:05:00.000Z', [lineFile('ours', 'image/jpeg', 'a.jpg')]),
      line('other', 'in', '2026-11-12T15:06:00.000Z', [lineFile('theirs', 'image/jpeg', 'a.jpg')]),
      line('dana', 'in', '2026-11-12T15:20:00.000Z', [lineFile('v', 'video/mp4', 'v.mp4'), lineFile('pdf', 'application/pdf', 'x.pdf')]),
      line('dana', 'in', '2026-11-12T15:10:00.000Z', [lineFile('p', 'image/png', 'p.png')]),
    ]
    expect(textedSince(lines, 'dana', '2026-11-12T15:00:00.000Z').map((t) => t.id)).toEqual(['p', 'v'])
  })

  it('the newest look still taking files always draws, so the office sees the ask is out', () => {
    const cards = lookCards([look()], [], [], 'dana', NOW)
    expect(cards).toHaveLength(1)
    expect(lookStanding(cards[0]!, NOW, at)).toBe('Nothing in yet. They have not opened the link.')
  })

  it('says the link was opened, then what is in', () => {
    const opened = lookCards([look({ opened_at: '2026-11-12T15:30:00.000Z' })], [], [], 'dana', NOW)
    expect(lookStanding(opened[0]!, NOW, at)).toBe('They opened the link at 15:30. Nothing sent yet.')
    const sent = lookCards([look({ sent_at: '2026-11-12T15:40:00.000Z' })], [file(), file({ id: 'F2', storage_path: 'L1/F2.mp4', kind: 'video', mime: 'video/mp4' })], [], 'dana', NOW)
    expect(lookCounts(sent[0]!)).toEqual({ photos: 1, videos: 1 })
    expect(lookStanding(sent[0]!, NOW, at)).toBe('1 photo and 1 video in.')
  })

  it('files in with no Send say so', () => {
    const cards = lookCards([look()], [file()], [], 'dana', NOW)
    expect(lookStanding(cards[0]!, NOW, at)).toBe('1 photo in. They have not pressed Send yet.')
  })

  it('a texted picture counts on the card, with no word about Send', () => {
    const lines = [line('dana', 'in', '2026-11-12T15:10:00.000Z', [lineFile('p', 'image/png', 'p.png')])]
    const cards = lookCards([look()], [], lines, 'dana', NOW)
    expect(cards[0]!.texted.map((t) => t.id)).toEqual(['p'])
    expect(lookStanding(cards[0]!, NOW, at)).toBe('1 photo in.')
  })

  it('a closed look draws nothing, an unfinished file is not in, and another person’s look is not theirs', () => {
    expect(lookCards([look({ closed_at: NOW })], [file()], [], 'dana', NOW)).toEqual([])
    expect(lookCards([look()], [file({ finished_at: null })], [], 'dana', NOW)[0]!.files).toEqual([])
    expect(lookCards([look({ contact_id: 'other' })], [file()], [], 'dana', NOW)).toEqual([])
  })

  it('a second ask leaves no empty card behind, and a texted picture goes to the look asked before it', () => {
    const older = look({ id: 'L0', made_at: '2026-11-10T15:00:00.000Z', expires_at: '2026-11-17T15:00:00.000Z' })
    expect(lookCards([older, look()], [], [], 'dana', NOW).map((c) => c.look.id)).toEqual(['L1'])
    const lines = [line('dana', 'in', '2026-11-11T10:00:00.000Z', [lineFile('old', 'image/png', 'o.png')]), line('dana', 'in', '2026-11-12T15:10:00.000Z', [lineFile('new', 'image/png', 'n.png')])]
    const cards = lookCards([older, look()], [], lines, 'dana', NOW)
    expect(cards.map((c) => [c.look.id, c.texted.map((t) => t.id)])).toEqual([
      ['L1', ['new']],
      ['L0', ['old']],
    ])
  })

  it('a link that ran out with nothing in draws no card; with something in it still draws', () => {
    const ran = look({ expires_at: '2026-11-12T15:30:00.000Z' })
    expect(lookCards([ran], [], [], 'dana', NOW)).toEqual([])
    const cards = lookCards([ran], [file()], [], 'dana', NOW)
    expect(cards).toHaveLength(1)
  })

  it('the head names who asked and when', () => {
    expect(lookAskedWords(look(), 'Nov 12')).toBe('Asked Nov 12 by Rosa')
    expect(lookAskedWords(look({ asked_by_name: ' ' }), 'Nov 12')).toBe('Asked Nov 12')
  })

  it('the doors take their own words from the page first, with the place', () => {
    expect(lookWordsFor(look({ words: 'It drips at night', place: 'Kitchen' }), 'older text')).toBe('Kitchen: It drips at night')
    expect(lookWordsFor(look({ words: 'It drips' }), 'older text')).toBe('It drips')
    expect(lookWordsFor(look(), 'Can you come Thursday?')).toBe('Can you come Thursday?')
    expect(lookWordsFor(look(), null)).toBeNull()
  })
})
