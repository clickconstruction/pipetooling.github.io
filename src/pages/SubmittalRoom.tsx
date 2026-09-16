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
import { useSearchParams } from 'react-router-dom'

import { staffAwarePublicHeaders } from '../lib/publicFunctionStaffHeaders'
import { PUBLIC_PREVIEW_PARAM, isPreviewFlag } from '../lib/publicViewCounting'
import { parseSubmittalRoomPayload, ROOM_ROLE_LABELS } from '../lib/submittals/submittalRoom'
import { roomHeadline, roomSubline, ROOM_ROLES, type RoomRevision, type RoomRole, type RoomRow, type SubmittalRoomPayload } from '../../supabase/functions/_shared/submittalRoomPayload'
import type { DecisionKind } from '../../supabase/functions/_shared/submittalReviewActions'

// The live build's env carries a trailing slash — strip it so the function URLs read one slash.
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/+$/, '')

type View = { kind: 'loading' } | { kind: 'dead'; message: string } | { kind: 'closed'; payload: SubmittalRoomPayload } | { kind: 'empty'; message: string } | { kind: 'open'; payload: SubmittalRoomPayload }

const COPPER = '#b0662f'
const paper: CSSProperties = { minHeight: '100vh', background: 'var(--bg-subtle)', color: 'var(--text-strong)' }
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.85rem 0.95rem' }
const label: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const quiet: CSSProperties = { fontSize: '0.8rem', color: 'var(--text-muted)' }
const seg = (on: boolean, tone: 'g' | 'a' | 'r'): CSSProperties => ({
  padding: '0.5rem 0.85rem',
  fontSize: '0.85rem',
  fontWeight: on ? 700 : 500,
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
  background: on ? (tone === 'g' ? '#1f7a3a' : tone === 'a' ? COPPER : '#b42318') : 'var(--surface)',
  color: on ? 'white' : 'var(--text-muted)',
})

function shortDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function RowCard({ row, local, onDecide }: { row: RoomRow; local: DecisionKind | undefined; onDecide: (kind: DecisionKind) => void }) {
  const differs = row.kind === 'differs'
  const shown = local ?? row.decision?.kind
  const tone = row.kind === 'added' ? 'var(--text-muted)' : row.performanceChange ? '#b42318' : COPPER
  return (
    <div style={{ ...card, borderColor: differs && !row.decision ? COPPER : 'var(--border)' }} data-testid="room-row">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
        <b>{row.tag || 'Accessory'}</b>
        <span style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: tone }}>
          {row.kind === 'differs' ? 'differs' : row.kind === 'added' ? 'added for the fixture' : row.kind === 'not_quoted' ? 'to follow' : 'as the plans specify'}
        </span>
      </div>
      {row.plans ? (
        <div style={{ ...quiet, marginTop: 4 }}>
          The plans: <b style={{ color: 'var(--text-strong)' }}>{row.plans}</b>
        </div>
      ) : null}
      {row.proposed ? (
        <div style={{ marginTop: 2, fontSize: '0.9rem' }}>
          {row.kind === 'matches' ? 'Submitted' : 'Proposed'}: <b>{row.proposed}</b>
        </div>
      ) : null}
      {row.why ? <div style={{ ...quiet, marginTop: 4 }}>{row.kind === 'differs' ? 'Why: ' : ''}{row.why}</div> : null}
      {row.performanceChange ? <div style={{ marginTop: 4, fontSize: '0.8rem', color: '#b42318' }}>This changes a performance value on the plans.</div> : null}
      {row.decision ? (
        <div style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--text-strong)' }}>
          <b>{row.decision.kind === 'revise' ? 'Revise' : row.decision.kind === 'approved' ? 'Approved' : 'Rejected'}</b>
          {row.decision.byName ? ` · ${row.decision.byName}` : ''}
          {row.decision.at ? ` · ${shortDate(row.decision.at)}` : ''}
          {row.decision.note ? <span style={quiet}> · “{row.decision.note}”</span> : null}
        </div>
      ) : null}
      {differs ? (
        <div style={{ marginTop: 10, display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 6, overflow: 'hidden' }} role="group" aria-label={`Your call on ${row.tag}`}>
          <button type="button" aria-pressed={shown === 'approved'} onClick={() => onDecide('approved')} style={seg(shown === 'approved', 'g')}>Approve</button>
          <button type="button" aria-pressed={shown === 'revise'} onClick={() => onDecide('revise')} style={seg(shown === 'revise', 'a')}>Revise</button>
          <button type="button" aria-pressed={shown === 'rejected'} onClick={() => onDecide('rejected')} style={seg(shown === 'rejected', 'r')}>Reject</button>
        </div>
      ) : null}
    </div>
  )
}

