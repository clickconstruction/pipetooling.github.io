import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5559',
  date: '2026-10-15',
  title: 'Prospects: find jobs to GC and subs for the bench, beside the customers',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Prospects has two more top tabs, Jobs to GC and Subs. Each is the same calling deck, with its own queue, finding a different kind of company: owners, developers and architects with a job we could build as the GC, and trade companies for the bench.',
    'New Prospect asks who you are looking for first. A sub takes its trades, how far it goes and its language; a job to GC takes who they are. Every kind takes where you found them, and the card shows those facts under the name.',
    'The last press of the outcome row is named for what happens: Add to the bench ✓ on a sub opens the bench’s Add a company filled from the card, and Save puts the company on Trade partners. Asked us ✓ on a job to GC opens Add customer. Converted ✓ on a customer is unchanged.',
    'The Prospect List and the Activity report follow the tab you are on, so a sub that landed reads On the bench and a lead that asked us reads Asked us.',
  ],
}

export default note
