/**
 * "As Sample Contracting sees it" (Stage Plan PR 4): a drawer beside the Edit
 * Job dialog that draws the GC's stage card from the live plan — every edit
 * in the dialog shows here as it is made. Only rows with the eye on; never a
 * sub's name. Light by design: it is the customer's paper.
 */
import { useEffect } from 'react'
import { gcView, type StagePlan } from '../../lib/jobs/stagePlan'
import { CARD, HAIR, INK, MUTED, PAPER, PORTAL_FONT } from '../../lib/portal/portalTheme'
import { PortalStagesCard } from '../portal/PortalStagesCard'

type JobFormStagesDrawerProps = {
  open: boolean
  onClose: () => void
  plan: StagePlan
  gcName: string | null
  jobLabel: string
  jobAddress: string | null
  /** The portal to open — the job's GC link when the office has one, else the sample. */
  portalUrl: string | null
  portalIsSample: boolean
  zIndex: number
}

export function JobFormStagesDrawer({ open, onClose, plan, gcName, jobLabel, jobAddress, portalUrl, portalIsSample, zIndex }: JobFormStagesDrawerProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  const view = gcView(plan)
  const gc = gcName?.trim() || 'the customer'
  return (
    <aside
      data-testid="stages-drawer"
      data-theme="light"
      aria-label={`As ${gc} sees it`}
      style={{ position: 'fixed', top: 72, right: 16, bottom: 16, width: 'min(360px, calc(100vw - 32px))', zIndex, display: 'flex', flexDirection: 'column', background: PAPER, color: INK, border: `1px solid ${HAIR}`, borderRadius: 10, boxShadow: '0 12px 40px rgba(0,0,0,0.25)', fontFamily: PORTAL_FONT, overflow: 'hidden' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.6rem 0.9rem', borderBottom: `1px solid ${HAIR}`, background: CARD }}>
        <span style={{ fontWeight: 700, fontSize: 13.5, flex: 1 }}>As {gc} sees it</span>
        <button type="button" onClick={onClose} aria-label="Close the customer preview" style={{ background: 'transparent', border: 'none', color: MUTED, fontSize: 18, lineHeight: 1, cursor: 'pointer', padding: 2 }}>
          ×
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.9rem' }}>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 10 }}>
          CLICK<span style={{ color: '#b0662f' }}>.</span>
        </div>
        <PortalStagesCard view={view} jobLabel={jobLabel} jobAddress={jobAddress} />
      </div>
      <div style={{ padding: '0.6rem 0.9rem', borderTop: `1px solid ${HAIR}`, fontSize: 11.5, color: MUTED, background: CARD }}>
        Live: changes in the dialog show here as you make them. Only rows with the eye on; never a sub's name.{' '}
        {portalUrl ? (
          <a href={portalUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#1d4e89', fontWeight: 600 }}>
            {portalIsSample ? 'Open the sample portal ↗' : 'Open the portal ↗'}
          </a>
        ) : null}
      </div>
    </aside>
  )
}
