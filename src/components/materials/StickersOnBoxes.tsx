/**
 * These are on boxes (punch list #329, design section 10, PR 10): the form that puts a range of named stickers on
 * their boxes in one press, with no scan. It asks the names as the print window asks them (one typed field, read by
 * `stickerNames.ts`: `G78-150`), how the boxes sit, which place and a where line, and says ahead what the press will
 * do, counted from the site's boxes and blank stickers: how many boxes will be made, how many names are boxes already
 * and take their stickers, how many have no blank sticker and are left. One press calls `place_sticker_range` as the
 * caller (`stickersOnBoxesIo.ts`). The answer stays on the form in sentences, and a name the database refused stays
 * with its reason while the rest go on.
 *
 * One form, two frames: a window on the office's Materials page, opened from a run's row in the Runs fold, and a
 * sheet on the phone's On site tab. It needs signal, as a scan's placing does: only the database can say which
 * stickers are still blank. The words and the plan are `lib/materials/stickersOnBoxes.ts`.
 */
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { readLastBoxKind, rememberBoxKind } from '../../lib/materials/boxKindMemory'
import { BOX_KIND_CHOICES, boxKindWords, type BoxKindChoice } from '../../lib/materials/editBox'
import type { Place } from '../../lib/materials/onSite'
import { fetchSiteStickerNames, type SiteStickerNames } from '../../lib/materials/stickerRunsIo'
import {
  ON_BOXES_FAILED,
  ON_BOXES_LABEL,
  ON_BOXES_NAMES_LABEL,
  ON_BOXES_PLACEHOLDER,
  ON_BOXES_READING_WORDS,
  ON_BOXES_SUB,
  ON_BOXES_UNREAD_WORDS,
  onBoxesAsk,
  onBoxesGoesOnWords,
  onBoxesOutcome,
  onBoxesPlan,
  onBoxesPlanLines,
  onBoxesPressLabel,
  onBoxesReady,
  onBoxesRequest,
  type OnBoxesAnswer,
  type OnBoxesOutcome,
} from '../../lib/materials/stickersOnBoxes'
import { placeStickerRange } from '../../lib/materials/stickersOnBoxesIo'
import { NO_SIGNAL_WORDS } from '../../lib/materials/stickerPlace'
import { formatErrorMessage } from '../../utils/errorHandling'
import { Sheet } from '../tally/OnSiteSheet'

const BLUE = '#2563eb'
const btn: CSSProperties = { minHeight: 44, padding: '0 0.9rem', borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }
const btnPrimary: CSSProperties = { ...btn, background: BLUE, borderColor: BLUE, color: '#fff', width: '100%', minHeight: 48 }
const deadStyle: CSSProperties = { background: DEAD_PRESS_FILL, borderColor: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'default' }
const on: CSSProperties = { background: 'var(--text-strong)', color: 'var(--bg-page)', borderColor: 'var(--text-strong)' }
const input: CSSProperties = { width: '100%', minHeight: 44, padding: '0.5rem 0.75rem', fontSize: '1rem', boxSizing: 'border-box', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-strong)', fontFamily: 'inherit' }
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.85rem' }
const lineStyle: CSSProperties = { margin: 0, fontSize: '0.9rem', lineHeight: 1.45 }

type Props = {
  jobId: string
  jobLabel: string
  /** The job's places, for a new box. */
  places: ReadonlyArray<Place>
  /** What the Names field opens on: a run's blank names as one range, or nothing. */
  initialNames?: string
  /** Drawn as the phone's sheet; a window on a desk otherwise. */
  sheet?: boolean
  onClose: () => void
  /** Told once the press landed, so the page reads its boxes and runs again. */
  onPlaced?: (answer: OnBoxesAnswer, outcome: OnBoxesOutcome) => void
  /** The write and the read; a test hands spies. */
  place?: typeof placeStickerRange
  siteNames?: (jobId: string) => Promise<SiteStickerNames>
  /** The device has signal; a test hands one. */
  online?: () => boolean
}

