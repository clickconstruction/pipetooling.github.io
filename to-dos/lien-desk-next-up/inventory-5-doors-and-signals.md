# 5 · Doors into the lien windows, and lien signals outside them

89 doors and signals found outside the five lien windows (83 outside, 6 cross-window doors), plus 11 deep-link parameters and 51 guides.

All paths are under the repo root. "Office" means dev, master_technician and assistant-like (`isAssistantLike`). "Leaders" means dev and master_technician. Nothing was run; this is from reading the code.

| # | Where it is (page › area) | What it shows or does | Control as labelled on screen (or icon) | Opens which window / state | Who sees it | file:line |
|---|---|---|---|---|---|---|
| 1 | Dashboard › Needs you | Next lien deadline, notices count, GCs, dollars | Kicker "Lien deadlines"; title "Next lien deadline: {day}" or "{n} lien windows close {when} · {day}"; action "Open the Lien desk" | Lien desk on Notices (`liendesk=1`) | Office | src/lib/dashboardNeedsYou.ts:612-637; src/components/dashboard/DashboardPinnedQuickRow.tsx:811-812 |
| 2 | Dashboard › Needs you › same card, second line | Closed windows with nothing recorded | "{n} windows closed with nothing recorded · ${x} · note them ›" | Lien desk Notices, missed pile (`liendeskPile=missed`) | Office | src/lib/dashboardNeedsYou.ts:619,635; DashboardPinnedQuickRow.tsx:852-853 |
| 3 | Dashboard › Needs you › same card, second line | Sent notices at day 10+ needing letter two | "{n} sent notices at day 10+ — letter two ›" | Drawn as a link, but no handler exists for key `letter-two`; click does nothing | Office | src/lib/dashboardNeedsYou.ts:617,635; DashboardPinnedQuickRow.tsx:842-857 |
| 4 | Dashboard › Needs you | Letter two due, when nothing else is due | "Letter two is due on a sent notice" / "…on {n} sent notices"; action "Open the Lien desk" | Lien desk on Notices | Office | src/lib/dashboardNeedsYou.ts:638-648 |
| 5 | Dashboard › Needs you | Only closed windows remain | "{n} lien windows closed with nothing recorded"; action "See it on the desk" | Lien desk Notices, missed pile | Office | src/lib/dashboardNeedsYou.ts:649-659; DashboardPinnedQuickRow.tsx:809-810 |
| 6 | Dashboard › Needs you | A GC run the office prepared awaits approval | Kicker "Lien deadlines · your call"; "Approve the run for {GC}" / "Approve {n} runs the office prepared"; action "Decide" | Put a GC on notice for the first batch's GC (`gcnotice=`); falls back to Lien desk | Leaders | src/lib/dashboardNeedsYou.ts:661-679; DashboardPinnedQuickRow.tsx:806-808 |
| 7 | Dashboard › Needs you | Drafted notices await the leader | "Approve a lien notice the office drafted" / "Approve {n} lien notices the office drafted"; action "Decide" | Lien desk on Notices | Leaders | src/lib/dashboardNeedsYou.ts:681-695 |
| 8 | Dashboard › Needs you | § 53.052 affidavit window closing | "A lien filing window closes {date}" / "{n} lien filing windows close soon (first: {date})"; action "Open the Lien desk" | Lien desk, Affidavits (`kind=affidavit`) | Office | src/lib/dashboardNeedsYou.ts:697-711; DashboardPinnedQuickRow.tsx:813-814 |
| 9 | Dashboard › Needs you | Filed lien's year to sue ending or run out | Kicker "Lien filings"; "A filed lien's year to sue ends {date}"; action "Open the Timeline" | Lien desk, Timeline (`kind=timeline`) | Office | src/lib/dashboardNeedsYou.ts:557-577; DashboardPinnedQuickRow.tsx:815-816 |
| 10 | Dashboard › Needs you | Filed lien not yet served on owner and contractor | "A filed lien has not been served"; action "Record service" | Bare Pipeline (`/jobs?tab=stages`); no window opens | Office | src/lib/dashboardNeedsYou.ts:579-592; DashboardPinnedQuickRow.tsx:819-820 |
| 11 | Dashboard › Needs you | Mailed notices with no tracking number | Kicker "Lien notices"; "A mailed notice has no tracking number"; action "Open the Lien desk" | Lien desk on Notices; sends `liendeskPile=sent`, which the parser ignores | Office | src/lib/dashboardNeedsYou.ts:594-607; DashboardPinnedQuickRow.tsx:817-818; src/lib/jobs/stagesDeepLinks.ts:56 |
| 12 | Dashboard › Needs you | Demand-letter deadline passed unpaid | Kicker "Demand letters"; "A demand-letter deadline passed unpaid"; action "Open the jobs" | Bare Pipeline; no window opens | Office | src/lib/dashboardNeedsYou.ts:794-808; DashboardPinnedQuickRow.tsx:804-805 |
| 13 | Dashboard › Needs you | Check cleared behind a conditional release | Kicker "Lien releases"; "A payment cleared behind a conditional release"; action "Issue release" / "Issue releases" | The lien release queue modal (row 14) | Office | src/lib/dashboardNeedsYou.ts:810-827; DashboardPinnedQuickRow.tsx:436-438,798-800,908 |
| 14 | Dashboard › lien release queue modal | One row per cleared conditional release | Heading "Conditional releases · payments cleared"; "Issue unconditional"; "View release"; job name | "Issue unconditional" opens Release of Lien preset `unconditional_progress` on the covered bill; "View release" prints the page; job name opens the Job window | Office | src/components/dashboard/DashboardLienReleaseQueueModal.tsx:193,245-265,331-333,366-374 |
| 15 | Dashboard › Needs you | Waivers waiting for my signature | Kicker "Lien waivers"; "A lien waiver waits for your signature · ${x}"; action "Sign it" / "Sign them" | "Waivers to sign" modal (its own sign-and-send seat, not one of the five) | Leaders | src/lib/dashboardNeedsYou.ts:829-843; DashboardPinnedQuickRow.tsx:441-444,801-803,916; src/components/dashboard/DashboardLienWaiversToSignModal.tsx:161 |
| 16 | Dashboard › Needs you | Collections accounts awaiting attorney-ready review | Kicker "Legal"; "{n} Collections accounts await your review before an attorney sees them"; action "Review" | Legal desk on the first account (`legal=<key>`) | dev only | src/lib/dashboardNeedsYou.ts:1477-1494; DashboardPinnedQuickRow.tsx:501,792-793 |
| 17 | Dashboard › Needs you | Law firm's portal acts awaiting the office | Kicker "Legal"; "The law firm has {n} things for you"; action "Open the desk" | Legal desk, Fees & steps tab (`legal=<key>&legalTab=fees`) | Office | src/lib/dashboardNeedsYou.ts:1458-1475; DashboardPinnedQuickRow.tsx:504,794-795 |
| 18 | Dashboard › Teams Inbox | Releases waiting for my signature | Lane "Awaiting your signature" + count; row "Release of lien — {job}"; "Open & sign" | LienReleaseSignModal (signature step only, not the Release window) | Office | src/components/jobs/LienSignatureInboxSection.tsx:24,107-128,182; src/components/dashboard/DashboardTeamsInboxCard.tsx:100 |
| 19 | Dashboard › Teams Inbox | Signed releases not yet sent | Lane "Signed — ready to send"; "Email to customer — PDF attached"; "Download PDF"; "Mark sent without emailing" | No window; confirm dialog "Email the signed release?" | Office | src/components/jobs/LienSignatureInboxSection.tsx:135-176,189-218 |
| 20 | Dispatch Mode inbox (above My Inbox); Checklist page inboxes | Same two signature lanes as rows 18-19 | Same labels | Same | Office | src/components/dispatchMode/DispatchModeInbox.tsx:109; src/components/checklist/ChecklistReviewInboxes.tsx:99 |
| 21 | Quickfill › Needs you | Same lien cards as rows 1-13; no waivers-to-sign card, no Legal cards | Same labels | Same routes; same queue modal | Office | src/components/quickfill/QuickfillNeedsYouSection.tsx:90-96,142-152,204-222,242-251 |
| 22 | Pipeline › stage bar (jump strip), beside the last stage | One-click Lien desk with count of notices to work | Orange gavel icon + count badge; title "Lien desk: lien notices due per unpaid work month. Draft, approve, send" | Lien desk, Calendar landing | Office; strip is hidden on the phone board | src/components/jobs/JobsStagesJumpStrip.tsx:140-158; src/components/jobs/JobsStagesTab.tsx:3176,3182 |
| 23 | Pipeline › ☰ Section tools menu › Pipeline group, first row | Lien desk with badge count | Gavel + "Lien desk" | Lien desk, Calendar landing | Office | src/lib/jobs/stagesSectionToolsMenu.ts:102-112; JobsStagesTab.tsx:2924 |
| 24 | Pipeline › ⋯ Pipeline tools menu, first row | Lien desk with count | Gavel + "Lien desk" + count | Lien desk, Calendar landing | Office (`gates.lienDesk`) | src/components/jobs/JobsStagesToolsMenu.tsx:202-217; JobsStagesTab.tsx:3059,3066 |
| 25 | Pipeline › ⋯ Pipeline tools menu, second row | Puts the filtered GC on notice; only while a GC filter is picked | "⚠ Put {GC name} on notice…" | Put a GC on notice for that GC | Office | src/components/jobs/JobsStagesToolsMenu.tsx:218-232; JobsStagesTab.tsx:3067 |
| 26 | Pipeline › Collections header | Review Collections accounts before release to an attorney | Scales icon + "Legal" (disabled when Collections is empty) | Legal desk, no account preselected | Office (`canManageCollections`) | JobsStagesTab.tsx:3792-3815 |
| 27 | Pipeline › Collections header | Lien desk with count | Gavel + "Lien desk · {n}" | Lien desk, Calendar landing | Office | JobsStagesTab.tsx:3817-3832 |
| 28 | Pipeline › money view › Today's Money Opportunities | Lien notices due: count and dollars | ⏱ card "{n} lien notices due · ${x}"; door "Lien desk →" | Lien desk on Notices, no pile | Office; card only when count > 0 | src/components/jobs/PipelineMoneyOpportunities.tsx:265-272; src/lib/jobs/lienDeskMoneyCard.ts:86; JobsStagesTab.tsx:3003-3007 |
| 29 | Same card › pile chips | The piles behind the count | "{n} needs an owner" · "{n} to draft" · "{n} awaiting approval" · "{n} approved for the run" | Lien desk Notices on that pile | Office | PipelineMoneyOpportunities.tsx:275-277; lienDeskMoneyCard.ts:88-91 |
| 30 | Same card › deadline and GC chips | Earliest window (red within 7 days, amber within 14) and whose it is | e.g. "6 notices by Oct 15 · in 20 days", "closed Sep 15", "today"; GC chip e.g. "Michael Holub +6" | Lien desk Notices on the earliest notice's pile (`to_draft` or `awaiting`) | Office | PipelineMoneyOpportunities.tsx:278-283; lienDeskMoneyCard.ts:93-105 |
| 31 | Pipeline › money view › fix-ups | GC jobs with no confirmed owner of record | "Owner of record to confirm · {n}" | OwnerConfirmListModal, titled "Owner of record · {n} jobs on {m} properties" (not one of the five) | Unclear: no client role check | src/lib/jobs/pipelineOverview.ts:226-231; JobsStagesTab.tsx:547,2970-2974,3254; src/components/jobs/OwnerConfirmListModal.tsx:227 |
| 32 | Pipeline › Billed and Collections rows › icon rail | The job's Lien window; amber box while a demand letter is out | Orange gavel; aria "Lien instruments"; title "Lien window — the job's timeline (whose move it is), the demand letter and the lien papers" | Lien instruments for the job and its bill, default tab | No role gate in client | src/components/jobs/StagesRowActionButtons.tsx:81-98; StagesUnifiedJobRow.tsx:361-370; StagesUnifiedInvoiceRow.tsx:338-339; JobsStagesTab.tsx:2627,2662 |
| 33 | Pipeline › Ready to Bill, Billed, Collections rows › icon rail | Release of lien; blue box when the job has an issued release | Blue file-check icon; aria "Release of lien" | Release of Lien on the row's bill; form picked from the bill | Office (`canCreateHazmatFee`) | StagesRowActionButtons.tsx:102-119; StagesUnifiedJobRow.tsx:360; StagesUnifiedInvoiceRow.tsx:337; JobsStagesTab.tsx:911-913,2510 |
| 34 | Pipeline › Billed and Collections rows › dates block under the money bar | Lien deadline against expected pay | Rows "Lien notice" / "File the lien" / "Lien" / "Lien filed" / "Notice window closed" / "Lien window closed"; verdict "Lien gone" / "Notice first" / "File the lien first" / "Can run late" | Click opens Lien instruments for the job | Whoever sees the row | src/lib/jobs/billedDatesLedger.ts:140-177; src/components/jobs/BilledDatesLedger.tsx:68-73,110-137; JobsStagesTab.tsx:1014-1055 |
| 35 | Pipeline phone cards › next-line chip | Lien verdict once it bites | Runway chip label (guide examples "notice in 17 d", "file first") | Lien instruments for the job | Whoever sees the card | src/lib/jobs/jobNextLine.ts:99-101; JobsStagesTab.tsx:2484,2502 |
| 36 | Pipeline phone cards › ⋯ menu | Both row doors on a phone | "Release of lien" (badge "live") · "Lien window · timeline" | Release of Lien · Lien instruments | Release: Office; Lien window: Billed and Collections cards | src/components/jobs/JobsStagesCardList.tsx:1103-1113 |
| 37 | Pipeline rows › end of the address | Property kind, which sets the lien clock | Orange "C" / blue "R" / red "?" badge | Small Residential or Commercial picker; saves on the property | Office picks; others see the letter | src/components/jobs/PropertyKindBadge.tsx:19-47; src/lib/jobs/propertyKindBadge.ts:35-47; src/components/jobs/jobsStagesRowShared.tsx:753 |
| 38 | Pipeline › Collections rows › beside the contract chip | The account's standing with counsel | "⚖ {stage}" / "⚖ review requested"; title "Legal desk — the account's standing with counsel" | Signal only (a span, not clickable) | Office | jobsStagesRowShared.tsx:1534-1561; JobsStagesCardList.tsx:540-543; src/lib/legal/legalMatters.ts:91-97 |
| 39 | Pipeline › Collections rows › note line | Unsecured part of a hand-corrected lien claim, after the note | Text from `collectionsClaimGapWords` | Signal only | Office | src/lib/jobs/lienClaimCorrection.ts:107-116; JobsStagesTab.tsx:1504,2673 |
| 40 | Payment forecast modal › above the buckets | Work months with a notice closing within 14 days | "⏱ {n} work months on {m} sub jobs have a lien notice closing within 14 days · ${x} open · …" | Signal only | Forecast audience: Office + primary | src/components/jobs/BilledPaymentForecastModal.tsx:359-384 |
| 41 | Payment forecast › collapsed row | Nearest open notice for the job | Chip "⏱ {Mon} notice {state}" | Signal only | Same | src/components/jobs/ForecastWorkMonthsPanel.tsx:48-71; BilledPaymentForecastModal.tsx:479 |
| 42 | Payment forecast › expanded row › Work months panel | Month, weeks, hours share, notice state per month | Columns "Work month / Weeks · people above / What counts / § 53.056 notice"; button "Send notice…" | Closes the forecast and opens the Lien desk on that job (Notices); the button's title says "Lien instruments window" | Same | ForecastWorkMonthsPanel.tsx:137-152,186-193; JobsStagesTab.tsx:4302-4307 |
| 43 | Payment forecast › Work months panel foot | The rule in one line | "Sub job · … each unpaid month needs its own notice…" / "Direct with owner · no monthly notice" / "affidavit … by {date}"; chip "property kind unknown" | Signal only | Same | ForecastWorkMonthsPanel.tsx:210-240 |
| 44 | Job window › History tab, above the day grid | Lien timeline while money is owed or paper is out | "The path to a lien — every deadline, whose move it is" + timeline strip | Signal only | Whoever opens the job | src/components/jobs/JobHistoryLienTimeline.tsx:12-22; src/components/jobs/JobWindowModal.tsx:368 |
| 45 | Job window › Documents tab › "Lien paper" | Door to the Lien window | Button "Lien window" | Lien instruments on the Demand tab | Whoever opens the tab | src/components/jobs/JobDocumentsLienPaper.tsx:68-75,110-119; JobWindowDocumentsTab.tsx:149 |
| 46 | Job window › Documents › Lien paper rows | Notices, filings and demand letters on the job | "§ 53.056 notice" · "§ 53.057 retainage notice" · "Lien affidavit" · "Release of record" · "Demand letter"; "Saved copy" | Lien instruments on the tab that holds it (`notice` / `affidavit` / `release_record` / `demand`) | Same | src/lib/jobs/jobLienPaperRows.ts:20-25,56-86; JobDocumentsLienPaper.tsx:52-56,84-99 |
| 47 | Job window › Documents › Lien paper rows | Releases issued (drafts left out) with lifecycle chips | "Release of lien" + form label | Opens the page as signed in a print window, not the Release window | Same | jobLienPaperRows.ts:88-98; JobDocumentsLienPaper.tsx:57-63,87-93 |
| 48 | Job window › Edit tab › "Property record" row | Which saved property the job sits at | Value "{address} ✓ lien-ready" / "Not linked yet" + "1 suggestion" / chip "kind not set"; "Property record (feeds lien paperwork — county, legal description, owner of record)"; "+ Add {address} as a property on {customer}" | In-place editor; the lien screens deep-link here | Whoever can edit the job | src/components/jobs/JobFormEditFactRows.tsx:830-890,952-962 |
| 49 | Job window › Edit tab › Property record › kind block | Residential or commercial, and homestead | "Property kind" switch; "Sets the lien deadlines: a residential property's notice is due a month earlier."; checkbox "Homestead" | In-place; saved on the property | Same | JobFormEditFactRows.tsx:896-937 |
| 50 | Job window › Edit tab › "Our contract on this job" (GC jobs only) | Contract end day, retainage held, payment bond | "Still open" / ended choices + day; "Retainage {GC} holds back, still unpaid"; "Payment bond" Yes / No / Unknown; chips "retainage ${x}" / "no retainage" | In-place; retainage also feeds the GC statement, checks-applied report and portal payload | Same | src/components/jobs/JobFormLienContractRow.tsx:150,159-203; JobFormEditFactRows.tsx:967-976; src/lib/gcReviewRollup.ts:128; src/lib/portal/portalPayload.ts:393; src/lib/jobsDocuments/gcChecksAppliedReport.ts:95 |
| 51 | Job window › Edit tab › under Property record (GC or builder job, owner not confirmed) | Appraisal roll's answer for the owner | "The appraisal roll's answer for {street}"; "Owner of record, mails to"; "Save this owner"; "Not right? Paste the CAD page…" | In-place; saves owner for every job at the address | Same | src/components/jobs/JobFormOwnerLookupBox.tsx:238-304; JobFormEditFactRows.tsx:977 |
| 52 | Job window › Bill tab › each sent bill | The bill's two waivers and the next move | Chips e.g. "Conditional ✓ sent {date}", "Conditional · awaiting signature", "Unconditional · when paid", "Unconditional owed · settled"; door "Add waiver ›" / "Add the unconditional ›" / "Sign it ›" / "Send it ›" / "Waivers ›" | Release of Lien on that bill | GC jobs or jobs with a live release; no role gate seen | src/components/jobs/JobFormInvoiceList.tsx:168,809-829,1066-1071; src/lib/jobs/lienWaiverCell.ts:92-106 |
| 53 | View bill › paperwork card › "Lien waiver" row | Headline, two-step track, one move | e.g. "Conditional for ${x} not sent", "Waiting for {leader} to sign", "Paid {date}. Unconditional owed.", "Both waivers sent"; button "Add waiver" / "Sign it" / "Send to {who}" / "Add the unconditional" / "Open draft" / "View" / "Waivers"; "Use {email}" | Release of Lien on the bill | GC jobs or jobs with a live release | src/components/jobs/BillPaperworkCard.tsx:109,160-190,197-207; src/lib/jobs/billPaperworkWaiverRow.ts:101-192; src/components/jobs/HostedStripeBillPanel.tsx:363 |
| 54 | Bill Customer modal › "Lien releases" strip | Releases issued, whether the check cleared, new ones | "+ New release"; tick "Send the lien waiver with this bill" (on by default on GC jobs); "View"; "Issue unconditional"; "Void" / "Confirm void" | "+ New release" opens Release of Lien preset `conditional_progress`; "Issue unconditional" presets `unconditional_progress` or `unconditional_final` | Whoever bills | src/components/jobs/BillCustomerLienReleaseStrip.tsx:144-170,211-231,238-252; src/components/jobs/SendRecordInvoiceModal.tsx:462-464,2498 |
| 55 | Bill Customer › after Send with the tick on | The waiver follows the bill | No control; opens by itself | Release of Lien on the bill just sent | Same | src/contexts/BillCustomerModalContext.tsx:33,80,85; src/components/jobs/BillCustomerWaiverFollowUp.tsx:13-29 |
| 56 | Bill Customer › Send-to block (GC or builder job, owner unconfirmed) | Roll's owner so the notice can be mailed later | "Owner of record for {address}: {owner} … not yet on the job"; "Use" / "Confirm"; paste box | In-place save; never blocks sending | Same | src/components/jobs/BillCustomerOwnerLine.tsx:11-24,125; SendRecordInvoiceModal.tsx:2327 |
| 57 | GC Review › opened GC › bills table | Each bill's two waiver chips | Column "Lien waivers"; same chip texts as row 52 | Opens the Job window, not a lien window | GC Review audience | src/components/jobs/JobsGcReviewModal.tsx:1038-1064,1417,1482-1483 |
| 58 | Bids › Bid Board › Customer review modal | GC already on notice | Red chip "on notice since {date} · {n}" | Signal only | Whoever opens Customer review | src/components/bids/BidBoardCustomerReviewModal.tsx:169-185,468-472 |
| 59 | Bids › Customer review modal, same cell | Put this GC on notice from Bids | "⚠ Put on notice…" / "the run ›" | Goes to the Pipeline and opens Put a GC on notice (`gcnotice=<customer id>`) | Office (`canSetTerms`) | BidBoardCustomerReviewModal.tsx:124,473-481 |
| 60 | Bids › "Lien Release" tab (also a Bid preview tab) | Bid-side conditional waiver with payment terms; a separate feature | Tab "Lien Release" | Not one of the five | Bids users, including primary | src/pages/Bids.tsx:1691-1699; src/components/bids/BidLienReleaseTab.tsx:1-30; BidPreviewModal.tsx:238; src/lib/bids/bidsTabAccess.ts:79 |
| 61 | Customers › Edit customer › Properties list | Whether each property's lien record is complete | Chip "✓ lien-ready" / "{n} lien fields missing" / "not looked up yet"; county | Signal; "Edit" opens the property sheet | Whoever edits customers | src/components/customers/CustomerPropertiesSection.tsx:213-221; src/components/EditCustomerForm.tsx:725 |
| 62 | Customers › property sheet › "Property record · feeds lien paperwork" | County, legal description, kind, homestead, owner, mailing address | "County (where the lien files)"; pills "Residential" / "Non-residential"; checkbox "homestead"; "Owner of record (person)"; checklist "✓ lien-ready" | In-place | Same | src/components/customers/CustomerPropertySheet.tsx:120; CustomerPropertyRecordPanel.tsx:148-152,263,307-324,334-340 |
| 63 | Materials › Job accounts › a job's open statement | The job is on our lien clock | "On the Lien desk · our notice / lien is due by {date} · ${x} unpaid"; link "Open the desk ›" | Lien desk on that job (`liendeskJob=<id>`); Affidavits when only the lien date is left | Materials users | src/lib/materials/heldLienLine.ts:39-47; src/components/materials/MaterialsJobAccountsTab.tsx:906-917 |
| 64 | Materials › Job accounts › per supply house, and filter | The house's own notice date and what it told us | "its own notice by {date}" / "its notice goes out {date}" / "notice window closed {date}"; "They told us…"; filter "Paid, house can still notice" | In-place form shared with the Lien desk | Materials users | MaterialsJobAccountsTab.tsx:131-138,589-590,835,921,949-966,995; src/lib/materials/heldHouseNotice.ts:1-10 |
| 65 | Jobs › Sub Labor › row ⋯ menu, expanded row, phone verb | Send a sub the right waiver to sign; a separate feature | "Lien waiver…" (phone: "Lien waiver") | LienWaiverSendModal; not one of the five | Sub Labor users | src/components/jobs/JobsSubLaborTab.tsx:720,743,865,895; src/lib/subWorkOrders/subPayPhoneRows.ts:54 |
| 66 | Documents page › under a job | Issued releases as child rows with chips | "Release of lien" + form label | Opens the signed page in a print window | Office (RLS; others see none) | src/pages/Documents.tsx:736-757,1110-1142 |
| 67 | Settings › Jobs & billing | Nightly save of the roll's owner as unconfirmed | "Liens · owner of record"; "Save owners from the appraisal roll automatically" | Setting | Leaders | src/components/settings/OwnerAutoConfirmSettingsBlock.tsx:42-48; src/pages/Settings.tsx:1547 |
| 68 | Settings › Jobs & billing › company issuer block | Who signs waivers; claimant's name and address | "Signs for the company — name"; "His title"; "Prints under the signature on every lien waiver…" | Setting; reached by `focus=issuer.<field>` | dev only | src/components/settings/PhysicalInvoiceIssuerDevSettingsBlock.tsx:13,140-160; Settings.tsx:993,1551 |
| 69 | Settings › Jobs & billing › law firm block | Who the Legal desk releases accounts to | "Who the Legal desk releases accounts to, and the fee model behind 'Click keeps'." | Setting | dev only | src/components/settings/LegalFirmSettingsBlock.tsx:88,150,175; SettingsJobsTab.tsx:72 |
| 70 | Settings › Jobs & billing | County a lien files in; city list for the lien prefill | TX county map block; job address city list block | Setting | Unclear in the components | src/components/settings/TxCountyMapSettingsBlock.tsx:13; JobAddressCityListSettingsBlock.tsx:99; SettingsJobsTab.tsx:309-310 |
| 71 | Settings › Templates | Wording of the signed-release email | "Signed lien release to customer"; subject "Release of lien — {{project}}" | Setting | Templates audience | src/components/settings/SettingsTemplatesTab.tsx:625-626; src/lib/settingsTemplates.ts:196-198 |
| 72 | Settings › Emails catalog › "Lien paperwork" | Every email that carries lien paper | "§ 53.056 notice of claim (email channel)" · "Final demand letter (email channel)" · "Where the liens stand (Lien desk Share)" · "Signed lien release to customer" · Legal portal emails | Signal / catalog | Settings audience | src/lib/emailCatalog.ts:54,156-233; src/components/settings/SettingsEmailCatalogSection.tsx:10 |
| 73 | Settings › Team emails; the email itself | "Where the liens stand" summary; its body links back to the desk | "Where the liens stand" | Email link opens the Lien desk, on the first job when there is one | Office recipients | src/lib/teamEmails.ts:409-417; supabase/functions/_shared/lienDeskStatus.ts:217-220 |
| 74 | Settings › What customers see | Journey steps that are lien paper; per-person action | "Lien release" · "Notice to the owner of record" · "Pay code"; action "Open the Lien instruments →" | The action goes to the job (`/jobs?jobDetail=<id>`), not the Lien window | Office per the code; the file's comment says dev-only | src/lib/customerJourneys.ts:209-212,249-256,366-373; src/lib/journeys/personJourney.ts:215-217,400,465; src/components/journeys/PersonJourneyStrips.tsx:117; src/lib/settingsGroups.ts:42-44 |
| 75 | Settings › Contracts & terms | Lien wording side by side | Area "Liens & collections": "Lien waiver and release (Jobs)" · "Notice to the owner (§ 53.056) and homestead statement" · "Final demand letter"; also "Conditional waiver with payment terms (Bids)" | Catalog | Settings audience | src/lib/contracts/customerContractCatalog.ts:58,372-420; src/lib/settingsSearch.ts:38 |
| 76 | Customer portal › a bill the viewer pays | Signed waiver as a note on its bill | "⤓ Lien waiver · {conditional, signed Sep 29}" | Opens the waiver PDF | Customer or GC (payer) | src/pages/CustomerPortal.tsx:749,823-827; src/components/portal/PortalWaiverPapers.tsx:15-29 |
| 77 | Customer portal › Your papers | Waiver groups, one row per signed waiver | "Lien waivers" (payer) · "Lien waivers on your property" (owner); "View waiver" | Opens the waiver PDF | Payer or owner | PortalWaiverPapers.tsx:57-93; src/lib/portal/portalWaiverPapers.ts:81-85; CustomerPortal.tsx:567-568 |
| 78 | Customer portal › builder's bills shared with the owner | Waiver note on the owner's rows; tag when under a notice | "⤓ Lien waiver · …"; "on the notice above" | PDF link / signal | Owner | src/components/portal/PortalSharedBillsCard.tsx:40-43,79,99-103 |
| 79 | Customer portal › notice card | A recorded § 53.056 notice on the owner's property | "Notice on your property · mailed {date}"; "Call {person} · {phone}" | Signal + tel link | Owner | src/components/portal/PortalPropertyNoticeCard.tsx:13-48; CustomerPortal.tsx:487-490 |
| 80 | Legal portal (law firm's page) | Lien book for counsel | Panel tab "Lien grid" | Outside the app's windows | The law firm | src/pages/LegalPortal.tsx:143,149 |
| 81 | Public pay page `/pay/:id` | Where the QR "Pay code" on a lien notice lands | QR on the printed notice | Public page | Anyone with the code | src/App.tsx:232; src/lib/customerJourneys.ts:209-212; src/lib/jobs/lienNoticePayPage.ts |
| 82 | Sign-in page › tooling family strip | Link to the sister product | "LienTooling" · "Liens and releases" | External lientooling.com | Everyone | src/lib/toolingFamily.ts:56-62; src/pages/SignIn.tsx:171 |
| 83 | Email › signed release to customer | Signed PDF, sent from the inbox lane, Waivers to sign, or the Release window | Subject "Release of lien — {{project}}" | Email | Customer or GC | src/lib/sendLienReleaseEmail.ts; LienSignatureInboxSection.tsx:86-99 |
| 84 | Cross-window: Lien desk → Lien instruments | Calendar row; affidavit buttons; a book row not on the queue | Calendar row; "Open the affidavit tab ›"; "Record service ›" | Lien instruments: no tab / `affidavit` / `notice` with the desk's months; the desk stays open underneath | Office | JobsStagesTab.tsx:4494-4498,4522-4529,4533-4547; LienDeskAffidavitPane.tsx:278,295; LienDeskModal.tsx:1001 |
| 85 | Cross-window: Lien desk → Legal desk | Refer an account whose affidavit is filed or lost | "Refer to the Legal desk ›" | Closes the Lien desk; opens Legal desk with no account | Office | JobsStagesTab.tsx:4502-4505; LienDeskAffidavitPane.tsx:296 |
| 86 | Cross-window: Lien desk (Notices) → Put a GC on notice | Pick a failing GC | "⚠ Put a GC on notice…" then the GC | Put a GC on notice for that GC | Office | LienDeskModal.tsx:2062-2082; JobsStagesTab.tsx:4549-4551 |
| 87 | Cross-window: Legal desk → Lien instruments | From "Where each job stands" and "Final demand letters" | Door "Lien instruments"; job label; "Open" | Lien instruments for the job, default tab | Office | src/components/jobs/legal/LegalDeskModal.tsx:268,777-796; JobsStagesTab.tsx:4393 |
| 88 | Cross-window: Lien desk and Release of Lien → Settings | Fix the claimant name or address, or the signer | Plain-value door on the notice; link in the Release window | Navigates to `/settings?tab=settings-jobs&focus=issuer.<field>` | dev can edit there | JobsStagesTab.tsx:4532; src/components/jobs/LienReleaseModal.tsx:1376 |
| 89 | Cross-window: Lien desk supplier card → Materials | See the job's houses | Link built as `heldHref` | `/materials?tab=job-accounts&job=<id>` | Office | src/components/jobs/LienJobSuppliers.tsx:177; MaterialsJobAccountsTab.tsx:236-246 |

## Deep links

| URL parameter | What it opens | file:line |
|---|---|---|
| `/jobs?tab=stages&liendesk=1` | Lien desk. A URL door always lands on Notices; the on-screen buttons land on Calendar. Consumed once, then stripped with `replace`. | src/lib/jobs/stagesDeepLinks.ts:17,52-58; src/hooks/useStagesDeepLinkParams.ts:50-53,83-90; src/components/jobs/JobsStagesTab.tsx:1271,4482 |
| `&liendeskJob=<job id>` | The desk on that job's notice | stagesDeepLinks.ts:54 |
| `&kind=affidavit` or `&kind=timeline` | Affidavits or Timeline pane. Any other value means Notices; `calendar` cannot be reached by URL. | stagesDeepLinks.ts:47,55 |
| `&liendeskPile=missed` | The missed pile. Only `missed` is parsed; the Dashboard and Quickfill also send `sent`, which is dropped. | stagesDeepLinks.ts:56; DashboardPinnedQuickRow.tsx:818; QuickfillNeedsYouSection.tsx:220 |
| `/jobs?tab=stages&gcnotice=<customer id>` | Put a GC on notice for that GC | stagesDeepLinks.ts:16,51; useStagesDeepLinkParams.ts:46-49; JobsStagesTab.tsx:1270 |
| `/jobs?legal=1`, `legal=true` or `legal=<payer key>` | Legal desk, on one account when a key is given. Forces the Stages tab. Stripped unopened for non-office roles. | src/pages/Jobs.tsx:819-823,1146-1177; JobsStagesTab.tsx:349-350,2324 |
| `&legalTab=fees` | Legal desk on Fees & steps | Jobs.tsx:1158,1174 |
| `/settings?tab=settings-jobs&focus=issuer.companyName`, `.addressText` or `.signerName` | Settings field ringed: claimant name or address, or who signs waivers | Settings.tsx:993,1551; src/lib/settingsDeepLink.ts:42-46 |
| `/materials?tab=job-accounts&job=<job id>` | That job's supplier statement, opened and scrolled to | MaterialsJobAccountsTab.tsx:236-246 |
| `/jobs?jobDetail=<job id>` | The job; used by "Open the Lien instruments →" in What customers see | src/lib/journeys/personJourney.ts:215-217 |
| `/bids?tab=lien-release` | Bids → Lien Release tab | src/pages/Bids.tsx:1693-1694; src/lib/bids/bidsTabAccess.ts:48 |

- **No `lienJob` parameter exists.** The name in the code is `liendeskJob`.
- **No URL opens Lien instruments or Release of Lien directly.** They open only from on-screen controls.
- **`openLienDesk(jobId)` is unused.** It is defined on the tab's handle (JobsStagesTab.tsx:352,2325) and I found no caller.

## Things the redesign should know

- **Dead link on the main lien card:** the "letter two ›" line has no handler (row 3).
- **`liendeskPile=sent` is ignored**, so the tracking-number card lands on plain Notices (row 11).
- **"Send notice…" says one thing and does another:** its title names the Lien instruments window, but it opens the Lien desk on that job (row 42).
- **Two cards land on the bare Pipeline** with no window: "Record service" and "Open the jobs" (rows 10, 12).
- **URL doors and buttons land on different panes** of the Lien desk: Notices versus Calendar.
- **"Open the Lien instruments →" opens the job**, not the Lien window (row 74).

## Guides

Core lien guides:
- answer-an-owner-who-calls-about-a-lien-letter — answer an owner who calls about a lien letter
- file-a-lien-and-never-miss-its-deadlines — file a lien and never miss its deadlines
- give-a-customer-a-lien-release — give a customer a lien release
- send-a-gc-our-lien-waiver — send a GC our lien waiver
- send-a-lien-waiver — send a sub the right lien waiver
- send-a-final-demand-letter — send a final demand letter
- send-lien-notices-from-the-lien-desk — send lien notices from the Lien desk
- see-what-is-due-on-the-lien-calendar — see what is due on the lien calendar
- see-which-supply-houses-are-owed-on-a-lien-job — see which supply houses are owed on a lien job
- see-which-paid-jobs-still-owe-supply-houses — see which paid jobs still owe my supply houses
- ask-a-supply-house-what-it-shows-owed — ask a supply house what it shows owed on my jobs
- share-where-our-liens-stand — share where our liens stand
- texas-lien-rules-the-app-follows — read the Texas lien rules the app follows
- understand-how-liens-work-and-which-lien-tool-to-use — understand how liens work and which lien tool to use
- mark-a-property-residential-or-commercial — mark a property residential or commercial from the Pipeline
- review-a-collections-account-before-it-goes-to-your-attorney — review a collections account before it goes to your attorney
- send-a-customer-account-to-your-attorney — send a customer account to your attorney
- share-your-attorney-their-portal — share your attorney their portal
- manage-who-at-the-law-firm-gets-emails — manage who at the law firm gets emails

Guides that describe a lien door or signal in passing:
- read-the-pipeline-money-view — read the Pipeline's money view
- see-which-months-need-a-lien-notice — see which months need a lien notice (the months-worked section moved out of *see when a customer will pay* in v2.5052)
- work-the-pipeline-from-my-phone — work the Pipeline from my phone
- search-the-stages-board — search jobs on the Pipeline board
- needs-you-card — work the Needs you list on the dashboard
- job-window-tabs — move between a job's Job, Edit, Bill, and Costs tabs
- see-a-customers-full-history-and-lifetime-value — see a customer's full history and lifetime value
- share-a-customer-their-portal — share a customer their portal
- see-what-customers-see — see what customers see
- see-every-contract-side-by-side — see every contract we offer side by side
- find-a-bid-on-the-workflow-tabs — find a bid on the workflow tabs
- run-your-gc-statement-round — run your weekly GC statement round
- sub-labor-outstanding — see what I still owe each sub contractor
- build-a-fillable-form — build a fillable form from a PDF
- job-address-city-line-breaks — make job addresses wrap at the city name
- mark-an-invoice-on-a-job-account — mark an invoice as on a job account
- share-job-with-supply-house — share a job with a supply house
- start-here-as-a-primary — get started as a primary
- start-here-in-the-office — get started in the office (assistant or controller)
- change-the-wording-of-an-outgoing-email — change the wording of an email the app sends

Guides that match only on another meaning of "release" or "waiver" (not lien):
- build-a-submittal-package — build a submittal package
- estimate-how-long-a-roadmap-task-will-take — estimate how long a roadmap task will take
- find-a-setting-fast — find a setting fast
- manage-subs-end-to-end — manage subs end to end
- pay-a-sub-per-step — pay a sub per step
- onboard-a-new-subcontractor — onboard a new subcontractor (DWC-83 waiver)
- run-the-robots-from-claude-desktop — run the robot estimator from the Claude app
- release-notes — see what changed in recent app updates
- see-what-the-team-sees — see what the team sees
- settings-basics — set up my profile and notifications
- start-here-as-a-master — get started as a leader

Guides that deep-link into lien UI:
- `/jobs?tab=stages&liendesk=1`: send-lien-notices-from-the-lien-desk:13, see-what-is-due-on-the-lien-calendar:11, share-where-our-liens-stand:11, see-which-supply-houses-are-owed-on-a-lien-job:11.
- `/settings?tab=settings-jobs&focus=issuer.signerName`: send-a-gc-our-lien-waiver:11 and :148.
