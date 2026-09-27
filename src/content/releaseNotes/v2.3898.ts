import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3898',
  date: '2026-09-27',
  title: 'Controller access, batch 3: jobs, customers, projects, reports and the rest',
  kind: 'fix',
  highlights: [
    'A controller can now do everything an assistant can on Jobs, Customers, Projects, Reports and sub labor. Several of these pages came up empty or read-only for a controller login.',
    'This is the third of five updates that give the controller role everything the assistant role already has. The access rules are now all in step; the last two updates cover actions such as marking an invoice paid.',
  ],
}

export default note
