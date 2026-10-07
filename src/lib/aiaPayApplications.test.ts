import { describe, expect, it } from 'vitest'
import { buildAiaPreview } from './aiaG702G703Preview'
import type { AiaFieldValues } from './aiaG702G703Template'
import type { PayApplicationLine } from './aiaPayApplicationLines'
import {
  carriedAmountsFrom,
  carryForwardPayApplication,
  carryMismatch,
  nextApplicationNumber,
  parseAiaDate,
  parseApplicationNumber,
  PAY_APPLICATION_NAME_MAX,
  cleanPayApplicationName,
  payApplicationLabel,
  payApplicationWriteFromForm,
  previousPayApplication,
  retainageDropOffer,
  savedPayApplicationFromRow,
  sortPayApplications,
  withCarriedAmounts,
  type PayApplicationForm,
  type PayApplicationRow,
  type SavedPayApplication,
} from './aiaPayApplications'

const line = (p: Partial<PayApplicationLine>): PayApplicationLine => ({ id: 'line-1', label: 'Plumbing', scheduledValue: 0, labor: null, stage: null, fromPrevious: 0, thisPeriod: 0, stored: 0, ...p })
/** A saved application as the form the window holds for it. */
const asForm = (app: SavedPayApplication): PayApplicationForm => ({ values: app.fields, lines: app.lines, splitLaborMaterial: app.splitLaborMaterial })
const formOf = (values: AiaFieldValues, lines: PayApplicationLine[], splitLaborMaterial = false): PayApplicationForm => ({ values, lines, splitLaborMaterial })

/** Application 1 of a 48,500 contract at 10%: 19,400 of work and 1,000 stored on its one line, a 2,000 change order approved that month. */
const APP_1_VALUES: AiaFieldValues = {
  g702_n5_project: '1',
  g702_n6_period_to: '09/30/2026',
  g702_n7_project_no: '1023',
  g702_n9_contract_date: '07/14/2026',
  g702_h6_project_name: 'Cedar Ridge Clubhouse',
  g702_d6_owner_name: 'Sample Builders, Inc.',
  g702_h18_original_contract_sum: 48500,
  g702_f50_this_month_change_order_additions: 2000,
  g702_c28_retainage_percent: 10,
  g703_k3_application_date: '10/02/2026',
}
const APP_1 = formOf(APP_1_VALUES, [line({ scheduledValue: 50500, thisPeriod: 19400, stored: 1000 })])

function saved(form: PayApplicationForm, id = 'a1', link = '', reason?: string): SavedPayApplication {
  const w = payApplicationWriteFromForm('job-1', form, link, reason)
  if (!w.ok) throw new Error(w.reason)
  return savedPayApplicationFromRow({ id, updated_at: '2026-10-02T15:00:00Z', ...w.row } as PayApplicationRow)
}

