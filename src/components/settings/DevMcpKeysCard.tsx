import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { relativeTimeFrom } from '../../lib/twinConsoleDisplay'
import { DEV_MCP_ENV_VAR, DEV_MCP_PUBLIC_URL, devMcpKeyLabel, devMcpShellLine, formatDevMcpKey, splitDevMcpKeys, type DevMcpKeyRow } from '../../lib/devMcp/devMcpKeys'
import type { CSSProperties } from 'react'

// Your-account chrome (blue actions) — not the twins' violet: this card is about the dev, not the robots.
const CARD: CSSProperties = { marginTop: '1rem', border: '1px solid var(--border)', borderRadius: 8, padding: '0.85rem 1rem', background: 'var(--surface)' }
const CARD_TITLE: CSSProperties = { margin: '0 0 0.55rem', fontSize: '0.95rem', fontWeight: 700 }
const MUTED: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-muted)' }
const BTN: CSSProperties = { font: 'inherit', fontSize: '0.8rem', fontWeight: 600, padding: '0.3rem 0.7rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }
const BTN_PRIMARY: CSSProperties = { ...BTN, background: '#2563eb', color: '#fff', border: 'none' }

/**
 * Settings → Your account → Dev MCP keys (v2.3640; moved from the Digital twins tab in v2.3643 —
 * a key is personal, and that tab is the robots' fleet admin). Dev-only. A dev issues keys for
 * THEMSELF (RLS: `user_id = auth.uid()`), one per machine; the key is generated here, shown
 * once, and only its sha256 is stored. `dev-mcp` reads the app as the key's owner, GET-only.
 * `dev_mcp_credentials` is not in the generated types until the gen-types chore after the
 * push, hence the narrow casts (the twin_credentials card does the same).
 */

type Err = { message: string } | null
type KeysTable = {
  select: (c: string) => { eq: (k: string, v: string) => { order: (k: string, o: { ascending: boolean }) => Promise<{ data: DevMcpKeyRow[] | null; error: Err }> } }
  insert: (v: object) => Promise<{ error: Err }>
  update: (v: object) => { eq: (k: string, v: string) => Promise<{ error: Err }> }
}
const keysTable = () => (supabase as never as { from: (t: string) => KeysTable }).from('dev_mcp_credentials')

function randomTokenHex(bytes = 32): string {
  const a = new Uint8Array(bytes)
  crypto.getRandomValues(a)
  return Array.from(a).map((b) => b.toString(16).padStart(2, '0')).join('')
}
async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

const CODE = { display: 'block', fontSize: '0.75rem', overflowWrap: 'anywhere', padding: '0.4rem 0.5rem', background: 'var(--surface)', borderRadius: 5, border: '1px solid var(--border)' } as const

export default function DevMcpKeysCard() {
  const { user } = useAuth()
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const [rows, setRows] = useState<DevMcpKeyRow[]>([])
  const [notReady, setNotReady] = useState(false)
  const [label, setLabel] = useState('')
  const [freshKey, setFreshKey] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const userId = user?.id ?? null

  const load = useCallback(async () => {
    if (!userId) return
    const { data, error } = await keysTable().select('id, label, created_at, last_used_at, revoked_at').eq('user_id', userId).order('created_at', { ascending: false })
    // Client deploys ahead of the migration: say so instead of showing an error.
    setNotReady(!!error)
    setRows(data ?? [])
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text)
      showToast(`Copied ${what}`, 'success')
    } catch {
      showToast('Could not copy', 'error')
    }
  }

  async function issue() {
    if (!userId) return
    setBusy(true)
    try {
      const key = formatDevMcpKey(randomTokenHex(32))
      const { error } = await keysTable().insert({ user_id: userId, token_hash: await sha256Hex(key), label: devMcpKeyLabel(label) })
      if (error) throw new Error(error.message)
      setFreshKey(key)
      setLabel('')
      await load()
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function revoke(row: DevMcpKeyRow) {
    if (!(await confirmDialog({ message: `Revoke "${row.label}"? The machine using it is cut off at once.` }))) return
    setBusy(true)
    try {
      const { error } = await keysTable().update({ revoked_at: new Date().toISOString() }).eq('id', row.id)
      if (error) throw new Error(error.message)
      showToast(`Revoked "${row.label}"`, 'success')
      await load()
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  const { live, revoked } = splitDevMcpKeys(rows)
  const now = Date.now()

  return (
    <section id="settings-dev-mcp-keys" style={CARD} aria-label="Dev MCP keys">
      <h4 style={CARD_TITLE}>Dev MCP keys</h4>
      <p style={{ ...MUTED, margin: '0 0 0.6rem' }}>
        A key lets your coding agent read PipeTooling <strong>as you</strong>, read-only, through <code>{DEV_MCP_PUBLIC_URL}</code> — the same rows and numbers your sign-in sees, and every call is logged. One key per machine; it is shown once.
      </p>

      {notReady ? (
        <p style={MUTED}>Not switched on yet — the database side of this ships with the next migration push.</p>
      ) : (
        <>
          {freshKey ? (
            <div style={{ ...CARD, background: 'var(--bg-subtle)' }}>
              <h4 style={CARD_TITLE}>Your new key — shown ONCE</h4>
              <code style={CODE}>{freshKey}</code>
              <p style={{ ...MUTED, margin: '0.5rem 0 0.3rem' }}>
                Add this line to your shell profile (<code>~/.zshrc</code>), open a new terminal, and start Claude Code in the repo — <code>.mcp.json</code> reads <code>{DEV_MCP_ENV_VAR}</code>. The key never goes in the repo or in a chat.
              </p>
              <code style={CODE}>{devMcpShellLine(freshKey)}</code>
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                <button type="button" style={BTN_PRIMARY} onClick={() => void copy(devMcpShellLine(freshKey), 'the shell line')}>Copy shell line</button>
                <button type="button" style={BTN} onClick={() => void copy(freshKey, 'the key')}>Copy key</button>
                <button type="button" style={BTN} onClick={() => setFreshKey(null)}>Done — I saved it</button>
              </div>
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.6rem' }}>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Which machine? e.g. Robert's MacBook"
              aria-label="Key label"
              style={{ font: 'inherit', fontSize: '0.8rem', padding: '0.3rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-700)', minWidth: '16rem', flex: '1 1 16rem' }}
            />
            <button type="button" style={BTN_PRIMARY} disabled={busy || !userId} onClick={() => void issue()}>Issue a key</button>
          </div>

          {live.length === 0 ? (
            <p style={MUTED}>No live keys.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {live.map((r) => (
                <li key={r.id} style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.3rem 0', borderTop: '1px solid var(--border)' }}>
                  <strong style={{ fontSize: '0.82rem' }}>{r.label}</strong>
                  <span style={MUTED}>issued {relativeTimeFrom(r.created_at, now)} · {r.last_used_at ? `last used ${relativeTimeFrom(r.last_used_at, now)}` : 'never used'}</span>
                  <button type="button" style={{ ...BTN, marginLeft: 'auto' }} disabled={busy} onClick={() => void revoke(r)}>Revoke</button>
                </li>
              ))}
            </ul>
          )}
          {revoked.length > 0 ? <p style={{ ...MUTED, marginTop: '0.5rem' }}>{revoked.length} revoked: {revoked.map((r) => r.label).join(', ')}</p> : null}
        </>
      )}
    </section>
  )
}
