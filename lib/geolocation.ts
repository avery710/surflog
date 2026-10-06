import type { TKey } from "@/lib/i18n";
import type { LatLng } from "@/lib/spot-geo";

// One place for "where am I?" — the spot picker's "Near me" and the two
// "Use my current location" buttons all go through locateOnce(). Call it
// only from a tap: nothing here may run on open (no permission prompt
// unless the user asks for it).

/** Why a location request failed. `denied` covers every refusal the browser
 *  reports as PERMISSION_DENIED, including the ones where no prompt was ever
 *  shown: the OS has location off for the browser app, or the site was
 *  blocked earlier and the browser remembers. */
export type GeoFailure = "unsupported" | "insecure" | "denied" | "unavailable" | "timeout";

/** Which settings a refusal most likely comes from — picks the hint only. */
export type DeniedHint = "ios" | "android" | "site" | "device";

export type LocateResult =
  | ({ ok: true } & LatLng)
  | { ok: false; failure: Exclude<GeoFailure, "denied"> }
  | { ok: false; failure: "denied"; hint: DeniedHint };

type PermissionGuess = "granted" | "denied" | "prompt" | "unknown";

/** GeolocationPositionError.code → our failure. 1 PERMISSION_DENIED,
 *  2 POSITION_UNAVAILABLE, 3 TIMEOUT; anything else reads as "unavailable"
 *  (try again), never as a permissions problem. */
export function failureFromCode(code: number): "denied" | "unavailable" | "timeout" {
  if (code === 1) return "denied";
  if (code === 3) return "timeout";
  return "unavailable";
}

/** iPhone/iPad (every browser there is WebKit), Android, or neither.
 *  iPadOS reports a Mac user agent, told apart by its touch points. The
 *  browser itself is deliberately not guessed: user agents can't name it
 *  reliably, so the hints say "your browser". */
export function platformOf(userAgent: string, maxTouchPoints = 0): "ios" | "android" | "other" {
  if (/iPhone|iPad|iPod/.test(userAgent)) return "ios";
  if (/Macintosh/.test(userAgent) && maxTouchPoints > 1) return "ios";
  if (/Android/.test(userAgent)) return "android";
  return "other";
}

/** Where to send the user after a refusal. On iOS the app-level Location
 *  setting is the usual cause and the Permissions API is too patchy in
 *  WebKit to tell the cases apart, so it always gets the iOS hint.
 *  Elsewhere a remembered per-site block reports "denied"; anything else
 *  means the browser was refused by the device. */
export function deniedHint(platform: "ios" | "android" | "other", permission: PermissionGuess): DeniedHint {
  if (platform === "ios") return "ios";
  if (permission === "denied") return "site";
  return platform === "android" ? "android" : "device";
}

/** Only ever asked AFTER a refusal, to choose the wording — never to decide
 *  whether to call getCurrentPosition. */
async function queryPermission(): Promise<PermissionGuess> {
  try {
    if (!navigator.permissions?.query) return "unknown";
    const status = await navigator.permissions.query({ name: "geolocation" });
    return status.state;
  } catch {
    return "unknown"; // older WebKit throws for names it doesn't know
  }
}

/** One location fix. Never rejects. Every call asks the browser again, so
 *  a retry after the user fixes their settings works. */
export function locateOnce(options: PositionOptions): Promise<LocateResult> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    // Browsers hide the API on plain http; say that instead of "can't".
    const insecure = typeof window !== "undefined" && window.isSecureContext === false;
    return Promise.resolve({ ok: false, failure: insecure ? "insecure" : "unsupported" });
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ ok: true, lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        const failure = failureFromCode(err.code);
        if (failure !== "denied") return resolve({ ok: false, failure });
        if (window.isSecureContext === false) return resolve({ ok: false, failure: "insecure" });
        void queryPermission().then((permission) =>
          resolve({
            ok: false,
            failure: "denied",
            hint: deniedHint(platformOf(navigator.userAgent, navigator.maxTouchPoints), permission),
          })
        );
      },
      options
    );
  });
}

/** The i18n key for a failed locateOnce(). */
export function geoFailureKey(result: Extract<LocateResult, { ok: false }>): TKey {
  if (result.failure === "denied") return `geo.denied.${result.hint}`;
  return `geo.${result.failure}`;
}
