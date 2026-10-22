import { useEffect, useMemo, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import { useMatchMedia } from '../../hooks/useMatchMedia'
import { usePlanPages } from '../../hooks/usePlanPages'
import { answerWords, searchPlanPages, searchRead, searchTerms, setWords, sheetLabel, substrateNotes, substrateSchedules, type PlanHit, type PlanPageRow } from '../../lib/bids/planText'
import { PdfPageCanvas } from '../contracts/formStudio/PdfPageCanvas'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'

const db = supabase as unknown as SupabaseClient

/** Remembered per browser: the first open shows the one-line lesson under the box. */
const FIRST_LINE_KEY = 'pipetooling_plans_panel_seen'

function clock(iso: string | null): string | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return null
  return new Date(t).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: APP_CALENDAR_TZ })
}

/**
 * The Plans button beside the bid's name on every bid tab (Robot rounds PR 6, v2.5736, punch
 * list #142, decision 9). Drawn only when a bid is in hand.
 */
export function BidPlansButton({ bid, onOpen }: { bid: BidWithBuilder | null; onOpen: () => void }) {
  if (!bid) return null
  return (
    <button
      type="button"
      onClick={onOpen}
      title="Search the plans, read the schedules and the notes, and ask the plans a question"
      style={{ font: 'inherit', fontSize: '0.8rem', fontWeight: 600, padding: '0.3rem 0.75rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-link)', cursor: 'pointer', whiteSpace: 'nowrap' }}
    >
      Plans
    </button>
  )
}

/**
 * The Plans panel: one box, the plans answer first. A side panel on desktop and a full-screen
 * sheet on a phone. Search reads the page text the round wrote (or the browser read once) and the
 * robot's read beside it; the answer card names the sheets and quotes a schedule row or a note,
 * never a count of the robot's own. Under it: the hits with Open sheet, the sheet index, the
 * schedules as tables, the notes with their flags.
 */
