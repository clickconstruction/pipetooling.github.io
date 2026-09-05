import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2877',
  date: '2026-09-05',
  title: 'Job Mode is on by default for subs and helpers; a one-tap card for everyone else who works in the field',
  kind: 'feature',
  highlights: [
    'Subcontractors and helpers land on the Job Mode card the first time they open the app on any phone — no more hunting for the gear-menu checkbox after a new or wiped device. Turning it off from the gear menu still sticks on that phone.',
    'Masters and superintendents see a one-time "Working in the field? Turn on Job Mode" card at the top of the Dashboard: one tap turns it on, "Not now" hides it for good. Office roles never see Job Mode unless they turn it on themselves.',
    'On the Jobs page, phones narrower than 560px start on Mobile cards instead of the desktop tables; the ⋯ menu toggle still overrides either way.',
    'The start-here guide for subs and helpers and the Job Mode guide now say Job Mode is already on and how to turn it off.',
  ],
}

export default note
