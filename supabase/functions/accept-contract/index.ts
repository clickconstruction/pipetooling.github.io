import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SIGNATURE_BUCKET = 'contract-signer-signatures'
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
        'id, status, public_token_expires_at, signer_printed_name',
      )
      .eq('public_token_hash', tokenHash)
      .maybeSingle()

    if (fetchErr || !row) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const doc = row as { id: string; status: string; public_token_expires_at: string | null }

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
    if (hasSig) {
      const bytes = decodeBase64PngBytes(sigRaw)
      if (!bytes || bytes.length === 0 || bytes.length > MAX_SIGNATURE_BYTES || !isPng(bytes)) {
        return new Response(JSON.stringify({ error: 'Invalid or oversized signature image' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
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

    const ua = req.headers.get('user-agent') ?? null
    const fwd = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    const ipRaw = fwd || req.headers.get('cf-connecting-ip') || null
    const nowIso = new Date().toISOString()
    const todayYmd = new Date().toISOString().slice(0, 10)

    const updatePayload = hasSig
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
