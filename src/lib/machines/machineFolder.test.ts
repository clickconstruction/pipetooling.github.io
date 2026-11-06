import { describe, expect, it } from 'vitest'
import { machineFolderName } from '../../../supabase/functions/_shared/machineWords'

describe('a machine’s Drive folder name (the sweep and the phone agree)', () => {
  it('names ours by the unit, and a rental by the agreement so a claim finds it', () => {
    expect(machineFolderName({ unit_label: 'E-12', make: 'Kubota', model: 'KX040', rental_from: null, rental_agreement_no: null })).toBe('E-12 · Kubota KX040')
    expect(machineFolderName({ unit_label: 'R-1', make: 'Bobcat', model: 'E35', rental_from: 'Sunbelt', rental_agreement_no: '48812-3' })).toBe('Rental · Sunbelt 48812-3 · Bobcat E35')
    expect(machineFolderName({ unit_label: null, make: 'Vermeer', model: 'D23x30', rental_from: '', rental_agreement_no: '' })).toBe('Vermeer D23x30')
  })
})
