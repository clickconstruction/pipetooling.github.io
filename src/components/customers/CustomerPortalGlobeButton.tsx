import { useCallback, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'
import { formatErrorMessage } from '../../utils/errorHandling'
import { buildPortalLinkHistory, type PortalHistoryEntry, type PortalLinkRow } from '../../lib/portal/portalLinkState'
import { setPortalLinkOff, usePortalLinkOff } from '../../hooks/usePortalOffStates'
import type { MintCustomerPortalLinkResult } from '../../types/database-functions'

/**
 * 🌐 next to a customer's name (portal train PR 4; preview + advanced v2.2001):
 * office staff click it to copy or preview that customer's no-login portal
 * link. The modal embeds a live scaled-down preview of the actual portal page
 * and hides Rotate / Turn off / link history behind a gear. A turned-off link
 * paints the globe red until someone turns it back on — and opening the modal
 * never silently re-mints a link that was deliberately turned off.
 * Self-contained (button + modal) so it can sit anywhere a customer name
 * renders. Renders nothing for non-office roles.
 */

type Audience = 'customer' | 'gc'
type LinkState =
  | { kind: 'loading' }
  | { kind: 'active'; token: string }
  | { kind: 'off' }
  | { kind: 'error'; message: string }

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
  const [state, setState] = useState<LinkState>({ kind: 'loading' })
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [history, setHistory] = useState<PortalHistoryEntry[]>([])
  const [creatorNames, setCreatorNames] = useState<Record<string, string>>({})
  const anyOff = usePortalLinkOff(customerId)

  const mint = useCallback(
    async (aud: Audience, rotate: boolean): Promise<string | null> => {
      const { data, error } = await supabase.rpc('mint_customer_portal_link' as never, {
        p_customer_id: customerId,
        p_audience: aud,
        p_rotate: rotate,
      } as never)
      if (error) throw error
      const res = data as unknown as MintCustomerPortalLinkResult
      if (res.error) throw new Error(res.error)
      return res.token ?? null
    },
    [customerId],
  )

  /**
   * Resolve the audience's link WITHOUT reviving a turned-off one: read the
   * rows first; an active row supplies the token, rows-with-none-active is the
   * deliberate OFF state, and only a never-minted pair auto-mints.
   */
  const loadState = useCallback(
    async (aud: Audience) => {
      setState({ kind: 'loading' })
      try {
        const { data, error } = await supabase
          .from('customer_portal_links')
          .select('audience, token, created_at, revoked_at, created_by')
          .eq('customer_id', customerId)
          .eq('audience', aud)
          .order('created_at', { ascending: false })
        if (error) throw error
        const rows: Array<PortalLinkRow & { token: string | null }> = data ?? []
        setHistory(buildPortalLinkHistory(rows))
        const creatorIds = [...new Set(rows.map((r) => r.created_by).filter((v): v is string => !!v))]
        if (creatorIds.length > 0) {
          void supabase
            .from('users')
            .select('id, name')
            .in('id', creatorIds)
            .then(({ data: users }) => {
              if (!users) return
              setCreatorNames((prev) => {
                const next = { ...prev }
                for (const u of users) {
                  if (u.name) next[u.id] = u.name
                }
                return next
              })
            })
        }
        const active = rows.find((r) => r.revoked_at === null)
        if (active?.token) {
          setState({ kind: 'active', token: active.token })
          setPortalLinkOff(customerId, aud, false)
          return
        }
        if (rows.length > 0) {
          setState({ kind: 'off' })
          setPortalLinkOff(customerId, aud, true)
          return
        }
        const token = await mint(aud, false)
        if (!token) throw new Error('No link returned')
        setState({ kind: 'active', token })
        // First-mint history entry, without a refetch round-trip.
        setHistory([{ createdAt: new Date().toISOString(), revokedAt: null, createdBy: null, outcome: 'active' }])
      } catch (e) {
        setState({ kind: 'error', message: formatErrorMessage(e, 'Could not load the portal link') })
      }
    },
    [customerId, mint],
  )

  const canManage = role === 'dev' || role === 'master_technician' || isAssistantLike(role)
  if (!canManage) return null

  const openModal = () => {
    setOpen(true)
    setAudience(defaultAudience)
    setAdvancedOpen(false)
    void loadState(defaultAudience)
  }

  const switchAudience = (aud: Audience) => {
    if (aud === audience) return
    setAudience(aud)
    void loadState(aud)
  }

  const url = state.kind === 'active' ? `${window.location.origin}/portal?t=${state.token}` : null

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
    setBusy(true)
    try {
      await mint(audience, true)
      showToast('New link created — the old one no longer works.', 'success')
      await loadState(audience)
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not rotate the link'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const revoke = async () => {
    if (!(await confirmDialog({ message: `Turn off ${customerName}'s portal link? Nobody can open their portal until it's turned back on.` }))) return
    setBusy(true)
    try {
      const { data, error } = await supabase.rpc('revoke_customer_portal_link' as never, {
        p_customer_id: customerId,
        p_audience: audience,
      } as never)
      if (error) throw error
      const res = data as unknown as { revoked?: number; error?: string }
      if (res.error) throw new Error(res.error)
      showToast('Portal link turned off.', 'success')
      await loadState(audience)
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not revoke the link'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const turnBackOn = async () => {
    setBusy(true)
    try {
      const token = await mint(audience, false)
      if (!token) throw new Error('No link returned')
      showToast('Portal turned back on — this is a brand-new link.', 'success')
      await loadState(audience)
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not turn the portal back on'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const fmtWhen = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

  const historyLine = (h: PortalHistoryEntry) => {
    const who = h.createdBy ? creatorNames[h.createdBy] : null
    const made = `Created ${fmtWhen(h.createdAt)}${who ? ` by ${who}` : ''}`
    if (h.outcome === 'active') return `${made} — active now`
    if (h.outcome === 'rotated') return `${made} — rotated ${h.revokedAt ? fmtWhen(h.revokedAt) : ''}`
    return `${made} — turned off ${h.revokedAt ? fmtWhen(h.revokedAt) : ''}`
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

  const PREVIEW_SCALE = 0.62
  const PREVIEW_HEIGHT = 300

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          openModal()
        }}
        title={
          anyOff
            ? `Portal link is turned off for ${customerName} — click to manage`
            : `Customer portal — copy or preview what ${customerName} sees`
        }
        aria-label={`Open ${customerName}'s customer portal link`}
        style={{
          padding: '0.15rem',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: anyOff ? 'var(--text-red-600)' : 'var(--text-muted)',
          display: 'inline-flex',
          alignItems: 'center',
          verticalAlign: 'middle',
        }}
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
            style={{ background: 'var(--surface)', padding: '1.25rem 1.5rem 1.4rem', borderRadius: 8, width: 'min(560px, calc(100vw - 2rem))', maxHeight: 'calc(100vh - 3rem)', overflowY: 'auto' }}
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

            {state.kind === 'loading' ? (
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', padding: '0.6rem 0' }} aria-busy>
                Fetching the link…
              </div>
            ) : state.kind === 'error' ? (
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-red-600)', padding: '0.6rem 0' }}>{state.message}</div>
            ) : state.kind === 'off' ? (
              <div style={{ border: '1px solid var(--text-red-600)', borderRadius: 6, padding: '0.75rem 0.9rem', marginBottom: '0.8rem' }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-red-600)' }}>This portal is turned off.</div>
                <p style={{ margin: '0.3rem 0 0.6rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {customerName} can't open their page — old links show "no longer active." Turning it back on makes a brand-new link.
                </p>
                <button type="button" onClick={() => void turnBackOn()} disabled={busy} style={{ ...secondaryBtn, background: '#2563eb', color: 'white', border: 'none', fontWeight: 600 }}>
                  Turn portal back on
                </button>
              </div>
            ) : url ? (
              <>
                <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.72rem', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.5rem 0.6rem', wordBreak: 'break-all', userSelect: 'all' }}>
                  {url}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.8rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <button type="button" onClick={() => void copy()} style={{ ...secondaryBtn, background: '#2563eb', color: 'white', border: 'none', fontWeight: 600 }}>
                    Copy link
                  </button>
                  <button type="button" onClick={() => window.open(url, '_blank', 'noopener')} style={secondaryBtn}>
                    {audience === 'gc' ? 'Preview as GC' : 'Preview as customer'}
                  </button>
                  <span style={{ flex: 1 }} />
                  <button
                    type="button"
                    onClick={() => setAdvancedOpen((v) => !v)}
                    aria-pressed={advancedOpen}
                    aria-label="Advanced settings"
                    title="Advanced — rotate, turn off, link history"
                    style={{ ...secondaryBtn, padding: '0.3rem 0.45rem', display: 'inline-flex', alignItems: 'center', background: advancedOpen ? 'var(--bg-subtle)' : 'var(--surface)' }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={15} height={15} fill="currentColor" aria-hidden>
                      <path d="M259.1 73.5C262.1 58.7 275.2 48 290.4 48L350.2 48C365.4 48 378.5 58.7 381.5 73.5L396 143.5C410.1 149.5 423.3 157.2 435.3 166.3L503.1 143.8C517.5 139 533.3 145 540.9 158.2L570.8 210C578.4 223.2 575.7 239.8 564.3 249.9L511 297.3C511.9 304.7 512.3 312.3 512.3 320C512.3 327.7 511.8 335.3 511 342.7L564.4 390.2C575.8 400.3 578.4 417 570.9 430.1L541 481.9C533.4 495 517.6 501.1 503.2 496.3L435.4 473.8C423.3 482.9 410.1 490.5 396.1 496.6L381.7 566.5C378.6 581.4 365.5 592 350.4 592L290.6 592C275.4 592 262.3 581.3 259.3 566.5L244.9 496.6C230.8 490.6 217.7 482.9 205.6 473.8L137.5 496.3C123.1 501.1 107.3 495.1 99.7 481.9L69.8 430.1C62.2 416.9 64.9 400.3 76.3 390.2L129.7 342.7C128.8 335.3 128.4 327.7 128.4 320C128.4 312.3 128.9 304.7 129.7 297.3L76.3 249.8C64.9 239.7 62.3 223 69.8 209.9L99.7 158.1C107.3 144.9 123.1 138.9 137.5 143.7L205.3 166.2C217.4 157.1 230.6 149.5 244.6 143.4L259.1 73.5zM320.3 400C364.5 399.8 400.2 363.9 400 319.7C399.8 275.5 363.9 239.8 319.7 240C275.5 240.2 239.8 276.1 240 320.3C240.2 364.5 276.1 400.2 320.3 400z" />
                    </svg>
                  </button>
                </div>

                <div style={{ marginTop: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '0.68rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)', fontWeight: 600 }}>
                      Live preview — what this link opens
                    </span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-link)', background: 'var(--bg-blue-tint)', borderRadius: 99, padding: '0.1rem 0.55rem' }}>
                      {audience === 'gc' ? 'GC view' : 'customer view'}
                    </span>
                  </div>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', height: PREVIEW_HEIGHT, background: '#f6f3ec' }}>
                    <iframe
                      src={url}
                      title={`Portal preview — ${customerName}`}
                      sandbox="allow-scripts allow-same-origin allow-popups"
                      style={{
                        width: `${100 / PREVIEW_SCALE}%`,
                        height: PREVIEW_HEIGHT / PREVIEW_SCALE,
                        transform: `scale(${PREVIEW_SCALE})`,
                        transformOrigin: 'top left',
                        border: 'none',
                        display: 'block',
                        background: '#f6f3ec',
                      }}
                    />
                  </div>
                </div>
              </>
            ) : null}

            {advancedOpen && state.kind !== 'loading' && (
              <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '0.8rem' }}>
                {state.kind === 'active' && (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.8rem' }}>
                    <button type="button" onClick={() => void rotate()} disabled={busy} style={secondaryBtn}>
                      Rotate
                    </button>
                    <button type="button" onClick={() => void revoke()} disabled={busy} style={{ ...secondaryBtn, color: 'var(--text-red-600)' }}>
                      Turn off
                    </button>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)', alignSelf: 'center' }}>
                      Rotate = new link, old one dies. Turn off = no portal at all.
                    </span>
                  </div>
                )}
                {history.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.68rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)', fontWeight: 600, marginBottom: '0.35rem' }}>
                      Link history
                    </div>
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {history.map((h, i) => (
                        <li key={i} style={{ fontSize: '0.75rem', color: h.outcome === 'active' ? 'var(--text-700)' : 'var(--text-muted)' }}>
                          {historyLine(h)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
