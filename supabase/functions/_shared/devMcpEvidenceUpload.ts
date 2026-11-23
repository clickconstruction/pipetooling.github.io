/**
 * A file declared on plan_person_evidence, not sent (dev-mcp 0.129.0). A file sent as content_base64 rides inside the
 * tool call, so it passes through the agent's own output and through this function's JSON body: past a few megabytes
 * neither holds. A declared file is named by what it is — its name, its size and its sha256 — and its bytes go from
 * the agent's machine straight to the private hr-files bucket, to an address the plan hands back for that one file.
 * The apply then reads the object, checks it against the plan, and only then writes the record.
 *
 * Nothing is kept between the plan and the apply: the record's id and each declared file's id are worked out from the
 * plan's own hash, so the same plan always answers the same paths and an apply finds what the upload put there.
 *
 * Pure: no fetch and no Deno here, so the rules are tested as they run (src/lib/devMcp/devMcpEvidenceUpload.test.ts).
 */

/** How long storage keeps an upload address open. A plan run again answers a fresh one for the same path. */
export const EVIDENCE_UPLOAD_ADDRESS_HOURS = 2

const HASH_RE = /^[0-9a-f]{64}$/

export type DeclaredFile = { name: string; mime: string; size_bytes: number; sha256: string }
export type DeclaredInput = { ok: true; sizeBytes: number; sha256: string } | { ok: false; error: string }

