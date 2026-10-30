import type { Lang } from "./i18n";

/**
 * The starter roadmap (SURFLOG-38): levels → skills → steps. Every user gets
 * a copy of these blocks the first time they pick a level (lib/roadmap.ts
 * seedRows) and builds on it; the catalogue itself never changes per user.
 * Block keys (`l1.read`, `l1.read.peak`) are stored as `template_key` on
 * the user's rows, so **never rename or reuse a key**; add new ones.
 *
 * Levels 0–3 are fixed (Avery, 2026-10-28): 0 First waves · 新手村, 1 Beginner
 * · 初級, 2 Intermediate · 進階, 3 Advanced · 高階, which splits into a
 * longboard and a mid-length/shortboard track. Structure after
 * surfcheck.tw's learning roadmap; every line is our own wording, checked
 * against the sources listed in GOAL-ROADMAP.md (Australian SISOSRF units,
 * ISA, Lapoint, Barefoot, Rapture, SLSA, longboard guides).
 *
 * zh-TW follows how surfers in Taiwan talk in the water: manoeuvre names stay
 * in English (Bottom turn, Cutback, Snap, Floater, Hang five); 壓浪 for duck
 * dive, 翻板 for turtle roll, 搶浪 for drop in, 左手浪／右手浪, 一組浪, 浪壁,
 * 浪頂. Glossary in GOAL-ROADMAP.md. Unreviewed by Avery.
 */

export type Bi = { en: string; zh: string };
export type Group = "ocean" | "ride" | "lineup";
export type Step = { id: string; text: Bi };
export type Skill = { id: string; group: Group; name: Bi; steps: Step[] };
export type TrackId = "long" | "short";
export type Track = { id: TrackId; name: Bi; blurb: Bi; test: Bi; skills: Skill[] };
export type LevelN = 0 | 1 | 2 | 3;
export type Level = {
  n: LevelN;
  name: Bi;
  youAre: Bi;
  /** Rough size of wave and time in the water, as a guide, not a gate. */
  guide: Bi;
  test?: Bi;
  skills?: Skill[];
  tracks?: Track[];
  note?: Bi;
};

export const bi = (b: Bi, lang: Lang) => (lang === "zh-TW" ? b.zh : b.en);

export const GROUPS: { id: Group; name: Bi }[] = [
  { id: "ocean", name: { en: "Ocean & safety", zh: "海況與安全" } },
  { id: "ride", name: { en: "Riding", zh: "技術" } },
  { id: "lineup", name: { en: "Lineup & etiquette", zh: "浪區禮儀" } },
];

const s = (id: string, en: string, zh: string): Step => ({ id, text: { en, zh } });
const k = (id: string, group: Group, en: string, zh: string, steps: Step[]): Skill => ({
  id,
  group,
  name: { en, zh },
  steps,
});

