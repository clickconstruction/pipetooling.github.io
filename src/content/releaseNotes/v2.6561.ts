import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6561',
  date: '2026-11-06',
  title: 'Machine templates at Settings: small, medium and large excavators, skid steers and drills, each with its gauges and its walk-around questions',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant'],
  highlights: [
    'Settings → Jobs & billing → Machine templates lists every template the fleet board offers, nine to start: small, medium and large excavator, skid steer, directional drill, trencher, compactor, trailer and other.',
    'Each template has a name, a kind and a size, its gauges drawn the way the crew will see them, a tank, a sight glass, a dipstick or a dial, with where to read each, and the questions only that kind gets, each with whether a No holds the machine.',
    'Two more tabs hold the questions every machine’s walk starts with and the three of the leaving check. Add, reorder, take off, and save.',
    'A machine that keeps its own gauge list is unchanged; Use the template’s on its card goes back to the template.',
  ],
}

export default note
