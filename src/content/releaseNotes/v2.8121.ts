import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8121',
  date: '2026-11-20',
  title: 'Permits, Market: Ask for shows what was looked up about a builder, grey until you check it',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Ask for on a call-list row can now show what kind of company it is, an office phone, and a person and title to ask for. Each fact names the page it came from and the day.',
    'A looked-up fact is grey and says Looked up, not checked. Press Checked when it holds and it turns bold with your name and the day. Press Wrong and it leaves the row for everyone, with Put back to undo a slip.',
    'A looked-up kind tags the name as an outline. Once someone checks it, a builder moves up and a design firm, a permit service or a trade waits behind the other companies.',
    'No lookup takes a name off the list or changes the kind you said on the builder’s sheet. A name nobody looked up reads as before, with Google the builder.',
  ],
}

export default note
