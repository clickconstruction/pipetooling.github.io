import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../../plainWords'
import { billDayDates, scheduleSays, tradeDraws, walkDraws } from './trades'
import { billDayJob, billDayState, WENDI_WALK, WHERE_ON_SITE } from '../../../test/fixtures/billDayDemo'
import {
  checkedGateClear,
  checkWindowWords,
  claimsToCheck,
  claimWords,
  inCheckWindow,
  needsWhy,
  newestChecks,
  tapChoices,
  underClaim,
  underWords,
  walkCounts,
  walkCountWords,
  walkFootWords,
  walkOrder,
  type ClaimToCheck,
  type LineCheck,
} from './walk'

function walk(checks: LineCheck[] = [], whereOf: (sovId: string) => string | null = (id) => WHERE_ON_SITE[id] ?? null) {
  const state = billDayState('2026-10-22')
  const project = billDayJob(state, 'stoneoak')
  const dates = billDayDates(state, project)
  const items = claimsToCheck(walkDraws(tradeDraws(state, project, dates)), checks, whereOf, (id) => scheduleSays(project, id, dates.billDay))
  return { items, dates }
}

describe('claimsToCheck', () => {
  it('lists the lines that moved and the stored material, in walking order, with the claim, the last draw and the schedule', () => {
    const { items, dates } = walk()
    expect(items.map((i) => [i.where, i.company, i.label, i.kind, i.claimed, i.last])).toEqual([
      ['Yard', 'Lone Star Mechanical', 'Equipment', 'stored', null, null],
      ['Level 1', 'Lone Star Mechanical', 'Rough-in, level 1', 'work', 90, 40],
      ['Level 2', 'Lone Star Mechanical', 'Rough-in, level 2', 'work', 10, 0],
    ])
    // Underground claims what was billed before: nothing to check.
    expect(items.some((i) => i.sovId === 'ls-under')).toBe(false)
    expect(items.map((i) => claimWords(i, dates.billDay))).toEqual([
      'stored material, on site?',
      'claims 90%, last draw 40%, schedule 78% by Oct 25',
      'claims 10%, last draw 0%, schedule 12% by Oct 25',
    ])
  })

  it('reads the newest tap on each line, with who and when', () => {
    const later: LineCheck = { drawId: 'ls-2', sovId: 'ls-l1', weSee: 80, onSite: null, photo: false, note: 'Most of it hung now.', by: 'Wendi', at: '2026-10-23T08:00:00Z' }
    const { items } = walk([...WENDI_WALK, later])
    expect(items.find((i) => i.sovId === 'ls-l1')).toMatchObject({ weSee: 80, note: 'Most of it hung now.', photo: false, by: 'Wendi', at: '2026-10-23T08:00:00Z' })
    expect(newestChecks([later, ...WENDI_WALK]).get('ls-2:ls-l1')?.weSee).toBe(80)
  })

  it('puts a line with no place on the Site, and places off the list after the known ones in the order the lines name them', () => {
    const where: Record<string, string> = { 'ls-l1': 'Mezzanine', 'ls-l2': 'Basement' }
    const { items } = walk([], (id) => where[id] ?? null)
    expect(items.map((i) => i.where)).toEqual(['Site', 'Mezzanine', 'Basement'])
    expect(walkOrder([{ where: 'Roof' }, { where: 'Annex' }, { where: 'Site' }, { where: 'Yard' }]).map((x) => x.where)).toEqual(['Site', 'Yard', 'Roof', 'Annex'])
  })
})

describe('the photo-or-note rule and the checked gate', () => {
  it('clears once every line is tapped and the one under the claim has a photo or a note', () => {
    const { items } = walk(WENDI_WALK)
    expect(items.map((i) => [i.sovId, underClaim(i), needsWhy(i)])).toEqual([
      ['ls-equip', false, false],
      ['ls-l1', true, false],
      ['ls-l2', false, false],
    ])
    expect(checkedGateClear(items)).toBe(true)
    expect(walkCounts(items)).toEqual({ lines: 3, draws: 1, left: 0, needs: 0 })
    expect(walkCountWords(items)).toBe('every line tapped')
    expect(walkFootWords(items)).toBe("Every claim is checked. The office's gate clears by itself.")
  })

  it('asks for a photo or a note under the claim, on work and on stored material not on site', () => {
    const bare = WENDI_WALK.map((c) => (c.sovId === 'ls-l1' ? { ...c, photo: false, note: '  ' } : c.sovId === 'ls-equip' ? { ...c, onSite: false } : c))
    const { items } = walk(bare)
    expect(items.filter(needsWhy).map((i) => i.sovId)).toEqual(['ls-equip', 'ls-l1'])
    expect(checkedGateClear(items)).toBe(false)
    expect(walkCountWords(items)).toBe('every line tapped, 2 need a photo or a note')
    expect(items.filter(underClaim).map(underWords)).toEqual([
      'The stored material is not on site. A photo or a note says why.',
      '75% is under the 90% claimed. A photo or a note says why.',
    ])
    expect(walkFootWords(items)).toBe('Each tap is kept with who and when. The office approves. A tap never does.')
  })

  it('counts what is left to tap', () => {
    const { items } = walk(WENDI_WALK.slice(0, 1))
    expect(walkCounts(items)).toMatchObject({ left: 2, needs: 0 })
    expect(walkCountWords(items)).toBe('2 to tap')
    expect(checkedGateClear(items)).toBe(false)
  })
})

describe('tapChoices and the checking days', () => {
  it('offers the claim, 15 under and 25 under, never below the last draw', () => {
    expect(tapChoices(90, 40)).toEqual([90, 75, 65])
    expect(tapChoices(50, 40)).toEqual([50])
    expect(tapChoices(10, 0)).toEqual([10])
    expect(tapChoices(25, 0)).toEqual([25, 10, 0])
  })

  it('opens the list from the cut-off through two days before bill day', () => {
    const { dates } = walk()
    expect(['2026-10-18', '2026-10-19', '2026-10-23', '2026-10-24'].map((d) => inCheckWindow(dates, d))).toEqual([false, true, true, false])
    expect(checkWindowWords(dates, '2026-10-22')).toBe('Walk them by Fri Oct 23.')
    expect(checkWindowWords(dates, '2026-10-02')).toBe('The list comes on the checking days, Mon Oct 19 to Fri Oct 23, with a text on the first.')
  })
})

describe('the superintendent’s path', () => {
  it('never names a dollar, and writes plain words', () => {
    const { items, dates } = walk(WENDI_WALK.map((c) => ({ ...c, onSite: c.onSite === null ? null : false, photo: false, note: '' })))
    const words = [
      ...items.map((i: ClaimToCheck) => claimWords(i, dates.billDay)),
      ...items.filter(underClaim).map(underWords),
      walkCountWords(items),
      walkFootWords(items),
      checkWindowWords(dates, '2026-10-22'),
      checkWindowWords(dates, '2026-10-02'),
    ]
    for (const w of words) {
      expect(w).not.toContain('$')
      expect(plainWordsFailures(w)).toEqual([])
    }
  })
})