export default function SubmittalRoom() {
  const [params] = useSearchParams()
  const token = params.get('t')?.trim() ?? ''
  const preview = isPreviewFlag(params.get(PUBLIC_PREVIEW_PARAM))
  const [view, setView] = useState<View>({ kind: 'loading' })
  const [revId, setRevId] = useState<string | null>(null)
  const [showMatches, setShowMatches] = useState(false)
  const [identifyOpen, setIdentifyOpen] = useState(false)
  /** Who this browser is on this room: the personal token the identify sheet returned (or the link carried), remembered per room. */
  const [me, setMe] = useState<{ token: string; name: string; role: RoomRole; mayDecide: boolean } | null>(null)
  const [idName, setIdName] = useState('')
  const [idEmail, setIdEmail] = useState('')
  const [idRole, setIdRole] = useState<RoomRole>('architect')
  const [idError, setIdError] = useState<string | null>(null)
  const [pending, setPending] = useState<Record<string, { decision: DecisionKind; note: string }>>({})
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
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
        if (payload.person) setMe({ token, name: payload.person.name, role: payload.person.role, mayDecide: payload.person.mayDecide })
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

  function decide(rowId: string, kind: DecisionKind) {
    setPending((p) => ({ ...p, [rowId]: { decision: kind, note: p[rowId]?.note ?? '' } }))
    setSent(null)
    if (!me) setIdentifyOpen(true)
  }

  async function identify() {
    setIdError(null)
    const res = await fetch(`${supabaseUrl}/functions/v1/submit-submittal-review`, {
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
    // The address becomes the personal link, so a reload (or a forward) knows who.
    try {
      window.history.replaceState(null, '', `/submittal?t=${encodeURIComponent(j.personToken)}`)
    } catch {
      /* fine */
    }
  }

  async function sendReview() {
    if (!me || !rev) return
    const decisions = Object.entries(pending).map(([itemId, d]) => ({ itemId, decision: d.decision, note: d.note.trim() || undefined }))
    if (decisions.length === 0) return
    setSending(true)
    setSendError(null)
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/submit-submittal-review`, {
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
                    rows: r.rows.map((row) => (pending[row.id] ? { ...row, decision: { kind: pending[row.id]!.decision, note: pending[row.id]!.note.trim() || null, byName: me.name, byPersonId: null, at } } : row)),
                    counts: { ...r.counts, decided: r.rows.filter((row) => row.decision || pending[row.id]).length, open: r.rows.filter((row) => row.kind === 'differs' && !row.decision && !pending[row.id]).length },
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
  const pdfHref = (r: RoomRevision) => `${supabaseUrl}/functions/v1/open-submittal-pdf?t=${encodeURIComponent(token)}&r=${encodeURIComponent(r.id)}`

  return (
    <div data-theme="light" style={paper}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '1rem 1rem 6rem' }}>
        {payload ? (
          <header style={{ marginBottom: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, paddingBottom: '0.7rem', borderBottom: `3px solid var(--text-strong)` }}>
              <div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1 }}>{payload.company.name.toUpperCase()}</div>
                {payload.company.tagline ? <div style={{ ...label, marginTop: 4, letterSpacing: '0.22em' }}>{payload.company.tagline}</div> : null}
              </div>
              {payload.company.phone ? <div style={{ ...quiet, fontSize: '0.75rem', textAlign: 'right' }}>{payload.company.phone}</div> : null}
            </div>
            <div style={{ marginTop: '0.9rem' }}>
              <div style={{ ...label, color: COPPER }}>Product review</div>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', lineHeight: 1.25 }}>{payload.bid.projectName || payload.bid.label}</div>
              <div style={quiet}>Plumbing fixtures &amp; equipment{payload.bid.address ? ` · ${payload.bid.address}` : ''}</div>
            </div>
          </header>
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
            {payload.revisions.length > 1 ? (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: '0.8rem' }} data-testid="room-revisions">
                {payload.revisions.map((r) => (
                  <button key={r.id} type="button" aria-pressed={r.id === rev.id} onClick={() => setRevId(r.id)} style={{ padding: '0.3rem 0.7rem', borderRadius: 999, border: '1px solid var(--border-strong)', background: r.id === rev.id ? 'var(--text-strong)' : 'var(--surface)', color: r.id === rev.id ? 'white' : 'var(--text-muted)', font: 'inherit', fontSize: '0.75rem', fontWeight: r.id === rev.id ? 700 : 500, cursor: 'pointer' }}>
                    Rev {r.rev}{r.current ? ' · current' : ''}{r.sharedAt ? ` · ${shortDate(r.sharedAt)}` : ''}
                  </button>
                ))}
              </div>
            ) : null}

            <div style={{ ...card, borderLeft: `4px solid ${COPPER}` }} data-testid="room-headline">
              <div style={{ ...label, color: COPPER }}>{roomHeadline(rev.counts)}</div>
              <div style={{ ...quiet, marginTop: 4 }}>
                {roomSubline(rev.counts)} <b style={{ color: 'var(--text-strong)' }}>Just looking? Fine.</b> To decide or ask, we&apos;ll ask who you are.
              </div>
              {payload.person ? (
                <div style={{ ...quiet, marginTop: 6 }}>
                  This link was made for <b style={{ color: 'var(--text-strong)' }}>{payload.person.name}</b> · {ROOM_ROLE_LABELS[payload.person.role]}
                  {!payload.person.mayDecide ? ' · watching' : ''}
                </div>
              ) : null}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {rev.rows.filter((r) => r.kind !== 'matches').map((r) => (
                <RowCard key={r.id} row={r} local={pending[r.id]?.decision} onDecide={(k) => decide(r.id, k)} />
              ))}
            </div>

            {rev.counts.matches > 0 ? (
              <div style={{ marginTop: 10 }}>
                <button type="button" aria-expanded={showMatches} onClick={() => setShowMatches(!showMatches)} style={{ background: 'none', border: 'none', padding: '0.4rem 0', font: 'inherit', fontSize: '0.85rem', color: COPPER, fontWeight: 700, cursor: 'pointer' }}>
                  {showMatches ? 'Hide' : 'Show'} the {rev.counts.matches} row{rev.counts.matches === 1 ? '' : 's'} as the plans specify {showMatches ? '▴' : '▾'}
                </button>
                {showMatches ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {rev.rows.filter((r) => r.kind === 'matches').map((r) => (
                      <RowCard key={r.id} row={r} local={pending[r.id]?.decision} onDecide={(k) => decide(r.id, k)} />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {Object.keys(pending).length > 0 ? (
              <div style={{ ...card, marginTop: 10, borderColor: COPPER }} data-testid="room-pending">
                <div style={{ ...label, color: COPPER }}>Your notes · optional</div>
                {Object.entries(pending).map(([id, d]) => {
                  const row = rev.rows.find((r) => r.id === id)
                  return (
                    <div key={id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 8, alignItems: 'center', marginTop: 6, fontSize: '0.85rem' }}>
                      <span><b>{row?.tag || 'Accessory'}</b> · {d.decision === 'revise' ? 'Revise' : d.decision === 'rejected' ? 'Reject' : 'Approve'}</span>
                      <input aria-label={`Note on ${row?.tag || 'accessory'}`} value={d.note} placeholder={d.decision === 'approved' ? 'a note, if any' : 'what you need instead'} onChange={(e) => setPending((p) => ({ ...p, [id]: { decision: d.decision, note: e.target.value } }))} style={{ padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, font: 'inherit', fontSize: '0.85rem', background: 'var(--surface)', color: 'var(--text-strong)' }} />
                    </div>
                  )
                })}
              </div>
            ) : null}
            <div style={{ ...card, marginTop: 12, background: 'var(--bg-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }} data-testid="room-footer">
              <span style={{ fontSize: '0.85rem' }}>
                <b>{rev.counts.decided} decided · {Math.max(0, rev.counts.open - Object.keys(pending).filter((id) => rev.rows.find((r) => r.id === id && r.kind === 'differs' && !r.decision)).length)} to go</b>
                {Object.keys(pending).length > 0 ? <span style={quiet}> · {Object.keys(pending).length} to send</span> : null}
              </span>
              {rev.counts.open > 0 && me?.mayDecide !== false ? (
                <button type="button" onClick={() => { for (const r of rev.rows) if (r.kind === 'differs' && !r.decision && !pending[r.id]) decide(r.id, 'approved') }} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: '0.85rem', fontWeight: 700, color: COPPER, cursor: 'pointer' }}>
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '1rem' }} role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setIdentifyOpen(false) }}>
          <form role="dialog" aria-modal="true" aria-label="Before you decide" style={{ ...card, maxWidth: 520, width: '100%', boxShadow: '0 10px 40px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: 8 }} onMouseDown={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); void identify() }}>
            <div style={{ ...label, color: COPPER }}>Before you decide</div>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>Tell us who you are, so the record says so. Asked once.</p>
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
              <button type="button" onClick={() => { setIdentifyOpen(false); setPending({}) }} style={{ padding: '0.5rem 0.9rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', font: 'inherit', cursor: 'pointer' }}>Just looking</button>
              <button type="submit" style={{ padding: '0.5rem 1.1rem', borderRadius: 6, border: 'none', background: 'var(--text-strong)', color: 'white', font: 'inherit', fontWeight: 700, cursor: 'pointer' }}>That&apos;s me</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  )
}
