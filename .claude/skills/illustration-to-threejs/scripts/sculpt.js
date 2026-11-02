// Bakes each model: blocks with of= blend into one solid, every other block is its own closed solid with a real crease, with soft shading stored.
const fs = require('fs'), path = require('path');

function keyed(v, t) {
  if (v === undefined) return 0;
  if (typeof v === 'number') return v;
  for (let i = 0; i < v.length - 1; i++) if (t <= v[i + 1][0]) { const u = (t - v[i][0]) / (v[i + 1][0] - v[i][0]); return v[i][1] + (v[i + 1][1] - v[i][1]) * u * u * (3 - 2 * u); }
  return v[v.length - 1][1];
}
function gaussSmooth(a, sigma) {
  const r = Math.ceil(sigma * 2.5), o = new Array(a.length);
  for (let i = 0; i < a.length; i++) { let s = 0, w = 0; for (let k = -r; k <= r; k++) { const j = Math.max(0, Math.min(a.length - 1, i + k)), g = Math.exp(-k * k / (2 * sigma * sigma)); s += a[j] * g; w += g; } o[i] = s / w; }
  return o;
}

function fieldOf(cfg, strokes) {
  const floor = cfg.floor, cell = cfg.cell;
  const list = strokes.map(s => ({ sp: s.sp, crisp: s.crisp, tube: s.tube, frame: s.frame, ell: s.ell, k: Array.isArray(s.k) ? 0 : s.k, kk: Array.isArray(s.k) ? s.k : undefined }));
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const { sp } of list) for (const q of sp) { x0 = Math.min(x0, q.x - q.r); x1 = Math.max(x1, q.x + q.r); y0 = Math.min(y0, q.y - q.r); y1 = Math.max(y1, q.y + q.r); z0 = Math.min(z0, q.z - q.d); z1 = Math.max(z1, q.z + q.d); }
  const pad = .3; x0 -= pad; x1 += pad; y0 -= pad; y1 += pad; z0 -= pad; z1 += pad;
  const NX = Math.ceil((x1 - x0) / cell) + 1, NY = Math.ceil((y1 - y0) / cell) + 1, NZ = Math.ceil((z1 - z0) / cell) + 1;
  const F = new Float32Array(NX * NY * NZ).fill(1);
  list.forEach(({ sp, crisp, tube, frame, ell, k, kk }, pi) => {
    if (tube) {
      // A true round tube: spheres swept along the spine in 3D, for any limb or ear that doesn't lie in the side view.
      // With a frame, its cross-section is an ellipse: r across, d along the frame's own z (a posed ear keeps its depth from above).
      const seg = [], top = Math.max(k || 0, ...(kk || []).map(e => e[1]), .004), pad = top + .3;
      for (let s = 0; s < sp.length - 2; s += 2) seg.push([sp[s], sp[s + 2], s / (sp.length - 1)]);
      let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9, c0 = 1e9, c1 = -1e9;
      for (const q of sp) { a0 = Math.min(a0, q.x - q.r); a1 = Math.max(a1, q.x + q.r); b0 = Math.min(b0, q.y - q.r); b1 = Math.max(b1, q.y + q.r); c0 = Math.min(c0, q.z - q.r); c1 = Math.max(c1, q.z + q.r); }
      const clampI = (v, n) => Math.max(0, Math.min(n - 1, v));
      const I0 = clampI(Math.floor((a0 - pad - x0) / cell), NX), I1 = clampI(Math.ceil((a1 + pad - x0) / cell), NX), J0 = clampI(Math.floor((b0 - pad - y0) / cell), NY), J1 = clampI(Math.ceil((b1 + pad - y0) / cell), NY), Z0 = clampI(Math.floor((c0 - pad - z0) / cell), NZ), Z1 = clampI(Math.ceil((c1 + pad - z0) / cell), NZ);
      for (let zi = Z0; zi <= Z1; zi++) for (let j = J0; j <= J1; j++) for (let i = I0; i <= I1; i++) {
        const x = x0 + i * cell, y = y0 + j * cell, z = z0 + zi * cell;
        let f = 1e9, at = 0;
        for (const [a, b, t] of seg) {
          const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
          let h = ((x - a.x) * dx + (y - a.y) * dy + (z - a.z) * dz) / (dx * dx + dy * dy + dz * dz || 1e-9); h = h < 0 ? 0 : h > 1 ? 1 : h;
          const ex = x - a.x - dx * h, ey = y - a.y - dy * h, ez = z - a.z - dz * h, rr = a.r + (b.r - a.r) * h;
          let d;
          if (frame) { const s = rr / (a.d + (b.d - a.d) * h), lz = frame[0][2] * ex + frame[1][2] * ey + frame[2][2] * ez; d = Math.sqrt(Math.max(ex * ex + ey * ey + ez * ez + lz * lz * (s * s - 1), 0)) - rr; }
          else d = Math.hypot(ex, ey, ez) - rr;
          if (d < f) { f = d; at = t; }
        }
        const idx = i + NX * (j + NY * zi), c = F[idx];
        if (pi === 0) { if (f < c) F[idx] = f; continue; }
        const K = Math.max(kk ? keyed(kk, at) : k, .004), w = Math.max(K - Math.abs(c - f), 0) / K;
        F[idx] = Math.min(c, f) - w * w * w * K / 6;
      }
      return;
    }
    if (ell) {
      // A true ellipsoid: a, b in the side view, turned by deg; rho is its half-depth, a smooth table along the long axis.
      const t = ell.deg * Math.PI / 180, ct = Math.cos(t), st = Math.sin(t), T = ell.rho;
      const rho = u => { if (u <= T[0][0]) return T[0][1]; for (let i = 0; i < T.length - 1; i++) if (u <= T[i+1][0]) { let h = (u - T[i][0]) / (T[i+1][0] - T[i][0]); h = h * h * (3 - 2 * h); return T[i][1] + (T[i+1][1] - T[i][1]) * h; } return T[T.length-1][1]; };
      const K = Math.max(k || 0, .004);
      for (let zi = 0; zi < NZ; zi++) for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
        let x = x0 + i * cell - ell.cx, y = y0 + j * cell - ell.cy, z = z0 + zi * cell - (ell.z || 0);
        if (ell.rot) { const q = ell.rot, X = q[0][0] * x + q[1][0] * y + q[2][0] * z, Y = q[0][1] * x + q[1][1] * y + q[2][1] * z, Z = q[0][2] * x + q[1][2] * y + q[2][2] * z; x = X; y = Y; z = Z; }
        const u = x * ct + y * st, v = -x * st + y * ct, R = rho(u), a2 = ell.a * ell.a, b2 = ell.b * ell.b, R2 = R * R;
        const q2 = u * u / a2 + v * v / b2 + z * z / R2, q = Math.sqrt(q2);
        const g = Math.sqrt(u * u / (a2 * a2) + v * v / (b2 * b2) + z * z / (R2 * R2));
        const f = g > 1e-5 ? q * (q - 1) / g : -Math.min(ell.a, ell.b, R);
        const idx = i + NX * (j + NY * zi), c = F[idx];
        if (pi === 0) { if (f < c) F[idx] = f; continue; }
        const w = Math.max(K - Math.abs(c - f), 0) / K;
        F[idx] = Math.min(c, f) - w * w * w * K / 6;
      }
      return;
    }
    let bx0 = 1e9, bx1 = -1e9, by0 = 1e9, by1 = -1e9;
    for (const q of sp) { bx0 = Math.min(bx0, q.x - q.r); bx1 = Math.max(bx1, q.x + q.r); by0 = Math.min(by0, q.y - q.r); by1 = Math.max(by1, q.y + q.r); }
    const m = .22, I0 = Math.max(0, Math.floor((bx0 - m - x0) / cell)), I1 = Math.min(NX - 1, Math.ceil((bx1 + m - x0) / cell)), J0 = Math.max(0, Math.floor((by0 - m - y0) / cell)), J1 = Math.min(NY - 1, Math.ceil((by1 + m - y0) / cell));
    // Per column: how far from the spine, and the local radius, depth and centre. Smoothed so a bend in a block leaves no crease.
    const W = I1 - I0 + 1, HH = J1 - J0 + 1, TU = new Float32Array(W * HH), TR = new Float32Array(W * HH), TZ = new Float32Array(W * HH), TD = new Float32Array(W * HH), TK = new Float32Array(W * HH);
    for (let j = J0; j <= J1; j++) for (let i = I0; i <= I1; i++) {
      const x = x0 + i * cell, y = y0 + j * cell;
      let u = 1e9, a = 0, b = 0;
      for (let s = 0; s < sp.length - 1; s += 2) {
        const p = sp[s], d = Math.hypot(x - p.x, y - p.y) / p.r;
        if (d < u) { u = d; a = s; }
      }
      const lo = Math.max(0, a - 2), hi = Math.min(sp.length - 2, a + 1);
      for (let s = lo; s <= hi; s++) {
        const p = sp[s], q = sp[s + 1], dx = q.x - p.x, dy = q.y - p.y;
        let h = ((x - p.x) * dx + (y - p.y) * dy) / (dx * dx + dy * dy || 1e-9); h = h < 0 ? 0 : h > 1 ? 1 : h;
        const r = p.r + (q.r - p.r) * h, d = Math.hypot(x - p.x - dx * h, y - p.y - dy * h) / r;
        if (s === lo || d < u) { u = d; a = s; b = h; }
      }
      const n = (i - I0) + (j - J0) * W, P = sp[a], Q = sp[Math.min(sp.length - 1, a + 1)];
      TU[n] = u; TR[n] = P.r + (Q.r - P.r) * b; TZ[n] = P.z + (Q.z - P.z) * b; TD[n] = P.d + (Q.d - P.d) * b;
      TK[n] = Math.max(kk ? keyed(kk, a / (sp.length - 1)) : k, .004);
    }
    const meanR = sp.reduce((s, q) => s + q.r, 0) / sp.length, rad = crisp ? 1 : Math.max(1, Math.round(Math.min(.17, meanR * .3) / cell));
    const flat = (T) => {
      let A = T, B = new Float32Array(T.length);
      for (let pass = 0; pass < 2; pass++) {
        for (let y = 0; y < HH; y++) { let s = 0; for (let e = -rad; e <= rad; e++) s += A[Math.min(W - 1, Math.max(0, e)) + y * W]; for (let x = 0; x < W; x++) { B[x + y * W] = s / (2 * rad + 1); s += A[Math.min(W - 1, x + rad + 1) + y * W] - A[Math.max(0, x - rad) + y * W]; } }
        [A, B] = [B, A === T ? new Float32Array(T.length) : A];
        for (let x = 0; x < W; x++) { let s = 0; for (let e = -rad; e <= rad; e++) s += A[x + Math.min(HH - 1, Math.max(0, e)) * W]; for (let y = 0; y < HH; y++) { B[x + y * W] = s / (2 * rad + 1); s += A[x + Math.min(HH - 1, y + rad + 1) * W] - A[x + Math.max(0, y - rad) * W]; } }
        [A, B] = [B, A];
      }
      return A;
    };
    const SU = flat(TU), SR = flat(TR), SZ = flat(TZ), SD = flat(TD), SK = flat(TK);
    for (let j = J0; j <= J1; j++) for (let i = I0; i <= I1; i++) {
      const n = (i - I0) + (j - J0) * W, u = SU[n], r = SR[n], zc = SZ[n], dp = SD[n], K = SK[n];
      for (let zi = 0; zi < NZ; zi++) {
        const dz = z0 + zi * cell - zc, qq = Math.sqrt(u * u + dz * dz / (dp * dp)), g = Math.sqrt(u * u / (r * r) + dz * dz / (dp * dp * dp * dp));
        const f = g > 1e-5 ? qq * (qq - 1) / g : -Math.min(r, dp);
        const idx = i + NX * (j + NY * zi), c = F[idx];
        if (pi === 0) { if (f < c) F[idx] = f; continue; }
        const w = Math.max(K - Math.abs(c - f), 0) / K;
        F[idx] = Math.min(c, f) - w * w * w * K / 6;
      }
    }
  });
  // The soles sit flat on the board.
  const fk = .07;
  for (let zi = 0; zi < NZ; zi++) for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const idx = i + NX * (j + NY * zi), a = F[idx], b = floor - (y0 + j * cell), w = Math.max(fk - Math.abs(a - b), 0) / fk;
    F[idx] = Math.max(a, b) + w * w * fk * .25;
  }
  const small = list.every(({ sp }) => sp.reduce((a, q) => a + q.r, 0) / sp.length < .12);
  return { F: small ? soften(F, NX, NY, NZ, 1, 1) : soften(F, NX, NY, NZ, 2, 2), nx: NX, ny: NY, nz: NZ, min: [x0, y0, z0], cell };
}

