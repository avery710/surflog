import { describe, expect, it } from "vitest";
import { htmlToPlainText, plainTextToHtml, sanitizeNotesHtml } from "@/lib/rich-text";

describe("sanitizeNotesHtml", () => {
  // Regression, 2026-10-06: entities were escaped a second time, so a typed
  // "<" or "&" showed up as "&lt;" / "&amp;" in the note.
  it("leaves existing entities alone", () => {
    expect(sanitizeNotesHtml("a &lt; b &amp; c &nbsp;&#39;&#x27;")).toBe("a &lt; b &amp; c &nbsp;&#39;&#x27;");
  });

  it("escapes a bare & and <", () => {
    expect(sanitizeNotesHtml("<div>R&D 3 < 4</div>")).toBe("<div>R&amp;D 3 &lt; 4</div>");
  });

  it("is stable when run twice", () => {
    const once = sanitizeNotesHtml("<p>R&D &amp; <b>x</b> &lt;</p>");
    expect(sanitizeNotesHtml(once)).toBe(once);
  });

  it("drops disallowed tags and every attribute", () => {
    expect(sanitizeNotesHtml('<script>x</script><b onclick="evil()">k</b><strong>s</strong>')).toBe("x<b>k</b><b>s</b>");
  });

  it("keeps Chinese text untouched", () => {
    expect(sanitizeNotesHtml("<div>今天浪很好</div>")).toBe("<div>今天浪很好</div>");
  });
});

describe("plain text round trip (the MCP notes path)", () => {
  it("returns the text that went in", () => {
    const text = "R&D <b>not bold</b>\n第二行 3 < 4";
    expect(htmlToPlainText(sanitizeNotesHtml(plainTextToHtml(text)))).toBe(text);
  });
});
