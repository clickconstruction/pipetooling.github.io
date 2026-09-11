import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../../lib/supabase'
import { useToastContext } from '../../../contexts/ToastContext'
import { useConfirmDialog } from '../../../contexts/ConfirmDialogContext'
import { withPreviewFlag } from '../../../lib/publicViewCounting'

const db = supabase as unknown as SupabaseClient

/**
 * The firm's link (Legal portal PR 3), on the Legal desk header: one token
 * link per firm — create, copy, preview (office preview flag, uncounted),
 * rotate, turn off. A near-clone of the sub portal's globe minus the printed
 * address (a firm gets one link). Never mints on open: "No link yet" until
 * the office creates it.
 */
type LinkState = { kind: 'loading' } | { kind: 'none' } | { kind: 'active'; token: string; since: string } | { kind: 'off' }

const btn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, height: 26, padding: '0 0.55rem', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-700)', fontSize: '0.74rem', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }

export default function LegalPortalLinkButton({ firmId, firmName }: { firmId: string; firmName: string }) {
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<LinkState>({ kind: 'loading' })
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setState({ kind: 'loading' })
    const { data, error } = await db.from('legal_portal_links').select('token, created_at, revoked_at').eq('firm_id', firmId).order('created_at', { ascending: false })
    if (error) {
      setState({ kind: 'none' })
      return
    }
    const rows = (data ?? []) as Array<{ token: string | null; created_at: string; revoked_at: string | null }>
    const active = rows.find((r) => !r.revoked_at)
    if (active?.token) setState({ kind: 'active', token: active.token, since: active.created_at })
    else if (rows.length) setState({ kind: 'off' })
    else setState({ kind: 'none' })
  }, [firmId])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  const mint = async (rotate: boolean) => {
    setBusy(true)
    try {
      const { data, error } = await db.rpc('mint_legal_portal_link', { p_firm_id: firmId, p_rotate: rotate })
      const res = (data ?? {}) as { token?: string; error?: string }
      if (error || res.error) {
        showToast(`Could not create the link: ${error?.message ?? res.error}`, 'error')
        return
      }
      await load()
      showToast(rotate ? 'New link minted — the old one no longer opens.' : 'The firm’s link is ready.', 'success')
    } finally {
      setBusy(false)
    }
  }
  const revoke = async () => {
    const ok = await confirmDialog({ title: 'Turn the firm’s portal off?', message: `${firmName} will get "This link is no longer active" until you create a new one. Matters stay marked as they are.`, confirmLabel: 'Turn off', danger: true })
    if (!ok) return
    setBusy(true)
    try {
      const { error } = await db.rpc('revoke_legal_portal_link', { p_firm_id: firmId })
      if (error) {
        showToast(`Could not turn it off: ${error.message}`, 'error')
        return
      }
      await load()
      showToast('The firm’s portal is off.', 'info')
    } finally {
      setBusy(false)
    }
  }
  const url = state.kind === 'active' ? `${window.location.origin}/legal?t=${state.token}` : null
  const copy = async () => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      showToast('Link copied — send it to the firm however you like.', 'success')
    } catch {
      showToast('Could not copy; select the link and copy it by hand.', 'error')
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={btn} title="The firm’s no-login portal link">🌐 Firm’s link</button>
      {open ? (
        <div role="presentation" onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 75, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}>
          <div role="dialog" aria-modal="true" aria-label="The firm’s portal link" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text)', borderRadius: 10, padding: 18, maxWidth: 560, width: '100%', boxShadow: '0 12px 40px rgba(0,0,0,0.28)' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: '1rem' }}>🌐 {firmName}’s portal link</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '0 0 10px' }}>One private link, no sign-in. It opens every account a dev has marked attorney-ready and nothing else. Turning it off is the kill switch; rotating mints a new one.</p>
            {state.kind === 'loading' ? <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>Loading…</p> : null}
            {state.kind === 'none' || state.kind === 'off' ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.84rem' }}>{state.kind === 'off' ? 'The portal is off.' : 'No link yet.'}</span>
                <button type="button" onClick={() => void mint(false)} disabled={busy} style={{ ...btn, background: 'var(--text-700)', color: 'var(--surface)', borderColor: 'var(--text-700)' }}>Create the firm’s link</button>
              </div>
            ) : null}
            {state.kind === 'active' && url ? (
              <>
                <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.78rem', background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: 5, padding: '6px 8px', wordBreak: 'break-all' }}>{url}</div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: '4px 0 10px' }}>active since {state.since.slice(0, 10)}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => void copy()} style={{ ...btn, background: 'var(--text-700)', color: 'var(--surface)', borderColor: 'var(--text-700)' }}>Copy link</button>
                  <a href={withPreviewFlag(url)} target="_blank" rel="noreferrer" style={{ ...btn, textDecoration: 'none' }}>Preview ↗</a>
                  <span style={{ flex: 1 }} />
                  <button type="button" onClick={() => void mint(true)} disabled={busy} style={btn}>Rotate</button>
                  <button type="button" onClick={() => void revoke()} disabled={busy} style={{ ...btn, color: '#b42318', borderColor: '#b42318' }}>Turn off</button>
                </div>
              </>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}><button type="button" onClick={() => setOpen(false)} style={btn}>Close</button></div>
          </div>
        </div>
      ) : null}
    </>
  )
}
