import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6485',
  date: '2026-11-04',
  title: 'The logbook’s TDLR check reads the level and Class B numbers, and a journeyman is not the top rung',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Check TDLR reads the technician’s level off the state’s record: a registered tech’s number no longer answers Matches for a certified tech pick, and the reason names the level TDLR lists.',
    'A Class B AC contractor number (TACLB…) checks like a Class A one; before, Check TDLR stayed dim with no word why, and the dev seat refused the number.',
    'A journeyman electrician’s row says master is next and its rule is not seeded yet, instead of calling the journeyman the top rung. Top rung is kept for a license with nothing above it, on the page and on the print.',
    'A TDLR check gives up after 10 seconds and says so, instead of leaving Checking… lit when the state’s list stalls. The desk’s Logbook press opens the logbook without reloading the app.',
  ],
}

export default note
