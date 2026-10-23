import { LIEN_RELEASE_DOCUMENTS_BUCKET } from './lienReleaseDocuments'
import { lienFieldsHash, type LienPenWitnessHow } from './lienNoticeSignature'
import { penPageFileProblem, penPagePath, penWitnessHowWithPage } from './lienPenRecord'
import { validateReportSignatureDataUrlForSubmit } from '../reportSignatureField'
import { trimSignatureInk } from '../signatureInkTrim'
import { supabase } from '../supabase'
import { isMissingRpcError } from '../customers/customersListBundle'
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

/**
 * Recording a pen signature (the pen train, PR 2): the leader signed the paper as printed with a
 * pen, and the signed-in office user writes it down — who signed, the day, how they know, and the
 * signed page when they have it (a photo or scan, stored best-effort beside the drawn signatures;
 * the row is the record either way). The guard (migration 20261013100000) holds the recorder to
 * the signed-in user and asks for the witness word. The draft's hash binds the record to the paper
 * as printed, so an edit after it reads as unsigned, like the electronic ones.
 */
export type RecordLienPenSignatureArgs = {
  itemId: string
  /** The row's `fields` as saved; its hash binds the record to the paper as printed. */
  fields: unknown
  /** The leader whose signature is on the paper. */
  signer: { userId: string | null; printedName: string }
  /** The signed-in office user writing it down. */
  recordedBy: { userId: string | null; name: string | null }
  how: LienPenWitnessHow
  /** The instant the row keeps for the signing day (`penSignedAtIso`). */
  signedAtIso: string
  /** The signed page, when the office has it. */
  page: { blob: Blob; type: string } | null
}

/** Yes, I signed it (the pen train, PR 3): the leader's own confirmation of a pen record, from his own sign-in; the guard refuses anyone else's. */
export async function confirmLienPenSignature(itemId: string): Promise<void> {
  await withSupabaseRetry(() => supabase.from('job_lien_desk_items').update({ signed_leader_confirmed_at: new Date().toISOString() } as never).eq('id', itemId), 'lien desk: confirm a pen signature')
}

/** Not what I signed (the pen train, PR 3): the leader disowns a pen record; the ten signature columns clear, the approval stands, and the run holds the notice until it is signed again. */
export async function disownLienPenSignature(itemId: string): Promise<void> {
  const { LIEN_DESK_SIGNATURE_CLEAR } = await import('./lienNoticeSignature')
  await withSupabaseRetry(() => supabase.from('job_lien_desk_items').update({ ...LIEN_DESK_SIGNATURE_CLEAR } as never).eq('id', itemId), 'lien desk: disown a pen signature')
}

export type RecordLienPenSignatureResult ={ ok: true; signedAtIso: string; how: LienPenWitnessHow; pagePath: string | null } | { ok: false; message: string }

export async function recordLienPenSignature(args: RecordLienPenSignatureArgs): Promise<RecordLienPenSignatureResult> {
  const { itemId, fields, signer, recordedBy, signedAtIso } = args
  const printedName = signer.printedName.trim()
  if (!printedName) return { ok: false, message: 'There is no leader to name. Set the job’s master first.' }
  if (!signer.userId) return { ok: false, message: 'The leader has no account to name. Set the job’s master first.' }
  let pagePath: string | null = null
  if (args.page) {
    const problem = penPageFileProblem({ type: args.page.type, size: args.page.blob.size })
    if (problem) return { ok: false, message: problem }
    try {
      const path = penPagePath(itemId, crypto.randomUUID(), args.page.type)
      const { error } = await supabase.storage.from(LIEN_RELEASE_DOCUMENTS_BUCKET).upload(path, args.page.blob, { contentType: args.page.type })
      if (!error) pagePath = path
    } catch {
      /* the row below is the record of it; the page is the proof when it lands */
    }
  }
  const how = penWitnessHowWithPage(args.how, pagePath != null)
  const fieldsHash = lienFieldsHash(JSON.parse(JSON.stringify(fields ?? null)))
  const patch = {
    signed_at: signedAtIso,
    signed_by: signer.userId,
    signed_on_device_of: null,
    signer_printed_name: printedName,
    signer_signature_mode: 'pen',
    signer_signature_storage_path: pagePath,
    signed_fields_hash: fieldsHash,
    signed_recorded_by: recordedBy.userId,
    signed_witness_how: how,
    signed_leader_confirmed_at: null,
  }
  try {
    await withSupabaseRetry(() => supabase.from('job_lien_desk_items').update(patch as never).eq('id', itemId), 'lien desk: record a pen signature')
  } catch (e) {
    return { ok: false, message: e instanceof Error && e.message ? e.message : 'Could not record the pen signature — nothing was saved. Try again.' }
  }
  // Tell the leader (the pen train, PR 3): his phone gets one line, or the same words by email. Best effort; the record stands either way.
  try {
    await supabase.functions.invoke('notify-lien-approval', { body: { item_id: itemId, kind: 'pen_recorded' } })
  } catch {
    /* the desk's Signed by pen, as recorded group tells him too */
  }
  return { ok: true, signedAtIso, how, pagePath }
}

