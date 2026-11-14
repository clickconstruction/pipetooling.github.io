import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7175',
  date: '2026-11-13',
  title: 'Materials on site: a job that did not load says so, never zero',
  kind: 'fix',
  highlights: [
    'On the materials desk, a job whose boxes failed to load drew as a job with no boxes, $0.00 missing and every count in hand. It now reads Did not load with the reason, and Read again reads it.',
    'A site’s row on the desk counts the jobs that did not load. A site’s screen says how many of its jobs are missing from it, with Retry.',
    'A site whose jobs could not be looked up read as an empty site. It now says its jobs did not load.',
    'When the names joined on a site do not load, the screen says the joined parts show as separate rows until they do.',
  ],
}

export default note
