# Goal roadmap (SURFLOG-38): plan

Status 2026-10-28: **built, pushed to `staging`.** Page `/roadmap`, preview
`/dev/roadmap` (real components on a fake API). The migration
`20261029000000_create_roadmap.sql` goes to staging with that push (CI's
`migrate` job) and to production when the release PR is merged; where it isn't
applied, `/roadmap` says it isn't switched on and the goal card leaves the
roadmap out. Starter content: `lib/goal-roadmap.ts` (wording unreviewed). How it's
built: CLAUDE.md "Roadmap". Jira: SURFLOG-38 with sub-tasks SURFLOG-39 to 46
(written before the level/block design; they need updating).

**Levels were renamed after the sketches below were drawn** (Avery,
2026-10-28): **0 First waves · 新手村, 1 Beginner · 初級, 2 Intermediate · 進階,
3 Advanced · 高階** (3 splits Longboard / Mid-length–shortboard). Where a sketch
says "Level 2 · Novice", read "Level 1 · Beginner", and so on. Also decided
since: default blocks can't be renamed; skills and steps reorder by drag and
drop (not Move up/down); skills only "Move to level" (no copy to level).

## The idea in one paragraph

Today a surfer has one flat "Goal for next session" list. The roadmap adds
the long view: **levels → skills → steps**. Surflog ships a starter roadmap,
but it is only the first set of **blocks**: every user gets their own copy
and builds on it like Lego, copying, removing and adding skill and step
blocks, like stories and tasks in Jira. The next-session list stays as the
short view: a point there can be free text or linked to a roadmap step, and
ticking a linked point when logging a session counts toward that step.

```
Roadmap (months)      Level 2 → Reading waves → Spot the peak
                                                ▲ linked
Next session (days)   ☐ Spot the peak  · Reading waves
                      ☐ Paddle early and hard  · Catching green waves
                      ☐ Don't look at my feet          ← free text, no link
                                                ▼ tick when logging
Session               ✓ Spot the peak   → step: ticked in 3 sessions
```

## Vocabulary

| Term | Jira analogy | Meaning |
|---|---|---|
| Level | Epic | A stage (1 Beginner, 2 Novice, 3 Intermediate, 4 Advanced); level 4 splits into a Longboard and a Mid-length/Shortboard track |
| Skill (block) | Story / task | Something to learn, e.g. "Reading waves". Holds steps |
| Step (block) | Subtask | A small, tickable thing, e.g. "Spot where the peak forms" |
| Group | Label | Ocean & safety · Riding · Lineup & etiquette · Yours (own skills) |
| Working on | In progress | Up to 3 skills at once; they feed suggestions |
| Next session | Sprint | Up to 5 points for the next surf |

## User flows

### A. First visit: find your level

Goal card shows "New: a roadmap of skills. Find your level →". Four cards,
each with a self-description and a guide (wave size, hours). Picking one is
not a gate: any level can be opened, and "Move me to this level" moves you.

```
Phone                          Desktop
┌───────────────────────┐      ┌──────────────────────────────────────────────┐
│ Where are you now?    │      │ Where are you now?                           │
│ ┌───────────────────┐ │      │ ┌─────────┐┌─────────┐┌─────────┐┌─────────┐ │
│ │ 1 Beginner        │ │      │ │1 Begin. ││2 Novice ││3 Interm.││4 Advanc.│ │
│ │ Never surfed or   │ │      │ │New to   ││Stand up,││Catch and││Turn on  │ │
│ │ only a few times  │ │      │ │surfing  ││can't get││angle on ││the wave │ │
│ │ Whitewater ≤0.5 m │ │      │ │≤0.5 m   ││out alone││your own ││~2 m     │ │
│ └───────────────────┘ │      │ └─────────┘└─────────┘└─────────┘└─────────┘ │
│ ┌───────────────────┐ │      │ Not sure? Start at 1 and skip ahead.         │
│ │ 2 Novice  …       │ │      └──────────────────────────────────────────────┘
└───────────────────────┘
```

