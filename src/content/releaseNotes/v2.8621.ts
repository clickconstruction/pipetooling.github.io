import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8621',
  date: '2026-11-26',
  title: 'Customer portal: the developer can delete a test customer’s turned-off link',
  kind: 'fix',
  highlights: [
    'Turning a portal link off kept its row in the window’s History for good. A test customer’s turned-off links from the walks had no way out.',
    'A developer now reads Delete… beside a turned-off link in History. It goes only for a customer whose name starts with ZZ, and never while a GC’s proposal names the link.',
    'Nothing changes for the office. Turn off, Rotate and Turn portal back on are as they were.',
  ],
}

export default note
