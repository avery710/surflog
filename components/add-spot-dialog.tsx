"use client";

import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLang, type TKey } from "@/lib/i18n";
import { useSpotCatalog } from "@/lib/spot-catalog";
import { COMPASS_16, parseLocation } from "@/lib/spot-geo";
import { geoFailureKey, locateOnce } from "@/lib/geolocation";
import { compassLabel } from "@/lib/format";
import type { Spot } from "@/lib/spots";
import type { SpotRequest } from "@/lib/spot-requests";

const NO_FACING = "none";

/** Add a spot to the shared catalogue — an admin-only tool (the API 404s for
 *  anyone not in SPOT_ADMIN_EMAILS). Country and area are detected from the
 *  pasted location (/api/spots/locate) and prefilled, both still editable.
 *  `onCreated` fires with the spot to
 *  select afterwards: the new one, or the existing one when the API reported
 *  a duplicate/nearby spot and the user chose it instead. Optional `editing`
 *  turns it into an editor (with delete) for a spot the viewer created;
 *  `onCreated` then receives the updated spot. Mount it once per picker. */
export function AddSpotDialog({
  open,
  onOpenChange,
  initialName,
  editing,
  request,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  editing?: Spot;
  /** Approve a spot request by creating the spot from it: prefills name and
   *  location, and sends `requestId` so the API approves the request and
   *  re-points its sessions (see POST /api/spots). */
  request?: SpotRequestSeed;
  onCreated: (spot: Spot) => void;
}) {
  const { t } = useLang();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" closeLabel={t("entry.close")}>
        <DialogHeader>
          <DialogTitle>{editing ? t("spot.editTitle") : t("spot.addTitle")}</DialogTitle>
          <DialogDescription>{t("spot.intro")}</DialogDescription>
        </DialogHeader>
        {/* mounted only while open, so every open starts from a clean form */}
        <SpotForm editing={editing} request={request} initialName={initialName} onDone={() => onOpenChange(false)} onCreated={onCreated} />
      </DialogContent>
    </Dialog>
  );
}

/** The bits of a spot request the dialog needs (admin shape, lib/spot-requests.ts). */
export type SpotRequestSeed = Pick<SpotRequest, "id" | "name" | "locationText" | "lat" | "lng">;

type Problem =
  | { kind: "message"; text: string }
  | { kind: "duplicate"; existing: Spot }
  | { kind: "nearby"; spots: Spot[] };

