import { describe, expect, it } from 'vitest'
import { containerLines, type Container, type Movement } from './onSite'
import { askReasonWords, joinedTies, nearlySame, orderedPair, samePartAsks, tieCanon, tieFor, type PartTie } from './partTies'
import { rollKey, sameWordsKey, sitePartRows, type SiteRollupJob } from './siteRollup'

const NOW = new Date('2026-11-12T18:00:00Z')
const key = (name: string) => rollKey({ partId: null, partName: name })
const k = sameWordsKey

let seq = 0
const tie = (a: string, b: string, verdict: PartTie['verdict'] = 'same'): PartTie => {
  seq += 1
  const [aKey, bKey] = orderedPair(a, b)
  return { id: `t${seq}`, aKey, bKey, aName: aKey, bName: bKey, verdict, byName: 'Dana', at: `2026-11-12T10:00:${String(seq).padStart(2, '0')}Z` }
}

// A made-up job: one box per name, so every name is its own line.
function job(names: Array<[string, number, string?]>): SiteRollupJob {
  const containers: Container[] = names.map((_, i) => ({ id: `b${i}`, jobId: 'ja', label: `R${i + 1}`, kind: 'cage', where: '', locationId: null, lat: null, lng: null, retiredAt: null, createdAt: '2026-10-01T00:00:00Z' }))
  const movements: Movement[] = names.map(([name, quantity, partId], i) => ({ id: `m${i}`, jobId: 'ja', partId: partId ?? null, partName: name, manufacturer: null, quantity, reason: 'delivered', fromContainerId: null, toContainerId: `b${i}`, note: '', byUserId: null, byName: 'Priya', at: '2026-11-10T12:00:00Z', source: null, itemId: null }))
  return { jobId: 'ja', label: 'J1042', containers, places: [], lines: containerLines(movements) }
}

describe('nearlySame: what the screen may ask about', () => {
  it('offers a name with one more word, and a word spelled a letter or two apart', () => {
    expect(nearlySame(k('2" 90'), k('2" 90 pvc'))).toBe('one-more-word')
    expect(nearlySame(k('Air pump'), k('Air pump septic'))).toBe('one-more-word')
    expect(nearlySame(k('4" san tee'), k('4" sani tee'))).toBe('spelled-apart')
    expect(nearlySame(k('Kholer toilet'), k('Kohler toilets'))).toBe('spelled-apart')
  })
  it('never offers two names whose numbers differ', () => {
    expect(nearlySame(k('2" 90 pvc'), k('3" 90 pvc'))).toBeNull()
    expect(nearlySame(k('2" 90'), k('2" 45'))).toBeNull()
    expect(nearlySame(k('3x4 reducer'), k('4x3 reducer'))).toBeNull()
    expect(nearlySame(k('2 90 pvc'), k('2" 90 pvc'))).toBeNull()
  })
  it('never offers two names that share no word and no size, or differ by more', () => {
    expect(nearlySame(k('Oil'), k('Lights'))).toBeNull()
    expect(nearlySame(k('Scrap'), k('Scrap copper pipe'))).toBeNull()
    expect(nearlySame(k('2" 90 pvc'), k('2" coupling copper'))).toBeNull()
    expect(nearlySame(k('2" 90 pvc'), k('2" 90 pvc'))).toBeNull()
  })
})

describe('tieCanon: names a person joined are one row', () => {
  it('joins through a chain, and a different answer joins nothing', () => {
    const canon = tieCanon([tie('words:a', 'words:b'), tie('words:b', 'words:c'), tie('words:c', 'words:d', 'different')])
    expect(canon('words:a')).toBe(canon('words:c'))
    expect(canon('words:d')).toBe('words:d')
    expect(canon('words:z')).toBe('words:z')
  })
  it('a group that holds a parts-book part takes the book part as its key', () => {
    const canon = tieCanon([tie('words:2" 90', 'words:2" 90 pvc'), tie('id:book-9', 'words:2" 90 pvc')])
    expect(canon('words:2" 90')).toBe('id:book-9')
    expect(canon('words:2" 90 pvc')).toBe('id:book-9')
  })
})

