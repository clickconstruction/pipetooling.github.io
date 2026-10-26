import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5869',
  date: '2026-10-26',
  title: 'A card payment counted twice comes off its job',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Now and then Stripe told the app about one card payment twice, and the bill read paid at twice its amount. The copy could not be removed: every line on a bill Stripe marks paid was locked to Stripe’s own doors, which would have undone the real payment.',
    'The first lines that pay a Stripe bill in full stay Stripe’s. A line past them is a copy Stripe never heard of, and its ⋯ menu now holds Unlink and remove like any typed payment. The bill stays paid, and the job’s payment record notes the copy as a double.',
  ],
}

export default note
