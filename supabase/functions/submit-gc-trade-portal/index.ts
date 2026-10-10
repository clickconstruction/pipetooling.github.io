import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as pdfLib from 'https://esm.sh/pdf-lib@1.17.1'
import fontkit from 'https://esm.sh/@pdf-lib/fontkit@1.1.1'
import { todayYmdInAppTz } from '../_shared/appTimeZone.ts'
import { clientIpFromEdgeRequest } from '../_shared/clientIpFromEdgeRequest.ts'
import { sampleStateFromToken } from '../_shared/customerSample.ts'
import { driveFolderIdFromUrl, findOrCreateFolder, googleAccessToken, uploadBytes } from '../_shared/driveUpload.ts'
import { parseEsignConsent, recordEsignConsent } from '../_shared/esignConsent.ts'
import { GC_TRADE_EMAIL_FROM_NAME } from '../_shared/gcTradeEmail.ts'
import { driveFileUrl, TRADE_FILE_HOURLY_CAP, tradeFileDriveName, tradeFileFolders, tradeFileFromRoot, type TradeFileUpload } from '../_shared/gcTradeFile.ts'
import { buildTradeWaiverPdf, tradeWaiverPaperFor, tradeWaiverPdfModel, tradeWaiverPdfName, type TradeWaiverPdfLib } from '../_shared/tradeWaiverPdf.ts'
import { resolveTradeLink, type TradeLinkRow } from '../_shared/gcTradeLink.ts'
import { mintPaperToken, paperSignPath } from '../_shared/gcTradePaper.ts'
import { FREE_TEXT_KINDS, isHoneypot, overHourlyCap, parseTradeSubmit, spanishHeld, TRADE_FUNCTION_ERRORS, tradeErrorOf, WAIVER_KINDS, waiverHeld } from '../_shared/gcTradeSubmit.ts'

/**
 * GC mode, the trade partner portal's writes (P2b-i, to-dos/gc-mode/mockups/portal-p2b.md): everything a company
 * does from its no-password page. The link is the key, as on the sub portal (`submit-sub-portal` is the template).
 *
 *   POST { token, kind, website?, ...fields } → { ok: true, value? } | { error: key }
 *
 * In order: the honeypot answers ok; a shape the portal never sends is badRequest; the sample token answers ok and
 * writes nothing; the link is resolved (`_shared/gcTradeLink.ts`, raw then hash; off → linkOff); Spanish held refuses
 * es; a free-text kind is refused past the hourly cap (tooMany). Then the kind's `gc_trade_<verb>` (P2a) runs with the
 * link's company first, and its refusal key comes back as the page's key (`tradeErrorOf`). Errors are keys the
 * page says in the company's language (decision 11).
 *
 * A signature (`sign_sow`, P2c-ii, plan to-dos/gc-mode/mockups/portal-p2c.md) does what `accept-contract` does around the
 * write: no consent is consentNeeded before any write; a drawn image goes to the signatures bucket first and is deleted
 * if the verb refuses; the verb gets the IP and the browser; and after it the e-sign ledger row takes the consent time the
 * verb wrote, so the two match. The unconditional waiver and a change signed (P5c-3b, plan
 * to-dos/gc-mode/mockups/portal-p5.md) are typed and keep no image; their verbs return no time, so their ledger rows
 * (`gc_draw` keyed by the draw, `gc_trade_change` keyed by the change order) take the function's. A pay application and
 * the final one (P5c-3c-ii) sign their conditional waiver the same way: their ledger row is keyed by the draw the verb
 * returns. The three waiver kinds are on since the owner's call 2 (v2.5178); with `WAIVER_SIGN_LIVE` off they are
 * refused as badRequest.
 *
 * A file (P5a-1, plan to-dos/gc-mode/mockups/portal-p5a.md) has no verb. After the link, its own hourly cap (20 files),
 * the company's claim to the record it is for (its submittal while it is its move, a trade it signed for, its open
 * ask), then the job's Drive folder (`gc_projects.drive_folder_url`, else noJobFolder): a submittal's file into
 * Submittals, any other into Team only → From trades → the company. The bytes go up with the service account the
 * intake already uses (`GOOGLE_SERVICE_ACCOUNT_JSON`, as `DRIVE_IMPERSONATE_USER` when set), under a name that never
 * meets another file's, and `gc_trade_files` keeps the link. The answer is `{ id, name, url }`, which the page sends
 * with the kind that stores it.
 *
 * A waiver signed (`unconditional_waiver`, `pay_app`, `final_pay_app`) is kept as a signed PDF too (P5a-2): after the verb
 * and the ledger row, the app's own form (`_shared/tradeWaiverPdf.ts`) filled from the draw, with the typed name, goes to
 * Team only → From trades → the company, and a `gc_trade_files` row names its form (`paper`) and its draw. It is best
 * effort, as the ledger row is: a failure is logged and never undoes the signature. `WAIVER_SIGN_LIVE` holds it with the
 * presses that make it.
 *
 * A company's own papers (P5b-1, plan to-dos/gc-mode/mockups/portal-p5b.md): `vetting_form` writes the form of a company
 * new to us, and `paper_link` opens its master agreement the office sent, or its W-9, to sign on `/contract/accept`. For
 * that one the function mints a fresh token (`_shared/gcTradePaper.ts`, as `submit-sub-portal`'s `sign_link` does), hands
 * the verb its hash and expiry, and answers `{ signPath }` with the raw token, which the page goes to in the same tab.
 * The newest link wins, so the emailed one stops working.
 */