describe('the roll-up with ties', () => {
  const site = [job([['2" 90 pvc', 94], ['2 inch 90 PVC', 42], ['2" 90', 42], ['3" 90 pvc', 30], ['3/4 COPPER TEE', 300, 'book-1'], ['3/4 copper tee', 12]])]
  it('a same answer makes one row that adds both, and keeps each spelling and box', () => {
    const ties = [tie(key('2" 90'), key('2" 90 pvc'))]
    const rows = sitePartRows(site, NOW, tieCanon(ties))
    const joined = rows.find((r) => r.memberKeys.includes(key('2" 90')))!
    expect(joined.total).toBe(94 + 42 + 42)
    expect(joined.spellings.map((s) => s.name)).toEqual(['2" 90 pvc', '2 inch 90 PVC', '2" 90'])
    expect(joined.boxes).toHaveLength(3)
    expect(joined.memberKeys).toHaveLength(2)
    expect(joinedTies(joined, ties)).toHaveLength(1)
    expect(rows.reduce((n, r) => n + r.total, 0)).toBe(94 + 42 + 42 + 30 + 300 + 12)
  })
  it('a typed name tied to a book part reads as the book part', () => {
    const ties = [tie('id:book-1', key('3/4 copper tee'))]
    const rows = sitePartRows(site, NOW, tieCanon(ties))
    const tee = rows.find((r) => r.partId === 'book-1')!
    expect(tee.key).toBe('id:book-1')
    expect(tee.name).toBe('3/4 COPPER TEE')
    expect(tee.total).toBe(312)
  })
  it('with no tie, every row is as before', () => {
    expect(sitePartRows(site, NOW, tieCanon([])).map((r) => r.total)).toEqual(sitePartRows(site, NOW).map((r) => r.total))
  })
})

describe('samePartAsks', () => {
  const site = [job([['2" 90 pvc', 94], ['2" 90', 42], ['3" 90 pvc', 30], ['3" 90', 8], ['4" san tee', 6], ['4" sani tee', 9], ['Oil', 1]])]
  const rows = (ties: PartTie[] = []) => sitePartRows(site, NOW, tieCanon(ties))
  it('asks once per pair, under the smaller row, the one-more-word pairs first', () => {
    const asks = samePartAsks(rows(), [], sameWordsKey)
    expect(asks.map((a) => `${a.row.name} ~ ${a.other.name} (${a.reason})`)).toEqual([
      '2" 90 ~ 2" 90 pvc (one-more-word)',
      '3" 90 ~ 3" 90 pvc (one-more-word)',
      '4" san tee ~ 4" sani tee (spelled-apart)',
    ])
    expect(askReasonWords(asks[0]!)).toBe('The sizes are the same. One name has one more word.')
  })
  it('an answer either way is never asked again', () => {
    const same = [tie(key('2" 90'), key('2" 90 pvc'))]
    expect(samePartAsks(rows(same), same, sameWordsKey).some((a) => a.other.name.startsWith('2"'))).toBe(false)
    const different = [tie(key('3" 90'), key('3" 90 pvc'), 'different')]
    expect(samePartAsks(rows(different), different, sameWordsKey).some((a) => a.row.name === '3" 90')).toBe(false)
  })
  it('never asks about two parts-book parts', () => {
    const books = [job([['2" 90 PVC DWV', 5, 'book-1'], ['2" 90 PVC', 5, 'book-2']])]
    expect(samePartAsks(sitePartRows(books, NOW), [], sameWordsKey)).toEqual([])
  })
  it('the answer it writes names the pair in one order with the names as they read', () => {
    const [ask] = samePartAsks(rows(), [], sameWordsKey)
    const t = tieFor(ask!.row, ask!.other, 'same')
    expect([t.aKey, t.bKey]).toEqual(orderedPair(key('2" 90'), key('2" 90 pvc')))
    expect([t.aName, t.bName].sort()).toEqual(['2" 90', '2" 90 pvc'])
    expect(tieFor(ask!.other, ask!.row, 'different').aKey).toBe(t.aKey)
  })
})
