import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5052',
  date: '2026-10-09',
  title: 'Help: “see when a customer will pay” starts with what to do first',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary'],
  highlights: [
    'The guide now opens with what to do first: read the Expected line, and record a date when the customer names one.',
    'Its other parts are guides of their own: read the payment forecast, see which customers pay slowly, record payments so they count, and see which months need a lien notice.',
    'Nothing in the app changes, and no sentence was cut. Each part moved whole.',
  ],
}

export default note