describe('payApplicationWriteFromForm', () => {
  it('writes the form, its lines, its dates and the sheet\'s totals over them', () => {
    const w = payApplicationWriteFromForm('job-1', APP_1)
    expect(w.ok).toBe(true)
    if (!w.ok) return
    expect(w.row).toMatchObject({
      job_id: 'job-1',
      application_number: 1,
      period_to: '2026-09-30',
      application_date: '2026-10-02',
      contract_sum_to_date: 50500,
      total_completed_and_stored: 20400,
      retainage_pct: 10,
      retainage_held: 2040,
      total_earned_less_retainage: 18360,
      current_payment_due: 18360,
      split_labor_material: false,
    })
    expect(w.row.lines).toEqual(APP_1.lines)
    // One line also goes into the form fields it used to live in, for a client from before lines.
    expect(w.row.fields).toEqual({ ...APP_1_VALUES, g703_c13_description: 'Plumbing', g703_d13_scheduled_value: 50500, g703_f13_this_period: 19400, g703_g13_materials_stored: 1000 })
  })

  it('keeps several lines in the list only, with the split it prints by', () => {
    const two = formOf(APP_1_VALUES, [line({ id: 'a', scheduledValue: 30000, labor: 12000, thisPeriod: 15000 }), line({ id: 'b', label: 'Trim', scheduledValue: 20500, labor: 9000 })], true)
    const w = payApplicationWriteFromForm('job-1', two)
    expect(w.ok && w.row.fields).toEqual(APP_1_VALUES)
    expect(w.ok && w.row.lines).toHaveLength(2)
    expect(w.ok && w.row.split_labor_material).toBe(true)
    expect(w.ok && w.row.total_completed_and_stored).toBe(15000)
  })

  it('keeps a pasted link beside the application, and refuses one that is not a web address', () => {
    const w = payApplicationWriteFromForm('job-1', APP_1, '  https://docs.google.com/spreadsheets/d/abc123/edit  ')
    expect(w.ok && w.row.files).toEqual([{ kind: 'link', url: 'https://docs.google.com/spreadsheets/d/abc123/edit' }])
    const none = payApplicationWriteFromForm('job-1', APP_1)
    expect(none.ok && none.row.files).toEqual([])
    const bad = payApplicationWriteFromForm('job-1', APP_1, 'my drive folder')
    expect(bad.ok).toBe(false)
    expect(!bad.ok && bad.reason).toMatch(/not a web address/)
    expect(payApplicationWriteFromForm('job-1', APP_1, 'javascript:alert(1)').ok).toBe(false)
  })

  it('will not save without a whole application number', () => {
    for (const bad of ['', 'Water Sample Test', '0', '1.5', '-2', '12345']) {
      const w = payApplicationWriteFromForm('job-1', formOf({ ...APP_1_VALUES, g702_n5_project: bad }, APP_1.lines))
      expect(w.ok, bad).toBe(false)
    }
  })

  it('keeps a period that is not a date as text only', () => {
    const w = payApplicationWriteFromForm('job-1', formOf({ ...APP_1_VALUES, g702_n6_period_to: 'end of September' }, APP_1.lines))
    expect(w.ok && w.row.period_to).toBeNull()
    expect(w.ok && (w.row.fields as AiaFieldValues).g702_n6_period_to).toBe('end of September')
  })

  it('writes the reason only when it is passed, and reads it back', () => {
    const without = payApplicationWriteFromForm('job-1', APP_1)
    expect(without.ok && 'carry_reason' in without.row).toBe(false)
    const withReason = payApplicationWriteFromForm('job-1', APP_1, '', '  It went out this way on Oct 2.  ')
    expect(withReason.ok && withReason.row.carry_reason).toBe('It went out this way on Oct 2.')
    const cleared = payApplicationWriteFromForm('job-1', APP_1, '', '')
    expect(cleared.ok && cleared.row.carry_reason).toBe('')
    expect(saved(APP_1).carryReason).toBe('')
    expect(saved(APP_1, 'x', '', 'It went out this way.').carryReason).toBe('It went out this way.')
  })
})

