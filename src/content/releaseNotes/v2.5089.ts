import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5089',
  date: '2026-10-09',
  title: 'Overhead: the hints say recorded time and send wages to the Pay lens',
  kind: 'fix',
  roles: ['dev', 'master_technician'],
  highlights: [
    'The lens cards’ hover text now names the sessions the numbers count: recorded ones, clocked out and not rejected, whether approved or still awaiting approval. It used to say approved.',
    'A lens’s Watch-outs no longer calls field time awaiting approval missing. That time already counts, and a rejection takes it out.',
    'Unpriced hours on the maintenance strip now says to set wages in People → Users → Pay, and the no-wage flag behind a cell opens the Pay lens instead of Payroll.',
    'Only words and one link change. Every number reads the same as before.',
  ],
}

export default note
