#!/usr/bin/env python3
"""Check that three-view lines are shapes (circles, ellipses) joined by smooth connecting curves.

  python3 ellipse_check.py <project> [toy ...]

Walks the whole outline of each separate solid in rims.json and splits it into the fewest pieces that each sit on
one ellipse. A convex piece is a shape (yellow). A concave or unfitted piece is a connecting curve (green). Anything that
wiggles is red. The body should be nearly all shape, with no reversals in its bend.
Prints per view: shapes, connectors, wiggles, kinks at joins, the body's own share, and the score.
Writes <toy>_ellipses.svg in those colours, each shape's full ellipse faint, kinks circled.
"""
import importlib.util, json, math, os, sys

TOL = .012          # how far a line may leave its ellipse, model units
MAX_ASPECT = 4.5    # flatter than this is not read as an ellipse
KINK_DEG = 16       # a sharper turn at a join is not a smooth connection
STEP = .025
LONGEST = 140      # steps

def resample(line, closed):
    pts = line + [line[0]] if closed and line[0] != line[-1] else line
    out = [pts[0]]; rest = 0.
    for a, b in zip(pts, pts[1:]):
        l = math.hypot(b[0]-a[0], b[1]-a[1]); d = STEP - rest
        while d <= l and l > 0:
            out.append((a[0]+(b[0]-a[0])*d/l, a[1]+(b[1]-a[1])*d/l)); d += STEP
        rest = (rest + l) % STEP if l else rest
    if closed and math.hypot(out[-1][0]-out[0][0], out[-1][1]-out[0][1]) < STEP * .5: out.pop()
    return out

def solve(A, b):
    n = len(b); M = [A[i][:] + [b[i]] for i in range(n)]
    for i in range(n):
        p = max(range(i, n), key=lambda r: abs(M[r][i]))
        if abs(M[p][i]) < 1e-10: return None
        M[i], M[p] = M[p], M[i]
        for r in range(n):
            if r != i:
                f = M[r][i] / M[i][i]
                if f: M[r] = [x - f * y for x, y in zip(M[r], M[i])]
    return [M[i][n] / M[i][i] for i in range(n)]

def fit(pts):
    """Least-squares conic. Returns (ellipse, worst distance) or None when it is no sensible ellipse."""
    cx = sum(p[0] for p in pts) / len(pts); cy = sum(p[1] for p in pts) / len(pts)
    s = max(max(abs(p[0]-cx), abs(p[1]-cy)) for p in pts) or 1
    Q = [((p[0]-cx)/s, (p[1]-cy)/s) for p in pts]
    A = [[0.]*5 for _ in range(5)]; b = [0.]*5
    for x, y in Q:
        r = (x*x, x*y, y*y, x, y)
        for i in range(5):
            b[i] += r[i]
            for j in range(5): A[i][j] += r[i]*r[j]
    for i in range(5): A[i][i] += 1e-9
    c = solve(A, b)
    if not c: return None
    a_, b_, c_, d_, e_ = c
    if b_*b_ - 4*a_*c_ >= 0: return None
    D = 4*a_*c_ - b_*b_; x0 = (b_*e_ - 2*c_*d_) / D; y0 = (b_*d_ - 2*a_*e_) / D
    F0 = 1 - (a_*x0*x0 + b_*x0*y0 + c_*y0*y0 + d_*x0 + e_*y0)
    lm = math.sqrt((a_-c_)**2 + b_*b_); l1 = (a_+c_+lm)/2; l2 = (a_+c_-lm)/2
    if F0 <= 0 or l1 <= 0 or l2 <= 0: return None
    r1, r2 = math.sqrt(F0/l2), math.sqrt(F0/l1)
    if r1 / r2 > MAX_ASPECT: return None
    worst = 0.
    for x, y in Q:
        g = math.hypot(2*a_*x + b_*y + d_, b_*x + 2*c_*y + e_) or 1e-9
        worst = max(worst, abs(a_*x*x + b_*x*y + c_*y*y + d_*x + e_*y - 1) / g * s)
    ang = .5 * math.atan2(b_, a_-c_) + math.pi/2 if abs(a_-c_) + abs(b_) > 1e-12 else 0.
    return dict(cx=x0*s+cx, cy=y0*s+cy, rx=r1*s, ry=r2*s, ang=ang), worst

