import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { POST_LOGIN_REDIRECT_KEY } from '../lib/iosPwa'
import { FILE_OPEN_WORDS, fileRouteOf } from '../lib/files/fileRoute'
import { fileTarget, goToFile } from '../lib/files/fileOpenIo'

type Shown = 'opening' | keyof typeof FILE_OPEN_WORDS

/**
 * `/files/<source>/<id>`: a kept file's lasting link (`lib/files/fileRoute.ts`). Signed in, it reads where the file is
 * as the reader (`fileOpenIo.ts`) and goes there in place of this page. Signed out, it asks for a sign-in and comes back
 * here after it. No app chrome: the page shows only while it opens the file, or the words for why it cannot.
 */
export default function FileOpen() {
  const { pathname } = useLocation()
  const { user, loading } = useAuth()
  const [shown, setShown] = useState<Shown>('opening')
  const userId = user?.id ?? null

  useEffect(() => {
    if (loading) return
    const route = fileRouteOf(pathname)
    if (!route) {
      setShown('notHere')
      return
    }
    if (!userId) {
      try {
        localStorage.setItem(POST_LOGIN_REDIRECT_KEY, pathname)
      } catch {
        /* ignore */
      }
      setShown('signIn')
      return
    }
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
  }, [loading, userId, pathname])

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
