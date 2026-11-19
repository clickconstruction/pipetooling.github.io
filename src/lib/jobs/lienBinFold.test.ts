import { describe, expect, it } from 'vitest'
import { lienBinFoldLine, lienBinFoldPress } from './lienBinFold'
import { buildLienOffPathBin, type LienOffPathJob } from './lienOffPathBin'
import { buildLienPublicBin, type LienPublicJob } from './lienPublicProperty'

const publicJob = (over: Partial<LienPublicJob>): LienPublicJob => ({ jobId: 'j640', addressId: 'a1', number: '640', name: 'ZZ Maple Fork School', gcName: 'ZZ Harlan Builders', unpaid: 7100, bond: 'yes', attorneySince: null, status: 'billed', papers: [], ...over })
const offPathJob = (over: Partial<LienOffPathJob>): LienOffPathJob => ({ jobId: 'j977', number: '977', name: 'ZZ Trip Charges', gcName: 'ZZ Test Builders', unpaid: 1050, reason: 'Trips to pick up checks.', since: '2026-11-16T21:00:00Z', byUserId: 'u1', byName: 'Dana', attorneySince: null, status: 'billed', papers: [], ...over })

describe('lienBinFold (punch list #390, part 1)', () => {
  it('Public jobs: the line counts the jobs in words before the money, and counts the rows whose chip the fold hides', () => {
    const bin = buildLienPublicBin([publicJob({}), publicJob({ jobId: 'j655', number: '655', name: 'ZZ Cedar Annex', unpaid: 2300, bond: 'unknown' })])!
    expect(lienBinFoldLine(bin)).toEqual({ words: '2 jobs · $9,400 unpaid', ask: '1 to get the bond' })
  })

  it('one job reads job, and a box where every bond is known asks nothing', () => {
    expect(lienBinFoldLine(buildLienPublicBin([publicJob({ unpaid: 2300 })])!)).toEqual({ words: '1 job · $2,300 unpaid', ask: null })
    expect(lienBinFoldLine(buildLienPublicBin([publicJob({}), publicJob({ jobId: 'n', number: '641', bond: 'no' })])!).ask).toBeNull()
  })

  it('every row with the chip is counted', () => {
    const bin = buildLienPublicBin([publicJob({ bond: 'unknown' }), publicJob({ jobId: 'b', number: '641', bond: 'unknown' }), publicJob({ jobId: 'c', number: '642', bond: 'unknown' })])!
    expect(lienBinFoldLine(bin).ask).toBe('3 to get the bond')
  })

  it('Off the lien path: the same line, and its rows carry no chip so it asks nothing', () => {
    const bin = buildLienOffPathBin([offPathJob({}), offPathJob({ jobId: 'j978', number: '978', unpaid: 350 })])!
    expect(lienBinFoldLine(bin)).toEqual({ words: '2 jobs · $1,400 unpaid', ask: null })
  })

  it('two kinds of chip are each counted in their own words', () => {
    expect(lienBinFoldLine({ count: 3, totalWords: '$900 unpaid', rows: [{ jobId: 'a', chip: 'get the bond' }, { jobId: 'b', chip: ' ' }, { jobId: 'c', chip: 'call the clerk' }] }).ask).toBe('1 to get the bond · 1 to call the clerk')
  })

  it('the press says Show on a folded box and Hide on an open one', () => {
    expect(lienBinFoldPress(false)).toEqual({ label: 'Show', mark: '▾' })
    expect(lienBinFoldPress(true)).toEqual({ label: 'Hide', mark: '▴' })
  })
})
