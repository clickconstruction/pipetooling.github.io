import { useEffect, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import CustomerPropertyRecordPanel, { type PropertyRecordDraft } from '../customers/CustomerPropertyRecordPanel'
import { propertyLookupErrorMessage, type PropertyLookupOutcome } from '../../lib/customers/propertyLookupClient'
import { cachedLookupPropertyRecord, getCachedPropertyLookup } from '../../lib/customers/propertyLookupCache'
import { emptyPropertyDraft } from '../../lib/customers/propertyDraft'
import { applyProposalToFields, titleCaseUpperWords } from '../../lib/customers/propertyRecord'
import { ownerFromRollUnconfirmed, rollProvenanceShort, shouldShowBillCustomerOwnerLine, type OwnerConfirmStateRow } from '../../lib/jobs/ownerConfirm'
import { confirmOwnerForProperty, stampOwnerConfirmed, type OwnerConfirmSource } from '../../lib/jobs/ownerConfirmWrite'

/**
 * Bill Customer's quiet owner line (owner of record, PR 3 — v2.3450; mock-up
 * moment 3). On a GC job (or a builder in the customer row) whose owner of
 * record is not yet confirmed, the Send-to block says what the appraisal roll
 * answers — *Owner of record for <address>: <owner> (<district> <year>) — not
 * yet on the job. Use it so the lien notice can be mailed when it is due.* —
 * and **Use** saves it through the same write as the Fix-ups list. Never a
 * gate on sending: the bill goes out whether or not anyone presses it. A roll
 * miss shows the amber paste sentence with the property record's paste box.
 * An owner the nightly run saved *from the roll · unconfirmed* offers
 * **Confirm** instead. Once confirmed the line is gone for every job at the
 * property.
 */

type JobSlice = {
  id: string
  job_address: string | null
  customer_id: string | null
  customer_name: string | null
  gc_customer_id: string | null
  customer_address_id: string | null
}

type Facts = {
  job: JobSlice
  gcName: string
  record: (OwnerConfirmStateRow & { id: string; address: string }) | null
  show: boolean
}

const line: CSSProperties = { fontSize: '0.78rem', lineHeight: 1.45, marginTop: '0.4rem', display: 'flex', gap: '0.4rem', alignItems: 'flex-start', flexWrap: 'wrap' }
const useBtn: CSSProperties = { padding: '1px 9px', fontSize: '0.72rem', borderRadius: 6, border: '1px solid transparent', background: 'var(--text-green-800)', color: '#fff', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }
const linkBtn: CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '0.75rem', color: 'var(--text-link)', fontWeight: 600 }
const smallBtn: CSSProperties = { padding: '0.25rem 0.7rem', fontSize: '0.75rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer', fontWeight: 600 }

function draftHasOwner(d: PropertyRecordDraft): boolean {
  return (d.owner_name.trim() !== '' || d.owner_company.trim() !== '') && d.owner_mailing_address.trim() !== ''
}

