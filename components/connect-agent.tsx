"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy, KeyRound, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLang, type TKey } from "@/lib/i18n";
import type { ApiToken, TokenScope } from "@/lib/token-auth";

/**
 * "Connect an agent" on /agents: pick the agent, get only that agent's steps
 * with the server URL / command / config already filled in, and watch it land.
 *
 * The user never chooses between OAuth and a token — the agent decides:
 * `oauth` agents sign in through /oauth/authorize (no secret to handle),
 * `token` agents get a personal token made here and dropped into the snippet.
 * Menu names inside other vendors' apps are written from their public docs and
 * drift; keep the steps short so there is less to go stale.
 */
export type AgentId = "claude" | "chatgpt" | "gemini" | "claude-code" | "cursor" | "other";

const AGENTS: { id: AgentId; label: string; auth: "oauth" | "token" | "either" }[] = [
  { id: "claude", label: "Claude", auth: "oauth" },
  { id: "chatgpt", label: "ChatGPT", auth: "oauth" },
  { id: "gemini", label: "Gemini", auth: "oauth" },
  { id: "claude-code", label: "Claude Code", auth: "oauth" },
  { id: "cursor", label: "Cursor", auth: "token" },
  { id: "other", label: "", auth: "either" },
];

const TOKEN_PLACEHOLDER = "sfl_…";

/** "Cursor", then "Cursor 2", "Cursor 3"… — two live connections never share
 *  a name, or revoking the right one becomes a guess. A revoked one frees its
 *  name. */
