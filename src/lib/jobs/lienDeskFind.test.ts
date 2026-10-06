import { describe, expect, it } from 'vitest'
import { lienFindCountWords, lienFindMatch, lienFindNothingWords, lienFindParts, lienFindPileCount, lienFindSingle, lienFindWords, type LienFindFacts } from './lienDeskFind'

const row890: LienFindFacts = {
  shown: ['890 · Dudley Mason', 'GC RMC- Dudley Mason', '$285', 'due in 9d', 'Aug'],
  hidden: [
    { label: 'address', text: '628 Terrell Rd, San Antonio, TX 78209' },
    { label: 'owner', text: 'Rizvi Syed Zulfiqar & Kizilbash Quratulain Fatima' },
  ],
}

describe('lienDeskFind (v2.4721) — matching', () => {
  it('matches the words a row shows, and the address and owner it keeps quiet, naming the hidden fact that landed', () => {
    expect(lienFindMatch(row890, lienFindWords('dudley'))).toEqual({ ok: true, hits: [] })
    expect(lienFindMatch(row890, lienFindWords('890'))).toEqual({ ok: true, hits: [] })
    expect(lienFindMatch(row890, lienFindWords('terrell'))).toEqual({ ok: true, hits: [{ label: 'address', text: '628 Terrell Rd, San Antonio, TX 78209' }] })
    expect(lienFindMatch(row890, lienFindWords('RIZVI'))).toEqual({ ok: true, hits: [{ label: 'owner', text: 'Rizvi Syed Zulfiqar & Kizilbash Quratulain Fatima' }] })
    expect(lienFindMatch(row890, lienFindWords('knight'))).toEqual({ ok: false, hits: [] })
  })
  it('every typed word has to land somewhere; nothing typed matches everything', () => {
    expect(lienFindMatch(row890, lienFindWords('dudley terrell')).ok).toBe(true)
    expect(lienFindMatch(row890, lienFindWords('dudley knight')).ok).toBe(false)
    expect(lienFindMatch(row890, lienFindWords('   '))).toEqual({ ok: true, hits: [] })
    expect(lienFindWords('  Dudley   Mason ')).toEqual(['dudley', 'mason'])
  })
  it('splits a text where the words land, keeping the case, so the row can mark the hit', () => {
    expect(lienFindParts('890 · Dudley Mason', ['dudley'])).toEqual([{ text: '890 · ', hit: false }, { text: 'Dudley', hit: true }, { text: ' Mason', hit: false }])
    expect(lienFindParts('RMC- Dudley Mason', ['mason', 'rmc'])).toEqual([{ text: 'RMC', hit: true }, { text: '- Dudley ', hit: false }, { text: 'Mason', hit: true }])
    expect(lienFindParts('Take 5', ['zzz'])).toEqual([{ text: 'Take 5', hit: false }])
    expect(lienFindParts('Take 5', [])).toEqual([{ text: 'Take 5', hit: false }])
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
