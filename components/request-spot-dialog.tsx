"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLang } from "@/lib/i18n";
import { useSpotCatalog, type OwnRequest } from "@/lib/spot-catalog";
import { requestSlug } from "@/lib/spots";

/** Ask the admin to add a spot (POST /api/spot-requests). Any signed-in user.
 *  The request can be logged against straight away: `onRequested` receives
 *  the `req:<id>` value to use as the session's spot. */
export function RequestSpotDialog({
  open,
  onOpenChange,
  initialName,
  onRequested,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  onRequested?: (spotValue: string) => void;
}) {
  const { t } = useLang();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" closeLabel={t("entry.close")}>
        <DialogHeader>
          <DialogTitle>{t("request.title")}</DialogTitle>
          <DialogDescription>{t("request.intro")}</DialogDescription>
        </DialogHeader>
        {/* mounted only while open, so every open starts from a clean form */}
        <RequestForm initialName={initialName} onDone={() => onOpenChange(false)} onRequested={onRequested} />
      </DialogContent>
    </Dialog>
  );
}

function RequestForm({
  initialName,
  onDone,
  onRequested,
}: {
  initialName?: string;
  onDone: () => void;
  onRequested?: (spotValue: string) => void;
}) {
  const { t } = useLang();
  const catalog = useSpotCatalog();
  const [name, setName] = useState(initialName ?? "");
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only on tap; the position just fills the field until the user sends.
  function fillFromGeolocation() {
    if (!navigator.geolocation) {
      setError(t("request.locationUnavailable"));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
        setLocating(false);
      },
      () => {
        setError(t("request.locationDenied"));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/spot-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, location, note }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.code === "limit" ? t("request.limit") : t("request.failed"));
        return;
      }
      const request = body.request as OwnRequest;
      catalog.upsertRequest(request);
      onRequested?.(requestSlug(request.id));
      toast.success(t("request.sent"));
      onDone();
    } catch {
      setError(t("request.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-3.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim().length >= 2 && !busy) void submit();
      }}
    >
      <label className="flex flex-col gap-1.5">
        <span className="pl-0.5 text-xs font-semibold text-muted-foreground">{t("request.name")}</span>
        <Input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="pl-0.5 text-xs font-semibold text-muted-foreground">{t("request.location")}</span>
        <Input
          value={location}
          placeholder={t("request.locationPlaceholder")}
          onChange={(e) => setLocation(e.target.value)}
        />
      </label>
      <div>
        <Button type="button" variant="secondary" size="sm" className="rounded-full" disabled={locating} onClick={fillFromGeolocation}>
          {locating ? t("request.locating") : t("request.useMyLocation")}
        </Button>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="pl-0.5 text-xs font-semibold text-muted-foreground">{t("request.note")}</span>
        <Textarea
          value={note}
          maxLength={500}
          rows={3}
          placeholder={t("request.notePlaceholder")}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      {error && (
        <div role="alert" className="rounded-xl bg-secondary px-3.5 py-3 text-[13px] leading-relaxed">
          {error}
        </div>
      )}
      <div>
        <Button type="submit" disabled={name.trim().length < 2 || busy} className="rounded-full px-6">
          {busy ? t("request.sending") : t("request.send")}
        </Button>
      </div>
    </form>
  );
}