export function BidPlansPanel({ bid, shellBidId, canWrite, open, onClose }: { bid: BidWithBuilder | null; shellBidId: string | null; canWrite: boolean; open: boolean; onClose: () => void }) {
  const phone = useMatchMedia('(max-width: 640px)')
  const plansLink = (bid?.plans_link ?? '').trim() || null
  const { state, substrate } = usePlanPages({ bidId: open ? (bid?.id ?? null) : null, plansLink, shellBidId, enabled: open && !!bid, canWrite })
  const [q, setQ] = useState('')
  const [fold, setFold] = useState<{ index: boolean; schedules: boolean; notes: boolean }>({ index: false, schedules: false, notes: false })
  const [viewer, setViewer] = useState<{ page: number; scale: number } | null>(null)
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null)
  const [bytesState, setBytesState] = useState<'idle' | 'loading' | 'failed'>('idle')
  const bytesFor = useRef<string | null>(null)
  const [firstLine] = useState(() => {
    try {
      return localStorage.getItem(FIRST_LINE_KEY) !== '1'
    } catch {
      return true
    }
  })
  useEffect(() => {
    if (!open) return
    try {
      localStorage.setItem(FIRST_LINE_KEY, '1')
    } catch {
      /* a private window shows the line every time */
    }
  }, [open])
  useEffect(() => {
    // A new bid: a fresh box and no page in the viewer.
    setQ('')
    setViewer(null)
    if (bytesFor.current !== bid?.id) {
      setBytes(null)
      setBytesState('idle')
      bytesFor.current = bid?.id ?? null
    }
  }, [bid?.id])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const pages = useMemo<PlanPageRow[]>(() => (state.kind === 'ready' ? state.pages : []), [state])
  const hasText = pages.some((p) => p.has_text)
  const hits = useMemo<PlanHit[]>(() => searchPlanPages(pages, q), [pages, q])
  const read = useMemo(() => searchRead(substrate, q), [substrate, q])
  const asked = searchTerms(q).length > 0
  const answer = asked ? answerWords(q, hits, read, hasText) : null
  const notes = useMemo(() => substrateNotes(substrate), [substrate])
  const schedules = useMemo(() => substrateSchedules(substrate), [substrate])
  const inTrade = substrate?.rollup?.sheet_inventory?.in_trade?.length ?? null

  async function openSheet(page: number) {
    setViewer({ page, scale: phone ? 0.45 : 0.7 })
    if (bytes || bytesState === 'loading' || !bid) return
    setBytesState('loading')
    try {
      const { data, error } = await db.functions.invoke('plan-fetch', { body: { bid: bid.id } })
      if (error || !(data instanceof Blob)) throw new Error(error?.message ?? 'not a PDF')
      setBytes(await data.arrayBuffer())
      setBytesState('idle')
    } catch {
      setBytesState('failed')
    }
  }

  if (!open || !bid) return null
  const label = `b${bid.bid_number ?? '?'} · ${bid.project_name ?? 'bid'}`
  const ct = (bid as { count_tooling_plans_link?: string | null }).count_tooling_plans_link ?? null

  const shell: React.CSSProperties = phone
    ? { position: 'fixed', inset: 0, zIndex: 1006, background: 'var(--surface)', overflowY: 'auto', padding: 'calc(0.75rem + var(--app-top-chrome, 0px)) 0.9rem 1.2rem' }
    : { position: 'fixed', top: 'var(--app-top-chrome, 0px)', right: 0, bottom: 0, width: 'min(460px, 92vw)', zIndex: 1006, background: 'var(--surface)', borderLeft: '1px solid var(--border)', boxShadow: '-8px 0 28px rgba(0,0,0,0.12)', overflowY: 'auto', padding: '0.9rem 1rem 1.2rem' }
  const pf: React.CSSProperties = { font: 'inherit', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-strong)', background: 'none', border: 'none', borderTop: '1px solid var(--border)', padding: '0.5rem 0 0.2rem', margin: '0.5rem 0 0', width: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', gap: '0.4rem', alignItems: 'baseline' }
  const muted: React.CSSProperties = { color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.74rem' }

  return (
    <aside role="dialog" aria-label={`Plans on ${label}`} style={shell} data-testid="bid-plans-panel">
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline' }}>
        <b style={{ fontSize: '0.95rem', color: 'var(--text-strong)' }}>Plans · b{bid.bid_number ?? '?'}</b>
        <span style={{ ...muted }} data-testid="plans-set-line">
          {state.kind === 'ready' ? setWords(state.pages, inTrade, clock(state.readAt), state.source) : state.kind === 'reading' ? `Reading ${state.of} sheets in this browser. Page ${state.page} of ${state.of}.` : state.kind === 'loading' ? 'Opening the set.' : state.kind === 'none' ? state.message : ''}
        </span>
        <button type="button" onClick={onClose} aria-label="Close" style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1, color: 'var(--text-muted)' }}>×</button>
      </div>

      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Type a word or a question"
        aria-label="Search the plans"
        style={{ font: 'inherit', fontSize: '0.92rem', padding: '0.5rem 0.7rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--bg-subtle)', color: 'var(--text-base)', width: '100%', marginTop: '0.6rem' }}
      />
      {firstLine ? <p style={{ margin: '0.25rem 0 0', fontSize: '0.74rem', color: 'var(--text-muted)' }}>Type a word or a question. The plans answer first. The robot can look after.</p> : null}

      {answer ? (
        <div data-testid="plans-answer" style={{ marginTop: '0.6rem', border: '1px solid var(--border-blue)', background: 'var(--bg-blue-tint)', borderRadius: 10, padding: '0.5rem 0.7rem', fontSize: '0.84rem', color: 'var(--text-base)' }}>
          <div style={{ fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-blue-800)', marginBottom: '0.2rem' }}>The plans say</div>
          {answer}
        </div>
      ) : null}

      {asked && hits.length > 0 ? (
        <div data-testid="plans-hits" style={{ marginTop: '0.5rem' }}>
          {hits.slice(0, 12).map((h) => (
            <div key={h.page} style={{ display: 'grid', gridTemplateColumns: '4.4rem minmax(0, 1fr) auto', gap: '0.5rem', alignItems: 'start', padding: '0.4rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.8rem' }}>
              <span>
                <b style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.76rem', color: 'var(--text-strong)' }}>{h.sheet}</b>
                {h.title ? <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>{h.title}</span> : null}
              </span>
              <span style={{ color: 'var(--text-700)', overflowWrap: 'anywhere' }}>
                {h.snippet}
                <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>{h.count === 1 ? '1 hit' : `${h.count} hits`}</span>
              </span>
              <button type="button" onClick={() => void openSheet(h.page)} style={{ font: 'inherit', fontSize: '0.76rem', padding: '0.25rem 0.55rem', borderRadius: 4, border: '1px solid var(--border-strong)', background: 'var(--bg-subtle)', color: 'inherit', cursor: 'pointer' }}>
                Open sheet
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {viewer ? (
        <div data-testid="plans-viewer" style={{ marginTop: '0.6rem', border: '1px solid var(--border)', borderRadius: 8, padding: '0.4rem', background: 'var(--bg-muted)' }}>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.78rem', marginBottom: '0.3rem' }}>
            <b>{sheetLabel(pages.find((p) => p.page === viewer.page) ?? { page: viewer.page, sheet_no: null })}</b>
            <span style={muted}>page {viewer.page}{pages.length ? ` of ${pages.length}` : ''}</span>
            <button type="button" onClick={() => setViewer((v) => (v ? { ...v, page: Math.max(1, v.page - 1) } : v))} style={{ marginLeft: 'auto' }} aria-label="Previous page">‹</button>
            <button type="button" onClick={() => setViewer((v) => (v ? { ...v, page: v.page + 1 } : v))} aria-label="Next page">›</button>
            <button type="button" onClick={() => setViewer((v) => (v ? { ...v, scale: Math.max(0.2, v.scale - 0.15) } : v))} aria-label="Smaller">−</button>
            <button type="button" onClick={() => setViewer((v) => (v ? { ...v, scale: Math.min(3, v.scale + 0.15) } : v))} aria-label="Larger">+</button>
            {ct ? <a href={ct} target="_blank" rel="noreferrer" style={{ fontSize: '0.74rem', color: 'var(--text-link)' }}>CountTooling ↗</a> : null}
            <button type="button" onClick={() => setViewer(null)} aria-label="Close the sheet">×</button>
          </div>
          <div style={{ overflow: 'auto', maxHeight: '60vh', background: 'var(--surface)' }} data-theme="light">
            {bytes ? <PdfPageCanvas bytes={bytes} page={viewer.page} scale={viewer.scale} /> : bytesState === 'failed' ? <p style={{ margin: 0, padding: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>The sheet could not be opened from here.{plansLink ? ' ' : ''}{plansLink ? <a href={plansLink} target="_blank" rel="noreferrer">Open the plans in Drive</a> : null}</p> : <p style={{ margin: 0, padding: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Opening the sheet…</p>}
          </div>
        </div>
      ) : null}

      <button type="button" style={pf} onClick={() => setFold((f) => ({ ...f, index: !f.index }))} aria-expanded={fold.index}>
        Sheet index <span style={muted}>{pages.length ? `${pages.length} sheets` : substrate?.sheets?.length ? `${substrate.sheets.length} sheets` : ''}</span>
        <span style={{ ...muted, marginLeft: 'auto' }}>{fold.index ? '▾' : '▸'}</span>
      </button>
      {fold.index ? (
        <ul style={{ margin: '0.2rem 0 0', padding: 0, listStyle: 'none', fontSize: '0.78rem', display: 'grid', gap: '0.1rem' }} data-testid="plans-index">
          {(pages.length ? pages : (substrate?.sheets ?? []).map((s, i) => ({ page: s.page ?? i + 1, sheet_no: typeof s.sheet_no === 'string' ? s.sheet_no : (s.sheet_no?.value ?? null), title: typeof s.title === 'string' ? s.title : (s.title?.value ?? null) }))).map((p) => (
            <li key={p.page} style={{ display: 'grid', gridTemplateColumns: '4.4rem 1fr auto', gap: '0.5rem' }}>
              <b style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.74rem' }}>{sheetLabel(p)}</b>
              <span style={{ color: 'var(--text-700)' }}>{p.title ?? ''}</span>
              <button type="button" onClick={() => void openSheet(p.page)} style={{ font: 'inherit', fontSize: '0.7rem', background: 'none', border: 'none', color: 'var(--text-link)', cursor: 'pointer', padding: 0 }}>open</button>
            </li>
          ))}
        </ul>
      ) : null}

      <button type="button" style={pf} onClick={() => setFold((f) => ({ ...f, schedules: !f.schedules }))} aria-expanded={fold.schedules}>
        Schedules <span style={muted}>{schedules.length ? `${schedules.length}, from the robot's read` : 'none in the robot\'s read yet'}</span>
        <span style={{ ...muted, marginLeft: 'auto' }}>{fold.schedules ? '▾' : '▸'}</span>
      </button>
      {fold.schedules
        ? schedules.map((t, i) => (
            <div key={i} style={{ marginTop: '0.3rem', overflowX: 'auto' }} data-testid="plans-schedule">
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{t.type}{t.sheet ? ` on ${t.sheet}` : ''}</div>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.76rem' }}>
                <thead>
                  <tr>{t.columns.map((c) => <th key={c} style={{ textAlign: 'left', padding: '2px 6px', borderBottom: '1px solid var(--border)', fontSize: '0.64rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>{c.replace(/_/g, ' ')}</th>)}</tr>
                </thead>
                <tbody>
                  {t.rows.map((r, j) => <tr key={j}>{r.map((cell, k) => <td key={k} style={{ padding: '2px 6px', borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>{cell}</td>)}</tr>)}
                </tbody>
              </table>
            </div>
          ))
        : null}

      <button type="button" style={pf} onClick={() => setFold((f) => ({ ...f, notes: !f.notes }))} aria-expanded={fold.notes}>
        Notes with flags <span style={muted}>{notes.length ? `${notes.filter((n) => n.flags.length).length} of ${notes.length}` : 'none in the robot\'s read yet'}</span>
        <span style={{ ...muted, marginLeft: 'auto' }}>{fold.notes ? '▾' : '▸'}</span>
      </button>
      {fold.notes ? (
        <ul style={{ margin: '0.2rem 0 0', padding: 0, listStyle: 'none', fontSize: '0.8rem', display: 'grid', gap: '0.2rem' }} data-testid="plans-notes">
          {notes.map((n, i) => (
            <li key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', flex: '0 0 3.2rem' }}>{n.sheet ?? ''}</span>
              <span style={{ color: 'var(--text-700)', flex: 1 }}>{n.text}</span>
              {n.flags.map((f) => <span key={f} style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', borderRadius: 4, padding: '1px 5px', background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', whiteSpace: 'nowrap' }}>{f}</span>)}
            </li>
          ))}
        </ul>
      ) : null}

      <p style={{ margin: '0.8rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: '0.4rem' }}>
        The panel says what the plans say and where. Counts come after you send. Ask the robot to look comes in the next update.
      </p>
    </aside>
  )
}
