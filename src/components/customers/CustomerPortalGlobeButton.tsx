import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'
import { formatErrorMessage } from '../../utils/errorHandling'
import type { MintCustomerPortalLinkResult } from '../../types/database-functions'

/**
 * 🌐 next to a customer's name (portal train PR 4): office staff click it to
 * copy, preview, rotate, or revoke that customer's no-login portal link (the
 * "view what a customer sees" entry point). Self-contained — button + its
 * modal — so it can sit anywhere a customer name renders: Customers rows,
 * Pipeline rows, Job Detail, Edit Job. Renders nothing for non-office roles.
 */

type Audience = 'customer' | 'gc'

export default function CustomerPortalGlobeButton({
  customerId,
  customerName,
  defaultAudience = 'customer',
  size = 15,
}: {
  customerId: string
  customerName: string
  defaultAudience?: Audience
  size?: number
}) {
  const { role } = useAuth()
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const [open, setOpen] = useState(false)
  const [audience, setAudience] = useState<Audience>(defaultAudience)
  const [busy, setBusy] = useState(false)
  const [link, setLink] = useState<{ token: string; activeSince: string | null } | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const canManage = role === 'dev' || role === 'master_technician' || isAssistantLike(role)
  if (!canManage) return null

  const mint = async (aud: Audience, rotate: boolean) => {
    setBusy(true)
    setLoadError(null)
    try {
      const { data, error } = await supabase.rpc('mint_customer_portal_link' as never, {
        p_customer_id: customerId,
        p_audience: aud,
        p_rotate: rotate,
      } as never)
      if (error) throw error
      const res = data as unknown as MintCustomerPortalLinkResult
      if (res.error) throw new Error(res.error)
      if (!res.token) throw new Error('No link returned')
      setLink({ token: res.token, activeSince: res.activeSince ?? null })
      if (rotate) showToast('New link created — the old one no longer works.', 'success')
    } catch (e) {
      setLink(null)
      setLoadError(formatErrorMessage(e, 'Could not load the portal link'))
    } finally {
      setBusy(false)
    }
  }

  const openModal = () => {
    setOpen(true)
    setAudience(defaultAudience)
    void mint(defaultAudience, false)
  }

  const switchAudience = (aud: Audience) => {
    if (aud === audience) return
    setAudience(aud)
    setLink(null)
    void mint(aud, false)
  }

  const url = link ? `${window.location.origin}/portal?t=${link.token}` : null

  const copy = async () => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      showToast('Portal link copied.', 'success')
    } catch {
      showToast('Could not copy — select the link text instead.', 'error')
    }
  }

  const rotate = async () => {
    if (!(await confirmDialog({ message: `Rotate ${customerName}'s portal link? The current link stops working immediately.` }))) return
    await mint(audience, true)
  }

  const revoke = async () => {
    if (!(await confirmDialog({ message: `Turn off ${customerName}'s portal link? Nobody can open their portal until a new link is made.` }))) return
    setBusy(true)
    try {
      const { data, error } = await supabase.rpc('revoke_customer_portal_link' as never, {
        p_customer_id: customerId,
        p_audience: audience,
      } as never)
      if (error) throw error
      const res = data as unknown as { revoked?: number; error?: string }
      if (res.error) throw new Error(res.error)
      setLink(null)
      showToast('Portal link turned off.', 'success')
      setOpen(false)
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not revoke the link'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const secondaryBtn: React.CSSProperties = {
    padding: '0.35rem 0.7rem',
    fontSize: '0.8125rem',
    border: '1px solid var(--border)',
    borderRadius: 6,
    background: 'var(--surface)',
    color: 'var(--text-700)',
    cursor: 'pointer',
    fontFamily: 'inherit',
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          openModal()
        }}
        title={`Customer portal — copy or preview what ${customerName} sees`}
        aria-label={`Open ${customerName}'s customer portal link`}
        style={{ padding: '0.15rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={size} height={size} fill="currentColor" aria-hidden>
          <path d="M415.9 344L225 344C227.9 408.5 242.2 467.9 262.5 511.4C273.9 535.9 286.2 553.2 297.6 563.8C308.8 574.3 316.5 576 320.5 576C324.5 576 332.2 574.3 343.4 563.8C354.8 553.2 367.1 535.8 378.5 511.4C398.8 467.9 413.1 408.5 416 344zM224.9 296L415.8 296C413 231.5 398.7 172.1 378.4 128.6C367 104.2 354.7 86.8 343.3 76.2C332.1 65.7 324.4 64 320.4 64C316.4 64 308.7 65.7 297.5 76.2C286.1 86.8 273.8 104.2 262.4 128.6C242.1 172.1 227.8 231.5 224.9 296zM176.9 296C180.4 210.4 202.5 130.9 234.8 78.7C142.7 111.3 74.9 195.2 65.5 296L176.9 296zM65.5 344C74.9 444.8 142.7 528.7 234.8 561.3C202.5 509.1 180.4 429.6 176.9 344L65.5 344zM463.9 344C460.4 429.6 438.3 509.1 406 561.3C498.1 528.6 565.9 444.8 575.3 344L463.9 344zM575.3 296C565.9 195.2 498.1 111.3 406 78.7C438.3 130.9 460.4 210.4 463.9 296L575.3 296z" />
        </svg>
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${customerName} portal link`}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300 }}
          onClick={(e) => {
            e.stopPropagation()
            setOpen(false)
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--surface)', padding: '1.25rem 1.5rem', borderRadius: 8, width: 'min(480px, calc(100vw - 2rem))' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.05rem' }}>{customerName} — portal</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--text-muted)', padding: 4 }}>
                ×
              </button>
            </div>
            <p style={{ margin: '0.3rem 0 0.8rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Their private no-login page: open bills with pay links, plus visit and bid request forms that land in the dispatch inbox.
            </p>
            <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.8rem' }}>
              {(['customer', 'gc'] as const).map((aud) => (
                <button
                  key={aud}
                  type="button"
                  onClick={() => switchAudience(aud)}
                  aria-pressed={audience === aud}
                  style={{
                    ...secondaryBtn,
                    padding: '0.25rem 0.7rem',
                    fontSize: '0.75rem',
                    background: audience === aud ? 'var(--bg-blue-tint)' : 'var(--surface)',
                    color: audience === aud ? 'var(--text-link)' : 'var(--text-muted)',
                  }}
                >
                  {aud === 'customer' ? 'As customer' : 'As GC'}
                </button>
              ))}
            </div>
            {busy && !link ? (
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', padding: '0.6rem 0' }} aria-busy>
                Fetching the link…
              </div>
            ) : loadError ? (
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-red-600)', padding: '0.6rem 0' }}>{loadError}</div>
            ) : link && url ? (
              <>
                <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.72rem', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.5rem 0.6rem', wordBreak: 'break-all', userSelect: 'all' }}>
                  {url}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.8rem', flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => void copy()} style={{ ...secondaryBtn, background: '#2563eb', color: 'white', border: 'none', fontWeight: 600 }}>
                    Copy link
                  </button>
                  <button type="button" onClick={() => window.open(url, '_blank', 'noopener')} style={secondaryBtn}>
                    Preview as customer
                  </button>
                  <span style={{ flex: 1 }} />
                  <button type="button" onClick={() => void rotate()} disabled={busy} style={secondaryBtn}>
                    Rotate
                  </button>
                  <button type="button" onClick={() => void revoke()} disabled={busy} style={{ ...secondaryBtn, color: 'var(--text-red-600)' }}>
                    Turn off
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </>
  )
}
