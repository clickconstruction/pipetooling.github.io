import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { JOB_KIND_WORDS, type JobKind } from '../../lib/jobs/jobKind'

/**
 * The job-kind kind's answer on the Fill them in deck (punch list #238, PR 2): one press saves and
 * moves on, so the card has no Save. The side the hours lean to is the app's blue under white words;
 * with no lean both wait on the surface. Project first, as the mock-up has it.
 */
const KINDS: readonly JobKind[] = ['project', 'service']

export function JobKindPresses({ lean, disabled, onPress }: { lean: JobKind | null; disabled: boolean; onPress: (kind: JobKind) => void }) {
  return (
    <>
      {KINDS.map((k) => {
        const leads = lean === k
        return (
          <button
            key={k}
            type="button"
            disabled={disabled}
            onClick={() => onPress(k)}
            style={{
              borderRadius: 6,
              padding: '0.55rem 1.1rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: disabled ? 'default' : 'pointer',
              border: leads && !disabled ? '1px solid #2563eb' : '1px solid var(--border-strong)',
              background: disabled ? DEAD_PRESS_FILL : leads ? '#2563eb' : 'var(--surface)',
              color: disabled ? DEAD_PRESS_TEXT : leads ? '#fff' : 'var(--text-700)',
            }}
          >
            {JOB_KIND_WORDS[k]}
          </button>
        )
      })}
    </>
  )
}
