import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8281',
  date: '2026-11-21',
  title: 'The Bridge: a dev who shows ZZ tests keeps them when the list leaves something out',
  kind: 'fix',
  highlights: [
    'A dev who shows ZZ test jobs lost every one of them on the Bridge once the left-out list named anything. They stay now.',
    'The list still takes out what it names. A ZZ test job on a development the list names is left out, like any other job there.',
    'Nothing changes for anyone who hides ZZ tests, which is everyone but a dev who chose to show them.',
    'Nothing changes for that dev either while the list is empty.',
  ],
}

export default note
