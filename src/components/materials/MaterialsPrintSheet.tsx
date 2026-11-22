/**
 * The Print sheet (v2.8282): what the print icon on the Materials page's phone screen opens. A bottom sheet of
 * full-width presses, each with one quiet line under its words; a dead press shows its reason there. The rows, their
 * words and which are dead are `lib/materials/printSheet.ts`; this draws them on the On site tab's own sheet
 * (`tally/OnSiteSheet.tsx`), through a portal on the body so no scroll box of the page clips it.
 *
 * The sheet opens no window itself: a press hands its row up and the page opens the window that row names.
 */
import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import type { PrintSheet, PrintSheetRow } from '../../lib/materials/printSheet'
import { Sheet } from '../tally/OnSiteSheet'

const press: CSSProperties = { display: 'grid', gap: 2, width: '100%', boxSizing: 'border-box', minHeight: 56, padding: '0.55rem 0.85rem', borderRadius: 12, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', textAlign: 'left', cursor: 'pointer' }
const pressDead: CSSProperties = { background: DEAD_PRESS_FILL, borderColor: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'default' }

export default function MaterialsPrintSheet({ sheet, onRow, onClose }: { sheet: PrintSheet; onRow: (row: PrintSheetRow) => void; onClose: () => void }) {
  return createPortal(
    <Sheet title={sheet.title} sub={sheet.sub || undefined} onClose={onClose}>
      <div style={{ display: 'grid', gap: '0.5rem', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }} data-testid="materials-print-sheet">
        {sheet.rows.map((row) => (
          <button
            key={row.key}
            type="button"
            disabled={row.dead}
            aria-disabled={row.dead}
            aria-label={row.dead ? `${row.label}. ${row.line}` : undefined}
            style={{ ...press, ...(row.dead ? pressDead : {}) }}
            onClick={() => onRow(row)}
            data-testid={`materials-print-sheet-${row.key}`}
          >
            <span style={{ fontWeight: 700, fontSize: '0.95rem', minWidth: 0, overflowWrap: 'anywhere' }}>{row.label}</span>
            <span style={{ fontWeight: 400, fontSize: '0.8rem', color: row.dead ? DEAD_PRESS_TEXT : 'var(--text-muted)' }}>{row.line}</span>
          </button>
        ))}
      </div>
    </Sheet>,
    document.body,
  )
}
