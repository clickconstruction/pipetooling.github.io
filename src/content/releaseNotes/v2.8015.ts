import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8015',
  date: '2026-11-19',
  title: 'Before we start: a bullet of ours reads the app',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'superintendent'],
  highlights: [
    'A bullet of ours says where it is read from. Press those words to pick the order log, Trips or the city’s permits.',
    'Read from the order log, it is ready when every line of the stage is on site or lands before our first day.',
    'Read from Trips, it is ready when a trip with a person on it covers our first day.',
    'The row shows the fact and a press that opens the screen it came from. A bullet can still be ticked by hand.',
  ],
}

export default note
