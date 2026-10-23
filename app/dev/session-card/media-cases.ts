import { fakeBoard, fakeSession } from "@/app/dev/fixtures";
import { achievedGoalFields } from "@/lib/goal";
import type { Board, Session } from "@/lib/types";

/** Board (name, size, a sample photo through the real photoUrl path) and three
 *  achieved goals, shared by every card on the dev page. */
export const DEMO_BOARD: Board = fakeBoard({
  id: "dev-demo-board",
  brand: "Haydenshapes FutureFlex",
  lengthIn: 74,
  volumeL: 32,
  photoUrl: "/landing/haydenshapes-futureflex.jpg",
});
export const DEMO_FIELDS = {
  boardId: DEMO_BOARD.id,
  ...achievedGoalFields(["Get to my feet earlier", "Stay low through the bottom turn", "Paddle for more waves"]),
};
/** Fill in the board and goals unless the case already chose its own. */
export function withDemo(session: Session): Session {
  return session.boardId ? session : { ...session, ...DEMO_FIELDS };
}

// Media-count cases: photos load from /landing (public sample images, via
// EntryCard's `mediaBase`) because /api/blob would 401 for synthetic ids.
// The video cell points at a .jpg on purpose: it shows the black cell and
// play badge, which is what's being checked.
const SAMPLE_IMAGES = [
  "stitch-barrel.jpg",
  "haydenshapes-futureflex.jpg",
  "wavestorm-8ft-classic.jpg",
  "goofy-lightning-plank.jpg",
];
const media = (n: number, video = false) =>
  Array.from({ length: n }, (_, i) =>
    video && i === 1
      ? { id: "wavestorm-8ft-classic.jpg", type: "video/mp4" }
      : { id: SAMPLE_IMAGES[i % SAMPLE_IMAGES.length], type: "image/jpeg" }
  );
const noConditions = { condOpenMeteo: null, condCwaTide: null, cond: null };
export const MEDIA_CASES: { id: string; title: string; session: Session }[] = [
  { id: "m0", title: "0 media, conditions only", session: fakeSession({ photos: [], ...DEMO_FIELDS }) },
  { id: "m0x", title: "0 media, no board, no goals", session: fakeSession({ photos: [] }) },
  {
    id: "tags",
    title: "Tags: three starters and one of your own, under the notes",
    session: fakeSession({
      photos: [],
      notesHtml: "<p>Clean shape on the dropping tide, chest to shoulder high, light offshore.</p>",
      notes: "Clean shape on the dropping tide, chest to shoulder high, light offshore.",
      tags: ["Glassy", "Chest to shoulder", "Empty break", "With Ming"],
      ...DEMO_FIELDS,
    }),
  },
  { id: "m1", title: "1 media + conditions (side-by-side row from sm)", session: fakeSession({ photos: media(1), ...DEMO_FIELDS }) },
  { id: "m1v", title: "1 video + conditions (play badge)", session: fakeSession({ photos: [{ id: "wavestorm-8ft-classic.jpg", type: "video/mp4" }], ...DEMO_FIELDS }) },
  { id: "m1b", title: "1 media, board only (no goals)", session: fakeSession({ photos: media(1), boardId: DEMO_BOARD.id }) },
  { id: "m2", title: "2 media", session: fakeSession({ photos: media(2), ...DEMO_FIELDS }) },
  { id: "m3", title: "3 media", session: fakeSession({ photos: media(3), ...DEMO_FIELDS }) },
  { id: "m4", title: "4 media", session: fakeSession({ photos: media(4), ...DEMO_FIELDS }) },
  { id: "m5", title: "5 media (big cell + 2x2)", session: fakeSession({ photos: media(5), ...DEMO_FIELDS }) },
  { id: "m7", title: "7 media (+2 on the fifth cell, one video)", session: fakeSession({ photos: media(7, true), ...DEMO_FIELDS }) },
  { id: "m1n", title: "1 media, no conditions (media alone)", session: fakeSession({ photos: media(1), ...noConditions, ...DEMO_FIELDS }) },
  { id: "m3n", title: "3 media, no conditions", session: fakeSession({ photos: media(3), ...noConditions, ...DEMO_FIELDS }) },
  { id: "m6n", title: "6 media, no conditions", session: fakeSession({ photos: media(6), ...noConditions, ...DEMO_FIELDS }) },
];

