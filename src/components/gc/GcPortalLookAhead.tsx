import { useState, type Dispatch } from 'react'
import {
  GC_COMPANY,
  portalLookAhead,
  pWeekday,
  type GcAction,
  type GcProject,
  type GcState,
  type LookAheadReason,
  type Partner,
  type PortalKey,
  type PortalLookAheadItem,
  type PortalWeekWhen,
} from '../../lib/gcMode/gcModel'
import { Btn, Chip, input } from './gcUi'
import { PortalBlock } from './GcPortalUi'
import { usePortalLang } from './gcPortalLang'

/**
 * GC mode design spike: the weekly look-ahead in a trade's portal (owner, 2026-10-02). Three weeks
 * of the company's activities from our schedule: this week to mark at its end, the next two to
 * see coming, and last week while anything in it is unmarked. A mark waits on our superintendent,
 * and only a verified mark counts. The company can change its mark until then.
 */

const GC = GC_COMPANY.shortName
const RULE = '#d9d2c3'

const REASON_WORDS: Record<LookAheadReason, PortalKey> = {
  weather: 'reasonWeather',
  'trade before': 'reasonTradeBefore',
  materials: 'reasonMaterials',
  crew: 'reasonCrew',
  other: 'reasonOther',
}

const WEEK_WORDS: Record<PortalWeekWhen, PortalKey> = { last: 'weekLast', this: 'weekThis', next: 'weekNext', later: 'weekLater' }

export function GcPortalLookAhead({
  state,
  project,
  partner,
  dispatch,
}: {
  state: GcState
  project: GcProject
  partner: Partner
  dispatch: Dispatch<GcAction>
}) {
  const { lang, t } = usePortalLang()
  const weeks = portalLookAhead(state, partner.id, project)
  if (weeks.length === 0) return null
  const trades = new Set(weeks.flatMap((w) => w.items.map((i) => i.row.trade)))

  return (
    <PortalBlock title={t('lookTitle')}>
      <div style={{ display: 'grid', gap: '0.6rem', fontSize: '0.9rem' }}>
        <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>{t('lookIntro', { gc: GC })}</div>
        {weeks.map((w) => (
          <div key={w.weekOf} style={{ display: 'grid', gap: '0.35rem', borderTop: `1px solid ${RULE}`, paddingTop: '0.45rem' }}>
            <div style={{ fontWeight: 700, color: w.when === 'last' ? 'var(--text-amber-800)' : undefined }}>
              {t(WEEK_WORDS[w.when], { date: pWeekday(lang, w.weekOf) })}
            </div>
            {w.items.length === 0 && <div style={{ opacity: 0.7 }}>{t('nothingThisWeek')}</div>}
            {w.items.map((item) => (
              <Item
                key={`${w.weekOf}:${item.row.activity.lineId}`}
                item={item}
                showTrade={trades.size > 1}
                onMark={(done, reason) =>
                  dispatch({
                    type: 'tradeMarkLookAhead',
                    projectId: project.id,
                    packageId: item.row.pkg.id,
                    lineId: item.row.activity.lineId,
                    weekOf: w.weekOf,
                    done,
                    ...(reason ? { reason } : {}),
                  })
                }
              />
            ))}
          </div>
        ))}
      </div>
    </PortalBlock>
  )
}

function Item({
  item,
  showTrade,
  onMark,
}: {
  item: PortalLookAheadItem
  showTrade: boolean
  onMark: (done: boolean, reason?: LookAheadReason) => void
}) {
  const { lang, t } = usePortalLang()
  const [editing, setEditing] = useState(false)
  const [notDone, setNotDone] = useState(false)
  const [reason, setReason] = useState<LookAheadReason>('weather')
  const { row, mark } = item
  const verified = Boolean(mark?.verifiedOn)
  const counted = verified ? (mark?.verifiedDone ?? mark?.done) : undefined
  const asking = item.canMark && (mark === null || editing)

  return (
    <div style={{ display: 'grid', gap: '0.3rem' }}>
      <div>
        <strong>{row.label}</strong>
        {showTrade && <span style={{ opacity: 0.75 }}> · {row.trade}</span>}
        <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>
          {t('planned', { start: pWeekday(lang, row.activity.start), finish: pWeekday(lang, row.activity.finish) })}
        </div>
      </div>

      {verified && mark && (
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Chip tone={counted ? 'green' : 'red'}>{t(counted ? 'checkedDone' : 'checkedNot', { gc: GC })}</Chip>
          {mark.verifiedDone !== undefined && mark.verifiedDone !== mark.done && (
            <span style={{ fontSize: '0.8rem', opacity: 0.75 }}>{t('checkedDiffers', { mark: t(mark.done ? 'markWordDone' : 'markWordNot') })}</span>
          )}
        </div>
      )}

      {!verified && mark && !asking && (
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Chip tone="grey">
            {mark.done ? t('youMarkedDone', { gc: GC }) : t('youMarkedNot', { gc: GC, reason: t(REASON_WORDS[mark.reason ?? 'other']) })}
          </Chip>
          {item.canMark && (
            <Btn kind="quiet" onClick={() => setEditing(true)}>
              {t('changeMark')}
            </Btn>
          )}
        </div>
      )}

      {asking && !notDone && (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <Btn
            kind="primary"
            onClick={() => {
              onMark(true)
              setEditing(false)
            }}
          >
            {t('markDone')}
          </Btn>
          <Btn onClick={() => setNotDone(true)}>{t('markNotDone')}</Btn>
        </div>
      )}

      {asking && notDone && (
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
            {t('whyNot')}
            <select value={reason} onChange={(e) => setReason(e.target.value as LookAheadReason)} style={{ ...input, width: 'auto' }}>
              {(Object.keys(REASON_WORDS) as LookAheadReason[]).map((r) => (
                <option key={r} value={r}>
                  {t(REASON_WORDS[r])}
                </option>
              ))}
            </select>
          </label>
          <Btn
            kind="primary"
            onClick={() => {
              onMark(false, reason)
              setNotDone(false)
              setEditing(false)
            }}
          >
            {t('sendMark')}
          </Btn>
          <Btn kind="quiet" onClick={() => setNotDone(false)}>
            {t('notNow')}
          </Btn>
        </div>
      )}
    </div>
  )
}