const RAYS = [];
for (let i = 0; i < 48; i++) {
  const y = 1 - (i + .5) / 48 * 2, r = Math.sqrt(1 - y * y), ph = i * 2.39996;
  RAYS.push([r * Math.cos(ph), y, r * Math.sin(ph)]);
}
const STEPS = [.03, .06, .1, .16, .24, .36, .52, .75];
function contactOf(P, N, sample, floorY) {
  // How much the toy darkens the deck beneath it: a soft contact shadow.
  let contact = null;
  {
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (let v = 0; v < N; v++) { x0 = Math.min(x0, P[v*3]); x1 = Math.max(x1, P[v*3]); z0 = Math.min(z0, P[v*3+2]); z1 = Math.max(z1, P[v*3+2]); }
    const pad = .34; x0 -= pad; x1 += pad; z0 -= pad; z1 += pad;
    const res = 64, W = Math.ceil((x1 - x0) * res), H = Math.ceil((z1 - z0) * res), A = new Float32Array(W * H), UP = RAYS.filter(R => R[1] > .05);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const x = x0 + (i + .5) / res, z = z0 + (j + .5) / res;
      let got = 0, all = 0;
      for (const R of UP) {
        let vis = 1;
        for (const s of STEPS) { if (s > .3) break; vis = Math.min(vis, Math.max(0, sample(x + R[0] * s, floorY + .012 + R[1] * s, z + R[2] * s)) / (s * .42)); if (vis <= .01) break; }
        got += R[1] * Math.min(1, vis); all += R[1];
      }
      { const ex = Math.min(i, W - 1 - i) / (pad * res), ez = Math.min(j, H - 1 - j) / (pad * res), edge = Math.min(1, Math.min(ex, ez)); A[i + j * W] = Math.max(0, 1 - got / all - .04) * edge * edge * (3 - 2 * edge); }
    }
    for (let p = 0; p < 2; p++) { const q = new Float32Array(A); for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) A[i + j * W] = (q[i + j * W] * 4 + q[i - 1 + j * W] + q[i + 1 + j * W] + q[i + (j - 1) * W] + q[i + (j + 1) * W]) / 8; }
    contact = { x0, x1, z0, z1, W, H, y: floorY, a: Buffer.from(Uint8Array.from(A, v => Math.round(Math.min(1, v) * 255))).toString('base64') };
  }
  return contact;
}

