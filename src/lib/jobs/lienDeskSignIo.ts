import { LIEN_RELEASE_DOCUMENTS_BUCKET } from './lienReleaseDocuments'
import { lienFieldsHash } from './lienNoticeSignature'
import { validateReportSignatureDataUrlForSubmit } from '../reportSignatureField'
import { trimSignatureInk } from '../signatureInkTrim'
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'

/**
 * Signing a lien notice (v2.5082, lien desk signing PR 2): the one write behind Sign and approve ▸
 * on the desk and the phone card, Sign ▸ on a notice approved on the leader's word, and Put a GC
 * on notice's Sign and approve all. One press under his own sign-in places his name in the cursive
 * face (`type`): no image is stored, the row is the signature. He may draw instead (`draw`): the
 * PNG is trimmed and stored best-effort under `desk/<item>/` in the release bucket, the row stamp
 * stays the record. The hash of the draft's `fields` is saved with the mark so an edit after
 * signing reads as unsigned (`lienNoticeSignatureFromRow`).
 *
 * `onDevice` is the signed-in user when the leader signs at someone else's screen (Leader here):
 * a press there would be that user's act, not his, so only a drawing is taken — the guard
 * (migration 20261010020000) refuses anything else.
 */
export type LienDeskSignPayload = { mode: 'type' } | { mode: 'draw'; signaturePngBase64: string }

export type SignLienDeskItemArgs = {
  itemId: string
  /** The row's `fields` as saved (the draft JSON); its hash binds the mark to this draft. */
  fields: unknown
  signer: { userId: string | null; printedName: string }
  payload: LienDeskSignPayload
  /** The signed-in user when the signer is someone else at this screen; null when he signs for himself. */
  onDevice: { userId: string | null; name: string | null } | null
  /** Approve in the same write (the leader's Sign and approve ▸); false for a sign-only press on a notice already approved on his word. */
  approve: boolean
}

export type SignLienDeskItemResult = { ok: true; signedAtIso: string } | { ok: false; message: string }

export const LIEN_DESK_SIGNATURE_FOLDER = 'desk'

/** Where a drawn signature's PNG goes: `desk/<item id>/<uuid>.png` in the release bucket. */
export function lienDeskSignaturePath(itemId: string, uuid: string): string {
  return `${LIEN_DESK_SIGNATURE_FOLDER}/${itemId}/${uuid}.png`
}

export async function signLienDeskItem(args: SignLienDeskItemArgs): Promise<SignLienDeskItemResult> {
  const { itemId, fields, signer, payload, onDevice, approve } = args
  const printedName = signer.printedName.trim()
  if (!printedName) return { ok: false, message: 'There is no name to sign with. Set your name on your profile first.' }
  const present = onDevice != null
  if (present && payload.mode !== 'draw') {
    return { ok: false, message: 'Draw the signature. A press on this screen would be its sign-in’s act, not the leader’s.' }
  }
  let signaturePath: string | null = null
  if (payload.mode === 'draw') {
    const invalid = validateReportSignatureDataUrlForSubmit(payload.signaturePngBase64)
    if (invalid) return { ok: false, message: invalid }
    const ink = await trimSignatureInk(payload.signaturePngBase64)
    try {
      const path = lienDeskSignaturePath(itemId, crypto.randomUUID())
      const bytes = await (await fetch(ink)).blob()
      const { error } = await supabase.storage.from(LIEN_RELEASE_DOCUMENTS_BUCKET).upload(path, bytes, { contentType: 'image/png' })
      if (!error) signaturePath = path
    } catch {
      /* the row stamp below is the signature of record */
    }
  }
  const signedAtIso = new Date().toISOString()
  // The draft as the row holds it: a JSON round trip drops `undefined` the way the save did.
  const fieldsHash = lienFieldsHash(JSON.parse(JSON.stringify(fields ?? null)))
  const patch = {
    ...(approve ? { status: 'approved', approval_mode: 'leader' } : {}),
    signed_at: signedAtIso,
    signed_by: signer.userId,
    signed_on_device_of: present ? onDevice.userId : null,
    signer_printed_name: printedName,
    signer_signature_mode: payload.mode,
    signer_signature_storage_path: signaturePath,
    signed_fields_hash: fieldsHash,
  }
  try {
    await withSupabaseRetry(() => supabase.from('job_lien_desk_items').update(patch as never).eq('id', itemId), approve ? 'lien desk: sign and approve' : 'lien desk: sign')
  } catch (e) {
    return { ok: false, message: e instanceof Error && e.message ? e.message : 'Could not record the signature — nothing was saved. Try again.' }
  }
  return { ok: true, signedAtIso }
}
