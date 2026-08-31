import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { describeTwinRun, nextTwinSeat, relativeTimeFrom } from '../../lib/twinConsoleDisplay'

/**
 * Settings → Digital twins (dev-only; docs/DIGITAL_TWINS_PLAN.md + docs/twins/TWIN_HARNESS.md):
 * the fleet console. v2.2433 redesign — the page tells the operator's story in order:
 * ① mint a twin → ② issue its key → ③ connect a harness → ④ watch the runs. A pipeline
 * strip numbers every card, each twin shows the full three-rung safety ladder (not just
 * its current rung), tokens are key pills with last-used liveness, and the run ledger is
 * translated to plain English by the twinConsoleDisplay kernel. The one thing that
 * deliberately does NOT live here is the master TWIN_LOGIN_SECRET's value — an in-app
 * copy of a session-minting master key would defeat it; rotation stays a CLI act.
 * Twin tables aren't in generated types yet — cast queries, fail-soft.
 */

type TwinRow = { id: string; name: string | null; email: string; role: string; read_only: boolean }
type CredRow = { id: string; twin_user_id: string; label: string; created_at: string; last_used_at: string | null; revoked_at: string | null }
type RunRow = { twin_user_id: string; mission: string; notes: string | null; started_at: string }

type QuestionRow = {
  id: string
  twin_user_id: string
  about_bid_id: string | null
  mission: string | null
  question: string
  status: 'open' | 'answered' | 'promoted' | 'dismissed'
  answer: string | null
  created_at: string
}

const FN_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
const VIOLET = '#8b5cf6'

// CT bridge (v2.2435): a PT twin's CountTooling seat lives at the CT fleet domain.
const PT_FLEET_DOMAIN = '@twins.pipetooling.local'
const CT_FLEET_DOMAIN = '@twins.counttooling.local'
const ctTwinEmail = (ptEmail: string) => ptEmail.replace(PT_FLEET_DOMAIN, CT_FLEET_DOMAIN)

function randomTokenHex(bytes = 32): string {
  const a = new Uint8Array(bytes)
  crypto.getRandomValues(a)
  return Array.from(a).map((b) => b.toString(16).padStart(2, '0')).join('')
}
async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

