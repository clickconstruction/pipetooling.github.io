import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6038',
  date: '2026-10-28',
  title: 'Messages: the email you send is a plain email, signed the way you keep it',
  kind: 'feature',
  highlights: [
    'An email from a thread’s reply box now reads like one a person wrote: your words, then your signature, and nothing after it. The navy bar, the cream card and the footer are gone. The papers the app sends, an estimate, a bill, a contract or a lien notice, keep their letterhead.',
    'The greeting is yours. The box starts an email with their first name and a comma on its first line, which you keep, change or delete. The app no longer writes Hello after the fact, and the subject reads your first line after the greeting.',
    'Your signature on an email is a card on Settings → Your account for the office: your name and cell from your account, your title, and up to two lines of your own, with a preview as it goes. The line Email back, text, or call. is no longer added under everyone’s name; whoever wants it types it into their own lines.',
    'The sender is unchanged for now: Click Construction on the app’s address, with replies going to the inbox the thread listens to. Sending as that inbox is the next piece.',
  ],
}

export default note
