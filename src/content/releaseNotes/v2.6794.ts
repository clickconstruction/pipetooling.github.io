import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6794',
  date: '2026-11-09',
  title: 'The dev seat bills a job and hands the customer the link',
  kind: 'feature',
  highlights: [
    'A dev’s agent can now bill a Ready to Bill job from the MCP seat the way Bill Customer does, and text or email the pay link the way the share row does: plan first, read the amount, the number or address and the text’s exact words, then apply. The Stripe mode is always named; the verb never guesses live.',
    'The apply runs the app’s own steps in order and says what each did: the bill, its short link, the job to Billed when nothing is left, the text from the company number, the email with your signature. A send that cannot go leaves the bill standing and names the reason, and the same verb hands over a bill that already exists.',
    'With this the three verbs the owner asked for are in: set up a job, update it, send the bill. The road to everything a user can do is on the card.',
  ],
}

export default note
