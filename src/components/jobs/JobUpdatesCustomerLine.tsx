import type { CSSProperties } from 'react'
import { getDispatchNoteDisplayMeta } from '../../utils/dispatchNoteDisplay'
import { messageLineParts, type JobActivityMessage } from '../../lib/jobs/jobActivityMessages'

/**
 * A line with the job's customer in Job updates (v2.5527), the tech's door to them: Job Mode's card and the Job detail
 * window, beside the notes. The row looks like the panel's other rows, in the customer's orange from Job activity
 * (`JobActivityFeed`), with a deeper bar when the line came from her. It shows how it came, who, when and the words.
 * No link to the thread, and nothing to answer with: the tech answers through Message the customer.
 */
const TONE: Record<'customerIn' | 'customerOut', CSSProperties> = {
  customerIn: { background: 'var(--bg-orange-100)', borderLeft: '4px solid var(--text-orange-700)' },
  customerOut: { background: 'var(--bg-orange-tint)', borderLeft: '3px solid var(--border-orange)' },
}

export function JobUpdatesCustomerLine({ line }: { line: JobActivityMessage }) {
  const { who, body, message } = messageLineParts(line)
  const tone = message.tone === 'customerIn' ? 'customerIn' : 'customerOut'
  const { weekdayTimeChicago, daysAgoLabel } = getDispatchNoteDisplayMeta(line.at)
  return (
    <li
      data-testid="job-updates-customer-line"
      data-tone={tone}
      style={{
        padding: '0.5rem 0.5rem',
        borderBottom: '1px solid var(--border)',
        borderRadius: '0 6px 6px 0',
        fontSize: '0.8125rem',
        ...TONE[tone],
      }}
    >
      <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>
        <span
          style={{
            fontSize: '0.65rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            color: 'var(--text-orange-700)',
            marginRight: '0.35rem',
            verticalAlign: 'middle',
          }}
        >
          {message.channelWord}
        </span>
        <strong style={{ color: tone === 'customerIn' ? 'var(--text-orange-800)' : 'var(--text-strong)' }}>{who}</strong>
        <span style={{ marginLeft: '0.5rem' }}>
          {weekdayTimeChicago} · {daysAgoLabel}
        </span>
      </div>
      <div style={{ color: 'var(--text-gray-800)', whiteSpace: 'pre-wrap' }}>
        {message.subject ? (
          <>
            <strong style={{ fontWeight: 650 }}>{message.subject}</strong>
            {body ? ' · ' : ''}
          </>
        ) : null}
        {body}
      </div>
    </li>
  )
}
