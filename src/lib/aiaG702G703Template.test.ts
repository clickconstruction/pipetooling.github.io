import { describe, expect, it } from 'vitest'
import { AIA_FIELD_DEFS, buildAiaPrefillFromJob, type AiaFieldKey } from './aiaG702G703Template'
import type { JobWithDetails } from '../types/jobWithDetails'
import type { LimitedJobDetailSnapshot } from '../types/limitedJobDetailSnapshot'

const minimalLimitedJob = (): LimitedJobDetailSnapshot => ({
  id: 'job-1',
  hcp_number: '501',
  job_name: 'Test Plaza',
  job_address: '100 Main St, Austin, TX 78701',
  google_drive_link: null,
  job_pictures_link: null,
  job_plans_link: null,
  revenue: 2500.5,
  project_id: null,
  customer_name: 'ACME GC',
  customer_email: null,
  customer_phone: null,
  last_bill_date: null,
  last_work_date: null,
  status: 'ready_to_bill',
  service_type_name: null,
})

describe('buildAiaPrefillFromJob', () => {
  it('maps job name, customer, address, HCP, and revenue', () => {
    const pre = buildAiaPrefillFromJob(minimalLimitedJob(), {
      companyName: 'Click Plumbing',
      addressText: '5501 Balcones Dr\nAustin TX 78731',
      phone: '',
      email: '',
      tagline: '',
      licenseLine: 'RMP 999',
    })
    expect(pre.g702_n5_project).toBe('Test Plaza')
    expect(pre.g703_k2_project).toBe('Test Plaza')
    expect(pre.g702_d6_owner_name).toBe('ACME GC')
    expect(pre.g702_d7_owner_address).toContain('Main')
    expect(pre.g702_n7_project_no).toBe('501')
    expect(pre.g703_k5_architect_project_no).toBe('501')
    expect(pre.g702_h18_original_contract_sum).toBe(2500.5)
    expect(pre.g703_d13_scheduled_value).toBe(2500.5)
    expect(pre.g703_f13_this_period).toBeUndefined()
    expect(pre.g703_g13_materials_stored).toBeUndefined()
    expect(pre.g702_f49_previous_month_change_order_additions).toBeUndefined()
    expect(pre.g702_h49_previous_month_change_order_deductions).toBeUndefined()
    expect(pre.g702_f50_this_month_change_order_additions).toBeUndefined()
    expect(pre.g702_h50_this_month_change_order_deductions).toBeUndefined()
    expect(pre.g702_c28_retainage_percent).toBeUndefined()
    expect(pre.g702_c31_retainage_material_percent).toBeUndefined()
    expect(pre.g702_d10_contractor_name).toBe('Click Plumbing')
    expect(pre.g702_d12_contractor_license).toBe('RMP 999')
  })

  it('prefills WORK COMPLETED THIS PERIOD from Value Created when pct_complete is set', () => {
    const job = {
      ...minimalLimitedJob(),
      revenue: 10000,
      pct_complete: 40,
    } as unknown as JobWithDetails
    const pre = buildAiaPrefillFromJob(job, null)
    expect(pre.g703_f13_this_period).toBe(4000)
  })

  it('defines Previous Month Change Order Deductions on G702 H49', () => {
    const def = AIA_FIELD_DEFS.find((d) => d.key === 'g702_h49_previous_month_change_order_deductions')
    expect(def).toMatchObject({
      label: 'Previous Month Change Order Deductions',
      kind: 'number',
      cellRef: 'H49',
    })
  })

  it('defines This Month Change Order Additions on G702 F50', () => {
    const def = AIA_FIELD_DEFS.find((d) => d.key === 'g702_f50_this_month_change_order_additions')
    expect(def).toMatchObject({
      label: 'This Month Change Order Additions',
      kind: 'number',
      cellRef: 'F50',
    })
  })

  it('defines This Month Change Order Deductions on G702 H50', () => {
    const def = AIA_FIELD_DEFS.find((d) => d.key === 'g702_h50_this_month_change_order_deductions')
    expect(def).toMatchObject({
      label: 'This Month Change Order Deductions',
      kind: 'number',
      cellRef: 'H50',
    })
  })

  it('defines Retainage % on G702 C28 (human percent 0–100 written as Excel fraction)', () => {
    const def = AIA_FIELD_DEFS.find((d) => d.key === 'g702_c28_retainage_percent')
    expect(def).toMatchObject({
      label: 'Retainage %',
      kind: 'percent',
      cellRef: 'C28',
    })
  })

  it('defines Retainage of Material % on G702 C31', () => {
    const def = AIA_FIELD_DEFS.find((d) => d.key === 'g702_c31_retainage_material_percent')
    expect(def).toMatchObject({
      label: 'Retainage of Material %',
      kind: 'percent',
      cellRef: 'C31',
    })
  })

  it('groups the four change-order amount fields under change_orders for the modal details section', () => {
    const co = AIA_FIELD_DEFS.filter((d) => d.detailsGroupId === 'change_orders')
    expect(co).toHaveLength(4)
    expect(co.map((d) => d.key)).toEqual([
      'g702_f49_previous_month_change_order_additions',
      'g702_h49_previous_month_change_order_deductions',
      'g702_f50_this_month_change_order_additions',
      'g702_h50_this_month_change_order_deductions',
    ])
    expect(AIA_FIELD_DEFS.filter((d) => d.detailsGroupId != null)).toHaveLength(4)
  })

  it('defines a unique key per field def', () => {
    const keys = new Set<AiaFieldKey>()
    for (const def of AIA_FIELD_DEFS) {
      expect(keys.has(def.key)).toBe(false)
      keys.add(def.key)
    }
  })
})
