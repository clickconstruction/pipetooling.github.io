import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { todayYmdInAppTz } from '../_shared/appTimeZone.ts'
import * as pdfLib from 'https://esm.sh/pdf-lib@1.17.1'
import fontkit from 'https://esm.sh/@pdf-lib/fontkit@1.1.1'
import { buildFillPlan, hasOfficeBoxes, schemaForParty, splitFormValuesForStorage, validateFormValues, type FormSchema, type FormValues } from '../_shared/formSchema.ts'
import { fillFormPdf, type FormPdfLibLike } from '../_shared/fillFormPdf.ts'
import { formatYmdForContractEmail } from '../_shared/contractSigningEmail.ts'

const SIGNATURE_BUCKET = 'contract-signer-signatures'
// Contract Forms (v2.2797): the uploaded template lives here…
const FORM_TEMPLATES_BUCKET = 'contract-form-templates'
// …and the flattened, signed copy (the only place sensitive answers exist) lands here.
const FORM_PDFS_BUCKET = 'contract-form-pdfs'

let cursiveFontCache: Uint8Array | null | undefined
/** Great Vibes from the app origin, for typed signatures drawn into the PDF. Null = Times Italic fallback. */
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
const MAX_SIGNATURE_BYTES = 524288

const PNG_MAGIC = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])

async function sha256HexFromString(value: string): Promise<string> {
  const data = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function isPng(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== PNG_MAGIC[i]) return false
  }
  return true
}

