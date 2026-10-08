import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4952',
  date: '2026-10-08',
  title: 'Bids: Past values shows a cell’s earlier values under it',
  kind: 'feature',
  highlights: [
    'Beside the History button, Past values shows what a price, a count, a takeoff quantity or price, or a labor row’s hours said before. Up to two earlier values sit under the box, with who typed them and when.',
    'A row with no past of its own shows what the earlier row of the same name said when it was removed, so a re-imported fixture still shows its old price.',
    'Press +N more under a cell to open History on that row. Past values stays on or off on this device.',
  ],
  roles: ['estimator', 'master_technician', 'assistant', 'controller', 'primary', 'dev'],
}

export default note
