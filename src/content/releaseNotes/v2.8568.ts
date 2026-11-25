import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8568',
  date: '2026-11-24',
  title: 'Settings: the developer can clear a kept map address nothing is written under',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Settings → Data & recovery has a new block for the developer, Kept map addresses. Nobody else sees it.',
    'The map keeps an address typed in a Job Address box even when no job is made. The block finds a kept address by its words.',
    'Clear… removes an address only when no record anywhere holds its street line: no job, bid, estimate, customer, GC company or any other record with an address.',
    'An address a record holds stays, and its line names each kind with a count. The window that asks first has a button that reads Clear the address.',
  ],
}

export default note
