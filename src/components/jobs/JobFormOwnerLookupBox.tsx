import { useEffect, useState, type CSSProperties } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import CustomerPropertyRecordPanel, { type PropertyRecordDraft } from '../customers/CustomerPropertyRecordPanel'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { txCountyCadPropertyUrl, txCountyCadSearchUrl } from '../../lib/txCountyLookup'
import { propertyLookupErrorMessage, type PropertyLookupOutcome } from '../../lib/customers/propertyLookupClient'
import { emptyPropertyDraft } from '../../lib/customers/propertyDraft'
import { applyProposalToFields, parcelProvenanceLine, titleCaseUpperWords } from '../../lib/customers/propertyRecord'
import { HOMESTEAD_LINE, jobFormOwnerLookupApplies, propertyKey, readsAs, type ReadsAsChip, careOfLine } from '../../lib/jobs/ownerConfirm'
import { confirmOwnerForProperty, type OwnerConfirmSource } from '../../lib/jobs/ownerConfirmWrite'
import { fetchCustomerAddressRow, fetchIsBuilderCustomer, fetchJobsAtProperty, lookupPropertyRecordCached } from '../../lib/jobs/ownerConfirmJobFormClient'
import type { CustomerAddressRow } from '../../lib/jobs/lienProperty'

/**
 * Owner of record · the Property record row that fills itself (PR 2 of the
 * train; the list is v2.3447). On a GC job — or a builder in the customer row
 * — with an address and no confirmed owner, the row runs the parcel lookup
 * by itself (once per property, cached for the session) and shows *Found on
 * the appraisal roll*: owner, mailing address, legal + provenance, county,
 * the reads-as chips, and **Use — save the owner on <street>**, which calls
 * the shared `confirmOwnerForProperty` for this job and every job at the
 * address. *Not right — paste the CAD page…* unfolds the property record
 * panel's paste box; a miss offers only the paste. When `homesteadHint`
 * says likely the box adds `HOMESTEAD_LINE` in red with the CAD link beside
 * it (decision 3). A direct job renders nothing; so does a confirmed row.
 */

type Props = {
  /** The saved job; null (an unsaved form) renders nothing — there is no row to link yet. */
  jobId: string | null
  jobAddress: string
  customerId: string | null
  customerName: string
  gcCustomerId: string | null
  gcCustomerName: string
  customerAddressId: string | null
  /** `owner_confirmed_at` of the linked row when the parent knows it; undefined = the box loads it. */
  linkedOwnerConfirmedAt?: string | null
  /** After Use / Save: the confirmed (or new) row — the parent links the job to it and refreshes its candidates. */
  onConfirmed: (row: CustomerAddressRow) => void
  /** Wrapper style when the box renders (the fact row's indent, the prompt's gap). */
  style?: CSSProperties
}

const btn: CSSProperties = { padding: '0.4rem 0.9rem', fontSize: '0.8125rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer', fontWeight: 600, font: 'inherit' }
const btnPrimary: CSSProperties = { ...btn, background: '#2563eb', color: 'white', border: '1px solid #2563eb' }
const linkBtn: CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '0.75rem', color: 'var(--text-link)', fontWeight: 600, font: 'inherit' }
const faint: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }

function chipStyle(tone: ReadsAsChip['tone']): CSSProperties {
  const base: CSSProperties = { fontSize: '0.6875rem', fontWeight: 700, borderRadius: 6, padding: '0.05rem 0.45rem', whiteSpace: 'nowrap' }
  if (tone === 'red') return { ...base, color: 'var(--text-red-700)', background: 'var(--bg-red-tint)', border: '1px solid var(--border-red)' }
  if (tone === 'amber') return { ...base, color: 'var(--text-amber-700)', background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber)' }
  return { ...base, color: 'var(--text-muted)', background: 'var(--bg-muted)', border: '1px solid var(--border)' }
}

function draftHasOwner(d: PropertyRecordDraft): boolean {
  return (d.owner_name.trim() !== '' || d.owner_company.trim() !== '') && d.owner_mailing_address.trim() !== ''
}

function streetOf(address: string): string {
  return (address.split(',')[0] ?? address).trim() || address
}

