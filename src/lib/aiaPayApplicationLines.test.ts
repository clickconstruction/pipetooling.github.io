import { describe, expect, it } from 'vitest'
import {
  carriedWorkByLineId,
  carryForwardLines,
  legacyFieldsFromLine,
  legacyLineFromFields,
  lineMath,
  linePercentDone,
  linesOfApplication,
  parsePayApplicationLines,
  printRowsOf,
  thisPeriodForPercent,
  type PayApplicationLine,
} from './aiaPayApplicationLines'

const line = (p: Partial<PayApplicationLine>): PayApplicationLine => ({ id: 'a', label: 'Top-out', scheduledValue: 28800, labor: null, stage: null, fromPrevious: 0, thisPeriod: 0, stored: 0, ...p })

describe('parsePayApplicationLines', () => {
  it('keeps what is a line and drops what is not', () => {
    const lines = parsePayApplicationLines([
      { id: 'a', label: 'Top-out', scheduledValue: '28,800', labor: 12960, stage: 'top_out', fromPrevious: 14400, thisPeriod: 11520.004, stored: 0 },
      { id: 'a', label: 'a second line with the same id' },
      { label: 'no id' },
      'nope',
      { id: 'b', label: 7, scheduledValue: 'x', labor: 99, stage: 'roof', fromPrevious: null, thisPeriod: undefined, stored: Infinity },
    ])
    expect(lines).toEqual([
      { id: 'a', label: 'Top-out', scheduledValue: 28800, labor: 12960, stage: 'top_out', fromPrevious: 14400, thisPeriod: 11520, stored: 0 },
      // Labor cannot exceed the line; an unknown stage is no stage.
      { id: 'b', label: '', scheduledValue: 0, labor: 0, stage: null, fromPrevious: 0, thisPeriod: 0, stored: 0 },
    ])
    expect(parsePayApplicationLines(null)).toEqual([])
    expect(parsePayApplicationLines({ id: 'a' })).toEqual([])
  })
})

describe('an application saved before lines', () => {
  const fields = { g702_n5_project: '1', g703_c13_description: 'Plumbing', g703_d13_scheduled_value: 48500, g703_e13_from_previous: 19400, g703_f13_this_period: '9,700', g703_g13_materials_stored: 1000 }

  it('reads as one line from its five form fields', () => {
    expect(legacyLineFromFields(fields)).toEqual({ id: 'line-1', label: 'Plumbing', scheduledValue: 48500, labor: null, stage: null, fromPrevious: 19400, thisPeriod: 9700, stored: 1000 })
    expect(linesOfApplication([], fields)).toHaveLength(1)
    expect(linesOfApplication(undefined, null)).toEqual([legacyLineFromFields({})])
  })

  it('prefers the saved lines once there are any', () => {
    expect(linesOfApplication([{ id: 'x', label: 'Trim', scheduledValue: 100 }], fields).map((l) => l.id)).toEqual(['x'])
  })

  it('writes a one-line application back into those fields', () => {
    expect(legacyFieldsFromLine(legacyLineFromFields(fields))).toEqual({
      g703_c13_description: 'Plumbing',
      g703_d13_scheduled_value: 48500,
      g703_e13_from_previous: 19400,
      g703_f13_this_period: 9700,
      g703_g13_materials_stored: 1000,
    })
    expect(legacyFieldsFromLine(line({ label: ' ', scheduledValue: 0 }))).toEqual({})
  })
})

describe('lineMath', () => {
  it('does the sheet\'s row: total, percent, balance, retainage', () => {
    expect(lineMath(line({ fromPrevious: 14400, thisPeriod: 11520, stored: 480 }), 0.1)).toMatchObject({ totalToDate: 26400, balanceToFinish: 2400, retainage: 2640 })
    expect(lineMath(line({ fromPrevious: 14400, thisPeriod: 11520 }), 0.1).pctComplete).toBeCloseTo(0.9, 9)
    expect(lineMath(line({ scheduledValue: 0 }), 0.1).pctComplete).toBeNull()
  })

  it('turns a percent done into this period\'s work and back', () => {
    const l = line({ fromPrevious: 14400 })
    expect(thisPeriodForPercent(l, 90)).toBe(11520)
    expect(linePercentDone({ ...l, thisPeriod: 11520 })).toBe(90)
    expect(linePercentDone(line({ scheduledValue: 0 }))).toBeNull()
    // A third of 100.00 is 33.33, and reads back as 33.33%.
    expect(linePercentDone({ scheduledValue: 100, fromPrevious: 0, thisPeriod: thisPeriodForPercent({ scheduledValue: 100, fromPrevious: 0 }, 33.33) })).toBe(33.33)
  })
})

describe('carrying lines forward', () => {
  it('makes work to date the previous work, empties this period, keeps stored material', () => {
    const next = carryForwardLines([line({ fromPrevious: 14400, thisPeriod: 11520, stored: 480, labor: 12960, stage: 'top_out' })])
    expect(next).toEqual([line({ fromPrevious: 25920, thisPeriod: 0, stored: 480, labor: 12960, stage: 'top_out' })])
    expect(carriedWorkByLineId([line({ id: 'a', fromPrevious: 1, thisPeriod: 2 }), line({ id: 'b' })])).toEqual(new Map([['a', 3], ['b', 0]]))
  })
})

describe('printRowsOf', () => {
  const l = line({ labor: 12960, fromPrevious: 14400, thisPeriod: 11520, stored: 480 })

  it('prints a line as one row unless the schedule splits labor and material', () => {
    expect(printRowsOf([l], false)).toEqual([{ id: 'a', lineId: 'a', part: 'whole', label: 'Top-out', scheduledValue: 28800, fromPrevious: 14400, thisPeriod: 11520, stored: 480 }])
    // A line with no split stays whole even when the switch is on.
    expect(printRowsOf([line({ labor: null })], true).map((r) => r.part)).toEqual(['whole'])
  })

  it('splits into a labor row and a material row that add back to the line', () => {
    const [labor, material] = printRowsOf([l], true)
    expect(labor).toMatchObject({ part: 'labor', label: 'Top-out, labor', scheduledValue: 12960, fromPrevious: 6480, thisPeriod: 5184, stored: 0 })
    expect(material).toMatchObject({ part: 'material', label: 'Top-out, material', scheduledValue: 15840, fromPrevious: 7920, thisPeriod: 6336, stored: 480 })
    expect(labor!.scheduledValue + material!.scheduledValue).toBe(l.scheduledValue)
    expect(labor!.thisPeriod + material!.thisPeriod).toBe(l.thisPeriod)
  })

  it('keeps the cents together on an odd split', () => {
    const odd = line({ scheduledValue: 100, labor: 33.33, thisPeriod: 10.01 })
    const [a, b] = printRowsOf([odd], true)
    expect(Math.round((a!.thisPeriod + b!.thisPeriod) * 100) / 100).toBe(10.01)
  })
})
