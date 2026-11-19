/**
 * Which job is it for? (punch list #392, step 4): the sheet a painter picks a job from. It opens
 * first when the app does not know the job, over the start sheet for **Change the job**, and over
 * a map's window for **Put it on a job…** and **Move it to another job…**.
 *
 * The search leads, with **Near me** beside it, so what is found is drawn under the box and over a
 * phone's keyboard. Under it, today's stops and **Your last jobs**, which holds up to six while the
 * person has been on six (`paintedMapJobPicker.ts`). One press on a row picks it. While a search is
 * typed, what it found takes the lists' place. A search hit the person may not paint on is listed,
 * says why, and cannot be pressed.
 *
 * On a phone it is a sheet on the bottom edge. At a desk it is a window that hangs from near the
 * top, so it stays put while typing shortens the list, and the cursor starts in the search.
 *
 * The lists are a read, so a lost signal draws the retry panel and reads again by itself. A person
 * with no signal must still be able to paint: where the caller allows it, the failed read offers
 * **Paint now and pick the job later**.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useModalStackEntry } from '../../hooks/useModalStackEntry'
import { useTakenDown } from '../../hooks/useTakenDown'
import { PICKER_NEAR_NO_FIX, PICKER_NEAR_NO_FIX_DESK, PICKER_WORDS as W, pickerNearRows, pickerSearchRows, pickerSections, type PickerJob, type PickerPoint, type PickerRow, type PickerSections } from '../../lib/paintedMap/paintedMapJobPicker'
import { PickerNoFix, loadPickerLists, loadPickerNear, locateForPicker, searchPickerJobs, type PickerLists } from '../../lib/paintedMap/paintedMapJobPickerIo'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../../lib/offlineRecoveryState'
import { PAINTED_MAP_SHEET_Z } from '../../lib/windowLayers'
import { formatErrorMessage } from '../../utils/errorHandling'
import { EmptyState } from '../EmptyState'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { paintedSheetFrame, usePaintedSheetDesk } from './paintedSheetFrame'

const SEARCH_DEBOUNCE_MS = 250

export type PaintAMapJobPickerIo = {
  lists: (userId: string) => Promise<PickerLists>
  search: (query: string, userId: string) => Promise<{ hits: PickerJob[]; paintable: Set<string> }>
  /** Find the jobs near me: where the phone is, read once, and the jobs at the placed addresses around it. */
  locate: () => Promise<PickerPoint>
  near: (me: PickerPoint) => Promise<{ nearest: Array<{ key: string; meters: number }>; jobs: PickerJob[]; paintable: Set<string> }>
}
const realIo: PaintAMapJobPickerIo = { lists: loadPickerLists, search: searchPickerJobs, locate: locateForPicker, near: loadPickerNear }

type Props = {
  userId: string
  /** What the sheet is for: the first pick, a change on the start sheet, or a map moved to another job. */
  mode?: 'pick' | 'change' | 'move'
  /** A job the lists leave out: the one the map is on now. */
  excludeJobId?: string | null
  onPick: (job: PickerJob) => void
  onClose: () => void
  /** Offered only when the lists could not be read: paint with no job, and pick it later. */
  onLater?: () => void
  /** The lists, when the caller has just read them: the picker then reads nothing to open. */
  lists?: PickerLists | null
  /** For a smoke. */
  io?: PaintAMapJobPickerIo
}

