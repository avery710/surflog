# Fits a key chain to a part's drawn outline: moves x, y and radius until the swept circles overlap the drawing as well as possible, with a
# penalty on bends and radius changes so the curve stays simple. fit(keys, polys) returns the fitted keys and the overlap (IoU) before and after.
# keys: (x, y, r) in model units. polys: the part's drawn outline. dx, dy shift the target; a lower reg keeps more of the drawn lobes.
import math
from three_views import sample
RES = 50
def poly_mask(polys, x0, y0, w, h, dy=0, dx=0):
    M = [0] * h
    for j in range(h):
        y = y0 + (j + .5) / RES - dy; total = 0
        for poly in polys:
            xs = []
            for i in range(len(poly)):
                a, b = poly[i], poly[(i + 1) % len(poly)]
                if (a[1] > y) != (b[1] > y): xs.append(a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0]) + dx)
            xs.sort(); row = 0
            for p, q in zip(xs[::2], xs[1::2]):
                i0 = max(0, int((p - x0) * RES)); i1 = min(w, int((q - x0) * RES))
                if i1 > i0: row |= ((1 << (i1 - i0)) - 1) << i0
            total |= row
        M[j] = total
    return M
def env(keys, x0, y0, w, h, floor):
    M = [0] * h
    for q in sample([(k[0], k[1], 0, k[2], k[2]) for k in keys])[::3]:
        r = q['r']; jl = max(0, int((max(q['y'] - r, floor) - y0) * RES)); jh = min(h - 1, int((q['y'] + r - y0) * RES))
        for j in range(jl, jh + 1):
            t = r * r - (y0 + (j + .5) / RES - q['y']) ** 2
            if t <= 0: continue
            hw = math.sqrt(t); i0 = max(0, int((q['x'] - hw - x0) * RES)); i1 = min(w, int((q['x'] + hw - x0) * RES))
            if i1 > i0: M[j] |= ((1 << (i1 - i0)) - 1) << i0
    return M
def iou(a, b):
    i = u = 0
    for p, q in zip(a, b): i += (p & q).bit_count(); u += (p | q).bit_count()
    return i / (u or 1)
def fit(keys, polys, floor=-9, reg=.012, rmin=.08, dy=0, dx=0, lock=()):
    P = [p for l in polys for p in l]
    x0 = min(p[0] for p in P) - 1 + dx; y0 = min(p[1] for p in P) - 1 + dy; w = int((max(p[0] for p in P) + 1 + dx - x0) * RES); h = int((max(p[1] for p in P) + 1 + dy - y0) * RES)
    T = poly_mask(polys, x0, y0, w, h, dy, dx)
    if floor > -9:
        lim = int((floor - y0) * RES)
        for j in range(max(0, lim)): T[j] = 0
    def cost(K):
        n = len(K); pen = 0.
        for i in range(1, n - 1):
            for o, wt in ((0, 1), (1, 1), (2, 2.5)): pen += wt * (K[i - 1][o] - 2 * K[i][o] + K[i + 1][o]) ** 2
        return 1 - iou(T, env(K, x0, y0, w, h, floor)) + reg * pen
    K = [list(k) for k in keys]; start = iou(T, env(K, x0, y0, w, h, floor)); best = cost(K)
    for step in (.08, .04, .02, .01):
        for _ in range(5):
            moved = False
            for i in range(len(K)):
                for o in range(3):
                    if (i, o) in lock: continue
                    for sg in (1, -1):
                        v = K[i][o]; K[i][o] = v + sg * step
                        if o == 2 and K[i][o] < rmin: K[i][o] = v; continue
                        c = cost(K)
                        if c < best - 1e-5: best = c; moved = True; break
                        K[i][o] = v
            if not moved: break
    return K, start, iou(T, env(K, x0, y0, w, h, floor))
