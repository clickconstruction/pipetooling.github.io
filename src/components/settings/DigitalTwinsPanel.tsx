import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { nextTwinSeat, relativeTimeFrom, twinSeatKindFromEmail, type TwinSeatKind } from '../../lib/twinConsoleDisplay'
import { buildDesktopSetupCommand, twinMcpConnectorUrl } from '../../lib/bids/desktopKickoff'
import { calibrationStandardSummary, calibrationStandardToast, teacherCandidates, type TeacherCandidate } from '../../lib/twinTeachers'
import { updateRefused, refusedUpdateMessage } from '../../lib/refusedWrite'
import { BTN, BTN_PRIMARY, CARD, CARD_TITLE, COPY_CHIP, MUTED, STEP_REF, TWIN_VIOLET } from '../bids/twinConsoleStyles'

/**
 * Settings → Digital twins (dev-only; docs/DIGITAL_TWINS_PLAN.md + docs/twins/TWIN_HARNESS.md):
 * fleet admin. v2.2433 redesign — the page tells the operator's story in order:
 * ① mint a twin → ② issue its key → ③ connect a harness → ④ run & watch. A pipeline
 * strip numbers every card, each twin shows the full three-rung safety ladder (not just
 * its current rung), and tokens are key pills with last-used liveness. Since v2.3224 the
 * RUNNING half — the Desktop setup command and kickoff, the Claude Code handoff, the
 * queue door, the robots' operator questions, the run ledger — lives on Bids → 🤖
 * Robots → Console; step ④ is its door, and the fresh-key card carries the setup
 * command so the key and the command meet at the one moment both are in hand. The one
 * thing that deliberately does NOT live here is the master TWIN_LOGIN_SECRET's value —
 * an in-app copy of a session-minting master key would defeat it; rotation stays a CLI act.
 * Twin tables aren't in generated types yet — cast queries, fail-soft.
 */

type TwinRow = { id: string; name: string | null; email: string; role: string; read_only: boolean }
type CredRow = { id: string; twin_user_id: string; label: string; created_at: string; last_used_at: string | null; revoked_at: string | null }
const FN_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
const VIOLET = TWIN_VIOLET
const CONSOLE_HREF = '/bids?tab=robot-console'

// CT bridge (v2.2435): a PT twin's CountTooling seat lives at the CT fleet domain.
const PT_FLEET_DOMAIN = '@twins.pipetooling.local'
const CT_FLEET_DOMAIN = '@twins.counttooling.local'
const ctTwinEmail = (ptEmail: string) => ptEmail.replace(PT_FLEET_DOMAIN, CT_FLEET_DOMAIN)
// TT bridge (v2.3082): the TakeoffTooling seat (electrical explode-and-cost) at the TT fleet domain.
// No join-key column on PT — the seat is looked up by email over tt-bridge.
const TT_FLEET_DOMAIN = '@twins.takeofftooling.local'
const ttTwinEmail = (ptEmail: string) => ptEmail.replace(PT_FLEET_DOMAIN, TT_FLEET_DOMAIN)

function randomTokenHex(bytes = 32): string {
  const a = new Uint8Array(bytes)
  crypto.getRandomValues(a)
  return Array.from(a).map((b) => b.toString(16).padStart(2, '0')).join('')
}
async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

