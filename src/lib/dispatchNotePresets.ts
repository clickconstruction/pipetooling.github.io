/** Preset options for Task Dispatch inbox thread notes (Dashboard). */
export const DISPATCH_NOTE_PRESETS = [
  'Left voicemail',
  'Called — no answer',
  'Called — spoke with contact',
  'Emailed / messaged',
  'Scheduled callback',
  'Needs follow-up',
  'Assigned / in progress',
  'Waiting on customer',
  'Waiting on vendor or GC',
  'Resolved — no further action',
] as const

export type DispatchNotePreset = (typeof DISPATCH_NOTE_PRESETS)[number]