function decodeBase64PngBytes(raw: string): Uint8Array | null {
  const trimmed = raw.trim()
  const m = /^data:image\/png;base64,(.+)$/i.exec(trimmed)
  let b64: string | null = null
  if (m?.[1]) {
    b64 = m[1]
  } else if (!trimmed.startsWith('data:')) {
    b64 = trimmed
  }
  if (b64 == null || b64 === '') return null
  try {
    const bin = atob(b64)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  } catch {
    return null
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = (await req.json()) as {
      token?: string
      printedName?: string
      signaturePngBase64?: string
      agreedTerms?: boolean
      /** Contract Forms: the signer's answers, keyed by box key. */
      formValues?: FormValues
      formLang?: string
    }
    const raw = body.token?.trim()
    const printedName = body.printedName?.trim() ?? ''
    const sigRaw = typeof body.signaturePngBase64 === 'string' ? body.signaturePngBase64 : ''
    const hasSig = sigRaw.trim().length > 0

    if (!raw) {
      return new Response(JSON.stringify({ error: 'token is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!printedName) {
      return new Response(JSON.stringify({ error: 'printedName is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (body.agreedTerms !== true) {
      return new Response(JSON.stringify({ error: 'You must agree to continue' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    if (!serviceKey) {
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const tokenHash = await sha256HexFromString(raw)

    const { data: row, error: fetchErr } = await admin
      .from('person_contract_documents')
      .select(
        'id, status, public_token_expires_at, signer_printed_name, form_template_id',
      )
      .eq('public_token_hash', tokenHash)
      .maybeSingle()

    if (fetchErr || !row) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const doc = row as { id: string; status: string; public_token_expires_at: string | null; form_template_id: string | null }

    if (doc.status === 'signed') {
      return new Response(JSON.stringify({ ok: true, alreadySigned: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (doc.status !== 'sent') {
      return new Response(JSON.stringify({ error: 'Not available' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const exp = doc.public_token_expires_at ? Date.parse(String(doc.public_token_expires_at)) : NaN
    if (!Number.isNaN(exp) && exp < Date.now()) {
      return new Response(JSON.stringify({ error: 'Link expired', code: 'expired' }), {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let storagePath: string | null = null
    let sigBytes: Uint8Array | null = null
    if (hasSig) {
      const bytes = decodeBase64PngBytes(sigRaw)
      if (!bytes || bytes.length === 0 || bytes.length > MAX_SIGNATURE_BYTES || !isPng(bytes)) {
        return new Response(JSON.stringify({ error: 'Invalid or oversized signature image' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      sigBytes = bytes
      storagePath = `${doc.id}/${crypto.randomUUID()}.png`
      const { error: upErr } = await admin.storage.from(SIGNATURE_BUCKET).upload(storagePath, bytes, {
        contentType: 'image/png',
        upsert: false,
      })
      if (upErr) {
        console.error(upErr)
        return new Response(JSON.stringify({ error: 'Could not store signature' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // ── Contract Forms: fill the template, flatten, file the signed PDF ─────────
    let formUpdate: Record<string, unknown> = {}
    let formPdfPath: string | null = null
    if (doc.form_template_id) {
      const fail = (status: number, error: string, extra: Record<string, unknown> = {}) => {
        if (storagePath) void admin.storage.from(SIGNATURE_BUCKET).remove([storagePath])
        return new Response(JSON.stringify({ error, ...extra }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const { data: tpl } = await admin.from('contract_form_templates').select('schema, pdf_storage_path').eq('id', doc.form_template_id).maybeSingle()
      const t = tpl as { schema: FormSchema; pdf_storage_path: string } | null
      if (!t?.schema) return fail(500, 'The form template is missing.')
      const values: FormValues = body.formValues && typeof body.formValues === 'object' && !Array.isArray(body.formValues) ? body.formValues : {}
      // Two-party forms (PR 7): the signer sees and fills only their boxes; the office's half is
      // completed from the record afterwards, so the PDF stays fillable (read-only where filled)
      // until then and is flattened by complete-contract-form-office.
      const signerSchema = schemaForParty(t.schema, 'signer')
      const twoParty = hasOfficeBoxes(t.schema)
      const problems = validateFormValues(signerSchema, values)
      if (problems.length > 0) return fail(400, problems[0]!.message, { code: 'form_invalid', problems })
      const { data: file, error: dlErr } = await admin.storage.from(FORM_TEMPLATES_BUCKET).download(t.pdf_storage_path)
      if (dlErr || !file) {
        console.error('form template download', dlErr)
        return fail(500, 'Could not load the form.')
      }
      const templateBytes = new Uint8Array(await file.arrayBuffer())
      const signature = sigBytes ? { mode: 'draw' as const, png: sigBytes } : { mode: 'type' as const, text: printedName }
      const plan = buildFillPlan(signerSchema, values, { todayLabel: formatYmdForContractEmail(todayYmdInAppTz()) ?? '', signature })
      let filledBytes: Uint8Array
      try {
        const filled = await fillFormPdf(pdfLib as unknown as FormPdfLibLike, templateBytes, plan, { cursiveFontBytes: await loadCursiveFont(), fontkit, flatten: !twoParty, readOnlyFilled: twoParty })
        if (filled.skipped.length > 0) console.warn('form fill skipped binds', doc.id, filled.skipped)
        filledBytes = filled.bytes
      } catch (e) {
        console.error('form fill failed', e)
        return fail(500, 'Could not fill the form.')
      }
      formPdfPath = `${doc.id}/signed.pdf`
      const { error: pdfErr } = await admin.storage.from(FORM_PDFS_BUCKET).upload(formPdfPath, filledBytes, { contentType: 'application/pdf', upsert: true })
      if (pdfErr) {
        console.error('form pdf upload', pdfErr)
        return fail(500, 'Could not file the signed form.')
      }
      const split = splitFormValuesForStorage(signerSchema, values)
      formUpdate = { form_values: split.values, form_hints: split.hints, form_pdf_storage_path: formPdfPath, form_source: 'portal' }
    }

    const ua = req.headers.get('user-agent') ?? null
    const fwd = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    const ipRaw = fwd || req.headers.get('cf-connecting-ip') || null
    const nowIso = new Date().toISOString()
    const todayYmd = todayYmdInAppTz()

    const basePayload = hasSig
      ? {
          status: 'signed' as const,
          signed_at: todayYmd,
          signer_consented_at: nowIso,
          signer_ip: ipRaw,
          signer_user_agent: ua,
          signer_printed_name: printedName,
          signer_signature_storage_path: storagePath,
          public_token_hash: null,
          public_token_expires_at: null,
        }
      : {
          status: 'signed' as const,
          signed_at: todayYmd,
          signer_consented_at: nowIso,
          signer_ip: ipRaw,
          signer_user_agent: ua,
          signer_printed_name: printedName,
          signer_signature_storage_path: null,
          public_token_hash: null,
          public_token_expires_at: null,
        }
    const updatePayload = { ...basePayload, ...formUpdate }

    const { data: updatedRows, error: updErr } = await admin
      .from('person_contract_documents')
      .update(updatePayload)
      .eq('id', doc.id)
      .eq('status', 'sent')
      .select('id, signer_signature_storage_path')

    if (updErr) {
      console.error(updErr)
      if (storagePath) {
        await admin.storage.from(SIGNATURE_BUCKET).remove([storagePath])
      }
      if (formPdfPath) await admin.storage.from(FORM_PDFS_BUCKET).remove([formPdfPath])
      return new Response(JSON.stringify({ error: 'Could not save signature' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const updated = updatedRows?.[0] ?? null
    if (!updated) {
      if (storagePath) {
        await admin.storage.from(SIGNATURE_BUCKET).remove([storagePath])
      }
      if (formPdfPath) await admin.storage.from(FORM_PDFS_BUCKET).remove([formPdfPath])
      return new Response(JSON.stringify({ error: 'Could not update record' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (hasSig && !updated.signer_signature_storage_path?.trim()) {
      if (storagePath) {
        await admin.storage.from(SIGNATURE_BUCKET).remove([storagePath])
      }
      return new Response(JSON.stringify({ error: 'Could not save signature path' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
