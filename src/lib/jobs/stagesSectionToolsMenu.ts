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
 * - Chart (billed aging bubbles): dev / controller only (wage-derived costs).
 * - Payment forecast: dev / master_technician / assistant-like / primary
 *   (mirrors the header's canSeeBilledExpectedPay gate — hidden otherwise).
 * - Ready to Bill notifications + Paid notifications + Paid in Full
 *   notifications: dev / master_technician only.
 */
import { isAssistantLike } from '../subcontractorLikeRole'

export type StagesSectionToolKey =
  | 'recently-added'
  | 'weekly-movement'
  | 'weekly-money'
  | 'capable-to-bill'
  | 'ready-to-bill-notifications'
  | 'gc-review'
  | 'accounts-receivable'
  | 'billed-share-print'
  | 'billed-aging-chart'
  | 'billed-payment-forecast'
  | 'paid-notifications'
  | 'paid-profit-chart'
  | 'paid-in-full-notifications'

export type StagesSectionToolItem = {
  key: StagesSectionToolKey
  label: string
  title: string
  disabled: boolean
  /**
   * Emoji mark shown before the label — the same mark the tool's board button
   * wears (v2.2224). Absent only for gc-review, whose hard-hat SVG the view
   * renders itself (it's a React component, not a character).
   */
  icon?: string
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
  /**
   * Preformatted dollars (no cents), e.g. "12,345" — the same display value
   * the Working section header shows ("…" while header stats are loading).
   */
  capableToBillTotalFormatted: string
  /** "Recently added" flat view currently open — flips that item's label to the exit (v2.1973). */
  recentViewOpen: boolean
}

export function buildStagesSectionToolsMenu(input: StagesSectionToolsMenuInput): StagesSectionToolsGroup[] {
  const { authRole } = input
  const isDevOrMaster = authRole === 'dev' || authRole === 'master_technician'
  // No `primary` branch (v2.2882, J4-8): primaries never reach the Pipeline
  // board (Jobs shows them Reports only) and Layout bounces them off
  // /accounts-receivable — the old `|| authRole === 'primary'` was dead code.
  const canOpenAccountsReceivable = isDevOrMaster || isAssistantLike(authRole)
  const canSharePrint = isDevOrMaster || isAssistantLike(authRole)

  const groups: StagesSectionToolsGroup[] = []

  // Weekly money movement is dev/controller only — wage-derived job costs
  // (mirrors the get_weekly_money_movement_payload RPC gate). Hidden, not
  // disabled, for everyone else.
  const canOpenWeeklyMoney = authRole === 'dev' || authRole === 'controller'
  groups.push({
    section: 'Pipeline',
    items: [
      // Moved off the jump-strip row into the menu (v2.1973); everyone.
      // While the flat view is open, the strip shows a "Back to board" pill
      // too, so the exit is never buried in here.
      {
        key: 'recently-added',
        label: input.recentViewOpen ? 'Back to board' : 'Recently added',
        title: input.recentViewOpen
          ? 'Back to the pipeline board'
          : 'Show the last 100 jobs added, any status',
        disabled: false,
        icon: '🕒',
      },
      {
        key: 'weekly-movement',
        label: 'Weekly movement',
        title: 'Every job that entered a stage in a chosen week, with who moved it',
        disabled: false,
        icon: '📆',
      },
      ...(canOpenWeeklyMoney
        ? [
            {
              key: 'weekly-money' as const,
              label: 'Weekly money movement',
              title: 'Money out and in per job for a chosen week, with the % progress the spend bought',
              disabled: false,
              icon: '💸',
            },
          ]
        : []),
    ],
  })

  groups.push({
    section: 'Working',
    items: [
      {
        key: 'capable-to-bill',
        label: `Capable of Being Billed: $${input.capableToBillTotalFormatted}`,
        title: 'Working jobs whose progress can already be billed',
        disabled: false,
        icon: '🧾',
      },
    ],
  })

  if (isDevOrMaster) {
    groups.push({
      section: 'Ready to Bill',
      items: [
        {
          key: 'ready-to-bill-notifications',
          label: 'Ready to Bill notifications',
          title: 'Ready to Bill notification settings (email + push)',
          disabled: false,
          icon: '⚙',
        },
      ],
    })
  }

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
      icon: '💵',
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
      icon: '⇪',
    })
  }
  // Bubble sizes are wage-derived job costs — same dev/controller gate as
  // Weekly money movement. Hidden, not disabled, for everyone else.
  if (authRole === 'dev' || authRole === 'controller') {
    billedItems.push({
      key: 'billed-aging-chart',
      label: 'Chart',
      title: 'Aging bubble chart — open $ vs days waiting, bubble = our cost',
      disabled: false,
      icon: '📊',
    })
  }
  // Same audience as the expected-pay chips the forecast rolls up
  // (canSeeBilledExpectedPay on the header). Hidden, not disabled, for others.
  if (isDevOrMaster || isAssistantLike(authRole) || authRole === 'primary') {
    billedItems.push({
      key: 'billed-payment-forecast',
      label: 'Payment forecast',
      title: 'Open billed dollars bucketed by expected payment date (bill date + customer pay speed)',
      disabled: false,
      icon: '📅',
    })
  }
  if (isDevOrMaster) {
    billedItems.push({
      key: 'paid-notifications',
      label: 'Paid notifications',
      title: 'Payment email settings',
      disabled: false,
      icon: '⚙',
    })
  }
  groups.push({ section: 'Billed Awaiting Payment', items: billedItems })

  const paidItems: StagesSectionToolItem[] = []
  // Profit chart is wage-derived (dev/controller, like the billed aging chart).
  if (authRole === 'dev' || authRole === 'controller') {
    paidItems.push({
      key: 'paid-profit-chart',
      label: 'Chart',
      title: 'Profit vs clocked hours — bubble = revenue, losses below the $0 line',
      disabled: false,
      icon: '📊',
    })
  }
  if (isDevOrMaster) {
    paidItems.push({
      key: 'paid-in-full-notifications',
      label: 'Paid in Full notifications',
      title: 'Paid in Full email settings',
      disabled: false,
      icon: '⚙',
    })
  }
  if (paidItems.length > 0) {
    groups.push({ section: 'Paid in Full', items: paidItems })
  }

  return groups
}
