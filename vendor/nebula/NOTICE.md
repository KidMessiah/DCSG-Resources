# Nebula Generator — vendored

Everything under `source/` is the **unmodified** source of the Nebula Generator by
**Morgan Gilroy (Delvar)**, copied verbatim from:

- Live: <https://delvar.github.io/nebula/>
- Repo: <https://github.com/Delvar/nebula>

It is licensed **GPL-3.0** (see `LICENSE`). Used here with the author's explicit
permission. None of those files have been edited — if you need to update them,
re-copy from upstream rather than patching in place, so this stays a clean
verbatim vendor.

`skyGenerator.js` is *ours*, but it is a direct adaptation of upstream's
`source/nebula.js` (the seeded configuration and the layer stack), so it is
GPL-3.0 as well. It exists because upstream drives everything off RequireJS,
`window.location.search`, and DOM elements that only its own `index.html` has;
this project needs the same pipeline as a plain function that renders into an
offscreen canvas.

The deliberate differences from upstream:

1. **Fixed render size.** Upstream sizes the render to
   `window.innerWidth/innerHeight`, and several seeded parameters (nebula
   `scale`, milky way `scale`/`nScale`) are derived from that width. Two
   people with different monitors would get two different skies from the same
   seed. We render at an explicit size instead, so a seed means one sky
   everywhere. Those parameters being *proportional* to the width also means
   rendering the same seed larger yields the same sky with more detail, not a
   different one — verified by rendering a seed at 1280×720 and 2560×1440 and
   comparing.
2. **Plain function, no DOM.** Upstream reads settings from query vars and
   writes the seed into a specific DOM node. We take an options object and
   return the canvas.
3. **`mode: 'gas'`.** Skips the three star layers *and* both vignettes,
   leaving only the milky way and the nebulae.

   The stars are drawn as real 3D geometry instead, because they're 1px
   features that turn to mush when a texture containing them is stretched
   over a dome. See `generateStarField`, which replays his sampling loops to
   get the stars as data; his bright stars still go through
   `LayerBrightStar` untouched.

   The vignettes come out because a vignette belongs to a *frame*. Upstream
   displays one fixed rectangular image, so baking them in is correct there.
   Here the texture is wrapped on a dome the viewer pans around, so a baked
   vignette travels with the stars and reads as a dark ring hanging in space
   rather than as falloff at the edge of the picture. The widget draws its
   own in CSS, fixed to the viewport.

   They're also fragile at near-square aspects: his second vignette runs from
   `min(w,h)/2` to `max(w,h)/2 * 0.9`, which is a 324px falloff at his 16:9
   but narrows to 48px at the ~1.15:1 the widget now renders — a hard-edged
   ring rather than a gradient.
4. **Lazy layer construction.** Upstream builds every layer before processing
   any of them. `LayerNebula3` allocates six full-resolution `Float32Array`s
   in its constructor (~266MB each at 3840×2160), so with up to four nebulae
   that approach exceeds a gigabyte before a single pixel is computed. We
   build each layer immediately before processing it and drop it once it has
   been drawn, which also means compositing incrementally rather than
   redrawing every layer after each one finishes. Same output, same order;
   measured peak heap for a 4K bake is ~620MB.

`mode: 'all'` still produces upstream's full stack, unchanged, for reference
and comparison — only `'gas'` makes the substitutions above.

`source/Random/SeedRandom.js` is David Bau's seedrandom (MIT) — its own licence
header is intact at the top of that file.
