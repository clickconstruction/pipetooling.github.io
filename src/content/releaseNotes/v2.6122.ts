import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6122',
  date: '2026-10-30',
  title: 'Every button that cannot be pressed yet still reads',
  kind: 'fix',
  highlights: [
    'A button that could not be pressed yet, or was busy saving, dimmed to a grey its white words barely showed on. It now takes the same soft grey with dark words the first few got.',
    'That covers 151 Save, Send, Delete, Add and Apply buttons in windows across Jobs, Bids, People, Pay, Settings and the Dashboard.',
    'In dark mode they dim with the card instead of sitting on it as a light slab.',
    'Nothing else about these buttons changed.',
  ],
}

export default note
