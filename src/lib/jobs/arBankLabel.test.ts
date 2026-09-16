import { describe, expect, it } from 'vitest'
import {
  arAppliedToast,
  arApplyBooksIncome,
  arBankLabelIsIncome,
  arBankLabelNote,
  arBankLabelStays,
  parseArIncomeSettingValue,
  type ArBankLabelSlice,
} from './arBankLabel'

const slice = (over: Partial<ArBankLabelSlice>): ArBankLabelSlice => ({
  switchOn: true,
  labelName: null,
  labelDefaultKey: null,
  setByAr: false,
  ...over,
})

describe('parseArIncomeSettingValue', () => {
  it('reads the app_settings text the way the database does', () => {
    expect(parseArIncomeSettingValue('true')).toBe(true)
    expect(parseArIncomeSettingValue(' TRUE ')).toBe(true)
    expect(parseArIncomeSettingValue('false')).toBe(false)
    expect(parseArIncomeSettingValue(null)).toBe(false)
    expect(parseArIncomeSettingValue(undefined)).toBe(false)
  })
})

describe('arBankLabelIsIncome', () => {
  it('trusts the default key first, then the name', () => {
    expect(arBankLabelIsIncome({ labelName: 'Renamed', labelDefaultKey: 'income_part_i' })).toBe(true)
    expect(arBankLabelIsIncome({ labelName: 'Income', labelDefaultKey: null })).toBe(true)
    expect(arBankLabelIsIncome({ labelName: 'Taxes and Licenses', labelDefaultKey: 'taxes_licenses' })).toBe(false)
    expect(arBankLabelIsIncome({ labelName: null, labelDefaultKey: null })).toBe(false)
  })
})

describe('arApplyBooksIncome', () => {
  it('is true only when the switch is on and nothing has labelled the deposit', () => {
    expect(arApplyBooksIncome(slice({}))).toBe(true)
    expect(arApplyBooksIncome(slice({ switchOn: false }))).toBe(false)
    expect(arApplyBooksIncome(slice({ labelName: 'Income', labelDefaultKey: 'income_part_i' }))).toBe(false)
    expect(arApplyBooksIncome(slice({ labelName: 'Taxes and Licenses' }))).toBe(false)
    expect(arApplyBooksIncome(null)).toBe(false)
    expect(arApplyBooksIncome(undefined)).toBe(false)
  })
})

describe('arBankLabelStays / arBankLabelNote', () => {
  it('names the label only when it deviates from Income', () => {
    const seguin = slice({ labelName: 'Taxes and Licenses', labelDefaultKey: 'taxes_licenses' })
    expect(arBankLabelStays(seguin)).toBe('Taxes and Licenses')
    expect(arBankLabelNote(seguin)).toEqual({
      text: 'Labelled Taxes and Licenses in Banking, not Income. Apply leaves that alone.',
      tone: 'warn',
    })
  })
  it('says nothing in the common cases', () => {
    expect(arBankLabelNote(slice({}))).toBeNull()
    expect(arBankLabelNote(slice({ labelName: 'Income', labelDefaultKey: 'income_part_i' }))).toBeNull()
    expect(arBankLabelNote(slice({ labelName: '  ' }))).toBeNull()
    expect(arBankLabelNote(null)).toBeNull()
  })
  it('says nothing at all while the switch is off — the rule does not exist for the office then', () => {
    expect(arBankLabelNote(slice({ switchOn: false, labelName: 'Taxes and Licenses' }))).toBeNull()
    expect(arBankLabelStays(slice({ switchOn: false, labelName: 'Taxes and Licenses' }))).toBeNull()
  })
})

describe('arAppliedToast', () => {
  it('adds four words when the deposit was booked as Income', () => {
    expect(arAppliedToast(5574.6, true)).toBe('Applied $5,574.60 · booked as Income')
    expect(arAppliedToast(5574.6, false)).toBe('Applied $5,574.60')
    expect(arAppliedToast(0, true)).toBe('Applied · booked as Income')
  })
})
