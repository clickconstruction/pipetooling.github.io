import { useEffect, useState, type CSSProperties } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { txCountyCadPropertyUrl, txCountyCadSearchUrl } from '../../lib/txCountyLookup'
import { propertyLookupErrorMessage, type PropertyLookupOutcome } from '../../lib/customers/propertyLookupClient'
import { cachedLookupPropertyRecord, getCachedPropertyLookup } from '../../lib/customers/propertyLookupCache'
import { titleCaseUpperWords } from '../../lib/customers/propertyRecord'
import { careOfLine, ownerFromRollUnconfirmed, ownerKind, readsAs, rollProvenanceShort, type ReadsAsChip } from '../../lib/jobs/ownerConfirm'
import { rollMailingLines } from '../../lib/jobs/rollMailingLines'
import { confirmOwnerForProperty, stampOwnerConfirmed } from '../../lib/jobs/ownerConfirmWrite'
import { PUBLIC_OWNER_DESK_SENTENCE } from '../../lib/jobs/lienDesk'
import type { CustomerAddressRow, LienPropertyOwner } from '../../lib/jobs/lienProperty'
import type { LienDeskJob } from '../../hooks/useLienDeskData'

/**
 * The Lien desk's owner line reads the appraisal roll (owner of record, PR 3
 * — v2.3450). Three shapes:
 *
 * - **No owner on the record** → the roll's answer with its provenance, the
 *   reads-as chips and **Use** (the same `confirmOwnerForProperty` write the
 *   Fix-ups list runs), the *Find the owner ›* door kept as the fallback; a
 *   miss shows the door alone.
 * - **Owner from the roll · unconfirmed** (the nightly save) → *Owner from the
 *   roll (2025) · confirm on <County> CAD ↗* and **Confirm**, which stamps
 *   `owner_confirmed_*`. The desk drafts on it; Record the run refuses until
 *   the stamp is there.
 * - **Public owner** (a city, county, ISD, the State) → the bond-claim
 *   sentence; the modal's readiness kernel keeps the item undraftable.
 */

type Props = {
  job: LienDeskJob | undefined
  jobId: string
  gcName: string
  gcCustomerId: string | null
  address: CustomerAddressRow | null
  owner: LienPropertyOwner
  /** The display name the pane's parent already resolved ('' when none). */
  ownerName: string
  userId: string | null
  onChanged: () => void
  onOpenEditJob: (jobId: string) => void
}

const btnPlain: CSSProperties = { padding: '1px 8px', fontSize: '0.72rem', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }
const btnPrimary: CSSProperties = { ...btnPlain, background: '#2563eb', color: '#fff', border: '1px solid transparent', padding: '2px 10px', fontSize: '0.78rem' }
const linkBtn: CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '0.72rem', color: 'var(--text-link)', fontWeight: 600 }
const faint: CSSProperties = { fontSize: '0.72rem', color: 'var(--text-muted)' }

function chipStyle(tone: ReadsAsChip['tone']): CSSProperties {
  const base: CSSProperties = { fontSize: '0.65rem', fontWeight: 700, borderRadius: 6, padding: '0 0.4rem', whiteSpace: 'nowrap', lineHeight: '16px' }
  if (tone === 'red') return { ...base, color: 'var(--text-red-700)', background: 'var(--bg-red-tint)', border: '1px solid var(--border-red)' }
  if (tone === 'amber') return { ...base, color: 'var(--text-amber-700)', background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber)' }
  return { ...base, color: 'var(--text-700)', background: 'var(--bg-muted)', border: '1px solid var(--border)' }
}

function ownerText(l: PropertyLookupOutcome): string {
  if (!l.ok) return ''
  return titleCaseUpperWords(l.proposal.ownerCompany || l.proposal.ownerName)
}

