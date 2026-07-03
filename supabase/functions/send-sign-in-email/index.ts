import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SendSignInEmailRequest {
  email: string
  /** Where the magic link lands after Supabase verifies it. Must be an allowed app origin; defaults to prod /dashboard. */
  redirectTo?: string
}

const DEFAULT_REDIRECT = 'https://pipetooling.com/dashboard'
const ALLOWED_REDIRECT = /^(https:\/\/pipetooling\.com\/|http:\/\/localhost:5(173|175)\/)/

// Fallbacks must match the Settings "sign_in" template defaults (src/pages/Settings.tsx openEditTemplate).
const DEFAULT_SUBJECT = 'Sign in to PipeTooling'
const DEFAULT_BODY =
  "Hi {{name}},\n\nClick the link below to sign in to your PipeTooling account:\n\n{{link}}\n\nIf you didn't request this sign-in link, you can safely ignore this email."

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function replaceVariables(text: string, variables: Record<string, string>): string {
  let result = text
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
    result = result.replace(regex, value || '')
  }
  return result
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Unauthorized - No authorization header' }, 401)
    }

    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) {
      return jsonResponse({ error: 'Unauthorized - Invalid authorization format' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    })

    // Verify user is authenticated
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !authUser) {
      return jsonResponse({ error: 'Unauthorized - Invalid or expired session. Please sign out and sign in again.' }, 401)
    }

    // Check if user is dev
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', authUser.id)
      .single()

    if (userError || !userData || userData.role !== 'dev') {
      return jsonResponse({ error: 'Forbidden - Only devs can send sign-in emails' }, 403)
    }

    // Parse request body
    const { email, redirectTo }: SendSignInEmailRequest = await req.json()

    if (!email) {
      return jsonResponse({ error: 'Missing required field: email' }, 400)
    }

    const normalizedEmail = email.trim().toLowerCase()

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceRoleKey) {
      return jsonResponse({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured. This is required for sending sign-in links.' }, 500)
    }
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      return jsonResponse({ error: 'RESEND_API_KEY not configured. Set it via: supabase secrets set RESEND_API_KEY=your_key' }, 500)
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // The link must sign in an existing account, never create one.
    const { data: targetUser, error: lookupError } = await adminClient
      .from('users')
      .select('id, name')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (lookupError) {
      return jsonResponse({ error: `Error looking up user: ${lookupError.message}` }, 500)
    }
    if (!targetUser) {
      return jsonResponse({ error: 'No account with this email' }, 400)
    }

    const redirect = redirectTo && ALLOWED_REDIRECT.test(redirectTo) ? redirectTo : DEFAULT_REDIRECT

    // generateLink returns the magic link WITHOUT sending any Supabase SMTP mail —
    // we send the email ourselves through Resend below.
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: normalizedEmail,
      options: { redirectTo: redirect },
    })

    if (linkError || !linkData?.properties?.action_link) {
      return jsonResponse({ error: `Failed to create sign-in link: ${linkError?.message || 'Unknown error'}` }, 500)
    }

    const actionLink = linkData.properties.action_link

    // Load the editable sign-in template (Settings → Templates); fall back to the
    // same defaults Settings seeds when the row has never been saved.
    const { data: template } = await adminClient
      .from('email_templates')
      .select('subject, body')
      .eq('template_type', 'sign_in')
      .maybeSingle()

    const subjectTemplate = template?.subject || DEFAULT_SUBJECT
    const bodyTemplate = template?.body || DEFAULT_BODY

    const name = targetUser.name?.trim() || normalizedEmail
    const textVariables: Record<string, string> = {
      name,
      email: normalizedEmail,
      link: actionLink,
    }
    const subject = replaceVariables(subjectTemplate, textVariables)
    const textBody = replaceVariables(bodyTemplate, textVariables)
    const htmlBody = replaceVariables(escapeHtml(bodyTemplate), {
      name: escapeHtml(name),
      email: escapeHtml(normalizedEmail),
      link: `<a href="${escapeHtml(actionLink)}">${escapeHtml(actionLink)}</a>`,
    }).replace(/\n/g, '<br>')

    const sendResult = await sendEmailViaResend(normalizedEmail, subject, textBody, htmlBody, resendApiKey)

    if (!sendResult.success) {
      return jsonResponse({ error: `Failed to send sign-in email: ${sendResult.error}` }, 500)
    }

    return jsonResponse({ success: true, message: `Sign-in email sent to ${normalizedEmail}` }, 200)
  } catch (error) {
    console.error('Error in send-sign-in-email function:', error)
    return jsonResponse({ error: (error as Error).message || 'Internal server error' }, 500)
  }
})
