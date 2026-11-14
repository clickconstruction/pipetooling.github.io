import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7155',
  date: '2026-11-13',
  title: 'Tasks: the window stays on screen when the keyboard comes up on an iPhone',
  kind: 'fix',
  highlights: [
    'On an iPhone, typing in a box low in the New task window, such as Done when… or a link, used to push the window off the top of the screen. The box you were typing in went with it.',
    'The window now stays put. Its title, the box you are typing in and the Send button all stay above the keyboard.',
    'Edit task and the roadmap\'s Add task are fixed the same way. It also holds with Safari\'s larger text.',
    'New task has one Send button now, the one above the keyboard. The small second Send at the top is gone.',
  ],
}

export default note
