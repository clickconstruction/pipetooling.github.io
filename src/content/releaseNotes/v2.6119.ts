import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6119',
  date: '2026-10-30',
  title: 'A client that calls what only its migration creates: the push follows the merge, and the deploy holds until it does',
  kind: 'infra',
  highlights: [
    'A pull request whose client calls a database function, table or view that only its own migration creates is now labelled push right after the merge, with a warning on the line, so whoever arms it knows the push must follow at once and arms it only when the person who pushes is at hand.',
    'The site deploy reads the prod migration ledger first and holds when the client calls what a pending migration creates: the site keeps the old client instead of refusing every press until the push, as it did for the clock on the morning of 2026-10-30.',
    'The push script re-runs a held deploy once the migration lands.',
    'The deploy-model rule now says which way round each coupled change goes: client first when the migration changes behavior the old client would misread; push right after the merge when the client calls what only the migration creates.',
  ],
  roles: ['dev'],
}

export default note
