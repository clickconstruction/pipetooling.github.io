import { supabase } from './supabase'
import { formatErrorMessage } from '../utils/errorHandling'
import { normalizeCustomerAttachmentUrl } from './estimateCustomerAttachment'

export const GOOGLE_DRIVE_LINK_CHECK_LIKELY_OK_HTML_COPY =
  'Works! — you should open the link in a private or incognito window to be sure.'

export type GoogleDriveLinkCheckStatus = 'success' | 'warn' | 'error'

export type GoogleDriveLinkCheckResult = {
  status: GoogleDriveLinkCheckStatus
  message: string
}

/**
 * Heuristic probe via Edge Function (Google Drive/Docs URLs only). Same behavior as Estimates "Check link".
 */
export async function checkGoogleDriveAttachmentUrl(rawUrl: string): Promise<GoogleDriveLinkCheckResult> {
  const u = normalizeCustomerAttachmentUrl(rawUrl)
  if (!u) {
    return { status: 'error', message: 'Invalid or empty URL (https only).' }
  }
  try {
    const { data: sess } = await supabase.auth.getSession()
    const jwt = sess.session?.access_token
    if (!jwt) {
      return { status: 'error', message: 'Not signed in.' }
    }
    const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-estimate-attachment-url`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
          apikey: anon,
        },
        body: JSON.stringify({ url: u }),
      },
    )
    const json = (await res.json()) as {
      ok?: boolean
      result?: 'likely_public' | 'likely_ok_html' | 'likely_restricted' | 'unknown'
      message?: string
      error?: string
    }
    if (!res.ok) {
      return { status: 'error', message: json.error || `Check failed (${res.status}).` }
    }
    if (!json.ok) {
      return { status: 'error', message: json.error || 'Check failed.' }
    }
    const r = json.result
    const extra =
      ' This check is a best-effort hint only — open the link in a private or incognito window to be sure.'
    if (r === 'likely_public' || r === 'likely_ok_html') {
      if (r === 'likely_ok_html') {
        const m = json.message?.trim()
        return { status: 'success', message: m || GOOGLE_DRIVE_LINK_CHECK_LIKELY_OK_HTML_COPY }
      }
      return {
        status: 'success',
        message: (json.message ? json.message : 'Likely viewable without signing in.') + extra,
      }
    }
    return {
      status: 'warn',
      message:
        (json.message ||
          (r === 'likely_restricted'
            ? 'This link may require sign-in or permission.'
            : 'Could not tell from the response — verify sharing.')) + extra,
    }
  } catch (e) {
    return { status: 'error', message: formatErrorMessage(e, 'Check failed') }
  }
}
