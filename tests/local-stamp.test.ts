import { describe, expect, it } from "vitest";
import { fmtLocalStamp } from "@/lib/use-local-stamp";

// The suite runs with TZ=Asia/Taipei (see the test script's env below): a
// late-evening UTC instant is already the next day there.
describe("fmtLocalStamp", () => {
  it("shows the viewer's local date and time, not the UTC date", () => {
    process.env.TZ = "Asia/Taipei";
    expect(fmtLocalStamp("2026-10-07T07:34:12Z", "en")).toBe("7 Oct 2026, 15:34");
    expect(fmtLocalStamp("2026-10-07T18:05:00Z", "en")).toBe("8 Oct 2026, 02:05");
    expect(fmtLocalStamp("2026-10-07T07:34:12Z", "zh-TW")).toBe("2026年10月7日 15:34");
  });
  it("is empty for a bad value", () => {
    expect(fmtLocalStamp("nope", "en")).toBe("");
  });
});
