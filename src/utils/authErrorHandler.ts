import { supabase } from '../lib/supabase'

// Check if error is authentication-related
export function isAuthError(error: any): boolean {
  if (!error) return false

  const errorMsg = error.message?.toLowerCase() || ''
  const errorCode = error.code || ''

  return (
    errorCode === 'PGRST301' || // JWT expired
    errorCode === 'PGRST302' || // JWT invalid
    errorMsg.includes('jwt') ||
    errorMsg.includes('expired') ||
    errorMsg.includes('token') ||
    errorMsg.includes('invalid token') ||
    errorMsg.includes('row-level security') ||
    errorMsg.includes('permission denied')
  )
}

// Global handler for auth errors
export async function handleAuthError(): Promise<void> {
  console.warn('Authentication error detected - signing out user')
  await supabase.auth.signOut()
  
  // Store message for sign-in page
  sessionStorage.setItem('auth_error_message', 'Your session expired. Please sign in again to continue.')
  
  // Redirect to sign-in
  window.location.href = '/sign-in'
}

// Wrapper for Supabase queries with automatic auth error handling
export async function safeQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>
): Promise<{ data: T | null; error: any }> {
  const result = await queryFn()
  
  if (result.error && isAuthError(result.error)) {
    await handleAuthError()
  }
  
  return result
}
