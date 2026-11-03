import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6441',
  date: '2026-11-03',
  title: 'The rate charged for a crew’s hour depends on who was out, and materials take a markup',
  kind: 'feature',
  roles: ['dev', 'controller', 'master_technician', 'assistant'],
  highlights: [
    'Settings → Jobs & billing → Rates charged by crew holds one rate for each crew shape: a master with a helper, two techs, a tech alone, a helper alone, and the rows still to set. A blank row is named, never priced.',
    'Each person’s desk says what they count as when a crew is priced: master, tech, helper, or not charged. Two techs out together for eight hours are one crew-hour line, never sixteen person-hours.',
    'Markup on materials sits beside the rates, read both ways: 25% over cost is a 20% margin on the sale.',
    'Nothing prints yet. The Statement of charges, the Job Summary’s columns and the Charges window come in the next releases of punch list #254.',
  ],
}

export default note
