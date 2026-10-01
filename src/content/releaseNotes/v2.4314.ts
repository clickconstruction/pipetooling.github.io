import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4314',
  date: '2026-10-01',
  title: 'Release of Lien: six numbered steps down the left',
  kind: 'feature',
  highlights: [
    'The Release of Lien window now walks you through six numbered steps joined by arrows: pick the bills, check the form, check the amount, check the details, get it signed, send it to the GC. A green tick means done, the blue number is the step to do now, and the footer says which step you are on.',
    'A problem shows in the step that causes it and the steps after it wait. A bill that is already waived stops at step 1, with "Waive the paid money instead" as the way on.',
    'The details read as a short list with one Change a detail button. Signing is two big choices: "He is here, he signs now" or "Send it to his desk". Printing for a paper signature is one quiet line.',
    'The window is wider and the page stays in view beside the steps, marking the part the current step fills. Once he signs, the first five steps fold to one line each and Send is what is left.',
  ],
}

export default note
