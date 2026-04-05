import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SIGNATURE_BUCKET = 'estimate-acceptor-signatures'
const MAX_SIGNATURE_BYTES = 524288 // 512 KiB (matches bucket file_size_limit)

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

function clientIp(req: Request): string | null {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]?.trim() ?? null
  return null
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
      return new Response(JSON.stringify({ error: 'You must agree to the terms' }), {
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

    const admin = createClient(supabaseUrl, serviceKey)
    const tokenHash = await sha256HexFromString(raw)

    const { data: row, error: fetchErr } = await admin
      .from('estimates')
      .select('id, status, public_token_expires_at, valid_until, acceptor_printed_name')
      .eq('public_token_hash', tokenHash)
      .maybeSingle()

    if (fetchErr || !row) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (row.status === 'customer_accepted') {
      return new Response(JSON.stringify({ ok: true, alreadyAccepted: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (row.status !== 'sent') {
      return new Response(JSON.stringify({ error: 'Not available' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const exp = row.public_token_expires_at ? Date.parse(String(row.public_token_expires_at)) : NaN
    if (!Number.isNaN(exp) && exp < Date.now()) {
      return new Response(JSON.stringify({ error: 'Link expired', code: 'expired' }), {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (row.valid_until) {
      const vu = new Date(String(row.valid_until) + 'T23:59:59.999Z').getTime()
      if (vu < Date.now()) {
        return new Response(JSON.stringify({ error: 'Estimate expired', code: 'expired' }), {
          status: 410,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
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
      storagePath = `${row.id}/${crypto.randomUUID()}.png`
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
    const ipRaw = clientIp(req)
    const nowIso = new Date().toISOString()

    const baseUpdate = {
      status: 'customer_accepted' as const,
      acceptor_consented_at: nowIso,
      acceptor_ip: ipRaw,
      acceptor_user_agent: ua,
    }

    const updatePayload = hasSig
      ? {
          ...baseUpdate,
          acceptor_printed_name: printedName,
          acceptor_signature_storage_path: storagePath,
        }
      : {
          ...baseUpdate,
          acceptor_printed_name: printedName,
          acceptor_signature_storage_path: null,
        }

    const { data: updatedRows, error: updErr } = await admin
      .from('estimates')
      .update(updatePayload)
      .eq('id', row.id)
      .eq('status', 'sent')
      .select('id, acceptor_signature_storage_path')

    if (updErr) {
      console.error(updErr)
      if (storagePath) {
        await admin.storage.from(SIGNATURE_BUCKET).remove([storagePath])
      }
      return new Response(JSON.stringify({ error: 'Could not save acceptance' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const updated = updatedRows?.[0] ?? null
    if (!updated) {
      if (storagePath) {
        await admin.storage.from(SIGNATURE_BUCKET).remove([storagePath])
      }
      return new Response(
        JSON.stringify({ error: 'Estimate was already accepted or is no longer available to accept' }),
        {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    if (hasSig && !updated.acceptor_signature_storage_path?.trim()) {
      if (storagePath) {
        await admin.storage.from(SIGNATURE_BUCKET).remove([storagePath])
      }
      console.error('accept-estimate: signature upload succeeded but DB path missing after update', {
        estimateId: row.id,
      })
      return new Response(JSON.stringify({ error: 'Could not save signature on estimate' }), {
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
