import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { splitPartnerBalance, pendingPartnerOffsets, type OffsetAttachment } from '../lib/partnerLedger/partnerBalance'
import {
  parsePartnerLedgerOffsets,
  parsePartnerLedgerStubs,
  type PartnerLedgerOffset,
  type PartnerLedgerStub,
} from '../lib/partnerLedger/partnerWeeks'

/**
 * The office's read of a partner's money (vNEXT): the SAME `get_partner_ledger_as`
 * payload the View-as lens and the partner's own statement consume, shared by
 * the Partnerships Ledger, Timeline and Statements tabs so the three cannot
 * disagree. The payload deliberately omits office-only detail — which
 * statement picked an offset up, and the payroll name the offset editor
 * writes back — so ONE metadata select on person_offsets rides alongside; no
 * dollar figure comes from it.
 *
 * Charges know they are attached from the payload (deduction links); only
 * credits need the attachment row — see pendingPartnerOffsets.
 *
 * `exists` is false when the lens gate says so (partnership paused/ended, or
 * gone) — the same honest "nothing" the partner would see.
 */
export type OfficePartnerLedger = {
  status: 'loading' | 'ok' | 'failed'
  /** false once loaded when the lens gate hid the partnership (paused/ended). */
  exists: boolean
  stubs: PartnerLedgerStub[]
  offsets: PartnerLedgerOffset[]
  attachments: Map<string, OffsetAttachment>
  /** true when the attachment select failed — pending CREDITS are then unknown and read as attached (charges are unaffected). */
  attachmentsUnavailable: boolean
  pending: PartnerLedgerOffset[]
  split: ReturnType<typeof splitPartnerBalance>
  reload: () => Promise<void>
}

const EMPTY_ATTACHMENTS: Map<string, OffsetAttachment> = new Map()

export function useOfficePartnerLedger(partnershipId: string, personId: string): OfficePartnerLedger {
  const [status, setStatus] = useState<OfficePartnerLedger['status']>('loading')
  const [exists, setExists] = useState(true)
  const [stubs, setStubs] = useState<PartnerLedgerStub[]>([])
  const [offsets, setOffsets] = useState<PartnerLedgerOffset[]>([])
  const [attachments, setAttachments] = useState<Map<string, OffsetAttachment>>(EMPTY_ATTACHMENTS)
  const [attachmentsUnavailable, setAttachmentsUnavailable] = useState(false)

  const load = useCallback(async () => {
    const [ledRes, attRes] = await Promise.all([
      supabase.rpc('get_partner_ledger_as', { p_partnership_id: partnershipId, p_weeks: 520 }),
      supabase.from('person_offsets').select('id, pay_stub_id, person_name').eq('person_id', personId),
    ])
    if (ledRes.error) {
      setStatus('failed')
      setStubs([])
      setOffsets([])
      return
    }
    const payload = ledRes.data as Record<string, unknown> | null
    setExists(payload?.exists === true)
    setStubs(parsePartnerLedgerStubs(ledRes.data))
    setOffsets(parsePartnerLedgerOffsets(ledRes.data))
    if (attRes.error) {
      setAttachmentsUnavailable(true)
      setAttachments(EMPTY_ATTACHMENTS)
    } else {
      setAttachmentsUnavailable(false)
      const rows = (attRes.data ?? []) as { id: string; pay_stub_id: string | null; person_name: string }[]
      setAttachments(new Map(rows.map((r) => [r.id, { pay_stub_id: r.pay_stub_id, person_name: r.person_name }])))
    }
    setStatus('ok')
  }, [partnershipId, personId])

  useEffect(() => {
    setStatus('loading')
    void load()
  }, [load])

  const pending = useMemo(() => pendingPartnerOffsets(stubs, offsets, attachments), [stubs, offsets, attachments])
  const split = useMemo(() => splitPartnerBalance(stubs, offsets, attachments), [stubs, offsets, attachments])

  return { status, exists, stubs, offsets, attachments, attachmentsUnavailable, pending, split, reload: load }
}
