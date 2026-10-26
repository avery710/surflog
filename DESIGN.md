# Surflog design system

> Generated from the Surflog Design System artifact (https://claude.ai/artifact/VTytmYDfXYTNzx7m9QZK68), synced 2026-10-25. Do not edit by hand: change the artifact, then run `npx tsx scripts/design-md.ts <dir>` (see the header of that script).

A surf journal: log a session and the wave, wind and tide conditions get attached. The look (since 2026-10-24, colours from the AI Platform system) is a fixed grainy teal-to-navy gradient behind every page, see-through white cards (75%) held up by a soft shadow, solid white menus, one neutral grey for everything nested, near-black type, and a single dark ink grey (`primary`, #292524) for anything you can press. The header is a clear glass bar and the footer sits straight on the gradient. Readings are mono and black.

## Content fundamentals

- **Plain, short, second person.** "Log a session", "Nothing logged yet", "Add a technique goal…". No exclamation marks, no emoji, no hype.
- **Sentence case** for buttons, labels, menu items and headings ("Last 30 days", "Log a session here").
- **Describe, never judge.** Conditions and tags describe what happened ("Glassy", "Overhead"), never rate it (no "Epic", "Good", "Bad", no scores).
- **Say only what exists.** Copy never claims a feature that isn't built.
- **Two languages.** English and Traditional Chinese as used in Taiwan (zh-TW, never Simplified). Every visible string, aria-label and alt text has both. Use the established terms: 浪點 spot · 湧浪 swell · 週期 period · 陣風 gust · 滿潮 / 乾潮 high / low tide · compass points in CWA's form (北北東). Never translate a spot name by hand. Keep "AI App" in English in zh-TW, never 代理.
- **Metric only**: metres, seconds, m/s, °C. The one exception is board length, in feet and inches (6'2"); volume in litres.
- Times are local at the spot, on a half-hour grid, written "10:00–12:30".

## Colour

- `primary` (#292524, ink grey; was blue #0018FF until 2026-10-24) is the only accent. Use it for buttons, picked tag chips, set filter chips, focus borders, the surfed-day dots and the session's own stretch on the tide curve. White on `primary` for labels and icons in its fills.
- Text is `foreground` (#0C0A09, near-black); secondary text is `muted-foreground` (#59696C). `faint` (#8A9699) is only for tile labels and placeholders (3.0:1 on white; don't use it for new text).
- `secondary` / `muted` (#EEEEEE, neutral, no tint; #F5F5F5 until 2026-10-24, #E6E6E6 tried) is the one grey: condition tiles, pills, the board chip, board cards, unset chips, secondary buttons. It is **80% opaque** (`--grey-opacity`; it was 65%, briefly 100%, then 80% on request, 2026-10-24), so the gradient shows faintly through it. Don't introduce a near-miss grey, and don't use the warm AI Platform grey (#F0EFED): it reads brown here.
- **Grey text straight on the gradient** (no card behind it: the "Sessions" label and match line, the empty and no-match states, Clear, load errors; 2026-10-25, on request) uses `on-page` (#1F2B2D), not `muted-foreground`, which was picked for white cards and fades into the teal. Grey text inside a card keeps `muted-foreground`.
- Borders and inputs: `border` (#E5E5E5).
- **Page background**: a fixed, grainy gradient behind everything (`grainy` in the app; `sl-page` here): a teal-to-pale vertical gradient (no blur since 2026-10-25: it made the background flash white on iPhone Safari while the toolbars collapsed, and changed the picture by ~1.6/255; the layer is also its own GPU layer, `translateZ(0)`), with a bright aqua layer fading out toward the right and a deep navy layer fading out toward the left, under a soft film grain (`overlay` at 60%). **New colours 2026-10-25** (on request): a deeper blue-teal base (#2A6487), aqua #3AA89B, navy #11295E on a pale #EEF3F3 ground (was green-teal #279A87, #3FCAA6, #081C3A on #F2F4F9, grain 70%). **Flipped vertically** (2026-10-24, on request): pale at the top, dark teal and navy at the bottom of the screen. It is fixed to the viewport, so a long page doesn't stretch it. Tokens `grain-base`, `grain-teal`, `grain-aqua`, `grain-navy` hold its main colours. It is atmosphere only: never a fill, a text colour or a border. It replaced the earlier page glow (two blurred orbs at the top right), whose CSS is still in the app, unused.
- Readings (direction arrows, compass words, figures) are `data` = black: readings are not actions.
- `warm` on `warm-soft` is reserved for the "set a goal" nudge and the "Example" badge. Achieved goals are grey pills after an ink check.
- `badge` (#374151, dark grey) for the 常用 / Go-to badge and the avatar fallback.
- The tide curve is `tide-curve` grey (#B8C2C4); the session on it is the one `primary` thing (a line as thick as the curve, flat ends; a dot without a duration).

## Type

- **Funnel Sans** (`sans`) for all UI and notes; **IBM Plex Mono** (`mono`) for readings. Both from Google Fonts (Funnel Sans variable 300–800; Plex Mono 400/500/600). CJK falls back to the system font per glyph. The AI Platform fonts (Newsreader, Inter) were **not** adopted.
- Spot name: `spot-title` (21px bold, −0.02em). Notes: `notes` (15px, 1.6). Chips and labels: `control` (13px medium). Tag line: `tag-line`.
- Condition figures are always mono, tabular, −0.02em: `figure` (16px) inside the tile's `reading` line, units at 10px in `muted-foreground`. Funnel Sans for figures was tried and removed — keep them mono.
- Tile labels: `tile-label` (11px semibold, `faint`). Sub-lines: `small-print`.

## Layout, spacing, radii, elevation

- Every page uses one column: max `page-column` (880px), gutters `space-gutter-sm` / `space-gutter`.
- Cards sit straight on the gradient with `space-card-gap-sm` (8px) between them on phones, `space-card-gap` (12px) from `sm`. Card padding `space-card-x-sm` / `space-card-x`.
- Corners are rounded but tight: cards and menus `r-card` (6px), tiles `r-tile` (4px), fields and default buttons `radius` (9px), chips and pills `r-pill`. Unchanged by the AI Platform restyle.
- White cards are `surface-card`: **75% white** (`--card-opacity`; 60% first, then 80%, 70% and 75% on request, 2026-10-24) plus `card-shadow`, **no border, no backdrop blur** (a blur per card flickered while cards resized). The same see-through card is used on the admin and AI-apps pages and in their loading skeletons; **search bars share the card fill** (no shadow). **Menus, selects and popovers are solid white, 100% opaque**, with `menu-shadow`; dialogs are solid white with `shadow-card`. Tiles, pills and inputs never get a shadow.
- Dividers inside a card use `card-border`; inputs and table rows `border`.
- Condition tiles: Swell · Period · Wind · Water temp · Tide, a 3-column grid on phones, one row from `sm`; missing tiles drop out. Grey stems ("necks") join neighbouring tiles and the board chip's photo to its name. Tile stems are masked to the gaps between tiles, so the see-through grey never doubles into a darker seam.
- The activity calendar's seven dot columns share the card's width (10px minimum each), so a card wider than its content has no blank strip.
- Session card order: header (spot + date, ⋯ menu), board chip + goal pills, notes, tag line, condition tiles, media mosaic (max 260px tall).

## Header and footer

- **Header**: a sticky, full-width **liquid glass bar** (`glass-bar`), square ends, in the iOS style (2026-10-24, on request; **made nearly clear 2026-10-25** after an iOS lock-screen reference, since the first version read as frosted white): a faint white wash (16% at the top, 4% in the middle, 10% at the bottom), an 8px backdrop blur at 180% saturation and a slight brightness lift (1.03) so the page shows through vividly; a crisp white specular line on the top and bottom edges, a soft bright band just inside each edge like light gathered in a lens, a soft shadow beneath, and a faint sheen at both ends (28% / 20%). **In Chromium it also refracts**: an SVG displacement filter (scale 22) bends what passes under the bar's top and bottom rims (blur drops to 2px so the bend stays visible); Safari and Firefox keep the plain version. The black wordmark on the left, the white + button and the avatar on the right, all in the page column. Hides on scroll down.
- **Footer**: no band and no divider, straight on the gradient (2026-10-25, on request: the flat "tide line" version, picked from 14 drawn on a footer canvas). 40px of padding above and below, **white at 70% opacity**. A flat **tide line** runs the width of the page column (two 2px round-ended bars, white at 60%) with the white wordmark (20px tall, on every width) in the gap between them. 20px beneath it, **the round mail button and "© year Surflog" stacked in one centred column**, 12px apart: the button is a **clear glass circle** (32px, `glass-circle`, the header's glass at button size with no border, and a white icon; light grey #E5E5E5 water rises inside it on hover at **30% opacity** and **the icon stays white**).

## States and motion

- **Focus:** fields (inputs, selects, the date and spot triggers, the notes editor) show only a `primary` `ring` border, no glow. Buttons, links and images show no focus paint.
- **Hover:** a slight darkening (grey chips: `secondary` mixed with 4% `foreground`). The + button fills with rising light grey `water` (#E5E5E5) inside the circle; its glyph never moves.
- **Filter chips** are one element that morphs: unset is a 24px round grey icon button with a tooltip; set grows into an ink pill with the value and a chevron (200ms ease-out).
- Heights ease when cards grow or shrink; skeletons fade in after 120ms and pulse; the page fades in over 150ms. Every animation is off under `prefers-reduced-motion`. The page gradient never moves.
- **Single light theme.** Dark mode was tried and removed.

## Iconography

- **lucide-react** line icons at 12–16px (`size-3` in chips, `size-3.5`–`size-4` elsewhere), stroke in the text colour. Board filter uses `WandSparkles`; tags use a plain `#`.
- The **+ mark** (assets/Logos `log-mark.svg`) is Surflog's own: two rectangles, not a lucide icon. It sits in a white 40px circle (ink glyph, hairline shadow) on the glass header.
- No emoji anywhere in the UI.

## Logos

- `surflog-logo.png` — the black wordmark (1200×228). Used in the header, the footer and on every white ground.
- `surflog-logo-white.png` — the white wordmark. Now only for dark grounds (share images).
- Don't recolour, outline or add effects. Height 20–24px in chrome.

## Don't

- No rating or score UI, no judgement tags.
- No dark mode, no ticket-shaped cards, no hover tooltips on figures.
- No gradients except the page background; no solid colour header or footer banner.
- No borders on cards, no coloured left-border accents, no backdrop blur on cards, no see-through menus.
- No second accent colour for readings, and no saturated colour in the interface beyond the glow.

## Not synced

Updated 2026-10-25 from `avery710/surflog`, branch `claude/ios-liquid-glass-header-ddcb1c` (pushed to `staging`, not on `main` yet): the clearer glass header, the glass footer mail button and the new gradient colours. The grainy background, see-through cards (75%), 80% greys, solid menus and the white footer came in on 2026-10-24 and are on `main`. `tokens.json` now carries the ink colours, the 75% card and 80% grey alphas, and the `grain-*` colours; the component cards sit on the gradient (`sl-page`). The glass header and the gradient in `bundle.css` are **approximations** of the app's CSS (the header here has no refraction: that is Chromium-only in the app). Not brought in: shadcn sidebar tokens (unused), the derived Tailwind radius scale, font files (hosted on Google Fonts), the landing photos and share images (licence for the board photos is not settled; share images are still blue). Tuning pages in the app, dev-only: `/dev/glow-lab`, `/dev/glow-options`, `/dev/glass-header`, `/dev/grey-options`. Components are **static renditions** hand-written from the source classes into `components/bundle.css`, not the React library. Still without a card: MediaMosaic, the media viewer, the spot picker, the share dialog and the other dialogs.

## Tokens

### Colour

| Token | Value | Use |
| --- | --- | --- |
| `primary` | `#292524` | The one accent, an ink grey (was blue #0018FF until 2026-10-24): buttons, picked tag chips, set filter chips, focus borders, the surfed-day dots, the session's own mark on the tide curve. 15.2:1 on white, both as text on white and white on it. |
| `primary-foreground` | `#ffffff` | Text and icons on `primary` fills. |
| `accent` | `#eeeeeecc` | The neutral grey at 80% opacity behind `accent-foreground`; rare. |
| `accent-foreground` | `{foreground}` | Text on `accent`. |
| `background` | `#ffffff` | Inputs, checkboxes and photo placeholders inside cards. Stays white even if the page changes. |
| `panel` | `#ffffff` | The page background fallback (body, public share page). On screen the fixed grainy gradient (`grain-*`) sits in front of it. |
| `card` | `#ffffffbf` | Cards, 75% white (`--card-opacity`; 60%, then 80%, 70%, and 75% on request) so the gradient shows through: no border, no backdrop blur, held up by `card-shadow`. Search bars use the same fill without the shadow. Dialogs, the + button and the notes editor use the solid `background` instead. |
| `popover` | `#ffffff` | Menus, selects, popovers: solid white, 100% opaque, lifted by `menu-shadow`. |
| `foreground` | `#0c0a09` | All body copy, spot names, figures: near-black. 19:1 on white. |
| `card-foreground` | `{foreground}` | Text on `card`. |
| `popover-foreground` | `{foreground}` | Text in menus. |
| `data` | `{foreground}` | Readings: direction arrows and compass words. Deliberately not blue: readings are not actions. |
| `secondary` | `#eeeeeecc` | The one light grey, #EEEEEE (was #F5F5F5; #E6E6E6 tried), **80% opaque** (`--grey-opacity`; 65%, then 100%, then 80% on request, 2026-10-24): condition tiles, pills, the board chip, board cards, unset filter chips, secondary buttons. |
| `secondary-foreground` | `{foreground}` | Text on `secondary` buttons. |
| `muted` | `#eeeeeecc` | Hover fill for ghost and outline controls; same grey as `secondary`. |
| `muted-foreground` | `#59696c` | Secondary text: units, small print, tag line, chip labels, tide-time labels. 5.7:1 on white, 5.2:1 on `secondary`. |
| `on-page` | `#1f2b2d` | Secondary text that sits straight on the page gradient with no card behind it (the “Sessions” label and match line, empty and no-match states, Clear, load errors). Darker than `muted-foreground`, which fades into the teal. Added 2026-10-25. |
| `faint` | `#8a9699` | Condition-tile labels (11px semibold) and editor placeholders. 3.0:1 on white and 2.8:1 on `secondary`: below 4.5:1 for small text — kept exact from the source; don't use it for anything new that must be read. |
| `tide-curve` | `#b8c2c4` | The tide curve line only, so it recedes behind the blue session mark. Decorative; never text. |
| `border` | `#e5e5e5` | Input borders, dividers, table rows. |
| `input` | `#e5e5e5` | Text field and select borders at rest (focus turns them `ring`). |
| `line-soft` | `#eff3f3` | The faintest rule, inside grey-on-white tables. |
| `card-border` | `rgba(0, 0, 0, 0.16)` | Dividers inside cards only; cards themselves have no outline. |
| `ring` | `{primary}` | Focus border on fields (a blue border, no glow). Buttons and links show no focus paint. |
| `badge` | `#374151` | Dark grey fill: the board rack's 常用 / Go-to badge and the avatar fallback. White on it is 10.3:1. |
| `badge-foreground` | `#ffffff` | Text on `badge`. |
| `warm` | `#b35a28` | The “set a goal” nudge and the landing's “Example” badge; the one warm accent. 4.8:1 on white but 4.07:1 on `warm-soft` (the 11.5px semibold Example badge): under 4.5:1, kept exact from the source. |
| `warm-soft` | `#fbeadf` | Fill behind `warm` text and the “set a goal” nudge box. |
| `destructive` | `#dc2626` | Delete and error text, and its 10% tint as the destructive button's fill. |
| `water` | `#e5e5e5` | The water that rises inside the white + button on hover, and (at 30% opacity) inside the footer's glass mail button. |
| `chart-1` | `{primary}` | First chart series. |
| `chart-2` | `{muted-foreground}` | Second chart series. |
| `chart-3` | `{faint}` | Third chart series. |
| `chart-4` | `{warm}` | Fourth chart series. |
| `chart-5` | `{foreground}` | Fifth chart series. |
| `grain-base` | `#eef3f3` | The page background ground under the grainy gradient (`.grainy`): a pale grey-green (#F2F4F9 until 2026-10-25). |
| `grain-teal` | `#2a6487` | The base layer's main colour, a deep blue-teal (#307C8E at its very end; #279A87 until 2026-10-25). With the flip it sits at the bottom of the screen. |
| `grain-aqua` | `#3aa89b` | The aqua layer, masked to fade out toward the right (#3FCAA6 until 2026-10-25). |
| `grain-navy` | `#11295e` | The deep navy layer, masked to fade out toward the left (#081C3A until 2026-10-25). Gradient and grain only, never text or fills. |

### Type

Families:

- `sans`: "Funnel Sans", system-ui, sans-serif
- `mono`: "IBM Plex Mono", ui-monospace, monospace

**Interface** (`sans`)

| Style | Size / line | Weight | Spacing | Use |
| --- | --- | --- | --- | --- |
| `spot-title` | 21px / 1.25 | 700 | -0.02em | The spot name heading each session card. |
| `notes` | 15px / 1.6 | 400 |  | Session notes and the notes editor (16px on iOS to stop focus zoom). |
| `board-name` | 13.5px / 20px | 500 | -0.01em | Board chip name, goal pills. |
| `control` | 13px / 20px | 500 |  | Chips, the date beside the spot name, section labels (bold). |
| `tag-line` | 12.5px / 16px | 500 |  | The tag line under a card's notes, in `muted-foreground`. |
| `button` | 14px / 20px | 500 |  | Default buttons. |
| `tile-label` | 11px / 16px | 600 | 0.01em | Condition-tile labels, in `faint`. |
| `small-print` | 10.5px / 14px | 500 |  | Tile sub-lines, in `muted-foreground`. |

**Readings** (`mono`)

| Style | Size / line | Weight | Spacing | Use |
| --- | --- | --- | --- | --- |
| `stat` | 24px / 1 | 600 | -0.02em | Large single readings (StatCard). |
| `figure` | 16px / 1.25 | 500 | -0.02em | The prominent figure in every condition tile. Always mono, tabular. |
| `reading` | 14px / 20px | 500 | -0.02em | A tile's value line. |
| `count` | 10.5px / 16px | 600 |  | Match-count badge and menu counts. |

### Spacing

| Token | Value | Use |
| --- | --- | --- |
| `space-card-gap-sm` | `8px` | Gap between dashboard cards and between session cards on phones (`gap-2`). |
| `space-card-gap` | `12px` | The same gaps from `sm` (`gap-3`). |
| `space-card-x-sm` | `16px` | Card side padding on phones (`px-4`). |
| `space-card-x` | `24px` | Card side padding from `sm` (`px-6`). |
| `space-tile-x` | `10px` | Condition-tile horizontal padding (12px from `sm`). |
| `space-tile-y` | `8px` | Condition-tile vertical padding (10px from `sm`). |
| `space-gutter-sm` | `14px` | Page column gutter on phones (`PAGE_COLUMN`). |
| `space-gutter` | `18px` | Page column gutter from `sm`. |
| `page-column` | `880px` | Max width of every page column (`PAGE_COLUMN`, lib/layout.ts). |

### Radius

| Token | Value | Use |
| --- | --- | --- |
| `r-card` | `6px` | White cards, menus, dialogs. |
| `r-tile` | `4px` | Condition tiles, menu items, the goal nudge. |
| `radius` | `9px` | Inputs, selects and default buttons (`rounded-lg`). |
| `r-pill` | `9999px` | Chips, pills, the + button, action buttons in dialogs (`rounded-full`). |

### Shadow

| Token | Value | Use |
| --- | --- | --- |
| `card-shadow` | `0 1px 2px 0 rgba(13, 13, 18, 0.06), 0 4px 12px 0 rgba(13, 13, 18, 0.06)` | Resting white cards (`shadow-soft`). The only thing separating a card from the white page. |
| `menu-shadow` | `0 8px 24px 0 rgba(13, 13, 18, 0.16)` | Menus, selects, popovers (`shadow-menu`). |
| `shadow-card` | `0 1px 2px rgba(0, 0, 0, 0.04), 0 10px 28px -20px rgba(0, 0, 0, 0.28)` | Dialogs and the + button. |

## Components

#### ActivityCalendar

"Days in the water": a fixed dot grid of week rows, one 10px dot per day, ink where you surfed.

- Sunday-first, 7 columns, 10px dots with 10px gaps; rows 8px apart; every row a full Sunday–Saturday week, the current week at the bottom.
- Surfed days `primary`; other past days a pale grey (25% `faint` into white); future days an outline of that grey. Days carry a native `title` with the count.
- Month labels sit left of a row at 10px bold uppercase; only the current month is `foreground`, the rest use the dot grey (low contrast, by choice).
- At least 4 weeks visible; from `sm` the card stretches to the goal card's height and shows more weeks; older weeks scroll in with ↑ / ↓ in a side rail (on phones, at the end of the title row).
- Below `sm` at full width the last session sits beside it as its own white card, same height.
- "Today" is Asia/Taipei. Weekday letters are 日一二三四五六 in zh-TW.
- Consumer provides the slim session list. Source: `components/activity-calendar.tsx`. Static rendition.

#### AddButton

The header's white 40px "+" circle that logs a session, with Surflog's own two-rectangle mark in `primary`.

- Lives on the iOS-style glass header bar, beside the avatar. Solid white fill, `shadow-card`, tooltip "Log a session".
- Hover: `water` rises inside the circle as a damped spring that follows the pointer; **the glyph never moves**. Off under reduced motion (a 1.06 scale instead). The rendition shows rest and a still of the hovered state.
- The mark is `LogIcon` (assets/Logos `log-mark.svg`), not a lucide plus.
- The wordmark beside it is black.
- Source: `components/add-button.tsx`, `.ab.v3b` in `app/globals.css`. Static rendition.

#### BoardRack

The dashboard's rack of boards: a white card holding grey `secondary` board cards, two up from `sm`.

- Each board: a square photo (64–96px, 4px corners, matching the text column's height) left of the name (15px bold), specs in mono (length in feet/inches · litres · rocker) and a two-line note. **No photo, no square**: the text takes the full width.
- Go-to (常用) boards come first; their badge is a 24px `primary` pill with just the label, and tapping it removes Go-to. Any number may be Go-to.
- ⋯ menu per board (edit, Go-to, delete). **Reorder** mode turns the whole card into the drag surface (one list; cross-group drops snap back); the badge is inert while sorting.
- The card's height eases as boards are added or removed (`WhiteCard`).
- Consumer provides boards (brand, `length_in`, `volume_l`, rocker, note, photo, `is_favorite`, `sort_order`). Source: `components/board-rack.tsx`. Static rendition; photos are left as empty squares.

#### Button

The shadcn button restyled for Surflog: `primary` fill by default, a `secondary` grey for cancel and keep, `destructive` as red text on a 10% tint.

- **Variants:** default, secondary, outline, ghost, destructive, link. **Sizes:** xs 24px, sm 28px, default 32px, lg 36px, icon sizes square.
- Default corners are `radius` (9px). Inside dialogs and on cards, action pairs are pills (`rounded-full`): secondary on the left, the action on the right.
- One primary button per view. Destructive actions confirm in a dialog first.
- Labels are sentence case verbs ("Save session"); icons 16px, lucide.
- No focus paint on buttons (by decision); press nudges 1px down.
- Consumer provides: label, `variant`, `size`, `onClick` / `asChild` for links. Source: `components/ui/button.tsx`. Static rendition here.

#### ConditionTile

A grey `secondary` tile holding one reading: an 11px `faint` label, a mono figure, an optional small-print line.

- Order on a card: Swell · Period · Wind · Water temp · Tide. Missing readings drop out; never show a placeholder tile.
- Figures are always `mono`, tabular, −0.02em; units 10px `muted-foreground`. Keep them mono.
- Direction is an arrow + CWA compass word in `data` (black). The wind sub-line adds the strength word and the shore word; gust is not shown.
- The Tide tile shows direction and next turning point, plus a day chart (not in this rendition).
- 3-column grid on phones, one row from `sm`; neighbouring tiles are joined by grey necks in the app.
- No hover tooltips on figures. Consumer provides: `label`, `value`, `unit`, `sub`. Source: `components/condition-tile.tsx`. Static rendition.

#### DatePicker

The app's one date field: an input-shaped trigger that opens a month calendar in a popover (Radix), replacing the browser's native picker.

- **md** (log form): a 32px field like Input, no icon, not clearable; `today` is the chosen spot's today; later days are greyed (no future sessions).
- **sm** (filter From / To): 28px with a calendar icon, `min` / `max` grey out days, × to clear and a Clear button in the footer.
- Popover: 272px, solid `popover` fill (100% opaque), `menu-shadow`, `r-card`. Month title 13px bold with round ‹ › buttons; Sunday-first weekday letters; fixed 6 rows; days are 32px circles in mono 12.5px.
- Picked day: filled `primary`, bold. Today: bold `primary` text. Disabled: `muted-foreground` at 40%. Footer "Today" in `primary`.
- Focus/open: the trigger's border turns `ring`, no glow. Keyboard arrow navigation between days is not built (Tab works).
- en / zh-TW month and weekday names. Source: `components/date-picker.tsx`, `lib/calendar-grid.ts`. Static rendition.

#### FilterChip

The session list's filter control: one element that morphs from a small round grey icon button into an ink pill carrying its value.

- Four chips in order: **Date · Spot · Board · Tag**, right-aligned on the "Sessions" title line from `lg`, under it on phones.
- Unset: 24px round `secondary`, 12px lucide icon (`CalendarDays`, `MapPin`, `WandSparkles`, `Hash`), a tooltip with its name, hover darkens 4%.
- Set: `primary` fill, white value and chevron; the value column eases open 200ms ease-out. "Clear" fades in after the chips; the match count is a grey mono badge after the title.
- Each opens a radio menu (Tag: checkboxes, any-of), at least 150px wide.
- Don't add the water hover from the + button (tried and removed). Source: `components/session-filter.tsx`. Static rendition.

#### Footer

The page footer on every screen: no band and no divider, straight on the gradient.

- Transparent, with **40px above and below** its content (plus the device's bottom safe area). A 40px gap above it keeps it off the last card; `mt-auto` pins it to the bottom of a short page. All of it is **white at 70% opacity**.
- **The tide line** (2026-10-25, on request; "variation 12" of 14 drawn on a footer canvas, the flat one of two: a wavy version was the other pick): two flat bars, 2px tall with round ends, white at 60%, run from each edge of the page column to the white wordmark (20px tall on every width, never smaller) sitting in the gap between them, 16px from it on phones and 24px from `sm`. It echoes the tide chart, where the labels also sit in gaps in the curve.
- **Beneath the line, 20px down, one centred column**, 12px apart: the round mail button, then "© year Surflog" (12.5px). The two are stacked, not side by side.
- The mail button is 32px (44px touch area), a **clear glass circle** (`glass-circle`, 2026-10-25, on request: the header's glass at button size, a faint white wash, 8px blur at 180% saturation, a bright top edge and soft inner glow, no border) with a white icon; it links to `mailto:support@surflog.tw` (the address is only in its `aria-label`). On hover `water` (#E5E5E5) rises inside it at **30% opacity** and the button darkens 5%; **the icon stays white** and never moves. The rendition shows rest and a still of the hovered state.
- No Privacy / Terms links until those pages exist. Hidden on `/dev/session-card` and `/dev/footer-options`.
- History (all on request): 2026-10-24, a full-width `primary` banner, a hairline above a grey stack, a black band, black content with a content-width divider, then a plain centred stack (wordmark, mail button, ©). 2026-10-25, the mail button went from a white outline to glass, then the stack became the tide line above. Seven other directions were drawn and not built: a glass bar, a floating glass pill, a glass card with a tagline, a huge wordmark, one quiet © line, a white "Email us" pill, and wave and curve versions of the line.
- Source: `components/site-footer.tsx`, `.wv` and `.glass-circle` in `app/globals.css`. Static rendition.

#### GoalCard

Your one technique goal, as points, with how many sessions met each; and the tick list in the log form.

- Display: grey `secondary` pills (13.5px bold, 14px corners) for each point, each followed by a count pill in `primary` bold (`✓ 3`, full text `sr-only`), joined by a neck.
- Empty: the placeholder "Add a technique goal…" in `faint`, flush with the card title; tapping the card edits it.
- Editing: one field per point, add with **+** (no Enter shortcut: it clashed with 注音 / 倉頡), drag handles to reorder.
- In the log form and edit panel: a grey fieldset "Which did you achieve?" with ink checkboxes, one per point.
- On a session card, achieved points show as grey pills after an ink check in a grey circle (see SessionCard). The `warm` nudge invites setting a goal.
- Counts match points by exact wording. Text ≤200 characters. Source: `components/goal.tsx`. Static rendition.

#### LogForm

The "Log a session" dialog: spot, date, time and duration, then tags, notes, board, goal ticks, media, Save.

- Field order is fixed: **Spot** (full width, with a "Default spot" toggle pill) · **Date** · **Time** · **Duration** in one row of three from `sm`; then the tag picker (above the notes), notes, board, goal ticks, media, the Save pill.
- Labels are 12px semibold `muted-foreground` above each field, 6px gap; fields are 32px with `input` borders, `radius` corners, a `ring` border on focus.
- Time is on a half-hour grid; later slots are greyed (no future sessions). Duration is optional, 30-minute steps up to 4 h; while the start is still the untouched "now", choosing one moves the start back so the session ends now.
- Date is the DatePicker (md); Spot is the spot picker (Siargao and Bali first, "Near me" on tap); Board pre-selects the last-used board.
- Notes are rich text (bold / italic / underline, `- ` bullets, Tab nests); keep Chinese IME composition intact.
- Save is a `primary` pill with 24px side padding; an uploading hint sits beside it. The dialog is `card`, `shadow-card`, `r-card`, 24px padding, max 512px.
- Source: `components/log-form.tsx`. Static rendition: no spot picker, goal ticks or media picker drawn.

#### Menu

The floating panel behind every dropdown (the card's ⋯ menu, the avatar menu), select list and popover.

- **Solid white, 100% opaque** (`popover`), `r-card` corners, `menu-shadow`, 6px padding, at least 220px wide. The cards beneath are 75% white and the menu stays solid on purpose (a see-through menu was tried and reverted, 2026-10-24).
- Items are 13px medium, `r-tile` corners, 6px 8px padding, a 16px lucide icon on the left; hover fills `muted`. A destructive item (Delete) is `destructive` text and asks to confirm in a dialog first.
- Submenus (avatar → Language) open **inline as an accordion**, never a side flyout.
- The date picker's popover, the select list and the spot picker's popover share this surface; the phone spot picker is a full-screen sheet and stays opaque.
- Source: `components/ui/dropdown-menu.tsx`, `select.tsx`, `date-picker.tsx`, `surface-menu` in `app/globals.css`. Static rendition.

#### SessionCard

One logged session as a see-through white `card` (75%) with `card-shadow`: header, board chip and goal pills, notes, tag line, condition tiles, media.

- **Order is fixed:** spot name (`spot-title`) + date/time, ⋯ menu (Edit / Share / Delete); board chip + achieved goal pills on one wrapping row; notes in `notes`; tag line; tiles; media mosaic (full width, max 260px tall). Missing parts drop out.
- Borderless, `r-card` corners, padding `space-card-x-sm` → `space-card-x`. No divider above the notes.
- Achieved goals: an ink check in a grey circle, then each point as a grey `secondary` pill (13.5px medium), joined by necks in the app. Goal ticks never appear on share images.
- `warm` on `warm-soft` appears on a card only as the "set a goal" nudge and the landing's "Example" badge.
- `readOnly` drops the ⋯ menu (landing page).
- The real board chip has the board's photo in a 30px circle joined by a grey neck; this rendition shows the name pill only.
- Consumer provides a full Session (spot, when, duration, board, notes, tags, conditions, photos). Source: `components/entry-card.tsx`. Static rendition.

#### TagChip

A 28px pill for picking a session's tags, and the quiet tag line that shows them on the card.

- Off: `secondary` with `muted-foreground` text. Picked: filled `primary`, white text, no check mark (width never changes).
- "+ Add tag" is a dashed outline pill; typing opens an inline field at the same 13px.
- Group labels (Waves, Size, Lineup, Others) are 10px uppercase semibold.
- On the card, tags are one `tag-line` under the notes: a `#`, then words separated by dots, in `muted-foreground`. Not tappable.
- Descriptive only: no judgement tags, no wind/tide or board tags. Up to 8 tags, 24 characters each.
- Source: `components/tag-picker.tsx`, `components/tag-line.tsx`. Static rendition.

#### TideChart

A small schematic tide wave in the Tide tile: the turning points around the session joined by half-cosines, with the session as the one `primary` (ink) thing on it.

- 40px tall, as wide as the tile. The curve is 2.25px `tide-curve`, drawn as separate runs with round ends.
- The low and high either side of the session are timed **inside gaps cut in the curve**, 9px Funnel Sans in `muted-foreground`, bending with the curve in the app (a `textPath` on a flattened copy, 0.6px letter-spacing). No dots, no labels above or below.
- With a duration, the session is a solid `primary` line as thick as the curve with flat ends, meeting the grey flush (at least 8px long). Without one, a single `primary` dot (r 3.4).
- It shows where in the cycle you were, not measured heights. CWA events when present, else Open-Meteo. Needs two events or it renders nothing.
- Round every drawn number to 0.01 (server and browser `Math.cos` differ).
- Source: `components/tide-chart.tsx`, `components/tide-labels.ts`. Static rendition: the labels here sit at the flat turning points, not on a `textPath`.

## Logo assets

- `surflog-logo.png` — black wordmark, 1200×228, transparent. On white grounds.
- `surflog-logo-white.png` — white wordmark for the blue header, the blue footer and dark grounds.
- `log-mark.svg` — the "+" mark from `LogIcon`, single ink `primary` (#0018FF); in the app it inherits `currentColor`.