/** Where a trade's drawn signature on its statement of work is kept: `gc-sows/<sow id>/<uuid>.png`. */
const SIGNATURE_BUCKET = 'contract-signer-signatures'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

const refuse = (key: keyof typeof TRADE_FUNCTION_ERRORS) => jsonResponse({ error: key }, TRADE_FUNCTION_ERRORS[key])

type Count = { count: number | null }

/**
 * The company's free-text writes in the last hour: its questions, the people it added, its quotes, its quote days and the
 * changes it asked for, and since P5c-2 its questions while we build and the submittal rounds it sent. A round carries no
 * company of its own, so it is counted on the submittals of the trades its statements of work are for.
 */
async function freeTextCounts(admin: SupabaseClient, companyId: string): Promise<(number | null)[]> {
  const hourAgo = new Date(Date.now() - 3600_000).toISOString()
  const invites = ((await admin.from('gc_invites').select('id').eq('company_id', companyId)).data ?? []) as { id: string }[]
  const head = { count: 'exact' as const, head: true }
  const sowPackages = ((await admin.from('gc_sows').select('package_id').eq('company_id', companyId)).data ?? []) as { package_id: string }[]
  const submittals = sowPackages.length
    ? (((await admin.from('gc_submittals').select('id').in('package_id', sowPackages.map((s) => s.package_id))).data ?? []) as { id: string }[])
    : []
  const [questions, people, contacts, quotes, changes, rfis, rounds] = await Promise.all([
    admin.from('gc_plan_questions').select('id', head).eq('company_id', companyId).gte('created_at', hourAgo),
    admin.from('gc_company_people').select('id', head).eq('company_id', companyId).eq('added_by', 'trade').gte('created_at', hourAgo),
    admin.from('gc_company_contacts').select('id', head).eq('company_id', companyId).eq('how', 'portal').gte('created_at', hourAgo),
    invites.length
      ? admin.from('gc_quotes').select('id', head).in('invite_id', invites.map((i) => i.id)).eq('source', 'trade').gte('created_at', hourAgo)
      : Promise.resolve({ count: 0 } as Count),
    admin.from('gc_trade_change_requests').select('id', head).eq('company_id', companyId).gte('created_at', hourAgo),
    admin.from('gc_rfis').select('id', head).eq('asked_by_company_id', companyId).gte('created_at', hourAgo),
    submittals.length
      ? admin.from('gc_submittal_rounds').select('id', head).in('submittal_id', submittals.map((x) => x.id)).eq('sent_by', 'trade').gte('created_at', hourAgo)
      : Promise.resolve({ count: 0 } as Count),
  ])
  return [questions, people, contacts, quotes, changes, rfis, rounds].map((r) => (r as Count).count)
}

