import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as pdfLib from 'https://esm.sh/pdf-lib@1.17.1'
import type { PdfLibLike } from '../_shared/jobContractPdf.ts'
import { todayYmdInAppTz } from '../_shared/appTimeZone.ts'
import { PORTAL_COMPANY } from '../_shared/portalCompany.ts'
import { refuseArchivedCaller } from '../_shared/refuseArchivedCaller.ts'
import type { PaperCompany } from '../_shared/subPapers.ts'
import { buildStatementOfAccountPdf } from '../_shared/subPapersPdf.ts'
import { readSubPapersRows, type RowsClient } from '../_shared/subPapersRows.ts'
import { isStatementPersonId, pickStatementPerson, planStatement, shapeStatementAsk, statementCopyName, statementFileName, statementMintArgs, statementSentRow, STATEMENT_SENT_BUCKET, type StatementPersonRow } from '../_shared/subStatementMake.ts'

// A person's statement of account, planned or made off the screen (the dev seat's plan_sub_statement and
// apply_sub_statement call it as the dev). It is the paper the office's papers window makes (punch list #350): the
// same rows read under the caller's own row security, the same builders and check, the same register.
//
//   POST { person, period }                 the statement as data. Nothing is written.
//   POST { person, period, make, expect }   the window's Download: the paper registered through mint_sub_paper as
//                                           the caller, drawn under its number and kept as a sent copy, with a link
//                                           to that copy that opens for one hour. `expect` is the plan's fingerprint:
//                                           a sheet or a payment changed since refuses the make.
//
// The caller is signed in and must be one of the office roles who see sub pay, not archived, and for a make not in
// training. It sends nothing to anyone. dev-mcp carries only the two thin verbs, since its upload has no room for
// the papers' kernels.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-dev-seat',
}

const OFFICE_ROLES = new Set(['dev', 'master_technician', 'assistant', 'controller'])
const ISSUER_KEY = 'physical_invoice_issuer_v1'
const PERSON_COLUMNS = 'id, name, kind, account_user_id, archived_at'
/** The copy's link opens this long. */
const LINK_SECONDS = 3600
/** A PDF this small rides in the answer when its copy could not be kept, so a numbered paper is never lost. */
const INLINE_BYTES = 45_000

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

// deno-lint-ignore no-explicit-any
type Client = any

/** The roster rows an ask could mean: by id either way, or by the whole name on the roster or on the account. */
async function readPeople(client: Client, asked: string): Promise<StatementPersonRow[]> {
  if (isStatementPersonId(asked)) {
    const { data, error } = await client.from('people').select(PERSON_COLUMNS).or(`id.eq.${asked},account_user_id.eq.${asked}`)
    if (error) throw new Error(`people: ${error.message}`)
    return (data ?? []) as StatementPersonRow[]
  }
  const byName = await client.from('people').select(PERSON_COLUMNS).ilike('name', asked).limit(50)
  if (byName.error) throw new Error(`people: ${byName.error.message}`)
  const accounts = await client.from('users').select('id').ilike('name', asked).limit(50)
  const ids = ((accounts.data ?? []) as Array<{ id: string }>).map((u) => u.id)
  const byAccount = ids.length > 0 ? await client.from('people').select(PERSON_COLUMNS).in('account_user_id', ids) : { data: [], error: null }
  if (byAccount.error) throw new Error(`people: ${byAccount.error.message}`)
  return [...((byName.data ?? []) as StatementPersonRow[]), ...((byAccount.data ?? []) as StatementPersonRow[])]
}

/** The letterhead the office's papers print: the bill's own block from Settings, else the company's name alone. */
async function readCompany(client: Client): Promise<PaperCompany> {
  let issuer: Record<string, unknown> | null = null
  try {
    const { data } = await client.from('app_settings').select('value_text').eq('key', ISSUER_KEY).maybeSingle()
    const raw = (data as { value_text?: string | null } | null)?.value_text
    const parsed = raw ? JSON.parse(raw) : null
    issuer = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    issuer = null
  }
  const s = (k: string) => (issuer && typeof issuer[k] === 'string' ? (issuer[k] as string).trim() : '')
  return { name: s('companyName') || PORTAL_COMPANY.name, lines: [s('addressText').replace(/\n+/g, ', '), s('phone'), s('email')].filter(Boolean) }
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const own = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(own).set(bytes)
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', own)), (b) => b.toString(16).padStart(2, '0')).join('')
}

