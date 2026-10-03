/**
 * GC mode — design spike: the punch list (gcBuildingPunch.ts, the reducer's punch actions). Fair
 * Oaks D's concrete was walked Sep 28: one item to fix, one fixed and waiting on our check, one checked.
 */
import { describe, expect, it } from 'vitest'
import { gcReducer, initialGcState, punchClear, punchCounts, punchWords, stageProgress, tradeCloseout, type GcAction, type GcState } from './gcModel'

const fairOaks = (s: GcState) => {
  const p = s.projects.find((x) => x.id === 'fairoaksd')
  if (!p) throw new Error('no Fair Oaks D')
  return p
}
const concrete = (s: GcState) => {
  const pkg = fairOaks(s).packages.find((k) => k.id === 'fconc')
  if (!pkg?.sow) throw new Error('no concrete')
  return { pkg, sow: pkg.sow }
}
const play = (s: GcState, ...actions: GcAction[]) => actions.reduce(gcReducer, s)
const fix = (itemId: string): GcAction => ({ type: 'tradeFixPunchItem', projectId: 'fairoaksd', itemId })
const check = (itemId: string, fixed: boolean, note?: string): GcAction => ({ type: 'checkPunchItem', projectId: 'fairoaksd', itemId, fixed, ...(note ? { note } : {}) })
const accept: GcAction = { type: 'acceptWork', projectId: 'fairoaksd', packageId: 'fconc' }

describe('the punch list', () => {
  it('reads how a trade stands, on Closeout and on the ring card', () => {
    const s = initialGcState()
    const c = punchCounts(fairOaks(s), 'fconc')
    expect(c).toEqual({ open: 1, fixed: 1, done: 1, total: 3 })
    expect(punchWords(c)).toBe('1 to fix, 1 fixed and waiting on our check, 1 checked')
    const { sow } = concrete(s)
    expect(tradeCloseout(sow, fairOaks(s), s.today).next?.detail).toBe(
      'Punch list: 1 to fix, 1 fixed and waiting on our check, 1 checked. Accept the work once every item is checked fixed.',
    )
    expect(stageProgress(s, fairOaks(s)).also).toEqual(
      expect.arrayContaining(['Guadalupe Flatwork has 1 punch item to fix on Concrete.', '1 punch item on Concrete is fixed. Check it on Closeout.']),
    )
  })

  it('keeps the work from being accepted until every item is checked fixed', () => {
    const s = initialGcState()
    expect(punchClear(fairOaks(s), 'fconc')).toBe(false)
    expect(gcReducer(s, accept)).toBe(s)
  })

  it('goes back to the trade when it is not fixed, then accepts once all are checked', () => {
    const back = play(initialGcState(), fix('fairoaksd-punch-1'), check('fairoaksd-punch-2', false, 'Two joints in the back corner are still open.'))
    const two = fairOaks(back).punch?.find((i) => i.id === 'fairoaksd-punch-2')
    expect(two).toMatchObject({ fixedOn: null, checkedOn: null, sentBack: { times: 1, note: 'Two joints in the back corner are still open.', on: '2026-10-02' } })
    expect(back.log[0]?.text).toBe('Our superintendent sent a punch item back to Guadalupe Flatwork: Seal the control joints in the stockroom slab. Two joints in the back corner are still open.')
    const done = play(back, fix('fairoaksd-punch-2'), check('fairoaksd-punch-1', true), check('fairoaksd-punch-2', true))
    expect(punchCounts(fairOaks(done), 'fconc')).toEqual({ open: 0, fixed: 0, done: 3, total: 3 })
    expect(tradeCloseout(concrete(done).sow, fairOaks(done), done.today).next?.detail).toBe('The punch list is done: 3 checked. Accept the work.')
    const accepted = gcReducer(done, accept)
    expect(concrete(accepted).sow.acceptedOn).toBe('2026-10-02')
    // After acceptance it is warranty: nothing more goes on the list.
    expect(gcReducer(accepted, { type: 'addPunchItem', projectId: 'fairoaksd', packageId: 'fconc', text: 'One more' })).toBe(accepted)
  })

  it('adds an item for a trade we hire, not for our own crew or with no words', () => {
    const s = initialGcState()
    const added = gcReducer(s, { type: 'addPunchItem', projectId: 'fairoaksd', packageId: 'fconc', text: '  Grind the trip edge  at the joint ', where: 'East entry' })
    const list = fairOaks(added).punch ?? []
    expect(list[list.length - 1]).toEqual({
      id: 'fairoaksd-punch-4',
      packageId: 'fconc',
      text: 'Grind the trip edge at the joint',
      where: 'East entry',
      addedOn: '2026-10-02',
      fixedOn: null,
      checkedOn: null,
    })
    expect(added.log[0]?.text).toBe('Punch list, Concrete: Grind the trip edge at the joint, East entry. Guadalupe Flatwork fixes it in their portal.')
    expect(gcReducer(s, { type: 'addPunchItem', projectId: 'fairoaksd', packageId: 'fplumb', text: 'Our own crew' })).toBe(s)
    expect(gcReducer(s, { type: 'addPunchItem', projectId: 'fairoaksd', packageId: 'fconc', text: '   ' })).toBe(s)
  })

  it('takes each mark once, in order', () => {
    const s = initialGcState()
    // Fixed already, and checked already: a second mark changes nothing.
    expect(gcReducer(s, fix('fairoaksd-punch-2'))).toBe(s)
    expect(gcReducer(s, check('fairoaksd-punch-3', true))).toBe(s)
    // Not fixed yet: nothing to check.
    expect(gcReducer(s, check('fairoaksd-punch-1', true))).toBe(s)
  })
})