type Refusal = { error: string; status: number }
const no = (error: string, status: number): Refusal => ({ error, status })

/**
 * What a file is on, once the company's claim to its record holds: the job, the trade, and for a submittal its number
 * and the round the file will be. The claims are the verbs' own, so a file is never placed for a record its next kind
 * would refuse: a submittal on the company's awarded trade while it is its move, a trade it signed for on a job that is
 * ours, its own ask not passed on a project not lost.
 */
async function fileHome(admin: SupabaseClient, companyId: string, f: TradeFileUpload): Promise<{ projectId: string | null; packageId: string | null; submittal?: { number: string; round: number } } | Refusal> {
  // A certificate (P5b-2) is the link's company's own, on no job.
  if (f.for === 'coi') return { projectId: null, packageId: null }
  if (f.for === 'submittal') {
    const { data: s } = await admin.from('gc_submittals').select('id, project_id, package_id, number').eq('id', f.recordId ?? '').maybeSingle()
    if (!s) return no('notFound', 404)
    const { data: k } = await admin.from('gc_trade_packages').select('awarded_invite_id').eq('id', s.package_id).maybeSingle()
    const { data: i } = k?.awarded_invite_id ? await admin.from('gc_invites').select('company_id').eq('id', k.awarded_invite_id).maybeSingle() : { data: null }
    if (i?.company_id !== companyId) return no('notYours', 409)
    const { data: move } = await admin.rpc('gc_submittal_move', { p_submittal_id: s.id })
    if (move !== 'trade') return no('notYourMove', 409)
    const { data: last } = await admin.from('gc_submittal_rounds').select('round').eq('submittal_id', s.id).order('round', { ascending: false }).limit(1)
    return { projectId: s.project_id, packageId: s.package_id, submittal: { number: s.number, round: ((last?.[0]?.round as number | undefined) ?? 0) + 1 } }
  }
  if (f.for === 'change') {
    const { data: k } = await admin.from('gc_trade_packages').select('id, project_id, ours, awarded_invite_id').eq('id', f.recordId ?? '').maybeSingle()
    if (!k) return no('notFound', 404)
    const [{ data: g }, { data: sow }] = await Promise.all([
      admin.from('gc_projects').select('stage').eq('project_id', k.project_id).maybeSingle(),
      admin.from('gc_sows').select('company_id, status, invite_id').eq('package_id', k.id).maybeSingle(),
    ])
    if (!g || g.stage === 'bidding' || k.ours || !sow || sow.status !== 'signed' || sow.company_id !== companyId || sow.invite_id !== k.awarded_invite_id) {
      return no('notAwarded', 409)
    }
    return { projectId: k.project_id, packageId: k.id }
  }
  const { data: ask } = await admin.from('gc_invites').select('id, company_id, package_id, status').eq('id', f.recordId ?? '').maybeSingle()
  if (!ask) return no('notFound', 404)
  if (ask.company_id !== companyId) return no('notYours', 409)
  if (ask.status === 'declined') return no('youPassed', 409)
  const { data: k } = await admin.from('gc_trade_packages').select('project_id').eq('id', ask.package_id).maybeSingle()
  if (!k) return no('notFound', 404)
  const { data: g } = await admin.from('gc_projects').select('lost_on').eq('project_id', k.project_id).maybeSingle()
  if (g?.lost_on) return no('projectLost', 409)
  return { projectId: k.project_id, packageId: ask.package_id }
}

