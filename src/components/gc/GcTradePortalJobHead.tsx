import { GC_COMPANY } from '../../lib/gc/company'
import type { PortalTodo } from '../../lib/gc/portal'
import { pDate } from '../../lib/gc/portalI18n'
import type { JobHead } from '../../lib/gc/tradePortalHead'
import { money } from '../../lib/gc/words'
import { HAIR, INK, MUTED } from '../../lib/portal/portalTheme'
import { usePortalLang } from './gcTradePortalLang'
import { PortalBlock, PortalRow } from './GcTradePortalUi'

/**
 * Punch list #205, row 1 (PR 2): the head of a trade partner's job page, what JobTread's Dashboard tab opens a sub on.
 * One line of dates (*Started Oct 7 · Click plans to finish Dec 18 · 52 days left*), then the company's own work as one
 * bar with its percent and dollars, weighted by each line's amount, and each line's percent under it (`jobHead`). The
 * page draws Who to call and Needs you on this job right under it. An older answer with no finish draws the head
 * without the finish line; a job with no signed work draws the dates alone.
 */

const GC = GC_COMPANY.shortName
const BAR_BLUE = '#2563eb'

export function GcTradePortalJobHead({ head, today }: { head: JobHead; today: string }) {
  const { lang, t } = usePortalLang()
  const dates: string[] = []
  if (head.started) dates.push(t(head.startedIsPlan && head.started > today ? 'headStarts' : 'headStarted', { date: pDate(lang, head.started) }))
  if (head.finish) {
    dates.push(t('headFinish', { gc: GC, date: pDate(lang, head.finish) }))
    const n = head.daysLeft ?? 0
    dates.push(n < 0 ? t('headDaysPast', { n: -n }) : n === 1 ? t('headDayLeft') : t('headDaysLeft', { n }))
  }
  if (dates.length === 0 && head.lines.length === 0) return null
  return (
    <div data-portal-head style={{ display: 'grid', gap: '0.6rem' }}>
      {dates.length > 0 && (
        <div data-portal-head-dates style={{ fontSize: '0.95rem', fontWeight: 600, color: INK }}>
          {dates.join(' · ')}
        </div>
      )}
      {head.lines.length > 0 && (
        <PortalBlock title={t('headYourWork')}>
          <div style={{ display: 'grid', gap: '0.35rem', fontSize: '0.9rem' }}>
            <div data-portal-head-pct>
              <strong>{t('headPct', { pct: head.pct, done: money(head.done), total: money(head.total) })}</strong>
            </div>
            <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={head.pct} aria-label={t('headYourWork')} style={{ height: 10, borderRadius: 5, background: HAIR, overflow: 'hidden' }}>
              <span style={{ display: 'block', height: '100%', width: `${Math.min(100, head.pct)}%`, background: BAR_BLUE }} />
            </div>
            <div data-portal-head-lines style={{ fontSize: '0.8rem', color: MUTED }}>
              {[...head.lines.map((l) => `${l.label} ${l.pct}%`), t('headFromReports')].join(' · ')}
            </div>
          </div>
        </PortalBlock>
      )}
    </div>
  )
}

const DOT: Record<PortalTodo['tone'], string> = {
  red: 'var(--text-red-700)',
  amber: 'var(--text-amber-700)',
  plain: 'var(--text-muted)',
}

/**
 * Needs you on this job (punch list #205, PR 2): the home's Needs you lines that belong to this job, under the head, each
 * opening its block of the page (`data-portal-anchor`). Nothing is drawn when the job has none.
 */
export function GcTradePortalNeedsHere({ todos, onOpen }: { todos: PortalTodo[]; onOpen: (todo: PortalTodo) => void }) {
  const { t } = usePortalLang()
  if (todos.length === 0) return null
  return (
    <PortalBlock title={`${t('headNeedsHere')} · ${todos.length}`}>
      <div style={{ display: 'grid' }}>
        {todos.map((todo, i) => (
          <PortalRow key={todo.key} first={i === 0} onClick={() => onOpen(todo)}>
            <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: DOT[todo.tone], flexShrink: 0, marginTop: '0.4rem' }} />
            <span style={{ flex: 1, fontWeight: todo.tone === 'red' ? 600 : 400 }}>{todo.text}</span>
          </PortalRow>
        ))}
      </div>
    </PortalBlock>
  )
}