async function loadFacts(jobId: string): Promise<Facts | null> {
  const { data: jobRaw } = await supabase.from('jobs_ledger').select('id, job_address, customer_id, customer_name, gc_customer_id, customer_address_id').eq('id', jobId).maybeSingle()
  const job = jobRaw as JobSlice | null
  if (!job) return null
  const hasGc = Boolean((job.gc_customer_id ?? '').trim())
  // A builder in the customer row: the customer is the GC on some other job (the RPC's definition).
  let customerIsBuilder = false
  if (!hasGc && job.customer_id) {
    const { data: asGc } = await supabase.from('jobs_ledger').select('id').eq('gc_customer_id', job.customer_id).limit(1)
    customerIsBuilder = Array.isArray(asGc) && asGc.length > 0
  }
  if (!hasGc && !customerIsBuilder) return { job, gcName: '', record: null, show: false }
  const [gcRes, recordRes, overrideRes] = await Promise.all([
    hasGc ? supabase.from('customers').select('name').eq('id', job.gc_customer_id as string).maybeSingle() : Promise.resolve({ data: null }),
    job.customer_address_id
      ? supabase.from('customer_addresses').select('id, address, owner_name, owner_company, owner_mailing_address, owner_confirmed_at, parcel_source, parcel_tax_year').eq('id', job.customer_address_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('job_property_owners').select('mailing_address').eq('job_id', jobId).maybeSingle(),
  ])
  const gcName = ((gcRes.data as { name?: string | null } | null)?.name ?? '').trim()
  const record = (recordRes.data as Facts['record']) ?? null
  const override = overrideRes.data as { mailing_address?: string | null } | null
  const show = shouldShowBillCustomerOwnerLine({ hasGc, customerIsBuilder, hasJobOwnerOverride: Boolean((override?.mailing_address ?? '').trim()), record })
  return { job, gcName, record, show }
}

export default function BillCustomerOwnerLine({ jobId, userId }: { jobId: string; userId: string | null }) {
  const { showToast } = useToastContext()
  const [facts, setFacts] = useState<Facts | null>(null)
  const [lookup, setLookup] = useState<PropertyLookupOutcome | null>(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteDraft, setPasteDraft] = useState<PropertyRecordDraft>(() => emptyPropertyDraft(''))

  useEffect(() => {
    let cancelled = false
    setFacts(null)
    setLookup(null)
    setSaved(null)
    setPasteOpen(false)
    void (async () => {
      try {
        const f = await loadFacts(jobId)
        if (cancelled) return
        setFacts(f)
        if (!f?.show) return
        const address = (f.job.job_address ?? '').trim()
        // An unconfirmed owner already on the record needs no lookup — Confirm, not Use.
        if (ownerFromRollUnconfirmed(f.record) || !address) return
        const hit = getCachedPropertyLookup(address)
        if (hit) {
          setLookup(hit)
          return
        }
        const res = await cachedLookupPropertyRecord(address)
        if (!cancelled) setLookup(res)
      } catch {
        // The line is a courtesy; a failed read shows nothing.
        if (!cancelled) setFacts(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [jobId])

  if (!facts?.show) return null
  const address = (facts.job.job_address ?? '').trim()
  const street = address.split(',')[0]?.trim() || address

  if (saved) {
    return (
      <div style={{ ...line, color: 'var(--text-green-800)' }} data-testid="bill-customer-owner-line" data-state="saved">
        ✓ Owner of record for {street}: {saved} — on the job.
      </div>
    )
  }

  const save = async (source: OwnerConfirmSource, label: string) => {
    if (busy) return
    setBusy(true)
    try {
      await confirmOwnerForProperty({
        address,
        jobs: [{ jobId: facts.job.id, customerId: facts.job.customer_id, gcCustomerId: facts.job.gc_customer_id, customerAddressId: facts.job.customer_address_id }],
        source,
        userId,
      })
      setSaved(label)
      setPasteOpen(false)
      showToast(`Owner of record saved on ${street}.`, 'success')
    } catch (e) {
      showToast(`Could not save the owner: ${e instanceof Error ? e.message : 'write failed'}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  // ---------- from the roll · unconfirmed (the nightly save): Confirm ----------
  if (facts.record && ownerFromRollUnconfirmed(facts.record)) {
    const r = facts.record
    const label = titleCaseUpperWords((r.owner_company ?? '').trim() || (r.owner_name ?? '').trim())
    const confirm = async () => {
      if (busy) return
      setBusy(true)
      try {
        await stampOwnerConfirmed(r.id, userId)
        setSaved(label)
        showToast(`Owner of record confirmed on ${street}.`, 'success')
      } catch (e) {
        showToast(`Could not confirm the owner: ${e instanceof Error ? e.message : 'write failed'}`, 'error')
      } finally {
        setBusy(false)
      }
    }
    return (
      <div style={{ ...line, color: 'var(--text-green-800)' }} data-testid="bill-customer-owner-line" data-state="unconfirmed">
        <span>
          Owner of record for {street}: <strong>{label}</strong> — from the roll{(r as { parcel_tax_year?: string | null }).parcel_tax_year ? ` (${(r as { parcel_tax_year?: string | null }).parcel_tax_year})` : ''}, not yet confirmed.{' '}
          <strong>Confirm</strong> it so the lien notice can be mailed when it is due.
        </span>
        <button type="button" style={useBtn} disabled={busy} onClick={() => void confirm()} data-testid="bill-customer-owner-confirm">
          {busy ? 'Confirming…' : 'Confirm'}
        </button>
      </div>
    )
  }

  // ---------- the roll's answer: Use ----------
  const l = lookup
  if (!l) return null
  const proposal = l.ok ? l.proposal : null
  if (proposal?.found && l.ok) {
    const owner = titleCaseUpperWords(proposal.ownerCompany || proposal.ownerName)
    const prov = rollProvenanceShort(l.parcel)
    return (
      <div style={{ ...line, color: 'var(--text-green-800)' }} data-testid="bill-customer-owner-line" data-state="found">
        <span>
          Owner of record for {street}: <strong>{owner}</strong>
          {prov ? ` (${prov})` : ''} — not yet on the job. <strong>Use</strong> it so the lien notice can be mailed when it is due.
        </span>
        <button type="button" style={useBtn} disabled={busy || !proposal.ownerMailingAddress} onClick={() => void save({ kind: 'proposal', proposal }, owner)} data-testid="bill-customer-owner-use" title={proposal.ownerMailingAddress ? 'Save this owner on the property record and link the job' : 'The roll has no mailing address for this owner — paste the county page instead'}>
          {busy ? 'Saving…' : 'Use'}
        </button>
      </div>
    )
  }

  // ---------- a miss: the paste box ----------
  const openPaste = () => {
    let draft: PropertyRecordDraft = emptyPropertyDraft(address)
    if (l.ok) draft = { ...applyProposalToFields(draft, l.proposal, 'fill-blanks'), parcel_looked_up_at: new Date().toISOString() }
    setPasteDraft(draft)
    setPasteOpen(true)
  }
  return (
    <div data-testid="bill-customer-owner-line" data-state="miss">
      <div style={{ ...line, color: 'var(--text-amber-700)' }}>
        <span>
          No owner of record on file for {street}
          {l.ok ? '' : ` (${propertyLookupErrorMessage(l.error)})`} —{' '}
          <button type="button" style={linkBtn} onClick={() => (pasteOpen ? setPasteOpen(false) : openPaste())} aria-expanded={pasteOpen} data-testid="bill-customer-owner-paste-door">
            {pasteOpen ? 'hide the paste box' : "paste the county's page…"}
          </button>{' '}
          so the lien notice can be mailed when it is due.
        </span>
      </div>
      {pasteOpen ? (
        <div style={{ marginTop: '0.4rem', borderTop: '1px dashed var(--border)', paddingTop: '0.5rem' }} data-testid="bill-customer-owner-paste-panel">
          <CustomerPropertyRecordPanel address={address} fields={pasteDraft} onChange={(patch) => setPasteDraft((d) => ({ ...d, ...patch }))} compact />
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button type="button" style={smallBtn} onClick={() => setPasteOpen(false)} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              style={{ ...smallBtn, background: 'var(--text-link)', color: '#fff', border: '1px solid transparent' }}
              onClick={() => void save({ kind: 'record', record: pasteDraft }, titleCaseUpperWords(pasteDraft.owner_company.trim() || pasteDraft.owner_name.trim()))}
              disabled={busy || !draftHasOwner(pasteDraft)}
              title={draftHasOwner(pasteDraft) ? undefined : 'Needs an owner of record and a mailing address'}
            >
              {busy ? 'Saving…' : `Save the owner on ${street}`}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
