import { describe, expect, it } from 'vitest'
import { buildAiaPreview } from './aiaG702G703Preview'
import type { AiaFieldValues } from './aiaG702G703Template'
import {
  carryForwardPayApplication,
  nextApplicationNumber,
  parseAiaDate,
  parseApplicationNumber,
  payApplicationLabel,
  payApplicationWriteFromForm,
  previousPayApplication,
  savedPayApplicationFromRow,
  sortPayApplications,
  type PayApplicationRow,
  type SavedPayApplication,
} from './aiaPayApplications'

/** Application 1 of a 48,500 contract at 10%: 19,400 of work, a 2,000 change order approved that month. */
const APP_1: AiaFieldValues = {
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
  g703_c13_description: 'Plumbing',
  g703_d13_scheduled_value: 50500,
  g703_f13_this_period: 19400,
  g703_g13_materials_stored: 1000,
}

function saved(values: AiaFieldValues, id = 'a1'): SavedPayApplication {
  const w = payApplicationWriteFromForm('job-1', values)
  if (!w.ok) throw new Error(w.reason)
  return savedPayApplicationFromRow({ id, updated_at: '2026-10-02T15:00:00Z', ...w.row } as PayApplicationRow)
}

describe('payApplicationWriteFromForm', () => {
  it('writes the form, its dates and the sheet\'s totals over it', () => {
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
    })
    expect(w.row.fields).toEqual(APP_1)
  })

  it('keeps a pasted link beside the application, and refuses one that is not a web address', () => {
    const link = '  https://docs.google.com/spreadsheets/d/abc123/edit  '
    const w = payApplicationWriteFromForm('job-1', APP_1, link)
    expect(w.ok && w.row.files).toEqual([{ kind: 'link', url: 'https://docs.google.com/spreadsheets/d/abc123/edit' }])
    expect(payApplicationWriteFromForm('job-1', APP_1).ok && (payApplicationWriteFromForm('job-1', APP_1) as { row: { files: unknown } }).row.files).toEqual([])
    const bad = payApplicationWriteFromForm('job-1', APP_1, 'my drive folder')
    expect(bad.ok).toBe(false)
    expect(!bad.ok && bad.reason).toMatch(/not a web address/)
    expect(payApplicationWriteFromForm('job-1', APP_1, 'javascript:alert(1)').ok).toBe(false)
  })

  it('will not save without a whole application number', () => {
    for (const bad of ['', 'Water Sample Test', '0', '1.5', '-2', '12345']) {
      const w = payApplicationWriteFromForm('job-1', { ...APP_1, g702_n5_project: bad })
      expect(w.ok, bad).toBe(false)
    }
  })

  it('keeps a period that is not a date as text only', () => {
    const w = payApplicationWriteFromForm('job-1', { ...APP_1, g702_n6_period_to: 'end of September' })
    expect(w.ok && w.row.period_to).toBeNull()
    expect(w.ok && (w.row.fields as AiaFieldValues).g702_n6_period_to).toBe('end of September')
  })
})

