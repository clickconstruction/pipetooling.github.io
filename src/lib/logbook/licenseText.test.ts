import { describe, expect, it } from 'vitest'
import { parseLicenseType } from './logbook'
import { LICENSE_LEVELS, cleanLicenseNumber, licenseTypeText, tdlrAnswer, tdlrNumberFor, ymdFromMmDdYyyy } from './licenseText'

describe('licenseTypeText', () => {
  it('writes every trade and level so the logbook reads it back the same', () => {
    for (const trade of ['plumbing', 'electrical', 'hvac'] as const) {
      for (const { level } of LICENSE_LEVELS[trade]) {
        const text = licenseTypeText({ trade, level, number: ' #191717 ' })
        expect(parseLicenseType(text ?? ''), `${trade} ${level}`).toMatchObject({ trade, cls: level, number: '191717' })
      }
    }
  })
  it('keeps an other license as typed and refuses an empty number or a missing level', () => {
    expect(licenseTypeText({ trade: 'other', otherName: 'Notary', number: '135545090' })).toBe('Notary #135545090')
    expect(licenseTypeText({ trade: 'plumbing', level: 'apprentice', number: '  ' })).toBeNull()
    expect(licenseTypeText({ trade: 'electrical', level: null, number: '1' })).toBeNull()
    expect(licenseTypeText({ trade: 'hvac', level: 'journeyman', number: '1' })).toBeNull()
  })
  it('reads back the AC contractor number as it is printed', () => {
    const text = licenseTypeText({ trade: 'hvac', level: 'contractor', number: 'TACLA39079E' })
    expect(parseLicenseType(text ?? '')).toMatchObject({ trade: 'hvac', cls: 'contractor', number: 'TACLA39079E' })
  })
  it('cleans a number', () => {
    expect(cleanLicenseNumber('# 41130 ')).toBe('41130')
  })
})

describe('TDLR', () => {
  it('turns the printed number into the bare one TDLR lists', () => {
    expect(tdlrNumberFor('TACLA39079E')).toBe('39079')
    expect(tdlrNumberFor('#049889')).toBe('49889')
    expect(tdlrNumberFor('ABC')).toBeNull()
  })
  it('picks the license of this trade and level when one number holds several', () => {
    const rows = [
      { license_type: 'A/C Contractor', license_subtype: 'AE', license_number: '39079', owner_name: 'SANTIAGO, WILLIAM G', license_expiration_date_mmddccyy: '06/13/2027' },
      { license_type: 'Master Electrician', license_subtype: 'ME', license_number: '39079', owner_name: 'SMITH, CHARLES LEE', license_expiration_date_mmddccyy: '07/17/2027' },
    ]
    expect(tdlrAnswer(rows, 'hvac', 'contractor')).toEqual({ kind: 'found', holder: 'SANTIAGO, WILLIAM G', expiryYmd: '2027-06-13', type: 'A/C Contractor AE' })
    expect(tdlrAnswer(rows, 'electrical', 'master')).toMatchObject({ kind: 'found', holder: 'SMITH, CHARLES LEE' })
    expect(tdlrAnswer(rows, 'electrical', 'apprentice').kind).toBe('none')
    expect(tdlrAnswer(rows, 'plumbing', 'master').kind).toBe('none')
  })
  it('reads the list date', () => {
    expect(ymdFromMmDdYyyy('12/29/2026')).toBe('2026-12-29')
    expect(ymdFromMmDdYyyy('')).toBeNull()
  })
})