export default function JobFormOwnerLookupBox({ jobId, jobAddress, customerId, customerName, gcCustomerId, gcCustomerName, customerAddressId, linkedOwnerConfirmedAt, onConfirmed, style }: Props) {
  const { user } = useAuth()
  const { showToast } = useToastContext()
  const [builder, setBuilder] = useState<boolean | null>(null)
  const [loadedConfirmedAt, setLoadedConfirmedAt] = useState<{ id: string; at: string | null } | null>(null)
  const [lookup, setLookup] = useState<{ key: string; outcome: PropertyLookupOutcome } | null>(null)
  const [busy, setBusy] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteDraft, setPasteDraft] = useState<PropertyRecordDraft>(() => emptyPropertyDraft(''))

  const address = jobAddress.trim()
  const key = propertyKey(address)

  // A builder in the customer row with no GC: one head count, cached.
  useEffect(() => {
    if (gcCustomerId || !customerId) {
      setBuilder(false)
      return
    }
    let cancelled = false
    setBuilder(null)
    void fetchIsBuilderCustomer(customerId).then((b) => {
      if (!cancelled) setBuilder(b)
    })
    return () => {
      cancelled = true
    }
  }, [customerId, gcCustomerId])

  // The linked row's confirmed stamp when the parent does not carry it.
  useEffect(() => {
    if (linkedOwnerConfirmedAt !== undefined || !customerAddressId) return
    let cancelled = false
    void fetchCustomerAddressRow(customerAddressId).then((row) => {
      if (!cancelled) setLoadedConfirmedAt({ id: customerAddressId, at: row?.owner_confirmed_at ?? null })
    })
    return () => {
      cancelled = true
    }
  }, [customerAddressId, linkedOwnerConfirmedAt])

  const confirmedAt: string | null | undefined =
    linkedOwnerConfirmedAt !== undefined ? linkedOwnerConfirmedAt : !customerAddressId ? null : loadedConfirmedAt?.id === customerAddressId ? loadedConfirmedAt.at : undefined

  const applies =
    Boolean(jobId) &&
    builder !== null &&
    confirmedAt !== undefined &&
    jobFormOwnerLookupApplies({
      gcCustomerId,
      customerId,
      customerIsBuilder: builder === true,
      jobAddress: address,
      hasLinkedRow: Boolean(customerAddressId),
      linkedOwnerConfirmed: Boolean(confirmedAt),
    })

  // The lookup: once per property key, only when the box applies.
  useEffect(() => {
    if (!applies || !key) return
    if (lookup?.key === key) return
    let cancelled = false
    void lookupPropertyRecordCached(address).then((outcome) => {
      if (!cancelled) setLookup({ key, outcome })
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applies, key])

  if (!applies || !jobId) return null

  const outcome = lookup?.key === key ? lookup.outcome : null
  const proposal = outcome?.ok ? outcome.proposal : null
  const parcel = outcome?.ok ? outcome.parcel : null
  const found = Boolean(proposal?.found)
  const chips = found ? readsAs({ jobAddress: address, customerName, gcName: gcCustomerName, gcCustomerId }, parcel) : []
  const county = proposal?.county.county ?? ''
  const propId = proposal?.provenance?.propId ?? ''
  const cadUrl = txCountyCadPropertyUrl(county, propId) || txCountyCadSearchUrl(county)
  const provenance = proposal?.provenance ? parcelProvenanceLine({ parcel_source: proposal.provenance.source, parcel_tax_year: proposal.provenance.taxYear, parcel_id: '' }) : ''
  const ownerLabel = proposal ? titleCaseUpperWords(proposal.ownerCompany || proposal.ownerName) : ''
  const homestead = chips.some((c) => c.key === 'homestead')
  const street = streetOf(address)

  const cadLink = cadUrl ? (
    <button type="button" style={linkBtn} onClick={() => openInExternalBrowser(cadUrl)} title={propId ? `Open this parcel (Prop ID ${propId}) on the ${county} County Appraisal District` : `Open the ${county} County Appraisal District property search`}>
      {propId ? `this parcel on ${county} CAD ↗` : `${county} CAD ↗`}
    </button>
  ) : null

  async function save(source: OwnerConfirmSource, label: string) {
    if (busy || !jobId) return
    setBusy(true)
    try {
      const self = { jobId, customerId, gcCustomerId, customerAddressId }
      const jobs = await fetchJobsAtProperty(address, self)
      const res = await confirmOwnerForProperty({ address, jobs, source, userId: user?.id ?? null })
      const mine = res.inserted.find((i) => i.jobIds.includes(jobId))?.customerAddressId ?? (customerAddressId && res.updated.includes(customerAddressId) ? customerAddressId : null) ?? res.inserted[0]?.customerAddressId ?? res.updated[0] ?? null
      if (!mine) throw new Error('nothing to save to — link a customer or a GC first')
      const row = await fetchCustomerAddressRow(mine)
      if (!row) throw new Error('the saved property could not be read back')
      const covered = jobs.length
      showToast(`Owner of record saved on ${street} — ${label}${covered > 1 ? ` · ${covered} jobs covered` : ''}`, 'success')
      setPasteOpen(false)
      onConfirmed(row)
    } catch (e) {
      showToast(`Could not save the owner on ${street}: ${e instanceof Error ? e.message : 'write failed'}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  function openPaste() {
    let draft: PropertyRecordDraft = emptyPropertyDraft(address)
    if (outcome?.ok) draft = { ...applyProposalToFields(draft, outcome.proposal, 'fill-blanks'), parcel_looked_up_at: new Date().toISOString() }
    setPasteDraft(draft)
    setPasteOpen(true)
  }

  const pasteDoor = (label: string) => (
    <button type="button" style={linkBtn} onClick={() => (pasteOpen ? setPasteOpen(false) : openPaste())} aria-expanded={pasteOpen} data-testid="owner-lookup-paste-door">
      {pasteOpen ? 'Hide the paste' : label}
    </button>
  )

  const pastePanel = pasteOpen ? (
    <div style={{ marginTop: '0.4rem', borderTop: '1px dashed var(--border)', paddingTop: '0.5rem' }} data-testid="owner-lookup-paste-panel">
      <CustomerPropertyRecordPanel address={address} fields={pasteDraft} onChange={(patch) => setPasteDraft((d) => ({ ...d, ...patch }))} compact />
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
        <button type="button" style={btn} onClick={() => setPasteOpen(false)} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          style={btnPrimary}
          disabled={busy || !draftHasOwner(pasteDraft)}
          title={draftHasOwner(pasteDraft) ? undefined : 'Needs an owner of record and a mailing address'}
          onClick={() => void save({ kind: 'record', record: pasteDraft }, titleCaseUpperWords(pasteDraft.owner_company.trim() || pasteDraft.owner_name.trim()))}
        >
          {busy ? 'Saving…' : `Save the owner on ${street}`}
        </button>
      </div>
    </div>
  ) : null

  const state = !outcome ? 'pending' : found ? 'found' : 'miss'

  return (
    <div style={style} data-testid="owner-lookup-box" data-state={state}>
      {state === 'pending' ? (
        <div style={faint} aria-live="polite">
          Looking {street} up on the appraisal roll…
        </div>
      ) : state === 'found' && proposal ? (
        <div style={{ border: '1px solid var(--border-green)', background: 'var(--bg-green-tint)', borderRadius: 8, padding: '0.55rem 0.7rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-green-700)' }}>Found on the appraisal roll · from the job address</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: '0.6rem', rowGap: '0.15rem', fontSize: '0.8125rem' }}>
            <span style={faint}>Owner of record</span>
            <span style={{ fontWeight: 600, color: 'var(--text-strong)' }} data-testid="owner-lookup-owner">
              {ownerLabel}
              {careOfLine(parcel) ? <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> · {titleCaseUpperWords(careOfLine(parcel))}</span> : null}
            </span>
            <span style={faint}>Mail to</span>
            <span>{proposal.ownerMailingAddress ? titleCaseUpperWords(proposal.ownerMailingAddress) : <span style={{ color: 'var(--text-amber-700)' }}>No mailing address on the roll</span>}</span>
            {proposal.legalDescription ? (
              <>
                <span style={faint}>Legal</span>
                <span>
                  {proposal.legalDescription}
                  {provenance ? <span style={{ color: 'var(--text-faint)', fontSize: '0.6875rem' }}> · {provenance}</span> : null}
                </span>
              </>
            ) : null}
            {county ? (
              <>
                <span style={faint}>County</span>
                <span>{county}</span>
              </>
            ) : null}
          </div>
          {chips.length > 0 ? (
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {chips.map((c) => (
                <span key={c.key} style={chipStyle(c.tone)} data-chip={c.key}>
                  {c.label}
                </span>
              ))}
            </div>
          ) : null}
          {homestead ? (
            <div style={{ ...faint, color: 'var(--text-red-700)' }} data-testid="owner-lookup-homestead">
              {HOMESTEAD_LINE} {cadLink}
            </div>
          ) : null}
          {chips.some((c) => c.key === 'public') ? (
            <div style={{ ...faint, color: 'var(--text-red-700)' }}>A mechanic's lien does not attach to public property — the remedy is a claim on the GC's payment bond. Use saves the owner so the desk knows.</div>
          ) : null}
          <div style={{ display: 'flex', gap: '0.7rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.15rem' }}>
            <button type="button" style={btnPrimary} disabled={busy} onClick={() => void save({ kind: 'proposal', proposal }, ownerLabel)} data-testid="owner-lookup-use">
              {busy ? 'Saving…' : `Use — save the owner on ${street}`}
            </button>
            {pasteDoor('Not right — paste the CAD page…')}
            {!homestead ? cadLink : null}
          </div>
          {pastePanel}
        </div>
      ) : (
        <div style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 8, padding: '0.5rem 0.7rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-amber-700)' }}>
              {outcome && !outcome.ok ? propertyLookupErrorMessage(outcome.error) : 'No parcel under the pin'}
              {outcome?.ok && outcome.parcelError ? ` (${outcome.parcelError})` : ''}
              {county ? ` · County ${county}` : ''}
            </span>
            {pasteDoor('— paste the CAD page…')}
            {cadLink}
          </div>
          {pastePanel}
        </div>
      )}
    </div>
  )
}
