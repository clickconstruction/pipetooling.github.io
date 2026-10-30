import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6174',
  date: '2026-10-30',
  title: 'Legal desk: the Venue cell opens the Map on the county, with where a suit can be filed',
  kind: 'feature',
  highlights: [
    'A press on an account’s Venue cell now opens the desk’s Map on that account’s county, with the county outlined and the account’s dot held, so the county card lists the case at once.',
    'The county card gains a Venue block for the held case: where the work was done and where the defendant is, each with its county and justice precinct, then the justice court limit line and the lien foreclosure line as the printed packet says them, and a link to the Map page where the office draws its court areas.',
    'The block appears only for the account you came from. Tapping another county or another case reads as before.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
