import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { ANSWER_ALL, answerAllHref } from '../../lib/followUp/answerDesk'
import { MESSAGES_PATH } from '../../lib/messages/customerThread'
import { MESSAGES_STATION_WORDS as W, type MessagesStation } from '../../lib/quickfill/messagesStation'
import type { TextsLedger } from '../../lib/quickfill/textsLedger'
import { EmptyState } from '../EmptyState'
import { QuickfillTextsSection } from './QuickfillTextsSection'

/**
 * Quickfill → Messages (v2.6098, punch list #178, D's PR 7): the page's lanes with their counts, each a press into
 * its lane on Messages, and the Texts ledger (v2.5816) folded under them, its first fold. The station's count is
 * the badge's number; a lane's row is a door, since the thread is the one place to write. The Texts fold keeps
 * every press the Texts station had: Reply, Call, Answer all, the quiet lines for Today's sends and New, and
 * Anything else, whose words the page holds (`typed`) so every Mark carries them into the note.
 */
export interface QuickfillMessagesSectionProps {
  station: MessagesStation | null
  ledger: TextsLedger | null
  todaysSends: number
  loading: boolean
  /** The read failed: Messages has the lanes. */
  problem: boolean
  /** The office team reads Messages; anyone else keeps the note alone. */
  canRead: boolean
  typed: string
  onTyped: (words: string) => void
  /** After the Today's sends window sent, held or put a text away. */
  onReload?: () => void
}

const laneRow: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.45rem 0.6rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }
const laneBar = (color: string): CSSProperties => ({ width: 6, alignSelf: 'stretch', borderRadius: 3, background: color, flexShrink: 0 })
const laneLabel: CSSProperties = { fontWeight: 700, color: 'var(--text-strong)', minWidth: 0 }
const laneCount: CSSProperties = { fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'var(--text-700)', minWidth: '1.5rem', textAlign: 'right' }
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8rem' }
const pill: CSSProperties = { display: 'inline-flex', alignItems: 'center', borderRadius: 999, fontWeight: 600, fontSize: '0.8rem', padding: '0.2rem 0.7rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-link)', whiteSpace: 'nowrap', textDecoration: 'none', lineHeight: 1.3 }
const pillGo: CSSProperties = { ...pill, background: '#2563eb', borderColor: '#2563eb', color: '#fff' }
const foldButton: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.45rem 0.2rem', border: 0, borderTop: '1px solid var(--border)', background: 'none', font: 'inherit', fontWeight: 700, color: 'var(--text-strong)', cursor: 'pointer', textAlign: 'left' }

export function QuickfillMessagesSection({ station, ledger, todaysSends, loading, problem, canRead, typed, onTyped, onReload }: QuickfillMessagesSectionProps) {
  // The Texts fold opens by itself while a text waits; a press keeps the reader's choice for the visit.
  const [textsOpen, setTextsOpen] = useState<boolean | null>(null)
  const texts = <QuickfillTextsSection ledger={ledger} todaysSends={todaysSends} loading={loading} problem={problem} canRead={canRead} typed={typed} onTyped={onTyped} onReload={onReload} />
  if (!canRead) return texts
  if (loading && !station) return <div style={{ ...muted, padding: '0.5rem 0' }}>{W.reading}</div>
  if (problem && !station) {
    return (
      <div style={{ display: 'grid', gap: '0.6rem' }}>
        <div style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }} data-testid="messages-problem">
          {W.problem}{' '}
          <Link to={MESSAGES_PATH} style={{ color: 'var(--text-link)', fontWeight: 600 }}>
            {W.open}
          </Link>
        </div>
        {texts}
      </div>
    )
  }
  if (!station) return null
  const textsCount = ledger?.count ?? 0
  const foldOpen = textsOpen ?? textsCount > 0
  return (
    <div style={{ display: 'grid', gap: '0.75rem' }} data-messages-station>
      {station.count === 0 ? <EmptyState compact main={W.cleanHead} tail={W.cleanSub} /> : null}
      <div style={{ display: 'grid', gap: '0.35rem' }} role="list" aria-label="Messages lanes">
        {station.lanes.map((lane) => (
          <div key={lane.lane} style={laneRow} role="listitem" data-testid={`messages-lane-${lane.lane}`}>
            <span aria-hidden style={laneBar(lane.color)} />
            <span style={laneLabel}>{lane.label}</span>
            <span style={laneCount} aria-label={lane.count == null ? `${lane.label}, counted on Messages` : `${lane.count}`}>
              {lane.count == null ? '—' : lane.count}
            </span>
            {lane.count == null ? <span style={muted}>{W.waitingNote}</span> : null}
            <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: '0.5rem' }}>
              {lane.lane === 'needsReply' && (lane.count ?? 0) > 0 ? (
                <Link to={answerAllHref()} style={pillGo} data-testid="messages-answer-all" title={`${ANSWER_ALL}: the reply desk on Messages.`}>
                  {W.answerAll}
                </Link>
              ) : null}
              <Link to={lane.href} style={pill} data-testid={`messages-open-${lane.lane}`}>
                {W.open}
              </Link>
            </span>
          </div>
        ))}
      </div>
      <div>
        <button type="button" onClick={() => setTextsOpen(!foldOpen)} aria-expanded={foldOpen} style={foldButton} data-testid="messages-texts-fold">
          <span aria-hidden>{foldOpen ? '▾' : '▸'}</span>
          <span>
            {W.texts} · {textsCount}
          </span>
          <span style={{ ...muted, fontWeight: 400 }}>{textsCount === 0 ? 'nothing on texts waiting' : textsCount === 1 ? '1 text waiting' : `${textsCount} texts waiting`}</span>
        </button>
        {foldOpen ? <div style={{ paddingTop: '0.5rem' }}>{texts}</div> : null}
      </div>
    </div>
  )
}
