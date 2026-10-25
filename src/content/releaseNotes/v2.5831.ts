import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5831',
  date: '2026-10-24',
  title: 'Phone: edit a customer and see each property’s note from the summary sheet',
  kind: 'feature',
  roles: ['assistant', 'controller', 'estimator', 'master_technician', 'dev'],
  highlights: [
    'On a phone, More → Customers → a customer now has Edit customer beside Close. It opens the same customer editor as the Customers page.',
    'The sheet lists every property, the main one first. Under each address is its note in full, where door codes and gate codes live. A property with no note reads No note.',
    'Open record opens the customer’s full page from the sheet.',
    'On the customer’s page, the main address now shows its note beside it, the way the other properties always did.',
  ],
}

export default note