describe('savedPayApplicationFromRow', () => {
  it('reads numerics the database sends as text, and only the form\'s own keys', () => {
    const app = savedPayApplicationFromRow({
      id: 'x',
      job_id: 'job-1',
      application_number: 2,
      period_to: null,
      application_date: null,
      fields: { g702_n5_project: '2', g703_f13_this_period: 9700, not_a_field: 'x', g702_d6_owner_name: { nested: true } },
      contract_sum_to_date: '48500.00',
      total_completed_and_stored: '29100.00',
      retainage_pct: '10.000',
      retainage_held: '2910.00',
      total_earned_less_retainage: '26190.00',
      current_payment_due: '8730.00',
      updated_at: null,
    })
    expect(app.fields).toEqual({ g702_n5_project: '2', g703_f13_this_period: 9700 })
    expect(app.totalEarnedLessRetainage).toBe(26190)
    expect(app.retainagePct).toBe(10)
    expect(app.link).toBe('')
  })

  it('reads the first web link kept beside the row, and nothing else', () => {
    const row = { id: 'x', job_id: 'j', application_number: 1, period_to: null, application_date: null, fields: {}, contract_sum_to_date: 0, total_completed_and_stored: 0, retainage_pct: 0, retainage_held: 0, total_earned_less_retainage: 0, current_payment_due: 0, updated_at: null }
    expect(savedPayApplicationFromRow({ ...row, files: [{ kind: 'link', url: 'javascript:alert(1)' }, { kind: 'link', url: 'https://drive.google.com/file/d/xyz/view' }] }).link).toBe('https://drive.google.com/file/d/xyz/view')
    expect(savedPayApplicationFromRow({ ...row, files: 'nope' }).link).toBe('')
    expect(savedPayApplicationFromRow({ ...row, files: [] }).link).toBe('')
  })

  it('reads fields that are not an object as an empty form', () => {
    const row = { id: 'x', job_id: 'j', application_number: 1, period_to: null, application_date: null, contract_sum_to_date: 0, total_completed_and_stored: 0, retainage_pct: 0, retainage_held: 0, total_earned_less_retainage: 0, current_payment_due: 0, updated_at: null }
    expect(savedPayApplicationFromRow({ ...row, fields: null }).fields).toEqual({})
    expect(savedPayApplicationFromRow({ ...row, fields: ['a'] }).fields).toEqual({})
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
    g703_d13_scheduled_value: 48500,
    g703_f13_this_period: 29100,
  }

  it('starts application 2 from application 1', () => {
    const next = carryForwardPayApplication(saved(APP_1), jobToday)
    expect(next.g702_n5_project).toBe('2')
    expect(next.g702_n6_period_to).toBe('')
    expect(next.g703_k3_application_date).toBe('11/03/2026')
    // Who and what carry as they were sent, not as the job reads today.
    expect(next.g702_h6_project_name).toBe('Cedar Ridge Clubhouse')
    expect(next.g702_n9_contract_date).toBe('07/14/2026')
    expect(next.g703_d13_scheduled_value).toBe(50500)
    expect(next.g703_c13_description).toBe('Plumbing')
    // The work becomes previous work; the stored material is still on site; line 6 becomes line 7.
    expect(next.g703_e13_from_previous).toBe(19400)
    expect(next.g703_g13_materials_stored).toBe(1000)
    expect(next.g702_h40_less_previous_certificates).toBe(18360)
    // Last month's change order joins the previous months.
    expect(next.g702_f49_previous_month_change_order_additions).toBe(2000)
    expect(next.g702_f50_this_month_change_order_additions).toBeUndefined()
    // 29,100 created today, less 19,400 claimed and 1,000 stored.
    expect(next.g703_f13_this_period).toBe(8700)
  })

  it('asks only for the new work once it is filled', () => {
    const next = carryForwardPayApplication(saved(APP_1), jobToday)
    const { math } = buildAiaPreview({ ...next, g702_n6_period_to: '10/31/2026' })
    expect(math.contractSumToDate).toBe(50500)
    expect(math.totalCompletedAndStored).toBe(29100)
    expect(math.totalEarnedLessRetainage).toBe(26190)
    expect(math.lessPreviousCertificates).toBe(18360)
    expect(math.currentPaymentDue).toBe(7830)
  })

  it('chains: application 3 takes 1 and 2 together', () => {
    const app2Values = { ...carryForwardPayApplication(saved(APP_1), jobToday), g702_n6_period_to: '10/31/2026', g702_h50_this_month_change_order_deductions: 500 }
    const app3 = carryForwardPayApplication(saved(app2Values, 'a2'), { ...jobToday, g703_f13_this_period: 29100 })
    expect(app3.g702_n5_project).toBe('3')
    expect(app3.g703_e13_from_previous).toBe(28100)
    expect(app3.g702_h40_less_previous_certificates).toBe(26190)
    expect(app3.g702_f49_previous_month_change_order_additions).toBe(2000)
    expect(app3.g702_h49_previous_month_change_order_deductions).toBe(500)
    // Nothing new was created on the job, so no work is offered.
    expect(app3.g703_f13_this_period).toBeUndefined()
  })

  it('leaves this period empty when the job has no value created', () => {
    const next = carryForwardPayApplication(saved(APP_1), { ...jobToday, g703_f13_this_period: undefined })
    expect(next.g703_f13_this_period).toBeUndefined()
  })
})

describe('the list', () => {
  const a = saved(APP_1, 'a1')
  const c = saved({ ...APP_1, g702_n5_project: '3' }, 'a3')

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
    expect(payApplicationLabel(saved({ ...APP_1, g702_n6_period_to: '' }))).toBe('1 · $18,360.00 due')
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
