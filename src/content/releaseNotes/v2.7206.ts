import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7206',
  date: '2026-11-13',
  title: 'An agent on the dev seat can set a job’s last day of work for the lien dates',
  kind: 'feature',
  highlights: [
    'A dev’s agent can now set the last day of work on a job, with the reason, the way Set the day does in the job’s Lien window. It can also clear the day, back to the clock hours.',
    'Before anything changes the agent reads a plan in words: the day now and the day after, and the lien dates that move with it. Those are the months the notice names, the notice day, the affidavit day and the suit day.',
    'The window’s rules hold. A day after today, or earlier than the clock hours, is refused. A reason is required. A day far past the clock hours is held until the person who knows the day has confirmed it.',
    'Clock hours and pay are never touched, and no notice or affidavit is drafted or sent. The job’s record shows the dev as who set the day, so this is for a day and a reason a person gave in their own words.',
  ],
}

export default note
