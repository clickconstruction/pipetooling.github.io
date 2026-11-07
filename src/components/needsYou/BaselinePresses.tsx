import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { baselinePressWords, type BaselineFillInRow } from '../../lib/needsYou/fillInBaselines'

/**
 * The baseline kind's answer on the Fill them in deck (punch list #234, PR 1a): one press writes the
 * project's baseline and moves on, so the card has no Save. The source that leads — the bid's
 * estimate when its Labor rows are usable, else the book's hours — is the app's blue under white
 * words; a source that cannot be written is not drawn. A row with neither draws nothing here and
 * keeps its door.
 */
const SOURCES = ['bid', 'book'] as const

export function BaselinePresses({ row, disabled, onPress }: { row: BaselineFillInRow; disabled: boolean; onPress: (source: 'bid' | 'book') => void }) {
  return (
    <>
      {SOURCES.map((s) => {
        const words = baselinePressWords(row, s)
        if (!words) return null
        const leads = row.pick === s
        return (
          <button
            key={s}
            type="button"
            disabled={disabled}
            onClick={() => onPress(s)}
            title={s === 'bid' ? "The bid's Labor rows, frozen as this project's baseline — the one that scores" : "The book's assumed hours, frozen as this project's baseline and read as a guess"}
            style={{
              borderRadius: 6,
              padding: '0.55rem 1.1rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: disabled ? 'default' : 'pointer',
              border: leads && !disabled ? '1px solid #2563eb' : '1px solid var(--border-strong)',
              background: disabled ? DEAD_PRESS_FILL : leads ? '#2563eb' : 'var(--surface)',
              color: disabled ? DEAD_PRESS_TEXT : leads ? '#fff' : 'var(--text-700)',
            }}
          >
            {words}
          </button>
        )
      })}
    </>
  )
}
