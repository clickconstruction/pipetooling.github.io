/**
 * The ring on main's test data, read through main's kernels, against what the prototype reads on the same made-up data (the
 * Board's B2b-vi). Each expectation is the prototype's own reading (`stageProgress` on branch spike/gc-mode, as its golden test pins
 * it), so main and the prototype give one answer: the count in the middle, the line that says what it counts, each type's done of
 * total, what is left, and the lines under Also.
 */
import { describe, expect, it } from 'vitest'
import { stageProgress } from './progress'
import { initialGcState } from './schedule/testState'

const read = (id: string) => {
  const s = initialGcState()
  const p = s.projects.find((x) => x.id === id)
  if (!p) throw new Error(`no ${id}`)
  const r = stageProgress(s, p)
  return {
    share: r.share,
    center: r.center,
    headline: r.headline,
    groups: r.groups.map((g) => `${g.label}: ${g.items.filter((i) => i.done).length} of ${g.items.length}`),
    left: r.groups.flatMap((g) => g.items.filter((i) => !i.done).map((i) => `${i.label} · ${i.detail}`)),
    also: r.also,
  }
}

describe('the ring on the test data, as the prototype reads it', () => {
  it('Boerne, bidding: 14/25', () => {
    const r = read('boerne')
    expect(r.share).toBeCloseTo(0.56, 6)
    expect(r.center).toBe('14/25')
    expect(r.headline).toBe('14 of 25 steps done before our bid can go in.')
    expect(r.groups).toEqual([
      'Get 2 quotes for each trade: 4 of 7',
      "Pick the quote we'll use for each trade: 3 of 8",
      'Confirm quotes after plan changes: 7 of 9',
      'Send our bid: 0 of 1',
    ])
    expect(r.left).toEqual([
      'Structural steel · 0 of 2 in. 1 still asked.',
      'Roofing · 1 of 2 in. 1 still asked.',
      'Fire sprinkler · 0 of 2 in. Ask more companies.',
      'Structural steel · No quote yet.',
      'Roofing · Summit Roofing, 112K + ?. 1 line has no cost yet: roof curbs. Set it in Compare quotes.',
      'HVAC · 2 quotes in. Pick one to carry.',
      'Electrical · 2 quotes in. Pick one to carry.',
      'Fire sprinkler · No quote yet.',
      'Cool Breeze Mechanical on HVAC · Priced on Bid set. Addendum 1 changed the HVAC sheets. Ask them to confirm.',
      'Voltage Brothers on Electrical · Priced on Bid set. Addendum 1 changed panels and feeders, and the trade as a whole. Ask them to confirm.',
      'Not sent yet · Due Thu Oct 8',
    ])
    expect(r.also).toEqual(['3 companies need a call. See Follow up.', '5 of 13 companies have not opened Addendum 1.'])
  })

  it('Pad B, bidding: 1/6', () => {
    const r = read('padb')
    expect(r.share).toBeCloseTo(0.166667, 6)
    expect(r.center).toBe('1/6')
    expect(r.headline).toBe('1 of 6 steps done before our bid can go in.')
    expect(r.groups).toEqual([
      'Get 2 quotes for each trade: 0 of 2',
      "Pick the quote we'll use for each trade: 1 of 3",
      'Send our bid: 0 of 1',
    ])
    expect(r.left).toEqual([
      'Sitework · 0 of 2 in. Ask more companies.',
      'Concrete · 0 of 2 in. Ask more companies.',
      'Sitework · No quote yet.',
      'Concrete · No quote yet.',
      'Not sent yet · Due Thu Oct 22',
    ])
    expect(r.also).toEqual([])
  })

  it('Helotes, buying out: 14/25', () => {
    const r = read('helotes')
    expect(r.share).toBeCloseTo(0.56, 6)
    expect(r.center).toBe('14/25')
    expect(r.headline).toBe('14 of 25 steps done before work can start.')
    expect(r.groups).toEqual([
      'Our contract, permit and start date: 1 of 3',
      'Draw the schedule: 0 of 1',
      'Award each trade: 4 of 5',
      'Get the master agreement signed: 2 of 4',
      'Get current insurance: 3 of 4',
      'Get each W-9: 3 of 4',
      'Get the statement of work signed: 1 of 4',
    ])
    expect(r.left).toEqual([
      'The permit is in hand · not yet',
      'A start date is set · no date yet',
      'The schedule is drawn · not drawn yet',
      'Millwork · no company picked',
      'HVAC · sent, not signed',
      'Millwork · after the award',
      'Millwork · after the award',
      'Millwork · after the award',
      'Electrical · sent, not signed',
      'HVAC · drafted, not sent',
      'Millwork · after the award',
    ])
    expect(r.also).toEqual([])
  })

  it('Fair Oaks D, building: 74%', () => {
    const r = read('fairoaksd')
    expect(r.share).toBeCloseTo(0.7422, 6)
    expect(r.center).toBe('74%')
    expect(r.headline).toBe('74% of the work is done, by what the trades and our own crew have reported.')
    expect(r.groups).toEqual(['Trades report their work: 2 of 7'])
    expect(r.left).toEqual([
      'Structural steel · 97% reported',
      'Electrical · 54% reported',
      'Roofing · 70% reported',
      'Plumbing · Our own crew, 65% done',
      'HVAC · 27% reported',
    ])
    expect(r.also).toEqual([
      'The schedule: 3 days behind the plan, 72% done where 76% was planned. Dry-in is 7 days late. Next: Rough-in inspection, Oct 13. 4 look-ahead marks wait on our superintendent.',
      'The electrical service inspection failed Sep 28 on the Electrical work. Re-inspection Oct 2.',
      'Not walked yet. Nobody has checked these dates against the job. Open the Schedule tab and tap Update the week.',
      'Guadalupe Flatwork has 1 punch item to fix on Concrete.',
      '1 punch item on Concrete is fixed. Check it on Closeout.',
      'Iron Horse Fabrication asked for draw 2. Approve it.',
      'Pecan Valley Electric owes the unconditional waiver on draw 1.',
      'Pecan Valley Electric asked for draw 2. Their insurance expired Sep 15. Approve it once that is fixed.',
      'Pay application 1 is back with Summit Roofing. Waiting on a fixed one.',
      'No daily log for Wed Sep 30.',
      'Submittal 07 62 00-01, Sheet metal and flashing, from Summit Roofing waits on us. It is needed today.',
      'Tri-County Site asked for a change 2 days ago: Rock at the north footings, about 390 cubic yards to break out and haul off, $14,820. Answer it on Bill the customer.',
    ])
  })

  it('Stone Oak, building and all reported: 100%', () => {
    const r = read('stoneoak')
    expect(r.share).toBe(1)
    expect(r.center).toBe('100%')
    expect(r.headline).toBe('100% of the work is done, by what the trades and our own crew have reported.')
    expect(r.groups).toEqual(['Trades report their work: 4 of 4'])
    expect(r.left).toEqual([])
    expect(r.also).toEqual([
      'Live Oak Drywall asked for its retainage back. Approve it on Closeout.',
      'Westside Electric asked for its retainage back. Approve it on Closeout.',
      'All the work is reported. 0 of 3 trades are closed out. See Closeout.',
    ])
  })
})
