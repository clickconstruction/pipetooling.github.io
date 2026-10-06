import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../../lib/supabase'
import { useToastContext } from '../../../contexts/ToastContext'
import { useConfirmDialog } from '../../../contexts/ConfirmDialogContext'
import { calendarYmdInAppTzFromIso } from '../../../utils/dateUtils'
import { readEdgeFunctionErrorBody } from '../../../lib/readEdgeFunctionErrorBody'
import { LEGAL_FIRM_LINK_KIND, legalFirmLinkAddresses, legalFirmLinkSentLine, type LegalFirmLinkSentRow } from '../../../lib/legal/legalFirmLink'
import { rotateLinkMessage, turnOffLinkMessage } from '../../../lib/legal/legalPortalLinkWords'
import { COPY_ONLY_AT_MINT, firmPortalUrls, portalLinkView, type PortalLinkRow, type PortalLinkView } from '../../../lib/legal/legalPortalLinkState'

const db = supabase as unknown as SupabaseClient

/**
 * The firm's link (Legal portal PR 3), on the Legal desk header: one token
 * link per firm — create, copy, preview (office preview flag, uncounted),
 * rotate, turn off. A near-clone of the sub portal's globe minus the printed
 * address (a firm gets one link). Never mints on open: "No link yet" until
 * the office creates it.
 *
 * v2.4624 (punch list #85 item 21): **Send the firm their link** — the welcome email
 * (`legal-send-firm-link`) to the firm's address on file and/or typed ones, and the line
 * *Sent to … on …* read back from the filed copy (`sent_documents`, under this link). A Rotate
 * starts the line over: the emailed link no longer opens.
 *
 * Hash-only at rest (punch list #85, item 22): the table stops giving the office the raw token, so the
 * address is shown only in the session that created or rotated the link (the mint RPC's answer).
 * Preview always works, by the firm's id, and Send the link always works: the function reads the
 * token on the server (`legalPortalLinkState.ts`).
 */
type LinkState = { kind: 'loading' } | PortalLinkView

/** The columns the office may read once the raw token leaves the table (punch list #85 item 22, migration 20261006072618). */
const LINK_COLUMNS = 'id, firm_id, created_at, revoked_at, token_hash'

const btn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, height: 26, padding: '0 0.55rem', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-700)', fontSize: '0.74rem', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }
const field: CSSProperties = { font: 'inherit', fontSize: '0.82rem', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)', width: '100%', boxSizing: 'border-box' }

