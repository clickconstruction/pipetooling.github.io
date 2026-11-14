/**
 * The box window (v2.7199, the owner's ask of 2026-11-13): one window with two tabs to dig into a cage or box.
 *
 * - **Cage**: the Edit form (its name, how it sits, the where line, its place), its code, and its own history:
 *   added, each move, each rename, its retire.
 * - **Contents**: each part in it with how many, when it first came in and where the box stood then, and that
 *   part's history in this box under a fold.
 *
 * Since v2.7212 a typed part's name is fixed from its line on Contents: **Fix the name**, with what the rename
 * touches said before the press and **Undo the rename** after it (`partRename.ts`).
 *
 * The histories are readings of rows the app already keeps (`boxHistory.ts`). The phone's box screen hosts the
 * tabs in its own sheet; the office page hosts them in `BoxWindow` below.
 */
import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import EditBoxForm from './EditBoxForm'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { EmptyState } from '../EmptyState'
import { recoveryFailureFromError } from '../../lib/offlineRecoveryState'
import { linesOf, type Container, type ContainerLine, type Place } from '../../lib/materials/onSite'
import { editBoxTitle } from '../../lib/materials/editBox'
import { boxHistory, contentsTabWords, historyFoldWords, lineAdded, lineAddedWords, lineHistory, placeAt, type BoxNameChange, type HistoryEvent } from '../../lib/materials/boxHistory'
import { fetchBoxNames } from '../../lib/materials/boxHistoryIo'
import { boxAddressWords, boxCodeWords } from '../../lib/materials/labels'
import { jobLedgerCapped, listContainerMoves, listMovements, loadJob } from '../../lib/materials/onSiteStore'
import { FIX_PART_NAME_LABEL, PART_NAME_MAX, UNDO_PART_RENAME_LABEL, partRenameMergeNote, partRenamePressLabel, partRenameScopeNote, partRenameVerdict, renamedPartWords, undonePartWords } from '../../lib/materials/partRename'
import { renamePart, undoPartRename } from '../../lib/materials/partRenameIo'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'

