/**
 * The document builder's made-up paper (punch list #404): one made-up job's secrecy paper, first drawn in
 * `to-dos/sub-nda-builder/mockup.html` and newer than that drawing where the two differ. This file is the whole of the contents: the levels,
 * the topics, what each level means on each topic, the breach lines, the site lines, the disclaimer
 * and the site note. The design session is still setting them, so the file is made to be swapped
 * whole: `documentBuilder.ts` holds every rule and reads only the `PaperDef` exported here.
 *
 * Every name is made up. No line here is clause wording or legal text, and no attorney has read any
 * of it. The meanings, the breach lines, the site lines and the disclaimer are placeholders in plain
 * words, and the page marks them so. A clause is drawn as grey bars.
 */
import type { PaperDef } from './documentBuilder'

const CO = 'Acme Plumbing'

export const SECRECY_PAPER_FIXTURE: PaperDef = {
  id: 'job-secrecy-test',
  title: 'Job Secrecy Agreement (test)',
  job: 'J2391',
  company: CO,
  protectedParty: 'Northgate Builders',
  words: {
    offSays: 'Off. This job requires no secrecy paper.',
    offReview: 'Off. This job requires no secrecy paper. Nobody is asked to sign.',
    offNote: 'Secrecy is off on J2391.',
    basisAsk: "Pick the level this job's paper should express.",
    basisHow: 'Every page after this one starts on it. You can move any one page up or down.',
    siteFact: 'The site must have',
    levelsTitle: 'The four levels',
    reviewTitle: "This job's paper",
    confirmPress: 'Confirm and require this paper',
    nothingPress: 'Nothing to require',
    beforeConfirm: 'Nothing reaches a signer until this press.',
  },
  // Loosest first. A level's place in this list is its strictness.
  levels: [
    { id: 'std', name: 'Standard', alignedWith: 'Aligned with regular businesses' },
    { id: 'gov', name: 'Elevated', alignedWith: 'Aligned with hospitals, banks and government buildings' },
    { id: 'mid', name: 'Aggressive', alignedWith: 'Aligned with military bases and defense plants' },
    { id: 'strict', name: 'Strict', alignedWith: 'Aligned with private research labs' },
  ],
  notice: {
    title: 'Read this first',
    lines: [
      'This tool does not give legal advice.',
      'Use it with your own attorney present. They represent your interests. This tool does not.',
      'It is experimental. Use it for trial purposes only.',
    ],
    placeholder: 'Placeholder words, for an attorney to confirm.',
    tick: 'I have read this.',
  },
  site: {
    lead: 'A secrecy paper should match what really happens on this site.',
    title: 'Pick only what this site can enforce',
    lines: [
      'Some choices need people and equipment on site. Badges need someone to issue and check them. A security gate needs staff on the perimeter every working hour.',
      'If the site is not set up for a choice, pick a lower level on that page.',
      'A rule nobody enforces protects nothing. It also puts people in breach of a rule they cannot follow.',
      'Ask your attorney what an unenforced rule does to the paper.',
    ],
    asksNothing: 'Nothing beyond the paper itself.',
    placeholder: 'Each page ahead shows what its level asks of the site. Placeholder words.',
  },
  topics: [
    {
      key: 'photos',
      label: 'Photos and video',
      section: 'Section 5: Photos and video',
      inEveryPaper: false,
      offSays: 'This paper sets no photo rule. Your usual photo rules apply.',
      levels: {
        std: {
          says: `Work photos only, into ${CO}'s system, then deleted from the phone.`,
          breach: ['Taking a photo that is not of the work.', 'Keeping a work photo on a phone after it is uploaded.', 'Sending or posting a job photo to anyone outside the job.'],
          site: [],
        },
        gov: {
          says: 'Work photos only, and none that show people, screens or signs.',
          breach: [
            'Taking a photo that is not of the work.',
            'Taking a photo that shows people, screens or signs.',
            'Keeping a work photo on a phone after it is uploaded.',
            'Sending or posting a job photo to anyone outside the job.',
          ],
          site: [],
        },
        mid: {
          says: 'Work photos only, taken by the site lead and checked before they leave the site.',
          breach: ['Taking any photo, unless you are the site lead.', 'Taking a photo off site before it is checked.', 'Sending or posting a job photo to anyone outside the job.'],
          site: ['A site lead who checks every photo before it leaves.'],
        },
        strict: {
          says: 'No photos or video at all.',
          breach: ['Taking any photo or video on site.', 'Having a camera out on site.'],
          site: ['Someone on site who watches for cameras.'],
        },
      },
    },
    {
      key: 'devices',
      label: 'Phones and devices',
      section: 'Rules for this job: Phones and devices',
      inEveryPaper: false,
      offSays: 'This paper sets no phone rule.',
      levels: {
        std: { says: 'Phones stay put away in marked areas.', breach: ['Having a phone out in a marked area.'], site: ['Marked areas, with signs.'] },
        gov: {
          says: 'Phones stay put away anywhere on site, except on breaks.',
          breach: ['Having a phone out anywhere on site, except on a break.'],
          site: ['Someone on site who watches for phones.'],
        },
        mid: {
          says: 'Phones are locked up before anyone enters a marked area.',
          breach: ['Carrying a phone into a marked area.', 'Carrying a smart watch or a camera into a marked area.'],
          site: ['Marked areas, with lockers at each door.'],
        },
        strict: { says: 'No phones or devices past the gate.', breach: ['Carrying a phone or any device past the gate.'], site: ['A staffed gate, with lockers outside it.'] },
      },
    },
    {
      key: 'access',
      label: 'Getting on site',
      section: 'Rules for this job: Getting on site',
      inEveryPaper: false,
      offSays: 'No site rules beyond the paper.',
      levels: {
        std: {
          says: 'Badge worn on site. Sign in and out each day.',
          breach: ['Being on site without a badge.', 'Not signing in or out.'],
          site: ['Badges, and someone to issue them.', 'A sign-in sheet at the door.'],
        },
        gov: {
          says: 'Badge, sign in and out, and photo ID shown at the door.',
          breach: ['Being on site without a badge.', 'Not signing in or out.', 'Coming on site without showing photo ID.'],
          site: ['Badges, and someone to issue them.', 'A staffed door that checks ID.'],
        },
        mid: {
          says: 'Badge, sign in and out, and a background check before the first day.',
          breach: ['Being on site without a badge.', 'Not signing in or out.', 'Starting work before the background check clears.'],
          site: ['Badges, and someone to issue them.', 'A staffed door.', 'Someone to run background checks before the first day.'],
        },
        strict: {
          says: 'Badge, sign in and out, a background check before the first day, and an escort in marked areas.',
          breach: ['Being on site without a badge.', 'Not signing in or out.', 'Starting work before the background check clears.', 'Being in a marked area without an escort.'],
          site: [
            'Badges, and someone to issue them.',
            'A staffed door.',
            'Someone to run background checks before the first day.',
            'Escorts free to walk with each person in a marked area.',
          ],
        },
      },
    },
    {
      key: 'talk',
      label: 'Talking on site',
      section: 'Rules for this job: Talking on site',
      inEveryPaper: false,
      offSays: 'No rule about who you talk to on site.',
      levels: {
        std: {
          says: "Talk with the owner's staff or tenants only about the work in front of you.",
          breach: ["Talking with the owner's staff or tenants about anything but the work in front of you."],
          site: [],
        },
        gov: { says: 'Talk about the job only with people working on it.', breach: ['Talking about the job with anyone who is not working on it.'], site: [] },
        mid: {
          says: "Talk about the job only with people on the job's list.",
          breach: ["Talking about the job with anyone who is not on the job's list."],
          site: ['A list of who is on the job, kept current.'],
        },
        strict: {
          says: "No talk about the job with the owner's staff or tenants. Questions go to the site lead.",
          breach: ["Talking about the job with the owner's staff or tenants at all.", 'Answering a question about the job yourself. It goes to the site lead.'],
          site: ['A site lead on site to take questions.'],
        },
      },
    },
    {
      key: 'term',
      fact: 'Secrecy lasts',
      label: 'How long secrecy lasts',
      section: 'Section 11: How long',
      inEveryPaper: true,
      levels: {
        std: { blank: '3 years', says: "3 years after each person's last day on the job.", breach: ['Sharing anything secret about the job within 3 years of your last day.'], site: [] },
        gov: { blank: '5 years', says: "5 years after each person's last day on the job.", breach: ['Sharing anything secret about the job within 5 years of your last day.'], site: [] },
        mid: { blank: '7 years', says: "7 years after each person's last day on the job.", breach: ['Sharing anything secret about the job within 7 years of your last day.'], site: [] },
        strict: { blank: '10 years', says: "10 years after each person's last day on the job.", breach: ['Sharing anything secret about the job within 10 years of your last day.'], site: [] },
      },
    },
    {
      key: 'files',
      fact: 'Time to return files',
      label: 'Files at the end',
      section: 'Section 12: Files at the end',
      inEveryPaper: true,
      levels: {
        std: {
          blank: '10 days',
          says: 'Returned or destroyed within 10 days, confirmed in writing.',
          breach: ['Keeping any job file more than 10 days after your work ends.', 'Not confirming in writing that the files are gone.'],
          site: [],
        },
        gov: {
          blank: '7 days',
          says: 'Returned or destroyed within 7 days, confirmed in writing.',
          breach: ['Keeping any job file more than 7 days after your work ends.', 'Not confirming in writing that the files are gone.'],
          site: [],
        },
        mid: {
          blank: '5 days',
          says: 'Returned or destroyed within 5 days, confirmed in writing.',
          breach: ['Keeping any job file more than 5 days after your work ends.', 'Not confirming in writing that the files are gone.'],
          site: [],
        },
        strict: {
          blank: '3 days',
          says: 'Returned or destroyed within 3 days, confirmed in writing.',
          breach: ['Keeping any job file more than 3 days after your work ends.', 'Not confirming in writing that the files are gone.'],
          site: [],
        },
      },
    },
    {
      key: 'report',
      fact: 'Time to report a leak',
      label: 'Reporting a leak or a legal demand',
      section: 'Section 13: Reporting a leak',
      inEveryPaper: true,
      levels: {
        std: { blank: '3 days', says: `Reported to ${CO} within 3 days.`, breach: [`Knowing of a leak or a legal demand and not telling ${CO} within 3 days.`], site: [] },
        gov: { blank: '2 days', says: `Reported to ${CO} within 2 days.`, breach: [`Knowing of a leak or a legal demand and not telling ${CO} within 2 days.`], site: [] },
        mid: { blank: '24 hours', says: `Reported to ${CO} within 24 hours.`, breach: [`Knowing of a leak or a legal demand and not telling ${CO} within 24 hours.`], site: [] },
        strict: { blank: 'the same day', says: `Reported to ${CO} the same day.`, breach: [`Knowing of a leak or a legal demand and not telling ${CO} the same day.`], site: [] },
      },
    },
  ],
  // Who would be asked to sign. Head counts only: no person is named.
  signers: [
    { group: `${CO} office`, people: 3 },
    { group: `${CO} crew`, people: 4 },
    { group: 'Cedar Fork Drain', people: 3 },
    { group: 'Lone Mesa Excavation', people: 2 },
    { group: 'Pecos Insulation', people: 2 },
  ],
}
