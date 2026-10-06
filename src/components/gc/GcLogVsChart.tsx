/**
 * GC mode design spike: the daily log and the chart disagree, as a card (G-60; the kernel is
 * `gcLogVsChart.ts`, the mock-up `to-dos/gc-mode/mockups/G-60.md`). One row per trade whose week
 * on the log and on the chart do not agree: the sentence, what to do, and its buttons. Under the
 * chart on the Schedule tab, where Open goes to the bar's editor. Under This week on the Daily log
 * tab, its on-site rows only, where the person who just wrote the log knows why.
 */
import type { Dispatch } from 'react'
import { weekdayDate, type GcAction, type GcProject } from '../../lib/gcMode/gcModel'
import type { LogChartGap } from '../../lib/gcMode/gcLogVsChart'
import { useAuth } from '../../hooks/useAuth'
import { Btn, Card, Chip } from './gcUi'
import { PartnerLink } from './GcCompanyFile'

/** The signed-in person's name. Outside the app's sign-in (a test), none. */
function useMeName(): string | null {
  try {
    return useAuth().profileName
  } catch {
    return null
  }
}

export function GcLogVsChart({
  project,
  gaps,
  dispatch,
  onOpen,
}: {
  project: GcProject
  gaps: LogChartGap[]
  dispatch: Dispatch<GcAction>
  /** Open a bar in the Schedule tab's editor. Unset (the Daily log tab): no Open buttons. */
  onOpen?: (lineId: string) => void
}) {
  const me = useMeName() ?? 'The office'
  if (gaps.length === 0) return null
  return (
    <Card dataTour="gc-log-vs-chart">
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap', marginBottom: '0.15rem' }}>
        <strong>The daily log and the chart</strong>
        <Chip tone="amber">this week · {gaps.length}</Chip>
      </div>
      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>The daily log says who was on site. The chart says whose work runs. This week they do not match for these trades.</div>
      <div style={{ display: 'grid', gap: '0.6rem' }}>
        {gaps.map((g) => {
          const first = g.days[0]
          const next = g.next
          const toOpen = onOpen ? [...g.running, ...(next ? [next] : [])] : []
          return (
            <div key={`${g.kind}:${g.pkg.id}`} style={{ display: 'grid', gap: '0.3rem', fontSize: '0.875rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
              <div>
                {g.partnerId && g.words.startsWith(g.company) ? (
                  <>
                    <PartnerLink partnerId={g.partnerId} company={g.company} />
                    {g.words.slice(g.company.length)}
                  </>
                ) : (
                  g.words
                )}
              </div>
              <div style={{ color: 'var(--text-amber-800)' }}>{g.todo}</div>
              {((g.kind === 'noBar' && next && first) || toOpen.length > 0) && (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {g.kind === 'noBar' && next && first && (
                    <Btn kind="primary" onClick={() => dispatch({ type: 'setActualDates', projectId: project.id, lineId: next.lineId, actualStart: first, by: me })}>
                      It started {weekdayDate(first)}
                    </Btn>
                  )}
                  {toOpen.map((b) => (
                    <Btn key={b.lineId} onClick={() => onOpen?.(b.lineId)}>
                      Open {b.name}
                    </Btn>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
