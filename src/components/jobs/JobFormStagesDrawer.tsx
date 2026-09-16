/**
 * "As Sample Contracting sees it" (Stage Plan PR 4): a drawer beside the Edit
 * Job dialog that draws the GC's stage card from the live plan — every edit
 * in the dialog shows here as it is made. Only rows with the eye on; never a
 * sub's name. Light by design: it is the customer's paper.
 *
 * When the GC has no portal link yet, the door at the foot opens the sample and a
 * dashed panel offers *Create their link* — the same mint the customer globe modal
 * does (Stage Plan residual 5, v2.3517), so the loop closes without leaving the dialog.
 */
import { useEffect, useState } from 'react'
import { gcView, type StagePlan } from '../../lib/jobs/stagePlan'
import { CARD, HAIR, INK, MUTED, PAPER, PORTAL_FONT } from '../../lib/portal/portalTheme'
import { mintCustomerPortalLink } from '../../lib/portal/mintCustomerPortalLink'
import { setPortalGlobeState } from '../../hooks/usePortalOffStates'
import { formatErrorMessage } from '../../utils/errorHandling'
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
  /**
   * The GC customer on the job, when there is one. With `portalIsSample` it means the
   * GC has never been given a portal link, and the footer offers to create it here
   * (Stage Plan residual 5, v2.3517) — the same mint the customer globe modal does.
   */
  gcCustomerId?: string | null
  /** After a link is minted: the parent re-reads the GC's links so the door reads the real portal. */
  onLinkMinted?: () => void
  zIndex: number
}

export function JobFormStagesDrawer({ open, onClose, plan, gcName, jobLabel, jobAddress, portalUrl, portalIsSample, gcCustomerId = null, onLinkMinted, zIndex }: JobFormStagesDrawerProps) {
  const [mintBusy, setMintBusy] = useState(false)
  const [mintError, setMintError] = useState<string | null>(null)
  const [minted, setMinted] = useState(false)
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
  const canMint = portalIsSample && Boolean(gcCustomerId)
  const createLink = async () => {
    if (!gcCustomerId || mintBusy) return
    setMintBusy(true)
    setMintError(null)
    try {
      const token = await mintCustomerPortalLink(gcCustomerId, 'all', false)
      if (!token) throw new Error('No link returned')
      setPortalGlobeState(gcCustomerId, 'active')
      setMinted(true)
      onLinkMinted?.()
    } catch (e) {
      setMintError(formatErrorMessage(e, 'Could not create the link'))
    } finally {
      setMintBusy(false)
    }
  }
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
      <div style={{ padding: '0.6rem 0.9rem', borderTop: `1px solid ${HAIR}`, fontSize: 11.5, color: MUTED, background: CARD, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div>
          Live: changes in the dialog show here as you make them. Only rows with the eye on; never a sub's name.{' '}
          {portalUrl ? (
            <a href={portalUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#1d4e89', fontWeight: 600 }}>
              {portalIsSample ? 'Open the sample portal ↗' : 'Open the portal ↗'}
            </a>
          ) : null}
        </div>
        {canMint ? (
          <div data-testid="stages-drawer-mint" style={{ border: `1px dashed ${HAIR}`, borderRadius: 6, padding: '0.55rem 0.7rem', background: PAPER, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: INK }}>{minted ? 'Their link is live.' : 'No portal link yet.'}</div>
            <div>
              {minted
                ? `${gc} now has a portal page — the door above reads it in a moment. You decide when to share it.`
                : `${gc} has never been given a portal page, so the door above opens the sample. Creating the link makes their page live — you decide when to share it.`}
            </div>
            {minted ? null : (
              <button
                type="button"
                onClick={() => void createLink()}
                disabled={mintBusy}
                style={{ alignSelf: 'flex-start', padding: '0.3rem 0.7rem', fontSize: 12, fontWeight: 600, background: '#2563eb', color: 'white', border: 'none', borderRadius: 6, cursor: mintBusy ? 'wait' : 'pointer', fontFamily: 'inherit' }}
              >
                {mintBusy ? 'Creating…' : 'Create their link'}
              </button>
            )}
            {mintError ? <div style={{ color: 'var(--text-red-700)' }}>{mintError}</div> : null}
          </div>
        ) : null}
      </div>
    </aside>
  )
}