export default function StickersOnBoxes({ jobId, jobLabel, places, initialNames = '', sheet = false, onClose, onPlaced, place = placeStickerRange, siteNames = fetchSiteStickerNames, online = () => typeof navigator === 'undefined' || navigator.onLine !== false }: Props) {
  const [typed, setTyped] = useState(initialNames)
  const [kind, setKind] = useState<BoxKindChoice>(() => readLastBoxKind())
  const [placeId, setPlaceId] = useState<string | null>(places[0]?.id ?? null)
  const [where, setWhere] = useState('')
  /** The site's boxes and blank named stickers: undefined while they are read, null when the read failed. */
  const [site, setSite] = useState<SiteStickerNames | null | undefined>(undefined)
  useEffect(() => {
    let live = true
    siteNames(jobId).then((got) => { if (live) setSite(got) }).catch(() => { if (live) setSite(null) })
    return () => { live = false }
  }, [jobId, siteNames])

  // Signal, watched: the press comes back alive when the bars do.
  const [, setTick] = useState(0)
  useEffect(() => {
    const bump = () => setTick((t) => t + 1)
    window.addEventListener('online', bump)
    window.addEventListener('offline', bump)
    return () => { window.removeEventListener('online', bump); window.removeEventListener('offline', bump) }
  }, [])
  const hasSignal = online()

  const ask = onBoxesAsk(typed)
  const plan = useMemo(() => (ask.names && site ? onBoxesPlan(ask.names, site) : null), [ask.names, site])
  // With the site unread nothing is counted ahead: the press sends every name and the answer says what became of each.
  const ready = ask.names ? (plan ? onBoxesReady(plan) : site === null ? ask.names.length : 0) : 0
  const verdict = onBoxesRequest({ jobId, names: ask.names, boxKind: kind, placeId, where })

  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [done, setDone] = useState<{ outcome: OnBoxesOutcome } | null>(null)
  const dead = !verdict.ok || ready === 0 || site === undefined || busy || !hasSignal
  const run = async () => {
    if (!verdict.ok || dead) return
    setBusy(true)
    setFailure(null)
    try {
      const answer = await place(verdict.request)
      const outcome = onBoxesOutcome(answer, verdict.request.names)
      if (answer.made.length > 0) rememberBoxKind(verdict.request.boxKind)
      setDone({ outcome })
      onPlaced?.(answer, outcome)
    } catch (e) {
      setFailure(formatErrorMessage(e, ON_BOXES_FAILED))
    } finally {
      setBusy(false)
    }
  }

  const body: ReactNode = done ? (
    <div style={{ display: 'grid', gap: '0.5rem' }} data-testid="on-boxes-done" data-tone={done.outcome.tone}>
      {done.outcome.lines.map((l) => <p key={l} role="status" style={{ ...lineStyle, fontWeight: 600, color: done.outcome.tone === 'success' ? 'var(--text-green-700)' : 'var(--text-strong)' }} data-testid="on-boxes-done-line">{l}</p>)}
      {done.outcome.heldHead ? (
        <div role="alert" style={{ display: 'grid', gap: '0.25rem', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--text-amber-800)', background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', borderRadius: 10, padding: '0.6rem 0.75rem', fontSize: '0.85rem' }} data-testid="on-boxes-held">
          <strong>{done.outcome.heldHead}</strong>
          {done.outcome.held.map((h) => <span key={h.name} data-testid="on-boxes-held-row"><b>{h.name}</b>{h.why ? `: ${h.why}` : ''}</span>)}
        </div>
      ) : null}
    </div>
  ) : (
    <>
      <label style={{ display: 'grid', gap: '0.25rem', fontWeight: 600, fontSize: '0.9rem' }}>
        {ON_BOXES_NAMES_LABEL}
        <input type="text" autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={ON_BOXES_PLACEHOLDER} spellCheck={false} autoComplete="off" autoCapitalize="characters" aria-label={ON_BOXES_NAMES_LABEL} style={{ ...input, fontSize: '1.2rem', fontWeight: 800, letterSpacing: '0.03em', textTransform: 'uppercase' }} data-testid="on-boxes-names" />
      </label>
      <p role={ask.tone === 'refused' ? 'alert' : undefined} style={{ ...lineStyle, color: ask.tone === 'refused' ? 'var(--text-red-700)' : 'var(--text-muted)', fontWeight: ask.tone === 'refused' ? 600 : 400 }} data-testid="on-boxes-read">{ask.words}</p>
      {ask.names && site === undefined ? <p style={{ ...muted, margin: 0 }} data-testid="on-boxes-reading">{ON_BOXES_READING_WORDS}</p> : null}
      {site === null ? <p style={{ ...muted, margin: 0 }} data-testid="on-boxes-unread">{ON_BOXES_UNREAD_WORDS}</p> : null}
      {plan && ask.names ? (
        <div style={{ display: 'grid', gap: '0.15rem' }} data-testid="on-boxes-plan">
          {onBoxesPlanLines(plan, ask.names).map((l) => <p key={l} style={lineStyle}>{l}</p>)}
        </div>
      ) : null}
      <div style={{ display: 'grid', gap: '0.25rem' }}>
        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>How they sit</span>
        <div role="group" aria-label="How they sit" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.35rem' }}>
          {BOX_KIND_CHOICES.map((k) => <button key={k} type="button" aria-pressed={k === kind} style={{ ...btn, ...(k === kind ? on : {}) }} onClick={() => setKind(k)}>{boxKindWords(k)}</button>)}
        </div>
      </div>
      {places.length > 0 ? (
        <div style={{ display: 'grid', gap: '0.35rem' }}>
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Which place on site</span>
          <div role="group" aria-label="Which place on site" style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {places.map((p) => <button key={p.id} type="button" aria-pressed={placeId === p.id} onClick={() => setPlaceId(placeId === p.id ? null : p.id)} style={{ ...btn, minHeight: 36, padding: '0 0.75rem', borderRadius: 999, fontSize: '0.85rem', ...(placeId === p.id ? on : {}) }}>{p.name}</button>)}
          </div>
        </div>
      ) : null}
      <label style={{ display: 'grid', gap: '0.25rem', fontWeight: 600, fontSize: '0.9rem' }}>Where exactly, if it helps<input type="text" value={where} onChange={(e) => setWhere(e.target.value)} placeholder="by the north stair" aria-label="Where exactly" style={input} data-testid="on-boxes-where" /></label>
      <p style={{ ...muted, margin: 0 }} data-testid="on-boxes-goes-on">{onBoxesGoesOnWords(jobLabel)} A box already on the site keeps its kind and its place.</p>
    </>
  )

  const footer: ReactNode = done ? (
    <button type="button" style={{ ...btn, width: '100%' }} onClick={onClose} data-testid="on-boxes-close">Close</button>
  ) : (
    <>
      {!hasSignal ? <p role="alert" style={{ margin: 0, color: 'var(--text-amber-800)', fontSize: '0.85rem' }} data-testid="on-boxes-no-signal">{NO_SIGNAL_WORDS}</p> : null}
      {failure ? <p role="alert" style={{ margin: 0, color: 'var(--text-red-700)', fontSize: '0.85rem' }} data-testid="on-boxes-failure">{failure}</p> : null}
      {!verdict.ok && ask.tone === 'ok' ? <p role="alert" style={{ margin: 0, color: 'var(--text-red-700)', fontSize: '0.85rem' }} data-testid="on-boxes-refusal">{verdict.words}</p> : null}
      <button type="button" disabled={dead} aria-disabled={dead} style={{ ...btnPrimary, ...(dead ? deadStyle : {}) }} onClick={() => void run()} data-testid="on-boxes-press">{busy ? 'Putting them on…' : onBoxesPressLabel(ready)}</button>
    </>
  )

  if (sheet) {
    return <Sheet title={ON_BOXES_LABEL} sub={done ? undefined : ON_BOXES_SUB} onClose={onClose} footer={footer}>{body}</Sheet>
  }
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem' }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={ON_BOXES_LABEL} style={{ background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 12, width: 'min(520px, 100%)', maxHeight: 'min(90vh, 100%)', overflowX: 'hidden', overflowY: 'auto', padding: '1rem 1.25rem 1.25rem', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '0.75rem', boxShadow: '0 12px 32px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', overflowWrap: 'anywhere' }}>{ON_BOXES_LABEL} · {jobLabel}</h2>
            {done ? null : <span style={muted}>{ON_BOXES_SUB}</span>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-muted)', minHeight: 36, minWidth: 36 }}>×</button>
        </div>
        {body}
        <div style={{ display: 'grid', gap: '0.5rem' }}>{footer}</div>
      </div>
    </div>,
    document.body,
  )
}
