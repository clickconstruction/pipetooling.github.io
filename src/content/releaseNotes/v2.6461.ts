import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6461',
  date: '2026-11-03',
  title: 'Who counts as what, in one list, and the charges screens say why a day prices at nothing',
  kind: 'feature',
  roles: ['dev', 'controller', 'master_technician'],
  highlights: [
    'Settings → Jobs & billing → Rates charged by crew now ends on Who counts as what: every person with their Charged as, set in one place instead of on each desk. A pick saves at once. People no longer here are listed apart, since their past days still price by it.',
    'A day with nobody charged prices at nothing. The Charges window and the Statement of charges window now name who counts as nobody, with a link to each desk and to the list.',
    'The Job Summary’s Charges note says the same when a row prices at nothing, in place of “Not priced yet”.',
    'Save the rates and Save the markup stay grey, saying what is saved, until something changes.',
  ],
}

export default note
