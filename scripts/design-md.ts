/**
 * Writes DESIGN.md from the "Surflog" Design System artifact
 * (https://claude.ai/artifact/VTytmYDfXYTNzx7m9QZK68), which is the source of
 * truth for the look. DESIGN.md is generated: never edit it by hand.
 *
 * Re-sync: download the artifact's `project/` files (Artifact tool, action
 * "read" with `paths`: README.md, tokens.json, components/*\/README.md), then
 *   npx tsx scripts/design-md.ts <dir holding that project/ folder>
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2];
if (!root) {
  console.error("usage: npx tsx scripts/design-md.ts <dir with project/>");
  process.exit(1);
}
const project = existsSync(join(root, "project")) ? join(root, "project") : root;
const read = (p: string) => readFileSync(join(project, p), "utf8").trim();

interface Tok { name: string; value: unknown; usage?: string }
const tokens = JSON.parse(read("tokens.json"));
const cell = (s: unknown) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
const table = (rows: Tok[]) =>
  ["| Token | Value | Use |", "| --- | --- | --- |", ...rows.map((t) => `| \`${t.name}\` | \`${cell(t.value)}\` | ${cell(t.usage)} |`)].join("\n");

const out: string[] = [];
out.push(
  "# Surflog design system",
  "",
  `> Generated from the Surflog Design System artifact (https://claude.ai/artifact/VTytmYDfXYTNzx7m9QZK68), synced ${tokens.meta?.synced ?? "unknown"}. Do not edit by hand: change the artifact, then run \`npx tsx scripts/design-md.ts <dir>\` (see the header of that script).`,
  "",
  read("README.md").replace(/^## /gm, "## "),
  "",
  "## Tokens",
  "",
  "### Colour",
  "",
  table(tokens.color.tokens),
  ""
);
out.push("### Type", "", "Families:", "");
for (const [k, v] of Object.entries(tokens.type.families)) out.push(`- \`${k}\`: ${v}`);
for (const g of tokens.type.groups as { name: string; family: string; styles: Record<string, string | number>[] }[]) {
  out.push("", `**${g.name}** (\`${g.family}\`)`, "", "| Style | Size / line | Weight | Spacing | Use |", "| --- | --- | --- | --- | --- |");
  for (const s of g.styles)
    out.push(`| \`${s.name}\` | ${s.fontSize} / ${s.lineHeight} | ${s.fontWeight} | ${s.letterSpacing ?? ""} | ${cell(s.usage)} |`);
}
for (const [title, key] of [["Spacing", "spacing"], ["Radius", "radius"], ["Shadow", "shadow"]] as const)
  out.push("", `### ${title}`, "", table(tokens[key].tokens));

out.push("", "## Components");
const dir = join(project, "components");
if (existsSync(dir)) {
  for (const name of readdirSync(dir).sort()) {
    const f = join(dir, name, "README.md");
    if (existsSync(f)) out.push("", readFileSync(f, "utf8").trim().replace(/^# /, "### ").replace(/^#{2,} /gm, "#### "));
  }
}
const logos = join(project, "assets/Logos/README.md");
if (existsSync(logos)) out.push("", "## Logo assets", "", readFileSync(logos, "utf8").trim().replace(/^#+ .*\n+/, ""));

writeFileSync("DESIGN.md", out.join("\n") + "\n");
console.log("DESIGN.md written");
