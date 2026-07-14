import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface InviteUserRequest {
  email: string
  role: string
  name?: string
  /** Where the invite link lands after Supabase verifies it. Must be an allowed app origin; defaults to prod /accept-invite. */
  redirectTo?: string
  /** For estimator/subcontractor/helpers/superintendent role: IDs of service types to restrict. Omit or empty = all. */
  service_type_ids?: string[]
}

const VALID_ROLES = ['dev', 'master_technician', 'assistant', 'subcontractor', 'helpers', 'estimator', 'primary', 'superintendent', 'controller']

const DEFAULT_REDIRECT = 'https://pipetooling.com/accept-invite'
const ALLOWED_REDIRECT = /^(https:\/\/pipetooling\.com\/|http:\/\/localhost:5(173|175)\/)/

// Fallbacks must match the Settings "invitation" template defaults (src/pages/Settings.tsx openEditTemplate).
const DEFAULT_SUBJECT = 'Invitation to join PipeTooling'
const DEFAULT_BODY =
  "Hi {{name}},\n\nYou've been invited to join PipeTooling as a {{role}}. Click the link below to set up your account:\n\n{{link}}\n\nIf you didn't expect this invitation, you can safely ignore this email."

/** Mirrors src/lib/userRoleDisplay.ts displayLabelForUserRole. */
function displayLabelForRole(role: string): string {
  if (role === 'helpers') return 'Helper'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

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
      return jsonResponse({ error: 'Forbidden - Only devs can invite users' }, 403)
    }

    // Parse request body
    const { email, role, name, redirectTo, service_type_ids }: InviteUserRequest = await req.json()

    if (!email || !role) {
      return jsonResponse({ error: 'Missing required fields: email and role' }, 400)
    }

    if (!VALID_ROLES.includes(role)) {
      return jsonResponse({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` }, 400)
    }

    const normalizedEmail = email.trim().toLowerCase()
    const trimmedName = name?.trim() || null

    // Validate and resolve service_type_ids for roles that support restriction
    let serviceTypeIds: string[] | null = null
    if ((role === 'estimator' || role === 'subcontractor' || role === 'helpers' || role === 'superintendent') && service_type_ids && service_type_ids.length > 0) {
      const { data: validTypes, error: typesError } = await supabase
        .from('service_types')
        .select('id')
        .in('id', service_type_ids)
      if (typesError) {
        return jsonResponse({ error: `Error validating service types: ${typesError.message}` }, 400)
      }
      const validIds = (validTypes ?? []).map((r: { id: string }) => r.id)
      const invalidIds = service_type_ids.filter((id) => !validIds.includes(id))
      if (invalidIds.length > 0) {
        return jsonResponse({ error: `Invalid service type IDs: ${invalidIds.join(', ')}` }, 400)
      }
      serviceTypeIds = validIds
    }

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceRoleKey) {
      return jsonResponse({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured. This is required for inviting users.' }, 500)
    }
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      return jsonResponse({ error: 'RESEND_API_KEY not configured. Set it via: supabase secrets set RESEND_API_KEY=your_key' }, 500)
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Duplicate check. A previously invited user who never accepted (never confirmed,
    // never signed in) is replaced so the invite can be re-sent with a fresh link;
    // anyone else is a real duplicate.
    const { data: existingUser, error: checkError } = await adminClient
      .from('users')
      .select('id, email')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (checkError) {
      return jsonResponse({ error: `Error checking for existing user: ${checkError.message}` }, 500)
    }

    if (existingUser) {
      const { data: existingAuth, error: getError } = await adminClient.auth.admin.getUserById(existingUser.id)
      const pendingInvite =
        !getError && existingAuth?.user && !existingAuth.user.email_confirmed_at && !existingAuth.user.last_sign_in_at
      if (!pendingInvite) {
        return jsonResponse({ error: 'User with this email already exists' }, 400)
      }
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(existingUser.id)
      if (deleteError) {
        return jsonResponse({ error: `Could not replace the pending invite for this email: ${deleteError.message}` }, 500)
      }
    }

    const redirect = redirectTo && ALLOWED_REDIRECT.test(redirectTo) ? redirectTo : DEFAULT_REDIRECT

    // generateLink creates the auth user and returns the invite link WITHOUT sending
    // any Supabase SMTP mail — we send the email ourselves through Resend below.
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'invite',
      email: normalizedEmail,
      options: {
        data: { invited_role: role, name: trimmedName || '' },
        redirectTo: redirect,
      },
    })

    if (linkError || !linkData?.user || !linkData?.properties?.action_link) {
      const msg = linkError?.message || 'Unknown error'
      const already = /already|exists|registered/i.test(msg)
      return jsonResponse(
        { error: already ? 'A login already exists for this email address' : `Failed to create invite: ${msg}` },
        already ? 400 : 500,
      )
    }

    const invitedUserId = linkData.user.id
    const actionLink = linkData.properties.action_link

    // Belt-and-braces vs the handle_new_user trigger: write the exact role/name and
    // any service-type restriction (trigger inserts are ON CONFLICT DO NOTHING).
    const userRecord: Record<string, unknown> = {
      id: invitedUserId,
      email: normalizedEmail,
      role: role,
      name: trimmedName,
    }
    if (role === 'estimator' && serviceTypeIds !== null) userRecord.estimator_service_type_ids = serviceTypeIds
    if (role === 'subcontractor' && serviceTypeIds !== null) userRecord.subcontractor_service_type_ids = serviceTypeIds
    if (role === 'helpers' && serviceTypeIds !== null) userRecord.helpers_service_type_ids = serviceTypeIds
    if (role === 'superintendent' && serviceTypeIds !== null) userRecord.superintendent_service_type_ids = serviceTypeIds

    const { error: upsertError } = await adminClient
      .from('users')
      .upsert(userRecord, { onConflict: 'id' })

    if (upsertError) {
      await adminClient.auth.admin.deleteUser(invitedUserId)
      return jsonResponse({ error: `Failed to create user record: ${upsertError.message}` }, 500)
    }

    // Load the editable invitation template (Settings → Templates); fall back to the
    // same defaults Settings seeds when the row has never been saved.
    const { data: template } = await adminClient
      .from('email_templates')
      .select('subject, body')
      .eq('template_type', 'invitation')
      .maybeSingle()

    const subjectTemplate = template?.subject || DEFAULT_SUBJECT
    const bodyTemplate = template?.body || DEFAULT_BODY

    const roleLabel = displayLabelForRole(role)
    const textVariables: Record<string, string> = {
      name: trimmedName || normalizedEmail,
      email: normalizedEmail,
      role: roleLabel,
      link: actionLink,
    }
    const subject = replaceVariables(subjectTemplate, textVariables)
    const textBody = replaceVariables(bodyTemplate, textVariables)
    const htmlBody = replaceVariables(escapeHtml(bodyTemplate), {
      name: escapeHtml(trimmedName || normalizedEmail),
      email: escapeHtml(normalizedEmail),
      role: escapeHtml(roleLabel),
      link: `<a href="${escapeHtml(actionLink)}">${escapeHtml(actionLink)}</a>`,
    }).replace(/\n/g, '<br>')

    const sendResult = await sendEmailViaResend(normalizedEmail, subject, textBody, htmlBody, resendApiKey)

    if (!sendResult.success) {
      // Remove the half-created user (FK cascade cleans public.users) so a retry starts clean.
      await adminClient.auth.admin.deleteUser(invitedUserId)
      return jsonResponse({ error: `Failed to send invite email — nothing was created, please retry: ${sendResult.error}` }, 500)
    }

    return jsonResponse({ success: true, message: `Invite sent to ${normalizedEmail}` }, 200)
  } catch (error) {
    console.error('Error in invite-user function:', error)
    return jsonResponse({ error: (error as Error).message || 'Internal server error' }, 500)
  }
})