Existing users keep their current goals as free-text points on the list.

### B. The roadmap page: work on skills

Levels are a left column on desktop and a row of four on phones. Past levels
show ✓, the current one is ringed. Skills sit in groups, each a collapsible
block with its steps.

```
Phone                          Desktop
┌───────────────────────┐      ┌───────────────────────────────────────────────┐
│ (✓1) (2) (3) (4)      │      │ ✓ Beginner │ Level 2 · Novice  [You're here]  │
│ Level 2 · Novice      │      │ ● Novice   │ Unbroken waves ≤1 m · 10–60 h    │
│ Ocean & safety        │      │   Interm.  │ Ocean & safety                   │
│ ▸ Getting out ✓    ⋯  │      │   Advanced │ ▸ Getting out the back ✓      ⋯  │
│ Riding                │      │            │ Riding                           │
│ ▾ Reading waves 1/3   │      │            │ ▾ Reading waves 1/3 [Working ✓]⋯ │
│   [Working on ✓]  ⋯   │      │            │   ○ Spot the peak  On next ✓  ⋯  │
│   ○ Spot the peak   ⋯ │      │            │   ○ Lineup marker  + Next     ⋯  │
│   ○ Lineup marker   ⋯ │      │            │   [Add your own step       ][+]  │
│   [Add own step ][+]  │      │            │ Yours                            │
│ Yours                 │      │            │ ▾ Fix my left take-off [Yours] ⋯ │
│ ▾ Fix my left… [Yours]│      │            │ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │
│ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │      │            │  [Add your own skill     ][+]   │
│  [Add own skill][+]   │      │            │  ⧉ Add a block from the library │
│  ⧉ Add from library   │      │            │ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │
│ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │      │            │ How you know you've got it       │
│ How you know…         │      │            │ Get out alone, choose, angle, …  │
│ [I can do this]       │      │            │ [I can do this]                  │
└───────────────────────┘      └───────────────────────────────────────────────┘
```

- "Work on" (max 3) marks a skill active. A step's "+ Next session" puts it
  on the list.
- The circle marks a step learned by hand; the usual way is the prompt in D.

### C. Build your own roadmap (blocks)

Every user starts with a copy of the starter roadmap. From there it is theirs,
with full CRUD on skill and step blocks (decided by Avery 2026-10-28). The
**four levels are fixed**: users can't add, rename or remove a level.

| Action | Where | What happens |
|---|---|---|
| Add your own skill | Dashed box at the end of each level | New empty block in the "Yours" group |
| Add your own step | Bottom of every skill (starter or own) | New step at the end of that skill |
| Rename a skill / step | ⋯ → Rename | Inline field, ✓ saves (no Enter: 注音/倉頡), Esc cancels. Any block, starter ones too; the new name is stored as typed |
| Reorder a skill | Skill ⋯ → Move up / Move down | Swaps within its shelf (same level, same group) |
| Reorder a step | Step ⋯ → Move up / Move down | Swaps within its skill |
| Move a skill | Skill ⋯ → Move to level… | Same block, new level; **progress and next-session links come along**; leaves "working on" if it leaves your current level |
| Move a step | Step ⋯ → Move to another skill → level → skill | Same step, appended to that skill; progress comes along |
| Copy a skill block | Skill ⋯ → Copy to level… | Fresh copy (steps included, **no progress**) at the end of that level |
| Copy a step block | Step ⋯ → Copy to another skill → level → skill | Fresh copy at the end of that skill |
| Remove a skill block | Skill ⋯ → Remove block and its steps | Gone, its steps leave the next-session list; toast with **Undo** |
| Remove a step block | Step ⋯ → Remove step | Gone; toast with **Undo** |
| Add from the library | "Add a block from the library" | Dialog of every starter block by level; "+ Add" (or "+ Add again") puts a fresh copy here |
| Reset a level | Bottom of the library dialog | That level goes back to its starter blocks; progress on starter steps is kept; Undo |

