import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3703',
  date: '2026-09-22',
  title: 'Contract sweep: the tabs sit on the list',
  kind: 'feature',
  highlights: [
    'The Ready to send · Needs a look · All tabs now sit on top of the job list they filter, each with its count in a pill. The In Drive tab joins them once the Drive pass has found something. On a phone they scroll sideways inside the list.',
    'The header stops repeating the tab counts. It says how much work has no contract on file, what this sitting has sent and filed, and the floor — and “checking Drive…” while the pass runs.',
    'To send is now called Ready to send, to match the green Ready chip on each row. Hover a tab for what it holds.',
  ],
}

export default note
