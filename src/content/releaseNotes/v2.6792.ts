import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6792',
  date: '2026-11-09',
  title: 'The dev seat gets a teammate online: make the account, fix the name, attach the login, reset a password',
  kind: 'feature',
  highlights: [
    "A dev's coding agent can now make a teammate's app account the way the Hire form does, rename a row that was typed wrong, change a role or a sign-in address, attach a login to a person on the roster and send them the sign-in email, remove a login, and send the Forgot password email or set a password the owner dictates. Every step is a plan first, then an apply, through the same doors the People desk uses, so every rule holds.",
    'A new read says where getting someone online stands: whether the row exists, whether a login is attached, when the invite or the link went and whether it was opened, whether they have signed in and when, with the next press in plain words.',
    'A password the owner dictates is never printed back and never written to the call log. One reset email per address per ten minutes.',
    'The guide for connecting a coding agent has a new section, Get a teammate online with the seat.',
  ],
}

export default note
