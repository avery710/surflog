import { SpotDetail } from "@/components/spot-detail";
import { TAIWAN_SPOTS_FIXTURE } from "@/lib/spot-fixtures";

/** Dev-only preview of a spot's page on synthetic data (the real page needs a signed-in session).
 *  Reviews load from the real API and fail here, which shows their error state. */
export default function SpotDetailPreview() {
  const spot = TAIWAN_SPOTS_FIXTURE.find((s) => s.slug === "jialeshui") ?? TAIWAN_SPOTS_FIXTURE[0];
  return (
    <SpotDetail
      spot={spot}
      history={[
        { id: "a", when: "2026-09-26T16:00", swellM: 1.3, periodS: 8.6, windMs: 5, notes: "今天浪很乾淨很美，跟 Sean 下超開心" },
        { id: "b", when: "2026-09-20T08:00", swellM: 0.9, periodS: 6.4, windMs: 7.5, notes: "" },
      ]}
      note="近滿潮最乾淨，退潮容易踢到石頭"
      pinned
      pendingEdit={null}
      canManage={false}
    />
  );
}
