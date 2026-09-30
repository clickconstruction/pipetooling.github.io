import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4205',
  date: '2026-09-29',
  title: 'Pipeline Billed rows: the dates block is rows and one bold line — one deadline at a time',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary'],
  highlights: [
    'The time bar and the line over it are gone. Under Left on Job a Billed row now reads as rows alone — Billed, Expected (or They said), and one deadline — with how far from today on the right.',
    'One deadline at a time: on a job under a GC the row is Lien notice by Nov 16 until the § 53.056 notice is recorded in the Lien window, then it becomes Lien by Dec 15 with “notice sent” under it. A job we contracted with the owner shows Lien by from the start.',
    'The bold line under the hairline appears only when it says something the rows do not: Can run late · 72 d (how much later than expected the money can land before the deadline), Notice first or File the lien first · 5 d short, Ask for a date · 12 d past, or Lien gone. When the deadline row is itself the thing to do it is bold, and nothing repeats it.',
    'Clicks are unchanged: Expected opens They said…, the deadline row and the bold line open the Lien window, and Ask for a date opens They said….',
  ],
}

export default note