```
Skill ⋯ menu                        Step ⋯ menu
┌──────────────────────────────┐    ┌───────────────────────────────┐
│ ✎ Rename                     │    │ ✎ Rename                      │
│ ↑ Move up                    │    │ ↑ Move up                     │
│ ↓ Move down                  │    │ ↓ Move down                   │
│ ↳ Move to level…           ▾ │    │ ───────────────────────────── │
│   Level 1 · Beginner         │    │ Move to another skill         │
│   Level 3 · Intermediate     │    │ Level 1 · Beginner          ▾ │
│   Level 4 · Longboard        │    │   ↳ Beach safety              │
│   Level 4 · Mid/shortboard   │    │   ↳ Board and leash           │
│ ⧉ Copy to level…           ▸ │    │ Level 2 · Novice            ▸ │
│ ──────────────────────────── │    │ Copy to another skill         │
│ 🗑 Remove block and its steps │    │ Level 1 · Beginner          ▸ │
└──────────────────────────────┘    │ ───────────────────────────── │
                                    │ 🗑 Remove step                 │
Renaming in place                   └───────────────────────────────┘
┌──────────────────────────────────────────────┐
│ [Reading the lineup               ] (✓) (×)  │
│   ○ Spot where the peak forms             ⋯  │
└──────────────────────────────────────────────┘

Library dialog
┌──────────────────────────────────────────────────────┐
│ Block library                                        │
│ The starter blocks. Adding one puts a fresh copy in  │
│ Level 2 · Novice; the copy is yours to change.       │
│ Level 1 · Beginner                                   │
│ ┌──────────────────────────────────────────────────┐ │
│ │ Beach safety                          [+ Add]    │ │
│ │ Check flags · Spot a rip · Float, signal, …      │ │
│ └──────────────────────────────────────────────────┘ │
│ …                                                    │
│ Reset Level 2 · Novice to the starter blocks         │
└──────────────────────────────────────────────────────┘
```

Submenus open inline as accordions, like every menu in the app (no side
flyouts). Removing never asks first; the 6-second Undo toast is the safety
net (decided). Reordering is menu-based in the prototype; the real build
could use drag handles like the goal card and board rack (dnd-kit).

### D. Log a session and count progress

The log form's goal list is unchanged: tick the points you hit. A linked
point shows its skill underneath. Saving adds one ticked session to each
linked step.

```
Which goals did you achieve?
 ◉ Spot where the peak forms      ○ Paddle early and hard
   Reading waves                    Catching green waves
 ○ Don't look at my feet
```

After **3** ticked sessions the goal card asks:

```
┌──────────────────────────────────────────────────────┐
│ "Spot where the peak forms" ticked in 3 sessions.    │
│ Learned it?        [Yes, mark learned]  [Not yet]    │
└──────────────────────────────────────────────────────┘
```

Yes marks the step learned, takes it off the list and the next unfinished
step of that skill shows up as a suggestion. Not yet asks again 3 sessions
later. Only the user marks a step done.

### E. The dashboard card

```
┌─────────────────────────────────────────────┐
│ Goal for next session                  4/5  │
│ Spot where the peak forms              ×    │
│ Reading waves · 2×                          │
│ Paddle early and hard                  ×    │
│ Catching green waves · 1×                   │
│ Don't look at my feet                  ×    │
│ [Add your own point                  ] [+]  │
│ Next on your roadmap                        │
│ (+ Pick a lineup marker · Reading waves)    │
│ ─────────────────────────────────────────── │
│ ▤ Level 2 · Novice ▰▰▱▱▱▱▱ 2/7 skills    →  │
└─────────────────────────────────────────────┘
```

The progress line counts every skill in the level, the user's own included,
since the roadmap is theirs.

### F. Level up

