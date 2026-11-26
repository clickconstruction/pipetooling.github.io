import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8630',
  date: '2026-11-26',
  title: 'The Bridge’s step tile says what growth waits on and what cash waits on',
  kind: 'feature',
  highlights: [
    'Under the narrowest step’s name, the tile now has two lines. The first says what growth waits on: that step, with what it moves a week and what the field builds. The second says what cash waits on: Collect, with what customers pay a week of what the office bills.',
    'When Collect is itself the narrowest step, one line says growth and cash both wait on it.',
    'When Market or Sales is the narrowest step, the card What to do now says its pace and the field’s under the pile, and proposes that step’s moves.',
    'The Monday email shows the same two lines. The guide Read the Bridge says the rule in plain words.',
  ],
}

export default note
