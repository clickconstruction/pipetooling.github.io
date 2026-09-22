import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3738',
  date: '2026-09-22',
  title: 'Assistants: one “back to the schedule” rule, and a deep link is never bounced',
  kind: 'fix',
  highlights: [
    'Two rules used to decide where an assistant lands after being away, and the Dispatch Mode one had no idea which page you opened — so a link straight to a job or the Stages list could bounce you to the Schedule tab. Now there is one rule, and it only fires when you would otherwise land on the dashboard.',
    'The threshold: 5 minutes away when Dispatch Mode is on (you land on its Schedule tab), 1 hour away on a phone when it is off (you land on Schedule Dispatch). Nothing else about either page changed.',
    'Opening a job, a customer or a report link goes exactly where the link says, no matter how long you were gone.',
  ],
}

export default note
