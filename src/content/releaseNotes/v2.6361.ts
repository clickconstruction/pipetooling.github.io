import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6361',
  date: '2026-11-02',
  title: 'History on the Development page: a ? that says what the marks mean',
  kind: 'feature',
  highlights: [
    'Open a development and press the round ? beside the History search box. A window lists every mark a line can wear, grouped under the chip that narrows to it, with its name and one line on what it records.',
    'Grey is what a person wrote, blue a move on a record, green money and a yes, red a no, amber what went out or came in.',
    'The feed and the legend read one table, so the marks on the list and the words in the window never disagree.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
