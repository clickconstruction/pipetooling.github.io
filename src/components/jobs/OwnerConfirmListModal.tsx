import { useEffect, useRef, useState, type CSSProperties } from 'react'
import ResponsiveModalShell from '../ResponsiveModalShell'
import CustomerPropertyRecordPanel, { type PropertyRecordDraft } from '../customers/CustomerPropertyRecordPanel'
import { useToastContext } from '../../contexts/ToastContext'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { txCountyCadPropertyUrl, txCountyCadSearchUrl } from '../../lib/txCountyLookup'
import { propertyLookupErrorMessage, type PropertyLookupOutcome } from '../../lib/customers/propertyLookupClient'
import { cachedLookupPropertyRecord, getCachedPropertyLookup, resetPropertyLookupCache } from '../../lib/customers/propertyLookupCache'
import { emptyPropertyDraft } from '../../lib/customers/propertyDraft'
import { applyProposalToFields, parcelProvenanceLine, titleCaseUpperWords } from '../../lib/customers/propertyRecord'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import {
  careOfLine,
  HOMESTEAD_LINE,
  builderName,
  groupByProperty,
  readsAs,
  eligibleForUseAll,
  type OwnerConfirmProperty,
  type OwnerToConfirmRow,
  type ReadsAsChip,
} from '../../lib/jobs/ownerConfirm'
import { confirmOwnerForProperty, type OwnerConfirmSource } from '../../lib/jobs/ownerConfirmWrite'
import { todayYmdInAppTz } from '../../utils/dateUtils'

/**
 * Owner of record · the Fix-ups list that looks itself up (v2.3447).
 *
 * Opens from the Pipeline's "Owner of record to confirm · N" chip with every
 * GC job that has approved hours and no confirmed owner, grouped by property
 * and sorted by the first § 53.056 deadline. As it opens it runs the parcel
 * lookup on each property (sequentially, with a progress line; results are
 * cached for the session) and shows the roll's answer on the row — owner,
 * mailing address, provenance, and what it *reads as* (public owner, landlord,
 * likely homestead). **Use** confirms one property; **Use all N found** takes
 * every found row except a public owner. A miss shows the property record
 * panel's paste box under the row. A saved row turns green and stays for the
 * sitting so the office sees its progress; the chip's count refreshes after
 * each save.
 */

type Props = {
  open: boolean
  onClose: () => void
  rows: OwnerToConfirmRow[]
  /** Called after every successful save — the parent reloads the count. */
  onSaved: () => void | Promise<void>
  userId: string | null
}

/** Test seam: clear the session lookup cache (shared with Bill Customer and the Lien desk since v2.3450). */
export function resetOwnerConfirmLookupCache(): void {
  resetPropertyLookupCache()
}

const btn: CSSProperties = { padding: '0.4rem 0.9rem', fontSize: '0.8125rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer', fontWeight: 600 }
const btnPrimary: CSSProperties = { ...btn, background: '#2563eb', color: 'white', border: '1px solid #2563eb' }
const linkBtn: CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '0.75rem', color: 'var(--text-link)', fontWeight: 600 }
const faint: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }

function chipStyle(tone: ReadsAsChip['tone']): CSSProperties {
  const base: CSSProperties = { fontSize: '0.6875rem', fontWeight: 700, borderRadius: 6, padding: '0.05rem 0.45rem', whiteSpace: 'nowrap' }
  if (tone === 'red') return { ...base, color: 'var(--text-red-700)', background: 'var(--bg-red-tint)', border: '1px solid var(--border-red)' }
  if (tone === 'amber') return { ...base, color: 'var(--text-amber-700)', background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber)' }
  return { ...base, color: 'var(--text-muted)', background: 'var(--bg-muted)', border: '1px solid var(--border)' }
}

function jobLabel(j: OwnerToConfirmRow): string {
  const n = effectiveJobLedgerNumber(j.hcpNumber, j.clickNumber)
  return n && n !== '—' ? `J${n.replace(/^J/i, '')}` : '—'
}

function draftHasOwner(d: PropertyRecordDraft): boolean {
  return (d.owner_name.trim() !== '' || d.owner_company.trim() !== '') && d.owner_mailing_address.trim() !== ''
}

