/**
 * The Dispatch hub's mode rule, read off the page: every entry × every flag, literally, then the
 * exclusion rule over the five modes with every exception named. The rule is the page's as it
 * stood before `useScheduleDispatchHubModes` took it over, but for its six gaps: a to c fixed in
 * v2.4989, d to f (the owner's calls of 2026-10-09) in v2.5009. A change flips its row here and
 * in `hubModes.ts`, and drops its line from the exceptions below.
 */
import { describe, expect, it } from 'vitest'
import {
  HUB_MODE_ENTRIES,
  HUB_MODE_FLAGS,
  HUB_MODES,
  hubModeClears,
  hubModeRow,
  type HubModeCell,
  type HubModeEntry,
  type HubModeFlag,
} from './hubModes'

const O = 'on' as const
const E = 'end' as const
const _ = 'keep' as const

// prettier-ignore
const EXPECTED: Record<HubModeEntry, readonly HubModeCell[]> = {
  //                   placement plusMenu linkedCopy assignPlacement multiCell picker pickerIntent cellContext addBlock placeJobParam armKey
  startPlacement:    [ O,        E,       E,         E,              E,        _,     _,           _,          E,       E,            _ ],
  startLinkedCopy:   [ E,        E,       O,         E,              E,        E,     _,           E,          _,       E,            _ ],
  startMultiCell:    [ E,        E,       E,         E,              O,        E,     E,           E,          _,       E,            _ ],
  openToolbarPicker: [ E,        E,       E,         E,              E,        O,     O,           E,          _,       E,            _ ],
  openCellPicker:    [ E,        E,       E,         E,              E,        O,     O,           O,          _,       E,            _ ],
  openMultiPicker:   [ _,        _,       _,         _,              _,        O,     O,           E,          _,       _,            _ ],
  pickJobToPlace:    [ E,        E,       _,         O,              _,        E,     E,           _,          _,       _,            _ ],
  newJob:            [ E,        E,       _,         _,              _,        E,     _,           E,          _,       _,            _ ],
  newJobToPlace:     [ _,        _,       _,         O,              _,        _,     _,           _,          _,       _,            _ ],
  urlArm:            [ E,        E,       E,         O,              E,        E,     _,           _,          _,       _,            O ],
  togglePlusMenu:    [ _,        O,       _,         _,              _,        _,     _,           _,          _,       _,            _ ],
  cancelPlacement:   [ E,        E,       _,         _,              _,        _,     _,           _,          _,       _,            _ ],
  placementDone:     [ E,        _,       _,         _,              _,        _,     _,           _,          _,       _,            _ ],
  endLinkedCopy:     [ _,        _,       E,         _,              _,        _,     _,           _,          _,       _,            _ ],
  endMultiCell:      [ _,        _,       _,         _,              E,        _,     _,           _,          _,       _,            _ ],
  cancelAssign:      [ _,        _,       _,         E,              _,        _,     _,           _,          _,       E,            _ ],
  assignCellPick:    [ _,        _,       _,         E,              _,        _,     _,           _,          _,       _,            _ ],
  closePicker:       [ _,        _,       _,         _,              E,        E,     E,           E,          _,       _,            _ ],
  multiCellApplied:  [ _,        _,       _,         _,              E,        E,     E,           E,          _,       _,            _ ],
  escapePlacement:   [ E,        E,       _,         _,              _,        _,     _,           _,          _,       _,            _ ],
  escapeAssign:      [ _,        _,       _,         E,              _,        _,     _,           _,          _,       E,            _ ],
  escapeLinkedCopy:  [ _,        _,       E,         _,              _,        _,     _,           _,          _,       _,            _ ],
  escapeMultiCell:   [ _,        _,       _,         _,              E,        _,     _,           _,          _,       _,            _ ],
  openAddBlock:      [ E,        E,       E,         E,              E,        E,     E,           E,          O,       E,            _ ],
  closeAddBlock:     [ _,        _,       _,         _,              _,        _,     _,           _,          E,       E,            _ ],
  tabAway:           [ E,        E,       E,         E,              E,        E,     _,           _,          _,       E,            _ ],
  weekNav:           [ E,        E,       E,         E,              E,        _,     _,           _,          _,       _,            E ],
  weekChanged:       [ _,        _,       _,         _,              E,        _,     _,           _,          _,       _,            _ ],
  urlIdle:           [ _,        _,       _,         _,              _,        _,     _,           _,          _,       _,            E ],
  jobWeek:           [ _,        _,       _,         E,              _,        E,     _,           _,          _,       _,            E ],
}

const expectedRow = (entry: HubModeEntry): Record<HubModeFlag, HubModeCell> =>
  Object.fromEntries(HUB_MODE_FLAGS.map((flag, i) => [flag, EXPECTED[entry][i]!])) as Record<HubModeFlag, HubModeCell>

