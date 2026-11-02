# Minimal PNG reader (8-bit, non-interlaced) so the shape reading needs only the standard library.
import zlib, struct
def read(path):
    b = open(path, 'rb').read(); p = 8; idat = b''; plte = None
    while p < len(b):
        n, t = struct.unpack('>I4s', b[p:p+8]); d = b[p+8:p+8+n]; p += 12 + n
        if t == b'IHDR': w, h, depth, ct = struct.unpack('>IIBB', d[:10])
        elif t == b'IDAT': idat += d
        elif t == b'PLTE': plte = d
    ch = {0:1, 2:3, 3:1, 4:2, 6:4}[ct]; raw = zlib.decompress(idat); s = w * ch; rows = []; prev = bytearray(s); q = 0
    for _ in range(h):
        f = raw[q]; line = bytearray(raw[q+1:q+1+s]); q += s + 1
        for i in range(s):
            a = line[i-ch] if i >= ch else 0; u = prev[i]; c = prev[i-ch] if i >= ch else 0
            if f == 1: line[i] = (line[i] + a) & 255
            elif f == 2: line[i] = (line[i] + u) & 255
            elif f == 3: line[i] = (line[i] + (a + u) // 2) & 255
            elif f == 4:
                e = a + u - c; pa, pb, pc = abs(e-a), abs(e-u), abs(e-c)
                line[i] = (line[i] + (a if pa <= pb and pa <= pc else u if pb <= pc else c)) & 255
        rows.append(line); prev = line
    def px(x, y):
        r = rows[y]
        if ct == 3: i = r[x]*3; return plte[i], plte[i+1], plte[i+2]
        if ct in (0, 4): v = r[x*ch]; return v, v, v
        return r[x*ch], r[x*ch+1], r[x*ch+2]
    return w, h, px
