/**
 * A supply house bill's own PDF, handed to the app's viewer (punch list #431, PR 2). The office pastes a Drive link on
 * a bill's row, and the bills sit in one folder of an office login's My Drive that is shared with the app's service
 * account as a viewer (punch list #298, step 0). `drive-link` reads the file as that account so the viewer can draw it
 * with no Google sign-in. The rules here are pure; `drive-link` holds the calls.
 *
 * Two fences, in this order:
 * - The bill's row is read as the caller, under the caller's own policy on `supply_house_invoices`. A row they may not
 *   read is no row, so nobody opens a bill here that the app would not show them.
 * - The file must sit inside the bills folder. A bill's link is a field the office types, and the service account can
 *   read files the office cannot (a person's HR file, a matter's papers). Without this fence a pasted link would turn
 *   the door into a way to read any of them. The folder is known by its id when the secret `BILLS_DRIVE_FOLDER_ID` is
 *   set, and else by its name, `_Bills`, outside any Shared Drive. Nobody can put a file they cannot already open
 *   under a folder of that name, so the name is a fence and not a hint.
 */

/** The ask, as `drive-link` reads it off the body. */
export type BillReadAsk = { action: 'read_bill'; invoiceId: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Whether the body asks for this door at all, whatever else it holds. */
export function isBillReadAction(body: unknown): boolean {
  return (body as { action?: unknown } | null)?.action === 'read_bill'
}

/** The ask, or null when it is not one this door takes. */
export function parseBillReadAsk(body: unknown): BillReadAsk | null {
  const b = (body ?? {}) as { action?: unknown; invoiceId?: unknown }
  if (b.action !== 'read_bill') return null
  if (typeof b.invoiceId !== 'string' || !UUID.test(b.invoiceId)) return null
  return { action: 'read_bill', invoiceId: b.invoiceId }
}

/** Why the door hands no bytes over, as a code the viewer reads. */
export type BillFileWhy = 'not_yours' | 'no_file' | 'gone' | 'not_a_bill_file' | 'trashed' | 'no_bytes' | 'too_big' | 'unanswered' | 'unread'

/** The door's own sentences. Each is one idea, as a first-timer reads it. */
export const BILL_FILE_WORDS = {
  notAnAsk: 'That is not a bill this door can open. It takes one bill.',
  not_yours: 'That bill is not one you can open.',
  no_file: 'This bill has no PDF on its row.',
  gone: 'Drive no longer has that file, or it is not shared with the app.',
  not_a_bill_file: 'That file is not in the bills folder, so the app does not open it here.',
  trashed: 'That file is in Drive’s trash.',
  no_bytes: 'That is a Google document or a folder, not a file with pages.',
  too_big: 'That file is over 30 MB.',
  unanswered: 'Drive did not hand that file over.',
  unread: 'The bill did not read. Try again.',
} as const satisfies Record<BillFileWhy | 'notAnAsk', string>

/** The bills folder's name, as the owner named it on 2026-11-10 so it sorts first. */
export const BILLS_FOLDER_NAME = '_Bills'

/** How many folders up the door looks for the bills folder. */
export const BILL_FOLDER_LEVELS = 6

/** What Drive says of one file or folder: its name, the folder it sits in, and the Shared Drive it is in, if any. */
export interface DriveStep {
  name: string
  parent: string | null
  driveId: string | null
}

/** Whether a folder is the bills folder: the configured id when there is one, else the name outside any Shared Drive. */
export function isBillsFolder(id: string, step: DriveStep, configuredId: string | null): boolean {
  const configured = (configuredId ?? '').trim()
  if (configured) return id === configured
  return step.name === BILLS_FOLDER_NAME && !step.driveId
}

/**
 * Whether a Drive file sits inside the bills folder, a few levels up. `stepOf` answers one file or folder, and null
 * when Drive will not show it. `seen` is the folders' names on the way up, which the door hands to a dev alone when it
 * refuses, so a renamed folder can be told from a stray file.
 */
export async function insideBillsFolder(
  fileId: string,
  stepOf: (id: string) => Promise<DriveStep | null>,
  configuredId: string | null,
): Promise<{ inside: boolean; gone: boolean; seen: string[] }> {
  const seen: string[] = []
  const file = await stepOf(fileId)
  if (!file) return { inside: false, gone: true, seen }
  let parent = file.parent
  for (let i = 0; i < BILL_FOLDER_LEVELS && parent; i += 1) {
    const folder = await stepOf(parent)
    if (!folder) break
    seen.push(folder.name)
    if (isBillsFolder(parent, folder, configuredId)) return { inside: true, gone: false, seen }
    parent = folder.parent
  }
  return { inside: false, gone: false, seen }
}
