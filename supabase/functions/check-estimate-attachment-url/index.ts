import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { normalizeCustomerAttachmentUrl } from '../_shared/estimateCustomerAttachment.ts'

/**
 * Heuristic probe: public Drive/Docs links vs login wall. Not a guarantee — Workspace policy
 * and edge cases can still block customers after likely_public / likely_ok_html results.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function probeHostAllowed(hostname: string): boolean {
  const h = hostname.toLowerCase()
  if (h === 'drive.google.com' || h === 'docs.google.com') return true
  if (h.endsWith('.drive.google.com')) return true
  return false
}

/** HTML/text snippets that often indicate a login or permission wall (best-effort). */
const RESTRICTED_MARKERS = [
  'accounts.google.com',
  'sign in',
  'sign-in',
  'log in',
  'access denied',
  'you need permission',
  'request access',
  'permission denied',
  'serviceaccounts',
]

function classifyBodySnippet(status: number, contentType: string, textSample: string): {
  result: 'likely_public' | 'likely_ok_html' | 'likely_restricted' | 'unknown'
  message?: string
} {
  const ct = contentType.toLowerCase()
  const lower = textSample.toLowerCase()

  if (status === 401 || status === 403) {
    return { result: 'likely_restricted', message: 'Server returned unauthorized or forbidden.' }
  }

  for (const m of RESTRICTED_MARKERS) {
    if (lower.includes(m)) {
      return {
        result: 'likely_restricted',
        message: 'Response looks like a sign-in or permission screen. Use “Anyone with the link” (Viewer) or test in a private window.',
      }
    }
  }

  if (status >= 200 && status < 300) {
    if (ct.includes('application/pdf') || ct.includes('application/octet-stream')) {
      return {
        result: 'likely_public',
        message: 'Direct file response; likely viewable without signing in if the link is shared.',
      }
    }
  }

  // Softer than generic unknown: UI can show success (green) while copy still asks for incognito check.
  if (status >= 200 && status < 300 && ct.includes('text/html')) {
    return {
      result: 'likely_ok_html',
      message:
        'Works! — you should open the link in a private or incognito window to be sure.',
    }
  }

  return {
    result: 'unknown',
    message: 'Could not classify this response. Open the link in a private/incognito window to verify.',
  }
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
    if (!supabaseAnon) {
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

    const { url: rawUrl } = (await req.json()) as { url?: string }
    const normalized = normalizeCustomerAttachmentUrl(typeof rawUrl === 'string' ? rawUrl : '')
    if (!normalized) {
      return new Response(JSON.stringify({ error: 'Invalid or empty URL (https only)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let hostname: string
    try {
      hostname = new URL(normalized).hostname
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid URL' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!probeHostAllowed(hostname)) {
      return new Response(
        JSON.stringify({
          error: 'Check link only supports Google Drive or Google Docs URLs (drive.google.com, docs.google.com).',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    let res: Response
    try {
      res = await fetch(normalized, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(8000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PipeToolingLinkCheck/1.0; +https://pipetooling.com)',
          Accept: 'text/html,application/pdf;q=0.9,*/*;q=0.8',
        },
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'fetch failed'
      return new Response(
        JSON.stringify({
          ok: true,
          result: 'unknown',
          message: `Could not reach URL (${msg}). Check the link or try again.`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const contentType = res.headers.get('content-type') ?? ''
    const buf = await res.arrayBuffer()
    const maxRead = 16_384
    const slice = buf.byteLength > maxRead ? buf.slice(0, maxRead) : buf
    const textSample = new TextDecoder('utf-8', { fatal: false }).decode(slice)

    const { result, message } = classifyBodySnippet(res.status, contentType, textSample)

    return new Response(
      JSON.stringify({
        ok: true,
        result,
        message: message ?? undefined,
        httpStatus: res.status,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
