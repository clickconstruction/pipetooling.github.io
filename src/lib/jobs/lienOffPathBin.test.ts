import { describe, expect, it } from 'vitest'
import { LIEN_OFF_PATH_NO_REASON, buildLienOffPathBin, lienOffPathSinceWords, lienOffPathWindowNote, type LienOffPathJob } from './lienOffPathBin'

const job = (over: Partial<LienOffPathJob>): LienOffPathJob => ({
  jobId: 'j1',
  number: '977',
  name: 'ZZ Trip Charges',
  gcName: 'ZZ Test Builders',
  unpaid: 1050,
  reason: 'The bill is for trips to pick up checks, not for work on the property.',
  since: '2026-11-16T21:00:00Z',
  byUserId: 'u1',
  attorneySince: null,
  status: 'billed',
  papers: [],
  ...over,
})

describe('the bin Off the lien path', () => {
  it('is not drawn with no job off the path', () => {
    expect(buildLienOffPathBin([])).toBeNull()
  })

  it('says the day and the person, each only when known', () => {
    expect(lienOffPathSinceWords('2026-11-16T21:00:00Z', 'Dana')).toBe('off since Nov 16, by Dana')
    expect(lienOffPathSinceWords('2026-11-16T21:00:00Z', null)).toBe('off since Nov 16')
    expect(lienOffPathSinceWords(null, 'Dana')).toBe('off by Dana')
    expect(lienOffPathSinceWords(null, '  ')).toBe('off')
  })

  it('draws a row with the job, its money, who, the day, the attorney and the reason', () => {
    const bin = buildLienOffPathBin([job({})], { userName: (id) => (id === 'u1' ? 'Dana' : null) })
    expect(bin).toEqual({
      title: 'Off the lien path',
      count: 1,
      totalWords: '$1,050 unpaid',
      foldWords: '1 job · $1,050 unpaid',
      backLabel: 'Put it back…',
      rows: [
        {
          jobId: 'j1',
          label: '977 · ZZ Trip Charges',
          unpaidWords: '$1,050',
          line: 'ZZ Test Builders · off since Nov 16, by Dana · not on the attorney’s list',
          reason: 'The bill is for trips to pick up checks, not for work on the property.',
        },
      ],
    })
  })

  it('names who took a job off by the name the read found, before asking for one', () => {
    const bin = buildLienOffPathBin([job({ byName: ' Dana ' })], { userName: () => 'Someone else' })
    expect(bin?.rows[0]?.line).toBe('ZZ Test Builders · off since Nov 16, by Dana · not on the attorney’s list')
  })

  it('says since when a job is with the attorney, and why one cannot go on the list', () => {
    const bin = buildLienOffPathBin([job({ attorneySince: '2026-11-17T15:00:00Z' }), job({ jobId: 'j2', number: '978', status: 'working', unpaid: 10 })])
    expect(bin?.rows[0]?.line).toBe('ZZ Test Builders · off since Nov 16 · with the attorney since Nov 17')
    expect(bin?.rows[1]?.line).toBe('ZZ Test Builders · off since Nov 16 · not on the attorney’s list, the job is still being worked')
  })

  it('puts the most money first, counts every job and adds the money', () => {
    const bin = buildLienOffPathBin([job({ jobId: 'a', number: '100', unpaid: 350 }), job({ jobId: 'b', number: '200', unpaid: 1050.4 }), job({ jobId: 'c', number: '050', unpaid: 350 })])
    expect(bin?.rows.map((r) => r.jobId)).toEqual(['b', 'c', 'a'])
    expect(bin?.count).toBe(3)
    expect(bin?.totalWords).toBe('$1,750 unpaid')
    expect(bin?.foldWords).toBe('3 jobs · $1,750 unpaid')
  })

  it('keeps a row readable when a name, a GC or the reason is missing', () => {
    const bin = buildLienOffPathBin([job({ name: '', gcName: '', reason: '  ', byUserId: null })])
    expect(bin?.rows[0]).toMatchObject({ label: '977', line: 'off since Nov 16 · not on the attorney’s list', reason: LIEN_OFF_PATH_NO_REASON })
  })

  it('gives the job\'s own Lien window a note only while the job is off the path', () => {
    expect(lienOffPathWindowNote({ lien_path_answer: null, lien_path_reason: 'Counsel says the claim stands.' })).toBeNull()
    expect(lienOffPathWindowNote(null)).toBeNull()
    expect(lienOffPathWindowNote({ lien_path_answer: 'off_path', lien_path_reason: 'Not for work on the property', lien_path_answered_at: '2026-11-16T21:00:00Z' })).toEqual({
      head: 'Off the lien path',
      line: 'Someone took this job off the lien path on Nov 16. The reason given: Not for work on the property. It is off the Lien desk, so nobody is reminded of its lien dates there. They still run, and every paper still drafts here.',
    })
    expect(lienOffPathWindowNote({ lien_path_answer: 'off_path' })?.line).toContain(`The reason given: ${LIEN_OFF_PATH_NO_REASON} It is off`)
  })
})
