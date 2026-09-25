"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MAX_BOARD_NOTE,
  MAX_BRAND,
  ROCKERS,
  boardLabel,
  formatLength,
  formatVolume,
  joinLength,
  splitLength,
} from "@/lib/boards";
import { useLang } from "@/lib/i18n";
import type { Board, Rocker } from "@/lib/types";

/**
 * "Your board rack" — the owner's boards, with add / edit / delete. Sits
 * below the Activity calendar and "What you've surfed" table. State lives in
 * Journal (sessions need the list too); this component does the fetches.
 */
export function BoardRack({
  boards,
  onSaved,
  onDeleted,
}: {
  boards: Board[];
  onSaved: (b: Board) => void;
  onDeleted: (id: string) => void;
}) {
  const { t } = useLang();
  // null = closed, "new" = adding, otherwise the board being edited
  const [editing, setEditing] = useState<Board | "new" | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(board: Board) {
    if (confirmingId !== board.id) {
      setConfirmingId(board.id);
      return;
    }
    setDeletingId(board.id);
    try {
      const res = await fetch(`/api/boards/${board.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(t("toast.couldntDelete"));
      onDeleted(board.id);
      toast.success(t("toast.boardDeleted"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("toast.couldntDelete"));
    } finally {
      setDeletingId(null);
      setConfirmingId(null);
    }
  }

  return (
    <section className="mt-6.5">
      <div className="flex items-center justify-between gap-3 pl-1">
        <span className="font-sans text-[13px] font-bold text-muted-foreground">
          {t("section.boards")}
        </span>
        <Button
          variant="secondary"
          size="sm"
          className="rounded-full"
          onClick={() => setEditing("new")}
        >
          {t("board.add")}
        </Button>
      </div>

      <div className="mt-2.5 rounded-[var(--r-card)] border border-border bg-card p-2 shadow-[var(--shadow-card)]">
        {boards.length === 0 ? (
          <p className="px-4 py-4 text-[14px] font-medium text-muted-foreground">{t("board.empty")}</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {boards.map((b) => {
              const name = boardLabel(b);
              const specs = [
                formatLength(b.lengthIn),
                formatVolume(b.volumeL),
                b.rocker ? t("board.rockerValue", { r: t(`board.rocker.${b.rocker}`) }) : null,
              ].filter(Boolean);
              return (
                <li
                  key={b.id}
                  className="flex min-w-0 gap-3 rounded-[var(--r-tile)] bg-secondary p-3"
                >
                  {b.photoId ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/blob/${b.photoId}`}
                      alt={t("board.photoAlt", { name })}
                      loading="lazy"
                      className="size-16 shrink-0 rounded-[12px] bg-background object-cover"
                    />
                  ) : (
                    <div className="size-16 shrink-0 rounded-[12px] bg-background" aria-hidden />
                  )}
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-[15px] font-bold tracking-[-0.015em]">
                      {b.brand || name}
                    </span>
                    {specs.length > 0 && (
                      <span className="font-mono text-[12.5px] text-muted-foreground">
                        {specs.join(" · ")}
                      </span>
                    )}
                    {b.note && (
                      <span className="line-clamp-2 text-[13px] leading-snug break-words text-muted-foreground">
                        {b.note}
                      </span>
                    )}
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 rounded-full bg-background px-3 text-xs"
                        aria-label={t("board.editLabel", { name })}
                        onClick={() => setEditing(b)}
                      >
                        {t("entry.edit")}
                      </Button>
                      <Button
                        variant={confirmingId === b.id ? "destructive" : "ghost"}
                        size="sm"
                        className="h-7 rounded-full bg-background px-3 text-xs text-muted-foreground hover:bg-destructive hover:text-white"
                        onClick={() => handleDelete(b)}
                        onBlur={() => setConfirmingId((id) => (id === b.id ? null : id))}
                        disabled={deletingId === b.id}
                      >
                        {deletingId === b.id
                          ? t("entry.deleting")
                          : confirmingId === b.id
                            ? t("entry.reallyDelete")
                            : t("entry.delete")}
                      </Button>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Dialog open={editing != null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-lg" closeLabel={t("entry.close")}>
          <DialogHeader>
            <DialogTitle>{t(editing === "new" ? "board.addTitle" : "board.editTitle")}</DialogTitle>
          </DialogHeader>
          {editing != null && (
            <BoardForm
              key={editing === "new" ? "new" : editing.id}
              board={editing === "new" ? null : editing}
              onSaved={(b) => {
                onSaved(b);
                setEditing(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

const NO_ROCKER = "__none__";

function BoardForm({ board, onSaved }: { board: Board | null; onSaved: (b: Board) => void }) {
  const { t } = useLang();
  const initialLength = splitLength(board?.lengthIn);
  const [brand, setBrand] = useState(board?.brand ?? "");
  const [ft, setFt] = useState(initialLength.ft);
  const [inches, setInches] = useState(initialLength.inches);
  const [volume, setVolume] = useState(board?.volumeL != null ? String(board.volumeL) : "");
  const [rocker, setRocker] = useState<Rocker | null>(board?.rocker ?? null);
  const [note, setNote] = useState(board?.note ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Free the object URL when it's replaced or the form closes.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setRemovePhoto(false);
  }

  function clearPhoto() {
    setFile(null);
    setPreviewUrl(null);
    setRemovePhoto(true);
  }

  const shownPhoto = previewUrl ?? (!removePhoto && board?.photoId ? `/api/blob/${board.photoId}` : null);

  async function handleSave() {
    const lengthIn = joinLength(ft, inches);
    if (Number.isNaN(lengthIn)) {
      toast.error(t("board.lengthInvalid"));
      return;
    }
    const volumeL = volume.trim() ? Number(volume) : null;
    if (volumeL != null && (!Number.isFinite(volumeL) || volumeL <= 0 || volumeL > 300)) {
      toast.error(t("board.volumeInvalid"));
      return;
    }
    if (!brand.trim() && lengthIn == null) {
      toast.error(t("board.needBrandOrLength"));
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(board ? `/api/boards/${board.id}` : "/api/boards", {
        method: board ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand, lengthIn, volumeL, rocker, note }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? t("toast.couldntSaveBoard"));
      let saved = body.board as Board;

      // Photo is a second request, once the board exists (it needs an id).
      try {
        if (file) {
          const form = new FormData();
          form.append("file", file);
          const r = await fetch(`/api/boards/${saved.id}/photo`, { method: "POST", body: form });
          const b = await r.json();
          if (!r.ok) throw new Error(b?.error);
          saved = b.board as Board;
        } else if (removePhoto && saved.photoId) {
          const r = await fetch(`/api/boards/${saved.id}/photo`, { method: "DELETE" });
          const b = await r.json();
          if (!r.ok) throw new Error(b?.error);
          saved = b.board as Board;
        }
      } catch {
        onSaved(saved);
        toast.error(t("toast.boardPhotoFailed"));
        return;
      }

      onSaved(saved);
      toast.success(t("toast.boardSaved"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("toast.couldntSaveBoard"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <FormField label={t("board.brand")}>
        <Input
          value={brand}
          maxLength={MAX_BRAND}
          placeholder={t("board.brandPlaceholder")}
          onChange={(e) => setBrand(e.target.value)}
        />
      </FormField>

      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
        <div className="col-span-2 flex min-w-0 flex-col gap-1.5 sm:col-span-1">
          <span className="pl-0.5 text-xs font-semibold text-muted-foreground">{t("board.length")}</span>
          <div className="flex items-center gap-1.5">
            <Input
              inputMode="numeric"
              value={ft}
              placeholder="6"
              aria-label={t("board.lengthFeet")}
              onChange={(e) => setFt(e.target.value)}
              className="font-mono"
            />
            <span className="font-mono text-sm text-muted-foreground">&apos;</span>
            <Input
              inputMode="decimal"
              value={inches}
              placeholder="2"
              aria-label={t("board.lengthInches")}
              onChange={(e) => setInches(e.target.value)}
              className="font-mono"
            />
            <span className="font-mono text-sm text-muted-foreground">&quot;</span>
          </div>
        </div>
        <FormField label={`${t("board.volume")} (L)`}>
          <Input
            inputMode="decimal"
            value={volume}
            placeholder="32.5"
            onChange={(e) => setVolume(e.target.value)}
            className="font-mono"
          />
        </FormField>
        <FormField label={t("board.rocker")}>
          <Select
            value={rocker ?? NO_ROCKER}
            onValueChange={(v) => setRocker(v === NO_ROCKER ? null : (v as Rocker))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_ROCKER}>{t("board.rocker.none")}</SelectItem>
              {ROCKERS.map((r) => (
                <SelectItem key={r} value={r}>
                  {t(`board.rocker.${r}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>

      <FormField label={t("board.note")}>
        <Textarea
          value={note}
          maxLength={MAX_BOARD_NOTE}
          placeholder={t("board.notePlaceholder")}
          onChange={(e) => setNote(e.target.value)}
        />
      </FormField>

      <div className="flex flex-col gap-1.5">
        <span className="pl-0.5 text-xs font-semibold text-muted-foreground">{t("board.photoOptional")}</span>
        <div className="flex flex-wrap items-center gap-3">
          {shownPhoto && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shownPhoto}
              alt={t("board.photoAlt", { name: boardLabel({ brand, lengthIn: joinLength(ft, inches) || null }) })}
              className="size-16 rounded-[12px] bg-secondary object-cover"
            />
          )}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="rounded-full"
            onClick={() => fileRef.current?.click()}
          >
            {shownPhoto ? t("board.changePhoto") : t("board.choosePhoto")}
          </Button>
          {shownPhoto && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-full text-muted-foreground"
              onClick={clearPhoto}
            >
              {t("board.removePhoto")}
            </Button>
          )}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />
        </div>
      </div>

      <div>
        <Button onClick={handleSave} disabled={saving} className="rounded-full px-6">
          {saving ? t("form.saving") : t("board.save")}
        </Button>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="pl-0.5 text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
