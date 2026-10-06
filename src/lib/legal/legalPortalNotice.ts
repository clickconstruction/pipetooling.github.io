/**
 * The line the firm's portal shows after an act (v2.4624, punch list #85 item 21). Pure, so the
 * words are tested here and the page only picks which to show.
 */

/** What `submit-legal-portal` answers; `confirmationSent` rides the people acts that email a confirmation. */
export type LegalActAnswer = { ok?: boolean; error?: string; confirmationSent?: boolean }

/**
 * After adding a person (or resending their confirmation): a confirmation that did not go is said,
 * with the button that retries it, instead of a plain "Saved" over an email that never left.
 */
export type LegalActNotice = { text: string; warn: boolean }

export function confirmationNotice(name: string, email: string, answer: LegalActAnswer, resend = false): LegalActNotice {
  if (answer.confirmationSent === false) {
    return {
      warn: true,
      text: resend
        ? `The confirmation email to ${email} did not go. Press Resend the confirmation again in a minute.`
        : `${name} is on the list, but the confirmation email to ${email} did not go. Press Resend the confirmation next to their name in a minute.`,
    }
  }
  return { warn: false, text: resend ? `A new confirmation email went to ${email}.` : `${name} is on the list. A confirmation email went to ${email}. Nothing else is sent until they press its button.` }
}
