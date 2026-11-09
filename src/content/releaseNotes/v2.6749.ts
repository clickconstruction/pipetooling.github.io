import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6749',
  date: '2026-11-08',
  title: 'Trade partners: Remove from the bench on a company with no history',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'A company with no quote, no ask, no work order and no contact logged now has Remove from the bench… under its address on Trade partners. A window asks first, and its button reads Remove from the bench.',
    'A company with any history shows no Remove press and stays on the bench. Its ask keeps Will not do it and Cannot do it.',
    'A sub that came from Prospects goes back on the Subs lane with a note on its card, its calls still on it.',
    'The remove refuses in words when the company has history the screen did not show, so a stale page never takes a company that was just asked.',
  ],
}

export default note
