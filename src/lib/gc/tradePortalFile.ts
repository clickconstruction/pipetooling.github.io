/**
 * GC mode, the trade partner portal's P5a-1 (to-dos/gc-mode/mockups/portal-p5a.md): a file the company picks, as the
 * page holds it and sends it. `GcTradePortalFile.tsx` draws the picker; `usePress().runWithFile` sends the kind `file`
 * these fields make before the kind that stores the link.
 */

/** A file picked: its name, and its bytes as base64 for the kind `file`. */
export interface PickedFile {
  name: string
  base64: string
}

/** What the picker takes: the types the function keeps. A phone's photo picker offers JPEG, HEIC or HEIF. */
export const PORTAL_FILE_ACCEPT = 'application/pdf,image/jpeg,image/png,image/heic,image/heif'

/** The `file` kind's fields for the company's insurance certificate (P5b-2): its own, on no job. Null when nothing is picked. */
export function portalCoiUpload(picked: PickedFile | null): Record<string, unknown> | null {
  return picked ? { for: 'coi', name: picked.name, base64: picked.base64 } : null
}

/** The `file` kind's fields for a pick: what it is for and the record, or null when nothing is picked. */
export function portalFileUpload(f: 'submittal' | 'change' | 'quote', recordId: string, picked: PickedFile | null): Record<string, unknown> | null {
  if (!picked) return null
  const field = f === 'submittal' ? 'submittalId' : f === 'change' ? 'packageId' : 'inviteId'
  return { for: f, [field]: recordId, name: picked.name, base64: picked.base64 }
}
