import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5603',
  date: '2026-10-17',
  title: 'Prospects: Add customer and Add to the bench carry the person over',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Converted ✓ and Asked us ✓ open Add customer as Residential for a person on their own and Commercial for a company, with the person’s cell as the phone and their language set. Save adds the person as the customer’s contact person, with their title.',
    'Add to the bench ✓ carries the person’s cell, the sub’s license and their Google Maps profile onto the bench, so nothing is typed twice.',
  ],
}

export default note
