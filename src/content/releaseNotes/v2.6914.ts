import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6914',
  date: '2026-11-10',
  title: 'Bid Board: a grey icon for every missing link, and one Files window',
  kind: 'feature',
  highlights: [
    'Every bid on the Bid Board now shows all five icons in the Links column: photos, project folder, plans, CountTooling and bid submission. Blue is there. Grey is not there yet.',
    'Press a grey icon to open the bid’s new Files window on that row. It says what the bid is missing, and Set it in Edit bid opens the bid on the right field.',
    'A blue icon still opens its link straight away, as before.',
    'The camera now opens the Files window too. The bid’s photos are its first row, and the other four links sit under them with Open on each.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary'],
}

export default note
