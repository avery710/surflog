"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  closestCorners,
  DndContext,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type KeyboardCoordinateGetter,
  type Modifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft,
  Blocks,
  Check,
  ChevronDown,
  Copy,
  CornerDownRight,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "cn";
import { AnimatedHeight } from "@/components/animated-height";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { goalPoints, joinGoalPoints, MAX_GOAL } from "@/lib/goal";
import {
  bi,
  GROUPS,
  LEVELS,
  levelKeyOf,
  SLOTS,
  slotLabel,
  slotOf,
  starterSkills,
  type LevelKey,
  type LevelN,
  type Slot,
  type TrackId,
} from "@/lib/goal-roadmap";
import { useLang } from "@/lib/i18n";
import { PAGE_COLUMN } from "@/lib/layout";
import {
  cleanText,
  goalPointFor,
  MAX_SKILL_NAME,
  MAX_STEP_TEXT,
  MAX_WORKING,
  reorderIds,
  shelfOf,
  skillDone,
  skillLabel,
  stepLabel,
  stepTicks,
  type RoadmapPayload,
  type RoadmapSkill,
  type RoadmapStep,
} from "@/lib/roadmap";
import type { SessionStat } from "@/lib/session-stats";

/**
 * /roadmap (SURFLOG-38): the user's own roadmap of levels → skills → steps.
 * See CLAUDE.md "Roadmap" and lib/roadmap.ts.
 *
 * Every block is the user's: their copy of the starter roadmap plus what
 * they add. Skills and steps reorder by drag and drop (one DndContext per
 * level, a SortableContext per shelf and per skill; a nested DndContext per
 * skill was tried in the prototype and skill drags never dropped). Default
 * blocks (from the starter) can't be renamed. Removing has an Undo toast
 * and no confirm (Avery, 2026-10-28).
 *
 * Reads: TanStack Query ["roadmap"], seeded from the server. Writes: plain
 * fetch; every roadmap route answers with the whole roadmap + goal, which
 * replaces the cached copy. "+ Next session" writes the goal through the
 * existing PUT /api/goal.
 */

type Stat = Pick<SessionStat, "goalText" | "goalMet" | "goalPointsMet">;
type T = ReturnType<typeof useLang>["t"];

const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 });

/** Arrow keys move among blocks of the same list only (the default would also
 *  step onto the steps inside the next skill and never reach that skill). */
const sameListKeys: KeyboardCoordinateGetter = (event, args) => {
  const list = args.context.active?.data.current?.list;
  const all = args.context.droppableContainers;
  const droppableContainers = new Proxy(all, {
    get(target, prop) {
      if (prop === "getEnabled") return () => target.getEnabled().filter((c) => c.data.current?.list === list);
      const v = Reflect.get(target, prop, target);
      return typeof v === "function" ? v.bind(target) : v;
    },
  });
  return sortableKeyboardCoordinates(event, { ...args, context: { ...args.context, droppableContainers } });
};

/** Only blocks of the same list are drop targets: a skill never lands among steps.
 *  Corners, not centres: an open skill is much taller than its neighbours, and
 *  centre distance kept dropping it back on itself. */
const sameList: CollisionDetection = (args) =>
  closestCorners({
    ...args,
    droppableContainers: args.droppableContainers.filter(
      (c) => c.data.current?.list === args.active.data.current?.list,
    ),
  });

