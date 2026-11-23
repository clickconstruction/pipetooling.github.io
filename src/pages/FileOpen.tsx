import { Suspense, lazy, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { browserReturnAddressStore, keepReturnAddress } from '../lib/signInReturnAddress'
import { FILE_OPEN_WORDS, fileRouteOf } from '../lib/files/fileRoute'
import { fileTarget, goToFile } from '../lib/files/fileOpenIo'

// The bill viewer draws PDFs, so it loads only when a bill's link is opened.
const BillOpen = lazy(() => import('./BillOpen'))

type Shown = 'opening' | keyof typeof FILE_OPEN_WORDS

/**
 * `/files/<source>/<id>`: a kept file's lasting link (`lib/files/fileRoute.ts`). Signed in, it reads where the file is
 * as the reader (`fileOpenIo.ts`) and goes there in place of this page. Signed out, it asks for a sign-in and comes back
 * here after it. No app chrome: the page shows only while it opens the file, or the words for why it cannot.
 *
 * A supply house bill's link (`bills`, punch list #431) does not leave the app: signed in, the page is the bill viewer
 * (`BillOpen.tsx`), which reads the bill as the reader and says the same words when they may not open it.
 */
export default function FileOpen() {
  const { pathname, search } = useLocation()
  const { user, loading } = useAuth()
  const [shown, setShown] = useState<Shown>('opening')
  const userId = user?.id ?? null
  const route = fileRouteOf(pathname)
  const billId = !loading && userId && route?.source === 'bills' ? route.id : null

  useEffect(() => {
    if (loading) return
    const route = fileRouteOf(pathname)
    if (!route) {
      setShown('notHere')
      return
    }
    if (!userId) {
      // With what follows the path: a bill's link names its job there, and the sign-in should come back to both.
      keepReturnAddress(browserReturnAddressStore(), `${pathname}${search}`)
      setShown('signIn')
      return
    }
    // A bill is drawn here, in the viewer below: nothing to go to.
    if (route.source === 'bills') return
    let live = true
    setShown('opening')
    fileTarget(route).then(
      (target) => {
        if (!live) return
        if ('url' in target) goToFile(target.url)
        else setShown(target.problem)
      },
      () => {
        if (live) setShown('notHere')
      },
    )
    return () => {
      live = false
    }
  }, [loading, userId, pathname, search])

  const opening = (
    <div style={{ padding: '3rem 1rem', textAlign: 'center' }} data-file-open="opening">
      <p style={{ margin: 0, color: 'var(--text-muted)' }}>Opening the file…</p>
    </div>
  )
  if (billId) {
    return (
      <Suspense fallback={opening}>
        <BillOpen invoiceId={billId} />
      </Suspense>
    )
  }

  return (
    <div style={{ padding: '3rem 1rem', textAlign: 'center' }} data-file-open={shown}>
      <p style={{ margin: 0, color: shown === 'opening' ? 'var(--text-muted)' : undefined }}>{shown === 'opening' ? 'Opening the file…' : FILE_OPEN_WORDS[shown]}</p>
      {shown === 'signIn' ? (
        <p style={{ marginTop: '1rem' }}>
          <Link to="/sign-in" style={{ color: 'var(--text-link)' }}>
            Sign in
          </Link>
        </p>
      ) : null}
    </div>
  )
}
