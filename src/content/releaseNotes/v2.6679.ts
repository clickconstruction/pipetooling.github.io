import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6679',
  date: '2026-11-08',
  title: 'Legal desk: the claim, line by line, on the Account tab',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The Account tab opens with The claim, one table above the ledger. Two rows fill in on their own: the open bills from Accounts Receivable and the retainage the GC holds, from the job.',
    'Press Add a claim line for what a dispute claims past the bills: materials left on site, damages, interest, attorney fees or other. Each line takes an amount, its basis and the Evidence document that shows it.',
    'Edit a line or remove it from the same table. A removed line stays on the record as removed. The total under the table is the claim; the How much? tile and the printed packet read it in the next two steps.',
  ],
}

export default note
