import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6611',
  date: '2026-11-06',
  title: 'A partial payment pauses the lien reminders, and the desk asks what they promised',
  kind: 'feature',
  highlights: [
    'A payment on the job after the lien notice is an answer: the Do now row and the Reminders step read paying it down with the amount paid and what is still owed, no reminder leads, and the attorney’s letter waits. The office may still send the letter by hand when the payment was token.',
    'The usual move becomes Record what they promised, on the Do now row and on the sent notice’s footer: the day and the amount they gave for the rest. The day goes on the job too, so the Stages board and the forecast read the same promise. The desk asks again on that day, or a week after the payment when they gave none.',
    'The notice’s timeline draws the payment with the day the pause ends, their promise as a row of its own, and the attorney’s letter’s window as waiting. The affidavit’s week and the lien’s last day never move for a payment that is short.',
    'Two defaults Taunya can change in one line each: how long a payment pauses the reminders (the promised day, else a week), and whether the attorney’s letter ever goes to someone who is paying (not by the desk’s hand).',
  ],
}

export default note
