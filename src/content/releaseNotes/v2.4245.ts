import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4245',
  date: '2026-09-30',
  title: 'Procurement log: the printed sheet names its columns on every stage, and on every page in Chrome',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'A second page of the printed log no longer opens on bare dates. Every stage on the sheet now starts with its own heading and the column names: Item, Submittal, Ordered, Lead time, Expected on site, Schedule, Notes.',
    'Printed from Chrome, a stage that runs onto the next page repeats its heading and the column names at the top of that page.',
    'Safari repeats no table heading, so there a stage moves whole to the next page when it fits and brings its column names with it. A stage longer than a page still runs on without them in Safari.',
    'The columns keep the same widths down the sheet, portrait or landscape, so a long product name no longer squeezes the dates.',
  ],
}

export default note
