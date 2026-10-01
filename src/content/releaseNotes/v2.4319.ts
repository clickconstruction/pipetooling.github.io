import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4319',
  date: '2026-10-01',
  title: 'Submittals: a row lists its parts, not just the assembly',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'A fixture priced from a price-book assembly now opens into the parts inside it. LAV-1 reads the lavatory, the faucet and the soap dispenser, not "LAV 1 assembly".',
    'Every part is bought, so trim is order only, not off. Stops, supplies and traps go on the procurement log but not on the GC’s submittal.',
    'Each row lists its parts one per line, maker and model first. In Edit, each part gets its own house, lead time and stage. The package cover lists the parts too.',
    'New revision now carries rows built from the takeoff or typed by hand, with their parts. Before, those rows were left behind.',
  ],
}

export default note
