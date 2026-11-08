import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6695',
  date: '2026-11-08',
  title: 'They say paid on the Pipeline’s Billed row',
  kind: 'feature',
  highlights: [
    'When a customer says they already paid and the word is written down, the Pipeline’s Billed row now shows it. The dates block under the money reads They say paid with the day they named, in place of the Expected or They said row, and how they paid under it, like “a check in the mail”. The office saw the word only in Job activity and at the deposit before.',
    'The row stays green for a week. After seven days with nothing landed on the job it turns amber, reads “nothing landed in 9 days”, and the bold line under the block asks: Nothing landed · 9d. Pressing either opens Write down their word, the same sheet as before.',
    'A word the deposit already met draws nothing, and a job the office gave up on keeps its quiet row. The claims read again whenever the promised dates do, so the row changes as soon as the sheet closes.',
  ],
}

export default note
