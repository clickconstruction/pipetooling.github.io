import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import {
  SIGN_IN_PATH,
  applyGateMemory,
  browserReturnAddressStore,
  forgetStoredReturnAddress,
  gateMemory,
  readStoredReturnAddress,
  signedInDestination,
} from '../lib/signInReturnAddress'

/**
 * The two ends of the sign-in's return address (v2.7182, `src/lib/signInReturnAddress.ts`).
 * `SignedOutGate` is what a protected route draws for a visitor with no session: it keeps the address they asked for,
 * then sends them to sign in. `LeaveSignIn` is what the sign-in route draws for a signed-in person: it sends them to
 * that address, or to their landing, and spends the address.
 */

/**
 * A protected route with no user. `hadSession` is true when this visit held a session before (a press on Sign out, a
 * session that ended): then nothing is kept, so the next person at this browser does not land on the last one's page.
 */
export function SignedOutGate({ hadSession }: { hadSession: boolean }) {
  const { pathname, search, hash } = useLocation()
  useEffect(() => {
    applyGateMemory(browserReturnAddressStore(), gateMemory({ pathname, search, hash }, hadSession))
  }, [pathname, search, hash, hadSession])
  return <Navigate to={SIGN_IN_PATH} replace />
}

/**
 * The sign-in route with a user. The address is read in the render and spent in the effect: StrictMode renders twice,
 * and a read that also removed the address left the second render the default page.
 */
export function LeaveSignIn({ landing }: { landing: string }) {
  const { search } = useLocation()
  const dest = signedInDestination({ search, stored: readStoredReturnAddress(browserReturnAddressStore()), landing })
  useEffect(() => {
    forgetStoredReturnAddress(browserReturnAddressStore())
  }, [])
  return <Navigate to={dest} replace />
}
