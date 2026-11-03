import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6445',
  date: '2026-11-03',
  title: 'The Job Summary says what each job is charged at, and the Charges window adjusts it',
  kind: 'feature',
  roles: ['dev', 'controller', 'master_technician'],
  highlights: [
    'Jobs → Job Summary has two new columns on the right: Charges, the job’s crew-days at the rate card plus its materials at the markup, and Premium, how far the contract price stands above the charges. A shortfall reads red.',
    'Press a Charges cell and the Charges window opens: the job’s rule and markup at the top, four tiles, every crew-day by week with who was out and the crew that day, every material line with its cost and charged amount.',
    'Change a day’s crew, untick a day or a line, or pass a line through at cost, give it a reason, and Save. Adjustments live on the job’s charges, never on anyone’s clock session or invoice, and Revert to the record undoes them all.',
    'A chip over the table names the rate card and markup in force. Cents print smaller than dollars everywhere here.',
  ],
}

export default note
