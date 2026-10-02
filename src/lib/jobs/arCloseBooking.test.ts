import { describe, expect, it } from 'vitest'
import {
  AR_BOOK_LEAVE,
  arCloseBookingView,
  arCloseOutToast,
  arReopenToast,
  arRowBookedLine,
  labelFitsReason,
  parseArDepositBooking,
  reasonDefaultLabel,
  rememberedCloseLine,
  rememberedCloseReason,
  ruleShortName,
  type ArBookingLabel,
  type ArDepositBooking,
} from './arCloseBooking'

const INSURANCE: ArBookingLabel = { id: 'l-ins', name: 'Insurance', defaultKey: 'insurance', accountType: 'expense' }
const COGS: ArBookingLabel = { id: 'l-cogs', name: 'Cost of Goods Sold', defaultKey: 'cogs_part_iii', accountType: 'expense' }
const SUPPLIES: ArBookingLabel = { id: 'l-sup', name: 'Supplies', defaultKey: 'supplies', accountType: 'expense' }
const INCOME: ArBookingLabel = { id: 'l-inc', name: 'Income', defaultKey: 'income_part_i', accountType: 'income' }
const EQUITY: ArBookingLabel = { id: 'l-eq', name: 'Owners Equity', defaultKey: null, accountType: 'equity' }
const LABELS = [INSURANCE, SUPPLIES, COGS, INCOME, EQUITY]

function booking(over: Partial<ArDepositBooking> = {}): ArDepositBooking {
  return { label: null, labelBy: null, labelAt: null, ruleName: null, pending: null, usual: null, lastCloseOut: null, labels: LABELS, ...over }
}

/** Texas Mutual's $119.56 on Oct 1: the rule labelled it Insurance on Aug 16. */
const TEXAS_MUTUAL = booking({
  label: INSURANCE,
  labelBy: 'rule',
  labelAt: '2026-08-16T17:45:23Z',
  ruleName: 'TEXAS MUTUAL - Insurance',
  usual: { label: INSURANCE, count: 2 },
})

const base = { chosenLabelId: null, changing: false, amount: 119.56, counterpartyName: 'Texas Mutual' }

describe('parseArDepositBooking', () => {
  it('reads the RPC jsonb', () => {
    const b = parseArDepositBooking({
      label: { id: 'l-ins', name: 'Insurance', default_key: 'insurance', account_type: 'expense' },
      label_by: 'rule',
      label_at: '2026-08-16T17:45:23Z',
      rule_name: 'TEXAS MUTUAL - Insurance',
      pending: null,
      usual: { count: 2, label: { id: 'l-ins', name: 'Insurance', default_key: 'insurance', account_type: 'expense' } },
      last_close_out: { reason: 'vendor_refund', closed_at: '2026-10-02T00:25:00Z', posted_at: '2026-08-13T15:00:00Z', amount: 119.56 },
      labels: [{ id: 'l-ins', name: 'Insurance', default_key: 'insurance', account_type: 'expense' }, { id: '', name: 'broken' }],
    })
    expect(b?.label).toEqual(INSURANCE)
    expect(b?.labelBy).toBe('rule')
    expect(b?.usual).toEqual({ label: INSURANCE, count: 2 })
    expect(b?.lastCloseOut?.reason).toBe('vendor_refund')
    expect(b?.labels).toEqual([INSURANCE])
  })

  it('is null for nothing usable, and drops an unknown last reason', () => {
    expect(parseArDepositBooking(null)).toBeNull()
    expect(parseArDepositBooking([])).toBeNull()
    const b = parseArDepositBooking({ label: null, last_close_out: { reason: 'nope', closed_at: '2026-10-01T00:00:00Z' }, labels: [] })
    expect(b?.label).toBeNull()
    expect(b?.labelBy).toBeNull()
    expect(b?.lastCloseOut).toBeNull()
  })
})

