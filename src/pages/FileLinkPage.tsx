import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { fileLinkRequestUrl, fileLinkTokenShape, fileLinkView, readFileLinkAnswer, type FileLinkAnswer, type FileLinkView } from '../lib/documents/fileLinkPage'
import { GC_COMPANY } from '../lib/gc/company'
import { portalShownLang } from '../lib/gc/portalI18n'
import { INK, MUTED, PAPER, PORTAL_FONT } from '../lib/portal/portalTheme'
import { staffAwarePublicHeaders } from '../lib/publicFunctionStaffHeaders'
import { PUBLIC_PREVIEW_PARAM, isPreviewFlag } from '../lib/publicViewCounting'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string

/** How the page hands a person over to the file. `replace`, so Back does not open the link again and count it twice. */
export type FileLinkGo = (url: string) => void
const goTo: FileLinkGo = (url) => window.location.replace(url)

/**
 * Messages, cut 7d: `/f/<link>`, the page a file's own link opens, with no sign-in (`files-out-mockups.html`, screen
 * 7). It asks `drive-link`'s open door once, which counts the open (a teammate signed in on this browser, or the
 * office's `?preview=1`, is stamped and not counted, as on the portals), then forwards to the file: Drive's own viewer
 * for a file in the job's Plans half, the function's stream for a Team only file. A link cut off, ended, unknown or too
 * big says so instead. Every word is `documents/fileLinkPage.ts`'s, in the portal's language rule.
 *
 * The open door names the file only. The job's name and our phone join the words when its answer carries them.
 */
export default function FileLinkPage({ go = goTo }: { go?: FileLinkGo }) {
  const { link = '' } = useParams()
  const [params] = useSearchParams()
  const preview = isPreviewFlag(params.get(PUBLIC_PREVIEW_PARAM))
  const lang = portalShownLang('en')
  const [view, setView] = useState<FileLinkView | null>(null)
  const [attempt, setAttempt] = useState(0)
  // One read per attempt: React's development double run would otherwise count the open twice.
  const asked = useRef<string | null>(null)

  useEffect(() => {
    const key = `${link}:${preview}:${attempt}`
    if (asked.current === key) return
    asked.current = key
    if (!fileLinkTokenShape(link)) {
      setView(fileLinkView({ kind: 'off', why: 'unknown' }, lang, GC_COMPANY.name))
      return
    }
    setView(null)
    void (async () => {
      let answer: FileLinkAnswer | null = null
      try {
        const res = await fetch(fileLinkRequestUrl(supabaseUrl, link, preview), { headers: await staffAwarePublicHeaders() })
        answer = readFileLinkAnswer(await res.json().catch(() => null))
      } catch {
        answer = null
      }
      const next = fileLinkView(answer, lang, GC_COMPANY.name)
      setView(next)
      if (next.step === 'opening') go(next.go)
    })()
  }, [link, preview, attempt, lang, go])

  const [first, ...rest] = view?.lines ?? []

  return (
    <main data-theme="light" data-file-link style={{ minHeight: '100vh', background: PAPER, color: INK, fontFamily: PORTAL_FONT, padding: '16px 16px 32px', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 480, margin: '3rem auto 0', display: 'grid', gap: '0.6rem', textAlign: 'center', justifyItems: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: '1.05rem', letterSpacing: '0.01em' }}>{GC_COMPANY.name}</div>
        {view && (
          <div role={view.step === 'opening' ? 'status' : 'alert'} data-file-link-step={view.step} style={{ display: 'grid', gap: '0.35rem' }}>
            <p style={{ margin: 0, fontSize: '1rem', overflowWrap: 'anywhere' }}>{first}</p>
            {rest.map((line) => (
              <p key={line} style={{ margin: 0, fontSize: '0.85rem', color: MUTED }}>
                {line}
              </p>
            ))}
          </div>
        )}
        {view?.step === 'failed' && (
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            style={{ minHeight: 44, padding: '0.4rem 1rem', borderRadius: 6, border: 'none', background: INK, color: PAPER, fontWeight: 600, cursor: 'pointer' }}
          >
            {view.retry}
          </button>
        )}
      </div>
    </main>
  )
}