/** Every mode an entry leaves on while it turns another on, or while it covers or leaves the board, with why. */
const KEPT_ON: Record<string, string> = {
  'startPlacement keeps picker': 'covered: the picker window sits over the board, so no + menu can be pressed under it',
  'openMultiPicker keeps placement': 'the multi-cell flow: startMultiCell ended it',
  'openMultiPicker keeps linkedCopy': 'the multi-cell flow: startMultiCell ended it',
  'openMultiPicker keeps assignPlacement': 'the multi-cell flow: startMultiCell ended it',
  'openMultiPicker keeps multiCell': 'the multi-cell flow: the bar stays until the add is written',
  'pickJobToPlace keeps linkedCopy': 'continues openToolbarPicker, which ended it',
  'pickJobToPlace keeps multiCell': 'continues openToolbarPicker, which ended it',
  'newJobToPlace keeps placement': 'continues newJob, which ended it',
  'newJobToPlace keeps linkedCopy': 'continues openToolbarPicker, which ended it',
  'newJobToPlace keeps multiCell': 'continues openToolbarPicker, which ended it',
  'newJobToPlace keeps picker': 'continues newJob, which ended it',
  'weekNav keeps picker': 'covered: the picker window sits over the week arrows',
}

describe('the mode rule, row by row', () => {
  it('has a row for every entry and no other', () => {
    expect([...HUB_MODE_ENTRIES].sort()).toEqual(Object.keys(EXPECTED).sort())
  })

  it.each(HUB_MODE_ENTRIES)('%s', (entry) => {
    expect(hubModeRow(entry)).toEqual(expectedRow(entry))
    expect([...hubModeClears(entry)].sort()).toEqual(HUB_MODE_FLAGS.filter((f) => expectedRow(entry)[f] === 'end').sort())
  })
})

describe('the exclusion rule over the five modes', () => {
  /** What an entry leaves on, among the modes it should end. */
  function kept(entry: HubModeEntry, ofModes: readonly HubModeFlag[]): string[] {
    const row = hubModeRow(entry)
    return ofModes.filter((m) => row[m] === 'keep').map((m) => `${entry} keeps ${m}`)
  }

  it('turning a mode on ends every other mode, but for the named exceptions', () => {
    const found: string[] = []
    for (const entry of HUB_MODE_ENTRIES) {
      const turnsOn = HUB_MODES.filter((m) => hubModeRow(entry)[m] === 'on')
      if (turnsOn.length === 0) continue
      found.push(...kept(entry, HUB_MODES.filter((m) => !turnsOn.includes(m))))
    }
    found.push(...kept('openAddBlock', HUB_MODES))
    found.push(...kept('tabAway', HUB_MODES), ...kept('weekNav', HUB_MODES))
    expect(found.sort()).toEqual(Object.keys(KEPT_ON).sort())
  })

  it('gaps a, b and c are fixed (v2.4989): the arm, the add-block window and the tabs end linked copy', () => {
    expect(hubModeRow('urlArm').linkedCopy).toBe('end')
    expect(hubModeRow('urlArm').picker).toBe('end')
    expect(hubModeRow('openAddBlock').linkedCopy).toBe('end')
    expect(hubModeRow('openAddBlock').placeJobParam).toBe('end')
    expect(hubModeRow('tabAway').linkedCopy).toBe('end')
    expect(hubModeRow('tabAway').picker).toBe('end')
  })

  it('gaps d, e and f are fixed (v2.5009): the week arrows end multi-cell, a cell’s + ends every mode, Esc ends one', () => {
    expect(hubModeRow('weekNav').multiCell).toBe('end')
    expect(HUB_MODES.filter((m) => m !== 'picker').map((m) => hubModeRow('openCellPicker')[m])).toEqual(['end', 'end', 'end', 'end'])
    expect(hubModeRow('openCellPicker').placeJobParam).toBe('end')
  })

  it('Esc ends only the mode it is pressed in, as that mode’s Cancel does (gap f, fixed v2.5009)', () => {
    expect([...hubModeClears('escapeLinkedCopy')]).toEqual(['linkedCopy'])
    expect([...hubModeClears('escapeMultiCell')]).toEqual(['multiCell'])
    expect([...hubModeClears('escapePlacement')].sort()).toEqual(['placement', 'plusMenu'])
    expect([...hubModeClears('escapeAssign')].sort()).toEqual(['assignPlacement', 'placeJobParam'])
    expect(hubModeRow('escapePlacement')).toEqual(hubModeRow('cancelPlacement'))
    expect(hubModeRow('escapeAssign')).toEqual(hubModeRow('cancelAssign'))
    expect(hubModeRow('escapeLinkedCopy')).toEqual(hubModeRow('endLinkedCopy'))
    expect(hubModeRow('escapeMultiCell')).toEqual(hubModeRow('endMultiCell'))
  })
})
