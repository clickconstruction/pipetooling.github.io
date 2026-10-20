import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5245',
  date: '2026-10-11',
  title: 'The Bridge: set the missing percents from the page',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A strip under the stage cards counts the open jobs with a contract and no percent, the work the Build card reads as half done and draws grey.',
    'Press Set the %s for the list, biggest contract first. Set on a row opens the same percent window the crews use, and saving files a status report on the job.',
    'The Build card’s grey shrinks as you go, without a reload. When every open job with a contract has a percent, the strip says so.',
    'The Fix the reading chip now says its jobs were worked this window, so its count no longer seems to disagree with the strip.',
  ],
}

export default note
