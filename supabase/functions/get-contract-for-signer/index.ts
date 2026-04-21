import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

async function sha256HexFromString(value: string): Promise<string> {
  const data = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const url = new URL(req.url)
    const raw = url.searchParams.get('token')?.trim()
    if (!raw) {
      return new Response(JSON.stringify({ error: 'Missing token' }), {
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

    const { data: row, error } = await admin
      .from('person_contract_documents')
      .select(
        'id, person_name, document_name, signing_body_html, signing_body_format, canonical_document_url, url, status, public_token_expires_at, signer_printed_name',
      )
      .eq('public_token_hash', tokenHash)
      .maybeSingle()

    if (error || !row) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const r = row as {
      status: string
      public_token_expires_at: string | null
      signing_body_html: string | null
      signing_body_format: string
      canonical_document_url: string | null
      url: string | null
      person_name: string
      document_name: string
      signer_printed_name: string | null
    }

    if (r.status === 'signed') {
      return new Response(
        JSON.stringify({
          code: 'already_signed',
          error: 'This contract has already been signed.',
          thank_you_title: 'Thank you',
          thank_you_body: 'This record has already been completed.',
        }),
        {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    if (r.status !== 'sent') {
      return new Response(JSON.stringify({ error: 'Not available' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const exp = r.public_token_expires_at ? Date.parse(String(r.public_token_expires_at)) : NaN
    if (!Number.isNaN(exp) && exp < Date.now()) {
      return new Response(JSON.stringify({ error: 'Link expired', code: 'expired' }), {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const canonical =
      (r.canonical_document_url && String(r.canonical_document_url).trim()) ||
      (r.url && String(r.url).trim()) ||
      null

    return new Response(
      JSON.stringify({
        id: r.id,
        person_name: r.person_name,
        document_name: r.document_name,
        signing_body_html: r.signing_body_html,
        signing_body_format: r.signing_body_format,
        canonical_document_url: canonical,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
