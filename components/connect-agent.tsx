"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLang, type TKey } from "@/lib/i18n";
import type { ApiToken, TokenScope } from "@/lib/token-auth";

/**
 * "Connect an agent" on /tokens: pick the agent, get only that agent's steps
 * with the server URL / command / config already filled in, and watch it land.
 *
 * The user never chooses between OAuth and a token — the agent decides:
 * `oauth` agents sign in through /oauth/authorize (no secret to handle),
 * `token` agents get a personal token made here and dropped into the snippet.
 * Menu names inside other vendors' apps are written from their public docs and
 * drift; keep the steps short so there is less to go stale.
 */
type AgentId = "claude" | "chatgpt" | "claude-code" | "cursor" | "other";

const AGENTS: { id: AgentId; label: string; auth: "oauth" | "token" | "either" }[] = [
  { id: "claude", label: "Claude", auth: "oauth" },
  { id: "chatgpt", label: "ChatGPT", auth: "oauth" },
  { id: "claude-code", label: "Claude Code", auth: "oauth" },
  { id: "cursor", label: "Cursor", auth: "token" },
  { id: "other", label: "", auth: "either" },
];

const TOKEN_PLACEHOLDER = "sfl_…";

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-px flex size-5.5 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-[12px] font-bold">
        {n}
      </span>
      <div className="min-w-0 flex-1 text-[13.5px]">{children}</div>
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
  const [fresh, setFresh] = useState<{ id: string; token: string } | null>(null);

  const selected = AGENTS.find((a) => a.id === agent) ?? null;

  function pick(id: AgentId) {
    const next = agent === id ? null : id;
    setAgent(next);
    setFresh(null);
    setBaseline(new Set(tokens.map((tk) => tk.id)));
    onSelect(next != null);
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("tokens.copied"));
    } catch {
      // clipboard blocked — the text is selectable in its box
    }
  }

  async function createToken(name: string) {
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, scope }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.token) throw new Error(body?.error ?? t("tokens.couldntCreate"));
      setFresh({ id: body.record.id, token: body.token });
      onCreated(body.record as ApiToken);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("tokens.couldntCreate"));
    } finally {
      setCreating(false);
    }
  }

  const newApp = tokens.find((tk) => tk.kind === "app" && !tk.revokedAt && !baseline.has(tk.id));
  const freshUsed = fresh ? tokens.find((tk) => tk.id === fresh.id)?.lastUsedAt : null;
  const connectedName = newApp ? `${newApp.name}${newApp.host ? ` · ${newApp.host}` : ""}` : freshUsed ? selected?.label || t("connect.other") : null;

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
  const tokenMaker = (name: string) => (
    <div className="mt-2 flex flex-wrap items-center gap-2">
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
      <Button type="button" size="sm" disabled={creating || fresh != null} onClick={() => createToken(name)}>
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
          {tokenMaker(t("connect.otherTokenName"))}
          {code(`Authorization: Bearer ${token}`, true)}
          {fresh && <p className="mt-1.5 text-[12.5px] font-semibold text-warm">{t("tokens.copyNow")}</p>}
        </Step>
      </>
    ),
  };

  const NOTE: Partial<Record<AgentId, TKey>> = { chatgpt: "connect.chatgpt.note", claude: "connect.menuNote" };

  return (
    <section className="mt-5 rounded-[var(--r-card)] border bg-card p-4">
      <h2 className="text-base font-bold">{t("connect.title")}</h2>
      <p className="mt-1 text-[13px] text-muted-foreground">{t("connect.intro")}</p>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={t("connect.title")}>
        {AGENTS.map((a) => (
          <Button
            key={a.id}
            type="button"
            variant={agent === a.id ? "default" : "outline"}
            aria-pressed={agent === a.id}
            onClick={() => pick(a.id)}
          >
            {a.label || t("connect.other")}
          </Button>
        ))}
      </div>

      {selected && (
        <>
          <ol className="mt-4 flex flex-col gap-3.5">{steps[selected.id]}</ol>
          {NOTE[selected.id] && <p className="mt-3 text-[12.5px] text-muted-foreground">{t(NOTE[selected.id]!)}</p>}

          <div
            role="status"
            className={`mt-4 flex items-center gap-2 rounded-[var(--r-tile)] px-3.5 py-2.5 text-[13.5px] font-semibold ${
              connectedName ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
            }`}
          >
            {connectedName ? <Check className="size-4" aria-hidden /> : <Loader2 className="size-4 animate-spin" aria-hidden />}
            {connectedName ? t("connect.connected", { name: connectedName }) : t("connect.waiting")}
          </div>
        </>
      )}
    </section>
  );
}
