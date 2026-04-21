import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

async function sha256HexFromString(value: string): Promise<string> {
  const data = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function randomUrlToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function hasSigningContent(row: {
  signing_body_html?: string | null
  canonical_document_url?: string | null
  url?: string | null
}): boolean {
  if (row.signing_body_html?.trim()) return true
  if (row.canonical_document_url?.trim()) return true
  if (row.url?.trim()) return true
  return false
}

/**
 * Same rules as list_my_contract_dashboard_prompts: roster email match + name, or users.name = person_name.
 */
function isSignerForPersonContract(
  userEmail: string | null,
  userName: string | null,
  personName: string,
  rosterEmail: string | null,
): boolean {
  const pn = personName.trim()
  const un = (userName ?? '').trim()
  if (un.length > 0 && un === pn) return true
  const ue = (userEmail ?? '').trim().toLowerCase()
  const re = (rosterEmail ?? '').trim().toLowerCase()
  if (ue.length > 0 && re.length > 0 && ue === re) return true
  return false
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
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    if (!serviceKey) {
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await userClient.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = (await req.json()) as {
      person_contract_document_id?: string
      public_origin?: string
    }
    const { person_contract_document_id, public_origin } = body
    if (!person_contract_document_id?.trim()) {
      return new Response(JSON.stringify({ error: 'person_contract_document_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: urow, error: userRowErr } = await admin
      .from('users')
      .select('email, name')
      .eq('id', user.id)
      .single()

    if (userRowErr || !urow) {
      return new Response(JSON.stringify({ error: 'User profile not found' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const u = urow as { email: string | null; name: string | null }

    const { data: docRow, error: docErr } = await admin
      .from('person_contract_documents')
      .select(
        'id, person_name, document_name, status, signing_body_html, canonical_document_url, url, dashboard_prompt_after_clock_in',
      )
      .eq('id', person_contract_document_id)
      .single()

    if (docErr || !docRow) {
      return new Response(JSON.stringify({ error: 'Contract document not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const doc = docRow as {
      id: string
      person_name: string
      document_name: string
      status: string
      signing_body_html: string | null
      canonical_document_url: string | null
      url: string | null
      dashboard_prompt_after_clock_in: boolean | null
    }

    if (!doc.dashboard_prompt_after_clock_in) {
      return new Response(JSON.stringify({ error: 'Dashboard signing is not enabled for this document' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (doc.status === 'signed') {
      return new Response(JSON.stringify({ error: 'This document is already signed' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!hasSigningContent(doc)) {
      return new Response(
        JSON.stringify({
          error:
            'Add contract text, a canonical document URL, or a reference link before signing.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    if (doc.status !== 'unsent' && doc.status !== 'sent') {
      return new Response(JSON.stringify({ error: 'Invalid status for signing' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const pn = doc.person_name.trim()
    const { data: rosterByName } = await admin
      .from('people')
      .select('email, name')
      .is('archived_at', null)
      .eq('name', doc.person_name)
      .maybeSingle()

    let rosterEmailForPerson: string | null = null
    const rbn = rosterByName as { email: string | null; name: string | null } | null
    if (rbn && (rbn.name ?? '').trim() === pn) {
      rosterEmailForPerson = (rbn.email ?? '').trim() || null
    }
    if (!rosterEmailForPerson && u.email?.trim()) {
      const { data: rosterByUserEmail } = await admin
        .from('people')
        .select('email, name')
        .is('archived_at', null)
        .eq('email', u.email.trim())
      const match = (rosterByUserEmail ?? []).find((p) => (p.name ?? '').trim() === pn)
      if (match) rosterEmailForPerson = (match.email ?? '').trim() || null
    }

    if (!isSignerForPersonContract(u.email, u.name, doc.person_name, rosterEmailForPerson)) {
      return new Response(JSON.stringify({ error: 'Not allowed to sign this document' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const origin =
      (typeof public_origin === 'string' && public_origin.startsWith('http') ? public_origin : null) ??
        Deno.env.get('ESTIMATE_PUBLIC_ORIGIN') ??
        'https://pipetooling.github.io'

    const rawToken = randomUrlToken()
    const tokenHash = await sha256HexFromString(rawToken)
    const expiresAt = new Date(Date.now() + 14 * 86400000).toISOString()
    const acceptUrl = `${origin.replace(/\/$/, '')}/contract/accept?t=${encodeURIComponent(rawToken)}`

    const { data: updatedRows, error: upErr } = await admin
      .from('person_contract_documents')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        public_token_hash: tokenHash,
        public_token_expires_at: expiresAt,
      })
      .eq('id', doc.id)
      .in('status', ['unsent', 'sent'])
      .select('id')

    if (upErr || !updatedRows?.length) {
      console.error(upErr)
      return new Response(JSON.stringify({ error: 'Could not activate signing link' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true, accept_url: acceptUrl }), {
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
