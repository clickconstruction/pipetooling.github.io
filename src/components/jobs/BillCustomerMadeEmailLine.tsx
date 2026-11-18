/** How the one press's bill email went: `sent` holds the send's own line, `failed` its reason. */
export type BillCustomerMadeEmail = { kind: 'sent'; line: string } | { kind: 'failed'; error: string }

/** Punch list #343, PR 3: on the made-bill screen, how the one press's email went. Nothing for *send later*. */
export function BillCustomerMadeEmailLine({ made }: { made: BillCustomerMadeEmail | null }) {
  if (!made) return null
  return made.kind === 'sent' ? (
    <p role="status" data-testid="bill-customer-made-email" data-kind="sent" style={{ margin: '-0.35rem 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-green-700)' }}>
      {made.line}
    </p>
  ) : (
    <p role="alert" data-testid="bill-customer-made-email" data-kind="failed" style={{ margin: '-0.35rem 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>
      The bill is made. The bill email did not go: {made.error} Press Send Email invoice below to send it.
    </p>
  )
}