export default function LienDeskOwnerPane({ job, jobId, gcName, gcCustomerId, address, owner, ownerName, userId, onChanged, onOpenEditJob }: Props) {
  const { showToast } = useToastContext()
  const jobAddress = (job?.job_address ?? '').trim()
  const hasOwner = Boolean(ownerName && owner.mailingAddress)
  const [lookup, setLookup] = useState<PropertyLookupOutcome | null>(() => (jobAddress ? getCachedPropertyLookup(jobAddress) ?? null : null))
  const [busy, setBusy] = useState(false)

  // Only an ownerless item asks the roll; the answer is cached per property for the session.
  useEffect(() => {
    if (hasOwner || !jobAddress) return
    let cancelled = false
    const hit = getCachedPropertyLookup(jobAddress)
    if (hit) {
      setLookup(hit)
      return
    }
    setLookup(null)
    void cachedLookupPropertyRecord(jobAddress).then((res) => {
      if (!cancelled) setLookup(res)
    })
    return () => {
      cancelled = true
    }
  }, [hasOwner, jobAddress])

  const door = (
    <button type="button" onClick={() => onOpenEditJob(jobId)} style={btnPlain} title="Edit Job → Property record: link or add the property, then its owner of record">
      Find the owner ›
    </button>
  )

  // ---------- owner on the record ----------
  if (hasOwner) {
    const isPublic = ownerKind(ownerName) === 'public'
    const unconfirmed = owner.source === 'property_record' && ownerFromRollUnconfirmed(address)
    if (!isPublic && !unconfirmed) return null
    const county = (address?.county ?? '').trim()
    const cadUrl = txCountyCadPropertyUrl(county, (address?.parcel_id ?? '').trim()) || txCountyCadSearchUrl(county)
    const year = (address?.parcel_tax_year ?? '').trim()
    const confirm = async () => {
      if (!address || busy) return
      setBusy(true)
      try {
        await stampOwnerConfirmed(address.id, userId)
        showToast(`Owner of record confirmed on ${address.address}.`, 'success')
        onChanged()
      } catch (e) {
        showToast(`Could not confirm the owner: ${e instanceof Error ? e.message : 'write failed'}`, 'error')
      } finally {
        setBusy(false)
      }
    }
    return (
      <div style={{ display: 'grid', gap: '0.25rem' }} data-testid="lien-desk-owner-pane" data-state={isPublic ? 'public' : 'unconfirmed'}>
        {isPublic ? <div style={{ fontSize: '0.78rem', color: 'var(--text-red-700)' }}>{PUBLIC_OWNER_DESK_SENTENCE}</div> : null}
        {unconfirmed ? (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ ...faint, color: 'var(--text-amber-700)' }}>
              Owner from the roll{year ? ` (${year})` : ''} · unconfirmed
              {cadUrl ? (
                <>
                  {' · '}
                  <button type="button" style={linkBtn} onClick={() => openInExternalBrowser(cadUrl)} title={`Check this owner on the ${county || 'county'} appraisal district site before the notice goes out`}>
                    confirm on {county || 'the county'} CAD ↗
                  </button>
                </>
              ) : null}
            </span>
            <button type="button" style={btnPrimary} disabled={busy || !address} onClick={() => void confirm()} data-testid="lien-desk-owner-confirm" title="A person looked at the roll's answer — stamp it confirmed so the run can go out">
              {busy ? 'Confirming…' : 'Confirm'}
            </button>
          </div>
        ) : null}
      </div>
    )
  }

  // ---------- no owner: the roll's answer, or the door ----------
  const l = lookup
  const proposal = l?.ok ? l.proposal : null
  const parcel = l?.ok ? l.parcel : null
  const found = Boolean(proposal?.found)
  const mailing = rollMailingLines(proposal?.ownerMailingAddress)
  const chips = found && job ? readsAs({ jobAddress, customerName: (job.customer_name ?? '').trim(), gcName, gcCustomerId, propertyKind: (address?.property_kind ?? '').trim() }, parcel) : []
  const isPublic = chips.some((c) => c.key === 'public')
  const county = proposal?.county.county ?? ''
  const propId = proposal?.provenance?.propId ?? ''
  const cadUrl = txCountyCadPropertyUrl(county, propId) || txCountyCadSearchUrl(county)

  const use = async () => {
    if (!proposal?.found || !job || busy) return
    setBusy(true)
    try {
      await confirmOwnerForProperty({
        address: jobAddress,
        jobs: [{ jobId, customerId: job.customer_id, gcCustomerId: job.gc_customer_id, customerAddressId: job.customer_address_id }],
        source: { kind: 'proposal', proposal },
        userId,
      })
      showToast(`Owner of record saved on ${jobAddress}.`, 'success')
      onChanged()
    } catch (e) {
      showToast(`Could not save the owner: ${e instanceof Error ? e.message : 'write failed'}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: '0.25rem' }} data-testid="lien-desk-owner-pane" data-state={!l ? 'pending' : found ? 'found' : 'miss'}>
      {!jobAddress ? (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={faint}>No job address to look up.</span>
          {door}
        </div>
      ) : !l ? (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={faint}>Looking the property up on the appraisal roll…</span>
          {door}
        </div>
      ) : found && proposal && l.ok ? (
        <>
          {/* The roll's answer as an envelope (v2.3658): owner, c/o, street, city each on a line — the way the certified-mail label will read — with the provenance and the CAD door in one caption and the actions beside the address. */}
          <div className="lienOwnerRoll" data-lien-owner-roll>
            <div className="lienOwnerRollCaption">
              {/* The source is the fact worth the weight (v2.3690): "Found at:" quiet, the district and year bold. */}
              <span>Found at:</span>
              {rollProvenanceShort(parcel) ? <strong data-lien-owner-roll-source>{rollProvenanceShort(parcel)}</strong> : <strong>the appraisal roll</strong>}
              {cadUrl ? (
                <button type="button" style={{ ...linkBtn, marginLeft: 'auto' }} onClick={() => openInExternalBrowser(cadUrl)} title={propId ? `Open this parcel (Prop ID ${propId}) on the ${county} County Appraisal District` : `Open the ${county} County Appraisal District property search`}>
                  {propId ? `Check this parcel on ${county} CAD ↗` : `${county} CAD ↗`}
                </button>
              ) : null}
            </div>
            <div className="lienOwnerRollBody">
              <address className="lienOwnerRollAddress" data-lien-owner-address>
                <strong>{ownerText(l)}</strong>
                {mailing.careOf || careOfLine(parcel) ? <span className="lienOwnerRollCareOf">c/o {mailing.careOf || titleCaseUpperWords(careOfLine(parcel))}</span> : null}
                {mailing.lines.length ? mailing.lines.map((line) => <span key={line}>{line}</span>) : <span style={{ color: 'var(--text-amber-700)' }}>No mailing address on the roll</span>}
              </address>
              <div className="lienOwnerRollActions">
                <button type="button" style={btnPrimary} disabled={busy || !proposal.ownerMailingAddress} onClick={() => void use()} data-testid="lien-desk-owner-use" title="Save this owner on the property record and link the job — the same Use as the Fix-ups list">
                  {busy ? 'Saving…' : 'Use this owner'}
                </button>
                {door}
              </div>
            </div>
            {chips.length ? (
              <div className="lienOwnerRollNotes">
                {chips.map((c) =>
                  c.key === 'mail-elsewhere' ? (
                    <span key={c.key} data-chip={c.key}>
                      ✉ Mail goes somewhere other than the house — check the roll is current; the owner may have moved.
                    </span>
                  ) : (
                    <span key={c.key} style={chipStyle(c.tone)} data-chip={c.key}>
                      {c.label}
                    </span>
                  ),
                )}
              </div>
            ) : null}
          </div>
          {isPublic ? <div style={{ fontSize: '0.78rem', color: 'var(--text-red-700)' }}>{PUBLIC_OWNER_DESK_SENTENCE}</div> : null}
        </>
      ) : (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ ...faint, color: 'var(--text-amber-700)' }}>
            {l.ok ? 'No parcel under the pin on the appraisal roll' : propertyLookupErrorMessage(l.error)}
            {l.ok && county ? ` · County ${county}` : ''} — paste the county's page on the property record.
          </span>
          {door}
        </div>
      )}
    </div>
  )
}
