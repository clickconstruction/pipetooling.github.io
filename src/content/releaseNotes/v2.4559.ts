import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4559',
  date: '2026-10-05',
  title: 'Documents: GC statements and test report emails are kept',
  kind: 'feature',
  highlights: [
    'Each statement emailed to a GC is now kept as the GC read it, whether you sent it or it went on its schedule. Before, a statement was drawn again from today’s numbers.',
    'A test report email is kept with its PDF and listed on the job’s Documents tab under Sent from this job.',
    'A statement covers many jobs, so it is filed under the GC. A place to browse those is coming to the Documents page.',
  ],
}

export default note
