/**
 * A window that holds typing asks once before it closes (2026-10-03, the tab review's finding 4).
 * Before this, one click on the grey outside the Edit window closed it and what was typed was
 * gone — a fixture with eleven parts is a lot to type again — and Esc did nothing at all.
 *
 * `useLeaveGuard` (`src/hooks/useLeaveGuard.ts`) gives the window one way out, `requestClose`:
 * with nothing changed it closes at once; with something changed the window shows `LeaveQuestion`,
 * and only Leave closes. The question is drawn in the window itself, not as a window over it, so
 * nothing sits behind another backdrop.
 */
/** The question, drawn above the window's own buttons. */
export function LeaveQuestion({ what, onLeave, onKeep }: { /** one sentence: what would be lost */ what: string; onLeave: () => void; onKeep: () => void }) {
  return (
    <div role="alertdialog" aria-label="Leave without saving?" data-testid="leave-question" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem 0.75rem', flexWrap: 'wrap', background: 'var(--bg-amber-tint)', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '0.5rem 0.7rem', flexShrink: 0 }}>
      <span style={{ fontSize: '0.8125rem', color: 'var(--text-strong)', minWidth: 0 }}>
        <b>Leave without saving?</b> {what}
      </span>
      <span style={{ display: 'inline-flex', gap: '0.4rem' }}>
        <button type="button" onClick={onLeave} style={{ padding: '0.35rem 0.75rem', background: 'var(--surface)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem' }} data-testid="leave-confirm">
          Leave
        </button>
        <button type="button" autoFocus onClick={onKeep} style={{ padding: '0.35rem 0.75rem', background: '#2563eb', color: 'white', border: '1px solid #2563eb', borderRadius: 4, cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem', fontWeight: 600 }} data-testid="leave-keep">
          Keep editing
        </button>
      </span>
    </div>
  )
}
