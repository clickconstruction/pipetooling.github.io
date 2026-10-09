import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5065',
  date: '2026-10-09',
  title: 'Help: “see what I still owe each sub contractor” starts with what to do first',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'superintendent'],
  highlights: [
    'The guide now opens with what to do first: Jobs → Subs → Pay shows who is owed what and what you can pay right now, and you press Pay beside a sub to pay their biggest ready sheet.',
    'Fixing a payment that landed on the wrong sheet, and working the Subs tab on a phone, are now guides of their own.',
    'Nothing in the app changes, and no sentence was cut. Each part moved whole.',
  ],
}

export default note
