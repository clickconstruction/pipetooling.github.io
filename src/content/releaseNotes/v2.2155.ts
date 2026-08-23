import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2155',
  date: '2026-08-23',
  title: 'Pipeline: "Show 90+" and "no bill line" lists match their cards',
  kind: 'fix',
  highlights: [
    'The 90+ and no-bill-line filters on Billed Awaiting Payment now load every open-job scope first, so bills that hang on Working or Waiting jobs are in the list — before, with Working collapsed, "Chase the 90+ tail — 3 bills" landed on a list of 2.',
    'Applies to the Pipeline card buttons, the 30+/90+/No line chips, and Quickfill → Jobs Cleanup\'s buttons.',
  ],
}

export default note
