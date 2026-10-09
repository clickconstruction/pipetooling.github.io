import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5068',
  date: '2026-10-09',
  title: 'Help: “write a change order and send it for signature” starts with what to do first',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'The guide now opens with three steps: press New change order on Estimates and pick the customer, add the cost lines, then send it and apply it to the job once it is signed.',
    'Starting a change order from the form on Bids is now a guide of its own.',
    'The numbered guide on a draft, and the old estimate titled “change order”, now sit under a Reference heading at the end. Nothing in the app changes, and no sentence was cut.',
  ],
}

export default note
