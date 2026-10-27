import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { relativeTimeFrom } from '../../lib/twinConsoleDisplay'
import {
  DEV_MCP_PUBLIC_URL,
  DEV_MCP_REVEAL_VERB,
  devMcpConnectorHeader,
  devMcpKeyCanCopy,
  devMcpKeyLabel,
  devMcpSetupCommand,
  devMcpShellLine,
  formatDevMcpKey,
  isMissingColumnError,
  isMissingFunctionError,
  lastRevealByKey,
  splitDevMcpKeys,
  type DevMcpKeyRow,
  type DevMcpRevealRow,
} from '../../lib/devMcp/devMcpKeys'
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
 * THEMSELF, one per machine. The key is generated here; `dev_mcp_issue_key` (v2.5899) stores
 * its sha256 for `dev-mcp`'s lookup and the key itself in Vault, so **Copy** on a live row can
 * show it again (`dev_mcp_reveal_key`: the dev's own key only, behind a confirm, one
 * `dev_mcp_calls` row per reveal). A key from before v2.5899 is hash-only and cannot be
 * copied. `dev-mcp` reads the app as the key's owner, GET-only.
 *
 * Client ahead of the migration: the read retries without `secret_id` (42703) and the issue
 * falls back to the old hash-only insert when the function is missing (PGRST202) — that key
 * is shown once, as before. The RPCs and the column are not in the generated types until the
 * gen-types chore after the push, hence the narrow casts (the twin_credentials card does the same).
 */

type Err = { message: string; code?: string | null } | null
type KeysTable = {
  select: (c: string) => { eq: (k: string, v: string) => { order: (k: string, o: { ascending: boolean }) => Promise<{ data: DevMcpKeyRow[] | null; error: Err }> } }
  insert: (v: object) => Promise<{ error: Err }>
  update: (v: object) => { eq: (k: string, v: string) => Promise<{ error: Err }> }
}
type CallsTable = {
  select: (c: string) => { eq: (k: string, v: string) => { eq: (k: string, v: string) => { order: (k: string, o: { ascending: boolean }) => { limit: (n: number) => Promise<{ data: DevMcpRevealRow[] | null; error: Err }> } } } }
}
type Rpc = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: Err }>
const keysTable = () => (supabase as never as { from: (t: string) => KeysTable }).from('dev_mcp_credentials')
const callsTable = () => (supabase as never as { from: (t: string) => CallsTable }).from('dev_mcp_calls')
const rpc: Rpc = (fn, args) => (supabase as never as { rpc: Rpc }).rpc(fn, args)

const KEY_COLUMNS = 'id, label, created_at, last_used_at, revoked_at'

function randomTokenHex(bytes = 32): string {
  const a = new Uint8Array(bytes)
  crypto.getRandomValues(a)
  return Array.from(a).map((b) => b.toString(16).padStart(2, '0')).join('')
}
async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** The clipboard when the page has one; false otherwise, and the caller selects the text instead (the nicknames window's rule, v2.5806). */
async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to the selection
  }
  return false
}

const CODE = { display: 'block', fontSize: '0.75rem', overflowWrap: 'anywhere', padding: '0.4rem 0.5rem', background: 'var(--surface)', borderRadius: 5, border: '1px solid var(--border)' } as const
const STEPS: CSSProperties = { margin: '0.35rem 0 0', paddingLeft: '1.25rem', fontSize: '0.8125rem', color: 'var(--text-700)', lineHeight: 1.5 }
const GUIDE_HREF = '/help?g=connect-a-coding-agent'

/** What the panel shows: a key just issued (`kept` false when the old hash-only insert made it) or one copied back from Vault. */
type ShownKey = { key: string; label: string; kept: boolean; fromCopy: boolean }

