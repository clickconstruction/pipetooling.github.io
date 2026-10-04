import { describe, expect, it } from 'vitest'
import type { TakeoffCandidate } from './takeoffCandidates'
import { pickChangeWords, pickCounts, standsApproved, standsLine, standsWords, piecePicksLine, piecePicksOf, planIsEmpty, planRowsAdded, planSummary, planTakeoffPicks, startingPick, startingPiecePicks, withPiecePicks, type FixturePick, type PiecePick } from './takeoffPicks'

const cand = (id: string, o: Partial<TakeoffCandidate> = {}): TakeoffCandidate => ({
  countRowId: id, fixture: id.toUpperCase(), count: 2, tagText: id.toUpperCase(), tags: [id.toUpperCase()], product: 'a product', pieces: [], storedProductKeys: null, productKeys: [], partId: null,
  supplyHouseId: null, supplyHouseName: null, group: 'fixtures', defaultTicked: true, storedTick: null, ticked: true, alreadyOn: false, canSplit: false, storedSplit: null, split: false, ...o,
})
const picks = (o: Record<string, FixturePick>) => new Map(Object.entries(o))

describe('where a fixture starts', () => {
  it('as it sits on the draft, whatever the bid remembers', () => {
    expect(startingPick({ onAs: 'gc', ticked: false, storedOrderOnly: true })).toBe('gc')
    expect(startingPick({ onAs: 'order', ticked: true, storedOrderOnly: false })).toBe('order')
  })

  it('off the draft: the remembered tick and order-only pick, else the group’s rule', () => {
    expect(startingPick({ onAs: null, ticked: true, storedOrderOnly: false })).toBe('gc')
    expect(startingPick({ ticked: true, storedOrderOnly: true })).toBe('order')
    expect(startingPick({ ticked: false, storedOrderOnly: true })).toBe('out')
  })
})

describe('what the picks change on the draft', () => {
  const cands = [
    cand('fco', { onAs: 'gc', alreadyOn: true }),
    cand('fd', { onAs: 'gc', alreadyOn: true }),
    cand('wha', { onAs: 'order', alreadyOn: true }),
    cand('hb', { onAs: 'gc', alreadyOn: true }),
    cand('sink', { ticked: false }),
    cand('wc', { ticked: false, canSplit: true, tags: ['WC-1', 'WC-2'] }),
    cand('pipe', { ticked: false, group: 'pipe_allowance' }),
  ]

  it('nothing clicked: nothing changes, and every fixture is still remembered as it stands', () => {
    const plan = planTakeoffPicks(cands, new Map())
    expect(planIsEmpty(plan)).toBe(true)
    expect(planSummary(plan, 'Rev 1')).toBe('')
    expect([...plan.ticks]).toEqual([['fco', true], ['fd', true], ['wha', true], ['hb', true], ['sink', false], ['wc', false], ['pipe', false]])
    expect([...plan.orderOnly].filter(([, v]) => v).map(([k]) => k)).toEqual(['wha'])
    expect(pickCounts(cands, new Map())).toEqual({ gc: 3, order: 1, out: 3, stands: 0 })
  })

  it('a row on the draft moves to order only, back to the GC, or off; a fixture off it comes on either way', () => {
    const p = picks({ fco: 'order', wha: 'gc', hb: 'out', sink: 'order', wc: 'gc' })
    const plan = planTakeoffPicks(cands, p, new Map([['wc', true]]))
    expect(plan.toOrderOnly).toEqual(['fco'])
    expect(plan.toGc).toEqual(['wha'])
    expect(plan.remove).toEqual(['hb'])
    expect(plan.add.map((a) => [a.candidate.countRowId, a.orderOnly, a.candidate.split])).toEqual([['sink', true, false], ['wc', false, true]])
    // The split fixture is two rows.
    expect(planRowsAdded(plan)).toBe(3)
    expect(planSummary(plan, 'Rev 1')).toBe('3 rows go on Rev 1 (1 order only) · 1 fixture moves to order only · 1 fixture goes back to the GC · 1 comes off Rev 1')
    expect(plan.ticks.get('hb')).toBe(false)
    expect(plan.orderOnly.get('fco')).toBe(true)
    expect(plan.orderOnly.get('wha')).toBe(false)
    expect(pickCounts(cands, p)).toEqual({ gc: 3, order: 2, out: 2, stands: 0 })
  })

  it('says what a click will do to a row already on the draft, and nothing for one that is not', () => {
    expect(pickChangeWords({ onAs: 'gc' }, 'order', 'Rev 1')).toBe('On Rev 1 now. It moves to order only: off the GC’s list, still on the log.')
    expect(pickChangeWords({ onAs: 'gc' }, 'out', 'Rev 1')).toBe('On Rev 1 now. It comes off Rev 1 and off the procurement log.')
    expect(pickChangeWords({ onAs: 'order' }, 'gc', 'Rev 1')).toBe('Order only now. It goes back on the GC’s list.')
    expect(pickChangeWords({ onAs: 'gc' }, 'gc', 'Rev 1')).toBe('')
    expect(pickChangeWords({ onAs: null }, 'order', 'Rev 1')).toBe('')
  })
})

