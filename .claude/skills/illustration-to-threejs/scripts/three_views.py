# From a list of simple solid blocks to three-view sheets and the sampled forms the model is built from, so both have one source.
# Each view: the silhouette, a solid line wherever one solid enters another, dotted lines for outlines a nearer solid hides.
#   python3 three_views.py <project>   reads blocks.py and parts.json; writes <name>_views.svg, views.json and model.json.
import importlib.util, json, math, os, sys
from shape_reading import connector

RES = 170  # raster cells per unit

def catmull(a, b, c, d, u):
    return .5 * (2 * b + (c - a) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (3 * b - a - 3 * c + d) * u * u * u)

def gauss(a, sigma):
    r = math.ceil(sigma * 2.5); out = []
    for i in range(len(a)):
        s = w = 0.0
        for k in range(-r, r + 1):
            g = math.exp(-k * k / (2 * sigma * sigma)); s += a[max(0, min(len(a) - 1, i + k))] * g; w += g
        out.append(s / w)
    return out

def sample(keys, each=30):
    # Dense samples through the keys, with radius, depth and position all flowing together.
    cols = list(zip(*keys)); out = [[] for _ in cols]
    n = len(keys)
    for i in range(n - 1):
        for s in range(each):
            for o, col in enumerate(cols):
                out[o].append(catmull(col[max(0, i - 1)], col[i], col[i + 1], col[min(n - 1, i + 2)], s / each))
    for o, col in enumerate(cols): out[o].append(col[-1])
    if n > 2: out = [gauss(c, 9) for c in out]
    return [dict(x=a, y=b, z=c, r=d, d=e) for a, b, c, d, e in zip(*out)]

def sample_lobes(lobes, necks=None, each=30):
    # Circles joined by smooth curves: spheres along the line between two lobes trace circle, connecting curve, circle.
    # Corners in that line stay hidden inside the lobes. A neck is its half-width, or (half-width, half-depth).
    out = []; necks = necks or [None] * (len(lobes) - 1)
    for i, (a, b) in enumerate(zip(lobes, lobes[1:])):
        L = math.dist(a[:3], b[:3]); n = necks[i]; n_r, n_d = n if isinstance(n, (tuple, list)) else (n, n)
        fr, _ = connector(a[3], b[3], L, n_r); fd, _ = connector(a[4], b[4], L, n_d)
        for k in range(each):
            t = k / each
            out.append(dict(x=a[0] + (b[0] - a[0]) * t, y=a[1] + (b[1] - a[1]) * t, z=a[2] + (b[2] - a[2]) * t, r=fr(t * L), d=fd(t * L)))
    e = lobes[-1]; out.append(dict(x=e[0], y=e[1], z=e[2], r=e[3], d=e[4]))
    return out

class Grid:
    def __init__(self, x0, x1, y0, y1, pad=.3):
        self.x0 = x0 - pad; self.y0 = y0 - pad
        self.w = int((x1 - x0 + pad * 2) * RES) + 2; self.h = int((y1 - y0 + pad * 2) * RES) + 2
    def blank(self): return [[0.0] * self.w for _ in range(self.h)]
    def stamp(self, M, shapes):
        # shapes: (cx, cy, rx, ry) ellipses
        for cx, cy, rx, ry in shapes:
            j0 = max(0, int((cy - ry - self.y0) * RES)); j1 = min(self.h - 1, int((cy + ry - self.y0) * RES) + 1)
            for j in range(j0, j1 + 1):
                t = 1 - ((self.y0 + j / RES - cy) / ry) ** 2
                if t <= 0: continue
                half = rx * math.sqrt(t)
                i0 = max(0, math.ceil((cx - half - self.x0) * RES)); i1 = min(self.w - 1, math.floor((cx + half - self.x0) * RES))
                row = M[j]
                for i in range(i0, i1 + 1): row[i] = 1.0
        return M
    def at(self, M, p):
        i = int(round((p[0] - self.x0) * RES)); j = int(round((p[1] - self.y0) * RES))
        return 0 <= i < self.w and 0 <= j < self.h and M[j][i] > .5

