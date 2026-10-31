import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6233',
  date: '2026-10-31',
  title: 'Hand a law firm’s counties to another firm, and retire it as its own step',
  kind: 'feature',
  highlights: [
    'In a collections law firm’s window, a dev presses Hand off counties. Pick the counties that move and the firm that takes them, one that stands or a new one typed right there.',
    'Before the press, the sheet says what happens: where new releases go, what the firm keeps, and which accounts read the new firm. The firm you pick becomes first call there. Accounts already with a firm never move.',
    'Retire this firm is its own step at the bottom of the window. It waits, and says why, while the firm covers a county, holds an account, or is the only firm. A firm that covers no county keeps Replace with a new firm.',
    'While no county is colored and one firm stands, the desk’s Map says that firm takes every account, instead of marking every case red.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
