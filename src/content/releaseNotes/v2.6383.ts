import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6383',
  date: '2026-11-02',
  title: 'Lien desk: the owner’s call closes the courtesy notice after letter two too',
  kind: 'fix',
  highlights: [
    'Once letter two had gone out or was in the run, an owner’s call recorded on the first packet no longer closed the courtesy notice: Do now kept an amber Send a courtesy notice row and the footer kept its door. The call now closes it whatever letter two’s state, and the footer says “owner called Oct 28”.',
    'The courtesy sentence under a sent notice names letter two as it stands, “letter two sent Oct 24 · unresponsive”, instead of saying it is still to come from day 10.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
