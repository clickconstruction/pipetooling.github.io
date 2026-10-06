---
name: "Help guides: steps that open with a description, then say \"you + verb\""
number: 90
group: ready
status: open · found by the v2.4656 sweep's rescan · nothing built
summary: >
  v2.4656 made every numbered step that opened with "You + verb" read as commands. Rule 2 now
  holds a step that opens with a command to commands. Its rescan found 50 more numbered steps in
  30 guides that open by saying what the screen shows, then give a "you + verb" sentence, such as
  "Both documents appear on their row as unsent. You click Send on each." Those steps read in
  mixed voice. Most of their "you" sentences are commands, but six describe, and four want a
  person's call. Each sentence is listed below as one or the other.
next: >
  A person decides the four borderline lines. Then one mechanical sweep from fresh main, over the
  63 commands listed below, using the v2.4656 script with this list as its input. The six that
  must stay are left as written. A read-only reviewer reads the diff, and the PR merges alone.
size: S (63 sentences in 25 guides)
blocker: None for the 63 commands. The four borderline lines want a person's yes or no.
ver: v2.4656
opinion: build — the same mechanical change as v2.4656; the list already says which sentences stay
mockup: not required — words only; each guide renders as it does today
---

# Help guides: steps that open with a description, then say "you + verb"

## Why