describe('2026-10-02 · the parts of a fixture, each one of three', () => {
  const piece = (key: string, trim = false) => ({ key, label: key.toUpperCase(), partId: key, partTypeName: null, trim, houseId: null, houseName: null, quantity: 1, lineId: key, templateItemId: null, assembly: null, manufacturer: null })
  const lav = cand('lav', { pieces: [piece('bowl'), piece('faucet'), piece('stop', true)], productKeys: ['bowl', 'faucet'], product: 'BOWL + FAUCET' })

  it('off the draft a part starts by the takeoff’s rule and the bid’s memory; on it, as the row holds it', () => {
    expect([...startingPiecePicks(lav)]).toEqual([['bowl', 'gc'], ['faucet', 'gc'], ['stop', 'order']])
    // The bid remembers the faucet as left off: it is not a piece, and it is kept aside.
    const remembered = { ...lav, pieces: [piece('bowl'), piece('stop', true)], productKeys: ['bowl'], leftOutPieces: [piece('faucet')], allPieces: lav.pieces }
    expect([...startingPiecePicks(remembered)]).toEqual([['bowl', 'gc'], ['faucet', 'out'], ['stop', 'order']])
    // On the draft the row has the bowl as order only and no stop.
    const onDraft = { ...lav, onAs: 'gc' as const, onParts: [{ key: 'bowl', onSubmittal: false }, { key: 'faucet', onSubmittal: true }] }
    expect([...startingPiecePicks(onDraft)]).toEqual([['bowl', 'order'], ['faucet', 'gc'], ['stop', 'out']])
    expect(piecePicksLine(startingPiecePicks(onDraft))).toBe('1 the GC sees · 1 order only · 1 left out')
  })

  it('the fixture as picked: kept lines are its pieces, the GC’s are its product, the rest are set aside in takeoff order', () => {
    const c = withPiecePicks(lav, new Map<string, PiecePick>([['bowl', 'out'], ['faucet', 'gc'], ['stop', 'order']]))
    expect(c.pieces.map((p) => p.key)).toEqual(['faucet', 'stop'])
    expect(c.productKeys).toEqual(['faucet'])
    expect(c.product).toBe('FAUCET')
    expect(c.leftOutPieces!.map((p) => p.key)).toEqual(['bowl'])
    expect(c.allPieces!.map((p) => p.key)).toEqual(['bowl', 'faucet', 'stop'])
    // A click on a key the fixture does not have is ignored.
    expect(piecePicksOf(lav, new Map([['gone', 'out' as const]])).has('gone')).toBe(false)
  })

  it('the plan: a fixture coming on is built from its picks; a row staying on the draft takes them; one coming off needs none; an untouched fixture remembers nothing new', () => {
    const coming = cand('lav', { ...lav, ticked: true })
    const staying = { ...cand('ewc', { pieces: lav.pieces, productKeys: ['bowl', 'faucet'] }), alreadyOn: true, onAs: 'gc' as const, onParts: [{ key: 'bowl', onSubmittal: true }, { key: 'faucet', onSubmittal: true }, { key: 'stop', onSubmittal: false }] }
    const leaving = { ...staying, countRowId: 'wc' }
    const untouched = { ...staying, countRowId: 'hb' }
    const pp = new Map<string, Map<string, PiecePick>>([
      ['lav', new Map([['stop', 'out']])],
      ['ewc', new Map([['faucet', 'order']])],
      ['wc', new Map([['faucet', 'order']])],
      ['hb', new Map([['bowl', 'gc']])], // clicked, but where it already stood
    ])
    const plan = planTakeoffPicks([coming, staying, leaving, untouched], new Map([['wc', 'out']]), undefined, pp)
    expect(plan.add.map((a) => [a.candidate.countRowId, a.candidate.pieces.map((p) => p.key)])).toEqual([['lav', ['bowl', 'faucet']]])
    expect(plan.parts.map((x) => [x.countRowId, x.candidate.productKeys])).toEqual([['ewc', ['bowl']]])
    expect(plan.remove).toEqual(['wc'])
    expect([...plan.leftOut.keys()].sort()).toEqual(['ewc', 'lav', 'wc'])
    expect(plan.leftOut.get('lav')).toEqual(['stop'])
    expect(plan.productKeys.has('hb')).toBe(false)
    expect(planIsEmpty(plan)).toBe(false)
    expect(planSummary(plan, 'Rev 1')).toBe('1 row goes on Rev 1 · 1 comes off Rev 1 · parts change on 1 fixture')
  })
})

