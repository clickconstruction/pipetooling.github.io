import { describe, expect, it } from 'vitest'
import { designCallCarry, designCallDraft, designCallPatch } from './designCall'

describe('designCallPatch (decision 11, the owner’s call of 2026-10-09)', () => {
  const blank = designCallDraft({})
  it('a design change writes what the office set, trimmed, with a day only when it is one', () => {
    expect(designCallPatch('design_change', { callBy: 'engineer', signoffName: '  Pat Lee ', signoffOn: '2026-10-09', signoffVia: 'email' }, {})).toEqual({ call_by: 'engineer', signoff_name: 'Pat Lee', signoff_on: '2026-10-09', signoff_via: 'email' })
    expect(designCallPatch('design_change', { ...blank, callBy: 'owner', signoffOn: '10/09' }, {})).toEqual({ call_by: 'owner', signoff_name: null, signoff_on: null, signoff_via: null })
  })
  it('names no column when there is nothing to write or clear, so a save before the push cannot fail on them', () => {
    expect(designCallPatch('design_change', blank, {})).toBeNull()
    expect(designCallPatch('alternate', blank, {})).toBeNull()
  })
  it('another status clears a row that held a call or a sign-off; so does emptying the fields', () => {
    const before = { call_by: 'engineer', signoff_name: 'Pat Lee', signoff_on: '2026-10-09', signoff_via: 'email' }
    const cleared = { call_by: null, signoff_name: null, signoff_on: null, signoff_via: null }
    expect(designCallPatch('alternate', designCallDraft(before), before)).toEqual(cleared)
    expect(designCallPatch('design_change', blank, before)).toEqual(cleared)
  })
  it('the draft reads a stored row, and drops a value it does not know', () => {
    expect(designCallDraft({ call_by: 'gc', signoff_name: 'Ann', signoff_on: '2026-10-01', signoff_via: 'letter' })).toEqual({ callBy: 'gc', signoffName: 'Ann', signoffOn: '2026-10-01', signoffVia: 'letter' })
    expect(designCallDraft({ call_by: 'boss', signoff_via: 'fax' })).toEqual({ callBy: null, signoffName: '', signoffOn: '', signoffVia: null })
  })
})

describe('designCallCarry: the record goes with the row', () => {
  const rec = { call_by: 'engineer', signoff_name: 'Pat Lee', signoff_on: '2026-10-09', signoff_via: 'email' }
  it('a design change takes its whole record, and a partial one fills the rest with nothing', () => {
    expect(designCallCarry('design_change', rec)).toEqual(rec)
    expect(designCallCarry('design_change', { signoff_name: 'Pat Lee' })).toEqual({ call_by: null, signoff_name: 'Pat Lee', signoff_on: null, signoff_via: null })
  })
  it('nothing to carry on another status, or on a design change with no record', () => {
    expect(designCallCarry('alternate', rec)).toBeNull()
    expect(designCallCarry(null, rec)).toBeNull()
    expect(designCallCarry('design_change', {})).toBeNull()
    expect(designCallCarry('design_change', { call_by: null, signoff_name: null, signoff_on: null, signoff_via: null })).toBeNull()
  })
})
