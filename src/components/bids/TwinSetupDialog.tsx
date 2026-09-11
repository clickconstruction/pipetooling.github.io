/**
 * "Set up on this Mac" (Price Matrix PR 6 — docs/PRICE_MATRIX_PLAN.md): the
 * one-click, one-paste way to connect Claude Desktop to a robot. The dialog
 * asks twin-setup to mint a ten-minute, single-use SETUP CODE for the twin and
 * wraps it in a Terminal command (`buildDesktopSetupCommandFromCode`). Pasted
 * into Terminal, the command redeems the code — the key is minted server-side
 * and written straight into Desktop's config, never shown — restarts Claude
 * Desktop, and puts the robot's kickoff on the clipboard. The three hand
 * steps (issue a key, paste it, quit/reopen) are gone; what is left is copy,
 * paste, Return.
 *
 * No auth context: the mint call rides the session the supabase client holds.
 * Fail-soft: a project without twin-setup deployed shows the error it returns.
 */
import { createPortal } from 'react-dom'
import { useEffect, useState, type CSSProperties } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'

import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { buildDesktopSetupCommandFromCode, twinMcpConnectorUrl, twinSetupUrl } from '../../lib/bids/desktopKickoff'
import { BTN, BTN_PRIMARY, MUTED, PROMPT_PRE, TWIN_VIOLET } from './twinConsoleStyles'

export type TwinSetupTarget =
  | { twinUserId: string; twinEmail: string; kind: 'estimator' | 'pricer' }
  | { kind: 'estimator' | 'pricer' }

export type TwinSetupDialogProps = {
  open: boolean
  onClose: () => void
  target: TwinSetupTarget
}

type MintResponse = {
  code: string
  expires_at: string
  twin_email: string
  twin_kind: 'estimator' | 'pricer'
  label: string
  setup_url: string
  connector_url: string
}

const MODAL_Z = 10070

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: MODAL_Z,
  background: 'rgba(0,0,0,0.45)',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  padding: '1.5rem 1rem',
  overflowY: 'auto',
}

const panel: CSSProperties = {
  background: 'var(--surface)',
  borderRadius: 8,
  maxWidth: 640,
  width: '100%',
  boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
  padding: '1.1rem 1.25rem 0.9rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.8rem',
}