export const LEVELS: Level[] = [
  {
    n: 0,
    name: { en: "First waves", zh: "新手村" },
    youAre: { en: "New to surfing, or only been in a few times", zh: "第一次衝浪，或只下水過幾次" },
    guide: { en: "Whitewater up to about 0.5 m · first ~10 hours", zh: "0.5 米以下的白浪 · 前 10 小時左右" },
    test: {
      en: "Stand up on whitewater in the shallows and ride it all the way to the beach.",
      zh: "在淺水區的白浪上起乘，一路滑回沙灘。",
    },
    skills: [
      k("l0.safety", "ocean", "Beach safety", "海邊安全", [
        s("l0.safety.check", "Check flags and hazards before going in", "下水前看旗子、問清楚哪裡有暗礁或危險"),
        s("l0.safety.rip", "Spot a rip from the beach", "在岸上就看出哪裡有離岸流"),
        s("l0.safety.escape", "Know what to do in a rip: float, signal, go sideways", "被離岸流帶走時：抱板漂著、舉手求救、往側邊划出去"),
      ]),
      k("l0.gear", "ocean", "Board and leash", "板子與腳繩", [
        s("l0.gear.wax", "Wax the board and check the leash", "板子上蠟、檢查腳繩"),
        s("l0.gear.carry", "Walk out with the nose facing the waves", "板頭對著浪走出去"),
      ]),
      k("l0.fall", "ocean", "Falling safely", "安全落水", [
        s("l0.fall.flat", "Fall flat and away from the board, never head-first", "往板子的反方向平躺落水，絕不頭先下"),
        s("l0.fall.cover", "Cover your head as you come up", "浮上來時用手護頭"),
      ]),
      k("l0.paddle", "ride", "Lying and paddling", "趴板與划水", [
        s("l0.paddle.nose", "Nose just above the water", "趴對位置，板頭剛好浮出水面"),
        s("l0.paddle.long", "Long strokes, chest up", "抬胸、手划長一點"),
        s("l0.paddle.straight", "Paddle straight for 20 m", "直直划 20 米不歪掉"),
      ]),
      k("l0.popup", "ride", "Pop-up and stance", "起乘與站姿", [
        s("l0.popup.sand", "10 pop-ups on the sand", "在沙灘上練 10 次起乘"),
        s("l0.popup.onemove", "Up in one move, no knees", "一個動作站起來，不跪膝"),
        s("l0.popup.feet", "Land with feet across the centre line, knees bent", "兩腳踩在中線上、膝蓋微彎"),
        s("l0.popup.eyes", "Eyes forward, not on your feet", "眼睛看前面，不要看腳"),
      ]),
      k("l0.white", "ride", "Riding whitewater", "滑白浪", [
        s("l0.white.catch", "Catch whitewater on your own", "不用推，自己追到白浪"),
        s("l0.white.beach", "Ride one to the beach", "一路滑到岸邊"),
        s("l0.white.steer", "Lean to steer a little left or right", "靠重心往左或往右轉一點"),
      ]),
      k("l0.share", "lineup", "Sharing the water", "跟大家一起下水", [
        s("l0.share.clear", "Keep clear of anyone riding toward you", "有人朝你滑過來就讓開"),
        s("l0.share.hold", "Keep hold of your board", "不要丟板"),
      ]),
    ],
  },
  {
    n: 1,
    name: { en: "Beginner", zh: "初級" },
    youAre: {
      en: "You can stand up, but can't get out the back or catch green waves alone yet",
      zh: "站得起來了，但還不會自己划出去、自己追綠浪",
    },
    guide: { en: "Unbroken waves to about 1 m · roughly 10–60 hours", zh: "1 米以下還沒破的綠浪 · 大約 10–60 小時" },
    test: {
      en: "With no coach, get past the break, choose a wave, angle left or right and ride it back in.",
      zh: "不靠教練，自己划出浪區、挑浪、往左或往右斜跑，再滑回岸邊。",
    },
    skills: [
      k("l1.out", "ocean", "Getting out the back", "划出浪區", [
        s("l1.out.push", "Push through whitewater", "撐板過白浪"),
        s("l1.out.turtle", "Turtle roll under a bigger wave", "大一點的浪用翻板過"),
        s("l1.out.gap", "Go out in the gap between sets", "等一組浪打完，趁空檔划出去"),
        s("l1.out.channel", "Use the channel to paddle out", "走水道划出去"),
      ]),
      k("l1.cond", "ocean", "Reading conditions", "看浪況", [
        s("l1.cond.forecast", "Check swell, wind and tide before you go", "出門前先看湧浪、風向和潮汐"),
        s("l1.cond.spot", "Pick a spot that suits you that day", "挑當天適合自己的浪點"),
      ]),
      k("l1.sit", "ride", "Sitting and turning", "坐板與轉板", [
        s("l1.sit.steady", "Sit steadily on the board", "穩穩坐在板上等浪"),
        s("l1.sit.spin", "Spin to face the beach quickly", "浪來時快速轉板頭向岸"),
      ]),
      k("l1.read", "ride", "Reading waves", "讀浪", [
        s("l1.read.peak", "Spot where the peak forms", "看出浪峰會在哪裡立起來"),
        s("l1.read.mark", "Pick a lineup marker on land", "在岸上找定位點"),
        s("l1.read.sets", "Tell sets from lulls", "分得出一組浪和空檔"),
      ]),
      k("l1.chase", "ride", "Catching green waves", "追綠浪", [
        s("l1.chase.early", "Paddle early and hard", "提早用力划"),
        s("l1.chase.extra", "Two extra strokes once it pushes you", "感覺被浪推了再多划兩下"),
        s("l1.chase.commit", "Commit on the drop", "要起乘就不要猶豫"),
      ]),
      k("l1.angle", "ride", "Angled take-off", "斜跑", [
        s("l1.angle.look", "Look down the line as you pop up", "起乘時看浪要走的方向"),
        s("l1.angle.both", "Go right and go left", "右手浪、左手浪都能斜跑"),
        s("l1.angle.trim", "Trim along the face", "沿著浪壁走"),
      ]),
      k("l1.rules", "lineup", "Lineup rules", "浪區規矩", [
        s("l1.rules.priority", "Know who has priority: closest to the peak", "知道誰有優先權：最靠近浪峰的人"),
        s("l1.rules.dropin", "Never drop in; if you do, pull off and say sorry", "不搶浪；不小心搶到就馬上退出、說聲抱歉"),
        s("l1.rules.wide", "Paddle wide around people riding", "划出去時從別人滑行路線的外側繞"),
      ]),
    ],
  },
  {
    n: 2,
    name: { en: "Intermediate", zh: "進階" },
    youAre: {
      en: "You catch and angle waves on your own, but don't turn on them yet",
      zh: "能自己追浪、斜跑，但還不太會在浪上做轉向",
    },
    guide: { en: "Open-face waves to about 1 m and up · roughly 60–100 hours", zh: "1 米左右以上、有浪壁的浪 · 大約 60–100 小時" },
    test: {
      en: "Ride a wave start to finish, linking a bottom turn, a top turn and a cutback, and kick out under control.",
      zh: "一道浪從頭滑到尾，串起 Bottom turn、Top turn 和 Cutback，最後穩穩出浪。",
    },
    skills: [
      k("l2.duck", "ocean", "Duck dive", "壓浪", [
        s("l2.duck.waist", "Duck dive under a waist-high wave", "腰高的浪壓得過去"),
        s("l2.duck.head", "Get out on a head-high day without being washed in", "一人高的浪況也划得出去，不被打回岸邊"),
      ]),
      k("l2.spot", "ocean", "New spots", "陌生浪點", [
        s("l2.spot.scan", "Find the channel and rips before paddling out", "下水前先看好水道和離岸流"),
        s("l2.spot.limit", "Know when it's beyond you and stay in", "浪超過自己能力時，知道要在岸上看就好"),
      ]),
      k("l2.select", "ride", "Wave selection", "挑浪", [
        s("l2.select.lr", "Tell lefts from rights before they break", "浪還沒破就看出是左手浪還是右手浪"),
        s("l2.select.shoulder", "Sit where the shoulder opens", "坐在浪肩會打開的位置"),
        s("l2.select.best", "Pick the best wave in a set", "挑一組浪裡最好的那道"),
      ]),
      k("l2.speed", "ride", "Speed", "加速", [
        s("l2.speed.pump", "Pump: compress and extend", "Pump：蹲低再伸展來加速"),
        s("l2.speed.high", "Ride a high line when it's fast", "浪跑得快時走高線"),
        s("l2.speed.section", "Make a section you'd have lost", "衝過快要蓋掉的段落"),
      ]),
      k("l2.bottom", "ride", "Bottom turn", "Bottom turn", [
        s("l2.bottom.drop", "Drop to the bottom and turn back up", "下到浪底再轉回浪壁"),
        s("l2.bottom.look", "Lead with your eyes and shoulders", "用眼睛和肩膀帶轉向"),
      ]),
      k("l2.top", "ride", "Top turn", "Top turn", [
        s("l2.top.redirect", "Turn off the top and come back down", "在浪頂轉向再下來"),
        s("l2.top.link", "Link a bottom turn into a top turn", "Bottom turn 接 Top turn"),
      ]),
      k("l2.cutback", "ride", "Cutback", "Cutback", [
        s("l2.cutback.turn", "Turn back toward the white", "轉回浪的力量區（白浪那側）"),
        s("l2.cutback.finish", "Finish and keep riding", "轉完接著繼續滑"),
      ]),
      k("l2.crowd", "lineup", "Crowded lineups", "人多的浪點", [
        s("l2.crowd.call", "Call your direction on a split peak", "左右都能走的浪峰，喊出你要走哪邊"),
        s("l2.crowd.share", "Wait your turn and share the peak", "照順序輪流，不霸浪"),
        s("l2.crowd.locals", "Watch first at a new spot and respect locals", "到新浪點先觀察，尊重在地浪人"),
      ]),
    ],
  },
  {
    n: 3,
    name: { en: "Advanced", zh: "高階" },
    youAre: { en: "You turn on the wave. Pick the way you want to ride", zh: "已經能在浪上轉向，選你想走的方向" },
    guide: { en: "Open-face waves to about 2 m · 100+ hours", zh: "2 米左右、有浪壁的浪 · 100 小時以上" },
    note: {
      en: "Going shorter? Ride a mid-length first: a board that's too short too soon makes waves harder to catch.",
      zh: "想換短板？先玩一陣子中長板：太早換太短的板，反而追不到浪。",
    },
    tracks: [
      {
        id: "long",
        name: { en: "Longboard", zh: "長板" },
        blurb: { en: "Slow, relaxed, stylish", zh: "慢節奏、放鬆、有型" },
        test: { en: "Walk up to the nose and hang five.", zh: "走到板頭，做出 Hang five。" },
        skills: [
          k("l3l.line", "ride", "Picking your line", "選路線", [
            s("l3l.line.pocket", "Stay in the pocket", "待在浪的 Pocket（力量區）"),
            s("l3l.line.stall", "Stall when the wave falls behind you", "跑太前面時 Stall 等浪"),
          ]),
          k("l3l.walk", "ride", "Cross-stepping", "走板（交叉步）", [
            s("l3l.walk.white", "Cross-step on whitewater first", "先在白浪上練交叉步"),
            s("l3l.walk.two", "Two cross-steps up and back on a green wave", "綠浪上交叉步往前兩步、再走回來"),
          ]),
          k("l3l.nose", "ride", "Noseriding", "站板頭（Noseride）", [
            s("l3l.nose.cheater", "Cheater five: weight back, one foot forward", "Cheater five：重心留在後面、單腳往前伸"),
            s("l3l.nose.hang5", "Hang five", "Hang five"),
            s("l3l.nose.hang10", "Hang ten", "Hang ten"),
          ]),
          k("l3l.turn", "ride", "Longboard turns", "長板轉向", [
            s("l3l.turn.dropknee", "Drop-knee turn", "Drop-knee turn"),
            s("l3l.turn.cutback", "Full cutback on a longboard", "長板做完整的 Cutback"),
          ]),
        ],
      },
      {
        id: "short",
        name: { en: "Mid-length / shortboard", zh: "中長板／短板" },
        blurb: { en: "Speed, big turns, spray", zh: "速度、大轉向、甩水花" },
        test: { en: "Hit the lip and throw spray.", zh: "打浪頂，甩出水花。" },
        skills: [
          k("l3s.adapt", "ocean", "A shorter board", "換短一點的板", [
            s("l3s.adapt.mid", "Catch waves on a mid-length", "用中長板追得到浪"),
            s("l3s.adapt.paddle", "Paddle a shorter board steadily", "划短板也划得穩"),
            s("l3s.adapt.duck", "Duck dive a shortboard through a set", "短板壓浪壓過一整組浪"),
          ]),
          k("l3s.rail", "ride", "Rail to rail", "換 Rail", [
            s("l3s.rail.bottom", "Drive a bottom turn on the rail", "Bottom turn 吃 rail 壓出去"),
            s("l3s.rail.link", "Switch rails between turns without a pause", "轉向之間換 rail 不停頓"),
          ]),
          k("l3s.top", "ride", "Snap and re-entry", "Snap 與 Re-entry", [
            s("l3s.top.vertical", "Bottom turn hard enough to aim at the lip", "Bottom turn 壓夠深，直直打向浪頂"),
            s("l3s.top.spray", "Throw spray off the top", "在浪頂甩出水花"),
          ]),
          k("l3s.round", "ride", "Roundhouse cutback", "Roundhouse cutback", [
            s("l3s.round.full", "Carve all the way back to the white", "一路畫回白浪那側"),
            s("l3s.round.rebound", "Rebound off the foam and keep going", "撞白浪彈回來繼續走"),
          ]),
          k("l3s.floater", "ride", "Floater", "Floater", [
            s("l3s.floater.ride", "Ride over a closing section", "從快蓋掉的浪頂上滑過去"),
            s("l3s.floater.land", "land it and keep riding", "落下來站穩，繼續滑"),
          ]),
        ],
      },
    ],
  },
];


