import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3977',
  date: '2026-09-27',
  title: 'Settings: every contract a customer signs, side by side',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Settings has a new tab, Contracts & terms. It shows every contract a customer accepts or signs — the estimate terms, the bid terms and exclusions, the job service agreement, the signing sentences and the electronic-signature consent — with the wording as it stands today.',
    'Press Compare on two or three cards to read them side by side.',
    'Each card says whose wording it is (yours, the built-in, or nothing set), where it is kept, and whether a customer’s own copy is kept. Its door opens the one place that wording is edited; the job service agreement’s terms open right on the card.',
    'Each card opens the pages that carry it on What customers see, and each step there now lists the wording on it.',
  ],
}

export default note
