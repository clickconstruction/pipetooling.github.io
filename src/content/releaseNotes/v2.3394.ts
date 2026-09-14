import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3394',
  date: '2026-09-14',
  title: 'People → Review counts card charges the way Job Summary does',
  kind: 'fix',
  highlights: [
    'The same job could show two different parts costs — $1,465 on People → Review and $710 on Jobs → Job Summary — because Review still counted internal transfers as a cost and counted a card purchase twice when it was also linked to a supply-house invoice. Review now applies the one card-charge rule Job Summary has used since v2.2692, so a job’s parts cost and margin agree on both surfaces.',
    'Review’s Net headline had left card charges out of parts entirely while the Team Summary row was loading; it now includes them, so the number no longer jumps once the row arrives.',
  ],
}

export default note
