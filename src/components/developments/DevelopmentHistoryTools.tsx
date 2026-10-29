/**
 * The History look's chips (punch list #208; the owner's pick A of `history-mockup.html`): they
 * narrow the stream by kind, and the amber chip by piece (*JP1098 only*, set from a Pieces row).
 * The composer that keeps an entry comes with the entries' table in the next PR. The words and
 * rules come from `lib/developments/history.ts`.
 */
import { HISTORY_CHIPS, type HistoryChip, type HistoryPiece } from '../../lib/developments/history'
import { capStyle } from './developmentPageBits'

export function DevelopmentHistoryChips({ chip, onChip, piece, onClearPiece }: { chip: HistoryChip; onChip: (chip: HistoryChip) => void; piece: HistoryPiece | null; onClearPiece: () => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }} data-testid="history-chips">
      <span style={capStyle}>Show</span>
      {HISTORY_CHIPS.map((c) => (
        <button key={c.key} type="button" className="developmentHistoryChip" data-on={chip === c.key ? '1' : undefined} aria-pressed={chip === c.key} title={c.title} onClick={() => onChip(c.key)} data-testid={`history-chip-${c.key}`}>
          {c.label}
        </button>
      ))}
      {piece ? (
        <button type="button" className="developmentChipPress isOn" onClick={onClearPiece} title="Every piece again" data-testid="history-piece-chip">
          {piece.label} only <span aria-hidden>×</span>
        </button>
      ) : null}
    </div>
  )
}
