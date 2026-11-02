# Helpers for posing a toy from joints. Write the toy's own rest joints and posture in its project folder, not here.
# Frame: +x = chest forward, +y = up. The rest pose is the standing toy, so a posture keeps every bone length.
import math

def Rx(a): c, s = math.cos(a), math.sin(a); return ((1, 0, 0), (0, c, -s), (0, s, c))
def Ry(a): c, s = math.cos(a), math.sin(a); return ((c, 0, s), (0, 1, 0), (-s, 0, c))
def Rz(a): c, s = math.cos(a), math.sin(a); return ((c, -s, 0), (s, c, 0), (0, 0, 1))
def mul(A, B): return tuple(tuple(sum(A[i][k] * B[k][j] for k in range(3)) for j in range(3)) for i in range(3))
def app(R, p): return tuple(sum(R[i][k] * p[k] for k in range(3)) for i in range(3))
def add(a, b): return tuple(x + y for x, y in zip(a, b))
def sub(a, b): return tuple(x - y for x, y in zip(a, b))
def scale(a, s): return tuple(x * s for x in a)
def dot(a, b): return sum(x * y for x, y in zip(a, b))
def norm(a): return math.sqrt(dot(a, a))
def unit(a): return scale(a, 1 / (norm(a) or 1))

def about(R, pivot, to):
    """A rigid move for one bone's blocks: turn by R about the rest pivot, and carry the pivot to where the parent bone left it."""
    return lambda p: add(to, app(R, sub(p, pivot)))

def two_bone(root, end, upper, lower, pole):
    """The middle joint (knee, elbow) of two fixed bones from root to end, bent towards pole. Stops if the end is out of reach."""
    d = sub(end, root); L = norm(d)
    if L > upper + lower: raise SystemExit('out of reach: %.3f > %.3f' % (L, upper + lower))
    a = (upper ** 2 - lower ** 2 + L ** 2) / (2 * L); h = math.sqrt(max(upper ** 2 - a ** 2, 0))
    u = unit(d); w = unit(sub(pole, scale(u, dot(pole, u))))
    return add(add(root, scale(u, a)), scale(w, h))

def flexion(a, b, c):
    """How far a joint is bent, in degrees: 0 when a, b and c lie in a straight line."""
    u, v = unit(sub(b, a)), unit(sub(c, b))
    return math.degrees(math.acos(max(-1, min(1, dot(u, v)))))
