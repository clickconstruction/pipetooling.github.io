import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6789',
  date: '2026-11-09',
  title: 'Adding a teammate: one window at a time, Attach a login at the end, Delete for a row made by mistake',
  kind: 'feature',
  highlights: [
    'Hire without the invite now ends with Attach a login. The form closes and the person\'s desk opens on Access & account with the Attach form ready, so the login lands on the same person in the same sitting. Nothing opens on top of anything else.',
    'Add to roster\'s "Also invite them to sign in" box led a dev into a refusal, because the add already made the person. For a dev it is now "Also attach a login", which attaches the login right after the save. The old Send invite window is gone, and every window the People page opens sits above the desk instead of under it.',
    'Closed a desk and lost it? People → Users now shows "Back to <name>\'s desk" in the toolbar until you reopen it.',
    'A person made by mistake has Delete… beside Archive… on their desk\'s Status row and in the row\'s ⋯ menu. When nothing points at them yet, the row and the roster record go for good, with the pay row the Hire form wrote. Someone with hours, pay, paperwork or customers is named with what they have and offered Archive instead. A dev, the controller or a pay-approved leader may delete, the same people who may archive.',
  ],
}

export default note