def box(row, r):
    n = len(row); out = [0.0] * n; s = 0.0; w = 2 * r + 1
    for i in range(-r, r + 1): s += row[min(n - 1, max(0, i))]
    for i in range(n):
        out[i] = s / w
        s += row[min(n - 1, i + r + 1)] - row[max(0, i - r)]
    return out
def blur(M, sigma):
    r = max(1, int(round(sigma * RES)))
    for _ in range(3):
        M = [box(row, r) for row in M]
        M = [list(c) for c in zip(*[box(list(col), r) for col in zip(*M)])]
    return M

def contours(M, g):
    # Marching squares at the 0.5 level, joined into closed loops.
    nxt = {}
    def pt(key):
        i, j, s = key
        if s == 0:
            a, b = M[j][i], M[j][i + 1]; t = (.5 - a) / (b - a) if a != b else .5
            return (g.x0 + (i + t) / RES, g.y0 + j / RES)
        a, b = M[j][i], M[j + 1][i]; t = (.5 - a) / (b - a) if a != b else .5
        return (g.x0 + i / RES, g.y0 + (j + t) / RES)
    for j in range(g.h - 1):
        for i in range(g.w - 1):
            c = (M[j][i] > .5) | (M[j][i + 1] > .5) << 1 | (M[j + 1][i + 1] > .5) << 2 | (M[j + 1][i] > .5) << 3
            if c == 0 or c == 15: continue
            B_, R_, T_, L_ = (i, j, 0), (i + 1, j, 1), (i, j + 1, 0), (i, j, 1)
            segs = {1:[(L_,B_)],2:[(B_,R_)],3:[(L_,R_)],4:[(R_,T_)],5:[(L_,T_),(R_,B_)],6:[(B_,T_)],7:[(L_,T_)],8:[(T_,L_)],9:[(T_,B_)],10:[(T_,R_),(B_,L_)],11:[(T_,R_)],12:[(R_,L_)],13:[(R_,B_)],14:[(B_,L_)]}[c]
            for a, b in segs: nxt[a] = b
    loops = []
    while nxt:
        s = next(iter(nxt)); k = s; loop = []
        while k in nxt:
            loop.append(pt(k)); k = nxt.pop(k)
        if len(loop) > 8: loops.append(loop)
    return loops

def area(l): return sum(l[i][0] * l[(i + 1) % len(l)][1] - l[(i + 1) % len(l)][0] * l[i][1] for i in range(len(l))) / 2

def resample(loop, step):
    out = []; n = len(loop)
    seg = [math.dist(loop[i], loop[(i + 1) % n]) for i in range(n)]
    per = sum(seg); count = max(8, int(per / step)); d = per / count; i = 0; acc = 0.0
    for c in range(count):
        target = c * d
        while acc + seg[i] < target: acc += seg[i]; i = (i + 1) % n
        t = (target - acc) / (seg[i] or 1)
        a, b = loop[i], loop[(i + 1) % n]
        out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
    return out

def smooth_loop(loop, sigma, step=.012):
    pts = resample(loop, step); n = len(pts); r = int(sigma * 2.5 / step)
    w = [math.exp(-(k * step) ** 2 / (2 * sigma * sigma)) for k in range(-r, r + 1)]; W = sum(w)
    out = []
    for i in range(n):
        x = y = 0.0
        for k in range(-r, r + 1):
            p = pts[(i + k) % n]; x += p[0] * w[k + r]; y += p[1] * w[k + r]
        out.append((x / W, y / W))
    return out[::2]

