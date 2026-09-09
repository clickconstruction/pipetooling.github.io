import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3177',
  date: '2026-09-09',
  title: 'Job Summary tiles: cents in small type, everything centered',
  kind: 'feature',
  highlights: [
    'The Revenue, Gross profit, Overhead charged, True profit and Per field hour tiles on Jobs → Job Summary now show the exact amount, with the cents in smaller type the way Sub Labor and the pay ledger do — so the big number still reads at a glance.',
    'Each tile\'s label, figure and note are centered in the card.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
