/**
 * GC mode, the real build, the Building lane's U6d: what the Closeout window sends (migration 20261010041000, the
 * Building lane's U6c). A final pay application that came by email or on paper carries only the trade's words: the
 * database works its money out as the retainage held (`gc_final_pay_app_ask`). A change the trade signed on paper
 * carries the file it came as. The plan: to-dos/gc-mode/mockups/building-u6.md on branch spike/gc-mode.
 */
import { drawCameInDraft, type DrawCameIn } from './drawRows'
import type { Partner, Sow } from './types'

/** A final pay application that came by email or on paper, as the window gives it: the trade's words, typed by the office. */
export type FinalCameIn = Omit<DrawCameIn, 'lines'>

/** Where the final's form starts: the words of their newest pay application, or what their company has on file. */
export function finalCameInDraft(packageId: string, sow: Sow, partner: Partner): FinalCameIn {
  const d = drawCameInDraft(packageId, sow, partner)
  return {
    packageId: d.packageId,
    periodTo: '',
    address: d.address,
    license: d.license,
    signedBy: d.signedBy,
    signedTitle: d.signedTitle,
    fileName: '',
    driveUrl: '',
  }
}

/** What the form still needs before it can be recorded, in the words the window shows. Null: nothing. */
export function finalCameInMissing(d: FinalCameIn): string | null {
  if (d.periodTo === '') return 'Say the day it runs to first.'
  if (d.signedBy.trim() === '') return 'Say who signed it first.'
  return null
}

/** What `gc_final_pay_app_came_in` takes: the words trimmed, the file and its link only when given. */
export function finalCameInPayload(d: FinalCameIn): {
  periodTo: string
  address: string
  license: string
  signedBy: string
  signedTitle: string
  fileName?: string
  driveUrl?: string
} {
  const file = d.fileName.trim()
  const link = d.driveUrl.trim()
  return {
    periodTo: d.periodTo,
    address: d.address.trim(),
    license: d.license.trim(),
    signedBy: d.signedBy.trim(),
    signedTitle: d.signedTitle.trim(),
    ...(file ? { fileName: file } : {}),
    ...(link ? { driveUrl: link } : {}),
  }
}

/** The file a change the trade signed came as, both optional. */
export interface SignedFile {
  fileName: string
  driveUrl: string
}

/** What `gc_trade_change_signed_in` takes beside the change order: the file and its link, each only when given. */
export function signedFileArgs(f: SignedFile): { p_file_name?: string; p_drive_url?: string } {
  const file = f.fileName.trim()
  const link = f.driveUrl.trim()
  return { ...(file ? { p_file_name: file } : {}), ...(link ? { p_drive_url: link } : {}) }
}
