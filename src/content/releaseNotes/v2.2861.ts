import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2861',
  date: '2026-09-05',
  title: 'Offline now offers Retry and notices when you are back; bid blocks on the week grid open the bid',
  kind: 'fix',
  highlights: [
    'When the app really has no connection — clocking in or out, saving a report, loading your Schedule tab — the "No connection" message now comes with a Retry button, and when your signal returns it says "Back online". Your Schedule tab reloads on its own; a clock punch or a report waits for you to tap Retry so nothing is sent twice.',
    'Retry appears only when the connection was the problem. A refused save or a broken link still says what happened, with no Retry, because trying again would not change the answer.',
    'On the Schedule week grid, clicking a bid block\'s time range used to open a broken job page. It now opens that bid on the Bids page; old links of that shape land there too.',
  ],
}

export default note
