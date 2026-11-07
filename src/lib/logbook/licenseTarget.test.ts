import { describe, expect, it } from 'vitest'
import { draftFrom, ladderOptionWords, seededAmountToward, targetFromDraft, targetLines, targetMissing, targetOptions, targetSummary } from './licenseTarget'
import { goalsFor, openingsFrom, parseLicenseTargets, parseLicenseType, progressFor, requirementToward, type LicenseTarget } from './logbook'

const apprentice = parseLicenseType('Plumber Apprentice #191717', '2027-08-31')
const journeymanE = parseLicenseType('Journeyman Electrician #4')

describe('parseLicenseTargets', () => {
  it('types the rows and drops a class without a number', () => {
    const t = parseLicenseTargets([
      { trade: 'plumbing', target_class: 'journeyman', target_amount: '7000', opening_amount: '1200.5', opening_source: ' Hours at Rio Plumbing ' },
      { trade: 'electrical', target_class: 'master', target_amount: null, opening_amount: 0, opening_source: '' },
      { trade: 'roofing', target_class: null, target_amount: null, opening_amount: 0, opening_source: '' },
      null,
    ])
    expect(t).toEqual([
      { trade: 'plumbing', targetClass: 'journeyman', targetAmount: 7000, openingAmount: 1200.5, openingSource: 'Hours at Rio Plumbing' },
      { trade: 'electrical', targetClass: null, targetAmount: null, openingAmount: 0, openingSource: '' },
    ])
    expect(parseLicenseTargets(undefined)).toEqual([])
  })
})

describe('goalsFor with the office’s targets', () => {
  it('puts the board’s own number in place of the seeded one', () => {
    const { goals } = goalsFor([apprentice], [{ trade: 'plumbing', targetClass: 'journeyman', targetAmount: 7000, openingAmount: 0, openingSource: '' }])
    expect(goals[0]).toMatchObject({ fromOffice: true, requirement: { to: 'journeyman', toName: 'Journeyman plumber', need: 7000, unit: 'hours', supervisorClass: 'master', board: 'TSBPE' } })
    expect(goals[0]?.requirement.caveat).toBeUndefined()
  })
  it('resolves a rung whose rule is not seeded, and names the class the Licenses tab’s way', () => {
    const { goals, noRuleYet } = goalsFor([journeymanE], [{ trade: 'electrical', targetClass: 'master', targetAmount: 12000, openingAmount: 0, openingSource: '' }])
    expect(noRuleYet).toEqual([])
    expect(goals[0]?.requirement).toMatchObject({ from: 'journeyman', to: 'master', toName: 'Master electrician', need: 12000, board: 'TDLR', proofForm: 'Experience Verification Form' })
  })
  it('ignores a target at or below the rung held', () => {
    const { goals } = goalsFor([parseLicenseType('Journeyman Plumber #9')], [{ trade: 'plumbing', targetClass: 'journeyman', targetAmount: 8000, openingAmount: 0, openingSource: '' }])
    expect(goals).toEqual([])
  })
  it('adds the opening balance in the trade’s unit', () => {
    const targets: LicenseTarget[] = [
      { trade: 'plumbing', targetClass: null, targetAmount: null, openingAmount: 1920, openingSource: 'Old employer' },
      { trade: 'hvac', targetClass: null, targetAmount: null, openingAmount: 6, openingSource: 'Months at Cool Air' },
    ]
    expect(openingsFrom(targets)).toEqual([
      { trade: 'plumbing', amount: 1920, unit: 'hours', source: 'Old employer' },
      { trade: 'hvac', amount: 6, unit: 'months', source: 'Months at Cool Air' },
    ])
    const goal = goalsFor([apprentice], targets).goals[0]!
    expect(progressFor(goal, [], openingsFrom(targets), '2026-11-07')).toMatchObject({ done: 1920, opening: 1920, nextMark: { at: 2000, away: 80 } })
  })
  it('keeps AC in its capitals', () => {
    expect(requirementToward('hvac', 'certified_tech', 'contractor', 48).toName).toBe('AC contractor')
    expect(requirementToward('hvac', 'registered_tech', 'contractor', 40).windowMonths).toBe(72)
  })
})

describe('the window’s words', () => {
  it('offers the classes above the one held and the ladder’s rule as the default', () => {
    expect(targetOptions('plumbing', apprentice).map((o) => o.name)).toEqual(['Tradesman plumber-limited', 'Journeyman plumber', 'Master plumber'])
    expect(ladderOptionWords('plumbing', apprentice)).toBe('The ladder’s rule: journeyman plumber, 8,000 hours')
    expect(ladderOptionWords('electrical', journeymanE)).toBe('Pick the license')
    expect(seededAmountToward('electrical', 'journeyman')).toBe(8000)
    expect(seededAmountToward('electrical', 'master')).toBeNull()
  })
  it('names what stops the save, then says what saves', () => {
    const blank = draftFrom(null)
    expect(targetMissing('plumbing', blank)).toBeNull()
    expect(targetSummary('plumbing', blank)).toBe('Saves as the ladder’s rule, no hours before the clock.')
    expect(targetMissing('plumbing', { ...blank, targetClass: 'journeyman' })).toBe('Type the hours the board asks for.')
    expect(targetMissing('plumbing', { ...blank, openingAmount: '1200' })).toBe('Say where the hours before the clock came from.')
    expect(targetMissing('hvac', { ...blank, openingAmount: 'six' })).toBe('Type the months before the clock as a number.')
    const whole = { targetClass: 'journeyman' as const, targetAmount: '7,000', openingAmount: '1200', openingSource: 'Hours at Rio Plumbing' }
    expect(targetMissing('plumbing', whole)).toBeNull()
    expect(targetSummary('plumbing', whole)).toBe('Saves as working toward journeyman plumber, 7,000 hours, with 1,200 hours before the clock.')
    expect(targetFromDraft('plumbing', whole)).toEqual({ trade: 'plumbing', targetClass: 'journeyman', targetAmount: 7000, openingAmount: 1200, openingSource: 'Hours at Rio Plumbing' })
    expect(draftFrom(targetFromDraft('plumbing', whole))).toEqual({ targetClass: 'journeyman', targetAmount: '7000', openingAmount: '1200', openingSource: 'Hours at Rio Plumbing' })
  })
  it('writes the Licenses tab’s line a trade', () => {
    const lines = targetLines([apprentice, journeymanE], [{ trade: 'plumbing', targetClass: null, targetAmount: null, openingAmount: 1200, openingSource: 'Hours at Rio Plumbing' }])
    expect(lines).toEqual([
      { trade: 'plumbing', toward: 'Working toward journeyman plumber, 8,000 hours, the ladder’s rule', before: '1,200 hours before the clock: Hours at Rio Plumbing', button: 'Edit the goal' },
      { trade: 'electrical', toward: 'The next license has no rule seeded yet. Set the goal to name it and the board’s number.', before: 'No hours before the clock', button: 'Set the goal' },
    ])
  })
})