def curve(pts, to, close=True):
    # Quadratic through the midpoints: no facets at any zoom.
    q = [to(p) for p in pts]
    if close:
        m = lambda a, b: ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
        s = m(q[-1], q[0]); d = 'M%.1f %.1f' % s
        for i in range(len(q)):
            e = m(q[i], q[(i + 1) % len(q)]); d += 'Q%.1f %.1f %.1f %.1f' % (q[i][0], q[i][1], e[0], e[1])
        return d + 'Z'
    d = 'M%.1f %.1f' % q[0]
    for i in range(1, len(q) - 1):
        e = ((q[i][0] + q[i + 1][0]) / 2, (q[i][1] + q[i + 1][1]) / 2); d += 'Q%.1f %.1f %.1f %.1f' % (q[i][0], q[i][1], e[0], e[1])
    return d + 'L%.1f %.1f' % q[-1]

def bends(loops):
    # How many times an outline changes direction of curvature. Fewer is simpler.
    total = 0
    for l in loops:
        q = l[::3]; n = len(q); ks = []
        for i in range(n):
            a, b, c = q[i - 2], q[i], q[(i + 2) % n]
            ks.append((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]))
        big = [k for k in ks if abs(k) > .0015]
        total += sum(1 for i in range(len(big)) if big[i] * big[i - 1] < 0)
    return total

def runs(loop, flags):
    n = len(loop); out = []
    if all(flags): return [(loop, True)]
    if not any(flags): return []
    start = next(i for i in range(n) if not flags[i]); run = []
    for k in range(1, n + 1):
        i = (start + k) % n
        if flags[i]: run.append(loop[i])
        else:
            if len(run) > 7: out.append((run, False))
            run = []
    return out

def project(view, q, floor):
    if view == 'side': return (q['x'], q['y'], q['r'], q['r'])
    if view == 'front': return (q['z'], q['y'], q['d'], q['r'])
    return (q['x'], q['z'], q['r'], q['d'])

def closeness(view, forms, facing):
    s = forms['sp']; n = len(s)
    if view == 'side': return sum(q['z'] for q in s) / n
    if view == 'front': return sum(q['x'] for q in s) / n * facing
    return sum(q['y'] for q in s) / n

def depth(view, q, facing):
    # Centre and half-extent of one sample along the line of sight, nearer = larger.
    if view == 'side': return q['z'], q['d']
    if view == 'front': return q['x'] * facing, q['r']
    return q['y'], q['r']

