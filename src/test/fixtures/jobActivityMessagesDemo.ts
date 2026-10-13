/**
 * Messages cut 10: one Pipeline job's calls, texts and emails as Job activity reads them. Made-up people from
 * `customer-messages-prototype.html` v0.3 (spike/gc-mode): Dana Whitfield on 1312 Oakridge sewer line, Luis the tech,
 * Rosa at the office, and Hector Ruiz, a trade partner on the same job. Chicago is five hours behind UTC in October, so
 * 14:02Z reads 9:02a.
 */
import type { JobActivityMessage } from '../../lib/jobs/jobActivityMessages'

export const DANA = { name: 'Dana Whitfield', goesBy: null, kind: 'customer' } as const
export const HECTOR = { name: 'Hector Ruiz', goesBy: null, kind: 'trade' } as const

const dana = (m: Omit<JobActivityMessage, 'contactId' | 'contact' | 'tied'> & { tied?: boolean }): JobActivityMessage => ({
  contactId: 'c-dana',
  contact: DANA,
  tied: true,
  ...m,
})

export const DANA_JOB_MESSAGES: JobActivityMessage[] = [
  dana({
    id: 'm-dana-1',
    channel: 'text',
    direction: 'out',
    at: '2026-10-05T14:02:00Z',
    who: 'Luis',
    body: 'Dana, this is Luis with Click Plumbing. We are on our way to 4120 Oakridge Trl, about 30 minutes out.',
  }),
  dana({ id: 'm-dana-2', channel: 'text', direction: 'in', at: '2026-10-05T14:04:00Z', who: '', body: 'Great. Gate code is 4471.' }),
  dana({
    id: 'm-dana-3',
    channel: 'email',
    direction: 'out',
    at: '2026-10-06T19:20:00Z',
    who: 'Rosa',
    subject: 'Your estimate for Oakridge sewer line',
    body: 'Hello Dana, your estimate is ready. Review and approve it here: click.co/e/8Kp4.\n\nCall or text us with any question.',
  }),
  dana({
    id: 'm-dana-4',
    channel: 'call',
    direction: 'in',
    at: '2026-10-06T21:05:00Z',
    who: 'Rosa',
    body: '',
    durationSeconds: 192,
    summary: 'Asked if Thursday works and if the water heater quote still stands.\nNext: Rosa calls back today.',
    transcript: 'Dana: Hi, can you do Thursday?\nRosa: Let me check the board and call you back.',
  }),
  dana({ id: 'm-dana-5', channel: 'note', direction: 'team', at: '2026-10-06T21:14:00Z', who: 'Rosa', body: 'She wants texts after 5, never calls.' }),
  dana({
    id: 'm-dana-6',
    channel: 'text',
    direction: 'out',
    at: '2026-10-07T13:00:00Z',
    who: '',
    body: 'Dana, your estimate for Oakridge sewer line is waiting for your approval. Approve it here: click.co/e/8Kp4. Reply to this text with any question.',
  }),
  dana({ id: 'm-dana-7', channel: 'missed', direction: 'in', at: '2026-10-07T13:14:00Z', who: '', body: '' }),
  dana({ id: 'm-dana-8', channel: 'portal', direction: 'in', at: '2026-10-07T13:15:00Z', who: '', body: 'Approved the estimate · $4,850' }),
  dana({ id: 'm-dana-9', channel: 'event', direction: 'team', at: '2026-10-07T13:20:00Z', who: 'Rosa', body: 'Rosa tied a text to 1312.' }),
  {
    id: 'm-hector-1',
    contactId: 'c-hector',
    contact: HECTOR,
    channel: 'text',
    direction: 'in',
    at: '2026-10-07T15:30:00Z',
    who: '',
    body: 'The trencher is free Thursday if you still need it at Oakridge.',
    tied: true,
  },
  dana({
    id: 'm-dana-10',
    channel: 'voicemail',
    direction: 'in',
    at: '2026-10-07T22:40:00Z',
    who: '',
    body: '',
    durationSeconds: 38,
    transcript: 'Hi, it is Dana. The side gate is unlocked for Thursday. Thanks.',
  }),
  dana({ id: 'm-dana-11', channel: 'text', direction: 'in', at: '2026-10-08T01:30:00Z', who: '', body: 'Perfect, thank you. See you Thursday.', tied: false }),
]
