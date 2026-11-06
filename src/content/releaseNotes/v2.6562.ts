import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6562',
  date: '2026-11-06',
  title: 'The Day tab’s time chips read in dark mode',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'superintendent'],
  highlights: [
    'On the Schedule page’s Day tab, the orange time chip beside each stop, 8a–10a, reads in dark mode: its fill and its words are a token pair that darkens together, so the words stay apart from the fill. It had turned pale on pale.',
  ],
}

export default note