export function uniqueName(base: string, tokens: readonly ApiToken[]): string {
  const taken = new Set(tokens.filter((tk) => !tk.revokedAt).map((tk) => tk.name));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base} ${n}`)) return `${base} ${n}`;
}

/** Does this live connection belong to that tile? By where the app's sign-in
 *  returns to when that is distinctive (claude.ai, chatgpt.com, Google's
 *  relay), else by the name it registered with. "other" never matches: we
 *  can't know what it is. */
export function connectionMatches(agent: AgentId, tk: ApiToken): boolean {
  if (tk.revokedAt) return false;
  const host = (tk.host ?? "").toLowerCase();
  const name = tk.name.toLowerCase();
  switch (agent) {
    case "claude":
      return tk.kind === "app" && host.includes("claude.ai");
    case "chatgpt":
      return tk.kind === "app" && (host.includes("chatgpt.com") || host.includes("openai.com"));
    case "gemini":
      return tk.kind === "app" && (host.includes("googleusercontent.com") || name.includes("gemini"));
    case "claude-code":
      return tk.kind === "app" && name.startsWith("claude code");
    case "cursor":
      return name.includes("cursor");
    default:
      return false;
  }
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-px flex size-5.5 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-[12px] font-bold">
        {n}
      </span>
      <div className="min-w-0 max-w-prose flex-1 text-[13.5px]">{children}</div>
    </li>
  );
}

function Code({
  text,
  label,
  disabled,
  onCopy,
}: {
  text: string;
  label: string;
  disabled: boolean;
  onCopy: (text: string) => void;
}) {
  return (
    <div className="mt-2 flex flex-col items-start gap-2 sm:flex-row">
      <code className="w-full min-w-0 flex-1 select-all whitespace-pre-wrap break-all rounded-lg bg-muted px-2.5 py-2 font-mono text-[12.5px]">
        {text}
      </code>
      <Button type="button" variant="outline" size="sm" onClick={() => onCopy(text)} disabled={disabled}>
        <Copy aria-hidden />
        {label}
      </Button>
    </div>
  );
}

export function ConnectAgent({
  mcpUrl,
  tokens,
  onSelect,
  onCreated,
}: {
  mcpUrl: string;
  /** The live list (the parent polls it while an agent is selected). */
  tokens: ApiToken[];
  onSelect: (selected: boolean) => void;
  onCreated: (record: ApiToken) => void;
}) {
  const { t } = useLang();
  const [agent, setAgent] = useState<AgentId | null>(null);
  // Connections that already existed when the agent was picked: anything new
  // after that is "it worked".
  const [baseline, setBaseline] = useState<ReadonlySet<string>>(new Set());
  const [scope, setScope] = useState<TokenScope>("write");
  const [creating, setCreating] = useState(false);
  const [fresh, setFresh] = useState<{ id: string; token: string; name: string } | null>(null);
  // "Others" only: what the user calls this agent, so several can be told
  // apart in the list below.
  const [name, setName] = useState("");

  const selected = AGENTS.find((a) => a.id === agent) ?? null;

  function pick(id: AgentId) {
    const next = agent === id ? null : id;
    setAgent(next);
    setFresh(null);
    setName("");
    setBaseline(new Set(tokens.map((tk) => tk.id)));
    onSelect(next != null);
  }

  /** Same tile, next agent: forget the token just shown and treat everything
   *  connected so far as "already there". */
  function another() {
    setFresh(null);
    setName("");
    setBaseline(new Set(tokens.map((tk) => tk.id)));
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("tokens.copied"));
    } catch {
      // clipboard blocked — the text is selectable in its box
    }
  }

  async function createToken(wanted: string) {
    if (creating) return;
    const name = uniqueName(wanted.trim().slice(0, 56) || t("connect.otherTokenName"), tokens);
    setCreating(true);
    try {
      const res = await fetch("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, scope }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.token) throw new Error(body?.error ?? t("tokens.couldntCreate"));
      setFresh({ id: body.record.id, token: body.token, name });
      onCreated(body.record as ApiToken);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("tokens.couldntCreate"));
    } finally {
      setCreating(false);
    }
  }

  const newApp = tokens.find((tk) => tk.kind === "app" && !tk.revokedAt && !baseline.has(tk.id));
  const freshUsed = fresh ? tokens.find((tk) => tk.id === fresh.id)?.lastUsedAt : null;
  const connectedName = newApp ? `${newApp.name}${newApp.host ? ` · ${newApp.host}` : ""}` : freshUsed && fresh ? fresh.name : null;

  // Already connected before this visit: say so instead of "waiting", which
  // read as "it isn't working" to someone who had connected it earlier.
  const existing = selected ? tokens.find((tk) => baseline.has(tk.id) && connectionMatches(selected.id, tk)) : undefined;
  const existingName = existing ? `${existing.name}${existing.host ? ` · ${existing.host}` : ""}` : null;

  const token = fresh?.token ?? TOKEN_PLACEHOLDER;
  const cursorConfig = JSON.stringify(
    { mcpServers: { surflog: { url: mcpUrl, headers: { Authorization: `Bearer ${token}` } } } },
    null,
    2
  );
  const claudeCodeCommand = `claude mcp add --transport http surflog ${mcpUrl}`;

  const code = (text: string, secret = false) => (
    <Code text={text} label={t("tokens.copy")} disabled={secret && !fresh} onCopy={copy} />
  );
  const tokenMaker = (defaultName: string | null) => (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {defaultName == null && (
        <Input
          value={fresh ? fresh.name : name}
          maxLength={56}
          disabled={fresh != null}
          aria-label={t("connect.nameLabel")}
          placeholder={t("connect.namePlaceholder")}
          onChange={(e) => setName(e.target.value)}
          className="h-8 w-full sm:w-56"
        />
      )}
      {(["write", "read"] as const).map((s) => (
        <Button
          key={s}
          type="button"
          size="sm"
          variant={scope === s ? "default" : "outline"}
          aria-pressed={scope === s}
          disabled={fresh != null}
          onClick={() => setScope(s)}
        >
          {t(s === "read" ? "tokens.scopeRead" : "tokens.scopeWrite")}
        </Button>
      ))}
      <Button type="button" size="sm" disabled={creating || fresh != null} onClick={() => createToken(defaultName ?? name)}>
        {fresh ? <Check aria-hidden /> : <KeyRound aria-hidden />}
        {t(fresh ? "tokens.created" : "tokens.create")}
      </Button>
    </div>
  );

  const steps: Record<AgentId, React.ReactNode> = {
    claude: (
      <>
        <Step n={1}>{t("connect.claude.1")}</Step>
        <Step n={2}>
          {t("connect.pasteUrl")}
          {code(mcpUrl)}
        </Step>
        <Step n={3}>{t("connect.allow")}</Step>
        <Step n={4}>{t("connect.claude.4")}</Step>
      </>
    ),
    chatgpt: (
      <>
        <Step n={1}>{t("connect.chatgpt.1")}</Step>
        <Step n={2}>
          {t("connect.chatgpt.2")}
          {code(mcpUrl)}
        </Step>
        <Step n={3}>{t("connect.allow")}</Step>
      </>
    ),
    gemini: (
      <>
        <Step n={1}>{t("connect.gemini.1")}</Step>
        <Step n={2}>
          {t("connect.pasteUrl")}
          {code(mcpUrl)}
        </Step>
        <Step n={3}>{t("connect.allow")}</Step>
      </>
    ),
    "claude-code": (
      <>
        <Step n={1}>
          {t("connect.runCommand")}
          {code(claudeCodeCommand)}
        </Step>
        <Step n={2}>{t("connect.claudeCode.2")}</Step>
      </>
    ),
    cursor: (
      <>
        <Step n={1}>
          {t("connect.makeToken")}
          {tokenMaker("Cursor")}
        </Step>
        <Step n={2}>
          {t("connect.cursor.2")}
          {code(cursorConfig, true)}
          {fresh && <p className="mt-1.5 text-[12.5px] font-semibold text-warm">{t("tokens.copyNow")}</p>}
        </Step>
        <Step n={3}>{t("connect.cursor.3")}</Step>
      </>
    ),
    other: (
      <>
        <Step n={1}>
          {t("connect.other.1")}
          {code(mcpUrl)}
        </Step>
        <Step n={2}>{t("connect.other.2")}</Step>
        <Step n={3}>
          {t("connect.other.3")}
          {tokenMaker(null)}
          {code(`Authorization: Bearer ${token}`, true)}
          {fresh && <p className="mt-1.5 text-[12.5px] font-semibold text-warm">{t("tokens.copyNow")}</p>}
        </Step>
      </>
    ),
  };

  const NOTE: Partial<Record<AgentId, TKey>> = { chatgpt: "connect.chatgpt.note", claude: "connect.menuNote", gemini: "connect.gemini.note" };

  return (
    <section className="mt-5 rounded-[var(--r-card)] border bg-card p-4">
      <h2 className="text-base font-bold">{t("connect.title")}</h2>
      <p className="mt-1 max-w-prose text-[13px] text-muted-foreground">{t("connect.intro")}</p>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={t("connect.title")}>
        {AGENTS.map((a) => (
          <Button
            key={a.id}
            type="button"
            variant={agent === a.id ? "default" : "outline"}
            aria-pressed={agent === a.id}
            onClick={() => pick(a.id)}
          >
            {tokens.some((tk) => connectionMatches(a.id, tk)) && <Check aria-hidden />}
            {a.label || t("connect.other")}
          </Button>
        ))}
      </div>

      {selected && (
        <>
          <ol className="mt-4 flex flex-col gap-3.5">{steps[selected.id]}</ol>
          {NOTE[selected.id] && <p className="mt-3 max-w-prose text-[12.5px] text-muted-foreground">{t(NOTE[selected.id]!)}</p>}

          <div
            role="status"
            className={`mt-4 flex items-center gap-2 rounded-[var(--r-tile)] px-3.5 py-2.5 text-[13.5px] font-semibold ${
              connectedName ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
            }`}
          >
            {connectedName || existingName ? (
              <Check className="size-4 shrink-0" aria-hidden />
            ) : (
              <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
            )}
            {connectedName
              ? t("connect.connected", { name: connectedName })
              : existingName
                ? t("connect.already", { name: existingName })
                : t("connect.waiting")}
          </div>
          {(fresh || newApp) && (
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={another}>
              <Plus aria-hidden />
              {t("connect.another")}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