describe('small rules', () => {
  it('shortens a rule named payee - label', () => {
    expect(ruleShortName('TEXAS MUTUAL - Insurance', 'Insurance')).toBe('TEXAS MUTUAL')
    expect(ruleShortName('City of Seguin - Taxes and Licenses', 'Taxes and Licenses')).toBe('City of Seguin')
    expect(ruleShortName('Gas stations', 'Fuel / Gas')).toBe('Gas stations')
  })

  it('knows the label each reason books to on its own', () => {
    expect(reasonDefaultLabel('bank_interest', LABELS)).toEqual(INCOME)
    expect(reasonDefaultLabel('owner_deposit', LABELS)).toEqual(EQUITY)
    expect(reasonDefaultLabel('vendor_refund', LABELS)).toBeNull()
    expect(labelFitsReason('vendor_refund', INCOME)).toBe(false)
    expect(labelFitsReason('vendor_refund', INSURANCE)).toBe(true)
    expect(labelFitsReason('owner_deposit', { ...SUPPLIES, accountType: null })).toBe(true)
  })

  it('says the toast and the row line', () => {
    expect(arCloseOutToast('kept', 'Insurance')).toBe('Closed out · booked as Insurance')
    expect(arCloseOutToast(null, null)).toBe('Closed out. It has left To match.')
    expect(arReopenToast('removed')).toBe('Reopened. The label Close out put on came off.')
    expect(arReopenToast('restored')).toBe('Reopened. Banking has its old label back.')
    expect(arReopenToast(null)).toBe('Reopened. It is back in To match.')
    expect(arRowBookedLine(INSURANCE)).toBe('Banking books it as Insurance')
    expect(arRowBookedLine(INCOME)).toBeNull()
    expect(arRowBookedLine(null)).toBeNull()
  })
})

