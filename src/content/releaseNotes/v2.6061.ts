import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6061',
  date: '2026-10-29',
  title: 'The lien affidavit swears the real period of the work, not one day',
  kind: 'fix',
  highlights: [
    'Paragraph 5 of the mechanic’s lien affidavit now states the period the work was done: the first approved clock day on the job through the last. Until now the Lien desk’s draft put a single day near the end of the last month worked as both the start and the end, and the job window’s own Mechanic’s lien tab put the last day twice.',
    'A last day of work set by hand ends the period when it is later than the clock hours, the same way the lien clocks already read it.',
    'A job with no approved hours swears the first to the last day of the month the desk knows, and a month still running ends today.',
    'The Lien desk’s affidavit, its paper preview, the stop window’s page and the job window’s tab all read the same period, so no two prints disagree.',
  ],
}

export default note