/** Where a block can live: one per level, one per track on level 3. */
export type LevelKey = "0" | "1" | "2" | "3:long" | "3:short";
export type Slot = { key: LevelKey; level: Level; track?: Track };

export const SLOTS: Slot[] = LEVELS.flatMap((level) =>
  level.tracks
    ? level.tracks.map((track) => ({ key: `${level.n}:${track.id}` as LevelKey, level, track }))
    : [{ key: `${level.n}` as LevelKey, level }],
);
export const LEVEL_KEYS = SLOTS.map((s) => s.key);

export const isLevelKey = (v: unknown): v is LevelKey => typeof v === "string" && (LEVEL_KEYS as string[]).includes(v);

/** The slot for a level and (level 3 only) a track; null on level 3 before a track is picked. */
export function levelKeyOf(n: LevelN, track: TrackId | null): LevelKey | null {
  const level = LEVELS.find((l) => l.n === n);
  if (!level) return null;
  if (!level.tracks) return `${n}` as LevelKey;
  return track ? (`${n}:${track}` as LevelKey) : null;
}

export const slotOf = (key: LevelKey) => SLOTS.find((s) => s.key === key)!;
export const starterSkills = (slot: Slot): Skill[] => slot.track?.skills ?? slot.level.skills ?? [];

const SKILLS = new Map(SLOTS.flatMap((slot) => starterSkills(slot).map((sk) => [sk.id, sk] as const)));
const STEPS = new Map([...SKILLS.values()].flatMap((sk) => sk.steps.map((st) => [st.id, st] as const)));

export const starterSkill = (key: string | null | undefined) => (key ? SKILLS.get(key) : undefined);
export const starterStep = (key: string | null | undefined) => (key ? STEPS.get(key) : undefined);

/** "Level 1 · Beginner", "Level 3 · Longboard". */
export function slotLabel(slot: Slot, lang: Lang): string {
  const n = lang === "zh-TW" ? `第 ${slot.level.n} 級` : `Level ${slot.level.n}`;
  return `${n} · ${bi(slot.track?.name ?? slot.level.name, lang)}`;
}
