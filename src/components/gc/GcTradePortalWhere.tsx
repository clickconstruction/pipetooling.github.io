import type { PortalPage, PortalPageSection, PortalStepReading } from '../../lib/flows/portalPage'
import { tradePagePress, type TradePagePress } from '../../lib/portal/tradeFirstPage'
import { CARD, COPPER, HAIR, MUTED, PAPER_GREEN } from '../../lib/portal/portalTheme'
import { Btn } from './gcUi'

/**
 * Messages, cut 8c: the trade partner's first page, *Where you are with Click Construction*, first on its portal's home
 * (the prototype's `portalHtml`, v1.178). Getting set up, then one section per job it is asked on, then Open; each step
 * with its mark: done with its day, theirs with why and its press, the rest with what to expect. A job's name opens the
 * job. The words are `portalPage`'s (`src/lib/flows/portalPage.ts`); where a press lands is `tradePagePress`'s.
 */
export function GcTradePortalWhere({ page, onPress }: { page: PortalPage; onPress: (press: TradePagePress) => void }) {
  return (
    <section aria-label={page.title} style={{ background: CARD, border: `1px solid ${HAIR}`, borderRadius: 8, padding: '0.75rem 0.85rem', display: 'grid', gap: '0.65rem' }}>
      <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.3 }}>{page.title}</h2>
      {page.off && <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.45 }}>{page.off}</p>}
      {page.sections.map((section) => (
        <Section key={`${section.lane}:${section.jobId ?? section.title}`} section={section} onPress={onPress} />
      ))}
      <p style={{ margin: 0, fontSize: '0.85rem', color: MUTED }}>{page.questions}</p>
    </section>
  )
}

const HEAD = { margin: 0, fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: COPPER, fontWeight: 700 } as const

function Section({ section, onPress }: { section: PortalPageSection; onPress: (press: TradePagePress) => void }) {
  const jobId = section.jobId
  return (
    <div>
      <h3 style={HEAD}>
        {jobId ? (
          <button
            type="button"
            onClick={() => onPress({ kind: 'project', projectId: jobId })}
            style={{ ...HEAD, display: 'inline-flex', alignItems: 'center', gap: '0.3rem', minHeight: 32, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
          >
            {section.title}
            <span aria-hidden style={{ fontSize: '0.95rem', lineHeight: 1 }}>
              ›
            </span>
          </button>
        ) : (
          section.title
        )}
      </h3>
      <ul aria-label={section.title} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {section.rows.map((row, i) => (
          <Step key={row.id} row={row} first={i === 0} press={tradePagePress(section, row)} onPress={onPress} />
        ))}
      </ul>
    </div>
  )
}

type MarkKind = 'ok' | 'you' | 'dot'

const MARK: Record<MarkKind, { sign: string; color: string; border: string; background: string }> = {
  ok: { sign: '✓', color: PAPER_GREEN, border: PAPER_GREEN, background: 'transparent' },
  you: { sign: '!', color: 'var(--text-amber-700)', border: 'var(--text-amber-700)', background: 'var(--bg-amber-100)' },
  dot: { sign: '·', color: MUTED, border: HAIR, background: 'transparent' },
}

function markOf(row: PortalStepReading): MarkKind {
  if (row.kind === 'done') return 'ok'
  return row.kind === 'yours' || row.kind === 'ranOut' || row.kind === 'decide' ? 'you' : 'dot'
}

function Step({ row, first, press, onPress }: { row: PortalStepReading; first: boolean; press: TradePagePress | null; onPress: (press: TradePagePress) => void }) {
  const kind = markOf(row)
  const mark = MARK[kind]
  const due = row.kind === 'yours' && row.due ? row.due : null
  const late = row.kind === 'yours' && row.late
  const buttons = press && (row.kind === 'yours' || row.kind === 'ranOut') && row.button ? { first: row.button, second: row.kind === 'yours' ? row.button2 : null } : null
  return (
    <li data-step={row.id} style={{ display: 'flex', gap: '0.55rem', alignItems: 'flex-start', padding: '0.5rem 0', borderTop: first ? 'none' : `1px solid ${HAIR}` }}>
      <span
        aria-hidden
        style={{
          flex: 'none',
          width: 20,
          height: 20,
          marginTop: 1,
          borderRadius: 999,
          border: `1.5px solid ${mark.border}`,
          background: mark.background,
          color: mark.color,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.7rem',
          fontWeight: 700,
        }}
      >
        {mark.sign}
      </span>
      <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: '0.15rem', fontSize: '0.9rem', lineHeight: 1.4 }}>
        <div style={{ fontWeight: kind === 'you' ? 700 : 400 }}>
          {row.name}
          {due && <span style={{ fontWeight: 400, color: late ? 'var(--text-red-700)' : MUTED }}> · {due}</span>}
        </div>
        <div style={{ fontSize: '0.82rem', color: MUTED }}>{row.kind === 'done' ? row.when : row.line}</div>
        {buttons && press && (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
            <Btn kind="primary" wrap onClick={() => onPress(press)}>
              {buttons.first}
            </Btn>
            {buttons.second && (
              <Btn wrap onClick={() => onPress(press)}>
                {buttons.second}
              </Btn>
            )}
          </div>
        )}
      </div>
    </li>
  )
}
