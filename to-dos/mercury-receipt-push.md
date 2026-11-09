---
name: "Push a receipt photo to Mercury's own receipt slot on the charge"
number: 300
group: waiting
status: parked 2026-11-09 by the owner, for much later, when the receipt doors (#295, #299) have run a while · nothing designed
summary: >
  Every card charge in the bank feed reads compliantWithReceiptPolicy false, and Mercury keeps its own
  receipt slot on a charge (raw.attachments, put on in Mercury's own app on two charges ever). Once a
  receipt photo lands on a charge through the Tally press (#295) or the text (#299), the same photo
  could be pushed to Mercury's slot, so the bank's books show the receipt too. Needs a check of the API
  key's scope for attachments, a look at what Mercury accepts (size, kind), and a place for a push
  that fails. One paragraph by the owner's word: not to do now.
next: nothing until the owner reopens it; then read Mercury's attachments API with the live key's scope before any design
size: S
blocker: the owner parked it
opinion: wait — the office reads receipts in the app, and the bank's slot adds nothing until an accountant asks for it there
---

# Push a receipt photo to Mercury's own receipt slot (#300)

Parked 2026-11-09. Diane, on the text door (#299): *we can add the push to mercury to a punchlist card for much much later not to do now.*

The bank feed stores each charge's `raw.attachments`, a list Mercury fills when someone adds a receipt in Mercury's own app, with URLs signed for twelve hours; on 2026-11-09 two charges of about 176 at material houses in ninety days carried one. Every charge reads `compliantWithReceiptPolicy: false`. When this is reopened: confirm the live API key may write attachments, read Mercury's limits on size and kind, decide whether the push runs from the photo sweep (`photo-save`, which already holds the bytes) or from a sweep of its own, and give a failed push a line the office can see.
