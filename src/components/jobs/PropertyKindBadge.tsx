import { useState } from 'react'
import PropertyKindSwitch from './PropertyKindSwitch'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'
import { propertyKindBadge, propertyKindQuestion } from '../../lib/jobs/propertyKindBadge'
import { type PropertyKind } from '../../lib/jobs/propertyKind'
import { linkJobPropertyAndSaveKind, savePropertyKind } from '../../lib/jobs/propertyKindWrite'

/**
 * The residential / commercial badge at the end of a Pipeline row's address
 * (v2.4160): an orange C, a blue R, or a red ? when the property's kind is not
 * set. Click opens a small picker — the same Residential | Commercial switch the
 * lien screens use — and the answer is saved on the customer's property, so every
 * job at that address follows it and its lien clock reads the right deadline.
 * Office roles pick; everyone else sees the letter. No linked property but a
 * customer (v2.4212): the same ?, and the pick saves the job's address as a
 * property on the customer — or reuses the one it matches — and links the job.
 * No customer: nothing to hang a property on, no badge.
 */
export default function PropertyKindBadge({
  job,
  kind,
  role,
  onSaved,
  onLinked,
  onError,
}: {
  job: { id: string; customer_address_id: string | null; customer_id?: string | null; customer_name?: string | null; job_address: string | null; hcp_number: string | null; job_name: string | null }
  /** The property's kind as loaded; undefined while the board has not read it yet (no badge). */
  kind: string | undefined
  role: string | null | undefined
  onSaved?: (customerAddressId: string, kind: PropertyKind) => void
  /** An unlinked job's pick saved (reused = matched an existing property) and linked: the board remembers the link. */
  onLinked?: (customerAddressId: string, kind: PropertyKind, reused: boolean) => void
  onError?: (message: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  if (kind === undefined) return null
  const where = (job.job_address ?? '').trim().split(/[\n,]/)[0]?.trim() || 'this job'
  const badge = propertyKindBadge({ customerAddressId: job.customer_address_id, kind, customerId: job.customer_id }, where)
  if (!badge) return null
  const canPick = role === 'dev' || role === 'master_technician' || isAssistantLike(role)
  const jobLabel = `${(job.hcp_number ?? '').trim() || '—'} · ${(job.job_name ?? '').trim() || 'Job'}`

  const circle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 16,
    height: 16,
    borderRadius: '50%',
    background: badge.fill,
    color: '#fff',
    fontSize: '0.625rem',
    fontWeight: 700,
    lineHeight: 1,
    flexShrink: 0,
    // inline after the address's last word — "Hondo, TX (?)" — with a word's worth of air (v2.4210)
    marginLeft: '0.3rem',
    verticalAlign: 'text-bottom',
  } as const

  async function pick(next: PropertyKind) {
    if (!next) return
    setBusy(true)
    try {
      if (job.customer_address_id) {
        await savePropertyKind(job.customer_address_id, next)
        onSaved?.(job.customer_address_id, next)
      } else {
        if (!job.customer_id) return
        const linked = await linkJobPropertyAndSaveKind({ jobId: job.id, customerId: job.customer_id, jobAddress: job.job_address ?? '', kind: next })
        onLinked?.(linked.customerAddressId, next, linked.reused)
      }
      setOpen(false)
    } catch (e) {
      onError?.(`Could not save the property kind: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  if (!canPick) {
    return (
      <span data-testid="property-kind-badge" data-kind={badge.kind || 'unset'} data-unlinked={badge.unlinked || undefined} title={badge.title.replace(/ — click to.*$/, '')} aria-label={badge.label} style={circle}>
        {badge.letter}
      </span>
    )
  }
  return (
    <span style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'text-bottom' }} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        data-testid="property-kind-badge"
        data-kind={badge.kind || 'unset'}
        data-unlinked={badge.unlinked || undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={badge.label}
        title={badge.title}
        onClick={() => setOpen((v) => !v)}
        style={{ ...circle, verticalAlign: undefined, border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', fontSize: '0.625rem', fontWeight: 700 }}
      >
        {badge.letter}
      </button>
      {open ? (
        <>
          <span onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <span
            role="dialog"
            aria-label={propertyKindQuestion(job.job_address, jobLabel)}
            data-testid="property-kind-popover"
            style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 41, width: 'min(300px, calc(100vw - 2rem))', display: 'grid', gap: 8, padding: '0.6rem 0.75rem', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', fontSize: '0.78rem', color: 'var(--text-base)', whiteSpace: 'normal', textAlign: 'left' }}
          >
            <strong style={{ fontSize: '0.82rem', color: 'var(--text-strong)' }}>{propertyKindQuestion(job.job_address, jobLabel)}</strong>
            <PropertyKindSwitch value={badge.kind} onPick={(k) => void pick(k)} voice="lien" size="row" disabled={busy} label={`Property kind for ${jobLabel}`} />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
              {badge.unlinked
                ? `Not one of ${(job.customer_name ?? '').trim() || "the customer"}'s saved properties yet — picking saves this address as one and links the job, so every job here gets it and the lien clock reads the right deadline.`
                : 'Saved on the property, so every job at this address gets it — and the lien clock reads the right deadline.'}
            </span>
          </span>
        </>
      ) : null}
    </span>
  )
}
