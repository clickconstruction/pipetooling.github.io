import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5562',
  date: '2026-10-15',
  title: 'GC projects: a hairline under each week’s dates on the clock',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'On a project’s card, each week’s dates on The clock now sit on a thin line the width of the week. Where one line ends and the next begins is where one week becomes the next, so Saturday and Sunday no longer blur across the gap.',
    'A quiet week keeps its line under an empty heading, so the rhythm holds. While building, the month label sits on the same line over its weeks.',
  ],
}

export default note