const CARD: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: '0.85rem 1rem', marginBottom: '0.9rem', background: 'var(--surface)' }
const MUTED: React.CSSProperties = { fontSize: '0.8rem', color: 'var(--text-muted)' }
const BTN: React.CSSProperties = { font: 'inherit', fontSize: '0.78rem', fontWeight: 600, padding: '0.3rem 0.7rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }
const BTN_PRIMARY: React.CSSProperties = { ...BTN, background: VIOLET, color: '#fff', border: 'none' }
const STEP_REF: React.CSSProperties = { fontSize: '0.62rem', fontWeight: 800, color: VIOLET, letterSpacing: '0.06em', verticalAlign: '2px', marginRight: '0.4rem' }
const CARD_TITLE: React.CSSProperties = { margin: '0 0 0.55rem', fontSize: '0.92rem', fontWeight: 700 }
const COPY_CHIP: React.CSSProperties = { font: 'inherit', fontSize: '0.66rem', fontWeight: 700, color: VIOLET, background: 'var(--bg-violet-100)', border: 'none', borderRadius: 5, padding: '0.1rem 0.45rem', cursor: 'pointer' }

const PIPELINE: { step: string; title: string; sub: string }[] = [
  { step: 'STEP 1', title: 'Mint a twin', sub: 'a seat in the app' },
  { step: 'STEP 2', title: 'Issue its key', sub: 'shown once, revocable' },
  { step: 'STEP 3', title: 'Connect a harness', sub: 'any agent, via MCP' },
  { step: 'STEP 4', title: 'Watch the runs', sub: 'every sign-in & report' },
]

const RUNGS: { rung: 1 | 2 | 3; title: string; sub: string }[] = [
  { rung: 1, title: 'Read-only', sub: 'safe to explore' },
  { rung: 2, title: 'Fenced writes', sub: 'its own bids only' },
  { rung: 3, title: 'Production', sub: 'earns trust first' },
]

export default function DigitalTwinsPanel() {
  const { showToast } = useToastContext()
  const [twins, setTwins] = useState<TwinRow[]>([])
  const [creds, setCreds] = useState<CredRow[]>([])
  const [runs, setRuns] = useState<RunRow[]>([])
  const [questions, setQuestions] = useState<QuestionRow[]>([])
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({})
  const [available, setAvailable] = useState(true)
  const [busy, setBusy] = useState(false)
  const [issueForTwin, setIssueForTwin] = useState<string | null>(null)
  const [tokenLabel, setTokenLabel] = useState('')
  const [freshToken, setFreshToken] = useState<{ twinEmail: string; token: string } | null>(null)
  const [showKillCmd, setShowKillCmd] = useState(false)
  // CT seat join key (v2.2434): twin id → counttooling_user_id. null = the column isn't
  // deployed yet (migration 20260828090000) — the indicator hides entirely.
  const [ctSeatById, setCtSeatById] = useState<Record<string, string | null> | null>(null)

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
      const q = await sb.from('twin_questions').select('id, twin_user_id, about_bid_id, mission, question, status, answer, created_at').order('created_at', { ascending: false }).limit(30)
      setQuestions(((q.data as QuestionRow[] | null) ?? []).filter(Boolean))
      const seats = await sb.from('users').select('id, counttooling_user_id').eq('is_digital_twin', true).order('email')
      if (seats.error) {
        setCtSeatById(null)
      } else {
        const map: Record<string, string | null> = {}
        for (const row of (seats.data ?? []) as never as { id: string; counttooling_user_id: string | null }[]) map[row.id] = row.counttooling_user_id
        setCtSeatById(map)
      }
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


  /** Answer / promote / dismiss a twin question (R3). Promote drafts an RFI on the
   * question's bid (source 'manual' — the human owns the wording from here) and links it. */
  async function answerQuestion(q: QuestionRow) {
    const text = (answerDrafts[q.id] ?? '').trim()
    if (!text) return
    setBusy(true)
    try {
      const sb = supabase as never as { from: (t: string) => { update: (v: object) => { eq: (k: string, v: string) => { eq: (k2: string, v2: string) => { select: (c: string) => Promise<{ data: unknown[] | null; error: { message: string } | null }> } } } } }
      const { data: me } = await supabase.auth.getUser()
      const { data: rows, error } = await sb.from('twin_questions')
        .update({ status: 'answered', answer: text, answered_by: me.user?.id ?? null, answered_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', q.id).eq('status', 'open').select('id')
      if (error) throw new Error(error.message)
      if (!rows || rows.length === 0) { showToast('Question already handled elsewhere — refreshing.', 'error'); await loadAll(); return }
      setAnswerDrafts((d) => ({ ...d, [q.id]: '' }))
      showToast('Answer saved — the twin pulls it with get_answers on its next run.', 'success')
      await loadAll()
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), 'error')
    } finally { setBusy(false) }
  }

  async function dismissQuestion(q: QuestionRow) {
    setBusy(true)
    try {
      const sb = supabase as never as { from: (t: string) => { update: (v: object) => { eq: (k: string, v: string) => { eq: (k2: string, v2: string) => { select: (c: string) => Promise<{ data: unknown[] | null; error: { message: string } | null }> } } } } }
      const { data: rows, error } = await sb.from('twin_questions')
        .update({ status: 'dismissed', updated_at: new Date().toISOString() })
        .eq('id', q.id).eq('status', 'open').select('id')
      if (error) throw new Error(error.message)
      if (!rows || rows.length === 0) { await loadAll(); return }
      await loadAll()
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), 'error')
    } finally { setBusy(false) }
  }

  async function promoteQuestion(q: QuestionRow) {
    if (!q.about_bid_id) { showToast('This question has no bid — answer it here instead (RFIs live on a bid).', 'error'); return }
    setBusy(true)
    try {
      const sbi = supabase as never as { from: (t: string) => { insert: (v: object) => { select: (c: string) => { single: () => Promise<{ data: { id: string; rfi_number: number } | null; error: { message: string } | null }> } } } }
      const { data: me } = await supabase.auth.getUser()
      const { data: rfi, error: e1 } = await sbi.from('bids_rfis')
        .insert({ bid_id: q.about_bid_id, question: q.question, source: 'manual', created_by: me.user?.id ?? null })
        .select('id, rfi_number').single()
      if (e1 || !rfi) throw new Error(e1?.message ?? 'RFI insert failed')
      const sbu = supabase as never as { from: (t: string) => { update: (v: object) => { eq: (k: string, v: string) => { eq: (k2: string, v2: string) => { select: (c: string) => Promise<{ data: unknown[] | null; error: { message: string } | null }> } } } } }
      const { error: e2 } = await sbu.from('twin_questions')
        .update({ status: 'promoted', promoted_rfi_id: rfi.id, updated_at: new Date().toISOString() })
        .eq('id', q.id).eq('status', 'open').select('id')
      if (e2) throw new Error(e2.message)
      showToast(`Promoted to RFI-${rfi.rfi_number} (draft) on the bid's RFI tab.`, 'success')
      await loadAll()
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), 'error')
    } finally { setBusy(false) }
  }

  /** Create (idempotently) the CT seat for a twin and store the uuid join key on PT. */
  async function linkCtSeat(ptUserId: string, ptEmail: string, name: string | null): Promise<boolean> {
    const { data, error } = await supabase.functions.invoke('ct-bridge', {
      body: { verb: 'create', email: ctTwinEmail(ptEmail), name: name ?? undefined, is_digital_twin: true },
    })
    const ctId = (data as { ct_user_id?: string } | null)?.ct_user_id
    if (error || !ctId) {
      showToast(`CT seat failed — retry with the link button on the twin (${error?.message ?? (data as { error?: string } | null)?.error ?? 'no uuid returned'})`, 'error')
      return false
    }
    const { error: upErr } = await (supabase as never as {
      from: (t: string) => { update: (v: object) => { eq: (k: string, v: string) => Promise<{ error: { message: string } | null }> } }
    })
      .from('users')
      .update({ counttooling_user_id: ctId })
      .eq('id', ptUserId)
    if (upErr) {
      showToast(`CT seat created (${ctId}) but the link didn’t save: ${upErr.message}`, 'error')
      return false
    }
    return true
  }

  async function retryCtSeat(t: TwinRow) {
    setBusy(true)
    try {
      if (await linkCtSeat(t.id, t.email, t.name)) {
        showToast(`CT seat linked for ${t.email}`, 'success')
        await loadAll()
      }
    } finally {
      setBusy(false)
    }
  }

  async function setRung(t: TwinRow, readOnly: boolean) {
    // CT note-and-skip (locked decision): CountTooling has no read-only concept, so the
    // rung does not forward — the weekly audit doesn't track it and nothing drifts.
    setBusy(true)
    try {
      const { error } = await supabase.from('users').update({ read_only: readOnly }).eq('id', t.id)
      if (error) throw new Error(error.message)
      showToast(readOnly ? `${t.email} → read-only (rung 1)` : `${t.email} → fenced writes (rung 2 — the twin write-fence binds it)`, 'success')
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
      const seat = nextTwinSeat(twins.map((t) => t.email))
      const body = { email: seat.email, password: randomTokenHex(12), role: 'estimator', name: `Twin Estimator ${seat.n}` }
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
        .eq('email', seat.email)
      if (flagErr) throw new Error(`Created but not flagged: ${flagErr.message} — flag ${seat.email} by hand`)
      showToast(`Minted ${seat.email} (estimator, flagged, read-only)`, 'success')
      // CT bridge: mint the CountTooling seat too. Fail-soft — the PT seat stands either
      // way, and the CT seat chip's link button is the retry.
      const { data: newRow } = await (supabase as never as {
        from: (t: string) => { select: (c: string) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: { id: string } | null }> } } }
      })
        .from('users')
        .select('id')
        .eq('email', seat.email)
        .maybeSingle()
      if (newRow?.id && (await linkCtSeat(newRow.id, seat.email, body.name))) {
        showToast('CountTooling seat created and linked', 'success')
      }
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
        .insert({ twin_user_id: t.id, token_hash, label: tokenLabel.trim() || 'unlabeled' })
      if (error) throw new Error(error.message)
      setFreshToken({ twinEmail: t.email, token })
      setTokenLabel('')
      setIssueForTwin(null)
      await loadAll()
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  /** One-shot backfill: link existing CountTooling accounts to PT users by email lookup. */
  async function backfillCtLinks() {
    setBusy(true)
    try {
      const { data, error } = await (supabase as never as {
        from: (t: string) => { select: (c: string) => { is: (k: string, v: null) => Promise<{ data: { id: string; email: string; counttooling_user_id: string | null }[] | null; error: { message: string } | null }> } }
      })
        .from('users')
        .select('id, email, counttooling_user_id')
        .is('archived_at', null)
      if (error) throw new Error(error.message)
      const unlinked = (data ?? []).filter((u) => !u.counttooling_user_id && !u.email.endsWith(PT_FLEET_DOMAIN))
      let linked = 0
      let notOnCt = 0
      for (const u of unlinked) {
        const { data: res, error: eFn } = await supabase.functions.invoke('ct-bridge', { body: { verb: 'lookup', email: u.email } })
        if (eFn) throw new Error(eFn.message)
        const r = res as { found?: boolean; ct_user_id?: string } | null
        if (r?.found && r.ct_user_id) {
          const { error: upErr } = await (supabase as never as {
            from: (t: string) => { update: (v: object) => { eq: (k: string, v: string) => Promise<{ error: { message: string } | null }> } }
          })
            .from('users')
            .update({ counttooling_user_id: r.ct_user_id })
            .eq('id', u.id)
          if (upErr) throw new Error(upErr.message)
          linked++
        } else {
          notOnCt++
        }
      }
      showToast(`Backfill: ${linked} linked, ${notOnCt} not on CountTooling, ${(data ?? []).length - unlinked.length} already linked or twins`, 'success')
      await loadAll()
    } catch (e) {
      showToast(`Backfill stopped: ${e instanceof Error ? e.message : String(e)}`, 'error')
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

  const nowMs = Date.now()
  const credById = new Map(creds.map((c) => [c.id, c]))
  const twinById = new Map(twins.map((t) => [t.id, t]))
  const twinDisplayName = (id: string) => {
    const t = twinById.get(id)
    return t ? (t.name ?? t.email.split('@')[0]) : id.slice(0, 8)
  }
  const seat = nextTwinSeat(twins.map((t) => t.email))

  return (
    <div>
      {/* The four-step pipeline strip — every card below carries its step number. */}
      <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
        {PIPELINE.map((p) => (
          <div key={p.step} style={{ flex: '1 1 9.5rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.4rem 0.65rem' }}>
            <div style={{ fontSize: '0.6rem', fontWeight: 800, color: VIOLET, letterSpacing: '0.08em' }}>{p.step}</div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>{p.title}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{p.sub}</div>
          </div>
        ))}
      </div>

      {freshToken ? (
        <div style={{ ...CARD, border: `1.5px solid ${VIOLET}`, background: 'var(--bg-violet-100)' }}>
          <h4 style={CARD_TITLE}>New key for {freshToken.twinEmail} — shown ONCE</h4>
          <code style={{ display: 'block', fontSize: '0.75rem', overflowWrap: 'anywhere', padding: '0.4rem 0.5rem', background: 'var(--surface)', borderRadius: 5, border: '1px solid var(--border)' }}>{freshToken.token}</code>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button type="button" style={BTN_PRIMARY} onClick={() => void copy(freshToken.token, 'the key')}>Copy key</button>
            <button type="button" style={BTN} onClick={() => setFreshToken(null)}>Done — I saved it</button>
          </div>
          <p style={{ ...MUTED, marginBottom: 0, marginTop: '0.4rem' }}>Only its hash is stored — this value cannot be shown again. Hand it to the partner with docs/twins/TWIN_HARNESS.md.</p>
        </div>
      ) : null}

      {/* Steps 1–2: the fleet — mint twins, issue keys, walk the safety ladder. */}
      <div style={CARD}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
          <h4 style={{ ...CARD_TITLE, margin: 0 }}>
            <span style={STEP_REF}>1–2</span>Fleet · {twins.length} twin{twins.length === 1 ? '' : 's'}
          </h4>
          <button
            type="button"
            style={BTN_PRIMARY}
            disabled={busy}
            title={`Creates ${seat.email} — estimator, flagged, read-only. Password random and unused; twins sign in by mint only.`}
            onClick={() => void mintTwin()}
          >
            ＋ Mint estimator twin
          </button>
        </div>
        {twins.length === 0 ? <p style={MUTED}>No twins yet — mint the first seat above.</p> : null}
        {twins.map((t) => {
          const tCreds = creds.filter((c) => c.twin_user_id === t.id)
          const liveCreds = tCreds.filter((c) => !c.revoked_at)
          const currentRung = t.read_only ? 1 : 2
          return (
            <div key={t.id} style={{ border: '1px solid var(--border)', borderRadius: 9, padding: '0.65rem 0.8rem', margin: '0.5rem 0', display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
              <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: 9, background: 'var(--bg-violet-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', flex: 'none' }}>🤖</div>
              <div style={{ flex: '1 1 16rem', minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{t.name ?? t.email}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <code style={{ fontSize: '0.7rem', color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>{t.email}</code>
                  <button type="button" style={COPY_CHIP} onClick={() => void copy(t.email, 'the seat email')}>copy</button>
                  {ctSeatById !== null ? (
                    ctSeatById[t.id] ? (
                      <span
                        style={{ fontSize: '0.62rem', fontWeight: 700, borderRadius: 999, padding: '0.08rem 0.5rem', background: 'var(--bg-green-tint)', color: 'var(--text-green-800)' }}
                        title={`CountTooling seat linked — CT uuid ${ctSeatById[t.id]}`}
                      >
                        CT seat · linked
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span
                          style={{ fontSize: '0.62rem', fontWeight: 700, borderRadius: 999, padding: '0.08rem 0.5rem', background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' }}
                          title="No CountTooling seat linked for this twin — link creates (or finds) it over the bridge"
                        >
                          CT seat · missing
                        </span>
                        <button type="button" style={COPY_CHIP} disabled={busy} onClick={() => void retryCtSeat(t)}>link</button>
                      </span>
                    )
                  ) : null}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.45rem' }}>
                  {liveCreds.map((c) => (
                    <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', border: '1px solid var(--border)', borderRadius: 999, padding: '0.12rem 0.3rem 0.12rem 0.6rem', fontSize: '0.72rem', background: 'var(--bg-page)' }}>
                      <span style={{ fontWeight: 600 }}>{c.label}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>
                        {c.last_used_at ? `· used ${relativeTimeFrom(c.last_used_at, nowMs)}` : '· never used'}
                      </span>
                      <button
                        type="button"
                        style={{ font: 'inherit', width: '1rem', height: '1rem', borderRadius: '50%', border: 'none', background: 'var(--surface)', color: 'var(--text-muted)', fontSize: '0.6rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title={`Revoke "${c.label}" — cuts off this key immediately`}
                        disabled={busy}
                        onClick={() => void revokeToken(c)}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  {tCreds.length > liveCreds.length ? (
                    <span style={{ ...MUTED, fontSize: '0.68rem' }}>{tCreds.length - liveCreds.length} revoked</span>
                  ) : null}
                  {issueForTwin === t.id ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      <input
                        type="text"
                        value={tokenLabel}
                        onChange={(e) => setTokenLabel(e.target.value)}
                        placeholder="Key label (e.g. xAI harness)"
                        autoFocus
                        style={{ font: 'inherit', fontSize: '0.74rem', padding: '0.2rem 0.45rem', border: '1px solid var(--border-strong)', borderRadius: 999, width: '11rem' }}
                      />
                      <button type="button" style={{ ...BTN_PRIMARY, fontSize: '0.72rem', padding: '0.2rem 0.6rem' }} disabled={busy} onClick={() => void issueToken(t)}>Issue</button>
                      <button type="button" style={{ ...BTN, fontSize: '0.72rem', padding: '0.2rem 0.5rem' }} onClick={() => { setIssueForTwin(null); setTokenLabel('') }}>Cancel</button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      style={{ font: 'inherit', fontSize: '0.72rem', fontWeight: 600, color: VIOLET, border: `1px dashed ${VIOLET}`, borderRadius: 999, padding: '0.14rem 0.6rem', background: 'transparent', cursor: 'pointer' }}
                      onClick={() => { setIssueForTwin(t.id); setTokenLabel('') }}
                    >
                      ＋ Issue key
                    </button>
                  )}
                </div>
              </div>
              {/* The safety ladder — all three rungs visible, current one lit. */}
              <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: '0.15rem', alignItems: 'flex-end' }}>
                {RUNGS.map((r) => {
                  const isCurrent = r.rung === currentRung
                  const dotColor = isCurrent ? (r.rung === 1 ? 'var(--text-amber-800)' : 'var(--text-green-800)') : 'var(--border-strong)'
                  const action =
                    r.rung === 2 && currentRung === 1 ? { label: 'Graduate ↑', to: false } :
                    r.rung === 1 && currentRung === 2 ? { label: 'Back ↓', to: true } : null
                  return (
                    <div key={r.rung} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: isCurrent ? 'var(--text-700)' : 'var(--text-muted)', fontWeight: isCurrent ? 700 : 400 }}>
                      {action ? (
                        <button
                          type="button"
                          style={{ font: 'inherit', fontSize: '0.62rem', fontWeight: 700, background: action.to ? 'var(--bg-amber-tint)' : 'var(--bg-green-tint)', color: action.to ? 'var(--text-amber-800)' : 'var(--text-green-800)', border: 'none', borderRadius: 5, padding: '0.06rem 0.45rem', cursor: 'pointer' }}
                          disabled={busy}
                          onClick={() => void setRung(t, action.to)}
                        >
                          {action.label}
                        </button>
                      ) : null}
                      <span title={r.rung === 3 ? 'Not built yet — a twin earns this rung later (Phase E of the plan)' : undefined}>
                        {r.title} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>— {r.sub}</span>
                      </span>
                      <span style={{ width: '0.55rem', height: '0.55rem', borderRadius: '50%', flex: 'none', background: isCurrent ? dotColor : 'transparent', border: `2px solid ${isCurrent ? 'transparent' : 'var(--border-strong)'}`, boxSizing: 'border-box' }} />
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Step 3: what a harness or MCP client needs, one fact per row. */}
      <div style={CARD}>
        <h4 style={CARD_TITLE}><span style={STEP_REF}>3</span>Connect a harness</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(7rem, 10rem) 1fr', gap: '0.35rem 0.8rem', fontSize: '0.78rem', alignItems: 'baseline' }}>
          <span style={{ ...MUTED, fontWeight: 600 }}>Sign-in mint</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', minWidth: 0 }}>
            <code style={{ fontSize: '0.7rem', overflowWrap: 'anywhere' }}>{FN_BASE}/twin-login</code>
            <button type="button" style={COPY_CHIP} onClick={() => void copy(`${FN_BASE}/twin-login`, 'the twin-login URL')}>copy</button>
          </span>
          <span style={{ ...MUTED, fontWeight: 600 }}>MCP server</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', minWidth: 0 }}>
            <code style={{ fontSize: '0.7rem', overflowWrap: 'anywhere' }}>{FN_BASE}/twin-mcp</code>
            <button type="button" style={COPY_CHIP} onClick={() => void copy(`${FN_BASE}/twin-mcp`, 'the twin-mcp URL')}>copy</button>
            <span style={{ ...MUTED, fontSize: '0.68rem' }}>works with any MCP client — Claude, Grok, …</span>
          </span>
          <span style={{ ...MUTED, fontWeight: 600 }}>Auth header</span>
          <code style={{ fontSize: '0.7rem' }}>X-Twin-Token: &lt;the twin’s key&gt;</code>
          <span style={{ ...MUTED, fontWeight: 600 }}>Onboarding doc</span>
          <code style={{ fontSize: '0.7rem' }}>docs/twins/TWIN_HARNESS.md</code>
          <span style={{ ...MUTED, fontWeight: 600 }}>CT backfill</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', ...MUTED }}>
            link existing CountTooling accounts to their ClickTooling people by email
            <button type="button" style={COPY_CHIP} disabled={busy || ctSeatById === null} onClick={() => void backfillCtLinks()}>run backfill</button>
          </span>
          <span style={{ ...MUTED, fontWeight: 600 }}>Kill switch</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', ...MUTED }}>
            rotate the master secret from the CLI — its value never appears in the app
            <button type="button" style={COPY_CHIP} onClick={() => setShowKillCmd((v) => !v)}>{showKillCmd ? 'hide command' : 'show command'}</button>
            {showKillCmd ? <code style={{ fontSize: '0.7rem' }}>supabase secrets set TWIN_LOGIN_SECRET=…</code> : null}
          </span>
        </div>
      </div>

      {/* Twin questions (R3): the internal ask lane's inbox. Open questions demand a human;
          answers flow back to the agent via get_answers; bid-scoped ones can graduate into
          RFI drafts (the external lane). */}
      <div style={CARD}>
        <h4 style={CARD_TITLE}><span style={STEP_REF}>Q</span>Twin questions{questions.filter((x) => x.status === 'open').length > 0 ? ` · ${questions.filter((x) => x.status === 'open').length} open` : ''}</h4>
        {questions.length === 0 ? <p style={MUTED}>No questions yet — a blocked twin parks one with ask_question instead of stalling.</p> : null}
        {questions.slice(0, 12).map((q) => {
          const twin = twins.find((t) => t.id === q.twin_user_id)
          const isOpen = q.status === 'open'
          return (
            <div key={q.id} style={{ borderTop: '1px solid var(--border)', padding: '0.45rem 0', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
                <strong>{twin?.name ?? twin?.email ?? 'Twin'}</strong>
                {q.mission ? <span style={MUTED}>{q.mission}</span> : null}
                <span style={{ fontSize: '0.62rem', fontWeight: 800, borderRadius: 5, padding: '0.06rem 0.4rem', background: isOpen ? 'var(--bg-amber-tint)' : 'var(--bg-muted)', color: isOpen ? 'var(--text-amber-800)' : 'var(--text-muted)' }}>{q.status.toUpperCase()}</span>
                <span style={{ ...MUTED, marginLeft: 'auto' }}>{relativeTimeFrom(q.created_at, Date.now())}</span>
              </div>
              <div style={{ margin: '0.2rem 0', whiteSpace: 'pre-wrap' }}>{q.question}</div>
              {q.status === 'answered' && q.answer ? <div style={{ ...MUTED, fontStyle: 'italic' }}>→ {q.answer}</div> : null}
              {isOpen ? (
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                  <input
                    type="text"
                    value={answerDrafts[q.id] ?? ''}
                    onChange={(e) => setAnswerDrafts((d) => ({ ...d, [q.id]: e.target.value }))}
                    placeholder="Answer the twin\u2026"
                    style={{ flex: 1, minWidth: 180, padding: '0.3rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 5, font: 'inherit', fontSize: '0.78rem' }}
                  />
                  <button type="button" style={BTN_PRIMARY} disabled={busy || !(answerDrafts[q.id] ?? '').trim()} onClick={() => void answerQuestion(q)}>Answer</button>
                  {q.about_bid_id ? <button type="button" style={BTN} disabled={busy} onClick={() => void promoteQuestion(q)}>Promote to RFI</button> : null}
                  <button type="button" style={{ ...BTN, color: 'var(--text-muted)' }} disabled={busy} onClick={() => void dismissQuestion(q)}>Dismiss</button>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      {/* Step 4: the run ledger, translated to plain English. */}
      <div style={CARD}>
        <h4 style={CARD_TITLE}><span style={STEP_REF}>4</span>Recent runs</h4>
        {runs.length === 0 ? <p style={MUTED}>No runs logged yet — the first sign-in or mission report lands here.</p> : null}
        {runs.map((r, i) => {
          const d = describeTwinRun(r.mission, r.notes, (id) => credById.get(id)?.label)
          const chip =
            d.verb === 'sign-in' ? { text: 'SIGN-IN', bg: 'var(--bg-blue-tint)', fg: 'var(--text-blue-800)' } :
            d.verb === 'report' ? { text: 'REPORT', bg: 'var(--bg-green-tint)', fg: 'var(--text-green-800)' } :
            d.verb === 'heartbeat' ? (d.mission === 'blocked'
              ? { text: 'BLOCKED', bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-800)' }
              : { text: 'PULSE', bg: 'var(--bg-muted)', fg: 'var(--text-muted)' }) :
            { text: 'RUN', bg: 'var(--bg-violet-100)', fg: 'var(--text-violet-800)' }
          return (
            <div key={i} style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', fontSize: '0.76rem', padding: '0.26rem 0', borderBottom: i < runs.length - 1 ? '1px solid var(--border)' : 'none', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', width: '4.5rem', flex: 'none' }} title={r.started_at.slice(0, 16).replace('T', ' ')}>
                {relativeTimeFrom(r.started_at, nowMs)}
              </span>
              <span style={{ fontSize: '0.62rem', fontWeight: 800, borderRadius: 5, padding: '0.08rem 0.45rem', background: chip.bg, color: chip.fg, flex: 'none', width: '3.6rem', textAlign: 'center' }}>{chip.text}</span>
              <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                <span style={{ fontWeight: 600 }}>{twinDisplayName(r.twin_user_id)}</span>
                {d.verb !== 'sign-in' ? <span style={{ color: 'var(--text-muted)' }}> · {d.mission}</span> : null}
                {d.detail ? <span style={{ color: 'var(--text-muted)' }}> · {d.detail.slice(0, 140)}</span> : null}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
