import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6442',
  date: '2026-11-03',
  title: 'The Plans look is never wider than a phone’s screen',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'On a phone, the Development page’s Plans look ran 4 px past the right edge of the screen and the page scrolled sideways: the chip that reads every job that builds from plans names a part with a set was one line too wide for the column, and the whole look, part cards included, grew to it.',
    'The look is now as wide as its box and never wider, and on a phone that chip wraps onto two lines inside the row.',
    'On a desk nothing moves.',
  ],
}

export default note
