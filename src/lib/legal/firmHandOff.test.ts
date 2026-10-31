import { describe, expect, it } from 'vitest'
import { coveredBy, handOffButton, handOffDoneWords, handOffErrorWords, handOffHold, handOffWords, receiverName, retireHold, retireReadyWords, retireWithHandOffHold, type HandOffInput } from './firmHandOff'

const COVERAGE = new Map([
  ['Travis', { first: 'snell', also: [] }],
  ['Williamson', { first: 'snell', also: [] }],
  ['Bell', { first: 'snell', also: [] }],
  ['Hays', { first: 'snell', also: [] }],
  ['Comal', { first: 'alamo', also: ['snell'] }],
  ['Bexar', { first: 'alamo', also: [] }],
])
const CASES = [
  { name: 'Burd & Assoc.', county: 'Williamson', stand: 'eyes' as const },
  { name: 'RMC-Dudley Mason', county: 'Williamson', stand: 'eyes' as const },
  { name: 'Heron Construction', county: 'Bell', stand: 'gave' as const },
  { name: 'The Learning Experience', county: 'Travis', stand: 'firm' as const },
]
const base: HandOffInput = {
  firmId: 'snell',
  firmName: 'Snell',
  coverage: COVERAGE,
  picked: ['Williamson', 'Bell'],
  receiver: { kind: 'firm', id: 'alamo', name: 'Alamo' },
  liveMatters: [{ payerName: 'The Learning Experience' }],
  cases: CASES,
  retire: false,
}

describe('firmHandOff (v2.6233)', () => {
  it('says what happens, one sentence each: where releases go, what the giver keeps, what stays, who reads the new firm', () => {
    expect(coveredBy(COVERAGE, 'snell')).toEqual(['Bell', 'Comal', 'Hays', 'Travis', 'Williamson'])
    expect(handOffWords(base)).toEqual([
      'New releases in Bell County and Williamson County go to Alamo. Alamo is first call there.',
      'Snell keeps Comal County, Hays County and Travis County.',
      'The Learning Experience stays with Snell until it closes.',
      'Burd & Assoc. and RMC-Dudley Mason, in review there, read Alamo as their firm from now on. This sends no email.',
    ])
  })

  it('all of it to a new firm, retired with it, reads so', () => {
    const all = { ...base, picked: coveredBy(COVERAGE, 'snell'), receiver: { kind: 'new' as const, name: 'Hill Country Recovery' }, liveMatters: [], retire: true }
    const words = handOffWords(all)
    expect(words[1]).toBe('Snell keeps no county.')
    expect(words[words.length - 1]).toBe('Snell is retired. Its link stops working, its people stop getting emails, and its history stays.')
    expect(handOffButton(all)).toBe('Hand off 5 counties to Hill Country Recovery')
  })

  it('nothing to say before a county is ticked; the button says what is missing and stays dead', () => {
    expect(handOffWords({ ...base, picked: [] })).toEqual([])
    expect(handOffHold({ picked: [], receiver: null })).toBe('Pick the counties that move.')
    expect(handOffHold({ picked: ['Bell'], receiver: null })).toBe('Pick the firm that takes them.')
    expect(handOffHold({ picked: ['Bell'], receiver: { kind: 'new', name: ' ' } })).toBe('Give the new firm a name.')
    expect(handOffHold({ picked: ['Bell'], receiver: { kind: 'firm', id: 'alamo', name: 'Alamo' } })).toBeNull()
    expect(handOffButton({ picked: [], receiver: null })).toBe('Hand off counties')
    expect(handOffButton({ picked: ['Bell'], receiver: { kind: 'firm', id: 'alamo', name: 'Alamo' } })).toBe('Hand off 1 county to Alamo')
    expect(receiverName({ kind: 'new', name: '' })).toBe('the new firm')
  })

  it('retire with the hand-off waits for every county and for the live accounts', () => {
    expect(retireWithHandOffHold('Snell', false, [])).toBe('Tick every county to retire Snell with them.')
    expect(retireWithHandOffHold('Snell', true, [{ payerName: 'The Learning Experience' }])).toBe('The Learning Experience is still with Snell.')
    expect(retireWithHandOffHold('Snell', true, [{ payerName: 'A' }, { payerName: 'B' }])).toBe('2 accounts are still with Snell.')
    expect(retireWithHandOffHold('Snell', true, [])).toBeNull()
  })

  it('retire on its own: counties first, accounts next, never the only firm', () => {
    expect(retireHold('Snell', 5, [{ payerName: 'The Learning Experience' }], 1)).toBe('Hand off its 5 counties first. The Learning Experience is still with Snell.')
    expect(retireHold('Snell', 1, [], 1)).toBe('Hand off its 1 county first.')
    expect(retireHold('Snell', 0, [], 0)).toBe('Snell is the only firm. Replace it with a new firm instead.')
    expect(retireHold('Snell', 0, [], 1)).toBeNull()
    expect(retireReadyWords('Snell')).toBe('Snell covers no county and holds no live matter. Its link stops working, its people stop getting emails, and its history stays.')
  })

  it('the toast and the refusals', () => {
    expect(handOffDoneWords(['Williamson', 'Bell'], 'Alamo', 'Snell', false)).toBe('Bell County and Williamson County went to Alamo.')
    expect(handOffDoneWords(['Hays'], 'Hill Country', 'Snell', true)).toBe('Hays County went to Hill Country. Snell is retired.')
    expect(handOffErrorWords({ message: 'Could not find the function public.legal_hand_off_counties(p_counties, p_from_firm) in the schema cache', code: 'PGRST202' })).toBe('Handing off needs a database update that is not live yet. Ask a dev to push it, then try again.')
    expect(handOffErrorWords({ message: 'timeout' })).toBe('Could not finish: timeout')
  })
})
