import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7446',
  date: '2026-11-16',
  title: 'Lien desk: an open notice fits its pane in a small window',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'An open monthly notice no longer slides sideways in a 1,024 px window. A notice with a pay codes page was 51 px wider than its pane, so the Steps and Windows switch and each section head were cut at the right.',
    'A section head or a page bar with long words now ends in an ellipsis, and hovering it shows the whole line. Open and PDF stay whole at the bar’s right end.',
    'In a narrow pane the supply houses table stacks its rows as it does on a phone, so its amounts no longer run into each other. The approved chip in the signing section wraps instead of leaving the pane.',
    'A page of the paper and the months grid slide inside their own frames when the pane is too narrow for them. The affidavit and retainage panes are held the same way.',
  ],
}

export default note
