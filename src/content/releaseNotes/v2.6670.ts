import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6670',
  date: '2026-11-08',
  title: 'Job Summary’s printed cost breakdown counts card charges as the table does, with fuel on its own line',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Print cost breakdown now takes a card charge that is also on a supply-house invoice off Parts cost, the way the Job Summary table has since the one card rule, so the printed Parts cost never reads higher than the table’s. A line under Card charges says how much was counted under the invoices instead.',
    'Fuel & gas, and any other tag the office shows as a cost line, is drawn under the Parts cost figure as the table draws it and as its own line in the Parts Cost section, instead of disappearing into the card charges.',
  ],
}

export default note