describe('2026-10-03 · a fixture the GC approved on an earlier revision', () => {
  // BP398 Rev 4, built from the one row Rev 3 sent back: the heater is on the draft, the sinks and the toilets stand approved on Rev 3.
  const cands = [
    cand('sinks', { standsOn: { rev: 3, whole: true } }),
    cand('heater', { onAs: 'gc', alreadyOn: true }),
    cand('toilets', { standsOn: { rev: 3, whole: false } }),
    cand('wh', { ticked: false }),
  ]

  it('left alone it is none of the three picks: nothing goes on the draft, and what the bid remembers is not rewritten', () => {
    const plan = planTakeoffPicks(cands, new Map())
    expect(planIsEmpty(plan)).toBe(true)
    expect(planSummary(plan, 'Rev 4')).toBe('')
    expect([...plan.ticks.keys()]).toEqual(['heater', 'wh'])
    expect(pickCounts(cands, new Map())).toEqual({ gc: 1, order: 0, out: 1, stands: 2 })
    expect(standsApproved(cands[0]!, new Map())).toBe(true)
    expect(standsWords(cands[0]!.standsOn!)).toBe('Approved on Rev 3')
    expect(standsWords(cands[2]!.standsOn!)).toBe('Part approved on Rev 3')
    expect(standsLine(cands)).toBe('2 approved on Rev 3')
    expect(standsLine([cand('a', { standsOn: { rev: 1, whole: true } }), cand('b', { standsOn: { rev: 3, whole: true } })])).toBe('2 approved on earlier revisions')
    expect(standsLine([cand('a')])).toBe('')
  })

  it('Ask again puts it on the draft, and the line under its name says the GC answers it again', () => {
    const p = picks({ sinks: 'gc' })
    expect(standsApproved(cands[0]!, p)).toBe(false)
    const plan = planTakeoffPicks(cands, p)
    expect(plan.add.map((a) => a.candidate.countRowId)).toEqual(['sinks'])
    expect(planSummary(plan, 'Rev 4')).toBe('1 row goes on Rev 4')
    expect(pickChangeWords(cands[0]!, 'gc', 'Rev 4')).toBe('Approved on Rev 3. It goes on Rev 4 and the GC is asked again.')
    expect(pickChangeWords(cands[2]!, 'order', 'Rev 4')).toBe('Part approved on Rev 3. It goes on Rev 4 as order only.')
    expect(pickCounts(cands, p)).toEqual({ gc: 2, order: 0, out: 1, stands: 1 })
  })

  it('a fixture on the draft is the draft’s, whatever stood before', () => {
    expect(standsApproved({ countRowId: 'x', onAs: 'gc', standsOn: { rev: 3, whole: true } }, new Map())).toBe(false)
  })
})