export default function DevMcpKeysCard() {
  const { user } = useAuth()
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const [rows, setRows] = useState<DevMcpKeyRow[]>([])
  const [notReady, setNotReady] = useState(false)
  const [secretsReady, setSecretsReady] = useState(true)
  const [lastReveal, setLastReveal] = useState<Record<string, string>>({})
  const [label, setLabel] = useState('')
  const [shown, setShown] = useState<ShownKey | null>(null)
  // The text a Copy press could not put on the clipboard: drawn under the buttons and selected, so ⌘ C takes it.
  const [selectText, setSelectText] = useState<string | null>(null)
  const selectRef = useRef<HTMLElement | null>(null)
  const [busy, setBusy] = useState(false)
  const userId = user?.id ?? null

  const load = useCallback(async () => {
    if (!userId) return
    let res = await keysTable().select(`${KEY_COLUMNS}, secret_id`).eq('user_id', userId).order('created_at', { ascending: false })
    let withSecrets = true
    if (res.error && isMissingColumnError(res.error)) {
      // Client ahead of the v2.5899 migration: the keys still list, without Copy.
      withSecrets = false
      res = await keysTable().select(KEY_COLUMNS).eq('user_id', userId).order('created_at', { ascending: false })
    }
    // Client deploys ahead of the table: say so instead of showing an error.
    setNotReady(!!res.error)
    setSecretsReady(withSecrets)
    setRows(res.data ?? [])
    const calls = await callsTable().select('credential_id, created_at').eq('user_id', userId).eq('verb', DEV_MCP_REVEAL_VERB).order('created_at', { ascending: false }).limit(500)
    setLastReveal(lastRevealByKey(calls.data ?? []))
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!selectText || !selectRef.current) return
    const sel = typeof window !== 'undefined' ? window.getSelection() : null
    if (!sel) return
    const range = document.createRange()
    range.selectNodeContents(selectRef.current)
    sel.removeAllRanges()
    sel.addRange(range)
  }, [selectText])

  async function copy(text: string, what: string) {
    if (await copyText(text)) {
      setSelectText(null)
      showToast(`Copied ${what}`, 'success')
      return
    }
    setSelectText(text)
    showToast('Could not copy. The text is selected below, press ⌘ C.', 'warning')
  }

  async function issue() {
    if (!userId) return
    setBusy(true)
    try {
      const key = formatDevMcpKey(randomTokenHex(32))
      const keyLabel = devMcpKeyLabel(label)
      let kept = true
      let { error } = await rpc('dev_mcp_issue_key', { p_token: key, p_label: keyLabel })
      if (error && isMissingFunctionError(error)) {
        // Client ahead of the v2.5899 migration: the old way, hash only — this key cannot be copied later.
        kept = false
        ;({ error } = await keysTable().insert({ user_id: userId, token_hash: await sha256Hex(key), label: keyLabel }))
      }
      if (error) throw new Error(error.message)
      setSelectText(null)
      setShown({ key, label: keyLabel, kept, fromCopy: false })
      setLabel('')
      await load()
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function reveal(row: DevMcpKeyRow) {
    const ok = await confirmDialog({
      title: `Copy "${row.label}"?`,
      message: 'The key is shown here and put on the clipboard. The copy is logged with your name.',
      confirmLabel: 'Copy',
    })
    if (!ok) return
    setBusy(true)
    try {
      const { data, error } = await rpc('dev_mcp_reveal_key', { p_credential_id: row.id })
      if (error) throw new Error(error.message)
      const key = typeof data === 'string' ? data : ''
      if (!key) throw new Error('No key came back. Issue a new one.')
      setSelectText(null)
      setShown({ key, label: row.label, kept: true, fromCopy: true })
      await copy(key, 'the key')
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
        A key lets Claude read PipeTooling <strong>as you</strong>, read-only, through <code>{DEV_MCP_PUBLIC_URL}</code> — the same rows and numbers your sign-in sees, and every call is logged. One key per machine. <strong>Copy</strong> shows a key again and is logged with your name; a key issued before 2026-10-26 cannot be copied.{' '}
        <Link to={GUIDE_HREF}>How do I connect Claude with it?</Link>
      </p>

      {notReady ? (
        <p style={MUTED}>Not switched on yet — the database side of this ships with the next migration push.</p>
      ) : (
        <>
          {shown ? (
            <div style={{ ...CARD, background: 'var(--bg-subtle)' }}>
              <h4 style={CARD_TITLE}>{shown.fromCopy ? `Your key for "${shown.label}"` : shown.kept ? 'Your new key' : 'Your new key — shown ONCE'}</h4>
              <code style={CODE}>{shown.key}</code>
              <p style={{ ...MUTED, margin: '0.6rem 0 0' }}>
                <strong>To use it in Claude Code on this Mac</strong> — three steps, no typing:
              </p>
              <ol style={STEPS}>
                <li>Press <strong>Copy setup command</strong> below.</li>
                <li>Open <strong>Terminal</strong> (press ⌘ and Space together, type <em>Terminal</em>, press Return). Paste (⌘ V) and press Return. It answers <em>Saved</em>.</li>
                <li>Quit Claude Code (⌘ Q) and open it again in the PipeTooling folder. In a new chat type <em>call whoami on dev-mcp</em> — it answers with your name.</li>
              </ol>
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                <button type="button" style={BTN_PRIMARY} onClick={() => void copy(devMcpSetupCommand(shown.key), 'the setup command')}>Copy setup command</button>
                <button type="button" style={BTN} onClick={() => void copy(devMcpShellLine(shown.key), 'the shell line')}>Copy shell line</button>
                <button type="button" style={BTN} onClick={() => void copy(shown.key, 'the key')}>Copy key</button>
              </div>
              <p style={{ ...MUTED, margin: '0.7rem 0 0' }}>
                <strong>To use it on claude.ai, Claude Desktop or your phone</strong> — no Terminal at all, if your account shows the <em>Request headers</em> section (it is rolling out):
              </p>
              <ol style={STEPS}>
                <li>On claude.ai open <strong>Customize → Connectors → Add custom connector</strong>. Name it <em>PipeTooling</em>; the address is <code>{DEV_MCP_PUBLIC_URL}</code>.</li>
                <li>Choose <strong>No sign-in</strong>. Under <strong>Request headers</strong> pick <code>authorization</code> and paste the header value from the button below. Press Add.</li>
                <li>Start a chat and turn the connector on under the ＋ menu. If there is no <em>Request headers</em> section, use the Terminal steps above instead — that account does not have it yet.</li>
              </ol>
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                <button type="button" style={BTN} onClick={() => void copy(devMcpConnectorHeader(shown.key), 'the header value')}>Copy header value</button>
                <button type="button" style={BTN} onClick={() => { setShown(null); setSelectText(null) }}>Done — I saved it</button>
              </div>
              {selectText ? (
                <>
                  <p style={{ ...MUTED, margin: '0.6rem 0 0.2rem' }}>The clipboard is not available here. The text below is selected: press ⌘ C to copy it.</p>
                  <code ref={selectRef} style={CODE} data-testid="dev-mcp-select-text">{selectText}</code>
                </>
              ) : null}
              <p style={{ ...MUTED, margin: '0.6rem 0 0' }}>
                {shown.kept
                  ? 'The key never goes in a chat or in the repo. You can copy it again from this card; each copy is logged with your name.'
                  : 'The key never goes in a chat or in the repo. Lose it, and you issue another; the old one keeps working until you revoke it.'}
              </p>
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
              {live.map((r) => {
                const copiedAt = lastReveal[r.id]
                return (
                <li key={r.id} style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.3rem 0', borderTop: '1px solid var(--border)' }}>
                  <strong style={{ fontSize: '0.82rem' }}>{r.label}</strong>
                  <span style={MUTED}>
                    issued {relativeTimeFrom(r.created_at, now)} · {r.last_used_at ? `last used ${relativeTimeFrom(r.last_used_at, now)}` : 'never used'}
                    {copiedAt ? ` · copied ${relativeTimeFrom(copiedAt, now)}` : ''}
                  </span>
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    {devMcpKeyCanCopy(r) ? (
                      <button type="button" style={BTN} disabled={busy} onClick={() => void reveal(r)}>Copy</button>
                    ) : secretsReady ? (
                      <span style={MUTED} title="Issued before keys were kept, so there is nothing to copy. Issue a new key, set the machine up with it, then revoke this one.">cannot be copied</span>
                    ) : null}
                    <button type="button" style={BTN} disabled={busy} onClick={() => void revoke(r)}>Revoke</button>
                  </span>
                </li>
                )
              })}
            </ul>
          )}
          {revoked.length > 0 ? <p style={{ ...MUTED, marginTop: '0.5rem' }}>{revoked.length} revoked: {revoked.map((r) => r.label).join(', ')}</p> : null}
        </>
      )}
    </section>
  )
}
