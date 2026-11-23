import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  EVIDENCE_UPLOAD_ADDRESS_HOURS,
  alreadyThere,
  declaredFileInput,
  evidenceUploadIds,
  signUploadEndpoint,
  stagedObjectEndpoint,
  stagedProblem,
  uploadAddress,
  uploadCommand,
  uploadPlanWords,
  type DeclaredFile,
  type UploadSlot,
} from '../../../supabase/functions/_shared/devMcpEvidenceUpload'
import { EVIDENCE_FILE_MAX_BYTES, EVIDENCE_STAGED_MAX_BYTES } from '../../../supabase/functions/_shared/personEvidence'
import { writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'

/**
 * A file declared on plan_person_evidence, not sent (dev-mcp 0.130.0): the rules that say what a declared file is,
 * where its bytes go, and what the apply holds it to. The handler itself is run in devMcpEvidenceUpload.run.test.ts.
 */

const SHA = 'a'.repeat(64)
const PERSON = '11111111-1111-4111-8111-111111111111'
const HASH = 'f'.repeat(64)
const FILE: DeclaredFile = { name: 'site walk.m4a', mime: 'audio/mp4', size_bytes: 14_327_159, sha256: SHA }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('a declared file', () => {
  it('is named by a whole size and a sha256, held to the storage limit', () => {
    expect(EVIDENCE_STAGED_MAX_BYTES).toBe(50 * 1024 * 1024)
    expect(EVIDENCE_FILE_MAX_BYTES).toBe(10 * 1024 * 1024) // a file sent inside a call keeps its cap
    expect(declaredFileInput('a.m4a', 14_327_159, ` ${SHA.toUpperCase()} `, EVIDENCE_STAGED_MAX_BYTES)).toEqual({ ok: true, sizeBytes: 14_327_159, sha256: SHA })
    expect(declaredFileInput('a.m4a', EVIDENCE_STAGED_MAX_BYTES, SHA, EVIDENCE_STAGED_MAX_BYTES).ok).toBe(true)
  })

  it('is refused in words that say how to get the missing fact', () => {
    const over = declaredFileInput('a.m4a', EVIDENCE_STAGED_MAX_BYTES + 1, SHA, EVIDENCE_STAGED_MAX_BYTES)
    expect(over).toMatchObject({ ok: false })
    expect(!over.ok && over.error).toMatch(/at most 50 MB.*drive_url/)
    for (const size of [0, -1, 1.5, '12', null, undefined]) {
      const r = declaredFileInput('a.m4a', size, SHA, EVIDENCE_STAGED_MAX_BYTES)
      expect(!r.ok && r.error).toMatch(/size_bytes.*wc -c/)
    }
    for (const sha of ['', 'abc', 'z'.repeat(64), 12, null]) {
      const r = declaredFileInput('a.m4a', 10, sha, EVIDENCE_STAGED_MAX_BYTES)
      expect(!r.ok && r.error).toMatch(/sha256.*shasum -a 256/)
    }
  })

  it('rides to the database as the four facts a sent file rides as, up to the larger cap', () => {
    const evidence = { person_id: PERSON, dated_on: '2026-11-02', title: 'A recording', memo: 'What it shows.' }
    const big = writeRpcBody('plan_person_evidence', { evidence: { ...evidence, files: [{ name: FILE.name, mime: FILE.mime, size_bytes: FILE.size_bytes, sha256: SHA }] } })
    expect(big).toMatchObject({ ok: true, rpc: 'dev_person_evidence_write' })
    expect(big.ok && (big.body.p as { files: unknown[] }).files).toEqual([{ name: FILE.name, mime: FILE.mime, size_bytes: FILE.size_bytes, sha256: SHA }])
    const over = writeRpcBody('plan_person_evidence', { evidence: { ...evidence, files: [{ name: FILE.name, mime: FILE.mime, size_bytes: EVIDENCE_STAGED_MAX_BYTES + 1, sha256: SHA }] } })
    expect(over.ok).toBe(false)
    expect(!over.ok && over.error).toMatch(/staged: true, size_bytes, sha256.*each declared file at most 50 MB/)
  })
})

describe('the ids a plan and its apply share', () => {
  it('come from the plan hash alone, the same every time', async () => {
    const a = await evidenceUploadIds(HASH, 3)
    const b = await evidenceUploadIds(HASH, 3)
    expect(a).toEqual(b)
    expect(a.evidenceId).toMatch(UUID)
    expect(a.fileIds).toHaveLength(3)
    for (const id of a.fileIds) expect(id).toMatch(UUID)
    expect(new Set([a.evidenceId, ...a.fileIds]).size).toBe(4)
  })

  it('differ for another plan', async () => {
    const a = await evidenceUploadIds(HASH, 1)
    const b = await evidenceUploadIds('e'.repeat(64), 1)
    expect(a.evidenceId).not.toBe(b.evidenceId)
    expect(a.fileIds[0]).not.toBe(b.fileIds[0])
  })
})

describe('where the bytes go', () => {
  const BASE = 'https://project.example.test'
  const PATH = `${PERSON}/evidence/rec/file-site walk.m4a`

  it('asks storage for an address by the path, each part escaped', () => {
    expect(signUploadEndpoint(BASE, 'hr-files', PATH)).toBe(`${BASE}/storage/v1/object/upload/sign/hr-files/${PERSON}/evidence/rec/file-site%20walk.m4a`)
    expect(stagedObjectEndpoint(BASE, 'hr-files', PATH)).toBe(`${BASE}/storage/v1/object/authenticated/hr-files/${PERSON}/evidence/rec/file-site%20walk.m4a`)
  })

  it('reads the address from storage\'s answer, in either form it comes', () => {
    expect(uploadAddress(BASE, 'hr-files', PATH, { url: '/object/upload/sign/hr-files/p?token=tkt' })).toBe(`${BASE}/storage/v1/object/upload/sign/hr-files/p?token=tkt`)
    expect(uploadAddress(BASE, 'hr-files', PATH, { token: 'a b' })).toBe(`${signUploadEndpoint(BASE, 'hr-files', PATH)}?token=a%20b`)
    expect(uploadAddress(BASE, 'hr-files', PATH, {})).toBeNull()
    expect(uploadAddress(BASE, 'hr-files', PATH, 'nope')).toBeNull()
  })

  it('knows a path that already holds its object', () => {
    expect(alreadyThere(409, {})).toBe(true)
    expect(alreadyThere(400, { statusCode: '409', error: 'Duplicate', message: 'The resource already exists' })).toBe(true)
    expect(alreadyThere(403, { message: 'new row violates row-level security policy' })).toBe(false)
  })

  it('writes one command a file, safe for a name with a space or a quote', () => {
    expect(uploadCommand('site walk.m4a', 'audio/mp4', 'https://x.test/u?token=t')).toBe("curl -sS --fail-with-body -X PUT -H 'Content-Type: audio/mp4' -T 'site walk.m4a' 'https://x.test/u?token=t'")
    expect(uploadCommand("it's.m4a", 'audio/mp4', 'https://x.test/u')).toContain(`-T 'it'\\''s.m4a'`)
  })
})

describe('the plan\'s upload block', () => {
  const waiting: UploadSlot = { ...FILE, path: 'p/evidence/r/f-site walk.m4a', state: 'waiting', address: 'https://x.test/u?token=t' }
  const inPlace: UploadSlot = { ...FILE, name: 'two.m4a', path: 'p/evidence/r/g-two.m4a', state: 'in_place' }
  const held: UploadSlot = { ...FILE, name: 'three.m4a', path: 'p/evidence/r/h-three.m4a', state: 'no_address', why: 'Storage answered 403: no' }

  it('gives a waiting file its address and its command, and nothing to a file in place', () => {
    const words = uploadPlanWords([waiting, inPlace]) as { how: string; address_lasts: string; keep_it_here: string; if_you_stop: string; files: Array<Record<string, unknown>> }
    expect(words.how).toMatch(/Send each waiting file.*apply_person_evidence.*checks its size and sha256/)
    expect(words.address_lasts).toContain(`${EVIDENCE_UPLOAD_ADDRESS_HOURS} hours`)
    expect(words.keep_it_here).toMatch(/not in a file, a note, a commit or a message/)
    expect(words.if_you_stop).toMatch(/stays in the bucket/)
    expect(words.files[0]).toMatchObject({ name: FILE.name, size_bytes: FILE.size_bytes, sha256: SHA, state: 'waiting for its bytes', send_to: 'https://x.test/u?token=t' })
    expect(String(words.files[0]!.run)).toContain("-T 'site walk.m4a'")
    expect(words.files[1]).toMatchObject({ name: 'two.m4a', state: 'already in place' })
    expect(words.files[1]).not.toHaveProperty('send_to')
    expect(words.files[1]).not.toHaveProperty('run')
  })

  it('says when every file is already there, and when storage gave no address', () => {
    expect((uploadPlanWords([inPlace]) as { how: string }).how).toMatch(/already in place.*apply_person_evidence/)
    const none = uploadPlanWords([held]) as { how: string; files: Array<Record<string, unknown>> }
    expect(none.how).toMatch(/No upload address could be made/)
    expect(none.files[0]).toMatchObject({ state: 'no address', why: 'Storage answered 403: no' })
  })

  it('never names a key the door would blank', () => {
    // devMcpDoor redacts token, secret, password, api_key and *_hash keys; the address has to survive under its own name.
    const keys = new Set<string>()
    const walk = (o: unknown) => {
      if (Array.isArray(o)) o.forEach(walk)
      else if (o && typeof o === 'object') {
        for (const [k, v] of Object.entries(o)) {
          keys.add(k)
          walk(v)
        }
      }
    }
    walk(uploadPlanWords([waiting, inPlace, held]))
    for (const k of keys) expect(k).not.toMatch(/(^|_)(token|secret|password|api_key|hash)$/i)
  })
})

describe('what the apply holds a declared file to', () => {
  it('passes the planned file and no other', () => {
    expect(stagedProblem(FILE, { size: FILE.size_bytes, sha256: SHA })).toBeNull()
    expect(stagedProblem(FILE, null)).toMatch(/is not in the bucket yet.*upload command/)
    expect(stagedProblem(FILE, { size: 12, sha256: SHA })).toMatch(/is 12 bytes and the plan says 14327159/)
    expect(stagedProblem(FILE, { size: FILE.size_bytes, sha256: 'b'.repeat(64) })).toMatch(/sha256 bbbbbbbbbbbb….*plan says aaaaaaaaaaaa…/)
  })
})

describe('the migration that lets the database take it', () => {
  const sql = readFileSync('supabase/migrations/20261123183000_evidence_staged_file_cap.sql', 'utf8')
  const before = readFileSync('supabase/migrations/20261106020000_evidence_counsel_only.sql', 'utf8')

  it('opens with the lock timeout and makes no table', () => {
    expect(sql.startsWith("SET lock_timeout = '3s';")).toBe(true)
    expect(sql).not.toMatch(/CREATE TABLE|ALTER TABLE|CREATE POLICY/i)
  })

  it('is the function as it stood, with the cap alone moved to the storage limit', () => {
    const body = (text: string) => text.slice(text.indexOf('CREATE OR REPLACE FUNCTION public.dev_person_evidence_write('))
    const moved = body(before)
      .replace("    IF (v_file->>'size_bytes')::bigint > 10485760 THEN", "    IF (v_file->>'size_bytes')::bigint > 52428800 THEN")
      .replace('is over 10 MB; put it', 'is over 50 MB; put it')
    const now = body(sql)
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('-- v2.8375') && !line.trimStart().startsWith('-- before it gets here'))
      .join('\n')
    expect(now.trimEnd()).toBe(moved.trimEnd())
    expect(String(EVIDENCE_STAGED_MAX_BYTES)).toBe('52428800')
  })
})