export default function LegalPortalLinkButton({ firmId, firmName }: { firmId: string; firmName: string }) {
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<LinkState>({ kind: 'loading' })
  const [busy, setBusy] = useState(false)
  const [onFile, setOnFile] = useState('')
  const [useOnFile, setUseOnFile] = useState(true)
  const [typed, setTyped] = useState('')
  const [note, setNote] = useState('')
  const [sentLine, setSentLine] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  /** The token this session minted: once the table keeps only the hash, the only time the office holds the raw link. */
  const [minted, setMinted] = useState<{ token: string; since: string } | null>(null)

  const load = useCallback(async (justMinted: { token: string; since: string } | null = null) => {
    setState({ kind: 'loading' })
    // The firm's address on file (Settings → Collections law firm), offered as a ticked box.
    void db.from('legal_firms').select('email').eq('id', firmId).maybeSingle().then(({ data: f }) => setOnFile(String((f as { email?: string | null } | null)?.email ?? '').trim()))
    // A link is live when it is not revoked; its raw token is shown only while the table still gives it
    // to the office (before item 22's migration) or in the session that minted it. Sending never needs it:
    // legal-send-firm-link reads the token on the server.
    let res: { data: unknown; error: unknown } = await db.from('legal_portal_links').select(`${LINK_COLUMNS}, token`).eq('firm_id', firmId).order('created_at', { ascending: false })
    if (res.error) res = await db.from('legal_portal_links').select(LINK_COLUMNS).eq('firm_id', firmId).order('created_at', { ascending: false })
    if (res.error) {
      setState({ kind: 'none' })
      return
    }
    const rows = (res.data ?? []) as PortalLinkRow[]
    const view = portalLinkView(rows, justMinted)
    setState(view)
    const active = view.kind === 'active' ? view : null
    if (!active?.id) {
      setSentLine(null)
      return
    }
    // The welcome email's filed copy, under this link (fail-soft: no line when it cannot be read).
    const sent = await db.from('sent_documents').select('recipient_emails, sent_at, sent_by_name').eq('kind', LEGAL_FIRM_LINK_KIND).eq('source_table', 'legal_portal_links').eq('source_id', active.id)
    setSentLine(sent.error ? null : legalFirmLinkSentLine((sent.data ?? []) as LegalFirmLinkSentRow[], calendarYmdInAppTzFromIso))
  }, [firmId])

  useEffect(() => {
    if (open) void load(minted)
  }, [open, load]) // eslint-disable-line react-hooks/exhaustive-deps -- the minted token is passed when it changes, by mint()

  const mint = async (rotate: boolean) => {
    if (rotate) {
      const ok = await confirmDialog({ title: 'Mint a new link for the firm?', message: rotateLinkMessage(firmName), confirmLabel: 'Mint a new link', danger: true })
      if (!ok) return
    }
    setBusy(true)
    try {
      const { data, error } = await db.rpc('mint_legal_portal_link', { p_firm_id: firmId, p_rotate: rotate })
      const res = (data ?? {}) as { token?: string | null; activeSince?: string; error?: string }
      if (error || res.error) {
        showToast(`Could not create the link: ${error?.message ?? res.error}`, 'error')
        return
      }
      const fresh = res.token ? { token: res.token, since: res.activeSince ?? new Date().toISOString() } : minted
      setMinted(fresh)
      await load(fresh)
      showToast(rotate ? 'New link minted. The old one no longer opens, so send the firm the new one.' : 'The firm’s link is ready.', 'success')
    } finally {
      setBusy(false)
    }
  }
  const revoke = async () => {
    const ok = await confirmDialog({ title: 'Turn the firm’s portal off?', message: turnOffLinkMessage(firmName), confirmLabel: 'Turn off', danger: true })
    if (!ok) return
    setBusy(true)
    try {
      const { error } = await db.rpc('revoke_legal_portal_link', { p_firm_id: firmId })
      if (error) {
        showToast(`Could not turn it off: ${error.message}`, 'error')
        return
      }
      await load(minted)
      showToast('The firm’s portal is off.', 'info')
    } finally {
      setBusy(false)
    }
  }
  const urls = state.kind === 'active' ? firmPortalUrls(window.location.origin, firmId, state.token) : null
  const url = urls?.copyUrl ?? null
  const copy = async () => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      showToast('Link copied — send it to the firm however you like.', 'success')
    } catch {
      showToast('Could not copy; select the link and copy it by hand.', 'error')
    }
  }
  const addresses = legalFirmLinkAddresses({ onFile, useOnFile, typed })
  const send = async () => {
    if (state.kind !== 'active') return
    if (addresses.error) {
      setSendError(addresses.error)
      return
    }
    setBusy(true)
    setSendError(null)
    try {
      const { data, error } = await supabase.functions.invoke('legal-send-firm-link', { body: { firmId, useOnFile, typed, note, ...(state.token ? { token: state.token } : {}) } })
      const res = (data ?? {}) as { ok?: boolean; error?: string; sentTo?: string[] }
      if (error || !res.ok) {
        setSendError((error ? await readEdgeFunctionErrorBody(error) : null) ?? res.error ?? 'The email did not go. Try again in a minute.')
        return
      }
      setTyped('')
      setNote('')
      showToast(`Sent to ${(res.sentTo ?? addresses.emails).join(', ')}.`, 'success')
      await load(minted)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={btn} title="The firm’s no-login portal link">🌐 Firm’s link</button>
      {open ? (
        <div role="presentation" onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 775, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(14px + var(--app-top-chrome, 0px)) 14px 14px' }}>
          <div role="dialog" aria-modal="true" aria-label="The firm’s portal link" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text)', borderRadius: 10, padding: 18, maxWidth: 560, width: '100%', maxHeight: '100%', overflowY: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,0.28)' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: '1rem' }}>🌐 {firmName}’s portal link</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '0 0 10px' }}>One private link, no sign-in. It opens every account a dev has marked attorney-ready and nothing else. Turning it off is the kill switch; rotating mints a new one.</p>
            {state.kind === 'loading' ? <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>Loading…</p> : null}
            {state.kind === 'none' || state.kind === 'off' ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.84rem' }}>{state.kind === 'off' ? 'The portal is off.' : 'No link yet.'}</span>
                <button type="button" onClick={() => void mint(false)} disabled={busy} style={{ ...btn, background: 'var(--text-700)', color: 'var(--surface)', borderColor: 'var(--text-700)' }}>Create the firm’s link</button>
              </div>
            ) : null}
            {state.kind === 'active' ? (
              <>
                {url ? (
                  <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.78rem', background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: 5, padding: '6px 8px', wordBreak: 'break-all' }}>{url}</div>
                ) : (
                  <div data-legal-link-hidden style={{ fontSize: '0.8rem', background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: 5, padding: '6px 8px', color: 'var(--text-muted)' }}>The link is live. {COPY_ONLY_AT_MINT}</div>
                )}
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: '4px 0 10px' }}>active since {calendarYmdInAppTzFromIso(state.since)}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {url ? <button type="button" onClick={() => void copy()} style={{ ...btn, background: 'var(--text-700)', color: 'var(--surface)', borderColor: 'var(--text-700)' }}>Copy link</button> : null}
                  {urls ? <a href={urls.previewUrl} target="_blank" rel="noreferrer" style={{ ...btn, textDecoration: 'none' }}>Preview ↗</a> : null}
                  <span style={{ flex: 1 }} />
                  <button type="button" onClick={() => void mint(true)} disabled={busy} style={btn}>Rotate</button>
                  <button type="button" onClick={() => void revoke()} disabled={busy} style={{ ...btn, color: '#b42318', borderColor: '#b42318' }}>Turn off</button>
                </div>
                <div data-legal-send-link style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'grid', gap: 8 }}>
                  <div style={{ fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Send the firm their link</div>
                  {sentLine ? <div data-legal-link-sent style={{ fontSize: '0.8rem', color: '#067647' }}>✓ {sentLine}</div> : <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Not sent from here yet.</div>}
                  {onFile ? (
                    <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.84rem' }}>
                      <input type="checkbox" checked={useOnFile} onChange={(e) => setUseOnFile(e.target.checked)} /> {onFile} <span style={{ color: 'var(--text-muted)' }}>· on file</span>
                    </label>
                  ) : null}
                  <input aria-label="Another address" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={onFile ? 'Another address (optional)' : 'The firm’s email address'} style={field} />
                  <textarea aria-label="A line for the email" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Add a line to the email (optional)" style={{ ...field, resize: 'vertical' }} />
                  {sendError ? <div role="alert" style={{ fontSize: '0.8rem', color: '#b42318' }}>{sendError}</div> : null}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => void send()} disabled={busy || Boolean(addresses.error)} style={{ ...btn, background: 'var(--text-700)', color: 'var(--surface)', borderColor: 'var(--text-700)' }}>{sentLine ? 'Send it again' : 'Send the link'}</button>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>From the company, signed by you. A reply comes to you. It asks the firm to add the people who should get our emails.</span>
                  </div>
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