describe('savedPayApplicationFromRow', () => {
  const base = { id: 'x', job_id: 'job-1', application_number: 2, period_to: null, application_date: null, contract_sum_to_date: '48500.00', total_completed_and_stored: '29100.00', retainage_pct: '10.000', retainage_held: '2910.00', total_earned_less_retainage: '26190.00', current_payment_due: '8730.00', updated_at: null }

  it('reads numerics the database sends as text, and only the form\'s own keys', () => {
    const app = savedPayApplicationFromRow({ ...base, fields: { g702_n5_project: '2', g702_c28_retainage_percent: 10, not_a_field: 'x', g702_d6_owner_name: { nested: true } } })
    expect(app.fields).toEqual({ g702_n5_project: '2', g702_c28_retainage_percent: 10 })
    expect(app.totalEarnedLessRetainage).toBe(26190)
    expect(app.retainagePct).toBe(10)
    expect(app.link).toBe('')
    expect(app.splitLaborMaterial).toBe(false)
  })

  it('reads an application saved before lines as its one line', () => {
    const app = savedPayApplicationFromRow({ ...base, fields: { g702_n5_project: '2', g703_c13_description: 'Plumbing', g703_d13_scheduled_value: 48500, g703_e13_from_previous: 19400, g703_f13_this_period: 9700 } })
    expect(app.lines).toEqual([line({ scheduledValue: 48500, fromPrevious: 19400, thisPeriod: 9700 })])
    // The line's old keys are not form fields any more.
    expect(app.fields).toEqual({ g702_n5_project: '2' })
  })

  it('reads the saved lines and the split when the row has them', () => {
    const app = savedPayApplicationFromRow({ ...base, fields: {}, lines: [{ id: 'a', label: 'Top-out', scheduledValue: 28800, labor: 12960, fromPrevious: 14400, thisPeriod: 11520 }], split_labor_material: true })
    expect(app.lines).toEqual([line({ id: 'a', label: 'Top-out', scheduledValue: 28800, labor: 12960, fromPrevious: 14400, thisPeriod: 11520 })])
    expect(app.splitLaborMaterial).toBe(true)
  })

  it('reads fields that are not an object as an empty form with one empty line', () => {
    expect(savedPayApplicationFromRow({ ...base, fields: null }).fields).toEqual({})
    expect(savedPayApplicationFromRow({ ...base, fields: ['a'] }).lines).toEqual([line({ label: '' })])
  })

  it('reads the first web link kept beside the row, and nothing else', () => {
    expect(savedPayApplicationFromRow({ ...base, fields: {}, files: [{ kind: 'link', url: 'javascript:alert(1)' }, { kind: 'link', url: 'https://drive.google.com/file/d/xyz/view' }] }).link).toBe('https://drive.google.com/file/d/xyz/view')
    expect(savedPayApplicationFromRow({ ...base, fields: {}, files: 'nope' }).link).toBe('')
  })
})

