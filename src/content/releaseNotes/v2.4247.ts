import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4247',
  date: '2026-09-30',
  title: 'Hours someone typed wear a pencil wherever hours are approved, and an Approve all never takes them',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'A session whose times were typed, not punched, shows a pencil and who typed it — with what the day read before and after — on the Hours grid, the approvals queue, My Team, the clock strip, the day audit, the pay-week window, the sessions list and Moneyfill.',
    'An Approve all, Approve week or Approve everything button takes the punches only. Typed hours are approved one at a time; the button says how many it left.',
    'On the Hours grid the cell’s chip shows the pencil, and in its popover the typed line has its own Approve.',
    'If you typed the hours, or they are your own, the row says so in place of Approve: someone else approves them. The approvals queue has a Typed by hand filter.',
  ],
}

export default note