/**
 * A file into the job's Drive folder (P5a-1): the cap, the claim, the folder, the upload, the row, the link. A certificate
 * (P5b-2) is on no job: it goes under the jobs Shared Drive's root (`DRIVE_JOBS_FOLDER_ID`), to GC trade partners → the
 * company, and is never noJobFolder; a missing root is failed, logged, as a missing service account is.
 */
async function placeFile(admin: SupabaseClient, companyId: string, f: TradeFileUpload): Promise<Response> {
  const hourAgo = new Date(Date.now() - 3600_000).toISOString()
  // The company's own uploads count; a signed paper the portal made for it does not.
  const { count } = await admin.from('gc_trade_files').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('made_by', 'trade').gte('uploaded_at', hourAgo)
  if ((count ?? 0) >= TRADE_FILE_HOURLY_CAP) return refuse('tooMany')
  const home = await fileHome(admin, companyId, f)
  if ('error' in home) return jsonResponse({ error: home.error }, home.status)
  const [{ data: job }, { data: company }] = await Promise.all([
    home.projectId ? admin.from('gc_projects').select('drive_folder_url').eq('project_id', home.projectId).maybeSingle() : Promise.resolve({ data: null }),
    admin.from('gc_companies').select('name').eq('id', companyId).maybeSingle(),
  ])
  let jobFolder: string | null
  if (tradeFileFromRoot(f.for)) {
    jobFolder = Deno.env.get('DRIVE_JOBS_FOLDER_ID')?.trim() || null
    if (!jobFolder) {
      console.error('submit-gc-trade-portal: DRIVE_JOBS_FOLDER_ID is not set')
      return refuse('failed')
    }
  } else {
    jobFolder = driveFolderIdFromUrl(job?.drive_folder_url as string | null | undefined)
    if (!jobFolder) return refuse('noJobFolder')
  }
  const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
  if (!saJson) {
    console.error('submit-gc-trade-portal: GOOGLE_SERVICE_ACCOUNT_JSON is not set')
    return refuse('failed')
  }
  const token = await googleAccessToken(saJson)
  let folder = jobFolder
  for (const name of tradeFileFolders(f.for, String(company?.name ?? ''))) folder = (await findOrCreateFolder(token, folder, name)).id
  const impersonate = Deno.env.get('DRIVE_IMPERSONATE_USER')?.trim()
  const upToken = impersonate ? await googleAccessToken(saJson, impersonate) : token
  const { id: driveId } = await uploadBytes(upToken, folder, f.bytes, tradeFileDriveName(f.for, f.name, new Date(), home.submittal), f.mime)
  const url = driveFileUrl(driveId)
  const { data: row, error } = await admin
    .from('gc_trade_files')
    .insert({ company_id: companyId, project_id: home.projectId, package_id: home.packageId, purpose: f.for, name: f.name, mime: f.mime, bytes: f.bytes.length, drive_file_id: driveId, drive_url: url, made_by: 'trade' })
    .select('id')
    .single()
  // The file is in Drive either way: a row not kept is logged, and the link still goes to the next kind.
  if (error) console.error('submit-gc-trade-portal: the file is in Drive, its row was not kept', driveId, error)
  return jsonResponse({ ok: true, value: { id: row?.id ?? null, name: f.name, url } })
}

let cursiveFontCache: Uint8Array | null | undefined
/** The cursive face a typed name signs in, as `contract-form-paper-entry` loads it. Null: the PDF signs in italics. */
async function loadCursiveFont(): Promise<Uint8Array | null> {
  if (cursiveFontCache !== undefined) return cursiveFontCache
  try {
    const origin = (Deno.env.get('APP_ORIGIN') ?? 'https://clicktooling.com').replace(/\/$/, '')
    const res = await fetch(`${origin}/fonts/GreatVibes-Regular.ttf`)
    cursiveFontCache = res.ok ? new Uint8Array(await res.arrayBuffer()) : null
  } catch {
    cursiveFontCache = null
  }
  return cursiveFontCache
}

