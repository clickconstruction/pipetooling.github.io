import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3480',
  date: '2026-09-15',
  title: 'Report emails by team lead, and a door on Jobs → Reports',
  kind: 'feature',
  highlights: [
    'Report email recipients can now follow a team lead: pick Todd and the recipient gets every report from Todd and everyone Todd leads — kept current as the team changes, no editing needed.',
    'Jobs → Reports gains a Report email recipients button beside Recurring Email Reports (Recipients on a phone). The Dashboard mail button still works.',
    'My email schedule reads “reports from Darren and Paige, and everyone Todd leads”; the dev Email streams card tags each recipient with how many people and teams.',
  ],
}

export default note