def view(view_name, forms, cfg):
    # forms: every block, mirrored twins included. Returns the silhouette, the visible creases where one solid enters another,
    # the dotted outlines of whatever a nearer solid hides, and each form's whole outline.
    fl = cfg['floor']
    used = [f for f in forms if not (view_name == 'side' and f.get('twin'))]
    shapes = {id(f): [project(view_name, q, fl) for q in f['sp'][::2]] for f in used}
    allp = [s for v in shapes.values() for s in v]
    g = Grid(min(s[0] - s[2] for s in allp), max(s[0] + s[2] for s in allp), min(s[1] - s[3] for s in allp), max(s[1] + s[3] for s in allp))
    lim = max(0, int((fl - g.y0) * RES)) if view_name in ('side', 'front') else 0
    def to_floor(M):
        for j in range(0, lim): M[j] = [0.0] * g.w
        return M
    masks = {id(f): to_floor(g.stamp(g.blank(), shapes[id(f)])) for f in used}
    # A solid made of several blended blocks has soft fillets where they meet.
    for f in used:
        if f.get('blended'):
            m = masks[id(f)]; b = blur(m, .05)
            masks[id(f)] = [[1.0 if (m[j][i] > .5 or b[j][i] > .5) else 0.0 for i in range(g.w)] for j in range(g.h)]
    # Which solid is nearest at each cell: the boundaries between them are the visible creases.
    Z = g.blank(); ID = [[-1] * g.w for _ in range(g.h)]
    for fi, f in enumerate(used):
        for q in f['sp'][::2]:
            cx, cy, rx, ry = project(view_name, q, fl); dc, dr = depth(view_name, q, cfg['facing'])
            j0 = max(lim, int((cy - ry - g.y0) * RES)); j1 = min(g.h - 1, int((cy + ry - g.y0) * RES) + 1)
            for j in range(j0, j1 + 1):
                v = (g.y0 + j / RES - cy) / ry; t = 1 - v * v
                if t <= 0: continue
                half = rx * math.sqrt(t)
                i0 = max(0, math.ceil((cx - half - g.x0) * RES)); i1 = min(g.w - 1, math.floor((cx + half - g.x0) * RES))
                zr = Z[j]; ir = ID[j]
                for i in range(i0, i1 + 1):
                    u = (g.x0 + i / RES - cx) / rx; w = t - u * u
                    if w <= 0: continue
                    d = dc + dr * math.sqrt(w)
                    if ir[i] < 0 or d > zr[i]: zr[i] = d; ir[i] = fi
    M = [[1.0 if c >= 0 else 0.0 for c in row] for row in ID]
    F = blur(M, cfg.get('fillet', .012))
    U = [[1.0 if (M[j][i] > .5 or F[j][i] > .5) else 0.0 for i in range(g.w)] for j in range(g.h)]
    S = blur(U, .012)
    sil = [smooth_loop(l, cfg.get('smooth', .022)) for l in contours(S, g) if abs(area(l)) > .015]
    edge = [p for l in sil for p in l[::2]]
    far_from = lambda p, pts, d: not pts or min((p[0] - e[0]) ** 2 + (p[1] - e[1]) ** 2 for e in pts) > d * d
    lines = []; seen = []
    for fi, f in enumerate(used):
        if fi == 0: continue
        mine = [[1.0 if c == fi else 0.0 for c in row] for row in ID]
        for loop in contours(blur(mine, .012), g):
            if abs(area(loop)) < .004: continue
            loop = smooth_loop(loop, cfg.get('smooth', .022))
            vis = [bool(g.at(S, p) and far_from(p, edge, .022) and far_from(p, seen, .02)) for p in loop]
            got = runs(loop, vis); lines += got
            seen += [p for pts, _ in got for p in pts[::2]]
    dots = []; rims = []
    at_id = lambda p: ID[int(round((p[1] - g.y0) * RES))][int(round((p[0] - g.x0) * RES))]
    for fi, f in enumerate(used):
        for loop in contours(blur(masks[id(f)], .012), g):
            if abs(area(loop)) < .01: continue
            loop = smooth_loop(loop, cfg.get('smooth', .022))
            rims.append(dict(n=f['n'], main=fi == 0, line=loop))
            hid = [bool(g.at(S, p) and far_from(p, edge, .022) and at_id(p) != fi and far_from(p, seen, .02)) for p in loop]
            dots += runs(loop, hid)
    return sil, lines, dots, rims

def surface_z(forms, x, y):
    best = None
    for f in forms:
        for q in f['sp']:
            t = 1 - ((x - q['x']) ** 2 + (y - q['y']) ** 2) / (q['r'] ** 2)
            if t > 0:
                z = q['z'] + q['d'] * math.sqrt(t)
                if best is None or z > best: best = z
    return best or 0.0

def circle(cx, cy, rx, ry=None):
    ry = ry or rx
    return [(cx + rx * math.cos(i / 40 * math.pi * 2), cy + ry * math.sin(i / 40 * math.pi * 2)) for i in range(40)]

