/**
 * Pipeline "Section tools" dropdown (stage jump bar, Jobs → Pipeline).
 *
 * The stage section headers down the board carry action buttons (Capable of
 * Being Billed, GC Review, Accounts Receivable, Share / Print, the two
 * notification settings). This kernel builds the dropdown's grouped item list
 * so the jump bar can offer the same tools without scrolling. Visibility and
 * disabled semantics mirror the section headers exactly:
 * - Capable of Being Billed: everyone who can see the board.
 * - GC Review: everyone; disabled while Billed + Collections are both empty.
 * - Accounts Receivable: rendered for everyone, disabled unless
 *   dev / master_technician / assistant-like / primary (same as the header).
 * - Share / Print: dev / master_technician / assistant-like only.
 * - Paid notifications + Paid In Full notifications: dev / master_technician only.
 */
import { isAssistantLike } from '../subcontractorLikeRole'

export type StagesSectionToolKey =
  | 'capable-to-bill'
  | 'gc-review'
  | 'accounts-receivable'
  | 'billed-share-print'
  | 'paid-notifications'
  | 'paid-in-full-notifications'

export type StagesSectionToolItem = {
  key: StagesSectionToolKey
  label: string
  title: string
  disabled: boolean
  /** Amber count bubble (Accounts Receivable unallocated bank transactions). */
  badgeCount?: number
}

export type StagesSectionToolsGroup = {
  /** Stage section heading the tool lives under on the board. */
  section: string
  items: StagesSectionToolItem[]
}

export type StagesSectionToolsMenuInput = {
  authRole: string | null
  billedRowCount: number
  collectionsRowCount: number
  arBankTxUnallocatedCount: number | null
  /** Preformatted dollars (no cents), e.g. "12,345". */
  capableToBillTotalFormatted: string
}

export function buildStagesSectionToolsMenu(input: StagesSectionToolsMenuInput): StagesSectionToolsGroup[] {
  const { authRole } = input
  const isDevOrMaster = authRole === 'dev' || authRole === 'master_technician'
  const canOpenAccountsReceivable = isDevOrMaster || isAssistantLike(authRole) || authRole === 'primary'
  const canSharePrint = isDevOrMaster || isAssistantLike(authRole)

  const groups: StagesSectionToolsGroup[] = []

  groups.push({
    section: 'Working',
    items: [
      {
        key: 'capable-to-bill',
        label: `Capable of Being Billed: $${input.capableToBillTotalFormatted}`,
        title: 'Working jobs whose progress can already be billed',
        disabled: false,
      },
    ],
  })

  const billedItems: StagesSectionToolItem[] = [
    {
      key: 'gc-review',
      label: 'GC Review',
      title: 'Billed Awaiting Payment grouped by GC/Builder with bill-out dates',
      disabled: input.billedRowCount === 0 && input.collectionsRowCount === 0,
    },
    {
      key: 'accounts-receivable',
      label: 'Accounts Receivable',
      title: 'Apply bank deposits to billed lines (non-Stripe)',
      disabled: !canOpenAccountsReceivable,
      ...(typeof input.arBankTxUnallocatedCount === 'number' && input.arBankTxUnallocatedCount > 0
        ? { badgeCount: input.arBankTxUnallocatedCount }
        : {}),
    },
  ]
  if (canSharePrint) {
    billedItems.push({
      key: 'billed-share-print',
      label: 'Share / Print',
      title: 'Email this report to a teammate — now or scheduled — or print it',
      disabled: false,
    })
  }
  if (isDevOrMaster) {
    billedItems.push({
      key: 'paid-notifications',
      label: 'Paid notifications',
      title: 'Payment email settings',
      disabled: false,
    })
  }
  groups.push({ section: 'Billed Awaiting Payment', items: billedItems })

  if (isDevOrMaster) {
    groups.push({
      section: 'Paid in Full',
      items: [
        {
          key: 'paid-in-full-notifications',
          label: 'Paid In Full notifications',
          title: 'Paid in Full email settings',
          disabled: false,
        },
      ],
    })
  }

  return groups
}
