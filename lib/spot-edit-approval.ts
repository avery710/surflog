/**
 * Approving a spot edit suggestion: re-validates against the spot as it is
 * NOW, applies the changes through the same update path as an admin's own edit
 * (updateSpot), then marks the suggestion approved. Same rules as adding or
 * editing a spot: validateFields, no spot within 100 m / same name nearby,
 * a moved pin must have ocean data and gives the new timezone.
 */
import { applyChanges, readChanges } from "./spot-edit";
import { checkLocation, findDuplicates, toInput, validateFields } from "./spot-create";
import { decideEditRequest, getEditRequest, toAdmin, type AdminEditRequest } from "./spot-edit-requests";
import { getSpotRow, listSpots, rowToSpot, updateSpot } from "./spot-store";
import type { Spot } from "./spots";

export type ApproveResult =
  | { ok: true; spot: Spot; request: AdminEditRequest }
  | {
      ok: false;
      status: 400 | 404 | 409 | 422 | 502;
      code: "not_found" | "spot_not_found" | "resolved" | "invalid" | "duplicate" | "nearby" | "no_sea_data" | "lookup_failed";
      error: string;
      spot?: Spot;
      nearby?: Spot[];
    };

export async function approveEditRequest(
  id: string,
  adminId: string,
  opts: { confirmDistinct?: boolean } = {}
): Promise<ApproveResult> {
  const request = await getEditRequest(id);
  if (!request) return { ok: false, status: 404, code: "not_found", error: "not found" };
  if (request.status !== "pending") return { ok: false, status: 409, code: "resolved", error: "already decided" };

  const row = await getSpotRow(request.spot_slug);
  if (!row) return { ok: false, status: 404, code: "spot_not_found", error: "spot not found" };
  const spot = rowToSpot(row);
  const changes = readChanges(request.changes);

  const fields = validateFields(applyChanges(spot, changes));
  if (!fields.ok) return { ok: false, status: 400, code: "invalid", error: fields.error };

  const moved = changes.lat != null && changes.lng != null;
  const point = moved ? { lat: changes.lat!, lng: changes.lng! } : { lat: row.lat, lng: row.lng };
  let timezone = row.timezone;

  // Duplicate check on any change that could collide (name, area or pin).
  const all = await listSpots();
  const { duplicate, nearby } = findDuplicates(all, point, fields.name, fields.area, row.slug);
  if (duplicate) {
    return { ok: false, status: 409, code: "duplicate", error: "that would duplicate another spot", spot: duplicate };
  }
  if (moved && nearby.length > 0 && !opts.confirmDistinct) {
    return { ok: false, status: 409, code: "nearby", error: "spots already exist close by", nearby };
  }
  if (moved) {
    const geo = await checkLocation(point.lat, point.lng);
    if (!geo.ok) {
      return {
        ok: false,
        status: geo.code === "no_sea_data" ? 422 : 502,
        code: geo.code,
        error: geo.code === "no_sea_data" ? "no ocean data at that location" : "couldn't verify that location",
      };
    }
    timezone = geo.timezone;
  }

  // Apply first, then record: a failed write must not leave the suggestion
  // marked approved. Two admins racing write the same values, and only one
  // of them gets to flip the status.
  const saved = await updateSpot(row.slug, toInput(fields, point, timezone));
  if (!saved) return { ok: false, status: 404, code: "spot_not_found", error: "spot not found" };
  const decided = await decideEditRequest(id, "approved", adminId);
  if (!decided) return { ok: false, status: 409, code: "resolved", error: "already decided" };
  return { ok: true, spot: rowToSpot(saved), request: toAdmin(decided) };
}

/** null = not pending / unknown. */
export async function declineEditRequest(id: string, adminId: string): Promise<AdminEditRequest | null> {
  const done = await decideEditRequest(id, "declined", adminId);
  return done && toAdmin(done);
}