function samplerOf(f) {
  const at = (i, j, k) => i + f.nx * (j + f.ny * k), [mx, my, mz] = f.min, c = f.cell, F = f.F, X = f.nx - 1, Y = f.ny - 1, Z = f.nz - 1;
  return (x, y, z) => {
    const fx = (x - mx) / c, fy = (y - my) / c, fz = (z - mz) / c, i = Math.floor(fx), j = Math.floor(fy), k = Math.floor(fz);
    if (i < 0 || j < 0 || k < 0 || i >= X || j >= Y || k >= Z) return 1;
    const a = fx - i, b = fy - j, d = fz - k;
    let v = 0;
    for (let q = 0; q < 8; q++) v += F[at(i + (q & 1), j + ((q >> 1) & 1), k + ((q >> 2) & 1))] * ((q & 1) ? a : 1 - a) * ((q & 2) ? b : 1 - b) * ((q & 4) ? d : 1 - d);
    return v;
  };
}

// One closed solid per block, no blending: a part goes into the body and the crease is real. Shading in a crease reads every solid.
function sculpt(cfg) {
  const groups = [];
  for (const st of cfg.strokes) { const host = st.of && (groups.find(g => g[0].n === st.of && g[0].twin === st.twin) || groups.find(g => g[0].n === st.of)); if (host) host.push(st); else groups.push([st]); }
  const names = groups.map(g => g[0].n), fields = groups.map(g => fieldOf(cfg, g)), S = fields.map(samplerOf);
  const union = (x, y, z) => { let v = 1; for (const s of S) { const f = s(x, y, z); if (f < v) v = f; } return v; };
  const meshes = fields.map(f => nets(f.F, f.nx, f.ny, f.nz, f.min, f.cell, cfg.floor, union));
  console.log('  per solid:', meshes.map((m, i) => names[i] + ' jumps ' + m.jumps + ' dents ' + m.dents).join(', '));
  let N = 0, T = 0; for (const m of meshes) { N += m.N; T += m.idx.length; }
  const P = new Float32Array(N * 3), nrm = new Float32Array(N * 3), ao = new Float32Array(N), idx = new Array(T), part = new Uint8Array(N);
  let vo = 0, to = 0, ripple = 0;
  meshes.forEach((m, pi) => {
    P.set(m.P, vo * 3); nrm.set(m.nrm, vo * 3); ao.set(m.ao, vo); part.fill(pi, vo, vo + m.N);
    for (let t = 0; t < m.idx.length; t++) idx[to + t] = m.idx[t] + vo;
    vo += m.N; to += m.idx.length; ripple += m.ripple * m.ripple * m.N;
  });
  // Every part must really be pressed into something, and still show most of itself.
  const seats = meshes.map((m, pi) => {
    if (pi === 0) return null;
    let inside = 0, deep = 0;
    for (let v = 0; v < m.N; v++) { let o = 1; S.forEach((s, q) => { if (q !== pi) { const f = s(m.P[v*3], m.P[v*3+1], m.P[v*3+2]); if (f < o) o = f; } }); if (o < 0) inside++; if (o < deep) deep = o; }
    return { n: names[pi], hidden: inside / m.N, deep: -deep };
  }).filter(Boolean);
  return { P, idx, ao, N, nrm, part, names, seats, face: S[0],
    contact: contactOf(P, N, union, cfg.floor), pieces: meshes.map(m => m.pieces.length), dents: meshes.reduce((a, m) => a + m.dents, 0), ripple: Math.sqrt(ripple / N), jumps: meshes.reduce((a, m) => a + m.jumps, 0),
    open: meshes.reduce((a, m) => a + m.open, 0), over: meshes.reduce((a, m) => a + m.over, 0), folded: meshes.reduce((a, m) => a + m.folded, 0) };
}

