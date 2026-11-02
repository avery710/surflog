---
name: illustration-to-threejs
description: Turn a 2D drawing or illustration into a puffy Three.js 3D toy built from a few simple solid blocks, with three-view sheets (hidden parts dotted) reviewed before modelling, a soft matte vinyl finish, and a rating against the quality reference after every iteration. Use when Avery asks to convert a drawing, sketch, character or reference image into a 3D or Three.js model, make a mascot or toy from an image, refine such a model, or draw its three views.
---

# Illustration to Three.js toy

**Three views first, model second, examine and rate after every build.** Every change, however small, starts on the three views using the ellipse rule. Review the sheet before baking. Never build first and draw the views afterwards.

The target feel is a Sticky Monster Lab (SML / 黏黏怪) figure: full and puffy, made of a few simple solid forms pressed together, in soft matte vinyl. Take the feel and finish only, never their characters, logos or artwork.

The scripts need only Python 3 and Node. A *project* is a folder outside the repo, normally in the scratchpad. **The repo is public: keep anything derived from supplied art in the project folder, never here.**

## The rules that decide the look

- **The shape follows the drawing, read as circles and ellipses; only the pose is ours.** Following a drawing never means tracing it (see the next section). Check with an overlay: a simplified shape that drifts from the drawing is wrong, however smooth. Use a symmetric, standing or sitting pose unless Avery asks for another position: legs, arms and ears are identical mirrored blocks, feet level, never one forward.
- **Avery's latest word wins.** An overlay drawn on a sheet outranks the original drawing, and a later request outranks an earlier one, so say what it undoes. Change only what was asked: if Avery says only the connectors, the balls don't move.
- **Head, body and ears are one solid with no crease on the face or neck, but separate shapes.** The head (snout included) and the body are each their own ellipsoid, joined by a short neck. Ears blend in with `of='body'`. Only a true beak stays separate.
- **Arms, legs and tail are separate solids pressed into the body**, each its own closed mesh with a real crease, as on an SML figure. A tail the drawing runs straight into the back line (the penguin's) stays part of the body. About 6 to 9 shapes per toy.
- **The simpler and more fluid the curves and surfaces, the better. This is how to judge smoothness.** No wiggles, no toes or added detail, no broken faces, no sudden changes in curvature.
- **Puffy and full:** round cross-sections (depth about equal to radius), thick limbs, soft necks, blunt ends. No sharp tips, even on a tail or snout.
- Fill in anything the drawing lacks from the real animal, then simplify it into a block.
- **No mouths, paws or toes** unless Avery asks. Limbs end in plain round ends (toes were tried and removed on request, 2026-10-31).

## Refining curves: whole ellipses first

This is how Avery applies the ellipse rule. Refine every curve this way.

**Reading the shape**

1. **Each round part is one whole ellipse or circle**, drawn complete and allowed to overlap its neighbour. On the floppy dog the head is one tilted ellipse, the body one upright ellipse, each ear lobe one circle and the nose its own circle.
2. **Start from those whole shapes.** Don't trace the current outline and smooth it, and don't read the ellipses off the current model.
3. **Following a drawing still means circles.** Read the drawn part as the largest circles that fit its round lobes, keep its waists, and taper to its joins with tangents.
4. **Connectors exist only where two shapes meet:** short concave tangent curves, kept small so the ellipses hold most of the line. A thin drawn join stays thin.
5. **Limbs stay simple too:** a leg is two straight parallel lines, and a foot is a simple rounded form taken from the latest reference.
6. **When Avery draws over a sheet, measure the drawing.** Fit its ellipses and circles in model units (`scripts/pngread.py` reads the pixels), then measure the finished outline against it. Report the gap as well as the scores: the ellipse score can drop while the shape gets closer to what was drawn.
7. **Check each view against the others.** A part that looks right from the side can still read wrong from the front. Depth is a design choice, not a leftover: when a body looks wrong from one view, compare how its parts connect in the other.

**Building it so the surface stays clean**

8. **Give an ellipse part a true ellipsoid:** `ell=dict(cx, cy, a, b, deg, rho=[[u, half_depth], ...])` as well as its `sp`, with `crisp=True`. A sweep of spheres alone leaves a seam where the sweep ends, which shows across a face. `rho` can vary along the long axis, but a constant one is a plain ellipsoid. Add `z` for a mirrored part.
9. **Keep round lobes as their own solid shapes.** A sweep that runs through a ball into a neck eats into the ball and flattens it, so it stops looking chubby. Make each ball a true sphere with `ell` (`a`, `b` and `rho` all equal to its radius), and blend separate short necks between them.
10. **Two overlapping balls limit their waist.** Their waist can't be narrower than where their circles cross. Work that out first and say so, rather than moving the balls.
11. **A blended shape just under the skin pushes the skin out.** Taper a connector's hidden ends fast so they sit deeper than the blend width `k`. This caused the ridges across the floppy dog's face and chest.
12. **Leave room between mirrored parts.** Ears or legs that touch at the centre make a sharp valley. A small gap can take curvature jumps from dozens to none.
13. **Moving a shape moves what's attached.** After moving or resizing the body, refit the depth of arms, legs, tail and neck to the new surface, and keep the board under the feet.
14. **Design a face line in the view it's seen from.** A mouth read from the front can't be a side-projected paint line. Lay its points on the surface, add them as `frontline=[(x, y, z), ...]` in the toy's config so all three views draw it, and add the same line to the page as a thin half-set tube.
15. **Eyes follow the surface.** Their front-view spacing comes from where they sit on the head's curve, so move them in the side view to change it.

## 1. Read the drawing as circles joined by smooth curves

**Never copy a drawn line point by point.** The rule applies inside each part and inside the body on its own, never across a join between solids, which is just a crease. Read each part in two kinds of piece:

- **Shapes (yellow):** circles or ellipses, and only on the full round lobes of a part.
- **Connecting curves (green):** whatever joins two shapes. A narrowing between lobes is never a shape of its own. It's a smooth curve that bends the other way and meets both circles without a corner.

The wobble in the original line is left behind. Use as few shapes as the part allows.

Choose model units with the ground at a known height, then write `reading.json` in the project:

```json
{ "image": "drawing.png",
  "units": { "at": [358, 72], "is": [1.58, 2.12], "per_px": 0.0103 },
  "parts": { "mytoy.ear": { "lobes": [[187, 93.5, 23.5], [120, 94, 30.5], [57, 97.5, 36]], "necks": [19, 28],
                            "z": [0.44, 0.56, 0.54], "d": [0.2, 0.28, 0.27], "neck_d": [0.2, 0.27] } } }
```

`lobes` are `[cx, cy, r]` in image pixels. `necks` has one half-width in pixels per gap, or `null` for a straight tangent line with no dip. `z`, `d` and `neck_d` are in model units: depth position, half-depth, and half-depth at each neck. Read the lobes and necks from the drawing, and use `scripts/pngread.py` to measure edges if eyeballing isn't enough.

Run `python3 scripts/shape_reading.py <project>`. It writes `reading_<toy>_<part>.svg` (the drawing, circles in yellow, connecting curves in green) and prints `lobes=` and `necks=` to paste into `blocks.py`. Adjust until the overlay sits on the drawn line.

If the photo is sideways, rotate it first, and ignore anything that isn't part of the drawing (pencil ghosts, grid lines).

Then fit each part: `fit(keys, polys)` in `scripts/fit_to_drawing.py` moves a chain of `(x, y, r)` keys until its swept circles overlap the drawn outline, with a penalty on bends so the curve stays simple. Aim for 90% overlap or better. A lower `reg` keeps more of the drawn lobes; `dx` and `dy` shift the target where the pose or a request moves a part. Lay the model's outlines over the drawing with a grid and look: overlap alone doesn't catch a wrong curve.

## 2. Write the blocks, then review the three views

`blocks.py` is the single source for both the views and the model, so **dotted hidden parts always match real geometry**.

```python
BLOCKS = dict(mydog=dict(
  facing=-1, floor=0, cell=.014,   # facing: -1 looks along -x, 1 along +x; soles are cut flat on the floor
  paint=[dict(ch='ink', line=[[x, y], [x, y]], w=.02)],         # optional thin painted lines
  blocks=[
    # keys: (x, y, z, r, d). r = radius in side view, d = half-depth.
    # The first block is the body; head and neck blend into it. ellipse_sp() in the project's gen script makes the sp list.
    dict(n='body', crisp=True, ell=dict(cx=0, cy=1, a=.8, b=.6, deg=90, rho=[[-1, .55], [1, .55]]), sp=BODY_SP),
    dict(n='body', of='body', crisp=True, ell=dict(cx=-.4, cy=2.3, a=.75, b=.5, deg=13, rho=[[-1, .45], [1, .45]]), sp=HEAD_SP, k=.26),
    dict(n='body', of='body', lobes=[(0, 1.2, 0, .08, .08), (-.05, 1.8, 0, .25, .25), (-.2, 2.3, 0, .08, .08)], k=.3),  # neck, hidden ends tapered
    dict(n='ear', m=1, of='body', lobes=[(.05, 2.4, .3, .2, .2), (.5, 2.15, .4, .25, .25)], k=[.2, .09]),
    dict(n='arm', m=1, lobes=[(0, 1.7, .36, .14, .15), (0, .9, .72, .17, .17)]),
    dict(n='leg', m=1, lobes=[(.1, .5, .28, .24, .22), (-.3, .18, .3, .2, .2)]),
  ],
))
```

| Field | Meaning |
|---|---|
| `lobes`, `necks` | Use these instead of `keys` for any part with lobes or narrowings: `lobes=[(x, y, z, r, d), ...]`, `necks=[(half-width, half-depth), ...]` or `None` per gap. Sampled exactly, so the outline is circle, connecting curve, circle. One lobe alone is a sphere. `keys` stays fine for a simple egg or taper |
| `m=1` | Mirrored to the other side. Use it for every pair |
| `sp` | Explicit spheres `(x, y, z, r, d)`, in place of `keys`. Circles along a long axis with r² = b²(1 − s²/c²), c² = a² − b², draw an exact ellipse. Use it with `crisp=True` when a part is drawn as an ellipse |
| `crisp` | `crisp=True` keeps a block's drawn detail through the field smoothing. Use it when a part must match the drawing exactly, and measure the finished mesh against the drawn outline rather than trusting the fit |
| `ell` | A true ellipsoid in the mesh: `dict(cx, cy, z, a, b, deg, rho)`, plus `rot` (a 3x3 matrix) to turn it in a posture. Pair it with `sp` so the sheet draws the same outline. The body's outline is dotted in the top view where it's hidden |
| `tube` | `tube=True` makes a limb a true 3D sphere sweep. Use it for any limb that runs across the side view or leans sideways: the default sweep works in side-view columns, so an arm held out comes out rough and a leaning leg comes out thin. A tube is round (it uses r only); add `frame=<3x3 rotation>` to give it an elliptical cross-section, r across and d along the frame's own z, so a posed part whose side view and top view differ keeps both. Change one view only by setting r and d apart |
| `of`, `k` | `of='body'` blends this block into that solid. `k`: blend width, one number or a list along the block. The blend keeps curvature continuous, so a soft edge doesn't show where it ends, and it needs a wider `k` than you might expect: .2 to .55 at a neck or broad join, .06 to .14 at a thin one |
| `zones` | Optional colour on the toy: `pale` volumes tint the body softly; `warm` and `dark` name whole parts, each one colour up to its crease |

Also write `features.json`: `{ name: { circles: [{ at: [x, y], rx, ry }], eyes: [{ at: [x, y], mirror: true, items: [{ c: 'white', rx, ry }, { c: 'ink', rx, ry, dx }] }] } }`. `circles` holds the nose. Eyes are low domes, a bit 立體 rather than flush: everything on an eye rides on the dome of its first item, `dome` on the eye sets the height when the default suits it badly (a thin slit eye needs its own), and `flush: true` lays the eye on the surface itself with nothing standing proud (the penguin). For an eye toggle, give each eye a `set` name (`plain` is the default). The sheet dots the optional set's outline, every decal carries its `set`, and the page switches their visibility. Keep the pupil in the same place in both sets, so only the white appears.

Run `python3 scripts/three_views.py <project>`. Each view draws a solid line wherever one solid enters another, and dots whatever a nearer solid hides, so the body's whole curve shows through the limbs. It prints **outline bends** per view: fewer is simpler.

Then run `python3 scripts/ellipse_check.py <project> <toy>`. **Each solid's whole outline, and the body's on its own, must be shapes joined by smooth connecting curves.** It splits each outline into the fewest pieces that sit on one ellipse. A convex piece is a shape (yellow). A concave or unfitted piece is a connector (green), fine while it bends one way and meets its neighbours without a corner. Anything that wiggles is red. It prints shapes, connectors, wiggles, kinks, the body's share of shape, its bend reversals and a score per view, and writes `<toy>_ellipses.svg` in those colours. A 10 needs shapes on at least 60% of the line, no wiggles, shapes within budget and no kinks. A sole cut flat on the floor doesn't count as a kink. Aim for 7 or more, but following the drawing and Avery's requests comes first: a thin neck or a blended ear costs points, so report the lower number rather than simplifying the shape back.

Review each sheet at full size and fix the blocks before any modelling:
- A lump or kink, or a part that isn't pressed in.
- Too many bends for such a simple form.
- Proportions that no longer feel like the drawing.
- A shape that reads wrong from the front or top.

## 3. Sculpt and pass the mesh checks

Run `node scripts/sculpt.js <project>`. It exits 1 and prints the location unless:
- Each solid is **one closed piece**, and every part is **pressed in** at least .03 (it prints how much of each part is hidden).
- It has **no broken faces**: no open edges, no edges shared by more than two faces, no folded faces.

It also prints three numbers to bring down each iteration: **dents** (separate concave patches), **ripple** (fine noise in curvature) and **curvature jumps** (sudden changes). A waist between two balls is concave on purpose, so read dents with that in mind.

**To find a rough surface, set `SURF_DEBUG=1`.** It lists the roughest patches for each solid as `[verts, x, y, z, peak]`, biggest first, so you can go straight to them. Fix the cause, then look at that spot up close.

**Bake every variant of a toy together.** Injecting after baking one variant drops the others from the page.

Blocks no longer merge, so a broken face is inside one solid, usually a very thin neck or a surface-nets ambiguity at a grid corner. Thicken the neck or nudge the block slightly, keeping pairs mirrored.

## 4. Build the page

`scripts/toy3v.js` is the page engine: `meshFrom`, `contactFrom`, `paintTexture`, `paintHook`, `renderSheet`, `showSheet`. Inline it with `baked.json`. For each toy:
- Fur: `MeshStandardMaterial` with `vertexColors`, through the `velvet` hook in `docs/mascot-finish.md`. On a painted material call `hook(shader)` before `velvet(shader)`, or the paint never shows.
- `receiveShadow = false` on the toy. Soft shading comes from the baked light.
- Add `Toy3V.contactFrom(baked.mesh.fur.contact)` for the shade under the feet, and list it in `hideForViews`.
- Show beside the model: the sheet, the drawing, the model over the drawing (shape reference only), the model's three views with match scores, and the X-ray tiles (see-through model with solid and dotted sheet lines, blue dots for hidden parts).

**Clothes as a toggle:** push the toy's own geometry out along its normals in the vertex shader and `discard` by position in the fragment shader, so hems and sleeves stay crisp and it needs no new bake. Add `garment=[(view, points), ...]` to the toy's config so the sheet dots the hem, collar and sleeve ends. **Blink:** scale each eye decal in `y` around the eye's height. **Length of a straight part as a toggle:** in the vertex shader, slide points along the part's own axis with a smoothstep from where it leaves the body to where its round tip starts. The shaft stretches, the tip stays round, and no new bake is needed. Don't use this on chained balls, which it flattens. Give the shadow's `customDepthMaterial` the same stretch and dot the options on the sheet with `kind='dotball'` marks. **Materials that share a hook:** three.js caches shaders by the text of `onBeforeCompile`, so two materials whose hook differs only by a closed-over value get the same shader. Set `customProgramCacheKey`.

Other motion is whole-body. For a second position or a toggle (the penguin's body surf, the floppy dog's ears), build a posture from joints (see "Posture from joints"), add it as its own toy in `blocks.py`, bake it, and switch which group is visible on the page. Each variant adds a full mesh, so watch the 16 MB page limit and raise `cell` if needed; leave the drawing off a position that doesn't follow it.

The model turns on both axes, so its top and underside can be checked: dragging sideways turns the toy, dragging up and down orbits the camera right over and underneath (`state.tilt`, up to ±1.54 rad; the arrow keys do the same), and the canvas has `touch-action: none`. Below the horizon the board and contact shadows are hidden, so the soles show.

## Posture from joints

**Never hand-key a posture.** Work in this order, and show Avery the reference and the table before relying on them. A hand-keyed stance on this project had the knees pointing apart and the rear arm on the wrong side; the references caught both.

1. **Find references for the posture.** Read the real pages and link them. Note what they state and what they leave out: coaching guides rarely give joint angles, so say which numbers are your own choice.
2. **Convert the posture to axes and joints.** Name the axes first: the core axis (pelvis, chest, neck, skull), the stance axis (ankle to ankle) and the gaze axis. Then give every joint a value, in a table that says where each value came from.
3. **Put the rest joints on the standing toy**, on its own block keys: pelvis, chest, neck, skull, hips, knees, ankles, balls of the feet, shoulders, elbows, wrists. Add `joints=dict(pts={name: (x, y, z)}, bones=[(a, b), ...], axis=[core joint names])` so the sheet draws them in red, the core axis thicker. Review this before posing.
4. **Pose by rotating joints.** `scripts/rig.py` has the rotations. Each block rides the bone it belongs to, so bone lengths never change, and print them to confirm. Plant the feet and solve each leg with `two_bone`: choose the foot position and turn and a knee direction, then print the resulting knee angle and compare it with the table. Rotate arms joint by joint. Move the core with the pelvis and turn the head at the neck.
5. **Review the posed sheet, then bake and examine it** like any other change.

| Block in the posed toy | How it moves |
|---|---|
| Body and head ellipsoids | Move the centre, and add `rot` (a 3x3 matrix) to `ell` |
| Connector across a joint (the neck) | Keys below the joint ride the lower bone, keys above it the upper bone |
| Ears, arms, legs, feet | `tube=True`, with their keys moved by the bone. Give left and right sides separate names when the pose isn't mirrored |
| Eyes, nose, mouth | Leave them out of the posed bake (`eyes=[]`, `circles=[]`). On the page, put the standing toy's decals in a group with the head's matrix, and add `marks` to the config so the sheet draws them |
| Clothes | Trim in the core's frame by undoing its rotation; measure sleeves along each upper arm; leave the legs bare |

To check it, a **Joints** toggle on the page draws the rig through the model. To enter a pose, a small hop hides the swap between meshes: change them at the top of the hop, with the posed toy raised by its pelvis drop so the body doesn't jump.

### Example: surf stance

The toy stands with its stance axis on the stringer, so turn it 90 degrees onto the board. Lead means the side towards the nose.

| Axis or joint | What the references say | Value used on floppy dog |
|---|---|---|
| Stance axis | Feet centred on the stringer (all three) | Ankle line on the stringer |
| Foot spacing | Shoulder width (Ombe, SurferToday), or slightly more (Barefoot) | Ankles about 1.2 times the distance between the shoulder joints |
| Back foot | 90 degrees to the stringer (Ombe) | Same |
| Front foot | 45 degrees to the stringer (Ombe); not pointing at the nose (SurferToday) | Same |
| Knees | Bent, pointing towards each other, back knee tucked more; never pointing apart (Barefoot) | 60 degrees each, back knee tucked more |
| Hips | Compress the lower body, don't bend the chest down (Barefoot, Ombe); stay fairly low, not too low (SurferToday) | Pelvis drops about a quarter of the leg, slightly behind the feet. **Own choice** |
| Core axis | Upper body straight and facing forward (Ombe, Barefoot) | Leans 8 degrees, turns 25 degrees towards the nose. **Own choice** |
| Gaze axis | Look where you're going; the head steers (all three) | Head level, turned 70 degrees from the chest-forward line |
| Lead arm | Hand outside its own rail, at or above the waist (Ombe, Barefoot) | Out towards the nose, soft elbow |
| Rear arm | Hand outside the other rail (Ombe, Barefoot), far back near the tail (SurferToday) | Out towards the tail, at waist height, elbow more bent |

Sources: [Ombe, the proper surf stance](https://ombe.co/guides/the-proper-surf-stance); [Barefoot Surf, the proper surfing stance](https://tutorials.barefootsurftravel.com/articles/proper-surfing-stance/); [SurferToday, how to adopt a proper surfing stance](https://www.surfertoday.com/surfing/how-to-adopt-a-proper-surfing-stance). None of them gives knee, hip or trunk angles, so those numbers are a reading of the guides, not measurements.

### Example: riding backside

The wave is behind the toy's back, and the rail nearest the wave digs in. Same toy frame as the stance, so only these values change.

| Axis or joint | What the references say | Value used on floppy dog |
|---|---|---|
| Board | The inside rail, nearest the wave, goes in; the other rises (Barefoot, Ombe) | Board and toy tip together about the stringer by about 10 degrees. **Amount is my own choice** |
| Back foot | Rolled to about 45 degrees to the stringer (SurferToday); feet a little less perpendicular (VVA) | 45 degrees |
| Front foot | As above | 40 degrees to the stringer |
| Stance | Wide, back foot towards the tail, front foot mid-board (Avery's photo; foot guides below) | Arches 1.2 apart along the stringer, at +.10 and −1.10 |
| Stance height | Low, compressed (photo; SurferToday, Barefoot, Rapture) | Pelvis drops .24, a little over 30% of the leg |
| Front knee | About 90 degrees with the shin near upright and the hips over the front foot (photo) | 65 degrees, shin near upright. **Capped by the mesh**: past about 70 degrees this thick leg creased behind the knee, so it reads more as a wide stride than the photo's deep crouch |
| Back knee | Straighter, reaching back towards the tail (photo). Check the ankle: tucking too far once laid the shin almost flat, with a 56 degree ankle | 46 degrees, ankle 41 |
| Core axis | Shoulders open towards the nose, in line with the rails (SurferToday, VVA); the photo's chest faces the camera, about 25 to 35 degrees open | Turns 80 degrees towards the nose, kept at Avery's request (60 looked too closed, then 90 overturned); no lean |
| Gaze axis | Down the line, slightly down (photo) | Head turned 90 degrees, nodded 10. **Nod is my own choice** |
| Lead arm | Hangs nearly straight at its side (photo) | Down at its side, elbow 33 degrees |
| Back arm | Elbow at the side, hand in front of the hip (photo); bring it forward rather than back (Hawaiian South Shore) | Forearm forward in front of the hip, elbow 70 degrees, fist clear of the belly |

Sources: [SurferToday, how to improve your backside surfing](https://www.surfertoday.com/surfing/how-to-improve-your-backside-surfing); [Barefoot Surf, how to do a proper bottom turn](https://tutorials.barefootsurftravel.com/articles/proper-bottom-turn/); [Ombe, bottom turn surfing](https://www.ombe.co/guides/bottom-turn-surfing); [VVA, surfing with your back to the wave (in French)](https://vvanat.fr/blog/surfeur-dos-a-la-vague/); [Seabreeze, backhand wave riding](https://www.seabreeze.com.au/Articles/Kitesurfing/Wave-Riding-Tips-Backhand-by-Ben-Wilson); [Hawaiian South Shore, back arm position](https://www.hawaiiansouthshore.com/blogs/hawaiian-south-shore-surfing-blog/the-importance-of-back-arm-position-in-surfing); [Rapture, bottom turn](https://www.rapturecamps.com/learn-to-surf/surf-maneuvers/bottom-turn); [Bali Surfing Camp, backside top turns](https://www.balisurfingcamp.com/blog/backside-top-turns). Seabreeze covers kitesurfing and I read only a search excerpt of it. None gives joint angles for this posture, apart from Rapture's knees past 90 degrees at the deepest point of a turn. The second pass was read from a photo of a backside rider Avery supplied (not kept). A photo beats the guides for the overall shape; still print the angles and let the mesh checks set the limits.

**Give every foot its own axis, heel to toe, and place it in terms of what it stands on.** For a board: the arch's position along the stringer, its position across it, the toes' angle to the stringer, and how far the knee tucks. Convert those to the toy's frame, solve the knee from there, and print the placement back in board terms. Add `feet=[(heel, toe), ...]` to `joints` and `stringer=<x>` for the dashed reference in the top view; the sheet draws feet in blue, and the page's Joints toggle gives each an arrowhead at the toes. Placed by eye, floppy dog's back foot sat 13% of the way to the rail and both feet were mid-board. Sources: [SurferToday, how to position your feet](https://www.surfertoday.com/surfing/how-to-position-your-feet-on-the-surfboard) (front foot in the middle of the board, both over the stringer, back foot at the front of the fins); [Ombe, how to stand on your board](https://www.ombe.co/guides/surfboard-position-how-to-stand-on-your-board) (front foot mid-board, back foot on the pad).

**Print every joint angle after solving and question any extreme one, even if the bones and mesh pass.** The bad back ankle showed in the numbers before it was reported.

An arm can be given by where the hand reaches: solve the elbow with `two_bone`, like a knee. Going between two postures hops back to standing first. Each posture adds a full mesh for each ear style, so keep a mesh under 65,536 vertices where you can (its index size halves) and let the bake's broken-face check stop a bad grid: nudge `cell` and bake again.

## 5. Rate every iteration, then refine

Serve the page locally through `.claude/launch.json` with `python3 -m http.server`, make `#stage` fill the window, and look from the side, three-quarter, front, back, top and bottom, **with close-ups of every crease**. **Examine the whole model for discontinuous surfaces after every build, on every ear or body variant, and keep refining:** a seam or dent on the face, a ledge at a join, or a ball that has gone flat counts as a fault even if the numbers pass. For close-ups, set `TOY_DEBUG.state.view` (`d` for distance, `y` for height) with `state.turn` and `state.tilt`. Avery may be scrolling or drawing in the same pane, so scroll to the stage just before each capture and say if a tab has closed. Then score each toy out of 10 on three things, where **the SML reference is a perfect 10**:

1. **Does it match the quality of the SML reference?** Full puffy forms, simple blocks, soft matte vinyl, colour that glows and goes deeper and more saturated in shadow.
2. **Does every part, surface and crease look smooth?** Simple and fluid curves, a clean crease at each join, no broken faces, no sudden curvature changes.
3. **Does each part follow the ellipse rule?** Circles and ellipses on the lobes, smooth curves between them. Use the worst view's score from `ellipse_check.py`.

**After every comment or small adjustment, however small, run this whole loop again before publishing:** three views, `ellipse_check.py`, the mesh gates, a look at the whole curve in 3D, and the three scores. A tweak can look harmless and still add curvature jumps elsewhere; the bake prints them per solid so you can find which part. Report the numbers before and after. Write down all three scores, what's holding each back, and the fix. Keep a table of iterations and show it to Avery. Be honest: don't score up because a build is better than the last one. Keep going until the remaining gap is something you can't fix in a live browser render, and say what that is.

Compare against any reference images Avery has supplied, side by side rather than from memory.

## Several models at once

Give each model its own agent and its own project folder. One preview server over the parent folder is enough, with each agent in its own tab (remove its `.claude/launch.json` entry afterwards). Put shared changes into a base project first and copy it, so no agent edits a shared script. Agents use their own browser tab and report ratings and numbers; the main session checks the results and publishes.

## Rights

Don't recreate protected characters from a reference, and say so when one comes up. Note that models following supplied art have unsettled rights.
