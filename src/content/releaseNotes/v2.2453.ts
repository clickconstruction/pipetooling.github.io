import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2453',
  date: '2026-08-28',
  title: 'Prospect List: sections that follow the pipeline, not warmth',
  kind: 'feature',
  highlights: [
    'The list now groups by where each prospect actually is: Never called, Recently contacted (30 days), Going cold (30–90), Cold (90+), then Converted / Can\'t reach / No longer a fit — instead of warmth sections that put almost every prospect in one giant bucket.',
    'Count chips at the top show the shape of your pipeline at a glance and jump to a section when you tap one.',
    'A new Last touch column says what actually happened — "answered 3d ago", "didn\'t answer today · 01:05 on the phone", "noted 12d ago" — replacing the mostly-empty Time column.',
    'Warmth shows as a small 🔥 chip beside the company name when it\'s above zero, and every active row gets a Call now → shortcut into the calling workstation.',
  ],
}

export default note