function soften(F, nx, ny, nz, r, passes) {
  let A = F, B = new Float32Array(F.length);
  const w = 2 * r + 1;
  const run = (src, dst, n, stride, lines, lineStride1, lineStride2, count2) => {
    for (let b = 0; b < count2; b++) for (let a = 0; a < lines; a++) {
      const o = a * lineStride1 + b * lineStride2;
      let s = 0;
      for (let i = -r; i <= r; i++) s += src[o + Math.min(n - 1, Math.max(0, i)) * stride];
      for (let i = 0; i < n; i++) {
        dst[o + i * stride] = s / w;
        s += src[o + Math.min(n - 1, i + r + 1) * stride] - src[o + Math.max(0, i - r) * stride];
      }
    }
  };
  for (let p = 0; p < passes; p++) {
    run(A, B, nx, 1, ny, nx, nx * ny, nz); [A, B] = [B, A === F ? new Float32Array(F.length) : A];
    run(A, B, ny, nx, nx, 1, nx * ny, nz); [A, B] = [B, A];
    run(A, B, nz, nx * ny, nx, 1, nx, ny); [A, B] = [B, A];
  }
  return A;
}

function nets(F, nx, ny, nz, min, cell, floorY, world) {
  const at = (i, j, k) => i + nx * (j + ny * k), cid = (i, j, k) => i + (nx - 1) * (j + (ny - 1) * k);
  const map = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1), pos = [], idx = [], c = new Float32Array(8);
  const E = [[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]];
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let mask = 0;
    for (let b = 0; b < 8; b++) { c[b] = F[at(i + (b & 1), j + ((b >> 1) & 1), k + ((b >> 2) & 1))]; if (c[b] < 0) mask |= 1 << b; }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [p, q] of E) {
      const a = c[p], b = c[q]; if ((a < 0) === (b < 0)) continue;
      const f = a / (a - b);
      sx += (p & 1) + ((q & 1) - (p & 1)) * f; sy += ((p >> 1) & 1) + (((q >> 1) & 1) - ((p >> 1) & 1)) * f; sz += ((p >> 2) & 1) + (((q >> 2) & 1) - ((p >> 2) & 1)) * f; n++;
    }
    map[cid(i, j, k)] = pos.length / 3;
    pos.push(min[0] + (i + sx / n) * cell, min[1] + (j + sy / n) * cell, min[2] + (k + sz / n) * cell);
  }
  const quad = (a, b, d, e, flip) => { if (a < 0 || b < 0 || d < 0 || e < 0) return; if (flip) idx.push(a, e, d, a, d, b); else idx.push(a, b, d, a, d, e); };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const v = F[at(i, j, k)] < 0;
    if (v !== (F[at(i + 1, j, k)] < 0)) quad(map[cid(i, j - 1, k - 1)], map[cid(i, j, k - 1)], map[cid(i, j, k)], map[cid(i, j - 1, k)], !v);
    if (v !== (F[at(i, j + 1, k)] < 0)) quad(map[cid(i - 1, j, k - 1)], map[cid(i - 1, j, k)], map[cid(i, j, k)], map[cid(i, j, k - 1)], !v);
    if (v !== (F[at(i, j, k + 1)] < 0)) quad(map[cid(i - 1, j - 1, k)], map[cid(i, j - 1, k)], map[cid(i, j, k)], map[cid(i - 1, j, k)], !v);
  }
  // Taubin smoothing: removes the grid's texture without shrinking the form.
  const N = pos.length / 3, nbr = Array.from({ length: N }, () => new Set());
  for (let t = 0; t < idx.length; t += 3) for (let s = 0; s < 3; s++) { nbr[idx[t + s]].add(idx[t + (s + 1) % 3]); nbr[idx[t + s]].add(idx[t + (s + 2) % 3]); }
  const P = Float32Array.from(pos), step = (l) => {
    const Q = new Float32Array(P);
    for (let v = 0; v < N; v++) {
      let x = 0, y = 0, z = 0, n = nbr[v].size; if (!n) continue;
      for (const w of nbr[v]) { x += Q[w * 3]; y += Q[w * 3 + 1]; z += Q[w * 3 + 2]; }
      P[v * 3] += (x / n - Q[v * 3]) * l; P[v * 3 + 1] += (y / n - Q[v * 3 + 1]) * l; P[v * 3 + 2] += (z / n - Q[v * 3 + 2]) * l;
    }
  };
  for (let i = 0; i < 40; i++) { step(.55); step(-.57); }
  // Vertex normals, then soft shading in creases, read from the distance field along each normal.
  const Nn = new Float32Array(N * 3);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], d = idx[t + 2];
    const ux = P[b*3]-P[a*3], uy = P[b*3+1]-P[a*3+1], uz = P[b*3+2]-P[a*3+2], vx = P[d*3]-P[a*3], vy = P[d*3+1]-P[a*3+1], vz = P[d*3+2]-P[a*3+2];
    const x = uy*vz-uz*vy, y = uz*vx-ux*vz, z = ux*vy-uy*vx;
    for (const w of [a, b, d]) { Nn[w*3] += x; Nn[w*3+1] += y; Nn[w*3+2] += z; }
  }
  const sample = (x, y, z) => {
    const fx = (x - min[0]) / cell, fy = (y - min[1]) / cell, fz = (z - min[2]) / cell;
    const i = Math.floor(fx), j = Math.floor(fy), k = Math.floor(fz);
    if (i < 0 || j < 0 || k < 0 || i >= nx - 1 || j >= ny - 1 || k >= nz - 1) return 1;
    const a = fx - i, b = fy - j, c2 = fz - k;
    let v = 0;
    for (let q = 0; q < 8; q++) v += F[at(i + (q & 1), j + ((q >> 1) & 1), k + ((q >> 2) & 1))] * ((q & 1) ? a : 1 - a) * ((q & 2) ? b : 1 - b) * ((q & 4) ? c2 : 1 - c2);
    return v;
  };
  let Grad = new Float32Array(N * 3);
  { const e = cell * 1.3;
    for (let v = 0; v < N; v++) {
      const x = P[v*3], y = P[v*3+1], z = P[v*3+2];
      const gx = sample(x + e, y, z) - sample(x - e, y, z), gy = sample(x, y + e, z) - sample(x, y - e, z), gz = sample(x, y, z + e) - sample(x, y, z - e), l = Math.hypot(gx, gy, gz) || 1;
      Grad[v*3] = gx / l; Grad[v*3+1] = gy / l; Grad[v*3+2] = gz / l;
    }
    for (let pass = 0; pass < 4; pass++) {
      const q = new Float32Array(Grad);
      for (let v = 0; v < N; v++) {
        let x = q[v*3], y = q[v*3+1], z = q[v*3+2];
        for (const w of nbr[v]) { x += q[w*3]; y += q[w*3+1]; z += q[w*3+2]; }
        const l = Math.hypot(x, y, z) || 1; Grad[v*3] = x / l; Grad[v*3+1] = y / l; Grad[v*3+2] = z / l;
      }
    }
  }
  let ao = new Float32Array(N);
  const RAYS = [];
  for (let i = 0; i < 48; i++) {
    const y = 1 - (i + .5) / 48 * 2, r = Math.sqrt(1 - y * y), ph = i * 2.39996;
    RAYS.push([r * Math.cos(ph), y, r * Math.sin(ph)]);
  }
  const STEPS = [.03, .06, .1, .16, .24, .36, .52, .75];
  for (let v = 0; v < N; v++) {
    const l = Math.hypot(Nn[v*3], Nn[v*3+1], Nn[v*3+2]) || 1, nx = Nn[v*3]/l, ny = Nn[v*3+1]/l, nz = Nn[v*3+2]/l;
    const px = P[v*3] + nx * .012, py = P[v*3+1] + ny * .012, pz = P[v*3+2] + nz * .012;
    let got = 0, all = 0;
    for (const R of RAYS) {
      const c = R[0] * nx + R[1] * ny + R[2] * nz;
      if (c <= .02) continue;
      const w = c * (.42 + .58 * Math.max(0, R[1] * .5 + .5));
      let vis = 1;
      for (const s of STEPS) {
        const qy = py + R[1] * s, f = world(px + R[0] * s, qy, pz + R[2] * s);
        vis = Math.min(vis, Math.max(0, f) / (s * .42));
        if (floorY !== undefined && qy < floorY) { vis = Math.min(vis, .55); break; }
        if (vis <= .01) break;
      }
      got += w * Math.min(1, vis); all += w;
    }
    ao[v] = Math.max(.12, got / all);
  }
  for (let pass = 0; pass < 3; pass++) {
    const q = new Float32Array(ao);
    for (let v = 0; v < N; v++) { let s = q[v], n = 1; for (const w of nbr[v]) { s += q[w]; n++; } ao[v] = s / n; }
  }
  const parent = new Int32Array(N).map((_, i) => i);
  const find = a => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  for (let t = 0; t < idx.length; t += 3) { const a = find(idx[t]); parent[find(idx[t + 1])] = a; parent[find(idx[t + 2])] = a; }
  const sizes = {};
  for (let v = 0; v < N; v++) { const r = find(v); sizes[r] = (sizes[r] || 0) + 1; }
  const pieces = Object.values(sizes).sort((a, b) => b - a);
  if (pieces.length > 1) {
    const box = {};
    for (let v = 0; v < N; v++) { const r = find(v), q = box[r] || (box[r] = [1e9, -1e9, 1e9, -1e9, 1e9, -1e9]); for (let o = 0; o < 3; o++) { q[o * 2] = Math.min(q[o * 2], P[v * 3 + o]); q[o * 2 + 1] = Math.max(q[o * 2 + 1], P[v * 3 + o]); } }
    Object.keys(sizes).forEach(r => console.log('  piece', sizes[r], 'x', box[r][0].toFixed(2), box[r][1].toFixed(2), 'y', box[r][2].toFixed(2), box[r][3].toFixed(2), 'z', box[r][4].toFixed(2), box[r][5].toFixed(2)));
  }
  // Broken faces: open or over-shared edges, and triangles folded against the surface direction.
  const edges = new Map(); let folded = 0;
  for (let i = 0; i < idx.length; i += 3) {
    const tri = [idx[i], idx[i + 1], idx[i + 2]];
    for (let s = 0; s < 3; s++) { const a = Math.min(tri[s], tri[(s + 1) % 3]), b = Math.max(tri[s], tri[(s + 1) % 3]), key = a * N + b; edges.set(key, (edges.get(key) || 0) + 1); }
    const [a, b, d] = tri;
    const ux = P[b*3]-P[a*3], uy = P[b*3+1]-P[a*3+1], uz = P[b*3+2]-P[a*3+2], vx = P[d*3]-P[a*3], vy = P[d*3+1]-P[a*3+1], vz = P[d*3+2]-P[a*3+2];
    const nx = uy*vz-uz*vy, ny = uz*vx-ux*vz, nz = ux*vy-uy*vx, gx = Grad[a*3]+Grad[b*3]+Grad[d*3], gy = Grad[a*3+1]+Grad[b*3+1]+Grad[d*3+1], gz = Grad[a*3+2]+Grad[b*3+2]+Grad[d*3+2];
    if (nx*gx + ny*gy + nz*gz <= 0) folded++;
  }
  let open = 0, over = 0;
  for (const [key, c] of edges) { if (c === 1) open++; else if (c > 2) { over++; const v = Math.floor(key / N); console.log('  shared edge at', P[v*3].toFixed(2), P[v*3+1].toFixed(2), P[v*3+2].toFixed(2)); } }
  // How simple the surface is: separate concave patches (dents, creases) and fine ripple in curvature.
  const Hc = new Float32Array(N);
  for (let v = 0; v < N; v++) {
    let x = 0, y = 0, z = 0, n = nbr[v].size; if (!n) continue;
    for (const w of nbr[v]) { x += P[w*3] - P[v*3]; y += P[w*3+1] - P[v*3+1]; z += P[w*3+2] - P[v*3+2]; }
    Hc[v] = 4 * (x * Grad[v*3] + y * Grad[v*3+1] + z * Grad[v*3+2]) / n / (cell * cell);
  }
  const relax = (a, it) => { let o = a; for (let p = 0; p < it; p++) { const q = new Float32Array(o); for (let v = 0; v < N; v++) { let s = q[v], n = 1; for (const w of nbr[v]) { s += q[w]; n++; } o[v] = s / n; } } return o; };
  const H2 = relax(Float32Array.from(Hc), 3), H3 = relax(Float32Array.from(H2), 12);
  let rip = 0; for (let v = 0; v < N; v++) rip += (H2[v] - H3[v]) ** 2; rip = Math.sqrt(rip / N);
  let jumps = 0;
  for (let v = 0; v < N; v++) if (Math.abs(H2[v] - H3[v]) > 3.5) jumps++;
  const seen = new Uint8Array(N); let dents = 0;
  for (let v = 0; v < N; v++) {
    if (seen[v] || H2[v] < 2.5) continue;
    const st = [v]; seen[v] = 1; let size = 0;
    while (st.length) { const a = st.pop(); size++; for (const w of nbr[a]) if (!seen[w] && H2[w] >= 2.5) { seen[w] = 1; st.push(w); } }
    if (size >= 25) dents++;
  }
  // Where the surface is rough: connected patches of curvature change above a low threshold (SURF_DEBUG=1), biggest first.
  if (process.env.SURF_DEBUG) {
    const mark = new Uint8Array(N), out = [];
    for (let v = 0; v < N; v++) {
      if (mark[v] || Math.abs(H2[v] - H3[v]) < 1.4) continue;
      const st = [v]; mark[v] = 1; let c = 0, sx = 0, sy = 0, sz = 0, peak = 0;
      while (st.length) { const a = st.pop(); c++; sx += P[a*3]; sy += P[a*3+1]; sz += P[a*3+2]; peak = Math.max(peak, Math.abs(H2[a] - H3[a])); for (const w of nbr[a]) if (!mark[w] && Math.abs(H2[w] - H3[w]) >= 1.4) { mark[w] = 1; st.push(w); } }
      if (c >= 6) out.push([c, +(sx/c).toFixed(2), +(sy/c).toFixed(2), +(sz/c).toFixed(2), +peak.toFixed(1)]);
    }
    out.sort((a, b) => b[0] - a[0]);
    console.log('  rough patches [verts, x, y, z, peak]:', JSON.stringify(out.slice(0, 16)));
  }
  return { P, idx, ao, N, sample, pieces, nrm: Grad, dents, ripple: rip, jumps, open, over, folded };
}