The owner chose plain commands for numbered steps (#75's third question). v2.4656 converted the
83 steps that opened with "You + verb". It worded rule 2 in `src/lib/plainWords.ts` to cover only
those: *a numbered step that opens with a command gives each instruction as a command*. The 50
steps below open with a description instead, so the rule does not reach them, and they still
mix voices. When this row ships, rule 2 can drop *that opens with a command*.

A sentence that describes keeps *you* + a verb. Turning a description into a command tells the
reader to do something the guide only described. So every sentence is called below before
anything changes. The sentences are quoted as they read on `main` after v2.4656. Find each by
its guide and its text, since line numbers move.

## Must stay as written (6)

- *complete-a-forms-office-section* step 5: "You attest under penalty of perjury that you examined the documents and entered them truthfully." (legal wording: what the signature means)
- *price-a-bid-with-the-workbench* step 5: "You let go and the sweep saves in one batch." (an outcome)
- *see-a-customers-full-history-and-lifetime-value* step 2: "You stay on the list." (a result)
- *see-the-email-a-customer-gets-with-an-estimate* step 3: "You close the tab and you resend again." (a warning: close the tab and you must resend)
- *start-here-as-a-superintendent* step 5: "You read the job here." (a role; *The office edits it.* follows)
- *track-a-general-contractor-on-a-job* step 2: "You dig in and close it, and your checkmarks are still there." (a result)

## For a person to decide (4)

- *answer-an-owner-who-calls-about-a-lien-letter* step 1: "You reach it from Jobs → Pipeline → the Collections header {{button:outline|Lien desk}}." (where it is; a command would read *Open it from …*)
- *start-here-as-an-estimator* step 2: "Then you give each fixture its parts." (a map of the tab)
- *start-here-as-an-estimator* step 4: "You send the link from your own email." (a map of the tab)
- *track-a-general-contractor-on-a-job* step 3: "You set the phone there once." (a one-time setting)

## Commands, for the sweep (63 sentences in 25 guides)

- *job-mode-clocking*
  - step 1: "You pick the job for each."
  - step 3: "You tap one to file the report right there."
  - step 3: "Or you finish clocking out and file it later with **Job Report** on your Dashboard."
- *keep-a-subs-paperwork-current*
  - step 1: "You pick COI, W-9, License, an Agreement signed on paper, or Other."
  - step 3: "You paste an `https://` link, and Drive works well."
- *number-and-order-roadmap-stages*
  - step 5: "You watch the "✓ Saved" note in the footer."
  - step 5: "You press {{button:outline|Done}} when you are finished."
- *onboard-a-new-subcontractor*
  - step 2: "You click {{button:blue|Send}} on each."
- *open-a-job-account-before-buying-parts*
  - step 1: "You add another if you will buy there too."
- *price-a-bid-with-the-workbench*
  - step 1: "You price those rows like any other."
  - step 2: "You press it and the controls unfold inside a **blue ring**."
  - step 2: "Inside, you type a **margin**, or you drag the slider from 20 to 95."
  - step 2: "Then you step straight into the box to fine-tune it."
  - step 2: "Or you type a **target bid total** and press Enter."
  - step 5: "You press **🖌 Margin ›** and a purple ring unfolds."
- *raise-a-purchase-order*
  - step 3: "You open one to add notes or confirm prices."
- *record-sub-labor-on-a-job*
  - step 1: "You tap the field to open the same job search Schedule uses."
  - step 1: "You type a number, name, address, or customer."
  - step 1: "You set it to the day the work happened."
  - step 2: "You tap to add or remove people from External Subs, Internal Subs, or Office Team."
  - step 2: "Or you search across all three."
  - step 3: "You describe the work and its cost."
  - step 3: "Or you flip on **Itemize hours and rate**."
  - step 3: "You tap **Fixed hrs** on a line to enter total hours directly instead of count × hours."
- *review-the-robots-number-when-you-send*
  - step 1: "You tap **Mark sent today** on the Cover Letter."
  - step 1: "Or you set the sent date on the Edit tab with the three acknowledgments."
- *run-the-robots-from-claude-desktop*
  - step 4: "In Claude, you open the **Code** tab, start a new session and paste."
  - step 2: "In Claude, you open the **Code** tab, start a **new session** and paste."
  - step 2: "If it does ask what to do with the text, you answer *run it here as the robot*."
  - step 4: "You paste the kickoff into a fresh session for the rest."
- *run-your-gc-statement-round*
  - step 1: "You change it to someone else, or to ***Mine — I talked to Knight*** when you reached the GC yourself."
  - step 2: "You paste it into a text."
  - step 2: "Or you use {{button:outline|Copy link}}."
  - step 4: "You read them, change what needs changing, and press {{button:blue|Save 3 answers}}."
- *schedule-dispatch*
  - step 1: "You click the ones to copy and they highlight."
  - step 1: "Then you press {{button:blue|Next: pick people}}."
  - step 2: "You click ***<lane> — whole crew*** and the blocks apply to every member of that lane in one click."
- *see-money-flow-on-a-workflow*
  - step 3: "Under **Attach to step**, you pick the step."
  - step 3: "Then you choose **Before the step** or **After the step**."
- *see-the-email-a-customer-gets-with-an-estimate*
  - step 2: "Under **Customer experience**, you choose {{button:outline|Email}}."
  - step 3: "You change the title, the total, the expiry or the logo."
  - step 3: "You copy it into a text if the customer prefers that."
- *see-your-bids-on-a-map*
  - step 3: "You tap Use it for a residential bid at the customer's own address."
- *send-a-sub-a-work-order-from-a-sheet*
  - step 2: "You tick the scope and send."
- *send-a-supply-house-a-quote-link*
  - step 1: "On **Bids → Pricing**, you open the {{button:green|Supply house prices (RFQ) ▾}} menu beside Share."
  - step 1: "You pick **Supply house prices**."
  - step 3: "You set a **needed by** date if there's a deadline."
  - step 3: "Then you tap {{button:blue|Copy with quote link}}."
- *share-your-attorney-their-portal*
  - step 1: "You set one up on Settings → Jobs & billing → Collections law firm."
- *tell-if-a-customer-opened-an-estimate-and-record-a-no*
  - step 2: "You write what they said, in a sentence."
- *track-a-general-contractor-on-a-job*
  - step 4: "You use {{button:outline|Clear GC}} to remove it."
  - step 1: "You check off each bill as you confirm it belongs to this GC and the amount is right."
- *track-rfis-on-a-bid*
  - step 2: "You paste what CountTooling's **Copy RFI Flags** button put on your clipboard."
- *turn-a-bill-into-a-stripe-bill*
  - step 3: "You click {{button:blue|Create Stripe bill}}."
- *turnaway-trip-charges*
  - step 2: "You adjust it if this job warrants something different."
- *understand-how-liens-work-and-which-lien-tool-to-use*
  - step 2: "Then you press {{button:blue|Send for approval ▸}}."
  - step 2: "Or you press {{button:outline|The leader said to send it…}} when Robert already said so."
- *write-up-a-change-order-from-the-field*
  - step 1: "On the job you're standing on, you tap the paper-and-pencil square."
  - step 2: "You tap the link under the list and pick **Change order**."
  - step 2: "Then you answer **Which job is it on?** Your schedule's jobs are right there."
  - step 2: "You use the search for a different one, or **Skip**."
  - step 3: "To talk, you tap the mic on your keyboard."
  - step 3: "You snap photos with the **＋** square."

## How it ships

- Cut from fresh `main`. The script is the v2.4656 one (`docs/recent-features/v2.4656.md`), run
  over the 63 sentences above and the borderline ones a person said yes to. Running it on a clean
  copy of `main` must reproduce the branch byte for byte.
- The structure diff against `main` shows nothing changed but the listed sentences: frontmatter,
  headings, panels, tokens, links and numbers all stay.
- A read-only reviewer reads every changed line against `main`. It merges alone, per `CLAUDE.md` →
  *Mechanical sweeps merge alone*.
- In the same PR, rule 2 drops *that opens with a command*.