function SpotForm({
  editing,
  request,
  initialName,
  onDone,
  onCreated,
}: {
  editing?: Spot;
  request?: SpotRequestSeed;
  initialName?: string;
  onDone: () => void;
  onCreated: (spot: Spot) => void;
}) {
  const { lang, t } = useLang();
  const catalog = useSpotCatalog();
  const uid = useId();
  const [name, setName] = useState(editing?.name ?? request?.name ?? initialName ?? "");
  const [nameZh, setNameZh] = useState(editing?.nameZh ?? "");
  const [country, setCountry] = useState(editing?.country ?? "");
  const [area, setArea] = useState(editing?.area ?? "");
  const [location, setLocation] = useState(
    request?.locationText ?? (request?.lat != null && request?.lng != null ? `${request.lat}, ${request.lng}` : "")
  );
  const [facing, setFacing] = useState(editing?.facing ?? NO_FACING);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);

  // Detection must never overwrite what the admin typed themselves.
  const touched = useRef({ country: false, area: false });
  const [detected, setDetected] = useState<{ areaOptions: string[]; source: string } | null>(null);

  const countries = [...new Set(catalog.spots.map((s) => s.country).filter(Boolean))] as string[];
  const areas = [
    ...new Set([...catalog.spots.map((s) => s.area), ...(detected?.areaOptions ?? [])].filter(Boolean)),
  ] as string[];

  // Debounced: once the location parses (or looks like a short Maps link),
  // ask the server where it is. Server-side because Nominatim wants a proper
  // User-Agent and short links need following.
  useEffect(() => {
    const text = location.trim();
    if (!text || !(parseLocation(text) || /^https:\/\/(maps\.app\.goo\.gl|goo\.gl)\//.test(text))) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/spots/locate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ location: text }),
          signal: ctrl.signal,
        });
        if (!res.ok) return;
        const body = (await res.json()) as {
          country: string | null;
          area: string | null;
          areaOptions: string[];
          source: string;
        };
        if (body.country && !touched.current.country) setCountry(body.country);
        if (body.area && !touched.current.area) setArea(body.area);
        setDetected({ areaOptions: body.areaOptions, source: body.source });
      } catch {
        // detection is a convenience; the fields stay as they were
      }
    }, 600);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [location]);

  const pin = parseLocation(location);
  const looksLikeShortLink = !pin && /^https:\/\/(maps\.app\.goo\.gl|goo\.gl)\//.test(location.trim());
  const fmtPin = (p: { lat: number; lng: number }) => `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
  const canSave =
    name.trim().length >= 2 &&
    country.trim() !== "" &&
    area.trim() !== "" &&
    (editing ? true : location.trim() !== "");

  function fail(code: string | undefined, body: { error?: string; existing?: Spot; nearby?: Spot[] }) {
    const messages: Record<string, TKey> = {
      bad_location: "spot.err.badLocation",
      no_sea_data: "spot.err.noSea",
      lookup_failed: "spot.err.lookup",
      in_use: "spot.err.inUse",
    };
    if (code === "duplicate" && body.existing) {
      setProblem({ kind: "duplicate", existing: body.existing });
    } else if (code === "nearby" && body.nearby?.length) {
      setProblem({ kind: "nearby", spots: body.nearby });
    } else {
      setProblem({ kind: "message", text: t(messages[code ?? ""] ?? "spot.err.generic") });
    }
  }

  async function submit(confirmDistinct = false) {
    setBusy(true);
    setProblem(null);
    try {
      const res = await fetch(editing ? `/api/spots/${encodeURIComponent(editing.slug)}` : "/api/spots", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          nameZh,
          country,
          area,
          facing: facing === NO_FACING ? "" : facing,
          ...(location.trim() ? { location } : {}),
          ...(confirmDistinct ? { confirmDistinct: true } : {}),
          ...(request && !editing ? { requestId: request.id } : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return fail(body?.code, body ?? {});
      const spot = body.spot as Spot;
      if (editing) catalog.replaceSpot(spot);
      else catalog.addSpot(spot);
      onCreated(spot);
      toast.success(editing ? t("spot.updated") : t("spot.added"));
      onDone();
    } catch {
      setProblem({ kind: "message", text: t("spot.err.generic") });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!editing) return;
    setBusy(true);
    setProblem(null);
    try {
      const res = await fetch(`/api/spots/${encodeURIComponent(editing.slug)}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return fail(body?.code, body ?? {});
      catalog.removeSpot(editing.slug);
      toast.success(t("spot.deleted"));
      onDone();
    } catch {
      setProblem({ kind: "message", text: t("spot.err.generic") });
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  const [locating, setLocating] = useState(false);
  // Only ever on tap. The position fills the Location field client-side and
  // goes nowhere else until the user saves.
  async function fillFromGeolocation() {
    setLocating(true);
    setProblem(null);
    const result = await locateOnce({ enableHighAccuracy: true, timeout: 10000 });
    if (result.ok) setLocation(`${result.lat.toFixed(5)}, ${result.lng.toFixed(5)}`);
    else {
      const text = t(geoFailureKey(result)) + (lang === "en" ? " " : "") + t("spot.err.geoPasteInstead");
      setProblem({ kind: "message", text });
    }
    setLocating(false);
  }

  const pickExisting = (spot: Spot) => {
    onCreated(spot);
    onDone();
  };

  return (
    <form
      className="flex flex-col gap-3.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSave && !busy) void submit();
      }}
    >
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <FormField label={t("spot.name")} htmlFor={`${uid}-name`}>
          <Input
            id={`${uid}-name`}
            value={name}
            maxLength={80}
            placeholder={t("spot.namePlaceholder")}
            onChange={(e) => setName(e.target.value)}
          />
        </FormField>
        <FormField label={t("spot.nameZh")} htmlFor={`${uid}-zh`}>
          <Input id={`${uid}-zh`} value={nameZh} maxLength={80} onChange={(e) => setNameZh(e.target.value)} />
        </FormField>
        <FormField label={t("spot.country")} htmlFor={`${uid}-country`}>
          <Input
            id={`${uid}-country`}
            list={`${uid}-countries`}
            value={country}
            maxLength={60}
            placeholder={t("spot.countryPlaceholder")}
            onChange={(e) => {
              touched.current.country = true;
              setCountry(e.target.value);
            }}
          />
          <datalist id={`${uid}-countries`}>
            {countries.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </FormField>
        <FormField label={t("spot.area")} htmlFor={`${uid}-area`}>
          <Input
            id={`${uid}-area`}
            list={`${uid}-areas`}
            value={area}
            maxLength={60}
            placeholder={t("spot.areaPlaceholder")}
            onChange={(e) => {
              touched.current.area = true;
              setArea(e.target.value);
            }}
          />
          <datalist id={`${uid}-areas`}>
            {areas.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
          {detected && detected.source !== "none" && (
            <span className="pl-0.5 text-xs text-muted-foreground">{t("spot.detected")}</span>
          )}
        </FormField>
      </div>

      <FormField label={t("spot.location")} htmlFor={`${uid}-loc`}>
        <Input
          id={`${uid}-loc`}
          value={location}
          placeholder={
            editing && editing.lat != null && editing.lng != null
              ? t("spot.locationKeep", { coords: fmtPin({ lat: editing.lat, lng: editing.lng }) })
              : t("spot.locationPlaceholder")
          }
          onChange={(e) => setLocation(e.target.value)}
        />
        <div>
          <Button type="button" variant="secondary" size="sm" className="rounded-full" disabled={locating} onClick={fillFromGeolocation}>
            {locating ? t("spot.locating") : t("spot.useMyLocation")}
          </Button>
        </div>
        <span className="pl-0.5 text-xs text-muted-foreground">
          {pin
            ? t("spot.pin", { coords: fmtPin(pin) })
            : looksLikeShortLink
              ? t("spot.shortLink")
              : t("spot.locationHint")}
        </span>
      </FormField>

      <FormField label={t("spot.facing")}>
        <Select value={facing} onValueChange={setFacing}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_FACING}>{t("spot.facingUnknown")}</SelectItem>
            {COMPASS_16.map((d) => (
              <SelectItem key={d} value={d}>
                {compassLabel(d, lang)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="pl-0.5 text-xs text-muted-foreground">{t("spot.facingHint")}</span>
      </FormField>

      {problem && (
        <div role="alert" className="rounded-xl bg-secondary px-3.5 py-3 text-[13px] leading-relaxed">
          {problem.kind === "message" && problem.text}
          {problem.kind === "duplicate" && (
            <div className="flex flex-col items-start gap-2">
              <span>{t("spot.err.duplicate", { name: catalog.label(problem.existing.slug, lang) })}</span>
              <Button type="button" size="sm" className="rounded-full" onClick={() => pickExisting(problem.existing)}>
                {t("spot.pickExisting", { name: catalog.label(problem.existing.slug, lang) })}
              </Button>
            </div>
          )}
          {problem.kind === "nearby" && (
            <div className="flex flex-col items-start gap-2">
              <span>
                {t("spot.err.nearby", {
                  names: problem.spots.map((s) => catalog.label(s.slug, lang)).join(", "),
                })}
              </span>
              <div className="flex flex-wrap gap-2">
                {problem.spots.slice(0, 3).map((s) => (
                  <Button
                    key={s.slug}
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="rounded-full"
                    onClick={() => pickExisting(s)}
                  >
                    {t("spot.pickExisting", { name: catalog.label(s.slug, lang) })}
                  </Button>
                ))}
                <Button type="button" size="sm" className="rounded-full" disabled={busy} onClick={() => submit(true)}>
                  {t("spot.addAnyway")}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-1 flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={!canSave || busy} className="rounded-full px-6">
          {editing ? t("spot.update") : busy ? t("spot.saving") : t("spot.save")}
        </Button>
        {editing && (
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            className="rounded-full text-destructive hover:text-destructive"
            onClick={() => (confirmDelete ? void remove() : setConfirmDelete(true))}
          >
            {confirmDelete ? t("spot.deleteConfirm") : t("spot.delete")}
          </Button>
        )}
      </div>
    </form>
  );
}

function FormField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={htmlFor} className="pl-0.5 text-xs font-semibold text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
