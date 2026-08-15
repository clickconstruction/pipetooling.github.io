/**
 * DOM id of the Job window header's right-side slot (v2.1677).
 *
 * The "Link to: Bid | Project" cluster is form functionality (its state and
 * link-choice modals live in JobFormModal's shell), but the owner wants it up
 * in the window's shared header — which DetailJobModal renders. Rather than
 * lifting form state across components, the embedded JobFormHeaderRow portals
 * the cluster into this slot. Kept in its own module because the two
 * components sit on opposite sides of an import cycle
 * (DetailJobModal → JobFormModalContext → JobFormModal → JobFormHeaderRow).
 *
 * Safe as a bare id: the Job window is a singleton (one open job at a time).
 */
export const JOB_WINDOW_HEADER_LINKS_SLOT_ID = 'job-window-header-links-slot'
