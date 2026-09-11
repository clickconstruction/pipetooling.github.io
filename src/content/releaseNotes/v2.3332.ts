import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3332',
  date: '2026-09-11',
  title: 'Gas test report: the date sits with the house pressure, empty utilities stay off the paper',
  kind: 'fix',
  highlights: [
    'On a gas test report the date now leads the House pressure section — Date, PSI, in WC, oz/in², mm WC — instead of hanging under the address.',
    'House utilities prints only when a fixture carries a BTU figure. A list of names with no numbers no longer prints as a section of dashes.',
  ],
}

export default note
