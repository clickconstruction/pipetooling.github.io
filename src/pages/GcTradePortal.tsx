import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { GcTradePortalView } from '../components/gc/GcTradePortalView'
import { GC_COMPANY } from '../lib/gc/company'
import { portalShownLang, pt, type PortalLang } from '../lib/gc/portalI18n'
import { readTradePortalAnswer, sentMessages, setDriveUrl, type TradePortalAnswer } from '../lib/gc/tradePortalPage'
import { tradePortalState } from '../lib/gc/tradePortalState'
import { staffAwarePublicHeaders } from '../lib/publicFunctionStaffHeaders'
import { PUBLIC_PREVIEW_PARAM, isPreviewFlag } from '../lib/publicViewCounting'
import { INK, PAPER, PORTAL_FONT } from '../lib/portal/portalTheme'

/**
 * GC mode, the trade partner portal (P1b-ii-b, to-dos/gc-mode/PORTAL_REAL_BUILD.md): the no-password page a company
 * opens at `/t/<link>`. One link per company, made by a dev until the door. It reads `gc-trade-portal` once,
 * maps the company's slice into the prototype's shapes (`tradePortalState.ts`) and draws it read only. The
 * presses come with the submit function (P2b). Pinned light like every page that opens without a sign-in, and
 * in the company's language once Spanish is on (`portalShownLang`).
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string

type PageState = { kind: 'loading' } | TradePortalAnswer

export default function GcTradePortal() {
  const { token = '' } = useParams<{ token: string }>()
  const [params] = useSearchParams()
  const preview = isPreviewFlag(params.get(PUBLIC_PREVIEW_PARAM))
  const [page, setPage] = useState<PageState>({ kind: 'loading' })
  const [tries, setTries] = useState(0)

  useEffect(() => {
    let live = true
    setPage({ kind: 'loading' })
    void (async () => {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/gc-trade-portal?t=${encodeURIComponent(token)}${preview ? `&${PUBLIC_PREVIEW_PARAM}=1` : ''}`, { headers: await staffAwarePublicHeaders() })
        const body = (await res.json().catch(() => null)) as unknown
        if (live) setPage(readTradePortalAnswer(res.ok, body))
      } catch {
        if (live) setPage({ kind: 'error', key: 'linkFailed' })
      }
    })()
    return () => {
      live = false
    }
  }, [token, preview, tries])

  const ready = page.kind === 'ready' ? page : null
  const mapped = useMemo(() => (ready ? tradePortalState(ready.slice, ready.today) : null), [ready])
  const messages = useMemo(() => (ready ? sentMessages(ready.slice) : []), [ready])
  const planUrl = useCallback((projectId: string, rev: number) => (ready ? setDriveUrl(ready.slice, projectId, rev) : ''), [ready])
  const lang: PortalLang = portalShownLang(mapped?.lang ?? 'en')
  const retry = () => setTries((n) => n + 1)

  return (
    <main data-theme="light" style={{ minHeight: '100vh', background: PAPER, color: INK, fontFamily: PORTAL_FONT, padding: '16px 16px 32px', boxSizing: 'border-box' }}>
      {page.kind === 'loading' ? (
        <p style={{ textAlign: 'center', marginTop: '3rem' }}>{pt(lang, 'portalOpening')}</p>
      ) : page.kind === 'error' ? (
        <div role="alert" style={{ maxWidth: 520, margin: '3rem auto 0', display: 'grid', gap: '0.75rem', justifyItems: 'center', textAlign: 'center' }}>
          <p style={{ margin: 0 }}>{pt(lang, page.key, { gc: GC_COMPANY.name })}</p>
          {page.key === 'linkFailed' && (
            <button type="button" onClick={retry} style={{ minHeight: 44, padding: '0.4rem 1rem', borderRadius: 6, border: 'none', background: INK, color: PAPER, fontWeight: 600, cursor: 'pointer' }}>
              {pt(lang, 'tryAgain')}
            </button>
          )}
        </div>
      ) : mapped ? (
        <GcTradePortalView
          state={mapped.state}
          partnerId={mapped.partnerId}
          lang={lang}
          messages={messages}
          planUrl={planUrl}
          banner={page.sample ? pt(lang, 'samplePortal') : preview ? pt(lang, 'officePreview') : undefined}
        />
      ) : null}
    </main>
  )
}
