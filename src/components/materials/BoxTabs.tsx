/**
 * The box window (v2.7199, the owner's ask of 2026-11-13): one window with two tabs to dig into a cage or box.
 *
 * - **Cage**: the Edit form (its name, how it sits, the where line, its place), its code, and its own history:
 *   added, each move, each rename, its retire.
 * - **Contents**: each part in it with how many, when it first came in and where the box stood then, and that
 *   part's history in this box under a fold.
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
import { jobLedgerCapped, listContainerMoves, listMovements } from '../../lib/materials/onSiteStore'

const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.85rem' }
const head: CSSProperties = { margin: 0, fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }
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
