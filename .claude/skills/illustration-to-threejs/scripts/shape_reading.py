#!/usr/bin/env python3
"""Read a part of a drawing as circles joined by smooth curves.

  python3 shape_reading.py <project>

The circles are only the full round lobes of a part (drawn yellow). A narrowing between two lobes is never a shape
of its own: it is the connecting curve (drawn green), which bends the other way and meets both circles without a corner.

Reads <project>/reading.json:
  { "image": "drawing.png", "units": { "at": [px, py], "is": [x, y], "per_px": s },
    "parts": { "<toy>.<part>": { "lobes": [[cx, cy, r], ...], "necks": [half_width | null, ...], "z": [...], "d": [...], "neck_d": [...] } } }
Pixels throughout, except z, d and neck_d in model units. necks has one entry per gap between lobes; null is a straight
tangent line with no dip. Writes reading_<toy>_<part>.svg and prints the block's lobes= and necks= in model units.
"""
import base64, json, math, os, sys

def connector(R1, R2, L, neck):
    """Radius along the line between two circles, so spheres swept along it trace circle, curve, circle.

    The connecting curve is an arc tangent to both circles. Returns r(s), the arc's centre (along, off) and radius.
    With no neck, or one too wide to dip, the join is the straight tangent line."""
    straight = (lambda s: R1 + (R2 - R1) * s / (L or 1)), None
    if neck is None or L < 1e-6 or neck >= min(R1, R2): return straight
    def arc(rho):
        along = (L * L + (R1 + rho) ** 2 - (R2 + rho) ** 2) / (2 * L)
        h = (R1 + rho) ** 2 - along * along
        if h <= 0: return None
        off = math.sqrt(h)
        # Past either circle the arc no longer dips between them, so the narrowest point is the smaller circle.
        return along, off, rho, off - rho if 0 < along < L else min(R1, R2)
    lo = max(1e-4, (L - R1 - R2) / 2 + 1e-4); hi = lo + 400 * max(R1, R2, L)
    for _ in range(80):
        mid = (lo + hi) / 2; a = arc(mid)
        if a and a[3] < neck: lo = mid
        else: hi = mid
    a = arc(lo) or arc(hi)
    if not a or not 0 < a[0] < L: return straight
    along, off, rho = a[:3]
    return (lambda s: math.hypot(s - along, off) - rho), (along, off, rho)

def reading_svg(part, img, size):
    w, h = size; L = part['lobes']; o = []
    for c in L: o.append(f'<circle cx="{c[0]}" cy="{c[1]}" r="{c[2]}" fill="none" stroke="#FFE600" stroke-width="2"/>')
    for i, (a, b) in enumerate(zip(L, L[1:])):
        dx, dy = b[0] - a[0], b[1] - a[1]; d = math.hypot(dx, dy); ux, uy = dx / d, dy / d
        _, f = connector(a[2], b[2], d, part['necks'][i])
        for side in (1, -1):
            if f:
                along, off, rho = f
                cx, cy = a[0] + ux * along - uy * off * side, a[1] + uy * along + ux * off * side
                t1, t2 = math.atan2(a[1] - cy, a[0] - cx), math.atan2(b[1] - cy, b[0] - cx)
                while t2 - t1 > math.pi: t2 -= 2 * math.pi
                while t2 - t1 < -math.pi: t2 += 2 * math.pi
                pts = [(cx + rho * math.cos(t1 + (t2 - t1) * k / 24), cy + rho * math.sin(t1 + (t2 - t1) * k / 24)) for k in range(25)]
            else:
                ang = math.asin(max(-1, min(1, (a[2] - b[2]) / d)))
                nx, ny = -uy * math.cos(ang) + ux * math.sin(ang) * side, ux * math.cos(ang) + uy * math.sin(ang) * side
                pts = [(a[0] + nx * a[2] * side, a[1] + ny * a[2] * side), (b[0] + nx * b[2] * side, b[1] + ny * b[2] * side)]
            o.append('<polyline fill="none" stroke="#00E040" stroke-width="2" points="' + ' '.join(f'{x:.1f},{y:.1f}' for x, y in pts) + '"/>')
    return f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 {w} {h}" width="{w*2}" height="{h*2}"><image xlink:href="data:image/png;base64,{img}" width="{w}" height="{h}"/>' + ''.join(o) + '</svg>'

def main(proj):
    cfg = json.load(open(proj + '/reading.json')); u = cfg['units']; s = u['per_px']
    img = base64.b64encode(open(os.path.join(proj, cfg['image']), 'rb').read()).decode()
    for name, part in cfg['parts'].items():
        open(f"{proj}/reading_{name.replace('.', '_')}.svg", 'w').write(reading_svg(part, img, part.get('size', [400, 305])))
        lobes = [(round(u['is'][0] + (c[0] - u['at'][0]) * s, 3), round(u['is'][1] - (c[1] - u['at'][1]) * s, 3), part['z'][i], round(c[2] * s, 3), part['d'][i]) for i, c in enumerate(part['lobes'])]
        nd = part.get('neck_d') or [None] * len(part['necks'])
        necks = [None if n is None else (round(n * s, 3), nd[i]) for i, n in enumerate(part['necks'])]
        print(name, 'lobes =', lobes, 'necks =', necks)

if __name__ == '__main__':
    main(os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else '.')
