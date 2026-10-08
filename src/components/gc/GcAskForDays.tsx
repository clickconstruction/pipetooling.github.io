/**
 * GC mode, the real build, the schedule's PR 7a: Ask for the days under the Projected finish's
 * whose-days line (G-141). It draws the press and its words, and sends nothing: the window that
 * holds it says what the press does. Moved word for word from the GC mode prototype (branch
 * spike/gc-mode, `GcAskForDays.tsx`); the plan is to-dos/gc-mode/mockups/schedule-pr7.md on that
 * branch.
 */
import { Btn } from './gcUi'
import type { TimeExtensionAsk } from '../../lib/gc/timeExtension'

/**
 * GC mode design spike: Ask for the days (the Gantt, G-141; mock-up `to-dos/gc-mode/mockups/G-141.md`),
 * under G-98's whose-days line on the Projected finish measure and on Bill the customer's Finish
 * date card. It drafts the time extension in Change orders and sends nothing: sending and signing
 * are the change order's own.
 */
export function GcAskForDays({ ask, where, onAsk }: { ask: TimeExtensionAsk; where: 'schedule' | 'bill'; onAsk: () => void }) {
  const days = `${ask.days} ${ask.days === 1 ? 'day' : 'days'}`
  return (
    <div data-tour="gc-ask-for-days" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.2rem' }}>
      <Btn onClick={onAsk}>Ask for the days</Btn>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
        {where === 'schedule'
          ? `It drafts a change order on Bill the customer for ${days}, the days their moves put on the finish.`
          : `It drafts a change order below for ${days}, the days their moves put on the finish.`}{' '}
        Nothing goes to them until you send it.
      </span>
    </div>
  )
}
