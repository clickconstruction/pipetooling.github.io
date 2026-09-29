import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4168',
  date: '2026-09-30',
  title: 'Pipeline Billed rows: the bill’s dates in one block — a numbered track over a ledger',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary'],
  highlights: [
    'Under the money legend, every Billed and Collections row now ends with one block: a short track from the day we billed, with numbered markers, and a ledger under it that names each number — ① Billed Sep 23 · 7 d ago, ② Expected Oct 4 · 1 d past, ③ Send the notice by Oct 15 · 16 d, ④ Lien by Nov 16 · 48 d. The right column always says how far from today.',
    'The row that asks for something is the bold one — Send the notice, or File the lien when the money lands after the window closes. When nothing is asked, a green line says how much room there is after they pay.',
    'Click the Expected row to record what the customer said; a promise replaces it as They said Oct 3, with the estimate as a quiet line under it. Every deadline row opens the job’s Lien window.',
    'The words under the bar are gone on Billed rows — the block tells the whole story — and the customer’s pay history sits under the Expected row.',
  ],
}

export default note
