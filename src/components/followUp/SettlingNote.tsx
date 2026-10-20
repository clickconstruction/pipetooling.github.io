/**
 * Messages, cut 2's screens, PR C2: the line over cut 3's reply box while a team note marks what we owe done (the
 * prototype's `.settling`): what we owed, who marked it, and *Not done yet*, which puts the box back. The box shows it
 * while `useOwedSettling(...).active`.
 */
import type { Owed } from '../../lib/messages/owed'
import { markedByWords, owedDoneHeader } from '../../lib/messages/owed'
import { clauseButtonStyle } from '../contracts/clauseStyles'

export function SettlingNote({ owed, onNotYet, nowIso }: { owed: Owed; onNotYet: () => void; nowIso?: string }) {
  return (
    <div
      data-settling-note
      style={{
        display: 'flex',
        gap: '0.5rem',
        flexWrap: 'wrap',
        alignItems: 'baseline',
        padding: '0.45rem 0.6rem',
        borderRadius: 8,
        border: '1px solid var(--border-violet)',
        background: 'var(--bg-violet-100)',
        color: 'var(--text-violet-800)',
        fontSize: '0.85rem',
      }}
    >
      <b>{owedDoneHeader(owed)}</b>
      <span>· marked by {markedByWords(owed, nowIso ?? new Date().toISOString())}</span>
      <button type="button" onClick={onNotYet} style={{ ...clauseButtonStyle, marginLeft: 'auto', padding: '0.2rem 0.55rem', fontSize: '0.78rem' }}>
        Not done yet
      </button>
    </div>
  )
}
