import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6133',
  date: '2026-10-30',
  title: 'The training drawings and the Sales bar read in dark mode',
  kind: 'fix',
  highlights: [
    'In dark mode the drawings in the Training courses drew their green, red, amber and blue words in light-mode inks, so many read dark on the dark page. They now take the theme’s colours, light on dark, and look the same as before in light mode.',
    'The arrows, ticks and outlines beside those words follow, so each drawing keeps one set of colours. Colours that show a real thing stay as they are: the copper pipe’s print, the dig flags, the safety signs, the STOP paddle and the red rope.',
    'On the Bridge, the dollars on the bar in the Sales card’s Break it down window now draw in white on the green and the red, and in a dark ink on the amber, so they read in both themes.',
    'No word changed, only colours.',
  ],
}

export default note