"I can do this" under the level's test opens a confirm with the test text.
When every skill in the level is learned the box hints "Ready for the test?",
but moving up is always the user's tap. Level 4 asks for a track first; the
track can be changed later.

## Starter roadmap (the first blocks)

Four levels, about 30 skills and 75 steps in total, in English and zh-TW.
Every line is our own wording; the structure follows surfcheck.tw, the
content was checked against the references below. Full text: `lib/goal-roadmap.ts`.

| Level | Guide | Ocean & safety | Riding | Lineup & etiquette |
|---|---|---|---|---|
| 0 First waves · 新手村 | Whitewater ≤0.5 m · first ~10 h | Beach safety (flags, spotting and escaping rips), board and leash, falling safely | Lying and paddling, pop-up and stance, riding whitewater | Sharing the water |
| 1 Beginner · 初級 | Green waves ≤1 m · 10–60 h | Getting out (push, turtle roll, sets, channel), reading conditions (swell, wind, tide) | Sitting and turning, reading waves, catching green waves, angled take-off | Priority, no drop-ins, paddle wide |
| 2 Intermediate · 進階 | Open face ~1 m+ · 60–100 h | Duck dive, new spots and knowing your limits | Wave selection, speed, bottom turn, top turn, cutback | Split peaks, sharing, respecting locals |
| 3 Longboard | ~2 m · 100+ h | (none) | Picking a line and stalling, cross-step, noseriding (cheater five → hang five → hang ten), drop-knee and cutback | (none) |
| 3 Shortboard | ~2 m · 100+ h | Moving to a shorter board | Rail to rail, snap and re-entry, roundhouse cutback, floater | (none) |

Level tests ("How you know you've got it"):

1. Stand up on whitewater in the shallows and ride it to the beach.
2. With no coach, get past the break, choose a wave, angle left or right and ride it in.
3. Ride a wave start to finish, linking a bottom turn, a top turn and a cutback, and kick out under control.
4. Longboard: walk to the nose and hang five. Shortboard: hit the lip and throw spray.

What the research changed against the first draft:

- **Safety and etiquette at every level**: all three Australian units list
  preparation, hazards, wipeouts and self-rescue at each level.
- **Angled take-offs move to level 2; level 3 is turning**: Lapoint level 2,
  Barefoot 1.2 and the Australian basic unit all angle before turning.
- **Size and hours guide per level**: sizes from the Australian units (0.5 /
  1 / 2 m), hours from Lapoint (60 h / 98 h). Surflog already stores session
  durations, so "you've surfed 42 h" could sit beside the guide later.
- **Longboard order** cross-step → cheater five → hang five → hang ten.
- **Steps Surflog can back with data**: "Check swell, wind and tide before
  you go", "Find the channel and rips before paddling out".

## Data model (as built)

Changed from the first draft: **the existing goal is the next-session list.**
No `next_points` or tick tables: a step is on next session when a goal point
has its wording (either language for a default step), and its progress is the
sessions that ticked that wording. Sessions, the log form, share images and
MCP are unchanged. Details in CLAUDE.md "Roadmap".

```
roadmap_profile  (owner_id pk, level 0–3, track 'long' | 'short' | null)
roadmap_skills   (id, owner_id, level_key '0'|'1'|'2'|'3:long'|'3:short', grp,
                  template_key null, name null, working, sort_order)
roadmap_steps    (id, owner_id, skill_id → roadmap_skills on delete cascade,
                  template_key null, text null, sort_order, done_at, snooze_from)
```

## Build phases

1. **Content**: final starter wording, en and zh-TW, reviewed by Avery
   (`lib/goal-roadmap.ts`).
2. **Data**: tables, seeding, migration of existing goals, `session-service`
   changes, API routes, tests.