describe('carryForwardPayApplication', () => {
  // The job today: 60% of 48,500 created, today's date, the job's own header.
  const jobToday: AiaFieldValues = {
    g702_n5_project: '',
    g702_n7_project_no: '1023',
    g702_h6_project_name: 'Cedar Ridge Clubhouse (renamed on the job)',
    g702_d6_owner_name: 'Sample Builders, Inc.',
    g702_h18_original_contract_sum: 48500,
    g702_c28_retainage_percent: 10,
    g703_k3_application_date: '11/03/2026',
  }

  it('starts application 2 from application 1', () => {
    const next = carryForwardPayApplication(saved(APP_1), jobToday, 29100)
    expect(next.values.g702_n5_project).toBe('2')
    expect(next.values.g702_n6_period_to).toBe('')
    expect(next.values.g703_k3_application_date).toBe('11/03/2026')
    // Who and what carry as they were sent, not as the job reads today.
    expect(next.values.g702_h6_project_name).toBe('Cedar Ridge Clubhouse')
    expect(next.values.g702_n9_contract_date).toBe('07/14/2026')
    // Line 6 becomes line 7; last month's change order joins the previous months.
    expect(next.values.g702_h40_less_previous_certificates).toBe(18360)
    expect(next.values.g702_f49_previous_month_change_order_additions).toBe(2000)
    expect(next.values.g702_f50_this_month_change_order_additions).toBeUndefined()
    // The line keeps its name and value; its work becomes previous work; the stored material is still on site.
    // 29,100 created today, less 19,400 claimed and 1,000 stored, is offered as this period.
    expect(next.lines).toEqual([line({ scheduledValue: 50500, fromPrevious: 19400, thisPeriod: 8700, stored: 1000 })])
    expect(next.splitLaborMaterial).toBe(false)
  })

  it('asks only for the new work once it is filled', () => {
    const next = carryForwardPayApplication(saved(APP_1), jobToday, 29100)
    const { math } = buildAiaPreview({ ...next.values, g702_n6_period_to: '10/31/2026' }, next.lines)
    expect(math.contractSumToDate).toBe(50500)
    expect(math.totalCompletedAndStored).toBe(29100)
    expect(math.totalEarnedLessRetainage).toBe(26190)
    expect(math.lessPreviousCertificates).toBe(18360)
    expect(math.currentPaymentDue).toBe(7830)
  })

  it('chains: application 3 takes 1 and 2 together', () => {
    const two = carryForwardPayApplication(saved(APP_1), jobToday, 29100)
    const twoSaved = saved(formOf({ ...two.values, g702_n6_period_to: '10/31/2026', g702_h50_this_month_change_order_deductions: 500 }, two.lines), 'a2')
    const three = carryForwardPayApplication(twoSaved, jobToday, 29100)
    expect(three.values.g702_n5_project).toBe('3')
    expect(three.values.g702_h40_less_previous_certificates).toBe(26190)
    expect(three.values.g702_f49_previous_month_change_order_additions).toBe(2000)
    expect(three.values.g702_h49_previous_month_change_order_deductions).toBe(500)
    // Nothing new was created on the job, so no work is offered.
    expect(three.lines).toEqual([line({ scheduledValue: 50500, fromPrevious: 28100, thisPeriod: 0, stored: 1000 })])
  })

  it('carries every line of a multi-line application, with its split, and offers no work', () => {
    const lines = [line({ id: 'a', label: 'Top-out', scheduledValue: 28800, labor: 12960, fromPrevious: 14400, thisPeriod: 11520 }), line({ id: 'b', label: 'Trim', scheduledValue: 24000, labor: 10800, stored: 500 })]
    const next = carryForwardPayApplication(saved(formOf(APP_1_VALUES, lines, true)), jobToday, 99999)
    expect(next.lines).toEqual([
      line({ id: 'a', label: 'Top-out', scheduledValue: 28800, labor: 12960, fromPrevious: 25920, thisPeriod: 0 }),
      line({ id: 'b', label: 'Trim', scheduledValue: 24000, labor: 10800, stored: 500 }),
    ])
    expect(next.splitLaborMaterial).toBe(true)
  })

  it('leaves this period empty when the job has no value created', () => {
    expect(carryForwardPayApplication(saved(APP_1), jobToday).lines[0]!.thisPeriod).toBe(0)
  })
})

