import type { ReactNode } from 'react'
import { formatBoardDay, formatHours1, formatHours2, type TeamBoard, type TeamException } from '../../../lib/teamBoard'

const KIND_LABEL: Record<TeamException['kind'], { text: string; color: string }> = {
  unlinked: { text: 'Not on a job', color: 'var(--text-amber-700)' },
  miss: { text: 'Planned, no clock', color: 'var(--text-red-700)' },
  over: { text: 'Ran long', color: 'var(--text-amber-700)' },
  unplanned: { text: 'Clocked, not planned', color: 'var(--text-amber-700)' },
}

/** The week's mismatches as a to-do list. `renderActions` supplies the buttons (none = read-only). */
export function TeamExceptionsDrawer({ board, limit = 16, renderActions }: { board: TeamBoard; limit?: number; renderActions?: (e: TeamException) => ReactNode }) {
  const ex = board.exceptions
  const shown = ex.slice(0, limit)
  const jl = (k: string) => board.labels[k]?.label ?? k
  return (
    <section aria-labelledby="team-exceptions-heading" style={{ marginTop: '1rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
      <h2 id="team-exceptions-heading" style={{ margin: 0, padding: '0.7rem 0.9rem', fontSize: '0.9375rem', color: 'var(--text-strong)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'baseline', gap: '0.6rem' }}>
        Exceptions this week <span style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.8125rem' }}>{ex.length} {ex.length === 1 ? 'item' : 'items'} · newest day first</span>
      </h2>
      {ex.length === 0 ? <p style={{ margin: 0, padding: '0.7rem 0.9rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Every clocked hour is on a job and on the plan. Nothing to sort.</p> : null}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {shown.map((e, i) => {
          const k = KIND_LABEL[e.kind]
          const dl = formatBoardDay(e.workDate)
          let what: ReactNode
          if (e.kind === 'unlinked') {
            what = (
              <>
                <b>{e.personName}</b> · {dl} · <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatHours2(e.hours)} h</span> · {e.windows.join(', ')}{e.pending ? ' · pending approval' : ''}{' '}
                <span style={{ color: 'var(--text-muted)' }}>{e.suggestion ? `· dispatch had them at ${jl(e.suggestion.targetKey)} ${e.suggestion.window}` : '· nothing on the dispatch plan'}</span>
              </>
            )
          } else if (e.kind === 'miss') {
            what = (
              <>
                <b>{e.personName}</b> · {dl} · {jl(e.targetKey)} <span style={{ color: 'var(--text-muted)' }}>· block {e.planWindows.join(', ')}</span>
              </>
            )
          } else if (e.kind === 'over') {
            what = (
              <>
                <b>{e.personName}</b> · {dl} · {jl(e.targetKey)} · <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatHours2(e.hours)} h against {formatHours1(e.planHours)} h</span>{' '}
                <span style={{ color: 'var(--text-muted)' }}>· clocked {e.windows.join(', ')}, planned {e.planWindows.join(', ')}</span>
              </>
            )
          } else {
            what = (
              <>
                <b>{e.personName}</b> · {dl} · {jl(e.targetKey)} · <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatHours2(e.hours)} h</span> · {e.windows.join(', ')}{e.pending ? ' · pending approval' : ''}
              </>
            )
          }
          return (
            <li key={`${e.kind}|${e.targetKey}|${e.workDate}|${e.personName}`} style={{ display: 'grid', gridTemplateColumns: '9rem 1fr auto', gap: '0.75rem', alignItems: 'center', padding: '0.55rem 0.9rem', borderBottom: i === shown.length - 1 && ex.length <= limit ? 0 : '1px solid var(--border)', fontSize: '0.875rem' }}>
              <span style={{ fontSize: '0.6875rem', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 700, color: k.color }}>{k.text}</span>
              <span style={{ color: 'var(--text-base)' }}>{what}</span>
              <span style={{ display: 'flex', gap: '0.35rem' }}>{renderActions?.(e)}</span>
            </li>
          )
        })}
        {ex.length > limit ? <li style={{ padding: '0.55rem 0.9rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{ex.length - limit} more in the Ledger view.</li> : null}
      </ul>
    </section>
  )
}
