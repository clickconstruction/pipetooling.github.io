import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6461',
  date: '2026-11-03',
  title: 'Who counts as what, in one list, and the charges screens say why a day prices at nothing',
  kind: 'feature',
  roles: ['dev', 'controller', 'master_technician'],
  highlights: [
    'Settings → Jobs & billing → Rates charged by crew now ends on Who counts as what: every person with their Charged as, set in one place instead of on each desk. A pick saves at once. People no longer here are listed apart, since their past days still price by it.',
    'A day with nobody charged prices at nothing. The Charges window, the Statement of charges window and the hours statement’s charged paper now name who counts as nobody, with a link to each desk and to the list.',
    'The premium waits until every day on the job prices. The Charges window, the statement’s office copy and the Job Summary no longer show a premium that is not there.',
    'The Job Summary’s Charges note names who counts as nobody, and finds each person’s Charged as through their People record’s login when the two names differ. Save the rates and Save the markup stay grey until something changes.',
  ],
}

export default note
