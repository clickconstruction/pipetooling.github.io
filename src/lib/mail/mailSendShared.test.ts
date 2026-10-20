import { describe, expect, it } from 'vitest'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { mailStatusFromProvider as appFold, mailClientMsgId as appId } from './mailPiece'
import { mailCassAddress, mailCassVerdict, mailChargeFromTransactions, mailChargeRead, mailClientMsgId, mailMessageTitle, mailPartyFromPiece, mailPieceUpdateFromParty, mailPrepareProblems, mailResendInput, mailResolvedWords, mailStatusFromProvider, sendsWithPiece, ymdInZone, type MailPieceRow } from '../../../supabase/functions/_shared/mailSend'

const piece = { id: '0f2a9c11-aaaa-bbbb-cccc-000000000001', kind: 'lien_notice_53_056', recipient: 'owner', name: '', organization: 'ATI Schertz Holdings LLC', address1: '17300 IH 35 N', address2: '', city: 'Schertz', state: 'TX', postal_code: '78154', send_type: 'Certified, Electronic Return Receipt', envelope: '#10' as const, status: 'sent' as const, usps_tracking: null, mailed_at: null, delivered_at: null, signed_by: null, delivery_status: null, delivery_as_of: null }

describe('the mail-send kernel the functions share (the Docsmit train, PR 3)', () => {
  it('folds a provider’s words exactly as the app’s own kernel does', () => {
    const cases = [
      { sent: false, tracking: null, deliveryStatus: null },
      { sent: true, tracking: null, deliveryStatus: null },
      { sent: true, tracking: '9407', deliveryStatus: null },
      { sent: true, tracking: '9407', deliveryStatus: 'Arrived at USPS Regional Facility' },
      { sent: true, tracking: '9407', deliveryStatus: 'Notice Left (No Authorized Recipient Available)' },
      { sent: true, tracking: '9407', deliveryStatus: 'Delivered, Front Desk/Reception/Mail Room' },
      { sent: true, tracking: '9407', deliveryStatus: 'Return to Sender' },
      { sent: true, tracking: '9407', deliveryStatus: 'Pre-Shipment Info Sent to USPS' },
      { sent: true, tracking: '9407', deliveryStatus: 'Something USPS said today' },
      { sent: true, tracking: '9407', deliveryStatus: 'In Transit', deliveredEvent: true },
    ]
    for (const c of cases) expect(mailStatusFromProvider(c)).toBe(appFold(c))
    expect(mailClientMsgId('lien_notice_53_056', 'abc')).toBe(appId('lien_notice_53_056', 'abc'))
  })

  it('names what a prepare lacks, and shapes the party and the CASS address', () => {
    expect(mailPrepareProblems({ ...piece, source_ids: [], sheets: 4 })).toEqual([])
    expect(mailPrepareProblems({ kind: 'nope', sheets: 0 })).toContain('a known kind')
    expect(mailPrepareProblems({ kind: 'nope', sheets: 0 })).toContain('an envelope (#10 or Flat)')
    expect(mailPartyFromPiece(piece)).toEqual({ organization: 'ATI Schertz Holdings LLC', address1: '17300 IH 35 N', address2: '', city: 'Schertz', state: 'TX', postalCode: '78154', sendType: 'Certified, Electronic Return Receipt', envelope: '#10', sided: 1 })
    expect(mailPartyFromPiece({ ...piece, organization: '', name: 'John A. Backham' })).toMatchObject({ firstName: 'John A.', lastName: 'Backham' })
    expect(mailCassAddress(piece)).toEqual({ firstName: 'ATI Schertz Holdings LLC', lastName: '', address1: '17300 IH 35 N', address2: '', city: 'Schertz', state: 'TX', zip: '78154' })
    expect(mailCassVerdict([{ nonMailable: false, coarseCorrectionMsg: 'ZIP+4 added: 78154-1234' }])).toEqual({ mailable: true, correction: 'ZIP+4 added: 78154-1234' })
    expect(mailCassVerdict({ addresses: [{ nonMailable: 1 }] })).toEqual({ mailable: false, correction: null })
    expect(mailMessageTitle(piece, '650')).toBe('Job 650 · lien notice 53 056 · owner · ATI Schertz Holdings LLC · 0f2a9c11')
  })

  it('a /parties read patches the piece: the number, the fold, the mailed and delivered instants, and never backs off a settled status', () => {
    const now = '2026-10-13T15:00:00Z'
    const mailed = mailPieceUpdateFromParty(piece, { USPSTrackingID: '9407 1118 9876 5432 1098', DeliveryStatus: 'Pre-Shipment Info Sent to USPS', DStatusao: '2026-10-13T14:10:00Z' }, now)
    expect(mailed.changed).toBe(true)
    expect(mailed.patch).toMatchObject({ usps_tracking: '9407 1118 9876 5432 1098', status: 'mailed', mailed_at: '2026-10-13T14:10:00Z' })
    expect(mailed.event).toMatchObject({ kind: 'poll', status: 'mailed' })
    const delivered = mailPieceUpdateFromParty({ ...piece, status: 'in_transit', usps_tracking: '9407', mailed_at: '2026-10-13T14:10:00Z' }, { USPSTrackingID: '9407', DeliveryStatus: 'Delivered, Left with Individual', DStatusao: '2026-10-16T17:02:00Z', signedFor: 'R. SMITH' }, now)
    expect(delivered.patch).toMatchObject({ status: 'delivered', delivered_at: '2026-10-16T17:02:00Z', signed_by: 'R. SMITH' })
    expect(delivered.patch.mailed_at).toBeUndefined()
    const same = mailPieceUpdateFromParty({ ...piece, status: 'in_transit', usps_tracking: '9407', mailed_at: '2026-10-13T14:10:00Z', delivery_status: 'In Transit to Next Facility', delivery_as_of: '2026-10-14T01:00:00Z' }, { USPSTrackingID: '9407', DeliveryStatus: 'In Transit to Next Facility', DStatusao: '2026-10-14T01:00:00Z' }, now)
    expect(same.changed).toBe(false)
    const settled = mailPieceUpdateFromParty({ ...piece, status: 'delivered', usps_tracking: '9407', mailed_at: '2026-10-13T14:10:00Z', delivered_at: '2026-10-16T17:02:00Z' }, { USPSTrackingID: '9407', DeliveryStatus: 'In Transit', DStatusao: '2026-10-17T01:00:00Z' }, now)
    expect(settled.patch.status).toBe('delivered')
    const blank = mailPieceUpdateFromParty(piece, {}, now)
    expect(blank.patch.status).toBe('sent')
    expect(blank.changed).toBe(false)
  })

  it('marks the filing’s send with the provider, the piece, the number and the mailed day, leaving the other recipient alone', () => {
    const sends = [
      { recipient: 'owner', method: 'certified_mail', tracking: '', sent_on: '2026-10-12' },
      { recipient: 'original_contractor', method: 'certified_mail', tracking: '', sent_on: '2026-10-12' },
    ]
    const next = sendsWithPiece(sends, 'owner', { id: 'p1', provider: 'docsmit', usps_tracking: '9407 1118', mailed_on: '2026-10-13' })
    expect(next[0]).toEqual({ recipient: 'owner', method: 'certified_mail', tracking: '9407 1118', sent_on: '2026-10-13', via: 'docsmit', piece_id: 'p1' })
    expect(next[1]).toEqual(sends[1])
    expect(sendsWithPiece(sends, 'owner', { id: 'p1', provider: 'docsmit', usps_tracking: null })[0]).toEqual({ recipient: 'owner', method: 'certified_mail', tracking: '', sent_on: '2026-10-12', via: 'docsmit', piece_id: 'p1' })
    expect(sendsWithPiece('junk', 'owner', { id: 'p1', provider: 'docsmit', usps_tracking: null })).toEqual([])
    // 00:30 UTC on Oct 14 is 7:30 pm Central on Oct 13.
    expect(ymdInZone('2026-10-14T00:30:00Z', APP_CALENDAR_TZ)).toBe('2026-10-13')
  })

  it('sums what Docsmit charged from /transactions, a refund negative, null with no priced row; the charge is read once (6b, the cost line)', () => {
    expect(mailChargeFromTransactions([{ TransactionID: 1, CoR: 'C', price: 9.85, discount: 0 }])).toBe(9.85)
    expect(mailChargeFromTransactions([{ CoR: 'C', price: '$ 2.49' }, { CoR: 'C', price: 7.36 }, { CoR: 'R', price: 1 }])).toBe(8.85)
    expect(mailChargeFromTransactions({ transactions: [{ price: 3 }] })).toBe(3)
    expect(mailChargeFromTransactions({ TransactionID: 9, price: 4.5 })).toBe(4.5)
    expect(mailChargeFromTransactions([])).toBeNull()
    expect(mailChargeFromTransactions([{ TransactionID: 1, CoR: 'C' }])).toBeNull()
    expect(mailChargeFromTransactions(null)).toBeNull()
    expect(mailChargeRead([{ at: 'x', kind: 'poll' }])).toBe(false)
    expect(mailChargeRead([{ at: 'x', kind: 'poll' }, { at: 'y', kind: 'charged', price: 9.85 }])).toBe(true)
    expect(mailChargeRead(null)).toBe(false)
  })

  it('the piece that answers one which came back (6b-3): plain keeps the address and goes First Class; address keeps the send type and takes what was typed, a blank keeping the old', () => {
    const old = { ...piece, source_ids: ['f1'], job_id: 'j650', short_code: 'ABCD2345', sheets: 4, provider: 'docsmit', provider_message_id: 'm-1', client_msg_id: 'x', price: 9.85, events: [], opened_at: null, pdf_bucket: 'b', pdf_path: 'mail/x.pdf', certification_path: null, problem: null } as unknown as MailPieceRow
    const plain = mailResendInput(old, 'plain', null)
    expect(plain).toMatchObject({ kind: 'lien_notice_53_056', source_ids: ['f1'], recipient: 'owner', short_code: null, organization: 'ATI Schertz Holdings LLC', address1: '17300 IH 35 N', send_type: 'First Class', envelope: '#10', sheets: 4 })
    const again = mailResendInput(old, 'address', { address1: '9993 IH 10 W', address2: 'Suite 102', city: 'San Antonio', state: 'tx', postal_code: '78230' })
    expect(again).toMatchObject({ organization: 'ATI Schertz Holdings LLC', name: '', address1: '9993 IH 10 W', address2: 'Suite 102', city: 'San Antonio', state: 'TX', postal_code: '78230', send_type: 'Certified, Electronic Return Receipt' })
    expect(mailResendInput(old, 'address', { name: 'John A. Backham', address1: '1 Main St', address2: '', city: '', state: '', postal_code: '' })).toMatchObject({ name: 'John A. Backham', organization: '', address1: '1 Main St', address2: '', city: 'Schertz', state: 'TX', postal_code: '78154' })
    expect(mailResolvedWords('plain', again)).toBe('a plain First Class copy sent')
    expect(mailResolvedWords('address', again)).toBe('mailed again to 9993 IH 10 W, San Antonio')
  })
})