describe('carryMismatch', () => {
  const jobToday: AiaFieldValues = { g703_k3_application_date: '11/03/2026' }
  const one = saved(APP_1, 'a1')
  const twoForm = carryForwardPayApplication(one, jobToday, 29100)
  const two = saved(formOf({ ...twoForm.values, g702_n6_period_to: '10/31/2026' }, twoForm.lines), 'a2')

  it('says nothing while an application still matches the one before it', () => {
    expect(carryMismatch(asForm(two), 2, [one, two])).toBeNull()
    // The first application has nothing before it.
    expect(carryMismatch(asForm(one), 1, [one, two])).toBeNull()
    expect(carryMismatch(asForm(two), null, [one, two])).toBeNull()
  })

  it('names what differs after the earlier one changes: the line, then the certificates', () => {
    // Application 1 is reopened: 21,000 of work, not 19,400.
    const oneChanged = saved(formOf(APP_1_VALUES, [line({ scheduledValue: 50500, thisPeriod: 21000, stored: 1000 })]), 'a1')
    const m = carryMismatch(asForm(two), 2, [oneChanged, two])
    expect(m?.previousNumber).toBe(1)
    expect(m?.differences).toEqual([
      { key: 'line:line-1', label: 'Plumbing, work from previous application', here: 19400, fromPrevious: 21000 },
      // (21,000 + 1,000 stored) less 10%.
      { key: 'g702_h40_less_previous_certificates', label: 'LESS PREVIOUS CERTIFICATES FOR PAYMENT', here: 18360, fromPrevious: 19800 },
    ])
    // Taking the new amounts ends the mismatch and touches nothing else.
    const taken = withCarriedAmounts(asForm(two), oneChanged)
    expect(carryMismatch(taken, 2, [oneChanged, two])).toBeNull()
    expect(taken.lines[0]!.thisPeriod).toBe(two.lines[0]!.thisPeriod)
    expect(taken.values.g702_n6_period_to).toBe('10/31/2026')
  })

  it('sees a change order that moved', () => {
    const oneChanged = saved(formOf({ ...APP_1_VALUES, g702_f50_this_month_change_order_additions: 2500 }, APP_1.lines), 'a1')
    expect(carryMismatch(asForm(two), 2, [oneChanged, two])?.differences.map((d) => d.key)).toEqual(['g702_f49_previous_month_change_order_additions'])
    expect(carriedAmountsFrom(oneChanged).g702_f49_previous_month_change_order_additions).toBe(2500)
  })

  it('checks each line by its id, a line the earlier one lacks, and a line this one lacks', () => {
    const first = saved(formOf(APP_1_VALUES, [line({ id: 'a', label: 'Top-out', scheduledValue: 28800, thisPeriod: 14400 }), line({ id: 'b', label: 'Trim', scheduledValue: 24000, thisPeriod: 2400 })]), 'a1')
    const secondLines = [
      line({ id: 'a', label: 'Top-out', scheduledValue: 28800, fromPrevious: 14400 }),
      // Line b was dropped; line c claims previous work the earlier application never had.
      line({ id: 'c', label: 'Equipment', scheduledValue: 9600, fromPrevious: 500 }),
    ]
    const values = { ...APP_1_VALUES, g702_n5_project: '2', g702_h40_less_previous_certificates: 15120, g702_f49_previous_month_change_order_additions: 2000, g702_f50_this_month_change_order_additions: undefined }
    const m = carryMismatch({ values, lines: secondLines }, 2, [first])
    expect(m?.differences).toEqual([
      { key: 'line:b', label: 'Trim, work from previous application', here: 0, fromPrevious: 2400 },
      { key: 'line:c', label: 'Equipment, work from previous application', here: 500, fromPrevious: 0 },
    ])
    expect(withCarriedAmounts({ values, lines: secondLines }, first).lines.map((l) => l.fromPrevious)).toEqual([14400, 0])
  })
})

describe('retainageDropOffer', () => {
  // Application 2 of a 48,500 contract: 19,400 before, 9,700 now = 60% complete; 17,460 certified before.
  const values: AiaFieldValues = { g702_h18_original_contract_sum: 48500, g702_c28_retainage_percent: 10, g702_h40_less_previous_certificates: 17460 }
  const sixty = (p: Partial<PayApplicationLine> = {}, v: AiaFieldValues = {}) => formOf({ ...values, ...v }, [line({ scheduledValue: 48500, fromPrevious: 19400, thisPeriod: 9700, ...p })])

  it('offers 5% over everything to date once the job is past halfway', () => {
    const offer = retainageDropOffer(sixty())
    expect(offer).not.toBeNull()
    expect(offer!.pctComplete).toBeCloseTo(0.6, 9)
    // 29,100 to date: 2,910 held at 10%, 1,455 at 5%; the 1,455 let go is due.
    expect(offer).toMatchObject({ heldNow: 2910, heldAtReduced: 1455, moreDue: 1455 })
  })

  it('makes no offer at or under halfway, at 5% or less, or with no scheduled value', () => {
    expect(retainageDropOffer(sixty({ thisPeriod: 4850 }))).toBeNull() // exactly 50%
    expect(retainageDropOffer(sixty({ fromPrevious: 0 }))).toBeNull() // 20%
    expect(retainageDropOffer(sixty({}, { g702_c28_retainage_percent: 5 }))).toBeNull()
    expect(retainageDropOffer(sixty({}, { g702_c28_retainage_percent: 0 }))).toBeNull()
    expect(retainageDropOffer(sixty({ scheduledValue: 0 }))).toBeNull()
  })

  it('reads the whole job across its lines', () => {
    const form = formOf(values, [line({ id: 'a', scheduledValue: 24000, fromPrevious: 24000 }), line({ id: 'b', scheduledValue: 24500, thisPeriod: 2000 })])
    // 26,000 of 48,500 is 54%.
    expect(retainageDropOffer(form)?.pctComplete).toBeCloseTo(26000 / 48500, 9)
  })
})