const secHead: CSSProperties = { fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)', margin: '0.1rem 0 -0.15rem' }
const rowPress: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.6rem', width: '100%', minHeight: 52, padding: '0.45rem 0.7rem', borderRadius: 9, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-strong)', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer', boxSizing: 'border-box' }
const field: CSSProperties = { minHeight: 44, padding: '0.5rem 0.6rem', fontSize: '1rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)', boxSizing: 'border-box', width: '100%', fontFamily: 'inherit' }
const quietPress: CSSProperties = { background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', fontFamily: 'inherit', fontSize: '0.9375rem', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 2, cursor: 'pointer', minHeight: 44, textAlign: 'left' }
const nearPress: CSSProperties = { flex: 'none', minHeight: 44, padding: '0 0.75rem', borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.875rem', whiteSpace: 'nowrap', cursor: 'pointer' }

/** One job as a row. A job the person may not paint on is drawn quiet, says why, and takes no press. */
export function PaintAMapJobRow({ row, onPick }: { row: PickerRow; onPick: (job: PickerJob) => void }) {
  return (
    <button type="button" data-picker-row={row.paintable ? 'yes' : 'no'} disabled={!row.paintable} aria-disabled={!row.paintable} onClick={() => row.paintable && onPick(row.job)} style={row.paintable ? rowPress : { ...rowPress, cursor: 'default', background: 'var(--bg-muted)' }}>
      <span style={{ minWidth: 0, display: 'grid', gap: 1, flex: 1 }}>
        <b style={{ fontSize: '0.9375rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: row.paintable ? 'var(--text-strong)' : 'var(--text-700)' }}>{row.label}</b>
        {row.sub ? <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.sub}</span> : null}
        {row.paintable ? null : <span style={{ fontSize: '0.8125rem', color: 'var(--text-700)' }}>{W.notYours}</span>}
      </span>
      {row.tag ? (
        <span data-picker-tag style={{ flex: 'none', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right', lineHeight: 1.2 }}>
          {row.how ? (
            <>
              {row.how}
              <br />
            </>
          ) : null}
          {row.tag}
        </span>
      ) : null}
    </button>
  )
}

export function PaintAMapJobPicker({ userId, mode = 'pick', excludeJobId = null, onPick, onClose, onLater, lists: given = null, io = realIo }: Props) {
  const isTopmost = useModalStackEntry()
  const desk = usePaintedSheetDesk()
  const [lists, setLists] = useState<PickerLists | null>(given)
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [reading, setReading] = useState(!given)
  /** Lists handed in were just read: the picker opens on them and reads nothing. */
  const handed = useRef(!!given)
  const [q, setQ] = useState('')
  const [found, setFound] = useState<PickerRow[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  /** Find the jobs near me: not asked, finding, the rows found, or why not. */
  const [near, setNear] = useState<{ kind: 'idle' } | { kind: 'finding' } | { kind: 'found'; rows: PickerRow[] } | { kind: 'failed'; words: string }>({ kind: 'idle' })
  const canLocate = typeof navigator !== 'undefined' && 'geolocation' in navigator
  const gen = useRef(0)
  const seq = useRef(0)
  // A read that lands after the sheet is taken down sets nothing.
  const takenDown = useTakenDown()

  const read = useCallback(async () => {
    const mine = ++gen.current
    setReading(true)
    try {
      const got = await io.lists(userId)
      if (mine !== gen.current || takenDown()) return
      setLists(got)
      setFailure(null)
    } catch (e) {
      if (mine !== gen.current || takenDown()) return
      setFailure(recoveryFailureFromError(e, W.failed))
    } finally {
      if (mine === gen.current && !takenDown()) setReading(false)
    }
  }, [io, userId, takenDown])

  useEffect(() => {
    if (handed.current) return
    void read()
  }, [read])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isTopmost()) {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [isTopmost, onClose])

  useEffect(() => {
    const query = q.trim()
    if (query.length < 2) {
      seq.current++
      setFound(null)
      setSearching(false)
      setSearchError(null)
      return
    }
    const mine = ++seq.current
    setSearching(true)
    const t = window.setTimeout(() => {
      void io
        .search(query, userId)
        .then((res) => {
          if (seq.current !== mine) return
          setFound(pickerSearchRows(res.hits, res.paintable).filter((r) => r.job.id !== excludeJobId))
          setSearchError(null)
        })
        .catch((e: unknown) => {
          if (seq.current !== mine) return
          setSearchError(formatErrorMessage(e, 'The jobs could not be searched.'))
        })
        .finally(() => {
          if (seq.current === mine) setSearching(false)
        })
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [q, io, userId, excludeJobId])

  /** One reading of the phone, on this press, and the jobs at the placed addresses around it. Nothing is kept. */
  const findNear = async () => {
    if (near.kind === 'finding') return
    setNear({ kind: 'finding' })
    try {
      const me = await io.locate()
      const got = await io.near(me)
      if (takenDown()) return
      setNear({ kind: 'found', rows: pickerNearRows(got.nearest, got.jobs, got.paintable).filter((r) => r.job.id !== excludeJobId) })
    } catch (e) {
      if (takenDown()) return
      setNear({ kind: 'failed', words: e instanceof PickerNoFix ? (desk ? PICKER_NEAR_NO_FIX_DESK : PICKER_NEAR_NO_FIX)[e.why] : formatErrorMessage(e, W.nearFailed) })
    }
  }

  const sections: PickerSections | null = lists ? pickerSections({ todayStops: lists.todayStops, soon: (lists.soon ?? []).filter((s) => s.job.id !== excludeJobId), last: lists.last.filter((l) => l.job.id !== excludeJobId), todayYmd: lists.todayYmd, paintable: lists.paintable }) : null
  // A job already under Near you is not said again under Today, Coming up or Your last jobs.
  const nearIds = new Set(near.kind === 'found' ? near.rows.map((r) => r.job.id) : [])
  const today = (sections?.today ?? []).filter((r) => r.job.id !== excludeJobId && !nearIds.has(r.job.id))
  const soon = (sections?.soon ?? []).filter((r) => !nearIds.has(r.job.id))
  const last = (sections?.last ?? []).filter((r) => !nearIds.has(r.job.id))
  /** A search is typed: what it found takes the lists' place, under the box. */
  const typed = q.trim().length >= 2
  const frame = paintedSheetFrame(desk)
  const head = mode === 'move' ? W.moveHead : mode === 'change' ? W.changeHead : W.head
  const lead = mode === 'move' ? W.moveLead : mode === 'change' ? W.changeLead : W.lead

  return createPortal(
    <div
      data-paint-a-map-job-picker={mode}
      data-picker-shape={desk ? 'window' : 'sheet'}
      style={{ ...frame.scrim, zIndex: PAINTED_MAP_SHEET_Z + 10 }}
      onClick={(e) => {
        // The sheet or the map's window sits behind: this press closes the picker alone.
        e.stopPropagation()
        onClose()
      }}
    >
      <div role="dialog" aria-modal="true" aria-label={head} onClick={(e) => e.stopPropagation()} style={frame.sheet}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{head}</h2>
          <button type="button" onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.9375rem', minHeight: 40, padding: '0 0.25rem' }}>
            Cancel
          </button>
        </div>
        <div style={{ display: 'grid', gap: '0.7rem', padding: '0.85rem 1rem calc(0.95rem + env(safe-area-inset-bottom, 0px))' }}>
          <p style={{ margin: 0, fontSize: '0.9375rem' }}>{lead}</p>

          <div style={{ display: 'grid', gap: '0.3rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch' }}>
              {/* The cursor starts here at a desk. On a phone it would raise the keyboard over the lists. */}
              <input type="search" data-picker-search aria-label={W.search} value={q} onChange={(e) => setQ(e.target.value)} placeholder={desk ? W.searchPlaceholder : W.search} autoComplete="off" autoFocus={desk} style={{ ...field, flex: 1, minWidth: 0 }} />
              {canLocate ? (
                <button type="button" data-picker-near-press style={nearPress} disabled={near.kind === 'finding'} onClick={() => void findNear()}>
                  {near.kind === 'finding' ? W.nearFinding : W.nearPress}
                </button>
              ) : null}
            </div>
            {canLocate && near.kind === 'failed' ? (
              <span role="alert" style={{ fontSize: '0.875rem', color: 'var(--text-700)' }}>{near.words}</span>
            ) : canLocate && near.kind !== 'found' && !typed ? (
              <span data-picker-near-note style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{W.nearNote}</span>
            ) : null}
          </div>

          {typed ? (
            <>
              {searching ? <p role="status" style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{W.searching}</p> : null}
              {searchError ? <p role="alert" style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-red-700)' }}>{searchError}</p> : null}
              {found && found.length === 0 && !searching ? <EmptyState compact main={`No jobs match ‘${q.trim()}’.`} /> : null}
              {found && found.length > 0 ? (
                <>
                  <div style={secHead}>{W.found}</div>
                  <div data-picker-found style={{ display: 'grid', gap: '0.35rem' }}>
                    {found.map((r) => (
                      <PaintAMapJobRow key={r.job.id} row={r} onPick={onPick} />
                    ))}
                  </div>
                </>
              ) : null}
            </>
          ) : (
            <>
              {near.kind === 'found' ? (
                <>
                  <div style={secHead}>{W.near}</div>
                  {near.rows.length > 0 ? (
                    <div data-picker-near style={{ display: 'grid', gap: '0.35rem' }}>
                      {near.rows.map((r) => (
                        <PaintAMapJobRow key={r.job.id} row={r} onPick={onPick} />
                      ))}
                    </div>
                  ) : (
                    <EmptyState compact main={W.nearNone} />
                  )}
                  <span data-picker-near-only style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{W.nearOnly}</span>
                </>
              ) : null}

              {failure ? (
                <div data-picker-failed style={{ display: 'grid', gap: '0.4rem' }}>
                  <OfflineRetryPanel failure={failure} onRetry={read} surface="paint-a-map-job-picker" idempotent busy={reading} />
                  {onLater ? (
                    <>
                      <button type="button" data-picker-later style={quietPress} onClick={onLater}>
                        {W.later}
                      </button>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{W.laterNote}</span>
                    </>
                  ) : null}
                </div>
              ) : reading && !lists ? (
                <p role="status" style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>{W.reading}</p>
              ) : (
                <>
                  {today.length > 0 ? (
                    <>
                      <div style={secHead}>{W.today}</div>
                      <div data-picker-today style={{ display: 'grid', gap: '0.35rem' }}>
                        {today.map((r) => (
                          <PaintAMapJobRow key={r.job.id} row={r} onPick={onPick} />
                        ))}
                      </div>
                    </>
                  ) : null}
                  {soon.length > 0 ? (
                    <>
                      <div style={secHead}>{W.soon}</div>
                      <div data-picker-soon style={{ display: 'grid', gap: '0.35rem' }}>
                        {soon.map((r) => (
                          <PaintAMapJobRow key={r.job.id} row={r} onPick={onPick} />
                        ))}
                      </div>
                    </>
                  ) : null}
                  {last.length > 0 ? (
                    <>
                      <div style={secHead}>{W.last}</div>
                      <div data-picker-last style={{ display: 'grid', gap: '0.35rem' }}>
                        {last.map((r) => (
                          <PaintAMapJobRow key={r.job.id} row={r} onPick={onPick} />
                        ))}
                      </div>
                    </>
                  ) : null}
                  {today.length === 0 && soon.length === 0 && last.length === 0 && near.kind !== 'found' ? <EmptyState compact main={canLocate ? W.noneNear : W.none} /> : null}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.fullscreenElement ?? document.body,
  )
}
