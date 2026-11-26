import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8671',
  date: '2026-11-26',
  title: 'A person\'s desk: a developer sees how they sign in, and can take Google off their login',
  kind: 'feature',
  highlights: [
    'Access and account on a person\'s desk has a Ways in row. It says whether a password is set and whether Google is linked.',
    'A linked Google account shows its email address and when it was last used. A different address from the roster is marked.',
    'Unlink Google takes the link off after a question. The password still works, and the person signs in again.',
    'Changing a person\'s sign-in email now takes their Google link off too, so the old Google account stops opening the login.',
  ],
}

export default note