3. **Roadmap page**: levels, groups, skills/steps, working on, next session.
4. **Blocks**: full CRUD: add own skill/step, rename, reorder, move, copy, remove + Undo, library, reset.
5. **Level picker and level up**: first-visit flow, tests, tracks.
6. **Dashboard card and log form**: suggestions, progress line, learned prompt, ticks with step ids.
7. **MCP, zh-TW, checks** at 375 / 1280 px, signed in on staging.

## Decided (Avery, 2026-10-28)

- **Blocks get full CRUD**: create, rename, reorder, move, copy, remove.
- **Reorder and move** both exist; move keeps progress, copy doesn't.
- **The four levels are fixed**: no adding, renaming or removing levels.
- **Removing doesn't ask**: the Undo toast is enough.

## Open decisions

1. **Threshold**: ask "Learned it?" after 3 ticked sessions?
2. **List size**: 5 next-session points? 3 working skills?
3. **Ticked points**: stay on the list until learned (current), or clear after every session?
4. **Add/copy/move into past or future levels**: allowed in the prototype; keep?
5. **Reorder UI** in the real build: drag handles (dnd-kit, like the goal card) or the menu's Move up/down?
6. **Wording source**: confirm our own wording (not surfcheck.tw's); review
   the zh-TW terms in the glossary below.
7. **Hours guide**: show "you've surfed N h" from session durations?
8. **Sharing a roadmap** (e.g. a coach's) is out of scope; nothing aggregates across users.

## zh-TW terms (glossary)

How surfers in Taiwan say it in the water, used throughout `content.ts`.
Manoeuvre names stay in English, as they're said in the lineup.

| English | zh-TW used | Not used (and why) |
|---|---|---|
| Whitewater / green wave | 白浪 / 綠浪 | 浪花 (too poetic) |
| Set / lull | 一組浪 / 空檔 | 組浪 (written only) |
| Peak / shoulder / face / lip | 浪峰 / 浪肩 / 浪壁 / 浪頂 | 浪唇 (literal translation) |
| Lefts / rights | 左手浪 / 右手浪 | 左跑浪 / 右跑浪 |
| Lineup | 浪區 | |
| Channel / rip | 水道 / 離岸流 | |
| Paddle out | 划出去 / 划出浪區 | |
| Pop-up / take-off | 起乘 | |
| Angled take-off | 斜跑 | 斜起乘 |
| Trim | 沿著浪壁走 | 平滑 (nobody says it) |
| Duck dive | 壓浪 | 鴨潛 (textbook) |
| Turtle roll | 翻板 | 烏龜翻 (fine too, less common) |
| Drop in / snake | 搶浪 | 卡浪 |
| Hog the peak | 霸浪 | |
| Priority | 優先權 | |
| Ditch the board | 丟板 | |
| Locals | 在地浪人 | |
| Pump | Pump | 壓板 (ambiguous) |
| Rail to rail | 換 rail | 換刃 (snowboard word) |
| Pocket / stall | Pocket / Stall | |
| Bottom turn / Top turn / Cutback / Snap / Re-entry / Floater / Roundhouse | English as-is | 底部轉向 etc. (textbook) |
| Cross-step | 走板（交叉步） | |
| Noseride / Hang five / Hang ten / Cheater five / Drop-knee | 站板頭（Noseride）/ English as-is | |
| Hit the lip / throw spray | 打浪頂 / 甩水花 | |
| Longboard / mid-length / shortboard | 長板 / 中長板 / 短板 | |
| Metres | 米 | 公尺 (written, not spoken) |

## Jira follow-up

SURFLOG-39 (content), 40 (schema), 43 (roadmap page) and 44 (card) describe
the earlier area-based plan. Update them to levels and blocks, and add
sub-tasks for: level picker and level up; blocks (create / rename / reorder / move / copy / remove /
library / reset); next-session points linked to steps.

## References

Checked 2026-10-28. Our wording is our own; these shaped the structure.

1. surfcheck.tw, [Learning roadmap](https://surfcheck.tw/learning-roadmap): the 4 levels, the level 4 longboard/shortboard split, "how you know you've learned it".
2. Australian Government, [SISOSRF001 Surf small waves using basic manoeuvres](https://training.gov.au/TrainingComponentFiles/SIS/SISOSRF001_R1.pdf): waves ≤0.5 m; prepare, manoeuvre through waves, catch broken and green waves at an angle, basic turns, self-rescue.
3. Australian Government, [SISOSRF002 Surf waves using intermediate manoeuvres](https://training.gov.au/TrainingComponentFiles/SIS/SISOSRF002_R1.pdf): waves ≤1 m; duck dive and Eskimo roll, wave selection, bottom/top turns, cutbacks, linking.
4. Australian Government, [SISOSRF003 Surf waves using advanced manoeuvres](https://training.gov.au/TrainingComponentFiles/SIS/SISOSRF003_R1.pdf): waves ≤2 m; rips and route out, re-entries, roundhouse cutbacks.
5. International Surfing Association, [ISA courses](https://isasurf.org/isa-courses/): instructor pathway.
6. Surfing Canada, [ISA coach and instructor](https://csasurfcanada.org/isa-coach-and-instructor/): ISA Level 1 surfing standard (traverse waves, exit with control).
7. Lapoint, [Choosing a surf level](https://lapointcamps.freshdesk.com/support/solutions/articles/43000068136-choosing-a-surf-level): 3- and 4-level schemes, 60 h / 98 h benchmarks.
8. Lapoint, [Level 3 course](https://lapointcamps.com/surfcourses/level-3): forecasting, wave types, lineup, turtle roll and duck dive.
9. Barefoot Surf Travel, [What is my surf level](https://barefootsurftravel.com/what-is-my-surf-level): levels 1.1–2.2.
10. Barefoot Surf Travel, [Mentawais & Maldives: is your surf level adequate?](https://tutorials.barefootsurftravel.com/articles/mentawais-maldives-is-your-surf-level-adequate)
11. Rapture Camps, [Surf manoeuvres](https://www.rapturecamps.com/learn-to-surf/surf-maneuvers): 19 manoeuvres, beginner to advanced.
12. Rapture Camps, [Surf etiquette](https://www.rapturecamps.com/blog/surf-etiquette-for-surfers): priority, drop-ins, snaking, paddling wide.
13. Surf Life Saving Australia, [Rip currents fact sheet](https://www.mornpen.vic.gov.au/files/assets/public/v/1/new-website-documents/your-property/ripcurrents_fact_sheeta4_slsa_2020.pdf): spotting and escaping rips.
14. Shebbear College, [Surfing England Junior Surfer (Grom Squad) scheme](https://shebbearcollege.co.uk/beyond-the-classroom/co-curricular/surfing-england-scheme): 5 levels and a log book.
15. URBNSURF, [Wave selector](https://urbnsurf.com/wave-selector/): wave-pool levels, beginner to pro.
16. Wave Pool Mag, [Guide to surfing The Wave Bristol](https://wavepoolmag.com/complete-guide-to-surfing-the-wave-bristol/): who each session level suits.
17. 10 Over, [How to cross-step on a longboard](https://10oversurf.com/blogs/news/how-to-cross-step-on-a-longboard)
18. The Inertia, [Kassia Meador's guide to longboarding, curriculum](https://courses.theinertia.com/p/courses/kassia-meador-guide-to-longboarding-advanced/145618-curriculum/416663-welcome-to-intermediate-and-advanced)
19. Surf Hungry, [Cheater five](https://surfhungry.com/?p=32116), and American Surf Magazine, [How to nose ride](https://www.americansurfmagazine.com/article/how-to-nose-ride-guide)

Not found or blocked: British Surfing's and the French surf federation's
official award pages, Surfing Australia's own learn-to-surf levels, SurferToday's
"seven levels" article. No source gives a complete official longboard
progression; the order above is the common one across coaching guides.