const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.85rem' }
const head: CSSProperties = { margin: 0, fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const quietPress: CSSProperties = { background: 'none', border: 'none', padding: 0, minHeight: 32, color: 'var(--text-link)', textDecoration: 'underline', font: 'inherit', fontSize: '0.85rem', cursor: 'pointer' }
const tabStyle = (on: boolean, h: number): CSSProperties => ({ minHeight: h, padding: '0 0.9rem', border: 'none', borderBottom: `2px solid ${on ? 'var(--text-strong)' : 'transparent'}`, background: 'none', color: on ? 'var(--text-strong)' : 'var(--text-muted)', font: 'inherit', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' })

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
const dayAndTime = (iso: string) => `${day(iso)}, ${new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`

function Events({ events }: { events: ReadonlyArray<HistoryEvent> }) {
  return (
    <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.35rem' }}>
      {events.map((e) => (
        <li key={e.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.5rem', alignItems: 'baseline', fontSize: '0.9rem' }}>
          <span>{e.words}</span>
          <span style={{ ...muted, fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{dayAndTime(e.at)}{e.by ? ` · ${e.by}` : ''}</span>
        </li>
      ))}
    </ol>
  )
}

type Props = {
  container: Container
  /** Every container of the box's job. */
  containers: ReadonlyArray<Container>
  places: ReadonlyArray<Place>
  /** The job's lines as the host page reads them, so the tab's numbers are the page's numbers. */
  lines: ReadonlyArray<ContainerLine>
  byName: string
  byUserId: string | null
  touch?: boolean
  onSaved: (words: string) => void
}

export default function BoxTabs({ container, containers, places, lines, byName, byUserId, touch = false, onSaved }: Props) {
  const [tab, setTab] = useState<'cage' | 'contents'>('cage')
  const [names, setNames] = useState<BoxNameChange[]>([])
  const [failed, setFailed] = useState<unknown>(null)
  const readNames = useCallback(async () => {
    try {
      setNames(await fetchBoxNames(container.id))
      setFailed(null)
    } catch (e) {
      setFailed(e)
    }
  }, [container.id])
  useEffect(() => { void readNames() }, [readNames])

  // Fix the name (v2.7212): one line at a time, the rename's own id kept for its Undo while the window is open.
  const { showToast } = useToastContext()
  const [fixing, setFixing] = useState<{ key: string; value: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [slip, setSlip] = useState<string | null>(null)
  const [last, setLast] = useState<{ id: string; from: string; to: string } | null>(null)
  const rename = async (from: string, to: string) => {
    setBusy(true)
    setSlip(null)
    try {
      const done = await renamePart(container.jobId, from, to)
      setLast({ id: done.id, from, to })
      setFixing(null)
      showToast(renamedPartWords(from, to), 'success')
      await loadJob(container.jobId, { force: true })
    } catch (e) {
      setSlip(`The name did not change: ${formatErrorMessage(e)}`)
    } finally {
      setBusy(false)
    }
  }
  const undo = async () => {
    if (!last) return
    setBusy(true)
    setSlip(null)
    try {
      await undoPartRename(container.jobId, last.id)
      showToast(undonePartWords(last.from), 'success')
      setLast(null)
      await loadJob(container.jobId, { force: true })
    } catch (e) {
      setSlip(`The rename was not undone: ${formatErrorMessage(e)}`)
    } finally {
      setBusy(false)
    }
  }

  const moves = listContainerMoves(container.jobId)
  const movements = listMovements(container.jobId)
  const mine = linesOf(lines, container.id)
  const nameOf = (id: string | null) => containers.find((c) => c.id === id)?.label ?? 'a retired box'
  const h = touch ? 44 : 36
  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <div role="tablist" aria-label="This box" style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid var(--border)' }}>
        <button type="button" role="tab" aria-selected={tab === 'cage'} style={tabStyle(tab === 'cage', h)} onClick={() => setTab('cage')}>Cage</button>
        <button type="button" role="tab" aria-selected={tab === 'contents'} style={tabStyle(tab === 'contents', h)} onClick={() => setTab('contents')}>{contentsTabWords(mine.length)}</button>
      </div>
      {tab === 'cage' ? (
        <div role="tabpanel" aria-label="Cage" style={{ display: 'grid', gap: '1rem' }}>
          <EditBoxForm container={container} containers={containers} places={places} byName={byName} byUserId={byUserId} touch={touch} onSaved={onSaved} />
          <section style={{ display: 'grid', gap: '0.3rem' }}>
            <h3 style={head}>Its code</h3>
            <div style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontWeight: 700, fontSize: '1.05rem' }} data-testid="box-tabs-code">{boxCodeWords(container.id)}</div>
            <div style={muted}>{boxAddressWords(container.id)}. The code is what a label’s QR opens. It never changes.</div>
          </section>
          <section style={{ display: 'grid', gap: '0.4rem' }} data-testid="box-tabs-history">
            <h3 style={head}>Its history</h3>
            <Events events={boxHistory(container, places, moves, names)} />
            <OfflineRetryPanel failure={failed ? recoveryFailureFromError(failed, 'The old names did not load.') : null} onRetry={readNames} surface="on-site-box-names" idempotent />
          </section>
        </div>
      ) : (
        <div role="tabpanel" aria-label="Contents" style={{ display: 'grid', gap: '0.6rem' }}>
          {mine.length === 0 ? <EmptyState compact main={`Nothing in ${container.label} yet.`} tail="Add a part on the box itself." /> : null}
          {jobLedgerCapped(container.jobId) ? <p style={{ ...muted, margin: 0 }}>This job’s ledger is long, so a history here may start part way.</p> : null}
          {last ? (
            <p style={{ margin: 0, fontSize: '0.9rem', display: 'flex', gap: '0.6rem', alignItems: 'baseline', flexWrap: 'wrap' }} data-testid="box-tabs-renamed">
              <span>{renamedPartWords(last.from, last.to)}</span>
              <button type="button" disabled={busy} style={{ ...quietPress, ...(busy ? { opacity: 0.45, cursor: 'default' } : {}) }} onClick={() => void undo()}>{UNDO_PART_RENAME_LABEL}</button>
            </p>
          ) : null}
          {slip ? <p role="alert" style={{ margin: 0, color: 'var(--text-red-700)', fontSize: '0.85rem' }}>{slip}</p> : null}
          {mine.map((l) => {
            const added = lineAdded(movements, container.id, l.partKey)
            const events = lineHistory(movements, container.id, l.partKey, nameOf)
            return (
              <div key={l.partKey} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '0.6rem 0.75rem', display: 'grid', gap: '0.25rem' }} data-testid="box-tabs-line">
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline' }}>
                  <span style={{ fontWeight: 700, minWidth: 0, overflowWrap: 'anywhere' }}>{l.partName}{l.manufacturer ? <span style={{ ...muted, fontWeight: 400 }}> · {l.manufacturer}</span> : null}</span>
                  <span style={{ marginLeft: 'auto', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{l.onHand.toLocaleString('en-US')}</span>
                </div>
                {added ? <div style={muted}>{lineAddedWords(day(added.at), added.by, placeAt(container, places, moves, added.at))}</div> : null}
                {/* A typed name alone: a parts-book part reads its name from the book. */}
                {!l.partId && fixing?.key !== l.partKey ? <div><button type="button" style={quietPress} aria-label={`${FIX_PART_NAME_LABEL} of ${l.partName}`} onClick={() => { setSlip(null); setFixing({ key: l.partKey, value: l.partName }) }}>{FIX_PART_NAME_LABEL}</button></div> : null}
                {!l.partId && fixing?.key === l.partKey ? (() => {
                  const v = partRenameVerdict(l, fixing.value, lines, nameOf)
                  const scope = v.ok ? partRenameScopeNote(v) : null
                  const merge = v.ok ? partRenameMergeNote(v) : null
                  const dead = !v.ok || busy
                  return (
                    <form onSubmit={(e) => { e.preventDefault(); if (v.ok && !busy) void rename(v.from, v.to) }} style={{ display: 'grid', gap: '0.4rem', paddingTop: '0.2rem' }} data-testid="box-tabs-fix-name">
                      <input type="text" value={fixing.value} maxLength={PART_NAME_MAX + 20} autoFocus onChange={(e) => setFixing({ key: l.partKey, value: e.target.value })} aria-label={`The name of ${l.partName}`} style={{ width: '100%', minHeight: touch ? 48 : 38, padding: '0.4rem 0.75rem', fontSize: '1rem', boxSizing: 'border-box', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-strong)' }} />
                      {scope ? <p style={{ ...muted, margin: 0 }}>{scope}</p> : null}
                      {merge ? <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-amber-800)' }}>{merge}</p> : null}
                      {!v.ok && v.words ? <p role="alert" style={{ margin: 0, color: 'var(--text-red-700)', fontSize: '0.85rem' }}>{v.words}</p> : null}
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button type="submit" disabled={dead} style={{ minHeight: touch ? 48 : 36, padding: '0 0.9rem', borderRadius: 8, border: '1px solid #2563eb', background: '#2563eb', color: '#fff', font: 'inherit', fontWeight: 600, cursor: 'pointer', ...(dead ? { opacity: 0.45, cursor: 'default' } : {}) }}>{partRenamePressLabel(fixing.value)}</button>
                        <button type="button" style={{ minHeight: touch ? 48 : 36, padding: '0 0.9rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontWeight: 600, cursor: 'pointer' }} onClick={() => setFixing(null)}>Cancel</button>
                      </div>
                    </form>
                  )
                })() : null}
                {events.length > 0 ? (
                  <details>
                    <summary style={{ ...muted, cursor: 'pointer', minHeight: touch ? 36 : undefined }}>{historyFoldWords(events.length)}</summary>
                    <div style={{ paddingTop: '0.4rem' }}><Events events={events} /></div>
                  </details>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** The office page's host: a window over the page, closed by ×, Escape or a press outside it. */
export function BoxWindow({ onClose, ...rest }: Omit<Props, 'touch'> & { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const title = editBoxTitle(rest.container)
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem' }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} style={{ background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 12, width: 'min(520px, 100%)', maxHeight: '100%', overflowY: 'auto', padding: '1rem 1.25rem 1.25rem', display: 'grid', gap: '0.6rem', alignContent: 'start', boxShadow: '0 12px 32px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', flex: '1 1 auto' }}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-muted)', minHeight: 36, minWidth: 36 }}>×</button>
        </div>
        <BoxTabs {...rest} />
      </div>
    </div>,
    document.body,
  )
}
