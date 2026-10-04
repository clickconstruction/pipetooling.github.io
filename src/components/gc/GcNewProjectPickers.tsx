import { SearchableSelect, type SearchableSelectOption } from '../SearchableSelect'
import type { GcCustomer } from '../../lib/gcMode/gcModel'
import { pickerFace, pickerGroup, pickerRow } from './GcNewProjectPickerRows'

/**
 * GC mode design spike: the pickers in the New project and new-set windows (the owner, 2026-10-04:
 * "I would like the dropdown to be more attractive, I would like for it to have search"). Each is
 * the app's own SearchableSelect, raised above the window, with type-to-search and rows that show
 * a name in bold and what it is beneath it.
 */

/** Above the windows (z-index 1200), so the list opens over them. */
const OVER_THE_WINDOW = 1300

/** One picker, the way both windows use it. `compact` fits it into a row of small controls. */
export function Picker({
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
  searchPlaceholder,
  compact,
  minListWidth,
  onNoMatch,
  id,
}: {
  value: string
  onChange: (value: string) => void
  options: SearchableSelectOption[]
  placeholder: string
  ariaLabel: string
  searchPlaceholder?: string
  compact?: boolean
  minListWidth?: number
  /** Typing a name the list does not have offers to add it: the words on that button, and what it does. */
  onNoMatch?: { label: (query: string) => string; onSelect: (query: string) => void }
  id?: string
}) {
  return (
    <SearchableSelect
      id={id}
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      listAriaLabel={ariaLabel}
      searchable
      searchReplacesTrigger
      searchPlaceholder={searchPlaceholder ?? 'Type to search'}
      portalZIndex={OVER_THE_WINDOW}
      listMaxHeightPx={compact ? 220 : 280}
      fillViewportHeight={!compact}
      listMinWidthPx={minListWidth ?? (compact ? 240 : 280)}
      triggerMinHeightPx={compact ? 0 : 38}
      listOptionPadding={compact ? '0.4rem 0.6rem' : '0.5rem 0.7rem'}
      triggerStyle={compact ? { padding: '0.2rem 0.45rem', fontSize: '0.8rem' } : undefined}
      {...(onNoMatch ? { noMatchesAction: onNoMatch } : {})}
    />
  )
}

/** The value the customer pickers use for "Someone new". */
export const SOMEONE_NEW = '__new'

/**
 * The owner or the architect, from the one customer list. The ones that fit come first under
 * their own heading (`fits`), then everyone else, then "Someone new". Typing a name the list does
 * not have offers to add it as someone new.
 */
export function CustomerPicker({
  customers,
  value,
  onChange,
  onNewName,
  fits,
  fitsLabel,
  ariaLabel,
}: {
  customers: GcCustomer[]
  value: string
  onChange: (value: string) => void
  onNewName: (name: string) => void
  fits: (c: GcCustomer) => boolean
  fitsLabel: string
  ariaLabel: string
}) {
  const sorted = [...customers].sort((a, b) => a.name.localeCompare(b.name))
  const first = sorted.filter(fits)
  const rest = sorted.filter((c) => !fits(c))
  const row = (c: GcCustomer): SearchableSelectOption => ({
    value: c.id,
    label: [c.name, c.kind, c.contact].filter(Boolean).join(' · '),
    labelContent: pickerRow(c.name, [c.kind, c.contact].filter(Boolean).join(' · ')),
    triggerContent: pickerFace(c.name, c.kind),
  })
  const options: SearchableSelectOption[] = [
    ...(first.length > 0 ? [pickerGroup('fits', fitsLabel), ...first.map(row)] : []),
    ...(rest.length > 0 ? [pickerGroup('rest', first.length > 0 ? 'Everyone else' : 'The customer list'), ...rest.map(row)] : []),
    pickerGroup('new', ''),
    {
      value: SOMEONE_NEW,
      label: 'Someone new',
      labelContent: <span style={{ color: 'var(--text-blue-500)', fontWeight: 600 }}>+ Someone new</span>,
      triggerContent: <span style={{ fontWeight: 600 }}>Someone new</span>,
    },
  ]
  return (
    <Picker
      value={value}
      onChange={onChange}
      options={options}
      placeholder="Pick one"
      ariaLabel={ariaLabel}
      searchPlaceholder="Search by name or kind"
      onNoMatch={{
        label: (q) => `Add "${q.trim()}" as someone new`,
        onSelect: (q) => {
          onChange(SOMEONE_NEW)
          onNewName(q.trim())
        },
      }}
    />
  )
}
