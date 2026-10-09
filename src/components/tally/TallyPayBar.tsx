import { tallyPayBarWords, type TallyPaySendGroup } from '../../lib/tally/tallyPaySends'

/**
 * One card's Cash App pay sends on the Team queue (punch list #72, PR 3's pay bar): what and whose,
 * who they went to, and one button that marks them all payroll. Shown only to the roles that may
 * mark payroll; the queue decides that and passes the groups.
 */
export function TallyPayBar({ group, busy, onMark }: { group: TallyPaySendGroup; busy: boolean; onMark: () => void }) {
  const words = tallyPayBarWords(group)
  return (
    <section
      data-testid="tally-pay-bar"
      aria-label={words.title}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.5rem 0.75rem',
        border: '1px solid var(--border)',
        borderLeft: '4px solid #7c3aed',
        borderRadius: 10,
        background: 'var(--surface)',
        padding: '0.6rem 0.75rem',
        marginBottom: '0.75rem',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{words.title}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
          {words.payees ? `${words.payees} ` : ''}Pay goes to payroll, not to a job.
        </div>
      </div>
      <button
        type="button"
        data-testid="tally-pay-bar-mark"
        disabled={busy}
        onClick={onMark}
        style={{
          padding: '0.45rem 0.85rem',
          minHeight: 40,
          borderRadius: 8,
          border: 'none',
          background: busy ? 'var(--border)' : '#7c3aed',
          color: busy ? 'var(--text-muted)' : 'white',
          fontWeight: 700,
          cursor: busy ? 'default' : 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {busy ? 'Marking…' : words.button}
      </button>
    </section>
  )
}
