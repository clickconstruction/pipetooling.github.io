/**
 * The review room — /submittal?t=… (Submittals stage 4a, decisions 8–12). The one link per
 * bid the GC forwards: the customer's architect or designer reads the product decisions in
 * their own words — which rows match the plans, which differ and why — with the package to
 * download. Just looking asks nothing. Deciding asks who you are, once (stage 4a-ii): the
 * identify sheet creates the person's record, the address rewrites to their personal link,
 * and "Send my review" records the decisions with their name. Nothing about money, the
 * builder's account or the supply houses is on the page. Customer-facing → light theme
 * pinned, phone first.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { RoomHeader, RoomRevisionBody, RoomRevisionChips } from '../components/bids/SubmittalRoomView'
import { APP_CALENDAR_TZ, calendarYmdInAppTzFromIso } from '../utils/dateUtils'
import { useSearchParams } from 'react-router-dom'

import { staffAwarePublicHeaders } from '../lib/publicFunctionStaffHeaders'
import { PUBLIC_PREVIEW_PARAM, isPreviewFlag } from '../lib/publicViewCounting'
import { describeThreadEntry, parseSubmittalRoomPayload, pendingKey, ROOM_ROLE_LABELS } from '../lib/submittals/submittalRoom'
import { sampleStateFromToken } from '../lib/customerSampleMode'
import { SampleModeBanner } from '../components/SampleModeBanner'
import { ROOM_ROLES, rollUpPartDecisions, type RoomMessage, type RoomRevision, type RoomRole, type RoomRow, type SubmittalRoomPayload } from '../../supabase/functions/_shared/submittalRoomPayload'
import type { DecisionKind } from '../../supabase/functions/_shared/submittalReviewActions'
import { buildProcurementLog, floatText, procurementHeadline, shortDate as logDate, statusText, tagStagesFrom, type ProcurementItemSource, type ProcurementRecord, type ProcurementStage, type StageDates } from '../lib/submittals/procurementLog'
import { rowsThatStand } from '../lib/submittals/standingRows'
import type { StageSplitRecord, StageSplitSource } from '../lib/bids/materialsByStage'

// The live build's env carries a trailing slash — strip it so the function URLs read one slash.
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/+$/, '')

type View = { kind: 'loading' } | { kind: 'dead'; message: string } | { kind: 'closed'; payload: SubmittalRoomPayload } | { kind: 'empty'; message: string } | { kind: 'open'; payload: SubmittalRoomPayload }

const COPPER = '#b0662f'
const paper: CSSProperties = { minHeight: '100vh', background: 'var(--bg-subtle)', color: 'var(--text-strong)' }
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.85rem 0.95rem' }
const label: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const quiet: CSSProperties = { fontSize: '0.8rem', color: 'var(--text-muted)' }

function shortDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}


/**
 * A row as it will read once the calls not sent yet land (2026-10-01): a part called here takes
 * the call, and a row with parts reads its call from them the way the office will
 * (`rollUpPartDecisions`); a row with no parts takes its own call.
 */
function foldPending(row: RoomRow, pending: Record<string, { decision: DecisionKind; note: string }>, byName: string, at: string): RoomRow {
  const parts = row.parts ?? []
  if (parts.length === 0) {
    const d = pending[row.id]
    return d ? { ...row, decision: { kind: d.decision, note: d.note.trim() || null, byName, byPersonId: null, at } } : row
  }
  if (!parts.some((p) => pending[pendingKey(row.id, p.id)])) return row
  const nextParts = parts.map((p) => {
    const d = pending[pendingKey(row.id, p.id)]
    return d ? { ...p, decision: { kind: d.decision, note: d.note.trim() || null, byName, byPersonId: null, at }, carried: undefined } : p
  })
  const r = rollUpPartDecisions(nextParts.map((p, i) => ({ label: p.label, sequence_order: i, on_submittal: true, review_decision: p.decision?.kind ?? null, review_note: p.decision?.note ?? null, reviewed_by_name: p.decision?.byName ?? null, reviewed_by_person_id: p.decision?.byPersonId ?? null, reviewed_at: p.decision?.at ?? null })))
  return { ...row, parts: nextParts, decision: r.review_decision ? { kind: r.review_decision, note: r.review_note, byName: r.reviewed_by_name, byPersonId: r.reviewed_by_person_id, at: r.reviewed_at } : null }
}