/**
 * The leader's signing code (v2.5788, punch list #150): a 4-to-6-digit code he sets himself under
 * Settings → Your account and types on any screen to put his name on a notice. The database holds only
 * a salted hash and checks it inside `sign_lien_desk_item_with_code` (migration 20261023150000); the
 * office never sees the code. Five wrong codes lock it for fifteen minutes. The answer says why a
 * press did not sign, in words the desk shows as they are.
 */
export type LienSignCodeStatus = { set: boolean; setAtIso: string | null; lastUsedAtIso: string | null; lockedUntilIso: string | null }

/** Whether a leader has a code and whether it is locked; `null` when the database side is not live yet. */
export async function lienSignCodeStatus(userId: string): Promise<LienSignCodeStatus | null> {
  const { data, error } = await supabase.rpc('lien_sign_code_status' as never, { p_user_id: userId } as never)
  if (error) {
    if (isMissingRpcError(error.message)) return null
    throw new Error(error.message)
  }
  const d = (data ?? {}) as { set?: boolean; set_at?: string | null; last_used_at?: string | null; locked_until?: string | null }
  return { set: Boolean(d.set), setAtIso: d.set_at ?? null, lastUsedAtIso: d.last_used_at ?? null, lockedUntilIso: d.locked_until ?? null }
}

/** A code is 4 to 6 digits, nothing else. */
export const LIEN_SIGN_CODE_RE = /^[0-9]{4,6}$/

/** Why a typed code is not yet a code: the sentence the card shows under the field, or null when it is one. */
export function lienSignCodeProblem(code: string, confirm?: string): string | null {
  if (!LIEN_SIGN_CODE_RE.test(code)) return code.length === 0 ? null : code.length < 4 ? 'Four to six digits.' : code.length > 6 ? 'Six digits at most.' : 'Digits only.'
  if (confirm !== undefined && confirm !== code) return confirm.length === 0 ? null : 'The two codes differ.'
  return null
}

/** Sets or changes the signed-in leader's own code (the database refuses anyone who is not a master or dev). */
export async function setLienSignCode(code: string): Promise<void> {
  const { error } = await supabase.rpc('set_lien_sign_code' as never, { p_code: code } as never)
  if (error) throw new Error(error.message)
}

/** Removes the signed-in leader's own code; the desk then offers his hand or his phone instead. */
export async function clearLienSignCode(): Promise<void> {
  const { error } = await supabase.rpc('clear_lien_sign_code' as never, {} as never)
  if (error) throw new Error(error.message)
}

export type SignLienDeskItemWithCodeArgs = {
  itemId: string
  /** The row's `fields` as saved; its hash binds the mark to this draft, as the press does. */
  fields: unknown
  /** The job's master, whose code it is. */
  signerUserId: string
  code: string
  /** Approve in the same write (the desk's Sign and approve ▸); false for a sign-only press on a notice already approved on his word. */
  approve: boolean
}

export type SignLienDeskItemWithCodeResult =
  | { ok: true; signedAtIso: string; printedName: string }
  | { ok: false; reason: 'format' | 'none' | 'wrong' | 'locked' | 'not_live' | 'error'; message: string; triesLeft: number | null; lockedUntilIso: string | null }

/** Signs (and approves) a notice with the leader's code on this screen: one RPC, the database checks the code and writes the row. */
export async function signLienDeskItemWithCode(args: SignLienDeskItemWithCodeArgs): Promise<SignLienDeskItemWithCodeResult> {
  const fieldsHash = lienFieldsHash(JSON.parse(JSON.stringify(args.fields ?? null)))
  const { data, error } = await supabase.rpc('sign_lien_desk_item_with_code' as never, { p_item_id: args.itemId, p_signer_id: args.signerUserId, p_code: args.code, p_fields_hash: fieldsHash, p_approve: args.approve } as never)
  if (error) {
    if (isMissingRpcError(error.message)) return { ok: false, reason: 'not_live', message: 'Signing by code is not switched on yet — the database side ships with the next migration push.', triesLeft: null, lockedUntilIso: null }
    return { ok: false, reason: 'error', message: error.message, triesLeft: null, lockedUntilIso: null }
  }
  const d = (data ?? {}) as { ok?: boolean; signed_at?: string; printed_name?: string; reason?: string; message?: string; tries_left?: number; locked_until?: string | null }
  if (d.ok) {
    // Tell him his code was used (v2.5791): one line on his phone, or the same words by email; the function says nothing when it was his own screen. Best effort; the record stands either way.
    try {
      await supabase.functions.invoke('notify-lien-approval', { body: { item_id: args.itemId, kind: 'code_used' } })
    } catch {
      /* the desk's Signed with your code group tells him too */
    }
    return { ok: true, signedAtIso: d.signed_at ?? new Date().toISOString(), printedName: d.printed_name ?? '' }
  }
  const reason = d.reason === 'format' || d.reason === 'none' || d.reason === 'wrong' || d.reason === 'locked' ? d.reason : 'error'
  return { ok: false, reason, message: d.message ?? 'The code did not sign it.', triesLeft: typeof d.tries_left === 'number' ? d.tries_left : null, lockedUntilIso: d.locked_until ?? null }
}