const eyebrow: CSSProperties = { fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const stepNo: CSSProperties = { flex: 'none', width: '1.35rem', height: '1.35rem', borderRadius: 999, background: TWIN_VIOLET, color: '#fff', fontSize: '0.72rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }
const stepRow: CSSProperties = { display: 'flex', gap: '0.6rem', alignItems: 'flex-start', fontSize: '0.86rem', color: 'var(--text-strong)' }

function describeTarget(t: TwinSetupTarget): string {
  if ('twinEmail' in t) return t.twinEmail
  return t.kind === 'pricer' ? 'the pricing robot' : 'the robot estimator'
}

function mmss(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function TwinSetupDialog({ open, onClose, target }: TwinSetupDialogProps) {
  const { showToast } = useToastContext()
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [minted, setMinted] = useState<{ command: string; res: MintResponse } | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())

  // Reset every time the dialog opens for a (possibly different) twin.
  useEffect(() => {
    if (open) {
      setLabel('')
      setError(null)
      setMinted(null)
      setBusy(false)
    }
  }, [open, target])

  useEffect(() => {
    if (!open || !minted) return
    const t = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [open, minted])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  async function mint() {
    setBusy(true)
    setError(null)
    try {
      const body: Record<string, unknown> = { action: 'mint', label: label.trim() }
      if ('twinUserId' in target) body.twin_user_id = target.twinUserId
      else body.kind = target.kind
      const { data, error: fnErr } = await supabase.functions.invoke('twin-setup', { body })
      if (fnErr) {
        let msg = fnErr.message
        if (fnErr instanceof FunctionsHttpError && fnErr.context?.json) {
          try {
            const b = (await fnErr.context.json()) as { error?: string } | null
            if (b?.error) msg = b.error
          } catch {
            /* keep msg */
          }
        }
        throw new Error(msg)
      }
      const res = data as MintResponse | null
      if (!res?.code) throw new Error('twin-setup returned no code')
      const supaUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? ''
      const command = buildDesktopSetupCommandFromCode({
        connectorUrl: res.connector_url || twinMcpConnectorUrl(supaUrl),
        setupUrl: res.setup_url || twinSetupUrl(supaUrl),
        code: res.code,
      })
      setMinted({ command, res })
      setNowMs(Date.now())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text)
      showToast(`Copied ${what}`, 'success')
    } catch {
      showToast('Could not copy', 'error')
    }
  }

  const expiresMs = minted ? new Date(minted.res.expires_at).getTime() - nowMs : 0
  const expired = minted != null && expiresMs <= 0
  const who = describeTarget(target)
  const isPricer = ('twinEmail' in target ? target.kind : target.kind) === 'pricer'

  return createPortal(
    <div style={overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-modal="true" aria-labelledby="twin-setup-title" style={panel}>
        <div>
          <div style={eyebrow}>Claude Desktop · one-time setup</div>
          <h3 id="twin-setup-title" style={{ margin: '0.15rem 0 0', fontSize: '1.05rem' }}>Set up {who} on this Mac</h3>
          <p style={{ ...MUTED, margin: '0.35rem 0 0' }}>
            One command connects Claude Desktop to the robot. The robot key is made on the server and written straight into Desktop's
            config — nobody sees it, nothing to paste but the command. Mac only; needs Node 18+ from nodejs.org (the command says so if
            it is missing).
          </p>
        </div>

        {!minted ? (
          <>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem', color: 'var(--text-700)' }}>
              Whose Mac is this? <span style={MUTED}>(becomes the key's label, so it can be revoked on its own later)</span>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Wendi's MacBook"
                autoFocus
                style={{ font: 'inherit', fontSize: '0.86rem', padding: '0.4rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-strong)' }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !busy) void mint() }}
              />
            </label>
            {error ? <div style={{ fontSize: '0.8rem', color: 'var(--text-red-700)', background: 'var(--bg-red-tint)', borderRadius: 6, padding: '0.4rem 0.6rem' }}>{error}</div> : null}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" style={BTN} onClick={onClose}>Cancel</button>
              <button type="button" style={BTN_PRIMARY} disabled={busy} onClick={() => void mint()}>
                {busy ? 'Making the command…' : 'Make my setup command'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              <div style={stepRow}>
                <span style={stepNo}>1</span>
                <span style={{ flex: 1 }}>
                  <b>Copy the command.</b>{' '}
                  <span style={MUTED}>
                    It carries a one-time code for {minted.res.twin_email}
                    {expired ? ' — expired.' : ` — good for ${mmss(expiresMs)} more, one use.`}
                  </span>
                </span>
                <button type="button" style={BTN_PRIMARY} disabled={expired} onClick={() => void copy(minted.command, 'the setup command')}>
                  Copy the command
                </button>
              </div>
              <div style={stepRow}>
                <span style={stepNo}>2</span>
                <span><b>Open Terminal.</b> <span style={MUTED}>Press ⌘ Space, type <i>Terminal</i>, press Return.</span></span>
              </div>
              <div style={stepRow}>
                <span style={stepNo}>3</span>
                <span>
                  <b>Paste, press Return.</b>{' '}
                  <span style={MUTED}>
                    Claude Desktop quits and reopens by itself with the robot connected, and the robot's kickoff lands on your clipboard.
                  </span>
                </span>
              </div>
              <div style={stepRow}>
                <span style={stepNo}>4</span>
                <span>
                  <b>In Claude Desktop, start a new incognito chat and paste.</b>{' '}
                  <span style={MUTED}>
                    {isPricer
                      ? 'The robot reads its brief, then prices every queued request, oldest first, and asks you where the plans decide.'
                      : 'The robot reads its brief and works the shadow queue one bid at a time.'}
                  </span>
                </span>
              </div>
            </div>
            {expired ? (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-amber-800)', background: 'var(--bg-amber-tint)', borderRadius: 6, padding: '0.4rem 0.6rem' }}>
                That command's code expired before it was used. Make a fresh one — nothing was changed.
              </div>
            ) : null}
            <details>
              <summary style={{ ...MUTED, cursor: 'pointer' }}>What the command does, line by line</summary>
              <pre style={PROMPT_PRE} data-testid="twin-setup-command">{minted.command}</pre>
            </details>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
              <span style={{ ...MUTED, marginRight: 'auto' }}>Key label: <b>{minted.res.label}</b> · revoke it any time on Settings → Digital twins.</span>
              {expired ? (
                <button type="button" style={BTN_PRIMARY} disabled={busy} onClick={() => { setMinted(null) }}>Make a fresh one</button>
              ) : null}
              <button type="button" style={BTN} onClick={onClose}>Done</button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
