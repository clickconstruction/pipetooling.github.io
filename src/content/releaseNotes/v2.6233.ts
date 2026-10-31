import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6233',
  date: '2026-10-31',
  title: 'Hand a law firm’s counties to another firm, and retire it as its own step',
  kind: 'feature',
  highlights: [
    'In a collections law firm’s window, a dev presses Hand off counties. Pick the counties that move and the firm that takes them, one that stands or a new one typed right there.',
    'Before the press, the sheet says what happens: where new releases go, what the firm keeps, which accounts stay with it, and which accounts in review read the new firm. The firm you pick becomes first call in those counties.',
    'Accounts already with a firm never move. With every county handed off and no account left, the same sheet can retire the firm too.',
    'Retire this firm is now its own step at the bottom of the window. It waits, and says why, while the firm covers a county, holds an account, or is the only firm. A firm that covers no county keeps Replace with a new firm.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
