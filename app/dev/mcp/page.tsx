import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { registerSurflogTools } from "@/lib/mcp-tools";
import { MCP_REQUESTS, MCP_WRITES } from "@/lib/rate-limit";
import { MAX_ACTIVE_TOKENS, type TokenScope } from "@/lib/token-auth";

/**
 * /dev/mcp — what the MCP endpoint (/api/mcp) can and can't do.
 *
 * The tool list is not written by hand: the real `registerSurflogTools()`
 * runs against a stub server that only records what gets registered, once
 * per token scope. So names, descriptions and parameters here can't drift
 * from lib/mcp-tools.ts. No tool handler is ever called, so nothing touches
 * the database. The prose sections (limits, what's out of scope) ARE written
 * by hand — keep them in step with CLAUDE.md "MCP access".
 */
interface ToolDoc {
  name: string;
  title: string;
  description: string;
  params: { name: string; type: string; required: boolean; description: string }[];
  readOnly: boolean;
  destructive: boolean;
}

interface JsonProp {
  type?: string | string[];
  anyOf?: JsonProp[];
  description?: string;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  maxLength?: number;
}

function typeLabel(p: JsonProp): string {
  const base = p.anyOf ? p.anyOf.map(typeLabel).join(" | ") : [p.type ?? "any"].flat().join(" | ");
  const extra = [
    p.minimum !== undefined && p.maximum !== undefined ? `${p.minimum}–${p.maximum}` : null,
    p.maxLength !== undefined ? `≤ ${p.maxLength} chars` : null,
  ].filter(Boolean);
  return extra.length ? `${base} (${extra.join(", ")})` : base;
}

function collectTools(scope: TokenScope): ToolDoc[] {
  const tools: ToolDoc[] = [];
  const stub = {
    registerTool(
      name: string,
      config: {
        title?: string;
        description?: string;
        inputSchema: z.ZodType;
        annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean };
      }
    ) {
      const schema = z.toJSONSchema(config.inputSchema) as {
        properties?: Record<string, JsonProp>;
        required?: string[];
      };
      tools.push({
        name,
        title: config.title ?? name,
        description: config.description ?? "",
        params: Object.entries(schema.properties ?? {}).map(([key, p]) => ({
          name: key,
          type: typeLabel(p),
          required: schema.required?.includes(key) ?? false,
          description: p.description ?? (p.pattern ? `pattern ${p.pattern}` : ""),
        })),
        readOnly: config.annotations?.readOnlyHint === true,
        destructive: config.annotations?.destructiveHint === true,
      });
    },
  };
  registerSurflogTools(stub as unknown as McpServer, { ownerId: "dev-doc", scope, tokenId: "dev-doc" });
  return tools;
}

const NOT_AVAILABLE = [
  "Photos and video — no upload, download or removal (a session only reports `mediaCount`).",
  "Boards — read-only list. No adding, editing, deleting, reordering or go-to toggling.",
  "Spots — read-only catalogue. No adding spots, no spot requests, no per-spot notes.",
  "Rich text in notes — notes go in and come out as plain text; bullets and bold written in the app are flattened on read, and lost if the note is rewritten through MCP.",
  "Hand-entered conditions, raw condition blobs (secondary swell, wind waves, full tide curve, grid node) and “Refresh conditions”.",
  "Other people's data — every tool is bound to the token's owner; a foreign id answers “not found”.",
  "Token management — a token can't create, list or revoke tokens, or approve an app (browser sign-in only, at /agents and the consent page).",
];