export default function OwnerConfirmListModal({ open, onClose, rows, onSaved, userId }: Props) {
  const { showToast } = useToastContext()
  const [sitting, setSitting] = useState<OwnerConfirmProperty[]>([])
  const [lookups, setLookups] = useState<Record<string, PropertyLookupOutcome>>({})
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [saved, setSaved] = useState<Record<string, string>>({})
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [busyAll, setBusyAll] = useState<{ done: number; total: number } | null>(null)
  const [pasteKey, setPasteKey] = useState<string | null>(null)
  const [pasteDraft, setPasteDraft] = useState<PropertyRecordDraft>(() => emptyPropertyDraft(''))
  const rowsRef = useRef(rows)
  rowsRef.current = rows
  const cancelRef = useRef(false)

  // On open: snapshot the sitting (rows never leave mid-sitting) and look every property up.
  useEffect(() => {
    if (!open) {
      cancelRef.current = true
      return
    }
    cancelRef.current = false
    const props = groupByProperty(rowsRef.current, todayYmdInAppTz())
    setSitting(props)
    setSaved({})
    setPasteKey(null)
    setBusyKey(null)
    setBusyAll(null)
    const seeded: Record<string, PropertyLookupOutcome> = {}
    for (const p of props) {
      const hit = getCachedPropertyLookup(p.address)
      if (hit) seeded[p.key] = hit
    }
    setLookups(seeded)
    const todo = props.filter((p) => !getCachedPropertyLookup(p.address))
    if (todo.length === 0) {
      setProgress(null)
      return
    }
    setProgress({ done: 0, total: todo.length })
    void (async () => {
      let done = 0
      for (const p of todo) {
        if (cancelRef.current) return
        // Only a real answer (found, or a clean miss) is remembered; a network error retries next open.
        const res = await cachedLookupPropertyRecord(p.address)
        if (cancelRef.current) return
        done += 1
        setLookups((prev) => ({ ...prev, [p.key]: res }))
        setProgress({ done, total: todo.length })
      }
      setProgress(null)
    })()
    return () => {
      cancelRef.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  const totalJobs = sitting.reduce((n, p) => n + p.jobs.length, 0)
  const found = sitting.filter((p) => {
    const l = lookups[p.key]
    return l?.ok && l.proposal.found
  })
  const missed = sitting.filter((p) => {
    const l = lookups[p.key]
    return l && !(l.ok && l.proposal.found) && !saved[p.key]
  })
  const savedJobs = sitting.filter((p) => saved[p.key]).reduce((n, p) => n + p.jobs.length, 0)
  const eligible = found.filter((p) => {
    if (saved[p.key]) return false
    const l = lookups[p.key]
    if (!l?.ok) return false
    return eligibleForUseAll(readsAs(p.jobs[0]!, l.parcel))
  })
  const foundWaiting = found.filter((p) => !saved[p.key]).reduce((n, p) => n + p.jobs.length, 0)
  const lookingUp = progress != null

  async function save(p: OwnerConfirmProperty, source: OwnerConfirmSource, ownerLabel: string): Promise<boolean> {
    try {
      await confirmOwnerForProperty({ address: p.address, jobs: p.jobs, source, userId })
      setSaved((prev) => ({ ...prev, [p.key]: ownerLabel }))
      return true
    } catch (e) {
      showToast(`Could not save the owner on ${p.address}: ${e instanceof Error ? e.message : 'write failed'}`, 'error')
      return false
    }
  }

  async function confirmOne(p: OwnerConfirmProperty) {
    const l = lookups[p.key]
    if (!l?.ok || !l.proposal.found || busyKey || busyAll) return
    setBusyKey(p.key)
    const ok = await save(p, { kind: 'proposal', proposal: l.proposal }, ownerText(l))
    setBusyKey(null)
    if (ok) {
      showToast(`Owner of record saved on ${p.address} — ${p.jobs.length} job${p.jobs.length === 1 ? '' : 's'} covered`, 'success')
      await onSaved()
    }
  }

  async function confirmAll() {
    if (busyKey || busyAll || eligible.length === 0) return
    const list = [...eligible]
    setBusyAll({ done: 0, total: list.length })
    let okCount = 0
    for (let i = 0; i < list.length; i++) {
      const p = list[i]!
      const l = lookups[p.key]
      if (!l?.ok) continue
      const ok = await save(p, { kind: 'proposal', proposal: l.proposal }, ownerText(l))
      if (ok) okCount += 1
      setBusyAll({ done: i + 1, total: list.length })
    }
    setBusyAll(null)
    if (okCount > 0) {
      showToast(`Owner of record saved on ${okCount} propert${okCount === 1 ? 'y' : 'ies'}`, 'success')
      await onSaved()
    }
  }

  async function savePaste(p: OwnerConfirmProperty) {
    if (!draftHasOwner(pasteDraft) || busyKey || busyAll) return
    setBusyKey(p.key)
    const ok = await save(p, { kind: 'record', record: pasteDraft }, titleCaseUpperWords(pasteDraft.owner_company.trim() || pasteDraft.owner_name.trim()))
    setBusyKey(null)
    if (ok) {
      setPasteKey(null)
      showToast(`Owner of record saved on ${p.address}`, 'success')
      await onSaved()
    }
  }

  function openPaste(p: OwnerConfirmProperty) {
    const l = lookups[p.key]
    let draft: PropertyRecordDraft = emptyPropertyDraft(p.address)
    if (l?.ok) draft = { ...applyProposalToFields(draft, l.proposal, 'fill-blanks'), parcel_looked_up_at: new Date().toISOString() }
    setPasteDraft(draft)
    setPasteKey(p.key)
  }

  const subtitle = lookingUp
    ? `Looking up ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…`
    : sitting.length === 0
      ? 'Nothing to confirm — every GC job with hours has an owner of record.'
      : `Looked up on the appraisal roll just now · ${found.length} found · ${missed.length} need a paste`

  return (
    <ResponsiveModalShell
      title={`Owner of record · ${totalJobs} job${totalJobs === 1 ? '' : 's'} on ${sitting.length} propert${sitting.length === 1 ? 'y' : 'ies'}`}
      onRequestClose={onClose}
      maxWidthDesktop={920}
      zIndex={1200}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.78rem' }}>
          <span style={{ color: 'var(--text-muted)' }} data-testid="owner-confirm-footer">
            {savedJobs} of {totalJobs} confirmed · {foundWaiting} found and waiting on you · {missed.length} need a paste
          </span>
          <span style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" style={btn} onClick={onClose} disabled={busyAll != null}>
              Done
            </button>
            <button type="button" style={btnPrimary} onClick={() => void confirmAll()} disabled={busyAll != null || busyKey != null || eligible.length === 0} data-testid="owner-confirm-use-all">
              {busyAll ? `Saving ${busyAll.done} of ${busyAll.total}…` : `Use all ${eligible.length} found`}
            </button>
          </span>
        </div>
      }
    >
      <p style={{ margin: '0 0 0.75rem', ...faint }} data-testid="owner-confirm-subtitle" aria-live="polite">
        {subtitle}
        {!lookingUp && sitting.length > 0 ? ' · sorted by first notice' : ''}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {sitting.map((p) => {
          const l = lookups[p.key]
          const isSaved = Boolean(saved[p.key])
          const first = p.jobs[0]!
          const builder = builderName(first)
          const proposal = l?.ok ? l.proposal : null
          const parcel = l?.ok ? l.parcel : null
          const isFound = Boolean(proposal?.found)
          const chips = isFound ? readsAs(first, parcel) : []
          const county = proposal?.county.county ?? ''
          const propId = proposal?.provenance?.propId ?? ''
          const cadUrl = txCountyCadPropertyUrl(county, propId) || txCountyCadSearchUrl(county)
          const provenance = proposal?.provenance ? parcelProvenanceLine({ parcel_source: proposal.provenance.source, parcel_tax_year: proposal.provenance.taxYear, parcel_id: '' }) : ''
          const busy = busyKey === p.key
          return (
            <div
              key={p.key}
              data-testid="owner-confirm-row"
              data-state={isSaved ? 'saved' : !l ? 'pending' : isFound ? 'found' : 'miss'}
              style={{
                border: `1px solid ${isSaved ? 'var(--border-green)' : 'var(--border)'}`,
                background: isSaved ? 'var(--bg-green-tint)' : 'var(--surface)',
                borderRadius: 8,
                padding: '0.55rem 0.7rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.3rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-strong)' }}>{p.address || '(no address)'}</div>
                  <div style={faint}>
                    {p.jobs.map(jobLabel).join(' · ')} · {builder || 'no builder'}
                    {county ? ` · ${county}` : ''}
                  </div>
                </div>
                {p.noticeLabel ? (
                  <span
                    title={p.windowClosed ? 'The first work month\'s § 53.056 window has passed; later months on the job are still live and still need an owner.' : 'The first § 53.056 notice on this property is due on this date.'}
                    style={{ ...chipStyle(p.windowClosed ? 'grey' : 'amber'), whiteSpace: 'normal' }}
                  >
                    {p.noticeLabel}
                  </span>
                ) : null}
              </div>

              {isSaved ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.8125rem', color: 'var(--text-green-700)', fontWeight: 600 }}>
                  ✓ {saved[p.key]} · saved
                </div>
              ) : !l ? (
                <div style={faint}>{lookingUp ? 'Waiting for the roll…' : 'Not looked up yet.'}</div>
              ) : isFound && proposal ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0, flex: '1 1 260px' }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-strong)' }}>{ownerText(l)}</div>
                    <div style={faint}>
                      {proposal.ownerMailingAddress ? `Mail to ${titleCaseUpperWords(proposal.ownerMailingAddress)}` : 'No mailing address on the roll'}
                      {careOfLine(parcel) ? ` · ${titleCaseUpperWords(careOfLine(parcel))}` : ''}
                    </div>
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center', marginTop: 4 }}>
                      {chips.map((c) => (
                        <span key={c.key} style={chipStyle(c.tone)} data-chip={c.key}>
                          {c.label}
                        </span>
                      ))}
                      {provenance ? <span style={{ ...faint, fontSize: '0.6875rem', color: 'var(--text-faint)' }}>{provenance}</span> : null}
                      {cadUrl ? (
                        <button type="button" style={linkBtn} onClick={() => openInExternalBrowser(cadUrl)} title={propId ? `Open this parcel (Prop ID ${propId}) on the ${county} County Appraisal District` : `Open the ${county} County Appraisal District property search`}>
                          {propId ? `this parcel on ${county} CAD ↗` : `${county} CAD ↗`}
                        </button>
                      ) : null}
                    </div>
                    {chips.some((c) => c.key === 'homestead') ? (
                      <div style={{ ...faint, color: 'var(--text-red-700)', marginTop: 4 }}>{HOMESTEAD_LINE}</div>
                    ) : null}
                    {chips.some((c) => c.key === 'public') ? (
                      <div style={{ ...faint, color: 'var(--text-red-700)', marginTop: 4 }}>
                        A mechanic's lien does not attach to public property — the remedy is a claim on the GC's payment bond. Use saves the owner so the desk knows.
                      </div>
                    ) : null}
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <button type="button" style={linkBtn} onClick={() => (pasteKey === p.key ? setPasteKey(null) : openPaste(p))} aria-expanded={pasteKey === p.key}>
                      {pasteKey === p.key ? 'Hide' : 'Not right…'}
                    </button>
                    <button type="button" style={btnPrimary} disabled={busy || busyAll != null} onClick={() => void confirmOne(p)} data-testid="owner-confirm-use">
                      {busy ? 'Saving…' : 'Use'}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-amber-700)' }}>
                    {l.ok ? 'No parcel under the pin' : propertyLookupErrorMessage(l.error)}
                    {l.ok && l.parcelError ? ` (${l.parcelError})` : ''}
                    {county ? ` · County ${county}` : ''}
                  </span>
                  <button type="button" style={linkBtn} onClick={() => (pasteKey === p.key ? setPasteKey(null) : openPaste(p))} aria-expanded={pasteKey === p.key} data-testid="owner-confirm-paste-door">
                    {pasteKey === p.key ? 'Hide paste' : '— paste the CAD page…'}
                  </button>
                </div>
              )}

              {pasteKey === p.key && !isSaved ? (
                <div style={{ marginTop: '0.3rem', borderTop: '1px dashed var(--border)', paddingTop: '0.5rem' }} data-testid="owner-confirm-paste-panel">
                  <CustomerPropertyRecordPanel address={p.address} fields={pasteDraft} onChange={(patch) => setPasteDraft((d) => ({ ...d, ...patch }))} compact />
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                    <button type="button" style={btn} onClick={() => setPasteKey(null)} disabled={busy}>
                      Cancel
                    </button>
                    <button type="button" style={btnPrimary} onClick={() => void savePaste(p)} disabled={busy || !draftHasOwner(pasteDraft)} title={draftHasOwner(pasteDraft) ? undefined : 'Needs an owner of record and a mailing address'}>
                      {busy ? 'Saving…' : `Save the owner on ${p.address.split(',')[0]}`}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </ResponsiveModalShell>
  )
}

function ownerText(l: PropertyLookupOutcome): string {
  if (!l.ok) return ''
  const raw = l.proposal.ownerCompany || l.proposal.ownerName
  return titleCaseUpperWords(raw)
}
