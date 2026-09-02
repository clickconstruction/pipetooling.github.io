import { describe, expect, it } from 'vitest'
import { lienInboxJobLabel, splitLienSignatureLanes, type LienInboxRow } from './lienReleaseInboxLanes'

const ME = 'user-me'

function row(overrides: Partial<LienInboxRow>): LienInboxRow {
  return {
    id: 'r1',
    job_id: 'j1',
    status: 'awaiting_signature',
    voided_at: null,
    sent_to_customer_at: null,
    signer_user_id: null,
    signature_requested_by: null,
    signature_requested_at: null,
    signed_at: null,
    job: { id: 'j1', job_name: 'Kent', hcp_number: '1003', click_number: null, customer_email: null },
    ...overrides,
  } as unknown as LienInboxRow
}

describe('splitLienSignatureLanes', () => {
  it('toSign = awaiting where I am the signer, oldest request first; voided drops out', () => {
    const rows = [
      row({ id: 'a', signer_user_id: ME, signature_requested_at: '2026-09-02T02:00:00Z' }),
      row({ id: 'b', signer_user_id: ME, signature_requested_at: '2026-09-02T01:00:00Z' }),
      row({ id: 'c', signer_user_id: 'someone-else', signature_requested_at: '2026-09-02T00:00:00Z' }),
      row({ id: 'd', signer_user_id: ME, voided_at: '2026-09-02T03:00:00Z' }),
    ]
    const lanes = splitLienSignatureLanes(rows, ME)
    expect(lanes.toSign.map((r) => r.id)).toEqual(['b', 'a'])
    expect(lanes.toSend).toEqual([])
  })

  it('toSend = signed + unsent + requested by me, oldest signed first; sent rows drop out', () => {
    const rows = [
      row({ id: 'a', status: 'signed', signature_requested_by: ME, signed_at: '2026-09-02T02:00:00Z' }),
      row({ id: 'b', status: 'signed', signature_requested_by: ME, signed_at: '2026-09-02T01:00:00Z' }),
      row({ id: 'c', status: 'signed', signature_requested_by: ME, signed_at: '2026-09-02T00:30:00Z', sent_to_customer_at: '2026-09-02T03:00:00Z' }),
      row({ id: 'd', status: 'signed', signature_requested_by: 'someone-else', signed_at: '2026-09-02T00:00:00Z' }),
    ]
    const lanes = splitLienSignatureLanes(rows, ME)
    expect(lanes.toSend.map((r) => r.id)).toEqual(['b', 'a'])
    expect(lanes.toSign).toEqual([])
  })

  it('null user matches nothing (never lane rows with null signer/requester onto a signed-out view)', () => {
    const rows = [row({ signer_user_id: null }), row({ status: 'signed', signature_requested_by: null })]
    const lanes = splitLienSignatureLanes(rows, null)
    expect(lanes.toSign).toEqual([])
    expect(lanes.toSend).toEqual([])
  })
})

describe('lienInboxJobLabel', () => {
  it('joins name and effective number; degrades to name alone', () => {
    expect(lienInboxJobLabel(row({}))).toBe('Kent · 1003')
    expect(lienInboxJobLabel(row({ job: { id: 'j', job_name: '', hcp_number: '', click_number: '', customer_email: null } }))).toBe('Job')
  })
})
