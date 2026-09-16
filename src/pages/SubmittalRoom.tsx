/**
 * The review room — /submittal?t=… (Submittals stage 4a, decisions 8–12). The one link per
 * bid the GC forwards: the customer's architect or designer reads the product decisions in
 * their own words — which rows match the plans, which differ and why — with the package to
 * download. Just looking asks nothing. Deciding or asking asks who you are (stage 4a-ii; in
 * this release the buttons say so). Nothing about money, the builder's account or the supply
 * houses is on the page. Customer-facing → light theme pinned, phone first.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { useSearchParams } from 'react-router-dom'

import { staffAwarePublicHeaders } from '../lib/publicFunctionStaffHeaders'
import { PUBLIC_PREVIEW_PARAM, isPreviewFlag } from '../lib/publicViewCounting'
import { parseSubmittalRoomPayload, ROOM_ROLE_LABELS } from '../lib/submittals/submittalRoom'
import { roomHeadline, roomSubline, type RoomRevision, type RoomRow, type SubmittalRoomPayload } from '../../supabase/functions/_shared/submittalRoomPayload'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string

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
  font: 'inherit',
  background: on ? (tone === 'g' ? '#1f7a3a' : tone === 'a' ? COPPER : '#b42318') : 'var(--surface)',
  color: on ? 'white' : 'var(--text-muted)',
})

function shortDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function RowCard({ row, onDecide }: { row: RoomRow; onDecide: () => void }) {
  const differs = row.kind === 'differs'
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
          <b style={{ textTransform: 'capitalize' }}>{row.decision.kind === 'revise' ? 'Revise' : row.decision.kind}</b>
          {row.decision.byName ? ` · ${row.decision.byName}` : ''}
          {row.decision.at ? ` · ${shortDate(row.decision.at)}` : ''}
          {row.decision.note ? <span style={quiet}> · “{row.decision.note}”</span> : null}
        </div>
      ) : null}
      {differs ? (
        <div style={{ marginTop: 10, display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 6, overflow: 'hidden' }} role="group" aria-label={`Your call on ${row.tag}`}>
          <button type="button" onClick={onDecide} style={seg(row.decision?.kind === 'approved', 'g')}>Approve</button>
          <button type="button" onClick={onDecide} style={seg(row.decision?.kind === 'revise', 'a')}>Revise</button>
          <button type="button" onClick={onDecide} style={seg(row.decision?.kind === 'rejected', 'r')}>Reject</button>
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
      } catch (err) {
        if (!ac.signal.aborted) setView({ kind: 'dead', message: err instanceof Error && /fetch/i.test(err.message) ? 'Could not reach the office. Check your connection and reload.' : 'Could not load the review.' })
      }
    })()
    return () => ac.abort()
  }, [token, preview])

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
                <RowCard key={r.id} row={r} onDecide={() => setIdentifyOpen(true)} />
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
                      <RowCard key={r.id} row={r} onDecide={() => setIdentifyOpen(true)} />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div style={{ ...card, marginTop: 12, background: 'var(--bg-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.85rem' }}>
                <b>{rev.counts.decided} decided · {rev.counts.open} to go</b>
              </span>
              {rev.hasPackage ? (
                <a href={pdfHref(rev)} target="_blank" rel="noreferrer" data-testid="room-pdf" style={{ fontSize: '0.85rem', fontWeight: 700, color: COPPER }}>
                  Download Rev {rev.rev} PDF ↗
                </a>
              ) : (
                <span style={quiet}>The PDF is on its way.</span>
              )}
            </div>
            <p style={{ ...quiet, marginTop: '1rem', textAlign: 'center', fontSize: '0.75rem' }}>This page is for product review only. Nothing here is a bill or a contract.</p>
          </>
        ) : null}
      </div>

      {identifyOpen ? (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '1rem' }} role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setIdentifyOpen(false) }}>
          <div role="dialog" aria-modal="true" aria-label="Before you decide" style={{ ...card, maxWidth: 520, width: '100%', boxShadow: '0 10px 40px rgba(0,0,0,0.25)' }} onMouseDown={(e) => e.stopPropagation()}>
            <div style={{ ...label, color: COPPER }}>Before you decide</div>
            <p style={{ margin: '0.4rem 0 0', fontSize: '0.9rem' }}>Deciding on this page comes in the next release. For now, reply to the email that brought you here with your call on each row, and we will put it on the record with your name.</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <button type="button" onClick={() => setIdentifyOpen(false)} style={{ padding: '0.45rem 0.9rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', font: 'inherit', cursor: 'pointer' }}>Just looking</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