// Colour zones baked per vertex: soft-edged, and they add no shape. pale = volumes passing through the surface, warm and dark = named blocks.
function zones(m, cfg) {
  const dense = keys => { const o = []; for (let i = 0; i < keys.length - 1; i++) for (let s = 0; s < 96; s++) { const u = s / 96, A = keys[i], B = keys[i + 1]; o.push({ x: A[0] + (B[0] - A[0]) * u, y: A[1] + (B[1] - A[1]) * u, z: A[2] + (B[2] - A[2]) * u, r: A[3] + (B[3] - A[3]) * u, d: A[4] + (B[4] - A[4]) * u }); } const L = keys[keys.length - 1]; o.push({ x: L[0], y: L[1], z: L[2], r: L[3], d: L[4] }); return o; };
  // Roughly how far outside a chain a point is, in model units: negative inside.
  const away = (chains, x, y, z) => { let best = 1e9; for (const sp of chains) for (const q of sp) { const n = Math.hypot((x - q.x) / q.r, (y - q.y) / q.r, (z - q.z) / q.d), u = (n - 1) * Math.min(q.r, q.d); if (u < best) best = u; } return best; };
  // Stored as signed distance so the shader can draw one clean edge at any resolution.
  const Z = cfg.zones, pale = Z.pale.map(c => dense(c.keys)), out = new Uint8Array(m.N * 3);
  const put = u => Math.round(255 * Math.min(1, Math.max(0, (u + .1) / .2)));
  // Each part is one colour with a clean edge at its crease; only the body carries the soft pale volume.
  for (let v = 0; v < m.N; v++) {
    const n = m.names[m.part[v]], x = m.P[v * 3], y = m.P[v * 3 + 1], z = m.P[v * 3 + 2];
    out[v * 3] = m.part[v] === 0 ? put(away(pale, x, y, z)) : 255; out[v * 3 + 1] = Z.dark.includes(n) ? 0 : 255; out[v * 3 + 2] = Z.warm.includes(n) ? 0 : 255;
  }
  return out;
}

