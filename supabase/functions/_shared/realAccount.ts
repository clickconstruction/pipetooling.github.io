/**
 * Who counts as a real account when an edge function looks a sender or a recipient up in `users`
 * (punch list #29, the People spine's rule). Neither a View-as sample account nor a digital twin is
 * ever one. Twins are estimators, so without this a twin's session passes the sender check of
 * every function that lets an estimator send, including the two that email outside the company
 * (send-bid-pricing-package, send-rfq-email).
 *
 * This is the `users` half of `roster_people.is_pay_roster` (20260922001000). The functions cannot
 * read the view itself: it answers nobody without a signed-in user, these lookups run as the
 * service role, and it carries no email. Archived stays with each caller, which words its own
 * refusal. `src/lib/people/rosterRulePin.test.ts` pins this to the view's SQL, and
 * `src/lib/people/realAccountSweep.test.ts` keeps hand-written copies of the rule from coming back.
 *
 *   admin.from('users').select('id, email').match(REAL_ACCOUNT).eq('id', id).maybeSingle()
 */
export const REAL_ACCOUNT = { is_sample: false, is_digital_twin: false } as const
