import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { FunctionsHttpError } from '@supabase/supabase-js'

/**
 * Settings → Digital twins (dev-only; docs/DIGITAL_TWINS_PLAN.md + docs/twins/TWIN_HARNESS.md):
 * the fleet console — everything an operator needs in one place: endpoints to hand a
 * partner, mint a twin, flip its safety rung, issue/revoke per-twin tokens (plaintext
 * shown ONCE; only the sha256 is stored), and the recent run ledger. The one thing that
 * deliberately does NOT live here is the master TWIN_LOGIN_SECRET's value — an in-app
 * copy of a session-minting master key would defeat its purpose; rotation stays a CLI act.
 * Twin tables aren't in generated types yet — cast queries, fail-soft (Banking quirk-#17).
 */

type TwinRow = { id: string; name: string | null; email: string; role: string; read_only: boolean }
type CredRow = { id: string; twin_user_id: string; label: string; created_at: string; last_used_at: string | null; revoked_at: string | null }
type RunRow = { twin_user_id: string; mission: string; notes: string | null; started_at: string }

const FN_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`

function randomTokenHex(bytes = 32): string {
  const a = new Uint8Array(bytes)
  crypto.getRandomValues(a)
  return Array.from(a).map((b) => b.toString(16).padStart(2, '0')).join('')
}
async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

const CARD: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '0.8rem 1rem', marginBottom: '0.9rem', background: 'var(--surface)' }
const H: React.CSSProperties = { margin: '0 0 0.4rem', fontSize: '0.95rem' }
const MUTED: React.CSSProperties = { fontSize: '0.8rem', color: 'var(--text-muted)' }
const BTN: React.CSSProperties = { font: 'inherit', fontSize: '0.78rem', fontWeight: 600, padding: '0.3rem 0.7rem', border: '1px solid var(--border-strong)', borderRadius: 5, background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }
const BTN_PRIMARY: React.CSSProperties = { ...BTN, background: '#3b82f6', color: '#fff', border: 'none' }

export default function DigitalTwinsPanel() {
  const { showToast } = useToastContext()
  const [twins, setTwins] = useState<TwinRow[]>([])
  const [creds, setCreds] = useState<CredRow[]>([])
  const [runs, setRuns] = useState<RunRow[]>([])
  const [available, setAvailable] = useState(true)
  const [busy, setBusy] = useState(false)
  const [mintName, setMintName] = useState('')
  const [tokenLabelByTwin, setTokenLabelByTwin] = useState<Record<string, string>>({})
  const [freshToken, setFreshToken] = useState<{ twinEmail: string; token: string } | null>(null)

  const loadAll = useCallback(async () => {
    try {
      const sb = supabase as never as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (k: string, v: boolean) => { order: (k: string) => Promise<{ data: TwinRow[] | null; error: unknown }> }
            order: (k: string, o?: { ascending: boolean }) => { limit: (n: number) => Promise<{ data: unknown[] | null; error: unknown }> }
          }
        }
      }
      const t = await sb.from('users').select('id, name, email, role, read_only').eq('is_digital_twin', true).order('email')
      if (t.error) {
        setAvailable(false)
        return
      }
      setTwins(t.data ?? [])
      const c = await sb.from('twin_credentials').select('id, twin_user_id, label, created_at, last_used_at, revoked_at').order('created_at', { ascending: false }).limit(100)
      setCreds((c.data as CredRow[] | null) ?? [])
      const r = await sb.from('twin_runs').select('twin_user_id, mission, notes, started_at').order('started_at', { ascending: false }).limit(15)
      setRuns((r.data as RunRow[] | null) ?? [])
    } catch {
      setAvailable(false)
    }
  }, [])
  useEffect(() => {
    void loadAll()
  }, [loadAll])

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text)
      showToast(`Copied ${what}`, 'success')
    } catch {
      showToast('Could not copy', 'error')
    }
  }

  async function toggleRung(t: TwinRow) {
    setBusy(true)
    try {
      const { error } = await supabase.from('users').update({ read_only: !t.read_only }).eq('id', t.id)
      if (error) throw new Error(error.message)
      showToast(!t.read_only ? `${t.email} → read-only (tester rung)` : `${t.email} → fenced writes (rung 2 — the twin write-fence binds it)`, 'success')
      await loadAll()
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function mintTwin() {
    setBusy(true)
    try {
      const ns = twins.map((t) => Number(/^twin-estimator-(\d+)@/.exec(t.email)?.[1] ?? 0))
      const next = Math.max(0, ...ns) + 1
      const email = `twin-estimator-${next}@twins.pipetooling.local`
      const body = { email, password: randomTokenHex(12), role: 'estimator', name: mintName.trim() || `Twin Estimator ${next}` }
      const { error: eFn } = await supabase.functions.invoke('create-user', { body })
      if (eFn) {
        let msg = eFn.message
        if (eFn instanceof FunctionsHttpError && eFn.context?.json) {
          try {
            const b = (await eFn.context.json()) as { error?: string } | null
            if (b?.error) msg = b.error
          } catch { /* keep msg */ }
        }
        throw new Error(msg)
      }
      const { error: flagErr } = await (supabase as never as {
        from: (t: string) => { update: (v: object) => { eq: (k: string, v: string) => Promise<{ error: { message: string } | null }> } }
      })
        .from('users')
        .update({ is_digital_twin: true, read_only: true })
        .eq('email', email)
      if (flagErr) throw new Error(`Created but not flagged: ${flagErr.message} — flag ${email} by hand`)
      setMintName('')
      showToast(`Minted ${email} (estimator, flagged, read-only)`, 'success')
      await loadAll()
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function issueToken(t: TwinRow) {
    setBusy(true)
    try {
      const token = randomTokenHex(32)
      const token_hash = await sha256Hex(token)
      const { error } = await (supabase as never as {
        from: (t: string) => { insert: (v: object) => Promise<{ error: { message: string } | null }> }
      })
        .from('twin_credentials')
        .insert({ twin_user_id: t.id, token_hash, label: (tokenLabelByTwin[t.id] ?? '').trim() || 'unlabeled' })
      if (error) throw new Error(error.message)
      setFreshToken({ twinEmail: t.email, token })
      setTokenLabelByTwin((p) => ({ ...p, [t.id]: '' }))
      await loadAll()
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function revokeToken(c: CredRow) {
    setBusy(true)
    try {
      const { error } = await (supabase as never as {
        from: (t: string) => { update: (v: object) => { eq: (k: string, v: string) => Promise<{ error: { message: string } | null }> } }
      })
        .from('twin_credentials')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', c.id)
      if (error) throw new Error(error.message)
      showToast(`Revoked "${c.label}"`, 'success')
      await loadAll()
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!available) {
    return <p style={MUTED}>Digital-twin tables aren’t deployed yet (migrations 20260828060000/070000/080000) — this console lights up once they land.</p>
  }

  const twinName = (id: string) => twins.find((t) => t.id === id)?.email ?? id.slice(0, 8)

  return (
    <div>
      {freshToken ? (
        <div style={{ ...CARD, border: '1.5px solid #8b5cf6', background: 'var(--bg-violet-100)' }}>
          <h4 style={H}>New token for {freshToken.twinEmail} — shown ONCE</h4>
          <code style={{ display: 'block', fontSize: '0.75rem', overflowWrap: 'anywhere', padding: '0.4rem 0.5rem', background: 'var(--surface)', borderRadius: 5, border: '1px solid var(--border)' }}>{freshToken.token}</code>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button type="button" style={BTN_PRIMARY} onClick={() => void copy(freshToken.token, 'the token')}>Copy token</button>
            <button type="button" style={BTN} onClick={() => setFreshToken(null)}>Done — I saved it</button>
          </div>
          <p style={{ ...MUTED, marginBottom: 0, marginTop: '0.4rem' }}>Only its hash is stored — this value cannot be shown again. Hand it to the partner with docs/twins/TWIN_HARNESS.md.</p>
        </div>
      ) : null}

      <div style={CARD}>
        <h4 style={H}>Endpoints — hand these to a harness or MCP client</h4>
        {[
          { label: 'twin-login (sign-in mint)', url: `${FN_BASE}/twin-login` },
          { label: 'twin-mcp (MCP server)', url: `${FN_BASE}/twin-mcp` },
        ].map((e) => (
          <div key={e.url} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.25rem 0', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, minWidth: '11rem' }}>{e.label}</span>
            <code style={{ fontSize: '0.72rem', overflowWrap: 'anywhere' }}>{e.url}</code>
            <button type="button" style={BTN} onClick={() => void copy(e.url, e.label)}>Copy</button>
          </div>
        ))}
        <p style={{ ...MUTED, margin: '0.4rem 0 0' }}>
          Auth: the twin’s token as <code>X-Twin-Token</code> (or <code>Authorization: Bearer</code>). Fleet emails: <code>twin-estimator-&lt;n&gt;@twins.pipetooling.local</code>. Onboarding doc: <code>docs/twins/TWIN_HARNESS.md</code>.
          The master secret’s value is deliberately not shown here — rotate it (fleet kill switch) with <code>supabase secrets set TWIN_LOGIN_SECRET=…</code>.
        </p>
      </div>

      <div style={CARD}>
        <h4 style={H}>Fleet ({twins.length})</h4>
        {twins.length === 0 ? <p style={MUTED}>No twins yet — mint one below.</p> : null}
        {twins.map((t) => {
          const tCreds = creds.filter((c) => c.twin_user_id === t.id)
          return (
            <div key={t.id} style={{ borderTop: '1px solid var(--border)', padding: '0.55rem 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>🤖 {t.name ?? t.email}</span>
                <code style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t.email}</code>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, borderRadius: 999, padding: '0.08rem 0.55rem', background: t.read_only ? 'var(--bg-amber-tint)' : 'var(--bg-green-tint)', color: t.read_only ? 'var(--text-amber-800)' : 'var(--text-green-800)' }}>
                  {t.read_only ? 'rung 1 · read-only' : 'rung 2 · fenced writes'}
                </span>
                <button type="button" style={BTN} disabled={busy} onClick={() => void toggleRung(t)}>
                  {t.read_only ? 'Graduate to fenced writes' : 'Back to read-only'}
                </button>
              </div>
              <div style={{ marginTop: '0.35rem', paddingLeft: '1.2rem' }}>
                {tCreds.length === 0 ? <span style={MUTED}>No tokens issued.</span> : null}
                {tCreds.map((c) => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.76rem', margin: '0.15rem 0', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600 }}>{c.label}</span>
                    <span style={MUTED}>issued {c.created_at.slice(0, 10)}{c.last_used_at ? ` · last used ${c.last_used_at.slice(0, 10)}` : ' · never used'}</span>
                    {c.revoked_at ? (
                      <span style={{ color: 'var(--text-red-700)', fontWeight: 700 }}>revoked</span>
                    ) : (
                      <button type="button" style={{ ...BTN, fontSize: '0.7rem', padding: '0.14rem 0.5rem' }} disabled={busy} onClick={() => void revokeToken(c)}>Revoke</button>
                    )}
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.25rem' }}>
                  <input
                    type="text"
                    value={tokenLabelByTwin[t.id] ?? ''}
                    onChange={(e) => setTokenLabelByTwin((p) => ({ ...p, [t.id]: e.target.value }))}
                    placeholder="Token label (e.g. xAI harness)"
                    style={{ font: 'inherit', fontSize: '0.76rem', padding: '0.25rem 0.45rem', border: '1px solid var(--border-strong)', borderRadius: 5, width: '13rem' }}
                  />
                  <button type="button" style={BTN} disabled={busy} onClick={() => void issueToken(t)}>Issue token…</button>
                </div>
              </div>
            </div>
          )
        })}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.55rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={mintName}
            onChange={(e) => setMintName(e.target.value)}
            placeholder="Display name (optional — e.g. Ada 🤖)"
            style={{ font: 'inherit', fontSize: '0.8rem', padding: '0.3rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 5, width: '16rem' }}
          />
          <button type="button" style={BTN_PRIMARY} disabled={busy} onClick={() => void mintTwin()}>
            ＋ Mint estimator twin
          </button>
          <span style={MUTED}>Next: twin-estimator-{Math.max(0, ...twins.map((t) => Number(/^twin-estimator-(\d+)@/.exec(t.email)?.[1] ?? 0))) + 1}@… (flagged, read-only; password random and unused — twins sign in by mint only)</span>
        </div>
      </div>

      <div style={CARD}>
        <h4 style={H}>Recent runs</h4>
        {runs.length === 0 ? <p style={MUTED}>No runs logged yet.</p> : null}
        {runs.map((r, i) => (
          <div key={i} style={{ fontSize: '0.76rem', margin: '0.18rem 0', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{r.started_at.slice(0, 16).replace('T', ' ')}</span>
            <span style={{ fontWeight: 600 }}>{r.mission}</span>
            <code style={{ color: 'var(--text-muted)' }}>{twinName(r.twin_user_id)}</code>
            {r.notes ? <span style={{ ...MUTED, overflowWrap: 'anywhere' }}>{r.notes.slice(0, 90)}</span> : null}
          </div>
        ))}
      </div>
    </div>
  )
}
