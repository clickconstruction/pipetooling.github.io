/**
 * A sub's company on People → Contracts (punch list #403, step 6). Two pieces:
 *
 *   - `SubCompanyHeadRow`: the company's own row in the table, above its workers. Its name, the tag *Trade company*,
 *     and the line that names its workers, each name a value.
 *   - `SubCompanyLines`: on a sub's opened row, *Their company* and *What they are there*, each a value in place.
 *     The company box offers the trade companies we have, takes a new name, and has **Same as their name** for a
 *     sub whose business carries their own name. Emptying it takes them off.
 *
 * The rules and the words are `src/lib/people/subCompanies.ts`; the calls are `subCompaniesIo.ts`.
 */
import { ChangeableValue, ValueLine, ValueLines, ValueSentence } from '../valuesInPlace/ValuesInPlace'
import {
  SUB_COMPANY_WORDS,
  companyKeepPlan,
  companyKeepPreview,
  companyKeepRefusal,
  companyWorkersLine,
  titleKeepRefusal,
  type CompanyGroup,
  type CompanyPlace,
  type SubCompany,
} from '../../lib/people/subCompanies'
import { keepPersonCompany, keepPersonCompanyTitle } from '../../lib/people/subCompaniesIo'

/** The company's row: its name, its tag, and its workers. */
export function SubCompanyHeadRow({ group }: { group: CompanyGroup }) {
  return (
    <tr data-sub-company-row={group.company.id} style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
      <td colSpan={2} style={{ padding: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{group.company.name}</span>
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 600,
              padding: '0.1rem 0.45rem',
              borderRadius: 999,
              background: 'var(--bg-200)',
              color: 'var(--text-700)',
              whiteSpace: 'nowrap',
            }}
          >
            {SUB_COMPANY_WORDS.tag}
          </span>
        </div>
        <div style={{ marginTop: '0.2rem', fontSize: '0.8125rem', color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>
          <ValueSentence text={companyWorkersLine(group.workers)} />
        </div>
      </td>
    </tr>
  )
}

export type SubCompanyLinesProps = {
  /** The sub's roster row, or null when two roster people share the name. */
  personId: string | null
  personName: string
  /** Where they work now, or undefined for no company. */
  place: CompanyPlace | undefined
  companies: readonly SubCompany[]
  suggestions: readonly string[]
  /** Read the links again after a keep. */
  onKept: () => void | Promise<void>
}

/** *Their company* and *What they are there* on a sub's opened row. */
export function SubCompanyLines({ personId, personName, place, companies, suggestions, onKept }: SubCompanyLinesProps) {
  if (!personId) {
    return <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{SUB_COMPANY_WORDS.notLinkable}</p>
  }
  const current = place?.company.name ?? ''
  return (
    <div data-sub-company-lines onClick={(e) => e.stopPropagation()}>
      <ValueLines>
        <ValueLine label={SUB_COMPANY_WORDS.lineLabel}>
          <ChangeableValue
            text={current || SUB_COMPANY_WORDS.none}
            label={SUB_COMPANY_WORDS.label}
            type="text"
            value={current}
            canClear
            hint={SUB_COMPANY_WORDS.hint}
            suggestions={suggestions}
            fills={[{ label: SUB_COMPANY_WORDS.sameAsName, value: personName }]}
            check={(draft) => companyKeepRefusal(draft)}
            preview={(draft) => companyKeepPreview(draft, companies, current)}
            onKeep={async (typed) => {
              await keepPersonCompany(personId, companyKeepPlan(typed, companies), place?.title || null)
              await onKept()
            }}
          />
        </ValueLine>
        {place ? (
          <ValueLine label={SUB_COMPANY_WORDS.titleLineLabel}>
            <ChangeableValue
              text={place.title || SUB_COMPANY_WORDS.noTitle}
              label={SUB_COMPANY_WORDS.titleLabel}
              type="text"
              value={place.title}
              canClear
              hint={SUB_COMPANY_WORDS.titleHint}
              check={(draft) => titleKeepRefusal(draft)}
              onKeep={async (typed) => {
                await keepPersonCompanyTitle(personId, place.company.id, typed)
                await onKept()
              }}
            />
          </ValueLine>
        ) : null}
      </ValueLines>
    </div>
  )
}
