import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6371',
  date: '2026-11-02',
  title: 'A development’s photos: one row at the bottom of the page, scrolled sideways',
  kind: 'feature',
  highlights: [
    'The Development page ends with a sixth look, Photos: every photo the crews took on the site, newest at the left, in one row you slide sideways. A small day label marks where each day starts, and Show more at the right end reads the next sixty.',
    'Chips above the row narrow it to one job or one source. Each job’s chip counts its photos.',
    'A tile opens the photo at full size with its job, who took it, when and where it is filed. Next walks along the row; Only Deon’s photos narrows the row to one person.',
    'The strip under the counts reads Photos with the site’s count and how many came this week.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
