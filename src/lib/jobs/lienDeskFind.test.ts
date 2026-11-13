import { describe, expect, it } from 'vitest'
import { lienFindCountWords, lienFindMatch, lienFindNothingWords, lienFindParts, lienFindPileCount, lienFindSingle, lienFindWords, type LienFindFacts } from './lienDeskFind'

const row890: LienFindFacts = {
  shown: ['890 · Dunmere Mallin', 'GC RLC- Dunmere Mallin', '$285', 'due in 9d', 'Aug'],
  hidden: [
    { label: 'address', text: '628 Tarrow Rd, San Antonio, TX 78209' },
    { label: 'owner', text: 'Rilvo Sorn Zelmar & Kestmere Quillan Fenna' },
  ],
}

describe('lienDeskFind (v2.4721) — matching', () => {
  it('matches the words a row shows, and the address and owner it keeps quiet, naming the hidden fact that landed', () => {
    expect(lienFindMatch(row890, lienFindWords('dunmere'))).toEqual({ ok: true, hits: [] })
    expect(lienFindMatch(row890, lienFindWords('890'))).toEqual({ ok: true, hits: [] })
    expect(lienFindMatch(row890, lienFindWords('tarrow'))).toEqual({ ok: true, hits: [{ label: 'address', text: '628 Tarrow Rd, San Antonio, TX 78209' }] })
    expect(lienFindMatch(row890, lienFindWords('RILVO'))).toEqual({ ok: true, hits: [{ label: 'owner', text: 'Rilvo Sorn Zelmar & Kestmere Quillan Fenna' }] })
    expect(lienFindMatch(row890, lienFindWords('kestrin'))).toEqual({ ok: false, hits: [] })
  })
  it('every typed word has to land somewhere; nothing typed matches everything', () => {
    expect(lienFindMatch(row890, lienFindWords('dunmere tarrow')).ok).toBe(true)
    expect(lienFindMatch(row890, lienFindWords('dunmere kestrin')).ok).toBe(false)
    expect(lienFindMatch(row890, lienFindWords('   '))).toEqual({ ok: true, hits: [] })
    expect(lienFindWords('  Dunmere   Mallin ')).toEqual(['dunmere', 'mallin'])
  })
  it('splits a text where the words land, keeping the case, so the row can mark the hit', () => {
    expect(lienFindParts('890 · Dunmere Mallin', ['dunmere'])).toEqual([{ text: '890 · ', hit: false }, { text: 'Dunmere', hit: true }, { text: ' Mallin', hit: false }])
    expect(lienFindParts('RLC- Dunmere Mallin', ['mallin', 'rlc'])).toEqual([{ text: 'RLC', hit: true }, { text: '- Dunmere ', hit: false }, { text: 'Mallin', hit: true }])
    expect(lienFindParts('Tune 5', ['zzz'])).toEqual([{ text: 'Tune 5', hit: false }])
    expect(lienFindParts('Tune 5', [])).toEqual([{ text: 'Tune 5', hit: false }])
  })
})

describe('lienDeskFind — the words around the list', () => {
  it('counts, pile counts, the empty state and the one match that selects itself', () => {
    expect(lienFindCountWords(1)).toBe('1 job')
    expect(lienFindCountWords(4)).toBe('4 jobs')
    expect(lienFindPileCount(2, 12, true)).toBe('2 of 12')
    expect(lienFindPileCount(2, 12, false)).toBe('12')
    expect(lienFindNothingWords(' zzz ')).toEqual({ head: 'Nothing matches “zzz”.', tryWords: 'Try the job number, the GC, the street or the owner’s name.', elsewhere: 'A notice already sent is under Sent · 30d, or ask ☎ Someone’s calling, which searches every job the desk ever sent.' })
    expect(lienFindSingle([{ jobId: 'j1' }], true)).toBe('j1')
    expect(lienFindSingle([{ jobId: 'j1' }, { jobId: 'j2' }], true)).toBeNull()
    expect(lienFindSingle([{ jobId: 'j1' }], false)).toBeNull()
  })
})
