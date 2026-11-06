import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6555',
  date: '2026-11-06',
  title: 'The tables for machines on the fleet board and the pre-use check, pushed before any screen reads them',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A machine is a vehicle of its own kind, with the name the crew says, an hour meter, a label code, a template by kind and size, and a rental agreement when it is not ours.',
    'Templates for small, medium and large excavators, skid steers, directional drills, trenchers, compactors and trailers come seeded, each with the gauges its check draws and the questions its walk asks.',
    'A check row holds a morning walk or a leaving check with its answers, gauge readings, hours and where the machine was left; its photos get their own bucket and file into the machine’s Drive folder.',
    'A machine can be attached to a job for a day on the schedule, and a held machine has its own kind on Dispatch’s inbox. Nothing on a screen changes yet; the next release draws the fleet board.',
  ],
}

export default note
