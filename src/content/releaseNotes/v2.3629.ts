import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3629',
  date: '2026-09-19',
  title: 'Contracts: mark an agreement as handed to the customer — a paper hand-off counts as sent',
  kind: 'feature',
  highlights: [
    'On the Contract sweep, after Download PDF the pane offers Mark as handed to the customer. Press it when you are handing or mailing the page yourself: the job leaves the pile and waits for the signed copy, with who handed it over and when on the record. No email goes out and no reminders are scheduled.',
    'A handed-over agreement reads "handed over · awaiting signature" on the job, and the contract window leads with File the signed copy instead of resend and copy-link buttons that had nothing to send.',
    'Filing the signed page turns that same agreement into the signed record — not a second contract beside it.',
    'Second step of Signing it on paper, whose design the owner approved on Sep 19. Emailing the PDF from the app is next.',
  ],
}

export default note