function base64Of(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization')
    const token = (authHeader ?? '').replace(/^Bearer\s+/i, '')
    if (!authHeader || !token) return jsonResponse({ error: 'Unauthorized' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: { user }, error: authError } = await userClient.auth.getUser(token)
    if (authError || !user) return jsonResponse({ error: 'Unauthorized' }, 401)
    const archived = await refuseArchivedCaller(admin, user.id, corsHeaders)
    if (archived) return archived

    const { data: me } = await admin.from('users').select('role, read_only').eq('id', user.id).maybeSingle()
    if (!me || !OFFICE_ROLES.has(String(me.role))) return jsonResponse({ error: 'Only the office roles who see sub pay can make a sub paper.' }, 403)

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    const shaped = shapeStatementAsk(body, todayYmdInAppTz())
    if (!shaped.ok) return jsonResponse({ error: shaped.error }, 400)
    const make = body?.make === true
    if (make && me.read_only === true) return jsonResponse({ error: 'This account is in training mode and cannot make a sub paper.' }, 403)

    // Every read is the caller's own, under their row security.
    const picked = pickStatementPerson(shaped.ask.person, await readPeople(userClient, shaped.ask.person))
    if (!picked.ok) return jsonResponse({ refused: picked.refused }, 409)
    const rows = await readSubPapersRows(userClient as unknown as RowsClient, picked.person.id)
    const plan = planStatement(rows, { person: picked.person, company: await readCompany(userClient), now: new Date() }, shaped.ask.period)
    if (!plan.ok) return jsonResponse({ refused: plan.refused }, 409)
    if (!make) return jsonResponse({ ok: true, plan: plan.reply })

    const expect = typeof body?.expect === 'string' ? body.expect : ''
    if (!expect || expect !== plan.fingerprint) return jsonResponse({ refused: 'The figures are not the ones the plan read: a sheet or a payment changed since, or the day turned. Plan again and read it.' }, 409)

    // Registered first, then drawn under the number that came back, as the window's Download does.
    const { data: mintedRows, error: mintError } = await userClient.rpc('mint_sub_paper', statementMintArgs(plan.statement, picked.person.id, plan.range))
    if (mintError) return jsonResponse({ refused: `The register refused the paper, so none is made: ${mintError.message}` }, 409)
    const minted = (Array.isArray(mintedRows) ? mintedRows[0] : mintedRows) as { number?: unknown } | null
    const number = typeof minted?.number === 'string' ? minted.number : ''
    if (!number) return jsonResponse({ error: 'The register answered with no number. Nothing is known to have been made: read sub_papers for this person before trying again.' }, 502)

    const paper = plan.numbered(number)
    const bytes = await buildStatementOfAccountPdf(pdfLib as unknown as PdfLibLike, paper, plan.range)
    const fileName = statementFileName(paper)
    const hash = await sha256Hex(bytes)

    // The sent copy, as the window files a downloaded paper. Best effort: the paper is numbered either way, and the answer says which.
    const id = crypto.randomUUID()
    const path = `${id}/${statementCopyName(fileName)}`
    const uploaded = await userClient.storage.from(STATEMENT_SENT_BUCKET).upload(path, bytes, { contentType: 'application/pdf', upsert: false })
    const kept = !uploaded.error
    const filed = await userClient.from('sent_documents').insert(statementSentRow(id, paper, picked.person.id, plan.jobIds, kept ? { path, hash, bytes: bytes.byteLength } : null))
    const signed = kept ? await userClient.storage.from(STATEMENT_SENT_BUCKET).createSignedUrl(path, LINK_SECONDS) : null
    const link = signed && !signed.error ? (signed.data?.signedUrl ?? null) : null

    return jsonResponse({
      ok: true,
      made: {
        paper: 'Statement of account',
        number,
        person: { people_id: picked.person.id, name: picked.person.name },
        period: paper.period,
        still_open: paper.stillOpen,
        file: { name: fileName, bytes: bytes.byteLength, sha256: hash },
        sent_copy: { kept, filed: !filed.error, id: filed.error ? null : id, ...(filed.error ? { filing_error: filed.error.message } : {}), ...(uploaded.error ? { copy_error: uploaded.error.message } : {}) },
        link,
        link_opens_for: link ? 'one hour' : null,
        ...(!link && bytes.byteLength <= INLINE_BYTES ? { pdf_base64: base64Of(bytes) } : {}),
      },
    })
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500)
  }
})