export default function SubmittalRoom() {
  const [params] = useSearchParams()
  const token = params.get('t')?.trim() ?? ''
  const preview = isPreviewFlag(params.get(PUBLIC_PREVIEW_PARAM))
  // v2.4599 · the room's writes carry the office's preview flag too, so the function refuses them (it refuses a verified office session either way).
  const reviewUrl = `${supabaseUrl}/functions/v1/submit-submittal-review${preview ? `?${PUBLIC_PREVIEW_PARAM}=1` : ''}`
  // What customers see (v2.3511): the sample token renders the sample room; identifying and deciding stay on this page and save nothing.
  const sample = sampleStateFromToken(token)
  const [view, setView] = useState<View>({ kind: 'loading' })
  const [revId, setRevId] = useState<string | null>(null)
  const [identifyOpen, setIdentifyOpen] = useState(false)
  /** Who this browser is on this room: the personal token the identify sheet returned (or the link carried), remembered per room. */
  const [me, setMe] = useState<{ token: string; name: string; role: RoomRole; mayDecide: boolean; messagesThisHour?: number } | null>(null)
  const [idName, setIdName] = useState('')
  const [idEmail, setIdEmail] = useState('')
  const [idRole, setIdRole] = useState<RoomRole>('architect')
  const [idError, setIdError] = useState<string | null>(null)
  const [pending, setPending] = useState<Record<string, { decision: DecisionKind; note: string }>>({})
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  /** Stage 5a: the thread's ask box. */
  const [askBody, setAskBody] = useState('')
  const [askTags, setAskTags] = useState<string[]>([])
  const [asking, setAsking] = useState(false)
  const [askError, setAskError] = useState<string | null>(null)
  const [askedOk, setAskedOk] = useState<string | null>(null)
  /** Why the identify sheet is open: to decide (the default) or to ask (stage 5a) — the sheet's words follow. */
  const [identifyFor, setIdentifyFor] = useState<'decide' | 'ask'>('decide')
  /** The token the page was opened with — a personal link identifies its person until they say "not you". */
  const [viaToken] = useState(token)

  useEffect(() => {
    if (!token) {
      setView({ kind: 'dead', message: 'This link is incomplete.' })
      return
    }
    const ac = new AbortController()
    void (async () => {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/get-submittal-room?t=${encodeURIComponent(token)}${preview ? `&${PUBLIC_PREVIEW_PARAM}=1` : ''}`, { headers: await staffAwarePublicHeaders(), signal: ac.signal })
        const json = (await res.json().catch(() => null)) as (Record<string, unknown> & { error?: string; code?: string }) | null
        if (ac.signal.aborted) return
        if (res.status === 410) {
          const payload = parseSubmittalRoomPayload(json)
          setView(payload ? { kind: 'closed', payload } : { kind: 'dead', message: 'This review is closed.' })
          return
        }
        if (!res.ok) {
          setView({ kind: json?.code === 'empty' ? 'empty' : 'dead', message: json?.code === 'empty' ? 'Nothing has been shared to this link yet — check back shortly.' : json?.error === 'Not found' ? 'This link is no longer active. Please contact our office for a new one.' : json?.error || 'Could not load the review.' })
          return
        }
        const payload = parseSubmittalRoomPayload(json)
        if (!payload) {
          setView({ kind: 'dead', message: 'Could not load the review.' })
          return
        }
        setView({ kind: 'open', payload })
        setRevId(payload.revisions.find((r) => r.current)?.id ?? payload.revisions[0]?.id ?? null)
        if (payload.person) setMe({ token, name: payload.person.name, role: payload.person.role, mayDecide: payload.person.mayDecide, messagesThisHour: payload.person.messagesThisHour })
        else {
          try {
            const raw = localStorage.getItem(`submittal_room_me_${token}`)
            if (raw) {
              const saved = JSON.parse(raw) as { token: string; name: string; role: RoomRole; mayDecide: boolean }
              if (saved && typeof saved.token === 'string') setMe(saved)
            }
          } catch {
            /* no memory on this device */
          }
        }
      } catch (err) {
        if (!ac.signal.aborted) setView({ kind: 'dead', message: err instanceof Error && /fetch/i.test(err.message) ? 'Could not reach the office. Check your connection and reload.' : 'Could not load the review.' })
      }
    })()
    return () => ac.abort()
  }, [token, preview])

  function remember(next: { token: string; name: string; role: RoomRole; mayDecide: boolean } | null) {
    setMe(next)
    try {
      if (next) localStorage.setItem(`submittal_room_me_${token}`, JSON.stringify(next))
      else localStorage.removeItem(`submittal_room_me_${token}`)
    } catch {
      /* fine */
    }
  }

  function decide(rowId: string, kind: DecisionKind, partId?: string) {
    const key = pendingKey(rowId, partId)
    setPending((p) => ({ ...p, [key]: { decision: kind, note: p[key]?.note ?? '' } }))
    setSent(null)
    if (!me) setIdentifyOpen(true)
  }

  async function identify() {
    setIdError(null)
    if (sample) {
      const next = { token, name: idName.trim() || 'Alex Sample', role: idRole, mayDecide: true }
      setMe(next)
      setIdentifyOpen(false)
      return
    }
    const res = await fetch(reviewUrl, {
      method: 'POST',
      headers: { ...(await staffAwarePublicHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'identify', token, name: idName, email: idEmail, role: idRole, viaToken: me ? me.token : viaToken !== token ? viaToken : null, website: '' }),
    })
    const j = (await res.json().catch(() => ({}))) as { ok?: boolean; personToken?: string; person?: { name: string; role: string; mayDecide: boolean } | null; error?: string }
    if (!res.ok || !j.personToken) {
      setIdError(j.error ?? 'Could not save who you are. Try again.')
      return
    }
    const next = { token: j.personToken, name: j.person?.name ?? idName.trim(), role: (j.person?.role as RoomRole) ?? idRole, mayDecide: j.person?.mayDecide !== false }
    remember(next)
    setIdentifyOpen(false)
    if (identifyFor === 'ask' && askBody.trim()) void sendAsk(next)
    setIdentifyFor('decide')
    // The address becomes the personal link, so a reload (or a forward) knows who.
    try {
      window.history.replaceState(null, '', `/submittal?t=${encodeURIComponent(j.personToken)}`)
    } catch {
      /* fine */
    }
  }

  /** Stage 5a: an ask on the thread. Identify first (the same sheet, reworded); a watcher may ask. */
  async function sendAsk(who: { token: string; name: string; role: RoomRole; mayDecide: boolean } | null = me) {
    const text = askBody.trim()
    if (!text) return
    if (!who) {
      setIdentifyFor('ask')
      setIdentifyOpen(true)
      return
    }
    if (sample) {
      appendMessage({ id: `sample-${Date.now()}`, at: new Date().toISOString(), authorKind: who.mayDecide ? 'reviewer' : 'watcher', authorName: who.name, body: text, kind: 'message', revNumber: rev?.rev ?? null, tags: askTags })
      setAskBody('')
      setAskTags([])
      setAskedOk('Asked. (Sample — nothing was saved.)')
      return
    }
    setAsking(true)
    setAskError(null)
    setAskedOk(null)
    try {
      const res = await fetch(reviewUrl, {
        method: 'POST',
        headers: { ...(await staffAwarePublicHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'message', token: who.token, submittalId: rev?.id ?? null, body: text, tags: askTags, website: '' }),
      })
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: RoomMessage; error?: string; code?: string }
      if (!res.ok) {
        if (j.code === 'identify_first') {
          remember(null)
          setIdentifyFor('ask')
          setIdentifyOpen(true)
          return
        }
        setAskError(res.status === 429 ? 'Five an hour is the limit — call the office if it cannot wait.' : j.error ?? 'Could not send your question. Try again.')
        return
      }
      if (j.message) appendMessage(j.message)
      setAskBody('')
      setAskTags([])
      setAskedOk('Sent. The office answers here and by email.')
    } catch {
      setAskError('Could not reach the office. Check your connection and try again.')
    } finally {
      setAsking(false)
    }
  }

  function appendMessage(m: RoomMessage) {
    setView((v) => (v.kind !== 'open' ? v : { kind: 'open', payload: { ...v.payload, messages: [...(v.payload.messages ?? []), m] } }))
  }

  async function sendReview() {
    if (!me || !rev) return
    const decisions = Object.entries(pending).map(([key, d]) => {
      const [itemId, partId] = key.split(':')
      return { itemId: itemId!, ...(partId ? { partId } : {}), decision: d.decision, note: d.note.trim() || undefined }
    })
    if (decisions.length === 0) return
    if (sample) {
      setSent(`${decisions.length} recorded as ${me.name}. Thank you. (Sample — nothing was saved.)`)
      setPending({})
      return
    }
    setSending(true)
    setSendError(null)
    try {
      const res = await fetch(reviewUrl, {
        method: 'POST',
        headers: { ...(await staffAwarePublicHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decide', token: me.token, submittalId: rev.id, decisions }),
      })
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; decided?: number; error?: string; code?: string }
      if (!res.ok) {
        if (j.code === 'identify') {
          remember(null)
          setIdentifyOpen(true)
        }
        setSendError(j.error ?? 'Could not record your review. Try again.')
        return
      }
      // Fold the decisions into the page so it reads the way the office will.
      setView((v) => {
        if (v.kind !== 'open') return v
        const at = new Date().toISOString()
        return {
          kind: 'open',
          payload: {
            ...v.payload,
            revisions: v.payload.revisions.map((r) =>
              r.id !== rev.id
                ? r
                : {
                    ...r,
                    rows: r.rows.map((row) => foldPending(row, pending, me.name, at)),
                    counts: (() => {
                      const rows = r.rows.map((row) => foldPending(row, pending, me.name, at))
                      return { ...r.counts, decided: rows.filter((row) => row.decision).length, open: rows.filter((row) => (row.kind === 'differs' || row.kind === 'proposed') && !row.decision).length }
                    })(),
                  },
            ),
          },
        }
      })
      setPending({})
      setSent(`${j.decided ?? decisions.length} recorded as ${me.name}. Thank you.`)
    } catch {
      setSendError('Could not reach the office. Check your connection and try again.')
    } finally {
      setSending(false)
    }
  }

  const payload = view.kind === 'open' || view.kind === 'closed' ? view.payload : null
  const rev: RoomRevision | null = payload && view.kind === 'open' ? payload.revisions.find((r) => r.id === revId) ?? payload.revisions[0] ?? null : null
  const pdfHref = (r: RoomRevision) => sample ? '#' : `${supabaseUrl}/functions/v1/open-submittal-pdf?t=${encodeURIComponent(token)}&r=${encodeURIComponent(r.id)}`

  return (
    <div data-theme="light" style={paper}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '1rem 1rem 6rem' }}>
        {sample ? <SampleModeBanner /> : null}
        {payload ? (
          <RoomHeader company={payload.company} bid={payload.bid} />
        ) : null}

        {view.kind === 'loading' ? <p style={{ ...quiet, padding: '3rem 0', textAlign: 'center' }}>Loading…</p> : null}
        {view.kind === 'dead' || view.kind === 'empty' ? (
          <div style={{ padding: '3rem 0.5rem', textAlign: 'center' }}>
            <p style={{ fontSize: '1.05rem', margin: 0 }}>{view.message}</p>
          </div>
        ) : null}
        {view.kind === 'closed' ? (
          <div style={{ ...card, textAlign: 'center', padding: '2rem 1rem' }} data-testid="room-closed">
            <p style={{ fontSize: '1.05rem', margin: 0 }}>This review is closed{payload?.closedAt ? ` · ${shortDate(payload.closedAt)}` : ''}.</p>
            <p style={{ ...quiet, marginTop: '0.5rem' }}>The products for {payload?.bid.projectName || 'this job'} were settled. Contact {payload?.company.name || 'our office'} if you need the record.</p>
          </div>
        ) : null}

        {view.kind === 'open' && payload && rev ? (
          <>
            <RoomRevisionChips revisions={payload.revisions} selectedId={rev.id} onSelect={setRevId} />

            <RoomRevisionBody
              rev={rev}
              pending={pending}
              onDecide={decide}
              afterSubline={<><b style={{ color: 'var(--text-strong)' }}>Just looking? Fine.</b> To decide or ask, we&apos;ll ask who you are.</>}
              personLine={payload.person ? (
                <div style={{ ...quiet, marginTop: 6 }}>
                  This link was made for <b style={{ color: 'var(--text-strong)' }}>{payload.person.name}</b> · {ROOM_ROLE_LABELS[payload.person.role]}
                  {!payload.person.mayDecide ? ' · watching' : ''}
                </div>
              ) : null}
            />

            {payload.procurement && rev.current ? <ProcurementCard revisions={[rev, ...payload.revisions.filter((r) => r.id !== rev.id && r.rev < rev.rev).sort((a, b) => b.rev - a.rev)]} procurement={payload.procurement} companyName={payload.company.name} /> : null}

            {Object.keys(pending).length > 0 ? (
              <div style={{ ...card, marginTop: 10, borderColor: COPPER }} data-testid="room-pending">
                <div style={{ ...label, color: COPPER }}>Your notes · optional</div>
                {Object.entries(pending).map(([id, d]) => {
                  const [rowId, partId] = id.split(':')
                  const row = rev.rows.find((r) => r.id === rowId)
                  const part = partId ? row?.parts?.find((p) => p.id === partId) : undefined
                  const what = `${row?.tag || 'Accessory'}${part ? ` · ${part.head}` : ''}`
                  return (
                    <div key={id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, auto) minmax(8rem, 1fr)', gap: 8, alignItems: 'center', marginTop: 6, fontSize: '0.85rem' }}>
                      <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}><b>{what}</b> · {d.decision === 'revise' ? 'Revise' : d.decision === 'rejected' ? 'Reject' : 'Approve'}</span>
                      <input aria-label={`Note on ${what}`} value={d.note} placeholder={d.decision === 'approved' ? 'a note, if any' : 'what you need instead'} onChange={(e) => setPending((p) => ({ ...p, [id]: { decision: d.decision, note: e.target.value } }))} style={{ padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, font: 'inherit', fontSize: '0.85rem', background: 'var(--surface)', color: 'var(--text-strong)', minWidth: 0 }} />
                    </div>
                  )
                })}
              </div>
            ) : null}
            <div style={{ ...card, marginTop: 12, background: 'var(--bg-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }} data-testid="room-footer">
              <span style={{ fontSize: '0.85rem' }}>
                <b>{rev.counts.decided} decided · {rev.rows.filter((r) => (r.kind === 'differs' || r.kind === 'proposed') && !foldPending(r, pending, me?.name ?? '', '').decision).length} to answer</b>
                {Object.keys(pending).length > 0 ? <span style={quiet}> · {Object.keys(pending).length} to send</span> : null}
              </span>
              {rev.counts.open > 0 && me?.mayDecide !== false ? (
                <button type="button" onClick={() => { for (const r of rev.rows) { if ((r.kind !== 'differs' && r.kind !== 'proposed') || r.decision) continue; if ((r.parts ?? []).length > 0) { for (const p of r.parts!) if (!p.decision && !pending[pendingKey(r.id, p.id)]) decide(r.id, 'approved', p.id) } else if (!pending[r.id]) decide(r.id, 'approved') } }} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: '0.85rem', fontWeight: 700, color: COPPER, cursor: 'pointer' }}>
                  Approve all {rev.counts.open} as marked
                </button>
              ) : null}
              {rev.hasPackage ? (
                <a href={pdfHref(rev)} target="_blank" rel="noreferrer" data-testid="room-pdf" style={{ fontSize: '0.85rem', fontWeight: 700, color: COPPER }}>
                  Download Rev {rev.rev} PDF ↗
                </a>
              ) : (
                <span style={quiet}>The PDF is on its way.</span>
              )}
            </div>
            <div style={{ ...card, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }} data-testid="room-thread">
              <div style={{ ...label, color: COPPER }}>On this submittal</div>
              {(payload.messages ?? []).length === 0 ? (
                <div style={quiet}>Nothing asked yet. A question about a product goes here, and the office answers here and by email.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="room-thread-entries">
                  {(payload.messages ?? []).map((m) => {
                    const d = describeThreadEntry(m, APP_CALENDAR_TZ)
                    return (
                      <div key={m.id} data-thread-kind={m.kind} style={{ fontSize: '0.875rem', color: d.quiet ? 'var(--text-muted)' : 'var(--text-strong)', borderLeft: `3px solid ${m.authorKind === 'office' ? COPPER : d.quiet ? 'var(--border)' : 'var(--border-strong)'}`, paddingLeft: 10 }}>
                        <div style={{ ...quiet, fontSize: '0.72rem' }}>
                          {d.who ? <b style={{ color: m.authorKind === 'office' ? COPPER : 'var(--text-strong)' }}>{d.who}</b> : null}
                          {d.who && d.when ? ' · ' : ''}{d.when}
                          {m.tags.length ? ` · ${m.tags.join(', ')}` : ''}
                          {m.revNumber ? ` · Rev ${m.revNumber}` : ''}
                        </div>
                        <div style={{ whiteSpace: 'pre-wrap', fontStyle: d.quiet ? 'italic' : 'normal' }}>{m.body}</div>
                      </div>
                    )
                  })}
                </div>
              )}
              {rev.rows.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} role="group" aria-label="About which rows">
                  {/* The rows that need a word — a question about a row that matches the plans can name it in the text. */}
                  {rev.rows.filter((r) => r.kind !== 'matches').slice(0, 24).map((r) => {
                    const on = askTags.includes(r.tag)
                    return (
                      <button key={r.id} type="button" aria-pressed={on} onClick={() => setAskTags((t) => (on ? t.filter((x) => x !== r.tag) : [...t, r.tag]))} style={{ padding: '0.15rem 0.55rem', borderRadius: 999, border: '1px solid var(--border-strong)', background: on ? 'var(--text-strong)' : 'var(--surface)', color: on ? 'white' : 'var(--text-muted)', font: 'inherit', fontSize: '0.75rem', cursor: 'pointer' }}>
                        {r.tag || 'Accessory'}
                      </button>
                    )
                  })}
                </div>
              ) : null}
              <textarea
                aria-label="Ask about a product or say what you need"
                placeholder="Ask about a product or say what you need"
                value={askBody}
                onChange={(e) => { setAskBody(e.target.value); setAskedOk(null) }}
                rows={3}
                style={{ padding: '0.55rem 0.7rem', border: '1px solid var(--border-strong)', borderRadius: 6, font: 'inherit', fontSize: '0.9rem', resize: 'vertical', background: 'var(--surface)', color: 'var(--text-strong)' }}
              />
              {askError ? <div style={{ fontSize: '0.85rem', color: '#b42318' }} role="alert">{askError}</div> : null}
              {askedOk ? <div style={{ fontSize: '0.85rem', color: '#1f7a3a' }} role="status">{askedOk}</div> : null}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={quiet}>Anyone with the link may ask. A question is not a decision — the rows above are.</span>
                <button type="button" disabled={asking || !askBody.trim() || (me?.messagesThisHour != null && me.messagesThisHour >= 5)} onClick={() => void sendAsk()} style={{ padding: '0.5rem 1rem', borderRadius: 6, border: 'none', background: COPPER, color: 'white', font: 'inherit', fontWeight: 700, cursor: 'pointer', opacity: asking || !askBody.trim() ? 0.6 : 1 }}>
                  {asking ? 'Sending…' : 'Ask'}
                </button>
              </div>
            </div>
            <div style={{ ...card, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="room-send">
              <div style={quiet}>
                {me ? (
                  <>
                    Reviewing as <b style={{ color: 'var(--text-strong)' }}>{me.name}</b> · {ROOM_ROLE_LABELS[me.role]}{!me.mayDecide ? ' · watching' : ''} ·{' '}
                    <button type="button" onClick={() => { remember(null); setIdName(''); setIdEmail(''); setIdentifyOpen(true) }} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: COPPER, fontWeight: 700, cursor: 'pointer' }}>not you?</button>
                  </>
                ) : (
                  <>Nobody is signed in on this page. The first decision you tap will ask who you are.</>
                )}
              </div>
              {sendError ? <div style={{ fontSize: '0.85rem', color: '#b42318' }} role="alert">{sendError}</div> : null}
              {sent ? <div style={{ fontSize: '0.85rem', color: '#1f7a3a' }} role="status">{sent}</div> : null}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" disabled={sending || Object.keys(pending).length === 0 || me?.mayDecide === false} onClick={() => (me ? void sendReview() : setIdentifyOpen(true))} style={{ padding: '0.6rem 1.1rem', borderRadius: 6, border: 'none', background: Object.keys(pending).length === 0 || me?.mayDecide === false ? 'var(--bg-200)' : 'var(--text-strong)', color: Object.keys(pending).length === 0 || me?.mayDecide === false ? 'var(--text-faint)' : 'white', font: 'inherit', fontWeight: 700, cursor: Object.keys(pending).length === 0 ? 'not-allowed' : 'pointer' }}>
                  {sending ? 'Sending…' : me?.mayDecide === false ? 'Watching only' : 'Send my review'}
                </button>
              </div>
            </div>
            <p style={{ ...quiet, marginTop: '1rem', textAlign: 'center', fontSize: '0.75rem' }}>This page is for product review only. Nothing here is a bill or a contract.</p>
          </>
        ) : null}
      </div>

      {identifyOpen ? (
        // window-z: allow — the submittal room is a public page with no dock and nothing else stacked on it.
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem' }} role="presentation" onClick={(e) => { if (e.target === e.currentTarget) setIdentifyOpen(false) }}>
          <form role="dialog" aria-modal="true" aria-label={identifyFor === 'ask' ? 'Before you ask' : 'Before you decide'} style={{ ...card, maxWidth: 520, width: '100%', boxShadow: '0 10px 40px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: 8 }} onMouseDown={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); void identify() }}>
            <div style={{ ...label, color: COPPER }}>{identifyFor === 'ask' ? 'Before you ask' : 'Before you decide'}</div>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>{identifyFor === 'ask' ? 'Tell us who you are, so the answer reaches you. Asked once.' : 'Tell us who you are, so the record says so. Asked once.'}</p>
            <input aria-label="Your name" placeholder="Your name" value={idName} onChange={(e) => setIdName(e.target.value)} autoComplete="name" style={{ padding: '0.55rem 0.7rem', border: '1px solid var(--border-strong)', borderRadius: 6, font: 'inherit', background: 'var(--surface)', color: 'var(--text-strong)' }} />
            <input aria-label="Your email" placeholder="Your email" type="email" value={idEmail} onChange={(e) => setIdEmail(e.target.value)} autoComplete="email" style={{ padding: '0.55rem 0.7rem', border: '1px solid var(--border-strong)', borderRadius: 6, font: 'inherit', background: 'var(--surface)', color: 'var(--text-strong)' }} />
            <input aria-hidden="true" tabIndex={-1} name="website" autoComplete="off" style={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} role="group" aria-label="I am">
              {ROOM_ROLES.map((r) => (
                <button key={r} type="button" aria-pressed={idRole === r} onClick={() => setIdRole(r)} style={{ padding: '0.35rem 0.7rem', borderRadius: 999, border: '1px solid var(--border-strong)', background: idRole === r ? 'var(--text-strong)' : 'var(--surface)', color: idRole === r ? 'white' : 'var(--text-muted)', font: 'inherit', fontSize: '0.8rem', fontWeight: idRole === r ? 700 : 500, cursor: 'pointer' }}>
                  {ROOM_ROLE_LABELS[r]}
                </button>
              ))}
            </div>
            {idError ? <div style={{ fontSize: '0.85rem', color: '#b42318' }} role="alert">{idError}</div> : null}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
              <button type="button" onClick={() => { setIdentifyOpen(false); setPending({}); setIdentifyFor('decide') }} style={{ padding: '0.5rem 0.9rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', font: 'inherit', cursor: 'pointer' }}>Just looking</button>
              <button type="submit" style={{ padding: '0.5rem 1.1rem', borderRadius: 6, border: 'none', background: 'var(--text-strong)', color: 'white', font: 'inherit', fontWeight: 700, cursor: 'pointer' }}>That&apos;s me</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  )
}

/**
 * The procurement card (v2.4087): the office's log for the GC — one line per released
 * or ordered tag with its status, when it lands and when it is needed. Status and dates
 * only; the PO and the supply house stay on the office's screen. Derived here with the
 * same kernel the office uses, from the pieces the room fetch carries.
 */
function ProcurementCard({ revisions, procurement, companyName }: { /** The current revision first, then the shared ones before it, newest first. */ revisions: RoomRevision[]; procurement: NonNullable<SubmittalRoomPayload['procurement']>; companyName: string }) {
  // 2026-10-02 · a resubmit from the rows sent back leaves the approved rows on the revision before; they are
  // released, so the card lists them too (`rowsThatStand`, the office's log reads the same way).
  const stands = rowsThatStand(revisions.map((r) => ({ rev: r.rev, rows: r.rows })), (r) => r.decision?.kind === 'approved' || (r.parts ?? []).some((p) => p.decision?.kind === 'approved'))
  const sources = [...(revisions[0]?.rows ?? []).map((row) => ({ row, standsOnRev: null as number | null })), ...stands.map((s) => ({ row: s.row, standsOnRev: s.rev }))]
  // A row with parts (2026-10-01): a line per part the GC sees, each with its own call; the order-only parts never reach the room.
  const items: ProcurementItemSource[] = sources
    .filter(({ row }) => row.tag.trim())
    .flatMap(({ row: r, standsOnRev }): ProcurementItemSource[] => {
      const base = { tag: r.tag.trim(), supplyHouse: null, leadTimeDays: r.leadTimeDays ?? null, shared: true, standsOnRev }
      const parts = (r.parts ?? []).filter((p) => p.procureKey)
      if (parts.length === 0) return [{ ...base, product: r.proposed || r.plans || '(no product)', decision: r.decision ? { kind: r.decision.kind, at: r.decision.at } : null }]
      return parts.map((p, k) => ({ ...base, product: p.head, decision: p.decision ? { kind: p.decision.kind, at: p.decision.at } : r.decision ? { kind: r.decision.kind, at: r.decision.at } : null, partKey: p.procureKey, partOrder: k + 1 }))
    })
  const records: ProcurementRecord[] = procurement.records.map((x, i) => ({ id: `room-${i}`, tag: x.tag, partKey: x.partKey ?? null, label: x.label, leadTimeDays: x.leadTimeDays, stage: (x.stage as ProcurementStage | null) ?? null, orderedOn: x.orderedOn, poRef: '', expectedOn: x.expectedOn, deliveredOn: x.deliveredOn, note: x.note, sortOrder: x.sortOrder }))
  const splits: StageSplitRecord[] = procurement.splits.map((sp) => ({ countRowId: sp.countRowId, lineId: sp.lineId, partId: sp.partId, weights: { rough_in: sp.roughIn, top_out: sp.topOut, trim_set: sp.trimSet }, source: (['hand', 'rule', 'book', 'assembly'].includes(sp.source) ? sp.source : 'hand') as StageSplitSource }))
  const tagStage = tagStagesFrom(procurement.countRows, splits, items.map((i) => i.tag))
  const rows = buildProcurementLog({ items, records, tagStage, stageDates: procurement.stageDates as StageDates }).filter((r) => r.status !== 'not_submitted' && r.status !== 'awaiting' || r.isHand)
  if (rows.length === 0) return null
  const hasRequired = rows.some((r) => r.requiredOn)
  return (
    <div style={{ ...card, marginTop: 10 }} data-testid="room-procurement">
      <div style={{ ...label, color: COPPER }}>Procurement</div>
      <div style={{ ...quiet, marginTop: 4 }}>
        {procurement.lastUpdateAt ? `Updated ${logDate(calendarYmdInAppTzFromIso(procurement.lastUpdateAt))} by ${companyName}` : `As it stands today, from ${companyName}`} · {procurementHeadline(rows)}
      </div>
      <div style={{ overflowX: 'auto', marginTop: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', minWidth: 420 }}>
          <thead>
            <tr>
              {['Tag', 'Status', 'Expected', 'Required', ''].map((h) => (
                <th key={h} style={{ ...label, textAlign: 'left', padding: '0.25rem 0.4rem', borderBottom: '1px solid var(--border-strong)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} data-testid="room-procurement-row">
                <td style={{ padding: '0.3rem 0.4rem', borderBottom: '1px solid var(--border)', fontWeight: 700, whiteSpace: 'nowrap' }}>{r.tag ?? '—'}<div style={{ ...quiet, fontWeight: 400 }}>{r.product}</div></td>
                <td style={{ padding: '0.3rem 0.4rem', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{statusText(r)}</td>
                <td style={{ padding: '0.3rem 0.4rem', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{r.deliveredOn ? '—' : r.expectedOn ? logDate(r.expectedOn) : '—'}</td>
                <td style={{ padding: '0.3rem 0.4rem', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{r.requiredOn ? logDate(r.requiredOn) : '—'}</td>
                <td style={{ padding: '0.3rem 0.4rem', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                  {r.deliveredOn ? (
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-green-700)' }}>on site</span>
                  ) : r.late ? (
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#b42318' }}>{Math.abs(r.floatDays ?? 0)} d late</span>
                  ) : r.floatDays != null ? (
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-green-700)' }}>on time</span>
                  ) : r.orderBy ? (
                    <span style={{ ...quiet, fontSize: '0.72rem' }}>{floatText(r)}</span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ ...quiet, marginTop: 6 }}>{hasRequired ? 'Required = the start of the stage the item belongs to on the schedule we were given.' : 'Required dates fill in once the job’s stage schedule is set.'}</div>
    </div>
  )
}