export function Roadmap({
  initial,
  sessions,
  initialLevel,
  focus,
}: {
  /** null: the tables aren't there yet (migration pending). */
  initial: RoadmapPayload | null;
  sessions: Stat[];
  initialLevel?: number;
  /** A skill id or starter key to open and scroll to (?skill=). */
  focus?: string;
}) {
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["roadmap"],
    queryFn: async (): Promise<RoadmapPayload> => {
      const res = await fetch("/api/roadmap");
      if (!res.ok) throw new Error(`roadmap ${res.status}`);
      return res.json();
    },
    initialData: initial ?? undefined,
    enabled: initial != null,
    staleTime: Infinity,
  });
  const [viewLevel, setViewLevel] = useState<number>(
    LEVELS.some((l) => l.n === initialLevel)
      ? initialLevel!
      : (initial?.profile?.level ?? 0),
  );
  const [levelUpOpen, setLevelUpOpen] = useState(false);

  async function send(
    url: string,
    method: string,
    body?: unknown,
  ): Promise<RoadmapPayload | null> {
    try {
      const res = await fetch(url, {
        method,
        headers:
          body === undefined
            ? undefined
            : { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) {
        toast.error(json?.error ?? t("roadmap.failed"));
        return null;
      }
      qc.setQueryData(["roadmap"], json);
      return json as RoadmapPayload;
    } catch {
      toast.error(t("roadmap.failed"));
      return null;
    }
  }

  const header = (
    <>
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t("admin.back")}
      </Link>
      <h1 className="mt-3 text-2xl font-bold">{t("roadmap.title")}</h1>
    </>
  );

  if (!data) {
    return (
      <div className={`${PAGE_COLUMN} page-enter min-w-0 flex-1 pb-18 pt-6`}>
        {header}
        <p className="mt-3 text-[13.5px] text-muted-foreground">
          {t("roadmap.notOn")}
        </p>
      </div>
    );
  }

  const profile = data.profile;
  const setLevel = async (level: number, track: TrackId | null) => {
    const res = await send("/api/roadmap/profile", "PUT", { level, track });
    if (res) setViewLevel(level);
    return res;
  };

  return (
    <div className={`${PAGE_COLUMN} page-enter min-w-0 flex-1 pb-18 pt-6`}>
      {header}
      {!profile ? (
        <LevelPicker
          t={t}
          lang={lang}
          onPick={async (n) => {
            if (await setLevel(n, null))
              toast(t("roadmap.welcome", { n, max: MAX_WORKING }));
          }}
        />
      ) : (
        <LevelView
          key={viewLevel}
          data={data}
          sessions={sessions}
          viewLevel={viewLevel}
          setViewLevel={setViewLevel}
          focus={focus}
          send={send}
          setLevel={setLevel}
          onLevelUp={() => setLevelUpOpen(true)}
        />
      )}

      {profile && (
        <LevelUpDialog
          open={levelUpOpen}
          onOpenChange={setLevelUpOpen}
          level={profile.level}
          track={profile.track}
          onConfirm={async () => {
            setLevelUpOpen(false);
            if (profile.level >= 3) return void toast(t("roadmap.topDone"));
            const next = profile.level + 1;
            if (await setLevel(next, null))
              toast(t("roadmap.welcome", { n: next, max: MAX_WORKING }));
          }}
        />
      )}
    </div>
  );
}

type Send = (
  url: string,
  method: string,
  body?: unknown,
) => Promise<RoadmapPayload | null>;