def pieces(P, closed, start):
    n = len(P); N = n if closed else n - 1
    at = lambda k: P[(start + k) % n] if closed else P[k]
    k, out = 0, []
    while k < N:
        # Longest first: a long gentle arc looks straight in short windows, so growing from short never finds it.
        best = None; L = min(LONGEST, N + (1 if not closed else 0) - k)
        while L >= 6:
            seg = [at(k+i) for i in range(L)]; r = fit(seg)
            if r and r[1] <= TOL: best = (L, r[0]); break
            L -= 5
        if best: L, e = best; out.append(dict(k=k, L=L, e=e, pts=[at(k+i) for i in range(L+1 if k+L <= N else L)])); k += max(L-1, 1)
        else:
            L = min(6, N - k + 1); out.append(dict(k=k, L=L, e=None, pts=[at(k+i) for i in range(L)])); k += max(L-1, 1)
    # Neighbouring connector steps are one connector.
    merged = []
    for p in out:
        if merged and p['e'] is None and merged[-1]['e'] is None: merged[-1]['pts'] += p['pts'][1:]; merged[-1]['L'] += p['L'] - 1
        else: merged.append(p)
    return merged

def kinks(parts, closed):
    res = []; m = len(parts)
    for i in range(m if closed else m - 1):
        a = parts[i]['pts']; b = parts[(i+1) % m]['pts']
        if len(a) < 3 or len(b) < 3: continue
        u = (a[-1][0]-a[-3][0], a[-1][1]-a[-3][1]); v = (b[2][0]-b[0][0], b[2][1]-b[0][1])
        t = abs(math.degrees(math.atan2(u[0]*v[1]-u[1]*v[0], u[0]*v[0]+u[1]*v[1])))
        if t > KINK_DEG: res.append(b[0])
    return res

def length(pts): return sum(math.hypot(b[0]-a[0], b[1]-a[1]) for a, b in zip(pts, pts[1:]))

def read_line(line, closed):
    P = resample(line, closed)
    if len(P) < 6: return []
    return min((pieces(P, closed, int(len(P)*f)) for f in ((0, .25, .5, .75) if closed else (0,))), key=lambda ps: (sum(1 for p in ps if p['e']) + 2*sum(1 for p in ps if not p['e'])))

def turns(pts):
    # Signed turn along a piece, and how many times it really changes direction: a reversal of 7 degrees or more, so
    # noise on a nearly straight line doesn't count. A wiggle is more than one change.
    H = [math.atan2(b[1]-a[1], b[0]-a[0]) for a, b in zip(pts[::2], pts[2::2])]
    D = [math.atan2(math.sin(q-p), math.cos(q-p)) for p, q in zip(H, H[1:])]
    t = lo = hi = 0.; way = 0; flips = 0
    for d in D:
        t += d; lo = min(lo, t); hi = max(hi, t)
        if t - lo >= .12 and way <= 0:
            flips += way < 0; way = 1; hi = t
        elif hi - t >= .12 and way >= 0:
            flips += way > 0; way = -1; lo = t
    return t, flips

def classify(p, orient):
    """yellow: a convex piece on an ellipse, one of the shapes. green: a connecting curve (concave, or no fit, with at
    most one change of direction). red: anything that wiggles."""
    total, flips = turns(p['pts'])
    if flips > 1: return 'red'
    if p['e'] and (orient == 0 or total * orient > 0): return 'yellow'
    return 'green'

def signed_area(l): return sum(a[0]*b[1] - b[0]*a[1] for a, b in zip(l, l[1:] + l[:1]))

SHAPE_SHARE = .6    # with no tangent joins left, shapes must carry most of the line

def turning(l):
    # How many times the outline's bend reverses: a complete curve has none.
    P = resample(l, True); n = len(P)
    if n < 12: return 0
    t, flips = turns(P + P[:6]); return flips

