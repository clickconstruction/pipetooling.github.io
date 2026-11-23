import { gearModeRowTip } from '../../lib/gearMenuSections'
import { MODE_ROW_WORDS, type ModeRowThird } from '../../lib/modeRow'

/**
 * The gear menu's mode list (punch list #425, the owner's pick of 2026-11-23): **Dashboard**, **Job Mode**
 * and **Task Mode** as rows of the menu, with one dot on the mode the page is drawn in.
 *
 * It stands wherever the mode row above the header is not drawn: on a desk or a tablet for every role, and
 * at every width for the estimator (`gearModesRows` in `lib/gearMenuSections.ts` says which rows). The
 * words are the row's own. `Layout` sends a press through the row's rule, so the two never disagree.
 */
export function GearModeList({ rows, on, onPick }: { rows: readonly ModeRowThird[]; on: ModeRowThird; onPick: (third: ModeRowThird) => void }) {
  if (rows.length === 0) return null
  return (
    <div role="radiogroup" aria-label={MODE_ROW_WORDS.group} data-gear-mode-list>
      {rows.map((third) => {
        const isOn = third === on
        return (
          <button
            key={third}
            type="button"
            role="radio"
            aria-checked={isOn}
            data-gear-mode={third}
            title={gearModeRowTip(third, isOn)}
            onClick={() => onPick(third)}
            style={{
              display: 'flex',
              width: '100%',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              textAlign: 'left',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 'inherit',
              color: 'inherit',
              borderBottom: '1px solid var(--chrome-border)',
              boxSizing: 'border-box',
              fontWeight: isOn ? 600 : 400,
              whiteSpace: 'nowrap',
            }}
          >
            <span>{MODE_ROW_WORDS.thirds[third]}</span>
            <span
              aria-hidden="true"
              style={{
                display: 'inline-flex',
                flex: 'none',
                width: 16,
                height: 16,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                border: `1px solid ${isOn ? '#2563eb' : 'var(--border-400)'}`,
                background: 'var(--surface)',
                boxSizing: 'border-box',
              }}
            >
              {isOn ? <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563eb' }} /> : null}
            </span>
          </button>
        )
      })}
    </div>
  )
}
