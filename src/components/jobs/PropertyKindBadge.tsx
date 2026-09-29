import { useState } from 'react'
import PropertyKindSwitch from './PropertyKindSwitch'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'
import { propertyKindBadge, propertyKindQuestion } from '../../lib/jobs/propertyKindBadge'
import { type PropertyKind } from '../../lib/jobs/propertyKind'
import { savePropertyKind } from '../../lib/jobs/propertyKindWrite'

/**
 * The residential / commercial badge at the end of a Pipeline row's address
 * (v2.4160): an orange C, a blue R, or a red ? when the property's kind is not
 * set. Click opens a small picker — the same Residential | Commercial switch the
 * lien screens use — and the answer is saved on the customer's property, so every
 * job at that address follows it and its lien clock reads the right deadline.
 * Office roles pick; everyone else sees the letter. No linked property: nothing.
 */
export default function PropertyKindBadge({
  job,
  kind,
  role,
  onSaved,
  onError,
}: {
  job: { id: string; customer_address_id: string | null; job_address: string | null; hcp_number: string | null; job_name: string | null }
  /** The property's kind as loaded; undefined while the board has not read it yet (no badge). */
  kind: string | undefined
  role: string | null | undefined
  onSaved?: (customerAddressId: string, kind: PropertyKind) => void
  onError?: (message: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  if (kind === undefined) return null
  const where = (job.job_address ?? '').trim().split(/[\n,]/)[0]?.trim() || 'this job'
  const badge = propertyKindBadge({ customerAddressId: job.customer_address_id, kind }, where)
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
  } as const

  async function pick(next: PropertyKind) {
    if (!job.customer_address_id || !next) return
    setBusy(true)
    try {
      await savePropertyKind(job.customer_address_id, next)
      onSaved?.(job.customer_address_id, next)
      setOpen(false)
    } catch (e) {
      onError?.(`Could not save the property kind: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  if (!canPick) {
    return (
      <span data-testid="property-kind-badge" data-kind={badge.kind || 'unset'} title={badge.title.replace(/ — click to.*$/, '')} aria-label={badge.label} style={circle}>
        {badge.letter}
      </span>
    )
  }
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        data-testid="property-kind-badge"
        data-kind={badge.kind || 'unset'}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={badge.label}
        title={badge.title}
        onClick={() => setOpen((v) => !v)}
        style={{ ...circle, border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', fontSize: '0.625rem', fontWeight: 700 }}
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
            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Saved on the property, so every job at this address gets it — and the lien clock reads the right deadline.</span>
          </span>
        </>
      ) : null}
    </span>
  )
}
