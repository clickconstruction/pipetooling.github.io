import { describe, expect, it } from 'vitest'
import { subsWorkMoveIsButton, subsWorkPhoneRow } from './subsWorkPhoneRows'
import type { SubsRow } from './subsTabRows'

const money = (n: number) => `$${n.toLocaleString('en-US')}`
const sheet = (over: Record<string, unknown> = {}, row: Record<string, unknown> = {}): SubsRow =>
  ({ key: 'sheet:1', kind: 'sheet', jobId: 'j1', stage: null, window: null, span: null, board: { subName: 'Sub A', agreed: 4200, paid: 0, open: 4200, unpriced: false, coverage: { kind: 'none' }, ...over }, ...row }) as unknown as SubsRow

describe('subsWorkPhoneRow', () => {
  it('a sheet on a handshake: the sub, where it stands, the window, what is open', () => {
    expect(subsWorkPhoneRow(sheet(), { windowLabel: null, formatMoney: money })).toEqual({ title: 'Sub A', sub: 'nothing in writing · no window', amount: '$4,200', tone: 'due', attention: true })
  })
  it('names the stage first when the sheet has one, and the window when it is set', () => {
    const r = sheet({ coverage: { kind: 'signed' } }, { stage: { id: 's', name: 'Rough-in', amount: 4200 } })
    expect(subsWorkPhoneRow(r, { windowLabel: 'Sep 28 – Sep 30', formatMoney: money })).toMatchObject({ title: 'Rough-in · Sub A', sub: 'signed · Sep 28 – Sep 30', attention: false })
  })
  it('an expired offer says so; unpriced and paid read as words', () => {
    expect(subsWorkPhoneRow(sheet({ coverage: { kind: 'sent', expired: true } }), { windowLabel: null, formatMoney: money }).sub).toBe('offer out · expired · no window')
    expect(subsWorkPhoneRow(sheet({ unpriced: true, agreed: 0, open: 0 }), { windowLabel: null, formatMoney: money })).toMatchObject({ amount: 'unpriced', tone: 'quiet' })
    expect(subsWorkPhoneRow(sheet({ open: 0, paid: 4200, coverage: { kind: 'signed' } }), { windowLabel: null, formatMoney: money })).toMatchObject({ amount: 'paid', tone: 'paid' })
    expect(subsWorkPhoneRow(sheet({ subName: ' ' }), { windowLabel: null, formatMoney: money }).title).toBe('No sub named')
  })
  it('a stage row: a window with no order behind it', () => {
    const r = { key: 'stage:1', kind: 'stage', jobId: 'j1', stage: { id: 's', name: 'Top-out', amount: 0 }, window: {}, span: null, board: null } as unknown as SubsRow
    expect(subsWorkPhoneRow(r, { windowLabel: 'Oct 5 – Oct 7', formatMoney: money })).toEqual({ title: 'Top-out', sub: 'no order yet · Oct 5 – Oct 7', amount: 'unpriced', tone: 'quiet', attention: true })
  })
})

describe('subsWorkMoveIsButton', () => {
  it('the sub’s own step and a finished row are not buttons', () => {
    expect(subsWorkMoveIsButton({ kind: 'draft', label: 'Get it in writing', tone: 'primary', hint: null })).toBe(true)
    expect(subsWorkMoveIsButton({ kind: 'wait_sub', label: 'Waiting on Sam', tone: 'quiet', hint: null })).toBe(false)
    expect(subsWorkMoveIsButton({ kind: 'done', label: 'Nothing — done', tone: 'quiet', hint: null })).toBe(false)
    expect(subsWorkMoveIsButton(null)).toBe(false)
  })
})
