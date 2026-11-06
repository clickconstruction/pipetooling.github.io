import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'
import { humanRoleLabel } from '../_shared/roleLabels.ts'
import { ensureLinkedRosterRow } from '../_shared/rosterRow.ts'
import { refuseArchivedCaller } from '../_shared/refuseArchivedCaller.ts'

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
  /** Start the account in training mode (`users.read_only = true`): they browse everything their role sees, every write is blocked. Default false. */
  read_only?: boolean
  /** v2.3701 Hire: the employment start date (YYYY-MM-DD) written on the roster row the invite creates. */
  start_date?: string
}

const VALID_ROLES = ['dev', 'master_technician', 'assistant', 'subcontractor', 'helpers', 'estimator', 'primary', 'superintendent', 'controller']

const DEFAULT_REDIRECT = (Deno.env.get('APP_ORIGIN')?.trim() || 'https://pipetooling.com').replace(/\/+$/, '') + '/accept-invite' // domain-cutover flip point (docs/DOMAIN_CUTOVER.md)
const ALLOWED_REDIRECT = /^(https:\/\/(pipetooling|clicktooling)\.com\/|http:\/\/localhost:5(173|175)\/)/

// Fallbacks must match the Settings "invitation" template defaults (src/pages/Settings.tsx openEditTemplate).
const DEFAULT_SUBJECT = 'Invitation to join ClickTooling'
const DEFAULT_BODY =
  "Hi {{name}},\n\nYou've been invited to join ClickTooling as a {{role}}. Click the link below to set up your account:\n\n{{link}}\n\nIf you didn't expect this invitation, you can safely ignore this email."

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

/** A password nobody is told: the invite link sets the real one. */
function unguessablePassword(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('') + 'aA1!'
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
    const { email, role, name, redirectTo, service_type_ids, read_only, start_date }: InviteUserRequest = await req.json()
    if (start_date !== undefined && (typeof start_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(start_date))) {
      return jsonResponse({ error: 'start_date must be YYYY-MM-DD' }, 400)
    }

    if (!email || !role) {
      return jsonResponse({ error: 'Missing required fields: email and role' }, 400)
    }

    if (!VALID_ROLES.includes(role)) {
      return jsonResponse({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` }, 400)
    }

    if (read_only !== undefined && typeof read_only !== 'boolean') {
      return jsonResponse({ error: 'read_only must be true or false' }, 400)
    }
    const startInTraining = read_only === true

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
    const archivedRefusal = await refuseArchivedCaller(adminClient, authUser?.id, corsHeaders)
    if (archivedRefusal) return archivedRefusal

    // Duplicate check. A previously invited user who never accepted (never confirmed,
    // never signed in) is replaced so the invite can be re-sent with a fresh link;
    // anyone else is a real duplicate.
    const { data: existingUser, error: checkError } = await adminClient
      .from('users')
      .select('id, email, name, login_attached_at')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (checkError) {
      return jsonResponse({ error: `Error checking for existing user: ${checkError.message}` }, 500)
    }

    let reinviteUserId: string | null = null
    if (existingUser && (existingUser as { login_attached_at?: string | null }).login_attached_at == null) {
      // v2.6518 (punch list #260): a person on the roster with no login behind their row. The invite would mint a second
      // id; the login belongs on theirs — Attach a login on their desk makes it there and sends the sign-in email.
      const who = ((existingUser as { name?: string | null }).name ?? '').trim() || 'This person'
      return jsonResponse({ error: `${who} is on the roster with no login. Attach a login from their desk instead, so their hours and pay stay on the same person.` }, 400)
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
      // v2.6530 (punch list #265): the users row and its roster record stay — the key is ON DELETE RESTRICT now, and
      // the row is the person. Deleting the auth account detached it (v2.6511); the fresh invite is made on the same id
      // below, so the sign-in lands where the person already is.
      reinviteUserId = existingUser.id
    }

    const redirect = redirectTo && ALLOWED_REDIRECT.test(redirectTo) ? redirectTo : DEFAULT_REDIRECT

    // v2.6530: a re-invite is made on the person's own id first (GoTrue's admin create takes `id`; handle_new_user
    // re-attaches the row), unconfirmed, so the invite link below sets their password as a first invite does.
    if (reinviteUserId) {
      const { error: remakeError } = await adminClient.auth.admin.createUser({
        id: reinviteUserId,
        email: normalizedEmail,
        password: unguessablePassword(),
        email_confirm: false,
        user_metadata: { invited_role: role, name: trimmedName || '' },
      })
      if (remakeError) return jsonResponse({ error: `Could not re-invite on the same person: ${remakeError.message}` }, 500)
    }

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

    // Belt-and-braces vs the handle_new_user trigger: write the exact role/name, the
    // training-mode flag, and any service-type restriction (trigger inserts are ON CONFLICT
    // DO NOTHING). Service-role writes pass users_guard_privileged_columns (auth.uid() is NULL).
    const userRecord: Record<string, unknown> = {
      id: invitedUserId,
      email: normalizedEmail,
      role: role,
      name: trimmedName,
      read_only: startInTraining,
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

    // Born linked (v2.3701): the roster row, created or linked now, owned by the inviting dev.
    const roster = await ensureLinkedRosterRow(adminClient, {
      userId: invitedUserId,
      email: normalizedEmail,
      name: trimmedName,
      role,
      masterUserId: authUser.id,
      startDate: start_date,
    })
    if (roster.error) console.error('invite-user: roster row not written:', roster.error)

    // Load the editable invitation template (Settings → Templates); fall back to the
    // same defaults Settings seeds when the row has never been saved.
    const { data: template } = await adminClient
      .from('email_templates')
      .select('subject, body')
      .eq('template_type', 'invitation')
      .maybeSingle()

    const subjectTemplate = template?.subject || DEFAULT_SUBJECT
    const bodyTemplate = template?.body || DEFAULT_BODY

    const roleLabel = humanRoleLabel(role)
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

    return jsonResponse(
      { success: true, message: `Invite sent to ${normalizedEmail}`, read_only: startInTraining, user_id: invitedUserId, person_id: roster.personId, roster_row: roster.linked },
      200,
    )
  } catch (error) {
    console.error('Error in invite-user function:', error)
    return jsonResponse({ error: (error as Error).message || 'Internal server error' }, 500)
  }
})
