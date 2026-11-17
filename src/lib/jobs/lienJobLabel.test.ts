import { describe, expect, it } from 'vitest'
import { lienDeskJobLabel, lienDeskJobNumber, splitLienJobLabel } from './lienJobLabel'

describe('splitLienJobLabel', () => {
  it('splits the number from the name at the first dot', () => {
    expect(splitLienJobLabel('663 · Kestrin Contracting- Taylor (GRAEF)')).toEqual({ number: '663', name: 'Kestrin Contracting- Taylor (GRAEF)' })
    expect(splitLienJobLabel('1046 PLUM · Pretest')).toEqual({ number: '1046 PLUM', name: 'Pretest' })
  })
  it('keeps a later dot in the name', () => {
    expect(splitLienJobLabel('273 · Dunmere · Linmoor')).toEqual({ number: '273', name: 'Dunmere · Linmoor' })
  })
  it('a label with no name is all number', () => {
    expect(splitLienJobLabel('663')).toEqual({ number: '663', name: '' })
    expect(splitLienJobLabel('a1b2c3d4')).toEqual({ number: 'a1b2c3d4', name: '' })
  })
})

describe('lienDeskJobLabel and lienDeskJobNumber (out of LienDesk.tsx, v2.7571)', () => {
  const id = 'a1b2c3d4-0000-4000-8000-000000000000'
  it('a job that has not loaded reads as the first eight letters of its id', () => {
    expect(lienDeskJobLabel(undefined, id)).toBe('a1b2c3d4')
    expect(lienDeskJobNumber(undefined, id)).toBe('a1b2c3d4')
  })
  it('the label is the number, a dot and the name', () => {
    expect(lienDeskJobLabel({ hcp_number: '9001', click_number: null, job_name: ' ZZ Test Job ' }, id)).toBe('9001 · ZZ Test Job')
    expect(lienDeskJobNumber({ hcp_number: '9001', click_number: null, job_name: 'ZZ Test Job' }, id)).toBe('9001')
  })
  it('the HCP number wins, and the Click number stands in when there is none', () => {
    expect(lienDeskJobNumber({ hcp_number: '9001', click_number: 'C12' }, id)).toBe('9001')
    expect(lienDeskJobNumber({ hcp_number: '', click_number: 'C12' }, id)).toBe('C12')
  })
  it('no name leaves the number alone, and no number is a dash', () => {
    expect(lienDeskJobLabel({ hcp_number: '9001', click_number: null, job_name: '  ' }, id)).toBe('9001')
    expect(lienDeskJobLabel({ hcp_number: '', click_number: null, job_name: 'ZZ Test Job' }, id)).toBe('— · ZZ Test Job')
    expect(lienDeskJobNumber({ hcp_number: null, click_number: null }, id)).toBe('—')
  })
  it('the split reads the label back', () => {
    expect(splitLienJobLabel(lienDeskJobLabel({ hcp_number: '9001', click_number: null, job_name: 'ZZ Test Job' }, id))).toEqual({ number: '9001', name: 'ZZ Test Job' })
  })
})
