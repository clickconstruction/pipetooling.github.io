import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2951',
  date: '2026-09-06',
  title: 'Defaults for everyone: what a new phone starts on, and dismissed alerts that follow you',
  kind: 'feature',
  highlights: [
    'Settings → Company → Defaults for everyone (dev and master): one table for Mobile cards on Pipeline, payroll auto-apply on Tally and the Stripe mode — a value for everyone, or per field / office roles. It decides what a fresh phone or browser starts on; a device that already chose keeps its choice.',
    'Alerts you dismiss (the bulk-deletions notice, the claim-dev alert, the rejected-notification banner) are remembered on your account now, so a new phone doesn\'t raise them again.',
    'Job Mode keeps its own role default from before; nothing else changes on devices that already made their choice.',
    'New guide: "set defaults for everyone".',
  ],
}

export default note
