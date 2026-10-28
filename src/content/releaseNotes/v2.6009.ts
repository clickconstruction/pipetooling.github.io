import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6009',
  date: '2026-10-28',
  title: 'A plain line at the top of every screen when the app is slow',
  kind: 'feature',
  highlights: [
    'When a read has waited four seconds and nothing has come back, one line appears above the menu on every screen: “The app is slow right now.” It goes the moment a read lands, so a slow morning no longer looks like a dead app. One slow read among many landing never shows it.',
    'When nothing answers at all the line turns red, reads “Could not reach the app.” and offers Retry, which opens the page again. With no signal on the phone it reads “No signal.”',
    'Opening the app during a slow spell no longer lands on sign-in. Past five seconds the loading screen reads “The app is slow right now. Keep this open.” and waits for the app instead of giving up at eight; a role read the freeze failed is read again instead of leaving you with a bare app for the morning.',
    'A dev whose screen has been slow for a minute also reads “Run /db-freeze before anyone restarts.”, the runbook’s first rule.',
  ],
}

export default note