const PIPELINE: { step: string; title: string; sub: string; href?: string }[] = [
  { step: 'STEP 1', title: 'Mint a twin', sub: 'a seat in the app' },
  { step: 'STEP 2', title: 'Issue its key', sub: 'shown once, revocable' },
  { step: 'STEP 3', title: 'Connect a harness', sub: 'any agent, via MCP' },
  { step: 'STEP 4', title: 'Run & watch ↗', sub: 'Bids → Robots → Console', href: CONSOLE_HREF },
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
  const [available, setAvailable] = useState(true)
  const [busy, setBusy] = useState(false)
  const [issueForTwin, setIssueForTwin] = useState<string | null>(null)
  const [tokenLabel, setTokenLabel] = useState('')
  const [freshToken, setFreshToken] = useState<{ twinEmail: string; token: string } | null>(null)
  const [showKillCmd, setShowKillCmd] = useState(false)
  // CT seat join key (v2.2434): twin id → counttooling_user_id. null = the column isn't
  // deployed yet (migration 20260828090000) — the indicator hides entirely.
  const [ctSeatById, setCtSeatById] = useState<Record<string, string | null> | null>(null)
  // TT seat (v2.3082): twin id → TT uuid | null (missing) — null map = bridge unavailable.
  const [ttSeatById, setTtSeatById] = useState<Record<string, string | null> | null>(null)
  // Calibration standard (v2.3091): the humans whose sent numbers the robots
  // calibrate to (users.calibration_standard, v2.3080). null = the column isn't
  // deployed yet — the card hides.
  const [teachers, setTeachers] = useState<TeacherCandidate[] | null>(null)

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
      // TT seats: one lookup per twin over tt-bridge (dev-only proxy). Fail-soft: the
      // indicator hides when the bridge isn't configured or the function is missing.
      void (async () => {
        const map: Record<string, string | null> = {}
        for (const tw of t.data ?? []) {
          const { data: lk, error: lkErr } = await supabase.functions.invoke('tt-bridge', { body: { verb: 'lookup', email: ttTwinEmail(tw.email) } })
          if (lkErr) { setTtSeatById(null); return }
          const found = lk as { found?: boolean; tt_user_id?: string; is_digital_twin?: boolean } | null
          map[tw.id] = found?.found && found.is_digital_twin ? (found.tt_user_id ?? 'linked') : null
        }
        setTtSeatById(map)
      })()
      const c = await sb.from('twin_credentials').select('id, twin_user_id, label, created_at, last_used_at, revoked_at').order('created_at', { ascending: false }).limit(100)
      setCreds((c.data as CredRow[] | null) ?? [])
      const seats = await sb.from('users').select('id, counttooling_user_id').eq('is_digital_twin', true).order('email')
      if (seats.error) {
        setCtSeatById(null)
      } else {
        const map: Record<string, string | null> = {}
        for (const row of (seats.data ?? []) as never as { id: string; counttooling_user_id: string | null }[]) map[row.id] = row.counttooling_user_id
        setCtSeatById(map)
      }
      // Teachers: every user the "Users can select users" policy shows a dev, with
      // the calibration flag. Cast — the column may be ahead of generated types.
      const people = await (supabase as never as { from: (t: string) => { select: (c: string) => { order: (k: string) => Promise<{ data: TeacherCandidate[] | null; error: unknown }> } } })
        .from('users').select('id, name, email, role, is_digital_twin, archived_at, calibration_standard').order('name')
      setTeachers(people.error ? null : (people.data ?? []))
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

  /** Create (idempotently) the TakeoffTooling seat for a twin over tt-bridge (v2.3082). */
  async function linkTtSeat(ptEmail: string, name: string | null): Promise<boolean> {
    const { data, error } = await supabase.functions.invoke('tt-bridge', {
      body: { verb: 'create', email: ttTwinEmail(ptEmail), name: name ?? undefined, is_digital_twin: true },
    })
    const ttId = (data as { tt_user_id?: string } | null)?.tt_user_id
    if (error || !ttId) {
      showToast(`TT seat failed — retry with the link button on the twin (${error?.message ?? (data as { error?: string } | null)?.error ?? 'no uuid returned'})`, 'error')
      return false
    }
    return true
  }

  async function retryTtSeat(t: TwinRow) {
    setBusy(true)
    try {
      if (await linkTtSeat(t.email, t.name)) {
        showToast(`TakeoffTooling seat linked for ${t.email}`, 'success')
        await loadAll()
      }
    } finally {
      setBusy(false)
    }
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

  async function setCalibrationStandard(u: TeacherCandidate, standard: boolean) {
    // Owner-set (the "Owners can update users" policy — dev only). A refused
    // write says so instead of pretending; the flag is read by score_shadows
    // and the Scoreboard gate math the next time either runs.
    setBusy(true)
    try {
      const { data, error } = await (supabase as never as { from: (t: string) => { update: (p: Record<string, unknown>) => { eq: (k: string, v: string) => { select: (c: string) => Promise<{ data: unknown[] | null; error: { message: string } | null }> } } } })
        .from('users').update({ calibration_standard: standard }).eq('id', u.id).select('id')
      if (error) throw new Error(error.message)
      if (updateRefused(data, 'users', 'update')) throw new Error(refusedUpdateMessage('the calibration standard'))
      showToast(calibrationStandardToast(u.name ?? u.email, standard), 'success')
      await loadAll()
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function mintTwin(kind: TwinSeatKind = 'estimator') {
    setBusy(true)
    try {
      const seat = nextTwinSeat(twins.map((t) => t.email), kind)
      // Price Matrix PR 3: the pricer is its own seat — role estimator (the quote store's
      // RLS roles), twin_kind 'pricer' (twin-mcp refuses it every bid verb), no CT/TT seats.
      const body = { email: seat.email, password: randomTokenHex(12), role: 'estimator', name: kind === 'pricer' ? `Twin Pricer ${seat.n}` : `Twin Estimator ${seat.n}` }
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
        .update(kind === 'pricer' ? { is_digital_twin: true, read_only: true, twin_kind: 'pricer' } : { is_digital_twin: true, read_only: true })
        .eq('email', seat.email)
      if (flagErr) throw new Error(`Created but not flagged: ${flagErr.message} — flag ${seat.email} by hand`)
      showToast(kind === 'pricer' ? `Minted ${seat.email} (pricing robot — quotes only, no bids)` : `Minted ${seat.email} (estimator, flagged, read-only)`, 'success')
      if (kind === 'pricer') {
        await loadAll()
        return
      }
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
      // TT bridge (v2.3082): the TakeoffTooling seat too — fail-soft, chip's link button is the retry.
      if (await linkTtSeat(seat.email, body.name)) showToast('TakeoffTooling seat created and linked', 'success')
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
  const seat = nextTwinSeat(twins.map((t) => t.email))
  const pricerSeat = nextTwinSeat(twins.map((t) => t.email), 'pricer')

  return (
    <div>
      {/* The four-step pipeline strip — every card below carries its step number. */}
      <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
        {PIPELINE.map((p) => {
          const box: React.CSSProperties = { flex: '1 1 9.5rem', background: 'var(--surface)', border: `1px ${p.href ? 'dashed' : 'solid'} ${p.href ? '#3b82f6' : 'var(--border)'}`, borderRadius: 8, padding: '0.4rem 0.65rem', textDecoration: 'none', color: 'inherit' }
          const inner = (
            <>
              <div style={{ fontSize: '0.6rem', fontWeight: 800, color: VIOLET, letterSpacing: '0.08em' }}>{p.step}</div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: p.href ? 'var(--text-link)' : undefined }}>{p.title}</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{p.sub}</div>
            </>
          )
          // Step 4 is a door (v2.3224): running and watching the robots happens on the Console lens.
          return p.href ? (
            <a key={p.step} href={p.href} style={box} title="Run the robots and watch the runs — Bids → 🤖 Robots → Console">
              {inner}
            </a>
          ) : (
            <div key={p.step} style={box}>
              {inner}
            </div>
          )
        })}
      </div>

      {freshToken ? (
        <div style={{ ...CARD, border: `1.5px solid ${VIOLET}`, background: 'var(--bg-violet-100)' }}>
          <h4 style={CARD_TITLE}>New key for {freshToken.twinEmail} — shown ONCE</h4>
          <code style={{ display: 'block', fontSize: '0.75rem', overflowWrap: 'anywhere', padding: '0.4rem 0.5rem', background: 'var(--surface)', borderRadius: 5, border: '1px solid var(--border)' }}>{freshToken.token}</code>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" style={BTN_PRIMARY} onClick={() => void copy(freshToken.token, 'the key')}>Copy key</button>
            <button
              type="button"
              style={BTN_PRIMARY}
              title="Copies a Terminal command (Mac) that asks for this key and configures Claude Desktop's twin-mcp connector — the key never goes into a chat"
              onClick={() => void copy(buildDesktopSetupCommand({ connectorUrl: twinMcpConnectorUrl(import.meta.env.VITE_SUPABASE_URL) }), 'the Claude Desktop setup command')}
            >
              Copy Desktop setup command
            </button>
            <button type="button" style={BTN} onClick={() => setFreshToken(null)}>Done — I saved it</button>
          </div>
          <p style={{ ...MUTED, marginBottom: 0, marginTop: '0.4rem' }}>
            Only its hash is stored — this value cannot be shown again. For Claude Desktop: copy the setup command, paste it into Terminal, and paste the key when it asks.
            For a Claude Code operator or any other harness, hand the key over with docs/twins/TWIN_HARNESS.md; the handoff prompt is on <a href={CONSOLE_HREF} style={{ color: 'var(--text-link)' }}>Robots → Console</a>.
          </p>
        </div>
      ) : null}

      {/* Steps 1–2: the fleet — mint twins, issue keys, walk the safety ladder. */}
      <div style={CARD}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
          <h4 style={{ ...CARD_TITLE, margin: 0 }}>
            <span style={STEP_REF}>1–2</span>Fleet · {twins.length} twin{twins.length === 1 ? '' : 's'}
          </h4>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              style={BTN_PRIMARY}
              disabled={busy}
              title={`Creates ${seat.email} — estimator, flagged, read-only. Password random and unused; twins sign in by mint only.`}
              onClick={() => void mintTwin()}
            >
              ＋ Mint estimator twin
            </button>
            <button
              type="button"
              style={BTN}
              disabled={busy}
              title={`Creates ${pricerSeat.email} — the pricing robot: reads supply-house quotes, writes robot quotes; twin-mcp refuses it every bid verb. Its own key, revocable on its own.`}
              onClick={() => void mintTwin('pricer')}
            >
              ＋ Mint pricing twin
            </button>
          </div>
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
                  {twinSeatKindFromEmail(t.email) === 'pricer' ? (
                    <span
                      style={{ fontSize: '0.62rem', fontWeight: 700, borderRadius: 999, padding: '0.08rem 0.5rem', background: 'var(--bg-violet-100)', color: VIOLET }}
                      title="The pricing robot — reads supply-house quotes and writes robot quotes on the bid; every bid verb is refused to its key. No CountTooling or TakeoffTooling seat."
                    >
                      pricer · quotes only, no bids
                    </span>
                  ) : null}
                  {ctSeatById !== null && twinSeatKindFromEmail(t.email) !== 'pricer' ? (
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
                  {ttSeatById !== null && twinSeatKindFromEmail(t.email) !== 'pricer' ? (
                    ttSeatById[t.id] ? (
                      <span
                        style={{ fontSize: '0.62rem', fontWeight: 700, borderRadius: 999, padding: '0.08rem 0.5rem', background: 'var(--bg-green-tint)', color: 'var(--text-green-800)' }}
                        title={`TakeoffTooling seat linked — TT uuid ${ttSeatById[t.id]}`}
                      >
                        TT seat · linked
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span
                          style={{ fontSize: '0.62rem', fontWeight: 700, borderRadius: 999, padding: '0.08rem 0.5rem', background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' }}
                          title="No TakeoffTooling seat for this twin — link creates (or finds) it over the bridge (electrical bids need it)"
                        >
                          TT seat · missing
                        </span>
                        <button type="button" style={COPY_CHIP} disabled={busy} onClick={() => void retryTtSeat(t)}>link</button>
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

      {/* Calibration standard (v2.3091): who the robots calibrate to. A shadow
          scored against a standard's sent number counts toward Gate B; anyone
          else is practice (v2.3080). Hidden until the column is deployed. */}
      {teachers ? (
        <div style={CARD}>
          <h4 style={CARD_TITLE}><span style={STEP_REF}>★</span>Calibration standard</h4>
          <p style={{ ...MUTED, marginTop: 0 }}>{calibrationStandardSummary(teachers)}</p>
          {teacherCandidates(teachers).map((u) => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.8rem', padding: '0.3rem 0', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, minWidth: '8rem' }}>{u.name ?? u.email}</span>
              <span style={{ ...MUTED, flex: '1 1 auto' }}>{u.role.replace('_', ' ')}{u.is_digital_twin ? ' · twin' : ''}{u.archived_at ? ' · archived' : ''}</span>
              {u.calibration_standard ? (
                <span style={{ fontSize: '0.62rem', fontWeight: 800, borderRadius: 5, padding: '0.08rem 0.45rem', background: 'var(--bg-green-tint)', color: 'var(--text-green-800)' }}>STANDARD</span>
              ) : (
                <span style={{ fontSize: '0.62rem', fontWeight: 800, borderRadius: 5, padding: '0.08rem 0.45rem', background: 'var(--bg-muted)', color: 'var(--text-muted)' }}>PRACTICE</span>
              )}
              <button
                type="button"
                style={BTN}
                disabled={busy}
                title={u.calibration_standard
                  ? `Stop treating ${u.name ?? u.email}'s sent numbers as the standard — their shadow scores become practice`
                  : `Treat ${u.name ?? u.email}'s sent numbers as the standard — shadows scored against them count toward Gate B`}
                onClick={() => void setCalibrationStandard(u, !u.calibration_standard)}
              >
                {u.calibration_standard ? 'Make practice' : 'Make standard'}
              </button>
            </div>
          ))}
        </div>
      ) : null}

    </div>
  )
}