def sheet(name, cfg, bp):
    forms = []
    for b in cfg['blocks']:
        sp = [dict(x=q[0], y=q[1], z=q[2], r=q[3], d=q[4]) for q in b['sp']] if 'sp' in b else sample_lobes(b['lobes'], b.get('necks')) if 'lobes' in b else sample(b['keys'])
        k = b.get('k', 0)
        base = dict(n=b['n'], of=b.get('of'), crisp=b.get('crisp'), ell=b.get('ell'), tube=b.get('tube'), frame=b.get('frame'), sp=sp, k=k if not isinstance(k, list) else [[i / (len(k) - 1), v] for i, v in enumerate(k)])
        forms.append(base)
        if b.get('m'):
            forms.append(dict(base, sp=[dict(q, z=-q['z']) for q in sp], twin=True, ell=dict(base['ell'], z=-base['ell'].get('z', 0)) if base.get('ell') else None))
    # Each solid for the views: a block with of= is drawn as part of that solid, and blends into it in the mesh.
    # A tube with a frame is wider (d) along the frame's own z than its side radius r: draw it as round samples spread across that width.
    def drawn(f):
        R = f.get('frame')
        if not R: return f['sp']
        out = []
        for q in f['sp']:
            w = max(q['d'] - q['r'], 0)
            for t in (-1, -.5, 0, .5, 1):
                out.append(dict(q, x=q['x'] + R[0][2] * t * w, y=q['y'] + R[1][2] * t * w, z=q['z'] + R[2][2] * t * w, d=q['r']))
        return out
    solids = []
    for f in forms:
        if f.get('of'):
            same = [h for h in solids if h['n'] == f['of']]; host = next((h for h in same if bool(h.get('twin')) == bool(f.get('twin'))), same[0])
            host['sp'] = host['sp'] + drawn(f); host['blended'] = True
        else: solids.append(dict(f, sp=drawn(f)))
    forms_all = forms; forms = solids
    views = {v: view(v, forms, cfg) for v in ('side', 'front', 'top')}
    ext = lambda loops, i: (min(p[i] for l in loops for p in l), max(p[i] for l in loops for p in l))
    print('%-7s outline bends: side %d, front %d, top %d' % (name, bends(views['side'][0]), bends(views['front'][0]), bends(views['top'][0])))
    minX, maxX = ext(views['side'][0], 0); minY, maxY = ext(views['side'][0], 1)
    fz = ext(views['front'][0], 0); zmax = max(abs(fz[0]), abs(fz[1]))
    tz = ext(views['top'][0], 1); tzm = max(abs(tz[0]), abs(tz[1]))
    nose = (bp.get('circles') or [None])[0]
    for mk_ in (cfg.get('marks') or []):
        if mk_['kind'] == 'ball':
            minX = min(minX, mk_['at'][0] - mk_['r']); maxX = max(maxX, mk_['at'][0] + mk_['r']); zmax = max(zmax, abs(mk_['at'][2]) + mk_['r'])
    if nose: minX = min(minX, nose['at'][0] - nose['rx']); maxX = max(maxX, nose['at'][0] + nose['rx'])
    m = 46; gap = 70
    s = min((1160 - m * 2 - gap) / ((maxX - minX) + zmax * 2), (1160 - m * 2 - gap) / ((maxY - minY) + tzm * 2))
    sw = (maxX - minX) * s; sh = (maxY - minY) * s; fw = zmax * 2 * s; th = tzm * 2 * s
    W = m * 2 + sw + gap + fw; H = m * 2 + th + gap + sh
    sx = m - minX * s; sy = m + th + gap + maxY * s
    fx = m + sw + gap + zmax * s; fy = sy
    tx = sx; ty = m + tzm * s
    o = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d">' % (W, H, W, H), '<rect width="100%" height="100%" fill="#F7F6F3"/>']
    gl = '<g stroke="#C9C7C2" stroke-width="1" stroke-dasharray="3 5">'
    for y in (minY, maxY): gl += '<line x1="%d" x2="%d" y1="%.1f" y2="%.1f"/>' % (m / 2, W - m / 2, sy - y * s, sy - y * s)
    for x in (minX, maxX): gl += '<line y1="%d" y2="%d" x1="%.1f" x2="%.1f"/>' % (m / 2, H - m / 2, sx + x * s, sx + x * s)
    o.append(gl + '</g>')
    def tos(v):
        if v == 'side': return lambda p: (sx + p[0] * s, sy - p[1] * s)
        if v == 'front':
            sg = -cfg['facing']
            return lambda p: (fx + sg * p[0] * s, fy - p[1] * s)
        return lambda p: (tx + p[0] * s, ty + p[1] * s)
    for v in ('side', 'front', 'top'):
        sil, lines, dots, _ = views[v]; to = tos(v)
        o.append('<path d="%s" fill="#FFFFFF" fill-rule="evenodd" stroke="#1E1B18" stroke-width="2.6" stroke-linejoin="round"/>' % ''.join(curve(l, to) for l in sil))
        for pts, cl in lines:
            o.append('<path d="%s" fill="none" stroke="#1E1B18" stroke-width="2.6" stroke-linecap="round"/>' % curve(pts, to, cl))
        for pts, cl in dots:
            o.append('<path d="%s" fill="none" stroke="#59696C" stroke-width="2.2" stroke-linecap="round" stroke-dasharray=".1 6.5"/>' % curve(pts, to, cl))
    def blob(kind, poly, v):
        d = curve(poly, tos(v))
        o.append('<path d="%s" fill="#1E1B18"/>' % d if kind == 'ink' else '<path d="%s" fill="#FFFFFF" stroke="#1E1B18" stroke-width="2"/>' % d)
    if nose:
        rx, ry = nose['rx'], nose['ry']
        blob('ink', circle(nose['at'][0], nose['at'][1], rx, ry), 'side')
        blob('ink', circle(0, nose['at'][1], rx, ry), 'front')
        blob('ink', circle(nose['at'][0], 0, rx, rx * .9), 'top')
    # A line designed from the front, on the surface: (x, y, z) points. Solid in the front and side views, dotted from the top where the head hides it.
    if cfg.get('frontline'):
        P_ = cfg['frontline']
        for v_, pts_ in (('front', [(q[2], q[1]) for q in P_]), ('side', [(q[0], q[1]) for q in P_ if q[2] >= 0])):
            o.append('<path d="%s" fill="none" stroke="#1E1B18" stroke-width="3" stroke-linecap="round"/>' % curve(pts_, tos(v_), False))
        o.append('<path d="%s" fill="none" stroke="#59696C" stroke-width="2.2" stroke-linecap="round" stroke-dasharray=".1 6.5"/>' % curve([(q[0], q[2]) for q in P_], tos('top'), False))
    # Lines of an optional garment (a page toggle): dotted, [view, [(u, v), ...]].
    for v_, pts_ in (cfg.get('garment') or []):
        o.append('<path d="%s" fill="none" stroke="#59696C" stroke-width="2.2" stroke-linecap="round" stroke-dasharray=".1 6.5"/>' % curve([tuple(q) for q in pts_], tos(v_), False))
    # The body's own outline in the top view, dotted where the head and ears hide it.
    for b_ in cfg['blocks']:
        if b_.get('ell') and not b_.get('of'):
            sp_ = [q for f in forms_all if f['n'] == 'body' and f.get('ell') == b_['ell'] for q in f['sp']]
            xs_ = [min(q['x'] - q['r'] for q in sp_), max(q['x'] + q['r'] for q in sp_)]
            top_ = []; bot_ = []; N_ = 72
            for i_ in range(N_ + 1):
                x_ = xs_[0] + (xs_[1] - xs_[0]) * (1 - math.cos(math.pi * i_ / N_)) / 2
                z_ = max((q['d'] * math.sqrt(max(1 - ((x_ - q['x']) / q['r']) ** 2, 0)) for q in sp_), default=0)
                top_.append((x_, z_)); bot_.append((x_, -z_))
            o.append('<path d="%s" fill="none" stroke="#59696C" stroke-width="2.2" stroke-linecap="round" stroke-dasharray=".1 6.5"/>' % curve(top_ + bot_[::-1], tos('top')))
    # Thin painted lines (a small mouth) on the side view, and where they land on the surface from the front.
    for it in (cfg.get('paint') or []):
        if not it.get('line'): continue
        pts = [tuple(q) for q in it['line']]
        o.append('<path d="%s" fill="none" stroke="#1E1B18" stroke-width="2.6" stroke-linecap="round"/>' % curve(pts, tos('side'), False))
        body = [f for f in forms_all if f['n'] == 'body']
        for m in (1, -1):
            o.append('<path d="%s" fill="none" stroke="#1E1B18" stroke-width="2.6" stroke-linecap="round"/>' % curve([(m * (surface_z(body, x, y) or 0), y) for x, y in pts], tos('front'), False))
    for spec in bp.get('eyes', []):
        x, y = spec['at']
        z = surface_z([f for f in forms_all if f['n'] == 'body'], x, y)
        # An optional eye set (a page toggle) is only outlined, dotted, around the default eye.
        if spec.get('set') and spec['set'] != 'plain':
            it = spec['items'][0]
            dot = '<path d="%s" fill="none" stroke="#59696C" stroke-width="2.2" stroke-linecap="round" stroke-dasharray=".1 6.5"/>'
            o.append(dot % curve(circle(x, y, it['rx'], it['ry']), tos('side')))
            for side in (1, -1): o.append(dot % curve(circle(side * z, y, it['rx'] * .62, it['ry']), tos('front')))
            continue
        for it in spec['items']:
            ex, ey = x + it.get('dx', 0), y + it.get('dy', 0)
            blob(it['c'], circle(ex, ey, it['rx'], it['ry']), 'side')
            for side in (1, -1):
                blob(it['c'], circle(side * z, ey, it['rx'] * .62, it['ry']), 'front')
    # Marks fixed to a posed bone, given in 3D: the nose, eyes, mouth, and the top's hem, collar and sleeves.
    PROJ = dict(side=lambda q: (q[0], q[1]), front=lambda q: (q[2], q[1]), top=lambda q: (q[0], q[2]))
    LOOK = dict(side=(0, 0, 1), front=(cfg['facing'], 0, 0), top=(0, 1, 0))
    dotted = '<path d="%s" fill="none" stroke="#59696C" stroke-width="2.2" stroke-linecap="round" stroke-dasharray=".1 6.5"/>'
    for mk in (cfg.get('marks') or []):
        for v_ in ('side', 'front', 'top'):
            pr = PROJ[v_]; to = tos(v_)
            if mk['kind'] == 'ball':
                c_ = pr(mk['at']); o.append('<path d="%s" fill="#1E1B18"/>' % curve(circle(c_[0], c_[1], mk['r']), to))
            elif mk['kind'] == 'line':
                o.append('<path d="%s" fill="none" stroke="#1E1B18" stroke-width="3" stroke-linecap="round"/>' % curve([pr(q) for q in mk['pts']], to, False))
            elif mk['kind'] == 'dotball':
                c_ = pr(mk['at']); o.append(dotted % curve(circle(c_[0], c_[1], mk['r']), to))
            elif mk['kind'] == 'dotline':
                o.append(dotted % curve([pr(q) for q in mk['pts']], to, False))
            else:
                seen = sum(a_ * b_ for a_, b_ in zip(mk['n'], LOOK[v_])) > .15
                if mk['kind'] == 'ink' and seen: o.append('<path d="%s" fill="#1E1B18"/>' % curve([pr(q) for q in mk['pts'][:-1]], to))
                else: o.append(dotted % curve([pr(q) for q in mk['pts']], to, False))
    # The joints: core axis thick, limb bones thin, a dot at every joint.
    rg = cfg.get('joints')
    if rg:
        P_ = rg['pts']
        for v_ in ('side', 'front', 'top'):
            pr = PROJ[v_]; to = tos(v_)
            for a_, b_ in rg['bones']:
                core_ = a_ in rg['axis'] and b_ in rg['axis']
                A_, B_ = to(pr(P_[a_])), to(pr(P_[b_]))
                o.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#E5484D" stroke-width="%s" stroke-linecap="round"/>' % (A_[0], A_[1], B_[0], B_[1], '3.4' if core_ else '1.8'))
            # Each foot's own axis, heel to toe, with the toe marked; the stringer in the top view.
            for a_, b_ in (rg.get('feet') or []):
                A_, B_ = to(pr(P_[a_])), to(pr(P_[b_]))
                o.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#1F6FEB" stroke-width="3.4" stroke-linecap="round"/><circle cx="%.1f" cy="%.1f" r="5" fill="#1F6FEB"/>' % (A_[0], A_[1], B_[0], B_[1], B_[0], B_[1]))
            if v_ == 'top' and rg.get('stringer') is not None:
                A_, B_ = to((rg['stringer'], -tzm)), to((rg['stringer'], tzm))
                o.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#1F6FEB" stroke-width="1.6" stroke-dasharray="7 5"/>' % (A_[0], A_[1], B_[0], B_[1]))
            for n_, q_ in P_.items():
                A_ = to(pr(q_))
                o.append('<circle cx="%.1f" cy="%.1f" r="4.6" fill="#FFFFFF" stroke="#E5484D" stroke-width="2.2"/>' % A_)
    lab = 'font-family="Helvetica,Arial,sans-serif" font-size="15" fill="#59696C"'
    o.append('<text x="%d" y="%d" %s>Top &#183;&#183;&#183; dotted = hidden from this view &#183;&#183;&#183; red = joints and core axis &#183;&#183;&#183; blue = feet, heel to toe</text>' % (m, m - 14, lab))
    o.append('<text x="%d" y="%.0f" %s>Side</text>' % (m, m + th + gap - 14, lab))
    o.append('<text x="%.0f" y="%.0f" %s>Front</text>' % (m + sw + gap, m + th + gap - 14, lab))
    o.append('</svg>')
    out = lambda loops: [[[round(p[0], 3), round(p[1], 3)] for p in l] for l in loops]
    pl = lambda ls: [[[round(p[0], 3), round(p[1], 3)] for p in pts] + ([[round(pts[0][0], 3), round(pts[0][1], 3)]] if cl else []) for pts, cl in ls]
    res = dict(rims={v: [dict(n=r['n'], main=r['main'], line=[[round(p[0], 3), round(p[1], 3)] for p in r['line']]) for r in views[v][3]] for v in views}, svg='\n'.join(o), facing=cfg['facing'], side=out(views['side'][0]), front=out(views['front'][0]), top=out(views['top'][0]),
        lines={v: dict(solid=out(views[v][0]) + pl(views[v][1]), dots=pl(views[v][2])) for v in views})
    model = dict(floor=cfg['floor'], cell=cfg.get('cell', .014), bands=cfg.get('bands'), paint=cfg.get('paint'), zones=cfg.get('zones'), strokes=[dict(n=f['n'], of=f.get('of'), crisp=f.get('crisp'), tube=f.get('tube'), frame=f.get('frame'), ell=f.get('ell'), twin=bool(f.get('twin')), k=f['k'], sp=[{a: round(b, 4) for a, b in q.items()} for q in f['sp']]) for f in forms_all])
    return res, model

if __name__ == '__main__':
    proj = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__))
    spec = importlib.util.spec_from_file_location('blocks', proj + '/blocks.py')
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    src = proj + '/parts.json' if os.path.exists(proj + '/parts.json') else proj + '/trace/bp2.json'
    bp = json.load(open(src))
    outdir = proj if os.path.exists(proj + '/parts.json') else proj + '/trace'
    V = {}; M = {}; R = {}
    for name, cfg in mod.BLOCKS.items():
        V[name], M[name] = sheet(name, cfg, bp.get(name, {})); R[name] = V[name].pop('rims')
        open(outdir + '/%s_views.svg' % name, 'w').write(V[name]['svg'])
    json.dump(V, open(outdir + '/views.json', 'w'))
    json.dump(R, open(outdir + '/rims.json', 'w'))
    json.dump(M, open(outdir + '/model.json', 'w'))
    print('ok')