function encode(m) {
  let min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
  for (let v = 0; v < m.N; v++) for (let o = 0; o < 3; o++) { min[o] = Math.min(min[o], m.P[v*3+o]); max[o] = Math.max(max[o], m.P[v*3+o]); }
  const q = new Uint16Array(m.N * 3), s = max.map((a, o) => (a - min[o]) / 65535 || 1);
  for (let v = 0; v < m.N; v++) for (let o = 0; o < 3; o++) q[v*3+o] = Math.round((m.P[v*3+o] - min[o]) / s[o]);
  const Idx = m.N < 65536 ? Uint16Array.from(m.idx) : Uint32Array.from(m.idx);
  const ao = Uint8Array.from(m.ao, a => Math.round(a * 255));
  const b64 = a => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');
  const out = { min, s, wide: m.N >= 65536, pos: b64(q), idx: b64(Idx), ao: b64(ao), n: m.N };
  if (m.nrm) out.nrm = b64(Int16Array.from(m.nrm, a => Math.round(a * 32767)));
  if (m.contact) out.contact = m.contact;
  if (m.zone) out.zone = b64(m.zone);
  return out;
}

// A small patch that follows the surface: it can't stick out or smear, from any angle.
const DOME = .4;
function decal(sample, spec, side, item, lift) {
  const grad = (x, y, z) => {
    const e = .006;
    const g = [sample(x + e, y, z) - sample(x - e, y, z), sample(x, y + e, z) - sample(x, y - e, z), sample(x, y, z + e) - sample(x, y, z - e)];
    const l = Math.hypot(g[0], g[1], g[2]) || 1;
    return [g[0] / l, g[1] / l, g[2] / l];
  };
  const [x, y] = spec.at;
  let z = side * 1.4, found = false;
  for (let s = 0; s < 800; s++) { if (sample(x, y, z) < 0) { found = true; break; } z -= side * .004; }
  if (!found) throw new Error('eye misses the head at ' + spec.at);
  const n = grad(x, y, z);
  const ux = 1 - n[0] * n[0], uy = -n[0] * n[1], uz = -n[0] * n[2], ul = Math.hypot(ux, uy, uz) || 1;
  const u = [ux / ul, uy / ul, uz / ul];
  let v = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
  if (v[1] < 0) v = v.map(a => -a);
  const tilt = item.tilt || 0, ct = Math.cos(tilt), st = Math.sin(tilt);
  const RINGS = 16, SEG = 44, P = [], idx = [];
  // Eyes are low domes, a bit 立體 rather than flush: one flattened ellipsoid set into the head, so its outline stays a clean curve at any angle.
  // Everything on an eye rides on the dome of its first item.
  const base = spec.items[0], bt = -(base.tilt || 0), bc = Math.cos(bt), bs = Math.sin(bt);
  const H = spec.dome !== undefined ? spec.dome : DOME * Math.min(base.rx, base.ry);
  // How far the head falls away from the tangent plane under the rim: the ellipsoid sinks by that much, so only H of it stands proud.
  let sink = 0;
  for (let s = 0; s < SEG; s++) {
    const an = s / SEG * Math.PI * 2, a = Math.cos(an) * base.rx, b = Math.sin(an) * base.ry;
    let t = 0;
    for (; t < .3; t += .002) if (sample(x + u[0] * a + v[0] * b - n[0] * t, y + u[1] * a + v[1] * b - n[1] * t, z + u[2] * a + v[2] * b - n[2] * t) < 0) break;
    sink += t / SEG;
  }
  const dome = (ax, bx) => {
    const ox = ax - (base.dx || 0), oy = bx - (base.dy || 0), a = (ox * bc - oy * bs) / base.rx, b = (ox * bs + oy * bc) / base.ry;
    return (H + sink) * Math.sqrt(Math.max(0, 1 - a * a - b * b)) - sink;
  };
  const own = item === base ? 0 : .25 * Math.min(item.rx, item.ry);
  const put = (a, b, rho) => {
    const ax = a * ct - b * st + (item.dx || 0), bx = a * st + b * ct + (item.dy || 0);
    // The rim goes on down under what it sits on, so no gap shows from the side.
    let h = dome(ax, bx) + (item === base ? 0 : lift - .004 + own * Math.sqrt(Math.max(0, 1 - rho * rho))) - (rho >= 1 ? (item === base ? .05 : .006) : 0);
    // A flush eye is set into the body: every point lies on the surface itself, nothing stands proud.
    if (spec.flush) {
      const px = x + u[0] * ax + v[0] * bx, py = y + u[1] * ax + v[1] * bx, pz = z + u[2] * ax + v[2] * bx, at = t => sample(px + n[0] * t, py + n[1] * t, pz + n[2] * t);
      let hi = .16; while (hi > -.16 && at(hi - .01) >= 0) hi -= .01;
      let lo = hi - .01; for (let s = 0; s < 14; s++) { const c = (hi + lo) / 2; if (at(c) >= 0) hi = c; else lo = c; }
      h = hi + (spec.meshLift || 0) + lift - (rho >= 1 ? .004 : 0);
    }
    P.push(x + u[0] * ax + v[0] * bx + n[0] * h, y + u[1] * ax + v[1] * bx + n[1] * h, z + u[2] * ax + v[2] * bx + n[2] * h);
  };
  put(0, 0, 0);
  for (let r = 1; r <= RINGS; r++) for (let s = 0; s < SEG; s++) {
    const rho = Math.sin(r / RINGS * Math.PI / 2), an = s / SEG * Math.PI * 2, a = Math.cos(an) * item.rx * rho;
    let b = Math.sin(an) * item.ry * rho;
    if (item.lid !== undefined) b = Math.min(b, item.ry * item.lid);
    put(a, b, r === RINGS ? 1 : rho);
  }
  for (let s = 0; s < SEG; s++) idx.push(0, 1 + s, 1 + (s + 1) % SEG);
  for (let r = 0; r < RINGS - 1; r++) for (let s = 0; s < SEG; s++) {
    const a = 1 + r * SEG + s, b = 1 + r * SEG + (s + 1) % SEG, c = a + SEG, d = b + SEG;
    idx.push(a, c, d, a, d, b);
  }
  return { P: Float32Array.from(P), idx, N: P.length / 3, ao: new Float32Array(P.length / 3).fill(1) };
}

