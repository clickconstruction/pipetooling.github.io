/**
 * A job's insurance sheet on a trade partner's own page (punch list #404, step 5), under their certificate's line in
 * *Your paperwork*: for each job whose sheet was sent to them, who the certificate must name, **Open the sheet** and
 * **Send it to my insurance agent**. The app already asks a trade for its certificate. This is the missing first half:
 * what the certificate must show on this job.
 *
 * Opening the sheet tells the office it was opened. The page it sits on hands the sheets down through the context,
 * and draws nothing for a company that was sent none.
 */
import { createContext, useContext, useState } from 'react'
import { MUTED } from '../../lib/portal/portalTheme'
import { documentBuilderLinkUrl } from '../../lib/documentBuilder/link'
import { agentMailto, mustNameLine, tradeSheetWords, type TradeSheet, type TradeSheetLang } from '../../lib/documentBuilder/tradePageSheets'
import { Btn, Chip } from '../gc/gcUi'
import { SheetPaperRead } from './SheetPaper'

export type TradeSheetsValue = {
  sheets: TradeSheet[]
  /** The company opened a sheet: the office is told, unless this is a preview or a teammate's look. */
  opened: (sheetId: string) => void
}

export const TradeSheetsContext = createContext<TradeSheetsValue>({ sheets: [], opened: () => {} })

export function TradePageSheets({ lang }: { lang: TradeSheetLang }) {
  const { sheets, opened } = useContext(TradeSheetsContext)
  const [open, setOpen] = useState<string | null>(null)
  if (sheets.length === 0) return null
  const t = (key: Parameters<typeof tradeSheetWords>[1], fill?: Record<string, string>) => tradeSheetWords(lang, key, fill)
  return (
    <div data-trade-sheets="" style={{ display: 'grid', gap: '0.6rem', paddingLeft: '0.75rem', borderLeft: `2px solid ${MUTED}` }}>
      <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>{t('title')}</div>
      {sheets.map((s) => {
        const mail = agentMailto(lang, s, window.location.origin)
        const isOpen = open === s.sheetId
        return (
          <div key={s.sheetId} style={{ display: 'grid', gap: '0.35rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem 0.5rem', alignItems: 'center' }}>
              <b>{s.job}</b>
              {s.changed ? <Chip tone="amber">{t('changed')}</Chip> : !s.opened ? <Chip tone="blue">{t('isNew')}</Chip> : null}
            </div>
            <div style={{ fontSize: '0.85rem', color: MUTED }}>{mustNameLine(lang, s.sheet.insured)}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
              <Btn
                kind={s.opened && !s.changed ? 'plain' : 'primary'}
                wrap
                onClick={() => {
                  if (isOpen) {
                    setOpen(null)
                    return
                  }
                  setOpen(s.sheetId)
                  opened(s.sheetId)
                }}
              >
                {t(isOpen ? 'close' : 'open')}
              </Btn>
              {mail ? (
                <a href={mail} style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                  {t('agent')}
                </a>
              ) : null}
            </div>
            {isOpen ? (
              <div style={{ display: 'grid', gap: '0.35rem' }}>
                <SheetPaperRead sheet={s.sheet} stamp={`Revision ${s.revision} · ${s.job}`} />
                {s.linkCode ? (
                  <a href={documentBuilderLinkUrl(window.location.origin, s.linkCode)} target="_blank" rel="noreferrer" style={{ fontSize: '0.85rem' }}>
                    {t('ownPage')}
                  </a>
                ) : null}
                {lang === 'es' ? <div style={{ fontSize: '0.8rem', color: MUTED }}>{t('english')}</div> : null}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
