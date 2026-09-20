import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3627',
  date: '2026-09-19',
  title: 'Hiring: Try-out is a stage — one press puts a helper on the roster to be tried on real jobs',
  kind: 'feature',
  highlights: [
    'Prospects → Hiring now runs Screen → Interview → Try-out → Hire → Review. In a helper column (Helper, Apprentice, Laborer), every Screen and Interview card has a green Try out button.',
    'Try out makes the helper an app login from the name and email on the card — a regular Helper account, so Dispatch can schedule them and they can clock in. They sign in with the emailed link on the sign-in page; nobody hands out a password. A card with no email says so and waits.',
    'The card moves to Try-out, stamped "on trial since" that day. Hire ends the try-out and moves the card to Hire with its onboarding checklist; Pass ends it and keeps the notes. Asking the day\'s leader "take them again?" is the next release.',
    'Fixed along the way: for about two weeks an office account could have switched the Hiring board on for itself. Only a dev can grant it again, as the Active accounts screen always said.',
  ],
}

export default note