def check(rims, cfg, name):
    res = {}; drawn = {}; fl = cfg['floor']
    for view in ('side', 'front', 'top'):
        all_parts = []; ks = []; L = dict(yellow=0., green=0., red=0.); body = dict(yellow=0., green=0., red=0.); flips = 0
        for r in rims[view]:
            l = r['line']; ps = read_line(l, True); orient = 1 if signed_area(l) > 0 else -1
            # A sole is cut flat on the floor on purpose, so its corners don't count.
            ks += [q for q in kinks(ps, True) if view == 'top' or q[1] > fl + .04]
            for p in ps:
                p['kind'] = classify(p, orient); L[p['kind']] += length(p['pts'])
                if r['main']: body[p['kind']] += length(p['pts'])
            if r['main']: flips += turning(l)
            all_parts += ps
        tot = sum(L.values()) or 1; bt = sum(body.values()) or 1
        arcs = sum(1 for p in all_parts if p['kind'] == 'yellow'); conn = sum(1 for p in all_parts if p['kind'] == 'green'); red = sum(1 for p in all_parts if p['kind'] == 'red')
        budget = 3 * len(rims[view])
        score = 10 * (1 - L['red'] / tot) * min(1, (L['yellow'] / tot) / SHAPE_SHARE) * min(1, budget / max(arcs, 1)) * (.97 ** len(ks))
        res[view] = dict(arcs=arcs, connectors=conn, red=red, share=L['yellow'] / tot, kinks=len(ks), budget=budget, score=score, body=body['yellow'] / bt, flips=flips)
        drawn[view] = (all_parts, ks)
    return res, drawn

def svg(drawn, path):
    S = 110; x = 20; o = []; pal = ['#0018FF', '#00897B', '#8E24AA', '#EF6C00', '#3949AB', '#2E7D32']
    for view, (parts, ks) in drawn.items():
        pts = [q for p in parts for q in p['pts']]
        if not pts: continue
        x0, x1 = min(q[0] for q in pts), max(q[0] for q in pts); y0, y1 = min(q[1] for q in pts), max(q[1] for q in pts)
        tx = lambda q: x + (q[0]-x0)*S; ty = lambda q: 30 + (y1-q[1])*S
        o.append(f'<text x="{x}" y="20" font-family="Helvetica" font-size="15" fill="#555">{view}</text>')
        for i, p in enumerate(parts):
            c = dict(yellow='#D4A800', green='#00B050', red='#E53935')[p['kind']]
            if p['e'] and max(p['e']['rx'], p['e']['ry']) < 2.5:
                e = p['e']; o.append(f'<ellipse cx="{tx((e["cx"],0)):.1f}" cy="{ty((0,e["cy"])):.1f}" rx="{e["rx"]*S:.1f}" ry="{e["ry"]*S:.1f}" transform="rotate({-math.degrees(e["ang"]):.1f} {tx((e["cx"],0)):.1f} {ty((0,e["cy"])):.1f})" fill="none" stroke="{c}" stroke-opacity=".18"/>')
            o.append(f'<polyline points="' + ' '.join(f'{tx(q):.1f},{ty(q):.1f}' for q in p['pts']) + f'" fill="none" stroke="{c}" stroke-width="2.4"/>')
        for q in ks: o.append(f'<circle cx="{tx(q):.1f}" cy="{ty(q):.1f}" r="7" fill="none" stroke="#E53935" stroke-width="1.5"/>')
        x += (x1-x0)*S + 50
    open(path, 'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {x:.0f} 460" width="{x:.0f}" height="460" preserveAspectRatio="xMinYMin"><rect width="100%" height="100%" fill="#fff"/>' + ''.join(o) + '</svg>')

if __name__ == '__main__':
    proj = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else '.'
    spec = importlib.util.spec_from_file_location('blocks', proj + '/blocks.py'); mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    out = proj + '/trace' if os.path.exists(proj + '/trace/rims.json') else proj
    views = json.load(open(out + '/rims.json'))
    for name in (sys.argv[2:] or [k for k in views if k in mod.BLOCKS]):
        res, drawn = check(views[name], mod.BLOCKS[name], name)
        svg(drawn, f'{out}/{name}_ellipses.svg')
        for view, r in res.items():
            print(f"{name:8s}{view:6s} shapes {r['arcs']:3d} (budget {r['budget']:.0f}, {r['share']*100:3.0f}% of the line)  connectors {r['connectors']:2d}  wiggles {r['red']:2d}  kinks {r['kinks']:2d}  body {r['body']*100:3.0f}% shape, {r['flips']} bend reversals  score {r['score']:.1f}")
        print(f"{name:8s}ellipse score {min(r['score'] for r in res.values()):.1f} (worst view)")