const RULES = [
  "`when` is local time at the spot and must sit on the 2-hour grid: an even hour, `:00` (e.g. 2026-10-12T06:00).",
  "`spot` must be a catalogue slug from list_spots. Pending requests (`req:…`) and free text are refused.",
  "`boardId` must be one of the caller's own boards.",
  "Creating a session, or changing its spot or time, fetches swell / wind / temperature (Open-Meteo) and tide (CWA, Taiwan and forward dates only) for that moment.",
  "update_session replaces the whole note; delete_session also deletes the session's photos and videos and can't be undone.",
  "`goalsAchieved` on create_session / update_session ticks goal points on that session. Each must match a point of the current goal word for word (or, on update, one the session already has ticked); on update the list replaces the session's existing ticks.",
  "The goal is one short list of points, 200 characters in total. set_goal replaces the whole list; a point's achieved count follows its exact wording, so rewording without `renames` starts that point from zero.",
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-sans text-lg font-extrabold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[13.5px] text-foreground">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function Pill({ children, tone }: { children: React.ReactNode; tone: "read" | "write" | "danger" }) {
  const cls =
    tone === "read"
      ? "bg-secondary text-foreground"
      : tone === "write"
        ? "bg-primary text-primary-foreground"
        : "bg-destructive text-white";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${cls}`}>{children}</span>;
}

export default function McpDocPage() {
  const readTools = collectTools("read");
  const readNames = new Set(readTools.map((t) => t.name));
  const allTools = collectTools("write");

  return (
    <div className="mx-auto w-full max-w-[820px] px-4.5 py-8">
      <h1 className="font-sans text-2xl font-extrabold">MCP tools — scope</h1>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">
        What an MCP client (Claude Code, Claude Desktop, Cursor…) can do through{" "}
        <code>/api/mcp</code>. The tool list below is read from <code>lib/mcp-tools.ts</code> when
        this page renders.
      </p>

      <Section title="In one line">
        <p className="max-w-prose text-[13.5px]">
          One person&apos;s own session log and goal: read sessions, spots, boards and the current
          goal with any token; create, edit and delete sessions and set or remove the goal with a
          write token. Nothing else in the app is reachable.
        </p>
      </Section>

      <Section title="Access">
        <div className="overflow-x-auto rounded-[var(--r-tile)] border border-card-border bg-card">
          <table className="w-full min-w-[420px] text-left text-[13.5px]">
            <tbody>
              {[
                ["Endpoint", "POST /api/mcp — Streamable HTTP, stateless"],
                ["Auth", "Authorization: Bearer sfl_… obtained either way: OAuth sign-in (authorization code + PKCE, open client registration — add the URL as a connector, sign in, press Allow; 1-hour access token, refreshed automatically), or a personal token made at /agents for clients that can't sign in."],
                ["Scopes", `read → ${readTools.length} tools · write → ${allTools.length} tools`],
                ["Apps & tokens", `Listed at /agents, each revocable; only hashes are stored. A personal token is shown once; up to ${MAX_ACTIVE_TOKENS} active per person (app connections don't count)`],
                ["Request limit", `${MCP_REQUESTS.limit} requests per ${MCP_REQUESTS.windowMs / 1000} s per person (429 + Retry-After)`],
                ["Change limit", `${MCP_WRITES.limit} session or goal changes per ${MCP_WRITES.windowMs / 60_000} min per person`],
              ].map(([k, v]) => (
                <tr key={k} className="border-b border-card-border last:border-0">
                  <th className="w-32 px-3 py-2 align-top font-semibold text-muted-foreground">{k}</th>
                  <td className="px-3 py-2">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Limits are counted in memory per server instance, so they stop a runaway loop but are not
          an exact quota.
        </p>
      </Section>

      <Section title={`Tools (${allTools.length})`}>
        <ul className="flex flex-col gap-3">
          {allTools.map((tool) => (
            <li key={tool.name} className="rounded-[var(--r-card)] border border-card-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <code className="font-mono text-[14px] font-bold">{tool.name}</code>
                <span className="text-[13.5px] text-muted-foreground">{tool.title}</span>
                <Pill tone={readNames.has(tool.name) ? "read" : "write"}>
                  {readNames.has(tool.name) ? "read token" : "write token"}
                </Pill>
                {tool.destructive && <Pill tone="danger">overwrites or deletes</Pill>}
              </div>
              <p className="mt-2 text-[13.5px]">{tool.description}</p>
              {tool.params.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">No parameters.</p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[420px] text-left text-[12.5px]">
                    <thead className="text-muted-foreground">
                      <tr>
                        <th className="py-1 pr-3 font-semibold">Parameter</th>
                        <th className="py-1 pr-3 font-semibold">Type</th>
                        <th className="py-1 font-semibold">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tool.params.map((p) => (
                        <tr key={p.name} className="border-t border-card-border align-top">
                          <td className="py-1.5 pr-3 font-mono">
                            {p.name}
                            {p.required && <span className="text-destructive"> *</span>}
                          </td>
                          <td className="py-1.5 pr-3 font-mono text-muted-foreground">{p.type}</td>
                          <td className="py-1.5">{p.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          <span className="text-destructive">*</span> required. A read token doesn&apos;t get the
          write tools registered at all.
        </p>
      </Section>

      <Section title="What a session looks like to the client">
        <p className="max-w-prose text-[13.5px]">
          A compact shape, roughly what the session card shows — not the stored data: <code>id</code>,{" "}
          <code>spot</code>, <code>spotName</code>, <code>when</code>, <code>timezone</code>,{" "}
          <code>notes</code> (plain text), <code>board</code>, <code>conditions</code> (swell height /
          period / direction, wind speed / gust / direction, sea and air temperature),{" "}
          <code>tide</code> (rising or falling, next turning point, source), <code>goalsAchieved</code>{" "}
          (the goal points ticked on that session) and <code>mediaCount</code>. Metric units; directions are degrees the
          swell or wind comes from.
        </p>
      </Section>

      <Section title="Rules the tools enforce">
        <Bullets items={RULES} />
      </Section>

      <Section title="Not available over MCP">
        <Bullets items={NOT_AVAILABLE} />
      </Section>
    </div>
  );
}