/**
 * The signed waiver as a PDF in the job's Drive folder (P5a-2), after the verb and the ledger row: the form the kind
 * signs, filled from its draw, with the typed name. Best effort: a job with no folder, or Drive refusing, is logged.
 */
async function fileSignedWaiver(admin: SupabaseClient, companyId: string, kind: 'unconditional_waiver' | 'pay_app' | 'final_pay_app', drawId: string, printedName: string, at: Date): Promise<void> {
  try {
    const { data: d } = await admin.from('gc_draws').select('id, sow_id, number, net, final, period_to, requested_on').eq('id', drawId).maybeSingle()
    const { data: sow } = d ? await admin.from('gc_sows').select('package_id').eq('id', d.sow_id).maybeSingle() : { data: null }
    const { data: k } = sow ? await admin.from('gc_trade_packages').select('id, project_id, trade').eq('id', sow.package_id).maybeSingle() : { data: null }
    if (!d || !k) return
    const [{ data: job }, { data: gc }, { data: company }] = await Promise.all([
      admin.from('projects').select('name, address').eq('id', k.project_id).maybeSingle(),
      admin.from('gc_projects').select('drive_folder_url').eq('project_id', k.project_id).maybeSingle(),
      admin.from('gc_companies').select('name').eq('id', companyId).maybeSingle(),
    ])
    const jobFolder = driveFolderIdFromUrl(gc?.drive_folder_url as string | null | undefined)
    const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
    if (!jobFolder || !saJson) {
      console.error('submit-gc-trade-portal: the signed waiver PDF has no job folder or service account', drawId)
      return
    }
    const paper = tradeWaiverPaperFor(kind, Boolean(d.final))
    const signedYmd = todayYmdInAppTz(at)
    const companyName = String(company?.name ?? '')
    const model = tradeWaiverPdfModel({
      paper,
      amount: Number(d.net),
      through: String(d.period_to ?? d.requested_on ?? ''),
      company: companyName,
      project: { name: String(job?.name ?? ''), address: String(job?.address ?? '') },
      signer: printedName,
      signedYmd,
      checkFrom: GC_TRADE_EMAIL_FROM_NAME,
      signedAt: at,
    })
    const font = await loadCursiveFont()
    const bytes = await buildTradeWaiverPdf(pdfLib as unknown as TradeWaiverPdfLib, model, font ? { bytes: font, fontkit } : null)
    const token = await googleAccessToken(saJson)
    let folder = jobFolder
    // A waiver is no submittal: Team only → From trades → the company.
    for (const name of tradeFileFolders('change', companyName)) folder = (await findOrCreateFolder(token, folder, name)).id
    const impersonate = Deno.env.get('DRIVE_IMPERSONATE_USER')?.trim()
    const upToken = impersonate ? await googleAccessToken(saJson, impersonate) : token
    const name = tradeWaiverPdfName(paper, String(k.trade), Number(d.number), signedYmd)
    const { id } = await uploadBytes(upToken, folder, bytes, name, 'application/pdf')
    const { error } = await admin.from('gc_trade_files').insert({
      company_id: companyId,
      project_id: k.project_id,
      package_id: k.id,
      purpose: 'waiver',
      paper,
      record_id: d.id,
      name,
      mime: 'application/pdf',
      bytes: bytes.length,
      drive_file_id: id,
      drive_url: driveFileUrl(id),
      made_by: 'portal',
    })
    if (error) console.error('submit-gc-trade-portal: the signed waiver PDF is in Drive, its row was not kept', id, error)
  } catch (e) {
    console.error('submit-gc-trade-portal: the signed waiver PDF was not filed', drawId, e)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'badRequest' }, 405)
  try {
    const body = (await req.json().catch(() => null)) as unknown
    if (isHoneypot(body)) return jsonResponse({ ok: true })
    const parsed = parseTradeSubmit(body)
    if (!parsed.ok) return refuse(parsed.key ?? 'badRequest')
    // With WAIVER_SIGN_LIVE off, no lien waiver goes through and the page sends no such press (on since the owner's call 2).
    if (waiverHeld(parsed.kind)) return refuse('badRequest')
    // The sample (What customers see) writes nothing and never errors (decision 12).
    if (sampleStateFromToken(parsed.token)) return jsonResponse({ ok: true, sample: true })
    if (parsed.token.length < 16 || parsed.token.length > 128) return refuse('badRequest')

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
    const link = await resolveTradeLink(parsed.token, async (column, value) => {
      const { data } = await admin.from('gc_trade_portal_links').select('company_id, revoked_at').eq(column, value).maybeSingle()
      return data as TradeLinkRow | null
    })
    if (!link) return refuse('linkOff')
    if (parsed.file) return await placeFile(admin, link.company_id, parsed.file)
    if (spanishHeld(parsed.call)) return refuse('spanishHeld')
    if (FREE_TEXT_KINDS.has(parsed.kind) && overHourlyCap(await freeTextCounts(admin, link.company_id))) return refuse('tooMany')

    // A signature: the consent words as the ledger keeps them, then the drawn image, before the verb.
    const sign = parsed.sign
    const consent = sign ? parseEsignConsent(sign.consent) : null
    if (sign && !consent) return refuse('consentNeeded')
    const ip = sign ? clientIpFromEdgeRequest(req) : null
    const userAgent = sign ? req.headers.get('user-agent') : null
    let signaturePath: string | null = null
    if (sign?.png) {
      signaturePath = `gc-sows/${String(parsed.call.params.p_sow_id)}/${crypto.randomUUID()}.png`
      const { error: upErr } = await admin.storage.from(SIGNATURE_BUCKET).upload(signaturePath, sign.png, { contentType: 'image/png', upsert: false })
      if (upErr) {
        console.error('submit-gc-trade-portal: the signature was not stored', upErr)
        return refuse('failed')
      }
    }
    // A paper to sign (P5b-1): a fresh token, whose hash and expiry the verb stores; the raw token goes back to the page
    // in the answer and nowhere else (no log line carries the params).
    const paperToken = parsed.kind === 'paper_link' ? await mintPaperToken() : null
    const params = sign
      ? { ...parsed.call.params, p_signature_path: signaturePath, p_ip: ip, p_user_agent: userAgent }
      : paperToken
        ? { ...parsed.call.params, p_token_hash: paperToken.hash, p_expires_at: paperToken.expiresAt }
        : parsed.call.params

    const { data, error } = await admin.rpc(parsed.call.rpc, { p_company_id: link.company_id, ...params })
    if (error) {
      if (signaturePath) await admin.storage.from(SIGNATURE_BUCKET).remove([signaturePath])
      const refusal = tradeErrorOf(error)
      if (refusal.key === 'failed') console.error('submit-gc-trade-portal: the verb failed', parsed.kind, error)
      return jsonResponse({ error: refusal.key }, refusal.status)
    }
    if (sign && consent) {
      // Best-effort, as every signing function keeps it: the row's own stamp is the act, this row is the words.
      const at = new Date()
      const recordId = sign.record.id ?? String(data)
      await recordEsignConsent(admin, {
        recordType: sign.record.type,
        recordId,
        consent,
        printedName: sign.printedName,
        method: sign.png ? 'draw' : 'type',
        consentedAt: sign.record.type === 'gc_sow' ? String(data) : at.toISOString(),
        ip,
        userAgent,
      })
      if (WAIVER_KINDS.has(parsed.kind)) {
        await fileSignedWaiver(admin, link.company_id, parsed.kind as 'unconditional_waiver' | 'pay_app' | 'final_pay_app', recordId, sign.printedName, at)
      }
    }
    if (paperToken) return jsonResponse({ ok: true, value: { signPath: paperSignPath(paperToken.raw) } })
    return jsonResponse({ ok: true, ...(data === null || data === undefined || data === '' ? {} : { value: data }) })
  } catch (e) {
    console.error('submit-gc-trade-portal failed', e)
    return refuse('failed')
  }
})
