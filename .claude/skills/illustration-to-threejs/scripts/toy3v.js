// Toy3V: shows a toy baked from a drawing, renders its three views and scores the outline against the drawing.
// Workflow and reasoning: docs/mascot-finish.md and the illustration-to-threejs skill in the Surflog repo.
window.Toy3V = (function () {
  function bytes(b64) {
    const s = atob(b64), a = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
    return a;
  }
  function meshFrom(m) {
    const q = new Uint16Array(bytes(m.pos).buffer), P = new Float32Array(m.n * 3), C = new Float32Array(m.n * 3), ao = bytes(m.ao);
    for (let v = 0; v < m.n; v++) {
      for (let o = 0; o < 3; o++) P[v * 3 + o] = m.min[o] + q[v * 3 + o] * m.s[o];
      const a = ao[v] / 255;
      C[v * 3] = C[v * 3 + 1] = C[v * 3 + 2] = a;
    }
    const raw = bytes(m.idx);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    g.setAttribute('color', new THREE.BufferAttribute(C, 3));
    g.setIndex(new THREE.BufferAttribute(m.wide ? new Uint32Array(raw.buffer) : new Uint16Array(raw.buffer), 1));
    if (m.nrm) {
      const nq = new Int16Array(bytes(m.nrm).buffer), N = new Float32Array(m.n * 3);
      for (let i = 0; i < N.length; i++) N[i] = nq[i] / 32767;
      g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    } else g.computeVertexNormals();
    return g;
  }
  // The soft darkening a toy leaves on whatever it stands on, baked with the toy.
  function contactFrom(c, lift) {
    const px = bytes(c.a), data = new Uint8Array(c.W * c.H * 4);
    for (let i = 0; i < px.length; i++) { data[i * 4] = 34; data[i * 4 + 1] = 26; data[i * 4 + 2] = 22; data[i * 4 + 3] = Math.min(255, Math.pow(px[i] / 255, 1.25) * 420); }
    const tex = new THREE.DataTexture(data, c.W, c.H, THREE.RGBAFormat);
    tex.magFilter = tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    const geo = new THREE.PlaneGeometry(c.x1 - c.x0, c.z1 - c.z0);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
    m.rotation.x = Math.PI / 2;
    m.position.set((c.x0 + c.x1) / 2, c.y + (lift || .006), (c.z0 + c.z1) / 2);
    m.material.side = THREE.DoubleSide;
    m.renderOrder = 2;
    m.userData.painted = true;
    return m;
  }

  // Flat colour regions and lines: red = belly colour, green = ink, blue = white.
  function paintTexture(items, view) {
    const S = 1024, c = document.createElement('canvas');
    c.width = c.height = S;
    const x = c.getContext('2d');
    x.fillStyle = '#000';
    x.fillRect(0, 0, S, S);
    x.globalCompositeOperation = 'lighter';
    const w = view.maxX - view.minX, h = view.maxY - view.minY;
    const PX = function (p) { return [(p[0] - view.minX) / w * S, (view.maxY - p[1]) / h * S]; };
    const COL = { belly: '#ff0000', ink: '#00ff00', white: '#0000ff' };
    items.forEach(function (it) {
      const paint = function () {
        x.beginPath();
        if (it.poly) {
          it.poly.forEach(function (p, i) { const q = PX(p); if (i) x.lineTo(q[0], q[1]); else x.moveTo(q[0], q[1]); });
          x.closePath();
          x.fill();
        } else if (it.line) {
          it.line.forEach(function (p, i) { const q = PX(p); if (i) x.lineTo(q[0], q[1]); else x.moveTo(q[0], q[1]); });
          x.lineWidth = it.w / w * S; x.lineCap = 'round'; x.lineJoin = 'round';
          x.stroke();
        } else {
          const q = PX(it.at);
          x.ellipse(q[0], q[1], it.rx / w * S, it.ry / h * S, 0, 0, Math.PI * 2);
          x.fill();
        }
      };
      x.globalCompositeOperation = 'source-over';
      x.fillStyle = '#000'; x.strokeStyle = '#000';
      paint();
      x.globalCompositeOperation = 'lighter';
      if (COL[it.ch]) { x.fillStyle = x.strokeStyle = COL[it.ch]; paint(); }
    });
    const t = new THREE.CanvasTexture(c);
    t.generateMipmaps = false;
    t.minFilter = t.magFilter = THREE.LinearFilter;
    return t;
  }

  function paintHook(uniforms) {
    return function (shader) {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vPaintN;')
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvPaintN = normal;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D uPaint;\nuniform vec2 uPMin, uPSize;\nuniform vec3 uPBelly;\nuniform float uPFront;\nvarying vec3 vPaintN;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          vec3 paintC = texture2D(uPaint, (vFinishPos.xy - uPMin) / uPSize).rgb;
          float paintF = uPFront > 0.5 ? step(0.0, vFinishPos.z) : 1.0;
          // Thin lines only land where the surface faces the drawing, so they can't smear round the form.
          float paintFace = smoothstep(0.25, 0.5, abs(normalize(vPaintN).z));
          diffuseColor.rgb = mix(diffuseColor.rgb, uPBelly * vColor, paintC.r * paintF);
          diffuseColor.rgb = mix(diffuseColor.rgb, vColor, paintC.b * paintF);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.012, 0.011, 0.009), paintC.g * paintF * paintFace);`);
    };
  }
  function paintUniforms(texture, view, belly, frontOnly) {
    return {
      uPaint: { value: texture },
      uPMin: { value: new THREE.Vector2(view.minX, view.minY) },
      uPSize: { value: new THREE.Vector2(view.maxX - view.minX, view.maxY - view.minY) },
      uPBelly: { value: belly },
      uPFront: { value: frontOnly ? 1 : 0 }
    };
  }

  // The three views show only the animal, at one shared scale, from the live model.
  function renderSheet(o) {
    const r = o.renderer, scene = o.scene, turn = o.turnGroup;
    const prevSize = r.getSize(new THREE.Vector2()), prevRatio = r.getPixelRatio(), prevTurn = turn.rotation.y;
    r.setPixelRatio(1);
    if (o.rest) o.rest();
    turn.rotation.y = 0;
    turn.updateMatrixWorld(true);
    const hidden = [];
    (o.hideForViews || []).forEach(function (m) { if (m.visible) { m.visible = false; hidden.push(m); } });
    if (o.floor) o.floor.visible = false;
    const box = new THREE.Box3();
    (o.fit || [turn]).forEach(function (obj) { box.expandByObject(obj); });
    const cen = box.getCenter(new THREE.Vector3()), dim = box.getSize(new THREE.Vector3());
    const span = Math.max(dim.x, dim.y, dim.z) * 1.12;
    const cam = new THREE.OrthographicCamera(-span / 2, span / 2, span / 2, -span / 2, .1, 60);
    r.setSize(640, 640, false);
    const shot = function (px, py, pz, ux, uy, uz) {
      cam.position.set(cen.x + px * 20, cen.y + py * 20, cen.z + pz * 20);
      cam.up.set(ux, uy, uz);
      cam.lookAt(cen);
      cam.updateMatrixWorld();
      r.render(scene, cam);
      return r.domElement.toDataURL('image/png');
    };
    const other = o.drawnFrom === 'front' ? [1, 0, 0] : [o.facing || -1, 0, 0];
    const result = {
      first: shot(0, 0, 1, 0, 1, 0),
      second: shot(other[0], other[1], other[2], 0, 1, 0),
      top: shot(0, 1, 0, 0, 0, -1)
    };
    if (o.bp && o.bp.image) {
      const v = o.bp.view, vw = v.maxX - v.minX, vh = v.maxY - v.minY;
      const W = 480, H = Math.round(W * vh / vw);
      r.setSize(W, H, false);
      const flat = new THREE.OrthographicCamera(v.minX, v.maxX, v.maxY, v.minY, .1, 60);
      flat.position.set(0, 0, 20);
      flat.lookAt(0, 0, 0);
      flat.updateMatrixWorld();
      const extra = [];
      (o.hideForMatch || []).forEach(function (m) { if (m.visible) { m.visible = false; extra.push(m); } });
      r.render(scene, flat);
      const model = r.domElement.toDataURL('image/png');
      const gl = r.getContext(), px = new Uint8Array(W * H * 4);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
      extra.forEach(function (m) { m.visible = true; });
      const mask = document.createElement('canvas');
      mask.width = W; mask.height = H;
      const mx = mask.getContext('2d');
      mx.fillStyle = '#fff';
      const PX = function (p) { return [(p[0] - v.minX) / vw * W, (v.maxY - p[1]) / vh * H]; };
      (o.bp.mask || []).forEach(function (poly) {
        mx.beginPath();
        poly.forEach(function (p, i) { const q = PX(p); if (i) mx.lineTo(q[0], q[1]); else mx.moveTo(q[0], q[1]); });
        mx.closePath();
        mx.fill();
      });
      (o.bp.circles || []).forEach(function (c) {
        const q = PX(c.at);
        mx.beginPath();
        mx.ellipse(q[0], q[1], c.rx / vw * W, c.ry / vh * H, 0, 0, Math.PI * 2);
        mx.fill();
      });
      const md = mx.getImageData(0, 0, W, H).data;
      let both = 0, either = 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const a = md[(y * W + x) * 4 + 3] > 127, b = px[((H - 1 - y) * W + x) * 4 + 3] > 127;
        if (a && b) both++;
        if (a || b) either++;
      }
      result.match = either ? both / either : 0;
      result.overlay = { model: model, drawing: o.bp.image, w: W, h: H };
    }
    if (o.bp && o.bp.views) {
      // Model against the front and top drawings, each framed exactly on what was drawn.
      const score = function (polys, cam, W, H, toPx) {
        r.setSize(W, H, false);
        const extra = [];
        (o.hideForMatch || []).forEach(function (m) { if (m.visible) { m.visible = false; extra.push(m); } });
        r.render(scene, cam);
        const gl = r.getContext(), px = new Uint8Array(W * H * 4);
        gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
        extra.forEach(function (m) { m.visible = true; });
        const c = document.createElement('canvas');
        c.width = W; c.height = H;
        const x = c.getContext('2d');
        x.fillStyle = '#fff';
        polys.forEach(function (poly) {
          x.beginPath();
          poly.forEach(function (p, i) { const q = toPx(p); if (i) x.lineTo(q[0], q[1]); else x.moveTo(q[0], q[1]); });
          x.closePath();
          x.fill();
        });
        const d = x.getImageData(0, 0, W, H).data;
        let both = 0, either = 0;
        for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) {
          const a = d[(yy * W + xx) * 4 + 3] > 127, b = px[((H - 1 - yy) * W + xx) * 4 + 3] > 127;
          if (a && b) both++;
          if (a || b) either++;
        }
        return either ? both / either : 0;
      };
      const bounds = function (polys, ai, bi) {
        let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
        polys.forEach(function (poly) { poly.forEach(function (p) { a0 = Math.min(a0, p[ai]); a1 = Math.max(a1, p[ai]); b0 = Math.min(b0, p[bi]); b1 = Math.max(b1, p[bi]); }); });
        const pa = (a1 - a0) * .08, pb = (b1 - b0) * .08;
        return [a0 - pa, a1 + pa, b0 - pb, b1 + pb];
      };
      const f = o.facing || -1, S = 120;
      const fb = bounds(o.bp.views.front, 0, 1), fw = Math.round((fb[1] - fb[0]) * S), fh = Math.round((fb[3] - fb[2]) * S);
      const fc = new THREE.OrthographicCamera(fb[0], fb[1], fb[3], fb[2], .1, 60);
      fc.position.set(f * 20, 0, 0);
      fc.up.set(0, 1, 0);
      fc.lookAt(0, 0, 0);
      fc.updateMatrixWorld();
      result.frontMatch = score(o.bp.views.front, fc, fw, fh, function (p) { return [(-f * p[0] - fb[0]) / (fb[1] - fb[0]) * fw, (fb[3] - p[1]) / (fb[3] - fb[2]) * fh]; });
      const tb = bounds(o.bp.views.top, 0, 1), tw = Math.round((tb[1] - tb[0]) * S), th = Math.round((tb[3] - tb[2]) * S);
      const tc = new THREE.OrthographicCamera(tb[0], tb[1], -tb[2], -tb[3], .1, 60);
      tc.position.set(0, 20, 0);
      tc.up.set(0, 0, -1);
      tc.lookAt(0, 0, 0);
      tc.updateMatrixWorld();
      result.topMatch = score(o.bp.views.top, tc, tw, th, function (p) { return [(p[0] - tb[0]) / (tb[1] - tb[0]) * tw, (p[1] - tb[2]) / (tb[3] - tb[2]) * th]; });
      // X-ray: dotted parts must line up with real geometry inside the see-through model.
      const glass = [];
      (o.fit || []).forEach(function (obj) {
        obj.traverse(function (m) {
          if (m.isMesh && m.material && !glass.some(function (g) { return g[0] === m.material; })) { glass.push([m.material, m.material.transparent, m.material.opacity, m.material.depthWrite, m.material.side]); m.material.transparent = true; m.material.opacity = .3; m.material.depthWrite = false; m.material.side = THREE.DoubleSide; m.material.needsUpdate = true; }
        });
      });
      const xray = function (cam, W, H, lines, toPx) {
        r.setSize(W, H, false);
        r.render(scene, cam);
        const c = document.createElement('canvas');
        c.width = W; c.height = H;
        const x = c.getContext('2d');
        x.fillStyle = '#F7F6F3';
        x.fillRect(0, 0, W, H);
        x.drawImage(r.domElement, 0, 0);
        x.lineCap = 'round'; x.lineJoin = 'round';
        const stroke = function (list, width, color, dash) {
          x.strokeStyle = color; x.lineWidth = width; x.setLineDash(dash);
          list.forEach(function (pts) {
            x.beginPath();
            pts.forEach(function (p, i) { const q = toPx(p); if (i) x.lineTo(q[0], q[1]); else x.moveTo(q[0], q[1]); });
            x.stroke();
          });
        };
        stroke(lines.solid, 1.4, 'rgba(30,27,24,.75)', []);
        stroke(lines.dots, 1.8, '#0018FF', [.1, 5]);
        return c.toDataURL('image/png');
      };
      const closeAll = function (l) { return { solid: l.solid.map(function (p) { return p.concat([p[0]]); }), dots: l.dots }; };
      const sb = bounds(o.bp.views.side, 0, 1), sw = Math.round((sb[1] - sb[0]) * S), sh = Math.round((sb[3] - sb[2]) * S);
      const sc = new THREE.OrthographicCamera(sb[0], sb[1], sb[3], sb[2], .1, 60);
      sc.position.set(0, 0, 20);
      sc.lookAt(0, 0, 0);
      sc.updateMatrixWorld();
      result.xray = {
        side: xray(sc, sw, sh, closeAll(o.bp.views.lines.side), function (p) { return [(p[0] - sb[0]) / (sb[1] - sb[0]) * sw, (sb[3] - p[1]) / (sb[3] - sb[2]) * sh]; }),
        front: xray(fc, fw, fh, closeAll(o.bp.views.lines.front), function (p) { return [(-f * p[0] - fb[0]) / (fb[1] - fb[0]) * fw, (fb[3] - p[1]) / (fb[3] - fb[2]) * fh]; }),
        top: xray(tc, tw, th, closeAll(o.bp.views.lines.top), function (p) { return [(p[0] - tb[0]) / (tb[1] - tb[0]) * tw, (p[1] - tb[2]) / (tb[3] - tb[2]) * th]; })
      };
      glass.forEach(function (g) { g[0].transparent = g[1]; g[0].opacity = g[2]; g[0].depthWrite = g[3]; g[0].side = g[4]; g[0].needsUpdate = true; });
      result.sheet = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(o.bp.views.svg)));
    }
    hidden.forEach(function (m) { m.visible = true; });
    if (o.floor) o.floor.visible = true;
    r.setPixelRatio(prevRatio);
    r.setSize(prevSize.x, prevSize.y, false);
    turn.rotation.y = prevTurn;
    return result;
  }

  function zoomTile(content, label) {
    const layer = document.createElement('div');
    layer.className = 'sheet-zoom';
    layer.setAttribute('role', 'dialog');
    layer.setAttribute('aria-label', label);
    const close = document.createElement('button');
    close.type = 'button'; close.className = 'chip sheet-close'; close.textContent = 'Close';
    const copy = content.cloneNode(true);
    copy.classList.add('zoomed');
    const cap = document.createElement('p');
    cap.textContent = label;
    layer.appendChild(close); layer.appendChild(copy); layer.appendChild(cap);
    const done = function () { layer.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = function (e) { if (e.key === 'Escape') done(); };
    close.addEventListener('click', done);
    layer.addEventListener('click', function (e) { if (e.target === layer) done(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(layer);
    close.focus();
  }

  function showSheet(el, sheet, labels) {
    el.innerHTML = '';
    const button = function (node, label) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'view-open';
      b.setAttribute('aria-label', 'Enlarge ' + label);
      b.appendChild(node);
      b.addEventListener('click', function () { zoomTile(node, label); });
      return b;
    };
    const tile = function (src, label, alt) {
      const f = document.createElement('figure');
      f.className = 'view';
      const i = document.createElement('img');
      i.src = src; i.alt = alt;
      f.appendChild(button(i, label));
      const c = document.createElement('figcaption');
      c.textContent = label;
      f.appendChild(c);
      el.appendChild(f);
    };
    if (sheet.sheet) {
      tile(sheet.sheet, 'Three views, drawn first; the model is built to these', 'Line drawing of the side, front and top views');
      el.lastChild.classList.add('wide');
    }
    if (sheet.overlay) {
      tile(sheet.overlay.drawing, 'Your drawing: shape and proportion', 'The reference drawing');
      const f = document.createElement('figure');
      f.className = 'view';
      const box = document.createElement('div');
      box.className = 'overlay';
      box.style.aspectRatio = sheet.overlay.w + ' / ' + sheet.overlay.h;
      const a = document.createElement('img');
      a.src = sheet.overlay.drawing; a.alt = 'The drawing';
      const b = document.createElement('img');
      b.src = sheet.overlay.model; b.alt = 'The model laid over the drawing'; b.className = 'over';
      box.appendChild(a); box.appendChild(b);
      const overLabel = 'Model over your drawing: shape reference only';
      f.appendChild(button(box, overLabel));
      const c = document.createElement('figcaption');
      c.textContent = overLabel;
      f.appendChild(c);
      el.appendChild(f);
    }
    const pct = function (v) { return v === undefined ? '' : ': ' + Math.round(v * 100) + '% match'; };
    tile(sheet.first, 'Model, ' + labels[0].toLowerCase() + pct(sheet.match), labels[0] + ' of the model');
    tile(sheet.second, 'Model, ' + labels[1].toLowerCase() + pct(sheet.frontMatch), labels[1] + ' of the model');
    tile(sheet.top, 'Model, top view' + pct(sheet.topMatch), 'Top view of the model');
    if (sheet.xray) {
      tile(sheet.xray.side, 'X-ray, side: blue dots are hidden parts', 'See-through side view with the sheet lines');
      tile(sheet.xray.front, 'X-ray, front', 'See-through front view with the sheet lines');
      tile(sheet.xray.top, 'X-ray, top', 'See-through top view with the sheet lines');
    }
  }

  return { meshFrom: meshFrom, contactFrom: contactFrom, paintTexture: paintTexture, paintHook: paintHook, paintUniforms: paintUniforms, renderSheet: renderSheet, showSheet: showSheet };
})();