function LevelPicker({
  t,
  lang,
  onPick,
}: {
  t: T;
  lang: "en" | "zh-TW";
  onPick: (n: number) => void;
}) {
  return (
    <section className="mt-4">
      <h2 className="text-[17px] font-bold">{t("roadmap.pickTitle")}</h2>
      <p className="mt-0.5 text-[13px] text-muted-foreground">
        {t("roadmap.pickHint")}
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {LEVELS.map((l) => (
          <button
            key={l.n}
            type="button"
            onClick={() => onPick(l.n)}
            className="flex flex-col items-start rounded-[var(--r-card)] surface-card p-3.5 text-left hover:ring-2 hover:ring-primary/30"
          >
            <span className="flex size-6 items-center justify-center rounded-full bg-secondary text-[12px] font-bold">
              {l.n}
            </span>
            <span className="mt-2 text-[15px] font-bold">
              {bi(l.name, lang)}
            </span>
            <span className="mt-0.5 text-[13px] text-muted-foreground">
              {bi(l.youAre, lang)}
            </span>
            <span className="mt-1.5 text-[11.5px] text-[var(--faint)]">
              {bi(l.guide, lang)}
            </span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-[12.5px] text-[var(--faint)]">
        {t("roadmap.pickNotSure")}
      </p>
    </section>
  );
}

function LevelView({
  data,
  sessions,
  viewLevel,
  setViewLevel,
  focus,
  send,
  setLevel,
  onLevelUp,
}: {
  data: RoadmapPayload;
  sessions: Stat[];
  viewLevel: number;
  setViewLevel: (n: number) => void;
  focus?: string;
  send: Send;
  setLevel: (
    level: number,
    track: TrackId | null,
  ) => Promise<RoadmapPayload | null>;
  onLevelUp: () => void;
}) {
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const dndId = useId();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const profile = data.profile!;
  const level = LEVELS.find((l) => l.n === viewLevel)!;
  const isCurrent = viewLevel === profile.level;
  const passed = viewLevel < profile.level;
  const track: TrackId | null = level.tracks
    ? isCurrent
      ? profile.track
      : (profile.track ?? "long")
    : null;
  const key = levelKeyOf(viewLevel as LevelN, track);
  const slot = key ? slotOf(key) : null;
  const skills = data.skills.filter((s) => s.levelKey === key);
  const allDone = skills.length > 0 && skills.every(skillDone);
  const working = data.skills.filter((s) => s.working).length;
  const test = slot ? (slot.track?.test ?? slot.level.test) : undefined;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sameListKeys,
    }),
  );

  /** Puts the reordered list in the cache at once (no snap back), then saves it. */
  // While a skill is dragged every skill shows collapsed: blocks of very
  // different heights (an open skill is several times a closed one) made
  // the drop land back on the dragged skill itself.
  const [skillDrag, setSkillDrag] = useState(false);

  function onDragEnd({ active, over }: DragEndEvent) {
    const a = active.data.current as { list: string; id: string } | undefined;
    const o = over?.data.current as { list: string; id: string } | undefined;
    if (!a || !o || a.list !== o.list || a.id === o.id) return;
    const prev = qc.getQueryData<RoadmapPayload>(["roadmap"]);
    if (!prev) return;
    if (a.list.startsWith("steps:")) {
      const skillId = a.list.slice("steps:".length);
      const sk = prev.skills.find((s) => s.id === skillId);
      if (!sk) return;
      const ids = reorderIds(
        sk.steps.map((s) => s.id),
        a.id,
        o.id,
      );
      const byId = new Map(sk.steps.map((s) => [s.id, s]));
      qc.setQueryData<RoadmapPayload>(["roadmap"], {
        ...prev,
        skills: prev.skills.map((s) =>
          s.id === skillId
            ? { ...s, steps: ids.map((id) => byId.get(id)!) }
            : s,
        ),
      });
      void send("/api/roadmap/order", "PUT", { skillId, steps: ids }).then(
        (r) => {
          if (!r) qc.setQueryData(["roadmap"], prev);
        },
      );
    } else {
      const at = prev.skills.flatMap((s, i) =>
        shelfOf(s) === a.list ? [i] : [],
      );
      const ids = reorderIds(
        at.map((i) => prev.skills[i].id),
        a.id,
        o.id,
      );
      const byId = new Map(prev.skills.map((s) => [s.id, s]));
      const next = [...prev.skills];
      at.forEach((i, k) => {
        next[i] = byId.get(ids[k])!;
      });
      qc.setQueryData<RoadmapPayload>(["roadmap"], { ...prev, skills: next });
      void send("/api/roadmap/order", "PUT", { skills: ids }).then((r) => {
        if (!r) qc.setQueryData(["roadmap"], prev);
      });
    }
  }

  const shelves = [
    ...GROUPS.map((g) => ({ id: g.id as string, name: bi(g.name, lang) })),
    { id: "yours", name: t("roadmap.yours") },
  ];

  return (
    <div className="mt-4 sm:grid sm:grid-cols-[170px_minmax(0,1fr)] sm:gap-4">
      <nav className="flex gap-1 sm:flex-col" aria-label={t("roadmap.title")}>
        {LEVELS.map((l) => {
          const cur = l.n === profile.level;
          const past = l.n < profile.level;
          return (
            <button
              key={l.n}
              type="button"
              onClick={() => setViewLevel(l.n)}
              aria-current={l.n === viewLevel ? "page" : undefined}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-[var(--r-tile)] px-1 py-2 sm:flex-none sm:flex-row sm:gap-2 sm:px-2.5",
                l.n === viewLevel ? "surface-card" : "hover:bg-secondary",
              )}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold",
                  past && "bg-primary text-primary-foreground",
                  cur && "text-primary ring-2 ring-primary",
                  !past && !cur && "bg-secondary text-muted-foreground",
                )}
              >
                {past ? (
                  <Check className="size-3.5" strokeWidth={3} aria-hidden />
                ) : (
                  l.n
                )}
              </span>
              <span
                className={cn(
                  "truncate text-[11.5px] sm:text-[13px]",
                  cur ? "font-bold" : "font-medium",
                )}
              >
                {bi(l.name, lang)}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="mt-3 min-w-0 sm:mt-0">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <h2 className="text-[17px] font-bold">
            {t("roadmap.levelN", { n: level.n })} · {bi(level.name, lang)}
          </h2>
          {isCurrent && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
              {t("roadmap.youreHere")}
            </span>
          )}
          {passed && (
            <span className="text-[12px] font-semibold text-muted-foreground">
              {t("roadmap.passed")}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          {bi(level.youAre, lang)}
        </p>
        <p className="mt-0.5 text-[12px] text-[var(--faint)]">
          {bi(level.guide, lang)}
        </p>
        {!isCurrent && (
          <button
            type="button"
            onClick={() =>
              void setLevel(
                level.n,
                level.tracks ? (profile.track ?? null) : null,
              )
            }
            className="mt-2 rounded-full bg-secondary px-3 py-1 text-[12.5px] font-semibold"
          >
            {t("roadmap.moveHere")}
          </button>
        )}

        {level.tracks && (
          <div className="mt-3">
            <div className="grid grid-cols-2 gap-1.5">
              {level.tracks.map((tr) => (
                <button
                  key={tr.id}
                  type="button"
                  disabled={!isCurrent}
                  onClick={() => void setLevel(level.n, tr.id)}
                  aria-pressed={track === tr.id}
                  className={cn(
                    "rounded-[var(--r-tile)] px-3 py-2 text-left",
                    track === tr.id
                      ? "bg-primary text-primary-foreground"
                      : "surface-card",
                    !isCurrent && "cursor-default",
                  )}
                >
                  <span className="block text-[13.5px] font-bold">
                    {bi(tr.name, lang)}
                  </span>
                  <span
                    className={cn(
                      "block text-[12px]",
                      track === tr.id ? "opacity-80" : "text-muted-foreground",
                    )}
                  >
                    {bi(tr.blurb, lang)}
                  </span>
                </button>
              ))}
            </div>
            {level.note && (
              <p className="mt-2 text-[12.5px] text-muted-foreground">
                {bi(level.note, lang)}
              </p>
            )}
            {isCurrent && !profile.track && (
              <p className="mt-2 text-[13px] font-semibold text-primary">
                {t("roadmap.pickTrack")}
              </p>
            )}
          </div>
        )}

        {isCurrent && skills.length > 0 && (
          <p className="mt-3 text-[12px] font-semibold text-muted-foreground">
            {t("roadmap.workingCount", { n: working, max: MAX_WORKING })}
          </p>
        )}

        {key && (
          <DndContext
            id={dndId}
            sensors={sensors}
            collisionDetection={sameList}
            modifiers={[verticalOnly]}
            measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
            onDragStart={({ active }) => setSkillDrag(!String(active.id).startsWith("step:"))}
            onDragCancel={() => setSkillDrag(false)}
            onDragEnd={(e) => {
              setSkillDrag(false);
              onDragEnd(e);
            }}
          >
            {shelves.map((g) => {
              const list = `${key}|${g.id}`;
              const inShelf = skills.filter((s) => shelfOf(s) === list);
              if (!inShelf.length) return null;
              return (
                <div key={g.id} className="mt-3">
                  <h3 className="text-[11px] font-semibold text-muted-foreground">
                    {g.name}
                  </h3>
                  <SortableContext
                    items={inShelf.map((s) => `skill:${s.id}`)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="mt-1 flex flex-col gap-2">
                      {inShelf.map((sk) => (
                        <SkillBlock
                          key={sk.id}
                          sk={sk}
                          list={list}
                          data={data}
                          sessions={sessions}
                          editable={isCurrent}
                          focused={focus === sk.id || focus === sk.templateKey}
                          collapsed={skillDrag}
                          send={send}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </div>
              );
            })}
          </DndContext>
        )}

        {key && slot && (
          <div className="mt-3 rounded-[var(--r-card)] border border-dashed border-border px-3 py-2.5">
            <AddInline
              placeholder={t("roadmap.addSkill")}
              label={t("roadmap.addSkillButton")}
              max={MAX_SKILL_NAME}
              onAdd={(name) =>
                send("/api/roadmap/skills", "POST", { levelKey: key, name })
              }
            />
            <button
              type="button"
              onClick={() => setLibraryOpen(true)}
              className="mt-2 flex items-center gap-1.5 text-[12.5px] font-semibold text-primary hover:opacity-80"
            >
              <Blocks className="size-3.5" aria-hidden />
              {t("roadmap.library")}
            </button>
            <LibraryDialog
              open={libraryOpen}
              onOpenChange={setLibraryOpen}
              slot={slot}
              skills={data.skills}
              onAdd={(templateKey) =>
                send("/api/roadmap/skills", "POST", {
                  levelKey: key,
                  templateKey,
                })
              }
              onReset={async () => {
                if (await send("/api/roadmap/reset", "POST", { levelKey: key }))
                  setLibraryOpen(false);
              }}
            />
          </div>
        )}

        {test && (
          <div className="mt-3 rounded-[var(--r-tile)] bg-secondary px-4 py-3">
            <p className="text-[11px] font-semibold text-muted-foreground">
              {t("roadmap.testLabel")}
            </p>
            <p className="mt-0.5 text-[14px] font-semibold">{bi(test, lang)}</p>
            {isCurrent && (
              <>
                {allDone && (
                  <p className="mt-1.5 text-[12.5px] text-primary">
                    {t("roadmap.allDone")}
                  </p>
                )}
                <button
                  type="button"
                  onClick={onLevelUp}
                  className={cn(
                    "mt-2 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold",
                    allDone
                      ? "bg-primary text-primary-foreground"
                      : "surface-card",
                  )}
                >
                  {t("roadmap.canDo")}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** A sortable block or row; hands its grip handle to `children` to place. */
function SortRow({
  list,
  id,
  label,
  as = "div",
  domId,
  className,
  children,
}: {
  list: string;
  id: string;
  label: string;
  as?: "div" | "li";
  domId?: string;
  className?: string;
  children: (handle: ReactNode) => ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `${list.startsWith("steps:") ? "step" : "skill"}:${id}`,
    data: { list, id },
  });
  const Tag = as as "div";
  return (
    <Tag
      ref={setNodeRef}
      id={domId}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(className, isDragging && "relative z-10 opacity-80")}
    >
      {children(
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={label}
          className={cn(
            "shrink-0 touch-none rounded-full p-1 text-[var(--faint)] hover:bg-secondary hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring/30 focus-visible:outline-none",
            isDragging ? "cursor-grabbing" : "cursor-grab",
          )}
        >
          <GripVertical className="size-3.5" aria-hidden />
        </button>,
      )}
    </Tag>
  );
}

function SkillBlock({
  sk,
  list,
  data,
  sessions,
  editable,
  focused,
  collapsed,
  send,
}: {
  sk: RoadmapSkill;
  list: string;
  data: RoadmapPayload;
  sessions: Stat[];
  editable: boolean;
  focused: boolean;
  collapsed: boolean;
  send: Send;
}) {
  const { t, lang } = useLang();
  const name = skillLabel(sk, lang);
  const [open, setOpen] = useState(sk.working || !sk.templateKey || focused);
  const [renaming, setRenaming] = useState(false);
  const done = skillDone(sk);
  const doneCount = sk.steps.filter((s) => s.doneAt).length;

  useEffect(() => {
    if (focused)
      document
        .getElementById(`skill-${sk.id}`)
        ?.scrollIntoView({ block: "center" });
  }, [focused, sk.id]);

  async function remove() {
    const snapshot = sk;
    if (!(await send(`/api/roadmap/skills/${sk.id}`, "DELETE"))) return;
    toast(t("roadmap.removed", { name }), {
      action: {
        label: t("roadmap.undo"),
        onClick: () =>
          void send("/api/roadmap/skills", "POST", { restore: snapshot }),
      },
    });
  }

  return (
    <SortRow
      list={list}
      id={sk.id}
      label={t("roadmap.drag", { name })}
      domId={`skill-${sk.id}`}
      className="rounded-[var(--r-card)] surface-card"
    >
      {(handle) => (
        <AnimatedHeight>
          <div className="flex items-center gap-2 py-2.5 pr-2 pl-1.5">
            {handle}
            {renaming ? (
              <RenameInline
                initial={name}
                max={MAX_SKILL_NAME}
                onSave={(v) =>
                  send(`/api/roadmap/skills/${sk.id}`, "PATCH", { name: v })
                }
                onDone={() => setRenaming(false)}
              />
            ) : (
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
              >
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform",
                    !open && "-rotate-90",
                  )}
                  aria-hidden
                />
                <span className="min-w-0 truncate text-[14.5px] font-bold">
                  {name}
                </span>
                {done ? (
                  <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-2.5" strokeWidth={3.5} aria-hidden />
                  </span>
                ) : (
                  <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
                    {doneCount}/{sk.steps.length}
                  </span>
                )}
              </button>
            )}
            {!renaming && editable && !done && (
              <button
                type="button"
                onClick={() =>
                  void send(`/api/roadmap/skills/${sk.id}`, "PATCH", {
                    working: !sk.working,
                  })
                }
                aria-pressed={sk.working}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1 text-[12px] font-semibold",
                  sk.working
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-foreground",
                )}
              >
                {sk.working ? t("roadmap.working") : t("roadmap.workOn")}
              </button>
            )}
            {!renaming && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={t("roadmap.skillActions")}
                    className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    <MoreHorizontal className="size-4" aria-hidden />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  onCloseAutoFocus={(e) => e.preventDefault()}
                >
                  {!sk.templateKey && (
                    <DropdownMenuItem onSelect={() => setRenaming(true)}>
                      <Pencil />
                      {t("roadmap.rename")}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <CornerDownRight />
                      {t("roadmap.moveToLevel")}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {SLOTS.filter((s) => s.key !== sk.levelKey).map((s) => (
                        <DropdownMenuItem
                          key={s.key}
                          onSelect={async () => {
                            if (
                              await send(
                                `/api/roadmap/skills/${sk.id}`,
                                "PATCH",
                                { levelKey: s.key },
                              )
                            )
                              toast(
                                t("roadmap.movedTo", {
                                  where: slotLabel(s, lang),
                                }),
                              );
                          }}
                        >
                          {slotLabel(s, lang)}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => void remove()}
                  >
                    <Trash2 />
                    {t("roadmap.removeSkill")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {open && !collapsed && (
            <div className="border-t border-border px-3 py-1.5">
              <SortableContext
                items={sk.steps.map((s) => `step:${s.id}`)}
                strategy={verticalListSortingStrategy}
              >
                <ul>
                  {sk.steps.map((st) => (
                    <StepRow
                      key={st.id}
                      st={st}
                      sk={sk}
                      data={data}
                      sessions={sessions}
                      editable={editable}
                      send={send}
                    />
                  ))}
                </ul>
              </SortableContext>
              <AddInline
                placeholder={t("roadmap.addStep")}
                label={t("roadmap.addStepButton")}
                max={MAX_STEP_TEXT}
                onAdd={(text) =>
                  send(`/api/roadmap/skills/${sk.id}/steps`, "POST", { text })
                }
              />
            </div>
          )}
        </AnimatedHeight>
      )}
    </SortRow>
  );
}

function StepRow({
  st,
  sk,
  data,
  sessions,
  editable,
  send,
}: {
  st: RoadmapStep;
  sk: RoadmapSkill;
  data: RoadmapPayload;
  sessions: Stat[];
  editable: boolean;
  send: Send;
}) {
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const text = stepLabel(st, lang);
  const [renaming, setRenaming] = useState(false);
  const done = st.doneAt != null;
  const n = stepTicks(st, sessions);
  const listed = goalPointFor(st, data.goal) != null;

  async function addToNext() {
    const next = joinGoalPoints([...goalPoints(data.goal), text]);
    if (next.length > MAX_GOAL)
      return void toast(t("roadmap.goalFull", { max: MAX_GOAL }));
    const res = await fetch("/api/goal", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: next }),
    }).catch(() => null);
    const json = await res?.json().catch(() => null);
    if (!res?.ok) return void toast.error(json?.error ?? t("roadmap.failed"));
    qc.setQueryData<RoadmapPayload>(["roadmap"], (prev) =>
      prev ? { ...prev, goal: json?.text ?? next } : prev,
    );
  }

  async function remove() {
    const snapshot = st;
    if (!(await send(`/api/roadmap/steps/${st.id}`, "DELETE"))) return;
    toast(t("roadmap.removed", { name: text }), {
      action: {
        label: t("roadmap.undo"),
        onClick: () =>
          void send(`/api/roadmap/skills/${sk.id}/steps`, "POST", {
            restore: snapshot,
          }),
      },
    });
  }

  if (renaming)
    return (
      <li className="py-1">
        <RenameInline
          initial={text}
          max={MAX_STEP_TEXT}
          onSave={(v) =>
            send(`/api/roadmap/steps/${st.id}`, "PATCH", { text: v })
          }
          onDone={() => setRenaming(false)}
        />
      </li>
    );

  const targets = SLOTS.map((s) => ({
    slot: s,
    skills: data.skills.filter((x) => x.levelKey === s.key && x.id !== sk.id),
  })).filter((x) => x.skills.length);
  const pick = (verb: "move" | "copy") =>
    targets.map(({ slot, skills }) => (
      <DropdownMenuSub key={`${verb}-${slot.key}`}>
        <DropdownMenuSubTrigger>{slotLabel(slot, lang)}</DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          {skills.map((target) => (
            <DropdownMenuItem
              key={target.id}
              onSelect={async () => {
                const where = skillLabel(target, lang);
                const ok =
                  verb === "move"
                    ? await send(`/api/roadmap/steps/${st.id}`, "PATCH", {
                        skillId: target.id,
                      })
                    : await send(
                        `/api/roadmap/skills/${target.id}/steps`,
                        "POST",
                        { fromStepId: st.id },
                      );
                if (ok)
                  toast(
                    t(
                      verb === "move" ? "roadmap.movedTo" : "roadmap.copiedTo",
                      { where },
                    ),
                  );
              }}
            >
              {verb === "move" ? <CornerDownRight /> : <Copy />}
              {skillLabel(target, lang)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    ));

  return (
    <SortRow
      list={`steps:${sk.id}`}
      id={st.id}
      as="li"
      label={t("roadmap.drag", { name: text })}
      className="flex flex-wrap items-center gap-x-2 gap-y-1 py-1.5"
    >
      {(handle) => (
        <>
          {handle}
          <button
            type="button"
            disabled={!editable}
            onClick={() =>
              void send(`/api/roadmap/steps/${st.id}`, "PATCH", { done: !done })
            }
            aria-label={
              done ? t("roadmap.markNotLearned") : t("roadmap.markLearned")
            }
            aria-pressed={done}
            className={cn(
              "flex size-[18px] shrink-0 items-center justify-center rounded-full border-2",
              done
                ? "border-primary bg-primary text-primary-foreground"
                : "border-[var(--faint)]",
            )}
          >
            {done && <Check className="size-3" strokeWidth={3.5} aria-hidden />}
          </button>
          <span
            className={cn(
              "min-w-0 flex-1 text-[13.5px]",
              done && "text-muted-foreground line-through",
            )}
          >
            {text}
            {!done && n > 0 && (
              <span className="ml-1.5 text-[12px] text-[var(--faint)]">
                {t(n === 1 ? "roadmap.ticked1" : "roadmap.tickedN", { n })}
              </span>
            )}
          </span>
          {editable && !done && (
            <button
              type="button"
              disabled={listed}
              onClick={() => void addToNext()}
              className={cn(
                "shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-semibold",
                listed
                  ? "text-muted-foreground"
                  : "text-primary hover:bg-secondary",
              )}
            >
              {listed ? t("roadmap.onNext") : t("roadmap.addNext")}
            </button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={t("roadmap.stepActions")}
                className="shrink-0 rounded-full p-1 text-[var(--faint)] hover:bg-secondary hover:text-foreground"
              >
                <MoreHorizontal className="size-3.5" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-[260px]"
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              {!st.templateKey && (
                <>
                  <DropdownMenuItem onSelect={() => setRenaming(true)}>
                    <Pencil />
                    {t("roadmap.rename")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {targets.length > 0 && (
                <>
                  <DropdownMenuLabel>
                    {t("roadmap.moveToSkill")}
                  </DropdownMenuLabel>
                  {pick("move")}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>
                    {t("roadmap.copyToSkill")}
                  </DropdownMenuLabel>
                  {pick("copy")}
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => void remove()}
              >
                <Trash2 />
                {t("roadmap.removeStep")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </SortRow>
  );
}

/** A one-line "add" field. Adds with the + button only: Enter clashes with 注音/倉頡 candidate selection. */
function AddInline({
  placeholder,
  label,
  max,
  onAdd,
}: {
  placeholder: string;
  label: string;
  max: number;
  onAdd: (text: string) => Promise<unknown>;
}) {
  const [v, setV] = useState("");
  const [busy, setBusy] = useState(false);
  const clean = cleanText(v, max);
  return (
    <div className="mt-1 flex items-center gap-1.5">
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        maxLength={max}
        className="h-8 min-w-0 flex-1 rounded-[var(--radius)] border border-input bg-background px-2.5 text-[13px] outline-none focus:border-primary"
      />
      <button
        type="button"
        aria-label={label}
        disabled={!clean || busy}
        onClick={async () => {
          if (!clean) return;
          setBusy(true);
          const ok = await onAdd(clean);
          setBusy(false);
          if (ok) setV("");
        }}
        className="shrink-0 rounded-full p-1.5 text-primary hover:bg-secondary disabled:opacity-40"
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}

/** Inline rename: ✓ saves (no Enter, for 注音/倉頡), Esc cancels. */
function RenameInline({
  initial,
  max,
  onSave,
  onDone,
}: {
  initial: string;
  max: number;
  onSave: (v: string) => Promise<unknown>;
  onDone: () => void;
}) {
  const { t } = useLang();
  const [v, setV] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const clean = cleanText(v, max);
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1">
      <input
        ref={ref}
        value={v}
        maxLength={max}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onDone();
        }}
        aria-label={t("roadmap.newName")}
        className="h-8 min-w-0 flex-1 rounded-[var(--radius)] border border-primary bg-background px-2.5 text-[13.5px] outline-none"
      />
      <button
        type="button"
        aria-label={t("roadmap.saveName")}
        disabled={!clean}
        onClick={async () => {
          if (clean && clean !== initial) await onSave(clean);
          onDone();
        }}
        className="shrink-0 rounded-full bg-primary p-1.5 text-primary-foreground disabled:opacity-40"
      >
        <Check className="size-3.5" strokeWidth={3} aria-hidden />
      </button>
      <button
        type="button"
        aria-label={t("roadmap.cancel")}
        onClick={onDone}
        className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-secondary"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

function LibraryDialog({
  open,
  onOpenChange,
  slot,
  skills,
  onAdd,
  onReset,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  slot: Slot;
  skills: RoadmapSkill[];
  onAdd: (templateKey: string) => Promise<unknown>;
  onReset: () => Promise<void>;
}) {
  const { t, lang } = useLang();
  const [confirmReset, setConfirmReset] = useState(false);
  const here = (id: string) =>
    skills.some((x) => x.levelKey === slot.key && x.templateKey === id);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setConfirmReset(false);
      }}
    >
      <DialogContent className="max-h-[85dvh] grid-cols-[minmax(0,1fr)] overflow-y-auto sm:max-w-[520px]">
        <DialogTitle>{t("roadmap.libraryTitle")}</DialogTitle>
        <DialogDescription>
          {t("roadmap.libraryHint", { slot: slotLabel(slot, lang) })}
        </DialogDescription>
        {SLOTS.map((s) => (
          <div key={s.key}>
            <h3 className="text-[12px] font-semibold text-muted-foreground">
              {slotLabel(s, lang)}
            </h3>
            <ul className="mt-1 flex flex-col gap-1.5">
              {starterSkills(s).map((sk) => (
                <li
                  key={sk.id}
                  className="flex items-start gap-2 rounded-[var(--r-tile)] bg-secondary px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-bold">
                      {bi(sk.name, lang)}
                    </p>
                    <p className="text-[12px] text-muted-foreground">
                      {sk.steps.map((x) => bi(x.text, lang)).join(" · ")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void onAdd(sk.id)}
                    className="shrink-0 rounded-full surface-card px-2.5 py-1 text-[12px] font-semibold text-primary"
                  >
                    {here(sk.id)
                      ? t("roadmap.libraryAddAgain")
                      : t("roadmap.libraryAdd")}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            confirmReset ? void onReset() : setConfirmReset(true)
          }
          className={cn(
            "justify-self-start text-[12.5px] font-semibold underline underline-offset-2",
            confirmReset ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {confirmReset
            ? t("roadmap.resetConfirm")
            : t("roadmap.reset", { slot: slotLabel(slot, lang) })}
        </button>
      </DialogContent>
    </Dialog>
  );
}

function LevelUpDialog({
  open,
  onOpenChange,
  level,
  track,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  level: LevelN;
  track: TrackId | null;
  onConfirm: () => void;
}) {
  const { t, lang } = useLang();
  const key = levelKeyOf(level, track);
  const slot = key ? slotOf(key as LevelKey) : null;
  const test = slot ? (slot.track?.test ?? slot.level.test) : undefined;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid-cols-[minmax(0,1fr)] sm:max-w-[420px]">
        <DialogTitle>{t("roadmap.testTitle", { n: level })}</DialogTitle>
        <DialogDescription className="text-[14px] text-foreground">
          {test ? bi(test, lang) : ""}
        </DialogDescription>
        <p className="text-[13px] text-muted-foreground">
          {t("roadmap.testAsk")}
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-full bg-secondary px-4 py-2 text-[13px] font-semibold"
          >
            {t("roadmap.notYet")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground"
          >
            {level < 3 ? t("roadmap.goUp", { n: level + 1 }) : t("roadmap.yes")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
