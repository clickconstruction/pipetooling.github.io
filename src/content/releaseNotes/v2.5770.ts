import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5770',
  date: '2026-10-23',
  title: 'Pipeline: the owner-sees pill is a small eye with a card on hover',
  kind: 'feature',
  highlights: [
    'On a job billed to the GC whose customer is the property owner, the "☐ owner sees $0" pill beside the owner\'s 🌐 is now a small eye: crossed when their page shows none of the bills, open when it shows them, hollow when it shows some.',
    'The eye is grey while no bill is out and turns amber the moment open bills exist that the owner cannot see, so the case worth a glance stays visible at a fraction of the width.',
    'Hover or focus the eye and a card says what the owner\'s page shows, why, what is open, and offers Show them or Stop showing. A click opens the switch\'s window as before, now with that line at the top.',
    'The owner\'s portal window keeps the same eye with a few words beside it on each property line.',
  ],
}

export default note
