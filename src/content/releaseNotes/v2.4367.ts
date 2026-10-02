import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4367',
  date: '2026-10-01',
  title: 'Call mode and the money lists group bills by who pays',
  kind: 'feature',
  highlights: [
    'Call mode lists builders. RMC- Dudley Mason gets one call about his bills, on his own number, instead of five homeowners getting one each.',
    'Bills on jobs billed only to a GC now show up in Call mode, Money waiting and the Pay speeds breakdown. Before, they were left out.',
    'Dashboard → Accounts Receivable and Billed by customer put a GC-billed bill on the GC’s row.',
    'A call logged under the homeowner still counts on the builder’s card.',
  ],
}

export default note