describe('the list', () => {
  const a = saved(APP_1, 'a1')
  const c = saved(formOf({ ...APP_1_VALUES, g702_n5_project: '3' }, APP_1.lines), 'a3')

  it('sorts by number, finds the one before, and counts on', () => {
    expect(sortPayApplications([c, a]).map((x) => x.applicationNumber)).toEqual([1, 3])
    expect(nextApplicationNumber([c, a])).toBe(4)
    expect(nextApplicationNumber([])).toBe(1)
    expect(previousPayApplication([c, a], 3)?.id).toBe('a1')
    expect(previousPayApplication([c, a], 2)?.id).toBe('a1')
    expect(previousPayApplication([c, a], 1)).toBeNull()
  })

  it('labels a saved application with its number, period and amount due', () => {
    expect(payApplicationLabel(a)).toBe('1 · 09/30/2026 · $18,360.00 due')
    expect(payApplicationLabel(saved(formOf({ ...APP_1_VALUES, g702_n6_period_to: '' }, APP_1.lines)))).toBe('1 · $18,360.00 due')
  })

  it('puts the office\'s name after the number when the application has one', () => {
    expect(payApplicationLabel({ ...a, name: 'Sent to the GC' })).toBe('1 · Sent to the GC · 09/30/2026 · $18,360.00 due')
  })
})

describe('an application\'s name', () => {
  it('is kept on one line, trimmed, and cut at the table\'s length', () => {
    expect(cleanPayApplicationName('  Sent to\n the   GC ')).toBe('Sent to the GC')
    expect(cleanPayApplicationName(null)).toBe('')
    expect(cleanPayApplicationName('x'.repeat(200))).toHaveLength(PAY_APPLICATION_NAME_MAX)
  })

  it('is written only when the save has one to write or to clear, and read back from the row', () => {
    const unnamed = payApplicationWriteFromForm('job-1', APP_1)
    expect(unnamed.ok && 'name' in unnamed.row).toBe(false)
    const named = payApplicationWriteFromForm('job-1', APP_1, '', undefined, '  Revised after  the walk ')
    expect(named.ok && named.row.name).toBe('Revised after the walk')
    const cleared = payApplicationWriteFromForm('job-1', APP_1, '', undefined, '')
    expect(cleared.ok && cleared.row.name).toBe('')
    if (!named.ok) throw new Error(named.reason)
    expect(savedPayApplicationFromRow({ id: 'a1', updated_at: null, ...named.row } as PayApplicationRow).name).toBe('Revised after the walk')
    // A row read from a database without the column has no name.
    expect(saved(APP_1).name).toBe('')
  })
})

describe('the parsers', () => {
  it('reads an application number only as a whole number from 1 to 9999', () => {
    expect(parseApplicationNumber(' 3 ')).toBe(3)
    expect(parseApplicationNumber(12)).toBe(12)
    expect(parseApplicationNumber('0')).toBeNull()
    expect(parseApplicationNumber('3a')).toBeNull()
    expect(parseApplicationNumber(null)).toBeNull()
  })

  it('reads the dates the form prints, and nothing that is not a real day', () => {
    expect(parseAiaDate('10/31/2026')).toBe('2026-10-31')
    expect(parseAiaDate('1/5/26')).toBe('2026-01-05')
    expect(parseAiaDate('2026-10-31')).toBe('2026-10-31')
    expect(parseAiaDate('02/30/2026')).toBeNull()
    expect(parseAiaDate('March 31st 2026')).toBeNull()
    expect(parseAiaDate('')).toBeNull()
  })
})