// node sculpt.js <project>: reads model.json, views.json and features.json, writes baked.json.
// Exits 1 if a solid splits into pieces, has open, over-shared or folded faces, or a part is barely pressed in.
const proj = path.resolve(process.argv[2]);
const MODEL = JSON.parse(fs.readFileSync(proj + '/model.json'));
const VIEWS = JSON.parse(fs.readFileSync(proj + '/views.json'));
const FEATURES = JSON.parse(fs.readFileSync(proj + '/features.json'));
const out = {}, failures = [];
for (const name of Object.keys(MODEL)) {
  const cfg = MODEL[name], m = sculpt(cfg), f = FEATURES[name] || {};
  if (cfg.zones) m.zone = zones(m, cfg);
  console.log(name, 'solids:', m.pieces.length, '| broken faces: open', m.open, 'shared', m.over, 'folded', m.folded, '| dents', m.dents, '| ripple', m.ripple.toFixed(2), '| curvature jumps', m.jumps);
  if (m.pieces.some(p => p !== 1)) failures.push(name + ': a solid split into pieces: ' + m.pieces.join(', '));
  if (m.open || m.over || m.folded) failures.push(name + ' has broken faces');
  for (const q of m.seats) { console.log('  ' + q.n.padEnd(9), 'hidden in the body', (q.hidden * 100).toFixed(0) + '%', 'deepest', q.deep.toFixed(3)); if (q.deep < .03) failures.push(name + ': ' + q.n + ' is barely pressed in'); }
  const decals = [];
  for (const spec of f.eyes || []) for (const side of (spec.mirror ? [1, -1] : [1])) spec.items.forEach((item, i) => {
    // A flush eye lies on the moulded mesh you see, not on the field behind it.
    if (spec.flush) { let s = 0, c = 0; for (let v = 0; v < m.N; v++) if (m.part[v] === 0 && m.P[v*3+2] * side > 0 && Math.hypot(m.P[v*3] - spec.at[0], m.P[v*3+1] - spec.at[1]) < .22) { s += m.face(m.P[v*3], m.P[v*3+1], m.P[v*3+2]); c++; } spec.meshLift = s / c; }
    decals.push({ c: item.c, set: spec.set, mesh: encode(decal(m.face, spec, side, item, spec.flush ? .0012 + i * .0012 : .007 + i * .004)) });
  });
  out[name] = { ...f, mesh: { fur: encode(m) }, decals, views: VIEWS[name], mask: VIEWS[name].side };
  if (cfg.paint) out[name].paint = cfg.paint;
}
if (failures.length) { console.error('FAILED CHECKS:\n' + failures.join('\n')); process.exitCode = 1; }
fs.writeFileSync(proj + '/baked.json', JSON.stringify(out));
console.log('baked', fs.statSync(proj + '/baked.json').size >> 20, 'MB');
