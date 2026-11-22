import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8285',
  date: '2026-11-22',
  title: 'A new phone layout to try: smaller bars, and every press still on the screen',
  kind: 'feature',
  highlights: [
    'Leaders and devs have a new tick on a phone: gear menu, Show, New phone layout. It is a trial, it is off until you tick it, and it belongs to the phone you tick it on.',
    'With it on, the top bar is one row with the page’s name, Search, the green phone and the gear. Every other icon is a named row at the top of the gear menu and opens what it opened.',
    'In Job Mode the day’s presses share one row above the tabs, and the Home Screen offer is one quiet row on the Dashboard. On a helper’s Dashboard the bars take 170 px of the screen where they took about 300.',
    'With the tick off, and on every computer, nothing changes for anyone.',
  ],
}

export default note