describe('arCloseBookingView', () => {
  it('a rule labelled it: reads it back and keeps it (Texas Mutual)', () => {
    const v = arCloseBookingView({ ...base, reason: 'vendor_refund', booking: TEXAS_MUTUAL })
    expect(v.state).toBe('kept')
    expect(v.tone).toBe('green')
    expect(v.lead).toBe('Banking books it as')
    expect(v.label?.name).toBe('Insurance')
    expect(v.detail).toBe('Your rule TEXAS MUTUAL labelled it on Aug 16.')
    expect(v.sendLabelId).toBe('l-ins')
    expect(v.pickerOpen).toBe(false)
    expect(v.footer).toBe('Takes $119.56 off To match as a vendor refund. Banking keeps it as Insurance.')
    expect(v.confirmTitle).toBe('Close out $119.56 as a vendor refund?')
    expect(v.confirmBody).toBe('It leaves To match for everyone. Banking keeps it as Insurance. You can reopen it from All.')
  })

  it('a waiting rule match: Close out approves it', () => {
    const v = arCloseBookingView({
      ...base,
      reason: 'vendor_refund',
      booking: booking({ pending: { suggestionId: 's-1', ruleName: 'TEXAS MUTUAL - Insurance', label: INSURANCE } }),
    })
    expect(v.state).toBe('approve')
    expect(v.tone).toBe('blue')
    expect(v.lead).toBe('Your rule TEXAS MUTUAL says')
    expect(v.detail).toBe('Close out approves it, the same as Approve in Banking.')
    expect(v.sendLabelId).toBe('l-ins')
    expect(v.footer).toBe('Takes $119.56 off To match as a vendor refund. Banking books it as Insurance.')
  })

  it('nothing labels it: fills the payee’s usual label, and a parts label shows the Supply houses door', () => {
    const v = arCloseBookingView({
      ...base,
      amount: 212.4,
      counterpartyName: 'Moore Supply Co',
      reason: 'vendor_refund',
      booking: booking({ usual: { label: COGS, count: 28 } }),
    })
    expect(v.state).toBe('set')
    expect(v.pickerOpen).toBe(true)
    expect(v.pickerCanLeave).toBe(true)
    expect(v.sendLabelId).toBe('l-cogs')
    expect(v.detail).toBe('Filled in because Moore Supply Co’s payments are booked that way.')
    expect(v.partsDoor).toBe(true)
  })

  it('nothing at all: asks, and sends no label until someone picks', () => {
    const v = arCloseBookingView({ ...base, reason: 'vendor_refund', booking: booking() })
    expect(v.state).toBe('none')
    expect(v.sendLabelId).toBeNull()
    expect(v.footer).toBe('Takes $119.56 off To match as a vendor refund. Banking has no label for it yet.')
    expect(v.partsDoor).toBe(false)
  })

  it('bank interest and an owner deposit fill their own label, even over a rule match of another kind', () => {
    expect(arCloseBookingView({ ...base, reason: 'bank_interest', booking: booking() }).sendLabelId).toBe('l-inc')
    const owner = arCloseBookingView({
      ...base,
      reason: 'owner_deposit',
      booking: booking({ pending: { suggestionId: 's-1', ruleName: 'Robert Douglas - Contract Labor', label: { ...SUPPLIES, id: 'l-cl', name: 'Contract Labor' } } }),
    })
    expect(owner.state).toBe('set')
    expect(owner.sendLabelId).toBe('l-eq')
    expect(owner.detail).toBe('An owner deposit goes under Owners Equity.')
  })

  it('a label of the wrong kind stays, in amber, with the reason', () => {
    const v = arCloseBookingView({ ...base, reason: 'vendor_refund', booking: booking({ label: INCOME, labelBy: 'person', labelAt: '2026-09-01T15:00:00Z' }) })
    expect(v.state).toBe('kept')
    expect(v.tone).toBe('amber')
    expect(v.detail).toBe('Someone labelled it in Banking on Sep 1.')
    expect(v.warning).toBe('A vendor refund goes under the expense it pays back.')
  })

  it('a pick wins: another label replaces the current one, the same label keeps it, Leave sends none', () => {
    const replaced = arCloseBookingView({ ...base, reason: 'vendor_refund', booking: TEXAS_MUTUAL, chosenLabelId: 'l-sup', changing: true })
    expect(replaced.state).toBe('set')
    expect(replaced.sendLabelId).toBe('l-sup')
    expect(replaced.detail).toBe('It replaces Insurance. Reopen puts that back.')
    expect(replaced.pickerCanLeave).toBe(false)

    const same = arCloseBookingView({ ...base, reason: 'vendor_refund', booking: TEXAS_MUTUAL, chosenLabelId: 'l-ins', changing: true })
    expect(same.state).toBe('kept')
    expect(same.pickerOpen).toBe(true)

    const pendingPick = arCloseBookingView({
      ...base,
      reason: 'vendor_refund',
      booking: booking({ pending: { suggestionId: 's-1', ruleName: 'TEXAS MUTUAL - Insurance', label: INSURANCE } }),
      chosenLabelId: 'l-ins',
      changing: true,
    })
    expect(pendingPick.state).toBe('approve')

    const leave = arCloseBookingView({ ...base, reason: 'vendor_refund', booking: booking({ usual: { label: COGS, count: 3 } }), chosenLabelId: AR_BOOK_LEAVE, changing: false })
    expect(leave.state).toBe('none')
    expect(leave.sendLabelId).toBeNull()
  })

  it('an unread booking says nothing about Banking and sends nothing', () => {
    const v = arCloseBookingView({ ...base, reason: 'vendor_refund', booking: null })
    expect(v.state).toBe('unread')
    expect(v.sendLabelId).toBeNull()
    expect(v.lead).toBeNull()
    expect(v.footer).toBe('Takes $119.56 off To match as a vendor refund. Banking is not changed.')
  })
})

describe('the payee remembers', () => {
  it('picks the last close-out’s reason and says so', () => {
    const b = booking({ lastCloseOut: { reason: 'vendor_refund', closedAt: '2026-10-02T00:25:00Z', postedAt: '2026-08-13T15:00:00Z' } })
    expect(rememberedCloseReason(b)).toBe('vendor_refund')
    expect(rememberedCloseLine(b, 'Texas Mutual')).toBe('Texas Mutual’s Aug 13 deposit was a vendor refund.')
    expect(rememberedCloseReason(booking())).toBeNull()
    expect(rememberedCloseLine(booking(), 'Texas Mutual')).toBeNull()
  })
})
