import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6753',
  date: '2026-11-08',
  title: 'Settings: Emails & reports, What the team sees, the office address and the money pins open to the owner',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The owner now sees Emails & reports and What the team sees on Settings, and can change who is on each stream. Before, both tabs were a dev’s.',
    'Settings → Company shows the owner the Office address card, and shows the office the Map default view card.',
    'The owner can pin Billed, Internal team labor, Supply houses AP and Sub labor due to a leader’s dashboard, and the pin footer offers Pin for someone to the owner as well.',
    'Your account points the owner at Everyone’s salaried workday on People, as it pointed a dev.',
  ],
}

export default note
