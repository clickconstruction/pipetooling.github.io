import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5168',
  date: '2026-10-10',
  title: 'GC mode: a trade partner gets an email at its closeout',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'With the email tick on, Accept the work emails the trade. It says what we hold and how it asks for it.',
    'Recording a final pay application that came by email tells the trade it came in, and what happens next.',
    'Each email goes once, in the company’s language. The tick starts off.',
  ],
}

export default note
