import type { LineState } from '../../lib/taskCriteria'
import { stripStamp } from '../../lib/checklistCardEvents'
import { linesWords } from '../../lib/taskProgress'

/**
 * Task cards (#273): the Done when… lines as boxes, the count line above them, the next open line ringed amber (the
 * stage checklists' mark), the stamp under a ticked one. The card draws it under the title, the row variant behind
 * its chip, and Today's Outstanding rows in their open panel. Read-only without `onTick` or on a done card.
 */
export function TaskLinesList({
  lines,
  onTick,
  readOnly = false,
  nameOf,
}: {
  lines: LineState[]
  onTick?: (criterionId: string, ticked: boolean) => void | Promise<void>
  readOnly?: boolean
  nameOf: (userId: string | null | undefined) => string
}) {
  if (lines.length === 0) return null
  const ticked = lines.filter((l) => l.checked).length
  const nextOpenId = lines.find((l) => !l.checked)?.criterion.id ?? null
  const dead = readOnly || !onTick
  return (
    <div style={{ marginTop: '0.5rem' }}>
      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.3rem' }}>{linesWords(ticked, lines.length)}</div>
      <ul aria-label="Done when" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {lines.map((l) => (
          <li key={l.criterion.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem' }}>
            <button
              type="button"
              onClick={() => void onTick?.(l.criterion.id, !l.checked)}
              disabled={dead}
              aria-pressed={l.checked}
              aria-label={`${l.checked ? 'Untick' : 'Tick'}: ${l.criterion.body}`}
              style={{
                width: 28,
                height: 28,
                flexShrink: 0,
                borderRadius: 7,
                border: l.checked ? 'none' : `2px solid ${l.criterion.id === nextOpenId ? '#d97706' : 'var(--text-600)'}`,
                boxShadow: !l.checked && l.criterion.id === nextOpenId ? '0 0 0 2px var(--bg-amber-tint)' : 'none',
                background: l.checked ? '#16a34a' : 'var(--surface)',
                color: 'white',
                fontSize: '0.95rem',
                lineHeight: 1,
                cursor: dead ? 'default' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 1,
              }}
            >
              {l.checked ? '✓' : ''}
            </button>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '0.9375rem', lineHeight: 1.35, color: l.checked ? 'var(--text-muted)' : 'var(--text-strong)' }}>{l.criterion.body}</div>
              {l.checked ? (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {nameOf(l.checkedBy)}
                  {l.checkedAt ? ` · ${stripStamp(l.checkedAt)}` : ''}
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
