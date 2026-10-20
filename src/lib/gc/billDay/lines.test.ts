import { describe, expect, it } from 'vitest'
import { drawApprovedLess } from '../building'
import { askedOf, drawAtWeSee, heldOutChanges, walkedWords } from './lines'
import { billDayJob, billDayState, WENDI_WALK } from '../../../test/fixtures/billDayDemo'
import { scheduleSays } from './trades'
import type { LineCheck } from './walk'

function loneStar() {
  const state = billDayState('2026-10-22')
  const project = billDayJob(state, 'stoneoak')
  const pkg = project.packages.find((k) => k.id === 'so-mech')
  const sow = pkg?.sow
  const draw = sow?.draws.find((d) => d.id === 'ls-2')
  if (!pkg || !sow || !draw) throw new Error('no Lone Star draw 2')
  return { project, pkg, sow, draw }
}

describe('drawAtWeSee', () => {
  it('approves Lone Star’s draw 2 at what Wendi saw: $27,180, the prototype’s number, less 10% retainage', () => {
    const { project, pkg, sow, draw } = loneStar()
    const at = drawAtWeSee(project, pkg, sow, draw, WENDI_WALK, (id) => scheduleSays(project, id, '2026-10-25'))
    expect([at.gross, at.retainage, at.net, at.retainagePct]).toEqual([30_200, 3_020, 27_180, 10])
    // The same money the Draws window approves.
    expect(drawApprovedLess(sow, draw, { 'ls-l1': 75, 'ls-l2': 10 })).toMatchObject({ gross: 30_200, retainage: 3_020, net: 27_180 })
    expect(at.asked).toEqual({ gross: 38_900, retainage: 3_890, net: 35_010 })
    expect(at.lines.map((l) => [l.label, l.last, l.claimed, l.weSee, l.doubt, l.thisDraw, l.asClaimed])).toEqual([
      ['Rough-in, level 1', 40, 90, 75, true, 20_300, 29_000],
      ['Rough-in, level 2', 0, 10, 10, false, 5_800, 5_800],
      ['Equipment', 0, 0, null, false, 4_100, 4_100],
    ])
    expect(at.lines.reduce((s, l) => s + l.thisDraw, 0)).toBe(at.gross)
    expect(at.lines[0]?.schedule).toBeCloseTo(78.125, 6)
    expect(at.lines[2]).toMatchObject({ stored: 4_100, onSite: true })
    expect(at.lines[0]).toMatchObject({ photo: true, note: 'East wing branch lines not hung.' })
  })

  it('reads a line nobody walked at the claim, and a tap above the claim at the claim', () => {
    const { project, pkg, sow, draw } = loneStar()
    expect(drawAtWeSee(project, pkg, sow, draw, []).net).toBe(35_010)
    const over: LineCheck[] = [{ drawId: 'ls-2', sovId: 'ls-l1', weSee: 95, onSite: null, photo: false, note: '', by: 'Wendi', at: '2026-10-22T10:00:00Z' }]
    const at = drawAtWeSee(project, pkg, sow, draw, over)
    expect([at.net, at.lines[0]?.thisDraw, at.lines[0]?.doubt]).toEqual([35_010, 29_000, false])
  })

  it('keeps stored material as asked when the walk did not see it on site, as the Draws window approves it', () => {
    const { project, pkg, sow, draw } = loneStar()
    const notThere = WENDI_WALK.map((c) => (c.sovId === 'ls-equip' ? { ...c, onSite: false } : c))
    const at = drawAtWeSee(project, pkg, sow, draw, notThere)
    expect([at.net, at.lines[2]?.onSite]).toEqual([27_180, false])
  })

  it('holds back the statement of work’s own retainage', () => {
    const { project, pkg, sow, draw } = loneStar()
    const at = drawAtWeSee(project, pkg, { ...sow, retainagePct: 5 }, draw, WENDI_WALK)
    expect([at.retainage, at.net, at.retainagePct]).toEqual([1_510, 28_690, 5])
  })

  it('says who walked the lines and when, from the newest tap', () => {
    const { project, pkg, sow, draw } = loneStar()
    const at = drawAtWeSee(project, pkg, sow, draw, WENDI_WALK)
    expect([at.walkedOn, at.walkedBy]).toEqual(['2026-10-22T10:20:00Z', 'Wendi'])
    expect(walkedWords(at)).toBe('Wendi saw the lines on site Thu Oct 22. The photos are on the daily log.')
    expect(walkedWords(drawAtWeSee(project, pkg, sow, draw, []))).toBe('Not walked yet.')
  })
})

describe('heldOutChanges and askedOf', () => {
  it('holds out a change order until it is signed both ways, naming whose signature it waits on', () => {
    const { project, pkg } = loneStar()
    expect(heldOutChanges(project, pkg)).toEqual([{ name: 'CO 1', amount: 2_600, waitsOn: 'customer' }])
    const kerr = project.packages.find((k) => k.id === 'so-elec')
    if (!kerr) throw new Error('no Kerr Electric')
    // CO 3 is signed both ways: a line they can claim, nothing held out.
    expect(heldOutChanges(project, kerr)).toEqual([])
    const toSend = { ...project, changeOrders: (project.changeOrders ?? []).map((co) => (co.id === 'so-co1' ? { ...co, status: 'signed' as const } : co)) }
    expect(heldOutChanges(toSend, pkg)).toEqual([{ name: 'CO 1', amount: 2_600, waitsOn: 'us' }])
  })

  it('reads what a draw asked from before the back-charges we took off it', () => {
    const state = billDayState()
    const tejas = billDayJob(state, 'stoneoak').packages.find((k) => k.id === 'so-lv')?.sow?.draws.find((d) => d.number === 2)
    if (!tejas) throw new Error('no Tejas draw 2')
    expect([tejas.net, askedOf(tejas).net]).toEqual([13_500, 14_400])
  })
})