/** A declared file's own facts, held to the cap: `{ name, staged: true, size_bytes, sha256, mime? }`. */
export function declaredFileInput(name: string, sizeBytes: unknown, sha256: unknown, maxBytes: number): DeclaredInput {
  const mb = Math.floor(maxBytes / 1024 / 1024)
  const hash = typeof sha256 === 'string' ? sha256.trim().toLowerCase() : ''
  if (typeof sizeBytes !== 'number' || !Number.isInteger(sizeBytes) || sizeBytes < 1) {
    return { ok: false, error: `${name}: a declared file needs size_bytes, the file's size as a whole number of bytes (wc -c or stat says it).` }
  }
  if (sizeBytes > maxBytes) {
    return { ok: false, error: `${name} is ${sizeBytes} bytes; a declared file is at most ${mb} MB, the storage's own limit. Put a larger file in the person's Drive folder by hand and send it as { name, drive_url }.` }
  }
  if (!HASH_RE.test(hash)) {
    return { ok: false, error: `${name}: a declared file needs sha256, the 64 hex characters of the file's SHA-256 (shasum -a 256 says it).` }
  }
  return { ok: true, sizeBytes, sha256: hash }
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** 32 hex characters as a version-4-shaped uuid: the columns take a uuid, and the id says nothing by itself. */
function uuidOf(hex: string): string {
  const h = hex.slice(0, 32).split('')
  h[12] = '4'
  h[16] = ((parseInt(h[16]!, 16) & 0x3) | 0x8).toString(16)
  const s = h.join('')
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`
}

/**
 * The record's id and the id of the file at each place in the plan, from the plan's hash alone. A plan commits to the
 * person, the record and every file's facts, and to how many records the person has, so two plans share a hash only
 * when they are the same plan on the same state: the same upload.
 */
export async function evidenceUploadIds(planHash: string, fileCount: number): Promise<{ evidenceId: string; fileIds: string[] }> {
  const evidenceId = uuidOf(await sha256Hex(`evidence-upload:${planHash}:record`))
  const fileIds: string[] = []
  for (let i = 0; i < fileCount; i++) fileIds.push(uuidOf(await sha256Hex(`evidence-upload:${planHash}:file:${i}`)))
  return { evidenceId, fileIds }
}

const encodedPath = (path: string) => path.split('/').map(encodeURIComponent).join('/')

/** Storage's door that hands out an upload address for one path (POST, as the dev). */
export function signUploadEndpoint(supabaseUrl: string, bucket: string, path: string): string {
  return `${supabaseUrl}/storage/v1/object/upload/sign/${bucket}/${encodedPath(path)}`
}

/** The object as the dev reads it back (GET). */
export function stagedObjectEndpoint(supabaseUrl: string, bucket: string, path: string): string {
  return `${supabaseUrl}/storage/v1/object/authenticated/${bucket}/${encodedPath(path)}`
}

/**
 * The address the bytes are PUT to, from storage's answer to the sign call: it answers `url`, a path under /storage/v1
 * that carries the ticket in its query, and older builds answer the ticket alone. Null when it answered neither.
 */
export function uploadAddress(supabaseUrl: string, bucket: string, path: string, answer: unknown): string | null {
  const a = answer && typeof answer === 'object' ? (answer as Record<string, unknown>) : {}
  if (typeof a.url === 'string' && a.url.startsWith('/')) return `${supabaseUrl}/storage/v1${a.url}`
  const ticket = typeof a.token === 'string' ? a.token : ''
  return ticket ? `${signUploadEndpoint(supabaseUrl, bucket, path)}?token=${encodeURIComponent(ticket)}` : null
}

/** Storage refuses an address for a path that already holds an object: the upload was made already. */
export function alreadyThere(status: number, answer: unknown): boolean {
  const text = JSON.stringify(answer ?? '').toLowerCase()
  return status === 409 || text.includes('already exists') || text.includes('duplicate')
}

const shellQuote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`

/** The one command that sends a declared file: its bytes go from the machine to storage and through nothing else. */
export function uploadCommand(name: string, mime: string, address: string): string {
  return `curl -sS --fail-with-body -X PUT -H ${shellQuote(`Content-Type: ${mime}`)} -T ${shellQuote(name)} ${shellQuote(address)}`
}

export type UploadSlot = DeclaredFile & { path: string } & ({ state: 'waiting'; address: string } | { state: 'in_place' } | { state: 'no_address'; why: string })

/** The plan's upload block: one line a declared file, what to run for it, and what the apply will do. */
export function uploadPlanWords(slots: ReadonlyArray<UploadSlot>): Record<string, unknown> {
  const waiting = slots.filter((s) => s.state === 'waiting').length
  const held = slots.filter((s) => s.state === 'no_address').length
  return {
    how:
      waiting > 0
        ? `Send each waiting file with its own command, run from the folder that holds it (or put the file's full path after -T). The bytes go from your machine to the private bucket and through nothing else. Then call apply_person_evidence with this same evidence and this plan_hash: it reads each file back, checks its size and sha256 against this plan, and writes the record only when every one matches.`
        : held > 0
          ? 'No upload address could be made for a file below; its why says what storage answered. Nothing was stored.'
          : 'Every declared file is already in place under this plan. Call apply_person_evidence with this same evidence and this plan_hash: it checks each file against this plan before it writes.',
    address_lasts: `${EVIDENCE_UPLOAD_ADDRESS_HOURS} hours, and takes one upload of that one file. This plan run again answers a fresh address for the same path, as long as nothing on the person's file moved in between.`,
    keep_it_here: 'An address lets its holder put one file at one path until it runs out. Use it in your shell and nowhere else: not in a file, a note, a commit or a message.',
    if_you_stop: 'A file sent and never applied stays in the bucket at its path below, read by nothing. The same plan applied later still finds it.',
    files: slots.map((s) => ({
      name: s.name,
      mime: s.mime,
      size_bytes: s.size_bytes,
      sha256: s.sha256,
      path: s.path,
      state: s.state === 'waiting' ? 'waiting for its bytes' : s.state === 'in_place' ? 'already in place' : 'no address',
      ...(s.state === 'waiting' ? { send_to: s.address, run: uploadCommand(s.name, s.mime, s.address) } : {}),
      ...(s.state === 'no_address' ? { why: s.why } : {}),
    })),
  }
}

/** What the apply found at a declared file's path, against what the plan said: null when it is the planned file. */
export function stagedProblem(file: DeclaredFile, got: { size: number; sha256: string } | null): string | null {
  if (!got) return `${file.name} is not in the bucket yet. Run its upload command from the plan (plan again for a fresh address), then apply.`
  if (got.size !== file.size_bytes) return `${file.name}: the file sent is ${got.size} bytes and the plan says ${file.size_bytes}. It is not the planned file.`
  if (got.sha256 !== file.sha256) return `${file.name}: the file sent has sha256 ${got.sha256.slice(0, 12)}… and the plan says ${file.sha256.slice(0, 12)}…. It is not the planned file.`
  return null
}
