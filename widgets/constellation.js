/*
Constellation Map.

The sky is Delvar's Nebula Generator (Morgan Gilroy,
https://delvar.github.io/nebula/), vendored verbatim under vendor/nebula/ and
used with permission - see vendor/nebula/NOTICE.md.

His generator produces a flat 2D image, and it's split in two here rather
than used whole, because the two halves of it want opposite treatment:

  - The gas (milky way, nebulae, vignettes) stays a texture, mapped onto a
    shallow spherical cap centred on the viewer. It's diffuse, so it takes
    magnification gracefully.
  - The stars do not. His point stars are single pixels and his big stars
    are 0.5-2px gradients; stretched over a dome they turn to mush, and they
    were the whole reason this read as low resolution. So they're rebuilt as
    real geometry from the same seeded sampling, drawn at screen resolution.
    His bright stars keep his renderer entirely - each one is still drawn by
    LayerBrightStar, just onto a bigger canvas used as a 3D sprite.

Everything - stars, gas, constellations - sits at a real radius, and the
camera translates slightly as well as rotating. That last part is load
bearing: under pure rotation a camera projects near and far points
identically, so without the drift all this depth would be invisible and the
scene would look like a flat panorama no matter how it was built.

The constellations from content/constellations.json sit in front, each star
with its own direction AND radius, so a constellation is a shape with real
thickness rather than a billboard. Shapes/lore are edited with
tools/constellation_editor.py.

Everything is derived from one seed string, so a given seed is one specific
sky - same nebulae, same stars, same depths, every load, on every machine.
*/
window.renderWidget = function (container) {
  const THREE_CDN = 'https://unpkg.com/three@0.160.0/build/three.module.js';
  const CHART_URL = 'content/constellations.json';
  // Relative to THIS script (widgets/), not to the page - a dynamic import()
  // inside a classic script resolves against the script's own URL. Kept
  // relative rather than root-absolute so the site still works if it's ever
  // served from a subpath.
  const SKY_MODULE = '../vendor/nebula/skyGenerator.js';
  const SUNCALC_MODULE = '../vendor/suncalc/suncalc.js';

  // --- The canonical sky -------------------------------------------------
  // While these are both null the widget is in "exploration" mode: it shows
  // the seed bar, defaults to DEFAULT_SEED below, and lets you reroll to
  // browse other skies - "New sky" for a random one, "Negresh" to jump
  // straight back to the default. To lock the sky in permanently (hides the
  // seed bar, no more exploring):
  //
  //   1. Reroll until you like it. Note the seed shown in the bar.
  //   2. Hit "Save PNG" - that re-renders the gas at full bake resolution
  //      (slow, once) and downloads it. Put the file in images/.
  //   3. Set BOTH constants below: the seed, and the path to that PNG.
  //
  // Both are needed. The PNG is only the nebulae and milky way; the stars
  // are no longer baked into it - they're real geometry generated from the
  // seed at load time, which is what makes them stay sharp. Setting the seed
  // alone works too, but then every visitor pays the full gas render.
  // Either one hides the seed bar: once there's a canonical sky, there's
  // nothing left to choose.
  const CANONICAL_SEED = null;
  const CANONICAL_SKY_IMAGE = null; // e.g. 'images/sky-canonical.png'

  // The seed the page opens on while still in exploration mode - not locked
  // in via CANONICAL_SEED above (the seed bar and "New sky" stay available),
  // just the starting point every visit resets to. Previously this defaulted
  // to a random seed remembered in localStorage across reloads (so a hunt
  // for a good seed wouldn't get lost to an accidental refresh); now that
  // there's a specific favourite, that's a worse default than just always
  // starting there, so the localStorage-remembering was dropped in favour of
  // this fixed value plus the "Negresh" button as the way back after
  // exploring.
  const DEFAULT_SEED = '70f729fd';

  const LOCKED = !!(CANONICAL_SEED || CANONICAL_SKY_IMAGE);

  // --- Sky dome ----------------------------------------------------------
  // The cap's angular size. Pitch is chosen first and yaw follows from the
  // texture's aspect ratio, so the sky's pixels stay square on the dome
  // instead of being stretched one way.
  // Sized from what has to be covered, not picked by eye. The pan limits are
  // this minus everything that can push the view outward - half the field of
  // view, the rubber-band overshoot, the camera sway, and a little slack - so
  // the dome has to be big enough that what's left over is still a generous
  // amount of look-around. See updateLookLimits.
  const DOME_PITCH_SPAN = 126;
  const DOME_RADIUS = 400;

  // How far past the pan limit a drag can rubber-band, in degrees. This is a
  // hard ceiling, not a rate: the dome has to physically cover the overshoot,
  // so it can't be allowed to grow without bound the way a plain linear
  // "limit + over * factor" does.
  const SOFT_OVERSHOOT = 6;
  const DOME_SEGMENTS_X = 96;
  const DOME_SEGMENTS_Y = 56;

  const CAMERA_FOV = 45;

  // Stars beyond Delvar's own seeded density.
  //
  // These were previously hand-picked (3.2/1.6) to make the field feel less
  // sparse, but "feel less sparse" turned out to still be a real, measurable
  // deficit: his renderer paints a flat image that fills the whole screen,
  // so every star he generates is always on screen. Ours are spread across
  // a full pannable dome (144.8x126 degrees) that the 45-degree camera only
  // ever shows about 9.9% of at once - so even a healthy total star count
  // across the dome translates to far fewer stars actually landing in view
  // at any given moment.
  //
  // Point and big stars get the SAME multiplier here, not independently
  // tuned ones: his own formula ties big-star count to point-star count via
  // a fixed 0.5% ratio (both driven by the one seeded density value), so
  // matching his on-screen density means matching that ratio too - scaling
  // them by different amounts (as a previous, narrower request did) drifts
  // away from his proportions rather than toward them.
  //
  // The number itself: solve (REF_W*REF_H*density*M)*fractionVisible ==
  // viewW*viewH*density for M, using this widget's own actual geometry
  // (1280x720 reference render, ~9.9% of the dome visible at the measured
  // viewport) - the density term cancels out of both sides, which is what
  // makes one M correct for both categories. Comes out to ~11.5; that's
  // roughly 3.6x more point stars and 7.2x more big stars than before.
  const POINT_STAR_DENSITY_MULTIPLIER = 11.5;
  const BIG_STAR_DENSITY_MULTIPLIER = 11.5;

  // Two separate figures, because a constellation's size and its position no
  // longer come from the same scale.
  //
  // SHAPE is how big each constellation is drawn: a single degrees-per-pixel
  // applied to both axes, since using separate scales would squash the
  // shapes. SPREAD is how far apart their centres are placed. Keeping SPREAD
  // smaller pulls the whole chart into comfortable reach without shrinking
  // any of the constellations to get it there.
  const CHART_SHAPE_DEGREES = 80;
  const CHART_SPREAD_DEGREES = 74;

  // Radians/second ceiling for the slow rotation given to bright-star and
  // anchor flare sprites (see registerSpriteTwinkle / applySpriteTwinkle).
  // At this speed a full rotation takes 1.5-6.5 minutes depending on each
  // star's own random draw - deliberately glacial, matching SWAY_SPEED's
  // philosophy: something you notice happening, not something you can
  // watch spin.
  const ROTATION_SPEED = 0.065;

  // Each constellation gets one anchor star - a bigger, spiked one, drawn by
  // Delvar's own bright-star renderer. Angular diameter, so it stays the
  // right size on screen whatever the viewport.
  const ANCHOR_ANGULAR_SIZE = 1.4;

  // Constellations sit well inside the dome, each star at its own radius.
  const CONSTELLATION_RADIUS = 150;
  const CONSTELLATION_DEPTH_JITTER = 0.07; // fraction of radius, +/-

  // Delvar's star layers, drawn as real geometry instead of baked pixels.
  // Spread through the volume between the constellations and the dome.
  const STAR_RADIUS_NEAR = 180;
  const STAR_RADIUS_FAR = 385;

  // Ceiling on a sky bright star's angular size. Delvar sizes these as a
  // fraction of his reference image's width, which was a reasonable "big
  // dramatic flare" on a normal ~45-90 degree picture; mapped directly onto
  // this dome's ~145-degree span, that same fraction balloons - measured
  // across several seeds, most bright stars land around 2-3 degrees, but the
  // occasional one (whichever star happened to draw a large glowRadius) hits
  // 15-26 degrees, big enough to dominate most of a screen. This clamps only
  // that long tail; ordinary-sized bright stars are well under it already
  // and are untouched.
  const BRIGHT_STAR_MAX_ANGULAR_SIZE = 3.2;

  // The milky way's own stars sit in a shell BEYOND the ordinary star field,
  // so it reads as a distant galaxy behind the local sky rather than as
  // something suspended in front of it.
  const MILKY_WAY_RADIUS_NEAR = 388;
  const MILKY_WAY_RADIUS_FAR = 397;

  // How much of the milky way's diffuse gas survives into the texture. At
  // full strength it is bright enough to fog the whole sky and flatten
  // everything else; its interest is in its stars, not its haze.
  const MILKY_WAY_GAS_OPACITY = 0.32;

  // Its stars need holding back too, which is not obvious: they arrive about
  // three times brighter than the ordinary point stars (mean channel ~0.44
  // against a median of ~0.13) and there are ~10,000 of them crammed into a
  // narrow band. At full strength they blow out additively into one solid
  // white mass - the same fog, just made of stars. Dimmed, the band resolves
  // into individual points, which is the whole idea.
  const MILKY_WAY_STAR_BRIGHTNESS = 0.45;

  // Ceiling on an individual milky way star's size, in reference-image
  // pixels. His distribution runs to 2; past roughly this the point is wide
  // enough to read as a blob instead of a star.
  const MILKY_WAY_MAX_STAR_RADIUS = 1.1;

  // Camera sway.
  //
  // Depth is invisible under a camera that only ever rotates: rotating about
  // the camera's own centre projects every point identically no matter how
  // far away it is, so without this the 3D layout would be structurally real
  // and visually indistinguishable from a flat panorama. A small translation
  // is what turns the depth into something you can actually see - near stars
  // sliding against far ones and against the gas behind.
  const SWAY_IDLE = 5;   // world units, slow ambient drift
  const SWAY_LOOK = 8;   // world units, coupled to where you're looking
  const SWAY_MAX = SWAY_IDLE + SWAY_LOOK;
  // Radians per second of the idle drift. Deliberately glacial - a full
  // cycle takes around four and a half minutes. Anything you can actually
  // watch moving reads as the page wobbling rather than as depth.
  // (SWAY_IDLE/SWAY_LOOK above control how FAR it drifts; this is only how
  // fast it gets there.)
  const SWAY_SPEED = 0.022;

  // Gas texture resolution. The nebulae and milky way are diffuse, so they
  // upscale gracefully - which is exactly why they can stay a texture while
  // the stars cannot. Preview renders small so seed-hunting stays quick;
  // the bake is what gets committed.
  //
  // The aspect ratio is NOT arbitrary and the two must match each other: the
  // dome takes its yaw span from the texture's aspect (to keep the gas's
  // pixels square), so the shape of this image is what decides how wide the
  // sky is. It's roughly 1.15:1 rather than 16:9 because the dome now has to
  // be much taller than it used to be - keeping 16:9 while growing the height
  // would have stretched the same pixels across 224 degrees of yaw and undone
  // the sharpness work. Same pixel budget, better angular density.
  const GAS_PREVIEW = { width: 1200, height: 1044 };
  const GAS_BAKE = { width: 3200, height: 2784 };

  // The image width Delvar's star sampling ran at - must match SKY_WIDTH in
  // skyGenerator.js. Star sizes are quoted in pixels of THAT image, so this
  // has to stay pinned to it and must not follow the gas resolution around.
  const STAR_REFERENCE_WIDTH = 1280;

  // --- Moon ----------------------------------------------------------------
  // Real angular diameter is ~0.5 degrees - at this dome's scale that renders
  // as a smaller, less satisfying dot than the "hero" bright stars already on
  // screen (which get capped at BRIGHT_STAR_MAX_ANGULAR_SIZE, 3.2 degrees).
  // True-to-scale would be an anticlimax for something meant to be the sky's
  // one big, deliberate, lit object, so this is sized to read clearly as
  // bigger and more solid than the biggest star instead - artistic license,
  // not an error.
  const MOON_ANGULAR_SIZE = 4.6;
  const MOON_RADIUS = 170; // world-space distance; inside the ordinary star shell

  // Equirectangular texture resolution for the crater/normal maps. The moon
  // only ever covers a few dozen pixels on screen (see MOON_ANGULAR_SIZE
  // above), so this is well past what's visible - generous headroom rather
  // than a measured need, since generation is a one-off, sub-second cost.
  const MOON_TEXTURE_WIDTH = 512;
  const MOON_TEXTURE_HEIGHT = 256;

  // --- Widget shell ------------------------------------------------------
  container.classList.add('constellation-tool');
  container.innerHTML = `
    <div class="cm-header">
      <p class="cm-instructions">Drag to look around the sky. Hover a constellation for its name and lore.</p>
      <div class="cm-seedbar" id="cm-seedbar"${LOCKED ? ' hidden' : ''}>
        <span class="cm-seed-label">seed</span>
        <code class="cm-seed" id="cm-seed"></code>
        <button type="button" class="cm-btn" id="cm-reroll" title="The canonical Negreshian sky uses seed ${DEFAULT_SEED}. If you regenerate and want to return to it, just click the Negresh button.">New sky</button>
        <button type="button" class="cm-btn" id="cm-negresh" title="Return to the canonical Negreshian sky (seed ${DEFAULT_SEED}).">Negresh</button>
        <button type="button" class="cm-btn" id="cm-save">Save PNG</button>
      </div>
    </div>
    <div class="cm-stage-wrap" id="cm-stage-wrap">
      <div class="cm-stage" id="cm-stage"></div>
      <div class="cm-loading" id="cm-loading">
        <p class="cm-loading-text" id="cm-loading-text">Charting the heavens&hellip;</p>
        <div class="cm-progress"><div class="cm-progress-bar" id="cm-progress-bar"></div></div>
      </div>
      <div class="cm-tooltip" id="cm-tooltip" hidden>
        <p class="cm-tooltip-name" id="cm-tooltip-name"></p>
        <p class="cm-tooltip-desc" id="cm-tooltip-desc"></p>
      </div>
    </div>
    <style>${CONSTELLATION_STYLE}</style>
  `;

  const stageWrapEl = container.querySelector('#cm-stage-wrap');
  const stageEl = container.querySelector('#cm-stage');
  const loadingEl = container.querySelector('#cm-loading');
  const loadingTextEl = container.querySelector('#cm-loading-text');
  const progressBarEl = container.querySelector('#cm-progress-bar');
  const tooltipEl = container.querySelector('#cm-tooltip');
  const tooltipNameEl = container.querySelector('#cm-tooltip-name');
  const tooltipDescEl = container.querySelector('#cm-tooltip-desc');
  const seedEl = container.querySelector('#cm-seed');
  const rerollBtn = container.querySelector('#cm-reroll');
  const negreshBtn = container.querySelector('#cm-negresh');
  const saveBtn = container.querySelector('#cm-save');

  // Keep the stage within the visible viewport, same approach as the
  // Flanking Tool: measure what's left below it and clamp, so the tool never
  // forces vertical scrolling just to be usable.
  function updateStageSize() {
    const top = stageWrapEl.getBoundingClientRect().top;
    const available = window.innerHeight - top - 24;
    stageWrapEl.style.height = Math.max(360, available) + 'px';
  }
  updateStageSize();

  let onResize = () => {};
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      updateStageSize();
      onResize();
    }, 100);
  });

  const deg = d => d * Math.PI / 180;

  // Direction on the unit sphere for a (yaw, pitch) in radians. Yaw turns
  // right, pitch turns up, forward is -Z - matching the camera's YXZ order
  // so the drag maths and the placement maths agree.
  function directionFor(yaw, pitch, target) {
    return target.set(
      Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      -Math.cos(yaw) * Math.cos(pitch)
    );
  }

  // --- Bootstrap ---------------------------------------------------------
  let currentSeed = CANONICAL_SEED;
  let skyView = null; // the handle initScene returns, so reroll can swap the texture

  Promise.all([
    import(THREE_CDN),
    fetch(CHART_URL).then(r => {
      if (!r.ok) throw new Error(`${CHART_URL}: ${r.status}`);
      return r.json();
    }),
    import(SKY_MODULE),
    import(SUNCALC_MODULE)
  ]).then(async ([THREE, chart, sky, sunCalc]) => {
    // A seed is always needed, even when the gas comes from a baked PNG: the
    // stars aren't in that PNG any more, they're generated from the seed.
    // Every visit starts on DEFAULT_SEED while unlocked - "New sky" wanders
    // off it, "Negresh" jumps straight back.
    if (!currentSeed) currentSeed = DEFAULT_SEED;

    const skyTexture = await buildSkyTexture(THREE, sky);
    const starField = await sky.generateStarField({
      seed: currentSeed,
      pointStarDensityMultiplier: POINT_STAR_DENSITY_MULTIPLIER,
      bigStarDensityMultiplier: BIG_STAR_DENSITY_MULTIPLIER
    });
    starField.milkyWayStars = await sky.generateMilkyWayStars({ seed: currentSeed });
    // One anchor star per constellation. Keyed off the constellation's index
    // rather than the sky's seed, so rerolling the sky leaves them alone -
    // they belong to the constellations, not to the nebulae.
    const anchorSprites = await Promise.all(chart.constellations.map((c, i) =>
      sky.makeBrightStarSprite({
        seed: `anchor-${i}`,
        // Around the same gold as the constellation lines, varied slightly
        // so nineteen identical stars don't read as a repeated stamp.
        hue: 0.09 + hash01(`anchor-hue|${i}`) * 0.05,
        brightness: 0.75 + hash01(`anchor-bright|${i}`) * 0.25
      })
    ));
    loadingEl.hidden = true;
    skyView = initScene(THREE, chart, skyTexture, starField, anchorSprites, sunCalc);

    if (!LOCKED) wireSeedControls(THREE, sky);
  }).catch(err => {
    console.error('Failed to load the Constellation Map:', err);
    loadingTextEl.textContent = 'Could not load the star field.';
    progressBarEl.parentNode.hidden = true;
  });

  // --- Sky texture -------------------------------------------------------

  let generationToken = 0;
  // Filled in once the renderer exists (it's the only thing that knows the
  // GPU's limit). The very first texture is built before that, so initScene
  // re-applies it to whatever it was handed.
  let maxAnisotropy = 1;

  async function buildSkyTexture(THREE, sky) {
    if (CANONICAL_SKY_IMAGE) {
      loadingTextEl.textContent = 'Loading the sky…';
      progressBarEl.parentNode.hidden = true;
      const texture = await new THREE.TextureLoader().loadAsync(CANONICAL_SKY_IMAGE);
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    }
    return generateSkyTexture(THREE, sky, currentSeed);
  }

  // Renders only the gas - milky way, nebulae, vignettes. The star layers are
  // deliberately excluded; they come back as 3D geometry instead.
  async function generateGas(sky, seed, size, label) {
    const token = ++generationToken;
    loadingEl.hidden = false;
    progressBarEl.parentNode.hidden = false;

    const result = await sky.generateSky({
      seed,
      mode: 'gas',
      milkyWayOpacity: MILKY_WAY_GAS_OPACITY,
      width: size.width,
      height: size.height,
      onProgress: (done, total) => {
        loadingTextEl.textContent = `${label} ${done}/${total}`;
        progressBarEl.style.width = (done / total * 100) + '%';
      },
      // A reroll while a render is in flight abandons it rather than letting
      // two renders race to install their texture.
      isCancelled: () => token !== generationToken || !stageEl.isConnected
    });
    return result;
  }

  async function generateSkyTexture(THREE, sky, seed) {
    if (seedEl) seedEl.textContent = seed;
    const result = await generateGas(sky, seed, GAS_PREVIEW, 'Charting the heavens…');
    if (!result) return null;
    return makeGasTexture(THREE, result.canvas);
  }

  function makeGasTexture(THREE, canvas) {
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    // The dome is viewed at a slant near its edges, where plain mipmapping
    // smears the gas badly; anisotropy is most of why a big texture actually
    // looks big rather than just costing more memory.
    texture.anisotropy = maxAnisotropy;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    texture.userData.canvas = canvas;
    return texture;
  }

  function wireSeedControls(THREE, sky) {
    seedEl.textContent = currentSeed;

    function setButtonsDisabled(disabled) {
      rerollBtn.disabled = disabled;
      negreshBtn.disabled = disabled;
      saveBtn.disabled = disabled;
    }

    // Shared by "New sky" and "Negresh" - the only difference between them
    // is which seed they hand in (random vs DEFAULT_SEED), everything after
    // that (regenerate stars + gas preview, swap into the live scene) is
    // identical.
    async function applySeed(seed) {
      currentSeed = seed;
      seedEl.textContent = currentSeed;
      setButtonsDisabled(true);
      const [texture, starField, milkyWayStars] = await Promise.all([
        generateSkyTexture(THREE, sky, currentSeed),
        sky.generateStarField({
          seed: currentSeed,
          pointStarDensityMultiplier: POINT_STAR_DENSITY_MULTIPLIER,
          bigStarDensityMultiplier: BIG_STAR_DENSITY_MULTIPLIER
        }),
        sky.generateMilkyWayStars({ seed: currentSeed })
      ]);
      if (starField) starField.milkyWayStars = milkyWayStars;
      setButtonsDisabled(false);
      if (texture && skyView) {
        skyView.setSky(texture, starField);
        loadingEl.hidden = true;
      }
    }

    rerollBtn.addEventListener('click', () => applySeed(sky.randomSeed()));

    negreshBtn.addEventListener('click', () => {
      // Already looking at it - a full regenerate would just be a ~6-8s wait
      // to end up back where you started.
      if (currentSeed === DEFAULT_SEED) return;
      applySeed(DEFAULT_SEED);
    });

    // Re-renders the gas from scratch at bake resolution rather than saving
    // what's on screen: the preview is deliberately small, and a 1280-wide
    // PNG is exactly the low-resolution backdrop this was all meant to fix.
    // Same seed, so it's the same sky - just resolved properly.
    saveBtn.addEventListener('click', async () => {
      setButtonsDisabled(true);
      const result = await generateGas(
        sky, currentSeed, GAS_BAKE,
        `Baking ${GAS_BAKE.width}×${GAS_BAKE.height} (this takes a minute)…`
      );
      setButtonsDisabled(false);
      loadingEl.hidden = true;
      if (!result) return;

      // Swap the freshly-baked, much sharper texture in while we're here -
      // no reason to keep looking at the preview once it exists.
      if (skyView) skyView.setSky(makeGasTexture(THREE, result.canvas), null);

      const link = document.createElement('a');
      link.download = `sky-${currentSeed}.png`;
      link.href = result.canvas.toDataURL('image/png');
      link.click();
    });
  }

  // --- Scene -------------------------------------------------------------

  // Turns Delvar's star data into real geometry. Positions arrive normalised
  // across his image, so they map onto the dome's angular span and land
  // exactly where his composite would have drawn them - but each star also
  // gets a radius, and gets drawn at screen resolution rather than baked
  // into a texture that then has to be stretched.
  function buildStarField(THREE, starField, domeYawSpan, domePitchSpan) {
    const group = new THREE.Group();
    const dir = new THREE.Vector3();

    // Feature sizes are quoted in units of one pixel of Delvar's reference
    // image; this converts that to a world-space size at a given radius, so
    // a star covers the same slice of sky it did in his composite no matter
    // what the gas texture's resolution or the viewport happen to be.
    const radPerImagePixel = domeYawSpan / STAR_REFERENCE_WIDTH;

    function place(u, v, radius, target) {
      const yaw = (u - 0.5) * domeYawSpan;
      const pitch = (0.5 - v) * domePitchSpan;
      return directionFor(yaw, pitch, target).multiplyScalar(radius);
    }

    function makePoints(positions, colors, worldSizes, phases, speeds, twinkleAmount, sparkleExponent = 1.6) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
      geometry.setAttribute('aWorldSize', new THREE.BufferAttribute(worldSizes, 1));
      geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
      geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
      const material = new THREE.ShaderMaterial({
        uniforms: {
          // Converts a world-space size at distance z into pixels. Set from
          // the drawing buffer, so it stays correct across resizes and on
          // high-DPI screens instead of assuming a fixed viewport.
          uPixelScale: { value: 1 },
          uTime: { value: 0 },
          uTwinkle: { value: twinkleAmount },
          // How sharply the twinkle reshapes into brief glints vs a smooth
          // pulse - higher is punchier/more "obvious". Per-material rather
          // than a shared constant, so turning this up for the ordinary
          // point-star field doesn't also change the big stars' or the
          // milky way's already-tuned character.
          uSparkle: { value: sparkleExponent }
        },
        vertexShader: `
          attribute vec3 aColor;
          attribute float aWorldSize;
          attribute float aPhase;
          attribute float aSpeed;
          uniform float uPixelScale;
          uniform float uTime;
          uniform float uTwinkle;
          uniform float uSparkle;
          varying vec3 vColor;
          void main() {
            // Every star gets its own phase AND its own rate. A shared rate
            // makes forty thousand stars pulse in unison, which reads as the
            // whole sky breathing rather than as scintillation.
            //
            // Two frequencies, not one: a single sine breathes smoothly in
            // and out, which reads as mechanical at any amplitude. Summing a
            // second, faster component (weighted so the pair still can't
            // leave [-1,1]) beats the two against each other, so no two
            // cycles look quite alike. The pow() on top then reshapes that
            // into brief glints with longer dim stretches between - closer
            // to how a star actually sparkles - rather than a slow, even
            // breathing pulse.
            float w1 = sin(uTime * aSpeed + aPhase);
            float w2 = sin(uTime * aSpeed * 2.3 + aPhase * 1.7);
            float raw = w1 * 0.7 + w2 * 0.3;
            float tw = pow(0.5 + 0.5 * raw, uSparkle);
            float brightness = mix(1.0 - uTwinkle, 1.0, tw);
            vColor = aColor * brightness;

            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            // Size follows brightness a little, not just colour - a star
            // flaring only in intensity looks like a dimmer switch, whereas
            // real scintillation makes it visibly swell and shrink too.
            float size = aWorldSize * (0.88 + 0.24 * tw);
            gl_PointSize = max(1.0, size * uPixelScale / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
        fragmentShader: `
          varying vec3 vColor;
          void main() {
            // Profile computed here rather than sampled from a glow sprite.
            // A star lands on 2-4 pixels; a soft radial-gradient texture
            // spread across that many pixels IS the blur, and sampling a
            // 128px texture down to 2px adds mip filtering on top. Doing it
            // analytically gives a core that stays at full intensity instead
            // of falling off from the very centre outwards.
            float r = length(gl_PointCoord - 0.5) * 2.0;
            if (r > 1.0) discard;
            // A single power-law falloff, not a two-part core+halo with a
            // min(1,...) clamp. The clamp is what kept reintroducing a
            // splotch: two attempts at a "peaked with a halo" profile both
            // turned out to clamp to solid 1.0 out to 20-30% of the radius
            // once the halo term was large enough to matter, which is the
            // same flat disc under a different name. A pure pow(1-r, p) has
            // no flat region anywhere at any p - it's strictly decreasing
            // from the instant r leaves 0.
            //
            // The exponent is NOT free to pick for "brightest possible" -
            // there's a real tradeoff against how far the visible glow
            // reaches (how "blurry" a star with more than a couple of
            // pixels of footprint looks), and going all the way to p=0.8 for
            // maximum total brightness pushed the tail out to r=0.94 -
            // fine for a 2px point star (nothing to see past r=0.5 of a
            // 2px sprite anyway), but very visible on anything bigger,
            // which above all meant the milky way's ~10,000 stars (there
            // are only 67 of the ordinary "big stars" for comparison).
            // p=1.6 pulls that back to r=0.76 - matching, almost exactly,
            // the tail length of the profile that was in place (and NOT
            // reported as blurry) before the brightness fix - at the cost
            // of carrying 84% of that profile's energy rather than 100%.
            // The missing density is made up separately, in world-size, for
            // the point/big stars specifically (see psSize/bsSize below) -
            // deliberately NOT here, and NOT for the milky way, so fixing
            // "outside the band looks sparse" doesn't reintroduce blur on
            // the ten thousand stars where it's most visible.
            float alpha = pow(1.0 - r, 1.6);

            // Colour must NOT be pre-multiplied here. Additive blending
            // already scales by alpha (src.rgb * src.a + dst), so folding
            // alpha into the colour as well squares the falloff - which
            // silently crushes the dim end of the field, and most of
            // Delvar's point stars are dim (median lightness ~0.13).
            gl_FragColor = vec4(vColor, alpha);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const points = new THREE.Points(geometry, material);
      points.frustumCulled = false; // one draw call either way; culling a
                                    // whole-sky cloud by its bounds is pointless
      return { points, material };
    }

    const pixelScaleMaterials = [];
    const timeMaterials = [];
    const twinkleSprites = [];

    // Twinkle rate, in radians per second. Spread wide so no two neighbours
    // keep time with each other. Seeded off the star's index like everything
    // else here, so a canonical sky twinkles identically every load.
    function twinkleSpeed(key, min, max) {
      return min + hash01(key) * (max - min);
    }

    // -- Point stars: his single pixels --
    const ps = starField.pointStars;
    const psPos = new Float32Array(ps.count * 3);
    const psCol = new Float32Array(ps.count * 3);
    const psSize = new Float32Array(ps.count);
    const psPhase = new Float32Array(ps.count);
    const psSpeed = new Float32Array(ps.count);
    for (let i = 0; i < ps.count; i++) {
      const radius = STAR_RADIUS_NEAR + hash01(`ps|${i}`) * (STAR_RADIUS_FAR - STAR_RADIUS_NEAR);
      place(ps.positions[i * 2], ps.positions[i * 2 + 1], radius, dir);
      psPos[i * 3] = dir.x; psPos[i * 3 + 1] = dir.y; psPos[i * 3 + 2] = dir.z;
      // His brightness runs past 1; the excess widens the star slightly,
      // which is how the bright tail reads on a real long exposure.
      const boost = Math.min(2.2, Math.max(0.6, ps.brightness[i]));
      psCol[i * 3] = ps.colors[i * 3];
      psCol[i * 3 + 1] = ps.colors[i * 3 + 1];
      psCol[i * 3 + 2] = ps.colors[i * 3 + 2];
      // Under one image pixel of nominal size: the glow sprite spreads a
      // point into a soft halo, so matching his 1px hard-edged dot literally
      // renders as a blob roughly twice the size it should be.
      //
      // The +35% here (0.55->0.75, 0.22->0.30) makes up for the alpha
      // profile above being tightened to fix blur on the milky way's stars:
      // that tightening cost real total brightness (energy ~roughly halves
      // for a fixed sprite size), which is exactly the "sparse outside the
      // band" complaint if left uncompensated. Recovered here rather than
      // in the shared shape, and NOT applied to the milky way's own stars
      // (mwSize below, unchanged) - the milky way needed tightening, not
      // more brightness; the ordinary field needed the opposite.
      psSize[i] = radius * radPerImagePixel * (0.75 + boost * 0.30);
      psPhase[i] = hash01(`ps-phase|${i}`) * Math.PI * 2;
      psSpeed[i] = twinkleSpeed(`ps-speed|${i}`, 0.5, 1.7);
    }
    // The smallest stars twinkle hardest - that's how scintillation actually
    // works, since a fainter star has less light to average out the
    // atmosphere's wobble.
    //
    // Amount 0.5->0.85 and sparkle exponent 1.6->2.3: asked to make the
    // flicker on the ordinary field more obvious. Both levers are per-
    // material (see makePoints), so this doesn't touch the big stars' or
    // the milky way's twinkle, which were deliberately tuned steadier and
    // aren't what was called out here.
    const psBuilt = makePoints(psPos, psCol, psSize, psPhase, psSpeed, 0.85, 2.3);
    group.add(psBuilt.points);
    pixelScaleMaterials.push(psBuilt.material);
    timeMaterials.push(psBuilt.material);

    // -- Big stars: his 0.5-2px radial gradients --
    const bs = starField.bigStars;
    const bsPos = new Float32Array(bs.count * 3);
    const bsCol = new Float32Array(bs.count * 3);
    const bsSize = new Float32Array(bs.count);
    const bsPhase = new Float32Array(bs.count);
    const bsSpeed = new Float32Array(bs.count);
    for (let i = 0; i < bs.count; i++) {
      const radius = STAR_RADIUS_NEAR + hash01(`bs|${i}`) * (STAR_RADIUS_FAR - STAR_RADIUS_NEAR);
      place(bs.positions[i * 2], bs.positions[i * 2 + 1], radius, dir);
      bsPos[i * 3] = dir.x; bsPos[i * 3 + 1] = dir.y; bsPos[i * 3 + 2] = dir.z;
      bsCol[i * 3] = bs.colors[i * 3];
      bsCol[i * 3 + 1] = bs.colors[i * 3 + 1];
      bsCol[i * 3 + 2] = bs.colors[i * 3 + 2];
      // His radius is the gradient's radius, so the drawn star is twice that
      // across - but the same halo caveat as the point stars applies, so this
      // lands a little under 2x rather than over it. Same +35% as psSize,
      // same reason - see the comment there.
      bsSize[i] = radius * radPerImagePixel * bs.radii[i] * 2.2;
      bsPhase[i] = hash01(`bs-phase|${i}`) * Math.PI * 2;
      bsSpeed[i] = twinkleSpeed(`bs-speed|${i}`, 0.3, 0.95);
    }
    // Less than the point stars: these are the brighter ones, and they
    // should look steadier than the faint carpet behind them.
    const bsBuilt = makePoints(bsPos, bsCol, bsSize, bsPhase, bsSpeed, 0.34);
    group.add(bsBuilt.points);
    pixelScaleMaterials.push(bsBuilt.material);
    timeMaterials.push(bsBuilt.material);

    // -- Milky way stars: the galaxy's own field --
    // Placed in a shell beyond the ordinary stars, so it sits behind them as
    // a distant galaxy rather than among them. They twinkle like everything
    // else now; baked into the gas texture they were the one star layer that
    // still couldn't.
    const mw = starField.milkyWayStars;
    if (mw && mw.count) {
      const mwPos = new Float32Array(mw.count * 3);
      const mwCol = new Float32Array(mw.count * 3);
      const mwSize = new Float32Array(mw.count);
      const mwPhase = new Float32Array(mw.count);
      const mwSpeed = new Float32Array(mw.count);
      for (let i = 0; i < mw.count; i++) {
        const radius = MILKY_WAY_RADIUS_NEAR + hash01(`mw|${i}`) * (MILKY_WAY_RADIUS_FAR - MILKY_WAY_RADIUS_NEAR);
        place(mw.positions[i * 2], mw.positions[i * 2 + 1], radius, dir);
        mwPos[i * 3] = dir.x; mwPos[i * 3 + 1] = dir.y; mwPos[i * 3 + 2] = dir.z;
        mwCol[i * 3] = mw.colors[i * 3] * MILKY_WAY_STAR_BRIGHTNESS;
        mwCol[i * 3 + 1] = mw.colors[i * 3 + 1] * MILKY_WAY_STAR_BRIGHTNESS;
        mwCol[i * 3 + 2] = mw.colors[i * 3 + 2] * MILKY_WAY_STAR_BRIGHTNESS;
        // His radius comes from betweenPow(0.4, 2, 4.5): mostly near 0.4, but
        // with a tail that puts about a fifth of ten thousand stars above 1.
        // In his raster that tail was lost in the haze; sharp and dimmed it
        // reads as a scattering of blobs through the band, so it's clamped.
        // These are a distant galaxy's stars - none of them should be one of
        // the bigger objects in the sky.
        // Same 1.6 as the big stars - only the tail is clamped, so the bulk
        // of the field keeps the size it had rather than the whole galaxy
        // shrinking to fix a problem that was only ever in the top fifth.
        const grainRadius = Math.min(mw.radii[i], MILKY_WAY_MAX_STAR_RADIUS);
        mwSize[i] = radius * radPerImagePixel * grainRadius * 1.6;
        mwPhase[i] = hash01(`mw-phase|${i}`) * Math.PI * 2;
        mwSpeed[i] = twinkleSpeed(`mw-speed|${i}`, 0.35, 1.15);
      }
      // Twinkling hard, like the point stars: these are the faint distant
      // ones, and a galaxy that shimmers reads far better than a static haze.
      const mwBuilt = makePoints(mwPos, mwCol, mwSize, mwPhase, mwSpeed, 0.5);
      group.add(mwBuilt.points);
      pixelScaleMaterials.push(mwBuilt.material);
      timeMaterials.push(mwBuilt.material);
    }

    // -- Bright stars: his sprite canvases, unchanged, now in 3D --
    // His z was only ever used to fake lighting depth against the nebulae.
    // It makes a perfectly good real depth, so it becomes one: the data was
    // already three-dimensional, it just had nowhere to go.
    starField.brightStars.forEach((star, i) => {
      const t = Math.min(1, star.z / 2);
      const radius = STAR_RADIUS_FAR - t * (STAR_RADIUS_FAR - STAR_RADIUS_NEAR);
      const texture = new THREE.CanvasTexture(star.canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;

      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      }));
      place(star.x, star.y, radius, dir);
      sprite.position.copy(dir);
      // worldSize/radius is the sprite's actual angular size (the radius
      // cancels for a billboard), so the cap is applied on that ratio, not
      // on worldSize itself.
      const angularSize = Math.min(star.widthFraction * domeYawSpan, deg(BRIGHT_STAR_MAX_ANGULAR_SIZE));
      const worldSize = radius * angularSize;
      sprite.scale.set(worldSize, worldSize, 1);
      group.add(sprite);

      // Sprites can't use the points shader, so these twinkle from JS. There
      // are only a couple of dozen, so a per-frame write costs nothing.
      //
      // This used to drive material.opacity alone, at a small amplitude, and
      // was reported as basically invisible on the bigger stars. That
      // tracks: these sprites' bright core is a near-opaque white pixel
      // (Delvar draws it at alpha up to his `brightness` parameter, often
      // close to 1), so a 14% opacity swing on an already near-saturated,
      // additively-blended core barely moves the rendered pixel - opacity
      // was the wrong lever to pull hardest on. Scale is unambiguous: it's a
      // real geometric change, visible regardless of how bright or clipped
      // the core is. So this now varies both, with scale doing most of the
      // visible work.
      // Still held back relative to the ordinary star field (which swings
      // 50%) - big stars ought to scintillate less than faint ones, just not
      // so little it reads as static.
      registerSpriteTwinkle(sprite, `bright-${i}`, 0.32, 0.175, 0.45);
    });

    group.userData.pixelScaleMaterials = pixelScaleMaterials;
    group.userData.timeMaterials = timeMaterials;
    group.userData.twinkleSprites = twinkleSprites;
    return group;

    function registerSpriteTwinkle(sprite, key, amount, minSpeed, maxSpeed) {
      // Signed: about half the flares drift clockwise, half counter, so a
      // cluster of bright stars doesn't all spin the same way in lockstep.
      const rotSpeed = (hash01(`${key}-rot`) - 0.5) * 2 * ROTATION_SPEED;
      twinkleSprites.push({
        sprite,
        material: sprite.material,
        baseScale: sprite.scale.x,
        phase: hash01(`${key}-phase`) * Math.PI * 2,
        speed: twinkleSpeed(`${key}-speed`, minSpeed, maxSpeed),
        rotSpeed,
        amount
      });
    }
  }

  // Applied every frame to whatever sprites were registered. Kept as a plain
  // function so the constellation anchors can share it with the sky's own
  // bright stars rather than each growing their own copy.
  function applySpriteTwinkle(list, time) {
    for (const s of list) {
      // Same two-frequency-plus-reshape sparkle as the shader-driven stars
      // (see makePoints) - kept in sync so a bright star and the faint
      // carpet behind it scintillate with the same character, not two
      // visibly different animation styles sitting next to each other.
      const w1 = Math.sin(time * s.speed + s.phase);
      const w2 = Math.sin(time * s.speed * 2.3 + s.phase * 1.7);
      const raw = w1 * 0.7 + w2 * 0.3;
      const tw = Math.pow(0.5 + 0.5 * raw, 1.6);

      s.material.opacity = 1 - s.amount + s.amount * tw;
      // Half the amplitude in scale that opacity gets - a visible pulse
      // without the star appearing to properly grow and shrink like a
      // breathing blob.
      const scale = s.baseScale * (1 - s.amount * 0.5 + s.amount * 0.5 * tw);
      s.sprite.scale.set(scale, scale, 1);

      // The actual flare/spike pattern is a texture baked once by Delvar's
      // renderer and never redrawn - without this, "twinkle" was only ever
      // the whole shape brightening and resizing as one rigid unit, which
      // reads as static no matter how lively the pulse is. A slow, ongoing
      // rotation is what makes the spikes themselves look like they're
      // doing something, for the cost of one extra float written per frame.
      s.material.rotation = time * s.rotSpeed;
    }
  }

  function disposeGroup(group) {
    group.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (obj.material.map) obj.material.map.dispose();
        obj.material.dispose();
      }
    });
  }

  function initScene(THREE, chart, skyTexture, starField, anchorSprites, sunCalc) {
    const clock = new THREE.Clock();

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(CAMERA_FOV, stageEl.clientWidth / stageEl.clientHeight, 0.1, 1000);
    // The camera drifts by a few units (see the sway in animate) but stays
    // near the origin, so "on the dome at radius R" and "facing the camera"
    // remain near enough the same thing to compute every orientation once up
    // front - the drift is small next to the radii involved.
    camera.position.set(0, 0, 0);
    camera.rotation.order = 'YXZ';

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    // Render at no less than 2x, even on a 1x display. On an ordinary
    // non-retina monitor a star works out to under two device pixels, and at
    // 1:1 there is simply nowhere to put its edge - supersampling and letting
    // the browser downscale is what buys the sub-pixel definition back. Capped
    // so genuinely high-DPI screens don't end up rendering 9x the fragments
    // for a difference nobody can see.
    renderer.setPixelRatio(Math.min(Math.max(window.devicePixelRatio || 1, 2), 2.5));
    renderer.setSize(stageEl.clientWidth, stageEl.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    stageEl.appendChild(renderer.domElement);

    maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    // The first texture was built before the renderer existed, so it missed
    // out on this.
    skyTexture.anisotropy = maxAnisotropy;
    skyTexture.needsUpdate = true;

    // --- The dome ---
    // Yaw span follows from the texture's aspect so its pixels stay square.
    const image = skyTexture.image;
    const textureAspect = (image.width || 16) / (image.height || 9);
    const domePitchSpan = deg(DOME_PITCH_SPAN);
    const domeYawSpan = domePitchSpan * textureAspect;

    const domeGeometry = buildDomeGeometry(THREE, domeYawSpan, domePitchSpan);
    const domeMaterial = new THREE.MeshBasicMaterial({
      map: skyTexture,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false
    });
    const dome = new THREE.Mesh(domeGeometry, domeMaterial);
    dome.renderOrder = -1; // strictly a backdrop; never occlude the stars
    scene.add(dome);

    // --- Look-around limits ---
    // Derived from the dome's own extent and the camera's field of view, so
    // the drag stops exactly where the edge of the sky would come into
    // frame. Recomputed on resize, since the horizontal FOV depends on the
    // stage's aspect ratio.
    //
    // Everything that can push the view further out than the nominal limit
    // has to be subtracted here, or the edge of the sky comes into frame:
    //
    //   - half the field of view (below), since the limit steers the CENTRE
    //     of the view and the frame extends past it;
    //   - the rubber-band overshoot, which a drag can reach and hold;
    //   - the camera sway, which swings the dome's edge toward the view by
    //     roughly atan(sway / radius);
    //   - a couple of degrees of slack.
    //
    // Missing the overshoot term is what previously let a long downward drag
    // pull the dome's bottom edge into shot.
    const EDGE_MARGIN = deg(2) + deg(SOFT_OVERSHOOT) + Math.atan(SWAY_MAX / DOME_RADIUS);
    let yawLimit = 0;
    let pitchLimit = 0;
    function updateLookLimits() {
      const halfVFov = deg(camera.fov) / 2;
      const halfHFov = Math.atan(Math.tan(halfVFov) * camera.aspect);

      // Pitch first, and it only needs the vertical mid-line: a corner ray is
      // further off-axis overall, but its elevation is LESS extreme than the
      // bottom-centre ray's, because the extra horizontal component
      // lengthens the ray without adding any height.
      pitchLimit = Math.max(0, domePitchSpan / 2 - halfVFov - EDGE_MARGIN);

      // Yaw is not independent of pitch, which is the part that bit us.
      // Tilting the view down swings the frame's bottom CORNERS outward in
      // azimuth: as a ray tips downward its forward component shortens, so
      // the same sideways offset subtends a much larger angle around the
      // vertical axis. At full downward pitch a corner sits ~33 degrees off
      // axis where a level camera would put it at ~20. Clamping yaw against
      // the level-camera figure therefore lets the bottom corners slide off
      // the dome while the centre and the edges are still comfortably inside
      // - which shows up as a corner-shaped sliver of missing sky, not as an
      // edge along the whole side.
      const worstPitch = pitchLimit + deg(SOFT_OVERSHOOT);
      const foreshortened = Math.cos(worstPitch) - Math.tan(halfVFov) * Math.sin(worstPitch);
      const cornerHFov = foreshortened > 0.05
        ? Math.atan(Math.tan(halfHFov) / foreshortened)
        : Math.PI / 2; // looking near-vertically; azimuth stops meaning much

      yawLimit = Math.max(0, domeYawSpan / 2 - cornerHFov - EDGE_MARGIN);
    }
    updateLookLimits();

    // --- Constellations ---
    // Both the shape scale and the layout are fitted to the chart's actual
    // content rather than its nominal image size - the shapes only occupy the
    // middle of the 2000x2000 canvas, and scaling by the canvas would leave a
    // wide empty border of sky with everything huddled in it.
    const bounds = chartBounds(chart);
    const radPerPixel = deg(CHART_SHAPE_DEGREES) / Math.max(bounds.width, bounds.height);
    const layout = relaxLayout(chart, bounds);

    const groups = [];
    const hitMeshes = [];
    const twinkleMaterials = [];
    const anchorTwinkles = [];
    const glowTexture = makeGlowTexture(THREE);

    // --- Delvar's stars, as geometry ---
    let starGroup = buildStarField(THREE, starField, domeYawSpan, domePitchSpan);
    scene.add(starGroup);

    // Converts a world-space size at distance z into pixels:
    // pixels = worldSize * uPixelScale / z. Taken from the drawing buffer so
    // it follows resizes and device pixel ratio instead of assuming either.
    function updatePixelScale() {
      const height = renderer.getDrawingBufferSize(new THREE.Vector2()).y;
      const value = height / (2 * Math.tan(deg(camera.fov) / 2));
      starGroup.userData.pixelScaleMaterials.forEach(m => {
        m.uniforms.uPixelScale.value = value;
      });
    }
    updatePixelScale();

    // Depths come off a hash of the seed and the star's own identity, not
    // Math.random - the whole point of a canonical sky is that its stars are
    // in the same places every time, and that has to include how far away
    // they are.
    const depthSeed = currentSeed || CANONICAL_SKY_IMAGE || 'canonical';

    chart.constellations.forEach((data, idx) => {
      const group = new THREE.Group();

      // Placement and shape are now separate. The relaxed layout says where
      // this constellation's centre goes; each star is then offset from that
      // centre by its own position within the shape, at the shape scale. The
      // offsets are untouched authored data, so evening out the spacing
      // moves constellations around without distorting a single one.
      const placement = layout[idx];
      const ownCentre = centroidOf(data.stars);

      // World position of every star: its own direction, and its own radius.
      // Computing true world positions first (rather than laying the shape
      // out flat and bending it afterwards) is what makes the constellation
      // genuinely three-dimensional.
      const scratch = new THREE.Vector3();
      const worldPositions = data.stars.map((s, i) => {
        const yaw = placement.yaw + (s.x - ownCentre.x) * radPerPixel;
        const pitch = placement.pitch - (s.y - ownCentre.y) * radPerPixel; // image y grows downward
        const jitter = (hash01(`${depthSeed}|${idx}|${i}`) * 2 - 1) * CONSTELLATION_DEPTH_JITTER;
        const radius = CONSTELLATION_RADIUS * (1 + jitter);
        return directionFor(yaw, pitch, new THREE.Vector3()).multiplyScalar(radius);
      });

      // Anchor the group at the shape's mean direction, at the nominal
      // radius, facing the viewer; each star's local offset then carries its
      // own depth relative to that.
      const meanDir = new THREE.Vector3();
      worldPositions.forEach(p => meanDir.add(scratch.copy(p).normalize()));
      meanDir.normalize();
      const basePosition = meanDir.clone().multiplyScalar(CONSTELLATION_RADIUS);
      group.position.copy(basePosition);
      group.lookAt(0, 0, 0);
      group.updateMatrixWorld();

      const local = worldPositions.map(p => group.worldToLocal(p.clone()));

      // Stars
      const positions = new Float32Array(local.length * 3);
      const phases = new Float32Array(local.length);
      const speeds = new Float32Array(local.length);
      const sizes = new Float32Array(local.length);
      local.forEach((p, i) => {
        positions[i * 3] = p.x;
        positions[i * 3 + 1] = p.y;
        positions[i * 3 + 2] = p.z;
        phases[i] = hash01(`${depthSeed}|phase|${idx}|${i}`) * Math.PI * 2;
        speeds[i] = 0.35 + hash01(`${depthSeed}|speed|${idx}|${i}`) * 0.75;
        // Deliberately larger than they'd "naturally" be: the sky behind is
        // a dense field of Delvar's point stars, and a constellation's own
        // stars have to be unmistakably the brightest things in frame or the
        // shape reads as lines drawn over noise.
        sizes[i] = 5 + hash01(`${depthSeed}|size|${idx}|${i}`) * 3;
      });

      const starGeometry = new THREE.BufferGeometry();
      starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      starGeometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
      starGeometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
      starGeometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
      const starMaterial = makeTwinkleMaterial(THREE, glowTexture, 0xf6dda0);
      twinkleMaterials.push(starMaterial);
      group.add(new THREE.Points(starGeometry, starMaterial));

      // Anchor star: one of the big spiked ones, sitting on the shape's
      // most-connected star. Sized by angle rather than in world units so it
      // reads the same on screen wherever the constellation ended up.
      const anchorIndex = principalStarIndex(data);
      const anchorTexture = new THREE.CanvasTexture(anchorSprites[idx]);
      anchorTexture.colorSpace = THREE.SRGBColorSpace;
      anchorTexture.needsUpdate = true;
      const anchor = new THREE.Sprite(new THREE.SpriteMaterial({
        map: anchorTexture,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      }));
      anchor.position.copy(local[anchorIndex]);
      const anchorSize = CONSTELLATION_RADIUS * deg(ANCHOR_ANGULAR_SIZE);
      anchor.scale.set(anchorSize, anchorSize, 1);
      group.add(anchor);
      // Same fix as the sky's own bright stars (applySpriteTwinkle, above):
      // opacity alone barely showed on a near-saturated core, so this now
      // carries a sprite + baseScale too and gets a larger amount, applied
      // to both opacity and scale.
      anchorTwinkles.push({
        sprite: anchor,
        material: anchor.material,
        baseScale: anchorSize,
        phase: hash01(`anchor-tw-phase|${idx}`) * Math.PI * 2,
        speed: 0.15 + hash01(`anchor-tw-speed|${idx}`) * 0.25,
        rotSpeed: (hash01(`anchor-tw-rot|${idx}`) - 0.5) * 2 * ROTATION_SPEED,
        amount: 0.30
      });

      // Lines, drawn between the actual 3D star positions - so they lean
      // through space rather than lying flat on a plane.
      const linePositions = new Float32Array(data.lines.length * 6);
      data.lines.forEach(([a, b], i) => {
        linePositions[i * 6] = local[a].x;
        linePositions[i * 6 + 1] = local[a].y;
        linePositions[i * 6 + 2] = local[a].z;
        linePositions[i * 6 + 3] = local[b].x;
        linePositions[i * 6 + 4] = local[b].y;
        linePositions[i * 6 + 5] = local[b].z;
      });
      const lineGeometry = new THREE.BufferGeometry();
      lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
      const lineMaterial = new THREE.LineBasicMaterial({
        color: 0xc9a24a,
        transparent: true,
        opacity: 0.42,
        depthWrite: false
      });
      group.add(new THREE.LineSegments(lineGeometry, lineMaterial));

      // Hit spheres, one per visually-disconnected cluster. A constellation
      // like two crossed swords or a twin pair is several separate clumps
      // sharing one name; a single sphere covering all of them would also
      // cover the empty space between and swallow its neighbours.
      findConnectedComponents(data.stars.length, data.lines).forEach(indices => {
        const centre = new THREE.Vector3();
        indices.forEach(i => centre.add(local[i]));
        centre.divideScalar(indices.length);

        let maxDist = 2;
        indices.forEach(i => {
          maxDist = Math.max(maxDist, centre.distanceTo(local[i]));
        });

        const hitMesh = new THREE.Mesh(
          new THREE.SphereGeometry(maxDist + 2.5, 12, 12),
          new THREE.MeshBasicMaterial({ visible: false })
        );
        hitMesh.position.copy(centre);
        hitMesh.userData.constellationIndex = idx;
        group.add(hitMesh);
        hitMeshes.push(hitMesh);
      });

      // Hovering pulls the group toward the viewer along its own sightline,
      // so it reads as "coming forward" wherever it sits on the dome.
      group.userData.radialDir = meanDir;
      group.userData.basePosition = basePosition;
      group.userData.lift = 0;
      group.userData.targetLift = 0;
      group.userData.targetScale = 1;
      group.userData.lineMaterial = lineMaterial;
      group.userData.starMaterial = starMaterial;
      scene.add(group);
      groups.push(group);
    });

    // --- Moon ---
    // Real light and a real position, not a painted-on crescent: a lit
    // sphere with a phase-derived directional light naturally produces the
    // correct terminator wherever the light ends up, which is more honest
    // than faking a 2D crescent shape would be. Position is picked once,
    // deterministically, well clear of every constellation.
    const moon = buildMoon(THREE, sunCalc, layout, yawLimit, pitchLimit, skyTexture, domeYawSpan, domePitchSpan);
    scene.add(moon.group);
    scene.add(moon.light);
    scene.add(moon.light.target);
    scene.add(moon.ambientLight);

    // --- Drag to look around ---
    // Grab whatever point is under the cursor and keep it under the cursor,
    // like dragging a photo rather than steering a first-person camera.
    // Solved fresh each move (find the orientation that puts the grabbed
    // world direction back under the mouse) rather than accumulating
    // yaw/pitch deltas, which is what makes the two axes stay consistently
    // signed no matter which way you drag.
    let isDragging = false;
    let rawYaw = 0, rawPitch = 0;
    let viewYaw = 0, viewPitch = 0;
    const dragWorldAnchor = new THREE.Vector3();
    const dragQuat = new THREE.Quaternion();
    const dragEuler = new THREE.Euler(0, 0, 0, 'YXZ');

    // Past the limits the drag keeps responding but with rising resistance,
    // then eases back inside on release - a soft edge rather than a wall.
    //
    // The falloff is asymptotic rather than a fixed fraction of the
    // overshoot. `limit + over * 0.3` has no ceiling, so a long enough drag
    // walks the view arbitrarily far past the limit and straight off the edge
    // of the dome; this approaches limit + SOFT_OVERSHOOT and never passes
    // it, which is what lets the dome be sized to cover it. Feels the same at
    // the small overshoots you actually notice - it only differs once you've
    // dragged well past, where it firms up instead of giving way.
    const softCeiling = deg(SOFT_OVERSHOOT);
    function softClamp(value, limit) {
      const magnitude = Math.abs(value);
      if (magnitude <= limit) return value;
      const over = magnitude - limit;
      const softened = limit + softCeiling * (1 - Math.exp(-over / softCeiling));
      return value < 0 ? -softened : softened;
    }

    // Direction, in camera-local space, that an NDC coordinate points along -
    // independent of the camera's current rotation, which is what lets it be
    // used both to grab a point and to find where the cursor points later.
    function ndcToLocalDir(ndcX, ndcY, target) {
      const halfVFov = deg(camera.fov) / 2;
      const halfHFov = Math.atan(Math.tan(halfVFov) * camera.aspect);
      return target.set(Math.tan(ndcX * halfHFov), Math.tan(ndcY * halfVFov), -1).normalize();
    }

    // --- Hover ---
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let hoveredIndex = -1;

    const tooltipScratch = new THREE.Vector3();
    function updateTooltipPosition(group) {
      group.getWorldPosition(tooltipScratch);
      tooltipScratch.project(camera);
      const px = (tooltipScratch.x * 0.5 + 0.5) * stageEl.clientWidth;
      const py = (-tooltipScratch.y * 0.5 + 0.5) * stageEl.clientHeight;

      const w = tooltipEl.offsetWidth || 320;
      const h = tooltipEl.offsetHeight || 110;
      const margin = 10;
      tooltipEl.style.left = Math.max(margin, Math.min(px - w / 2, stageEl.clientWidth - w - margin)) + 'px';
      tooltipEl.style.top = Math.max(margin, Math.min(py + 28, stageEl.clientHeight - h - margin)) + 'px';
    }

    function setHovered(index) {
      if (index === hoveredIndex) return;

      if (hoveredIndex !== -1) {
        const prev = groups[hoveredIndex];
        prev.userData.targetLift = 0;
        prev.userData.targetScale = 1;
        prev.userData.lineMaterial.opacity = 0.42;
      }

      hoveredIndex = index;

      if (hoveredIndex === -1) {
        tooltipEl.hidden = true;
        return;
      }

      const group = groups[hoveredIndex];
      group.userData.targetLift = 14;
      group.userData.targetScale = 1.12;
      group.userData.lineMaterial.opacity = 0.95;

      const data = chart.constellations[hoveredIndex];
      tooltipNameEl.textContent = data.name;
      tooltipDescEl.textContent = data.description || '';
      tooltipEl.hidden = false;
      updateTooltipPosition(group);
    }

    function onPointerMove(e) {
      const rect = stageEl.getBoundingClientRect();
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      pointer.set(ndcX, ndcY);

      if (isDragging) {
        const currentDir = ndcToLocalDir(ndcX, ndcY, new THREE.Vector3());
        dragQuat.setFromUnitVectors(currentDir, dragWorldAnchor);
        dragEuler.setFromQuaternion(dragQuat, 'YXZ');
        rawYaw = dragEuler.y;
        rawPitch = dragEuler.x;
      }

      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(hitMeshes);
      setHovered(hits.length > 0 ? hits[0].object.userData.constellationIndex : -1);

      // Constellations take priority - the moon was deliberately placed clear
      // of them, so this only ever matters when nothing else is hit.
      if (hits.length === 0) {
        const moonHit = raycaster.intersectObject(moon.mesh);
        setMoonHovered(moonHit.length > 0);
      } else {
        setMoonHovered(false);
      }
    }

    let moonHovered = false;
    function setMoonHovered(hovered) {
      if (hovered === moonHovered) return;
      moonHovered = hovered;
      if (!hovered) {
        tooltipEl.hidden = true;
        return;
      }
      tooltipNameEl.textContent = moon.phaseName;
      tooltipDescEl.textContent = moon.description;
      tooltipEl.hidden = false;
      updateTooltipPosition(moon.group);
    }

    function onPointerDown(e) {
      if (e.button !== 0) return;
      isDragging = true;
      const rect = stageEl.getBoundingClientRect();
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      // Grab the point currently under the cursor: its world direction given
      // the camera's orientation right now is what later moves solve to keep
      // under the cursor.
      ndcToLocalDir(ndcX, ndcY, dragWorldAnchor).applyQuaternion(camera.quaternion);
      stageEl.classList.add('dragging');
      stageEl.setPointerCapture(e.pointerId);
    }

    function onPointerUp(e) {
      isDragging = false;
      stageEl.classList.remove('dragging');
      try { stageEl.releasePointerCapture(e.pointerId); } catch (err) { /* already released */ }
    }

    function onPointerLeave() {
      setHovered(-1);
      setMoonHovered(false);
    }

    stageEl.addEventListener('pointermove', onPointerMove);
    stageEl.addEventListener('pointerdown', onPointerDown);
    stageEl.addEventListener('pointerup', onPointerUp);
    stageEl.addEventListener('pointercancel', onPointerUp);
    stageEl.addEventListener('pointerleave', onPointerLeave);

    onResize = () => {
      camera.aspect = stageEl.clientWidth / stageEl.clientHeight;
      camera.updateProjectionMatrix();
      updateLookLimits();
      renderer.setSize(stageEl.clientWidth, stageEl.clientHeight);
      updatePixelScale();
    };

    // The window resize listener isn't enough: the stage gets its final width
    // from layout that settles after this runs (the loading overlay clearing,
    // the sidebar, a scrollbar appearing), and setSize writes an inline style
    // that outranks the stylesheet's width:100% - so a canvas sized from a
    // stale measurement just stays wrong, with a visible strip of dead space
    // beside it, until something happens to resize the window.
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(() => {
        if (stageEl.clientWidth && stageEl.clientHeight) onResize();
      }).observe(stageEl);
    }

    function animate() {
      requestAnimationFrame(animate);

      // Skip real work while the widget is off-screen or the tab is hidden,
      // so it doesn't burn GPU unattended. This checks stageEl rather than
      // the original `container`: when the site restores this widget from
      // its cache it moves stageEl's subtree into a brand new container and
      // never reconnects the old one, so `container` would read as
      // permanently disconnected after the first round trip.
      if (!stageEl.isConnected || document.hidden) return;

      const t = clock.getElapsedTime();
      twinkleMaterials.forEach(m => { m.uniforms.uTime.value = t; });
      starGroup.userData.timeMaterials.forEach(m => { m.uniforms.uTime.value = t; });
      applySpriteTwinkle(starGroup.userData.twinkleSprites, t);
      applySpriteTwinkle(anchorTwinkles, t);

      groups.forEach(group => {
        const ud = group.userData;
        ud.lift += (ud.targetLift - ud.lift) * 0.12;
        group.position.copy(ud.basePosition).addScaledVector(ud.radialDir, -ud.lift);
        const s = group.scale.x + (ud.targetScale - group.scale.x) * 0.12;
        group.scale.set(s, s, s);
      });

      // Soft-clamp while held so the edges give resistance; on release snap
      // the raw value back inside so the next drag doesn't start out of
      // bounds.
      const clampedYaw = isDragging ? softClamp(rawYaw, yawLimit) : THREE.MathUtils.clamp(rawYaw, -yawLimit, yawLimit);
      const clampedPitch = isDragging ? softClamp(rawPitch, pitchLimit) : THREE.MathUtils.clamp(rawPitch, -pitchLimit, pitchLimit);
      if (!isDragging) {
        rawYaw = clampedYaw;
        rawPitch = clampedPitch;
      }
      viewYaw += (clampedYaw - viewYaw) * 0.18;
      viewPitch += (clampedPitch - viewPitch) * 0.18;
      camera.rotation.set(viewPitch, viewYaw, 0);

      // Translate the camera slightly. This is the only reason any of the
      // depth in this scene is visible at all: a camera that purely rotates
      // projects near and far points identically, so without it the star
      // field, the constellations and the dome would be structurally 3D and
      // look exactly like a flat panorama. Two incommensurable frequencies
      // for the idle drift so it never settles into an obvious loop, plus a
      // component tied to where you're looking so turning your head also
      // shifts your viewpoint a little.
      camera.position.set(
        Math.sin(t * SWAY_SPEED) * SWAY_IDLE + Math.sin(viewYaw) * SWAY_LOOK,
        Math.cos(t * SWAY_SPEED * 1.35) * SWAY_IDLE * 0.6 + Math.sin(viewPitch) * SWAY_LOOK,
        0
      );
      camera.updateMatrixWorld();

      // Keep the tooltip glued to its constellation as it rises and as the
      // view turns, not just placed once when the hover started.
      if (hoveredIndex !== -1) updateTooltipPosition(groups[hoveredIndex]);

      renderer.render(scene, camera);
    }
    animate();

    return {
      /**
       * @param {THREE.Texture} texture   New gas backdrop.
       * @param {object|null} newStarField New stars, or null to keep the
       *   current ones - the bake re-renders only the gas, and rebuilding an
       *   identical star field from the same seed would just be churn.
       */
      setSky(texture, newStarField) {
        const oldTexture = domeMaterial.map;
        domeMaterial.map = texture;
        domeMaterial.needsUpdate = true;
        if (oldTexture && oldTexture !== texture) oldTexture.dispose();

        if (newStarField) {
          scene.remove(starGroup);
          disposeGroup(starGroup);
          starGroup = buildStarField(THREE, newStarField, domeYawSpan, domePitchSpan);
          scene.add(starGroup);
          updatePixelScale();
        }
      },
      getSkyCanvas() {
        return domeMaterial.map && domeMaterial.map.userData.canvas;
      }
    };
  }

  // --- Geometry / helpers -------------------------------------------------

  // A spherical cap centred on -Z: a grid whose vertices sit at a constant
  // radius but at evenly-spaced yaw/pitch, with UVs linear in those angles.
  // That gives a surface that actually curves away at the edges, which is
  // the whole difference between this and a flat image on a plane.
  function buildDomeGeometry(THREE, yawSpan, pitchSpan) {
    const cols = DOME_SEGMENTS_X + 1;
    const rows = DOME_SEGMENTS_Y + 1;
    const positions = new Float32Array(cols * rows * 3);
    const uvs = new Float32Array(cols * rows * 2);
    const indices = [];
    const dir = new THREE.Vector3();

    for (let row = 0; row < rows; row++) {
      const v = row / DOME_SEGMENTS_Y;
      const pitch = (0.5 - v) * pitchSpan;
      for (let col = 0; col < cols; col++) {
        const u = col / DOME_SEGMENTS_X;
        const yaw = (u - 0.5) * yawSpan;
        const i = row * cols + col;

        directionFor(yaw, pitch, dir).multiplyScalar(DOME_RADIUS);
        positions[i * 3] = dir.x;
        positions[i * 3 + 1] = dir.y;
        positions[i * 3 + 2] = dir.z;
        uvs[i * 2] = u;
        uvs[i * 2 + 1] = 1 - v;
      }
    }

    for (let row = 0; row < DOME_SEGMENTS_Y; row++) {
      for (let col = 0; col < DOME_SEGMENTS_X; col++) {
        const a = row * cols + col;
        const b = a + 1;
        const c = a + cols;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    return geometry;
  }

  // The chart's shapes only occupy the middle of its nominal canvas, so fit
  // to where the stars actually are.
  function chartBounds(chart) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    chart.constellations.forEach(c => c.stars.forEach(s => {
      if (s.x < minX) minX = s.x;
      if (s.x > maxX) maxX = s.x;
      if (s.y < minY) minY = s.y;
      if (s.y > maxY) maxY = s.y;
    }));
    return {
      minX, minY,
      centreX: (minX + maxX) / 2,
      centreY: (minY + maxY) / 2,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  function centroidOf(stars) {
    let x = 0, y = 0;
    stars.forEach(s => { x += s.x; y += s.y; });
    return { x: x / stars.length, y: y / stars.length };
  }

  // Evens out the spacing of the constellations.
  //
  // As authored, the chart clumps: several constellations sit almost on top
  // of one another around the middle band while other stretches of sky are
  // bare. This pushes any pair that's too close apart, repeatedly, until the
  // spacing is roughly uniform - it keeps the chart's overall arrangement
  // (nothing teleports across the sky, neighbours stay neighbours) while
  // removing the crowding.
  //
  // This is a *display* decision and does not touch content/constellations.json.
  // The editor stays the source of truth for shapes and for roughly where
  // things go; this just relieves the crowding when it's drawn.
  function relaxLayout(chart, bounds) {
    const points = chart.constellations.map(c => {
      const centre = centroidOf(c.stars);
      return {
        x: (centre.x - bounds.minX) / bounds.width,
        y: (centre.y - bounds.minY) / bounds.height
      };
    });

    const n = points.length;
    // Covering a unit square evenly with n points implies a spacing of about
    // 1/sqrt(n). Aiming a little under that evens out the clumps without
    // driving everything onto a visibly regular lattice.
    const minSep = 0.92 / Math.sqrt(n);
    const MARGIN = 0.05;
    const ITERATIONS = 80;
    const DAMPING = 0.5; // move only part way each pass, so pairs settle
                         // instead of ping-ponging past each other

    for (let iter = 0; iter < ITERATIONS; iter++) {
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          let dx = points[j].x - points[i].x;
          let dy = points[j].y - points[i].y;
          let d = Math.hypot(dx, dy);
          if (d >= minSep) continue;
          if (d < 1e-6) { dx = 1e-3; dy = 0; d = 1e-3; } // coincident: pick an axis
          const push = ((minSep - d) / 2) * DAMPING;
          const ux = dx / d, uy = dy / d;
          points[i].x -= ux * push;
          points[i].y -= uy * push;
          points[j].x += ux * push;
          points[j].y += uy * push;
        }
      }
      for (const p of points) {
        p.x = Math.min(1 - MARGIN, Math.max(MARGIN, p.x));
        p.y = Math.min(1 - MARGIN, Math.max(MARGIN, p.y));
      }
    }

    const spread = deg(CHART_SPREAD_DEGREES);
    return points.map(p => ({
      yaw: (p.x - 0.5) * spread,
      pitch: (0.5 - p.y) * spread // chart y grows downward
    }));
  }

  // The star a constellation is "hung" from: the most-connected one, which is
  // reliably the visual anchor of the shape rather than a point out on a limb.
  // First maximum wins, so it's stable rather than depending on iteration
  // order quirks.
  function principalStarIndex(data) {
    const degree = new Array(data.stars.length).fill(0);
    data.lines.forEach(([a, b]) => { degree[a]++; degree[b]++; });
    let best = 0;
    for (let i = 1; i < degree.length; i++) {
      if (degree[i] > degree[best]) best = i;
    }
    return best;
  }

  // Groups star indices into connected components via the `lines` graph
  // (union-find), so a constellation drawn as several disconnected clusters
  // can get one right-sized hit sphere each.
  function findConnectedComponents(starCount, lines) {
    const parent = Array.from({ length: starCount }, (_, i) => i);
    function find(x) {
      while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
      return x;
    }
    lines.forEach(([a, b]) => {
      const ra = find(a), rb = find(b);
      if (ra !== rb) parent[ra] = rb;
    });
    const byRoot = new Map();
    for (let i = 0; i < starCount; i++) {
      const root = find(i);
      if (!byRoot.has(root)) byRoot.set(root, []);
      byRoot.get(root).push(i);
    }
    return Array.from(byRoot.values());
  }

  // Deterministic [0,1) from a string. Only needs to be well-spread, not
  // cryptographic - it decides how far away a star is, nothing more.
  function hash01(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    // Final avalanche, so neighbouring keys ("...|0|1" vs "...|0|2") don't
    // produce neighbouring values and stripe the depths.
    h ^= h >>> 16;
    h = Math.imul(h, 2246822507) >>> 0;
    h ^= h >>> 13;
    h = Math.imul(h, 3266489909) >>> 0;
    // The trailing >>> 0 here is load-bearing, not decorative: JS's ^
    // operator always returns a SIGNED int32, so without it this XOR's
    // result is negative whenever bit 31 happens to be set - which is
    // about half of all inputs. Every caller of this function assumes a
    // [0,1) output; missing this turned that into (-0.5, 0.5) instead,
    // silently, for every hash01 call in the file.
    h = (h ^ (h >>> 16)) >>> 0;
    return h / 4294967296;
  }

  function makeGlowTexture(THREE) {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.25, 'rgba(255,255,255,0.9)');
    gradient.addColorStop(0.6, 'rgba(255,255,255,0.25)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(canvas);
  }

  // --- Moon --------------------------------------------------------------
  // A lit sphere, not a painted crescent: real geometry, a real crater bump
  // map, and a real directional light positioned from today's actual phase
  // (via SunCalc - see vendor/suncalc/NOTICE.md). The terminator falls out
  // of normal Lambertian shading wherever the light ends up, the same way
  // an actual moon's does, rather than being drawn in by hand.

  // Deterministic [0,1) hash-based value noise on an INTEGER lattice that's
  // periodic in x - which is what makes the texture wrap seamlessly at the
  // UV seam (u=0 meets u=1) once it's mapped onto a sphere. periodX must be
  // whatever the caller's continuous x coordinate is scaled to run 0..periodX
  // across a full wrap, so that wrap(0) and wrap(periodX) hash identically.
  function moonHash2i(ix, iy, seed) {
    let h = (ix * 374761393 + iy * 668265263 + seed * 2246822519) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function moonValueNoise(x, y, periodX, seed) {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const xf = x - x0, yf = y - y0;
    const wrap = ix => ((ix % periodX) + periodX) % periodX;
    const a = moonHash2i(wrap(x0), y0, seed);
    const b = moonHash2i(wrap(x0 + 1), y0, seed);
    const c = moonHash2i(wrap(x0), y0 + 1, seed);
    const d = moonHash2i(wrap(x0 + 1), y0 + 1, seed);
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function moonFbm(x, y, basePeriod, seed, octaves) {
    let sum = 0, amp = 0.5, freq = 1, period = basePeriod;
    for (let i = 0; i < octaves; i++) {
      sum += moonValueNoise(x * freq, y * freq, period, seed + i * 17) * amp;
      freq *= 2; period *= 2; amp *= 0.5;
    }
    return sum;
  }
  // Domain-warped fbm: sample noise twice to build a small displacement,
  // then sample the real pattern at the displaced coordinate - the same
  // technique the nebula generator elsewhere in this project uses for its
  // gas clouds, applied here so the maria read as organic, off-centre
  // wandering shapes rather than plain roundish noise blobs. The warp's own
  // fbm calls MUST share the caller's basePeriod - g(x)=x+f(x) only stays
  // periodic with period P when f(x) itself has period P, so a mismatched
  // period here would reopen the seam this whole periodic-noise scheme
  // exists to close.
  function moonWarpedFbm(x, y, basePeriod, seed, octaves) {
    const wx = moonFbm(x + 11.3, y + 4.7, basePeriod, seed + 500, 2) - 0.5;
    const wy = moonFbm(x + 2.9, y + 9.1, basePeriod, seed + 700, 2) - 0.5;
    return moonFbm(x + wx * 1.6, y + wy * 1.6, basePeriod, seed, octaves);
  }

  // Builds the height (crater bumps) and maria (large dark "seas") fields
  // together, since both are sampled at the same texel grid and craters get
  // carved into the same height field the normal map is derived from.
  function generateMoonFields(seedKey) {
    // moonFbm/moonValueNoise/moonHash2i need a NUMBER (they do arithmetic on
    // it directly); the crater placement below hashes seedKey as a string
    // instead, so both forms are kept rather than picking one and converting
    // back and forth.
    const seed = Math.floor(hash01(seedKey) * 1e6);
    const W = MOON_TEXTURE_WIDTH, H = MOON_TEXTURE_HEIGHT;
    const height = new Float32Array(W * H);
    const maria = new Float32Array(W * H);

    for (let py = 0; py < H; py++) {
      const v = py / H;
      for (let px = 0; px < W; px++) {
        const u = px / W;
        // 8 wraps across the full width for the maria pattern - a handful of
        // large, soft blotches, not fine grain. Warped so the blotches read
        // as organic wandering shapes rather than plain rounded noise blobs.
        maria[py * W + px] = moonWarpedFbm(u * 8, v * 8, 8, seed, 4);
        // Broad, gentle undulation (craters get stamped in below) plus a
        // persistent FINE layer - several octaves at a much higher frequency
        // and low amplitude, present everywhere, not just inside craters.
        // Without this the ground between craters is dead flat, which is
        // exactly what read as "smooth" - real regolith has texture at
        // every scale, not just at crater scale.
        const broad = (moonFbm(u * 16, v * 16, 16, seed + 900, 3) - 0.5) * 0.15;
        const fine = (moonFbm(u * 70, v * 70, 70, seed + 1400, 3) - 0.5) * 0.028;
        height[py * W + px] = broad + fine;
      }
    }

    // Craters: circular bowls (raised rim, depressed floor) stamped into the
    // height field. Each is bounded to its own pixel box, wrapping in x for
    // ones that straddle the u=0/1 seam, so this stays cheap regardless of
    // texture size.
    //
    // Two populations, not one - a real cratered surface has structure at
    // every size, and a single size range (however wide) still reads as "one
    // kind of bump, sometimes bigger." The major population is the same as
    // before; the minor one is numerous, small, and shallow - the fine
    // pockmarking visible in any close-up lunar photo, layered on top of the
    // fine roughness above rather than replacing it.
    const craterRandom = (key) => hash01(`moon-crater|${seed}|${key}`);
    function stampCraters(count, keyPrefix, sizeRange, depthRange, sizePower, rimWidth, rimStrength) {
      for (let i = 0; i < count; i++) {
        const cu = craterRandom(`${keyPrefix}${i}-u`);
        // Kept off the exact poles (v near 0 or 1) - the equirectangular
        // mapping pinches there regardless, and a crater bowl straddling a
        // pole would distort badly.
        const cv = 0.08 + craterRandom(`${keyPrefix}${i}-v`) * 0.84;
        // Power curve so small craters heavily outnumber large ones within
        // each population too, like a real cratered surface.
        const sizeT = Math.pow(craterRandom(`${keyPrefix}${i}-size`), sizePower);
        const radiusUV = sizeRange[0] + sizeT * (sizeRange[1] - sizeRange[0]);
        // Bigger craters get proportionally shallower floors and thinner,
        // softer rims than small ones - an old, worn crater's walls slump
        // and its rim erodes low, where a small fresh one stays a sharp
        // bowl. Approximates Terragen's rim-height/rim-width/rim-softness
        // split rather than giving every crater an identical profile.
        const depth = (depthRange[0] + craterRandom(`${keyPrefix}${i}-depth`) * (depthRange[1] - depthRange[0])) * (1 - sizeT * 0.4);
        const thisRimWidth = rimWidth * (1 + sizeT * 0.6);

        const cx = cu * W, cy = cv * H;
        const radiusPx = Math.max(1, Math.round(radiusUV * W));
        const y0 = Math.max(0, Math.floor(cy - radiusPx));
        const y1 = Math.min(H - 1, Math.ceil(cy + radiusPx));
        for (let py = y0; py <= y1; py++) {
          for (let dx = -radiusPx; dx <= radiusPx; dx++) {
            const px = ((Math.round(cx) + dx) % W + W) % W;
            const ddy = py - cy;
            const d = Math.sqrt(dx * dx + ddy * ddy) / radiusPx;
            if (d > 1) continue;
            // Floor: a shallow bowl, deepest at the centre. Rim: a raised
            // ring near the edge, which is what actually catches the light
            // and makes a crater read as a crater rather than a smudge.
            const floor = -depth * (1 - d * d);
            const rim = Math.exp(-Math.pow((d - (1 - thisRimWidth)) / thisRimWidth, 2)) * depth * rimStrength;
            height[py * W + px] += floor + rim;
          }
        }
      }
    }
    stampCraters(55, 'major-', [0.015, 0.105], [0.06, 0.16], 2.4, 0.08, 0.9);
    stampCraters(260, 'micro-', [0.003, 0.013], [0.012, 0.032], 1.6, 0.12, 0.7);

    return { height, maria, W, H };
  }

  function buildMoonTextures(THREE, seed) {
    const { height, maria, W, H } = generateMoonFields(seed);

    // Albedo: grey highlands, darker toward maria - real moon colour is
    // close to neutral grey (a much lower albedo than most art depicts it,
    // but "realistic" was the brief), with maria running warmer/darker than
    // the highlands around them.
    const albedoData = new Uint8ClampedArray(W * H * 4);
    const normalData = new Uint8ClampedArray(W * H * 4);
    const highland = { r: 0.72, g: 0.70, b: 0.67 };
    const mare = { r: 0.38, g: 0.37, b: 0.36 };

    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        const idx = py * W + px;
        const m = Math.min(1, Math.max(0, (maria[idx] - 0.45) * 2.2));
        const craterFloorDarken = Math.min(0.2, Math.max(0, -height[idx]) * 1.2);

        const r = (highland.r + (mare.r - highland.r) * m) * (1 - craterFloorDarken);
        const g = (highland.g + (mare.g - highland.g) * m) * (1 - craterFloorDarken);
        const b = (highland.b + (mare.b - highland.b) * m) * (1 - craterFloorDarken);

        const o = idx * 4;
        albedoData[o] = r * 255; albedoData[o + 1] = g * 255; albedoData[o + 2] = b * 255; albedoData[o + 3] = 255;

        // Normal from the height field's local gradient - simple central
        // differences rather than a full Sobel kernel, since this field is
        // smooth by construction (broad crater bowls, not fine noise), so
        // there's nothing for Sobel's extra noise-suppression to buy here.
        // Wraps in x for the same seam-continuity reason as the noise above.
        const xL = ((px - 1) % W + W) % W, xR = (px + 1) % W;
        const yU = Math.max(0, py - 1), yD = Math.min(H - 1, py + 1);
        const dx = height[py * W + xR] - height[py * W + xL];
        const dy = height[yD * W + px] - height[yU * W + px];
        // Height range is small (see the 0.15/depth scales above), so the
        // gradient needs real amplification to read as anything on a normal
        // map - otherwise every texel rounds to "facing the camera."
        const strength = 9;
        let nx = -dx * strength, ny = -dy * strength, nz = 1;
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        nx /= len; ny /= len; nz /= len;
        normalData[o] = (nx * 0.5 + 0.5) * 255;
        normalData[o + 1] = (ny * 0.5 + 0.5) * 255;
        normalData[o + 2] = (nz * 0.5 + 0.5) * 255;
        normalData[o + 3] = 255;
      }
    }

    const albedoCanvas = document.createElement('canvas');
    albedoCanvas.width = W; albedoCanvas.height = H;
    albedoCanvas.getContext('2d').putImageData(new ImageData(albedoData, W, H), 0, 0);

    const normalCanvas = document.createElement('canvas');
    normalCanvas.width = W; normalCanvas.height = H;
    normalCanvas.getContext('2d').putImageData(new ImageData(normalData, W, H), 0, 0);

    const albedoTexture = new THREE.CanvasTexture(albedoCanvas);
    albedoTexture.colorSpace = THREE.SRGBColorSpace;
    const normalTexture = new THREE.CanvasTexture(normalCanvas);
    // Normal maps are per-channel vector data, not colour - must NOT go
    // through sRGB decoding, or the gradients come out skewed.
    normalTexture.colorSpace = THREE.NoColorSpace;

    return { albedoTexture, normalTexture };
  }

  // Where the moon sits: best of a batch of deterministic candidates, judged
  // by distance to the nearest constellation, so it lands somewhere with
  // real clearance rather than merely clearing a bare minimum. Seeded off a
  // fixed key rather than the sky seed - the moon isn't part of the
  // generated sky, so rerolling the nebulae shouldn't move it, and its own
  // identity (same craters, same spot) should stay put across reloads.
  // No fixed minimum clearance is enforced - this maximises it instead,
  // which matters because a fixed threshold would be wrong either way here:
  // 19 constellations packed into the reachable ~50x52 degree search area
  // (measured; matches the pannable range from updateLookLimits) leaves no
  // spot that clears much more than ~13 degrees from its single nearest
  // neighbour, no matter how the search is widened (checked up to the full
  // pan range with 300 candidates - the ceiling barely moves past what 60
  // already finds within the tighter, comfortably-centreable range below).
  // Against the moon's own ~2.3 degree radius and a constellation's typical
  // few-degree extent, ~13 degrees between centres is still a clear, visibly
  // open gap - just not the double-digit-plus margin a hand-picked
  // "required minimum" constant would have implied.
  function pickMoonPosition(layout, yawLimit, pitchLimit) {
    const CANDIDATES = 60;
    // Kept inside the pannable range (not right at its edge) so the moon can
    // actually be centred in view, not just technically reachable at the
    // extreme corner of a drag.
    const yawRange = yawLimit * 0.85;
    const pitchRange = pitchLimit * 0.85;

    let best = null, bestClearanceDeg = -Infinity;
    for (let i = 0; i < CANDIDATES; i++) {
      const yaw = (hash01(`moon-pos-yaw|${i}`) - 0.5) * 2 * yawRange;
      const pitch = (hash01(`moon-pos-pitch|${i}`) - 0.5) * 2 * pitchRange;

      let minDistDeg = Infinity;
      for (const c of layout) {
        // Flat-plane treatment of yaw/pitch, same simplification relaxLayout
        // already uses for this kind of "how far apart" check - fine at the
        // separations involved here.
        const distDeg = Math.hypot(yaw - c.yaw, pitch - c.pitch) * 180 / Math.PI;
        if (distDeg < minDistDeg) minDistDeg = distDeg;
      }
      if (minDistDeg > bestClearanceDeg) {
        bestClearanceDeg = minDistDeg;
        best = { yaw, pitch };
      }
    }
    return best;
  }

  // A halo texture built specifically for this, rather than reusing the
  // star glow sprite. The star texture holds near-full opacity out to about
  // a quarter of its own radius (fine detail on a 2-3px star, invisible at
  // that scale) - stretched over a halo several times the moon's radius,
  // that same plateau becomes a wide, visible band of almost-constant
  // brightness that only starts fading well past it, which is what read as
  // "poorly faded" rather than smoothly fading from the moon's own edge
  // outward. This falls away immediately, no plateau - same lesson as the
  // star-sparkle fix earlier: compute the profile directly rather than trust
  // a few gradient stops not to hide one.
  function makeMoonHaloTexture(THREE) {
    const size = 128;
    const data = new Uint8ClampedArray(size * size * 4);
    const c = size / 2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (x - c) / c, dy = (y - c) / c;
        const r = Math.sqrt(dx * dx + dy * dy);
        const idx = (y * size + x) * 4;
        const alpha = r > 1 ? 0 : Math.pow(1 - r, 2.6);
        data[idx] = 255; data[idx + 1] = 255; data[idx + 2] = 255; data[idx + 3] = alpha * 255;
      }
    }
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    canvas.getContext('2d').putImageData(new ImageData(data, size, size), 0, 0);
    return new THREE.CanvasTexture(canvas);
  }

  // Samples a small neighbourhood of the gas texture around the moon's own
  // sky position, so its ambient fill and halo can pick up a hint of
  // whatever nebula colour actually surrounds it for THIS sky, instead of a
  // fixed colour that looks the same regardless of what's nearby. Draws into
  // a small scratch canvas rather than reading the full-size source directly
  // - cheap, and the downscale itself does the averaging.
  function sampleSkyColorNear(sourceElement, colFrac, rowFrac) {
    const w = sourceElement.width || sourceElement.naturalWidth || 256;
    const h = sourceElement.height || sourceElement.naturalHeight || 256;
    const boxFrac = 0.035;
    const sx = Math.max(0, Math.min(w - 1, (colFrac - boxFrac / 2) * w));
    const sy = Math.max(0, Math.min(h - 1, (rowFrac - boxFrac / 2) * h));
    const sw = Math.max(1, Math.min(w - sx, boxFrac * w));
    const sh = Math.max(1, Math.min(h - sy, boxFrac * h));

    const scratch = document.createElement('canvas');
    scratch.width = scratch.height = 32;
    const ctx = scratch.getContext('2d');
    ctx.drawImage(sourceElement, sx, sy, sw, sh, 0, 0, 32, 32);
    const data = ctx.getImageData(0, 0, 32, 32).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; }
    return { r: r / n / 255, g: g / n / 255, b: b / n / 255 };
  }

  function buildMoon(THREE, sunCalc, layout, yawLimit, pitchLimit, skyTexture, domeYawSpan, domePitchSpan) {
    const illum = sunCalc.getMoonIllumination(new Date());

    const position = pickMoonPosition(layout, yawLimit, pitchLimit);
    const dir = directionFor(position.yaw, position.pitch, new THREE.Vector3());
    const worldPos = dir.clone().multiplyScalar(MOON_RADIUS);

    const group = new THREE.Group();
    group.position.copy(worldPos);

    const { albedoTexture, normalTexture } = buildMoonTextures(THREE, 'the-moon');

    const angularRadius = deg(MOON_ANGULAR_SIZE) / 2;
    const sphereRadius = MOON_RADIUS * Math.tan(angularRadius);
    const geometry = new THREE.SphereGeometry(sphereRadius, 48, 32);
    const material = new THREE.MeshStandardMaterial({
      map: albedoTexture,
      normalMap: normalTexture,
      roughness: 0.97,
      metalness: 0
    });
    const mesh = new THREE.Mesh(geometry, material);
    group.add(mesh);

    // What colour actually surrounds the moon in THIS sky - used to tint
    // both the halo and the ambient fill below, so a moon sitting in front
    // of a pink nebula reads as belonging to that sky rather than looking
    // like a fixed prop dropped on top of whichever sky happened to render.
    const colFrac = 0.5 + position.yaw / domeYawSpan;
    const rowFrac = 0.5 - position.pitch / domePitchSpan;
    const nearbySky = sampleSkyColorNear(skyTexture.image, colFrac, rowFrac);
    const maxChannel = Math.max(nearbySky.r, nearbySky.g, nearbySky.b, 0.05);
    const nearbyHue = new THREE.Color(nearbySky.r / maxChannel, nearbySky.g / maxChannel, nearbySky.b / maxChannel);
    // Blended toward a neutral base rather than used at full saturation -
    // this should read as a subtle bounce-tint, not repaint the moon in the
    // nebula's own colour.
    const contextColor = new THREE.Color(0.55, 0.58, 0.66).lerp(nearbyHue, 0.5);

    // A tight, faint halo - small relative to the sphere and low-opacity, so
    // it reads as the last soft fringe of a lit rock's edge rather than as a
    // second, smaller light source next to it (a moon reflects; it doesn't
    // emit, and the previous halo's scale/brightness read like it did).
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeMoonHaloTexture(THREE),
      color: contextColor,
      transparent: true,
      depthWrite: false,
      opacity: 0.22,
      blending: THREE.AdditiveBlending
    }));
    glow.scale.set(sphereRadius * 2.1, sphereRadius * 2.1, 1);
    group.add(glow);

    // The light direction, derived from the actual phase angle rather than
    // painted on: `fraction` is exactly (1+cos(phaseAngle))/2 in SunCalc's
    // own formula (Meeus), so it inverts cleanly. phaseAngle=0 means the
    // light and the viewer are on the same side of the moon (full); PI means
    // opposite sides (new). Rotating the viewer->moon axis by that angle
    // around world-up gives a light direction that produces the correct
    // ILLUMINATED FRACTION under ordinary Lambertian shading - the crescent
    // shape itself is never drawn, just a consequence of the geometry.
    //
    // Which side it swings to (waxing vs waning) is a real simplification:
    // matching that exactly needs the observer's latitude/longitude (for the
    // parallactic angle), which this widget deliberately never asks for.
    // Waxing swings the light to the right, waning to the left - a
    // consistent, defensible convention, not a location-accurate one.
    const phaseAngle = Math.acos(Math.max(-1, Math.min(1, 2 * illum.fraction - 1)));
    const swing = illum.waxing ? 1 : -1;
    const viewerFromMoon = worldPos.clone().negate().normalize();
    const lightDir = viewerFromMoon.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), phaseAngle * swing);

    const light = new THREE.DirectionalLight(0xfff6e8, 2.1);
    light.position.copy(worldPos).addScaledVector(lightDir, 40);
    light.target.position.copy(worldPos);

    // Faint fill so the dark side reads as shadowed rock, not a black hole
    // cut out of the sky - real "earthshine" does exactly this to a real
    // crescent moon, just far more faintly than this stylised amount. Tinted
    // by the same contextColor as the halo above (was a fixed navy blue
    // regardless of sky), which is most of what made the moon feel lit by
    // nothing to do with its surroundings.
    const ambientLight = new THREE.AmbientLight(contextColor, 0.35);

    const PHASE_NAMES = [
      [0.02, 'New Moon'], [0.24, 'Waxing Crescent'], [0.26, 'First Quarter'],
      [0.49, 'Waxing Gibbous'], [0.51, 'Full Moon'], [0.74, 'Waning Gibbous'],
      [0.76, 'Last Quarter'], [0.98, 'Waning Crescent'], [1.01, 'New Moon']
    ];
    let phaseName = 'Full Moon';
    for (const [upTo, name] of PHASE_NAMES) {
      if (illum.phase <= upTo) { phaseName = name; break; }
    }

    return {
      group,
      mesh,
      light,
      ambientLight,
      phaseName,
      description: `${Math.round(illum.fraction * 100)}% illuminated. Reckoned from the real sky, today.`
    };
  }

  // Twinkle runs entirely on the GPU - a per-star phase in an attribute and
  // one shared clock uniform, rather than rewriting a buffer every frame.
  function makeTwinkleMaterial(THREE, glowTexture, colorHex) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uTexture: { value: glowTexture },
        uColor: { value: new THREE.Color(colorHex) }
      },
      vertexShader: `
        attribute float aPhase;
        attribute float aSize;
        attribute float aSpeed;
        uniform float uTime;
        varying float vBrightness;
        void main() {
          // Per-star rate, matching the sky field behind. This used to be a
          // fixed 1.6 for every star, which was fine in isolation but reads
          // as a single synchronised pulse once there's a properly
          // scintillating field to compare it against.
          //
          // Same two-frequency-plus-reshape sparkle as the background field
          // (see makePoints), kept to the same 0.5-1.0 range this already
          // had - constellation stars stay identifiable, just less
          // mechanically smooth about it.
          float w1 = sin(uTime * aSpeed + aPhase);
          float w2 = sin(uTime * aSpeed * 2.3 + aPhase * 1.7);
          float raw = w1 * 0.7 + w2 * 0.3;
          float tw = pow(0.5 + 0.5 * raw, 1.6);
          vBrightness = 0.5 + 0.5 * tw;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform sampler2D uTexture;
        uniform vec3 uColor;
        varying float vBrightness;
        void main() {
          vec4 tex = texture2D(uTexture, gl_PointCoord);
          gl_FragColor = vec4(uColor * vBrightness, tex.a * vBrightness);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
  }

  return {
    // Nothing external reaches into this widget; kept for parity with the
    // other tools' widget instances.
  };
};

const CONSTELLATION_STYLE = `
.constellation-tool {
  font-family: var(--font-primary);
  color: var(--bone-100);
}

.cm-header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin: 0 0 16px;
}

.cm-instructions {
  color: var(--bone-dim);
  font-size: var(--text-base);
  line-height: var(--leading-relaxed);
  max-width: 60ch;
  margin: 0;
}

.cm-seedbar {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: 0.72rem;
}

.cm-seed-label {
  color: var(--bone-dim);
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.cm-seed {
  color: var(--accent-strong);
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--line-strong);
  padding: 3px 8px;
  user-select: all;
}

.cm-btn {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--bone-100);
  background: transparent;
  border: 1px solid var(--line-strong);
  padding: 4px 10px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}

.cm-btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent-strong);
}

.cm-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.cm-stage-wrap {
  position: relative;
  width: 100%;
  border: 1px solid var(--line-strong);
  overflow: hidden;
  background: #000;
}

/* Vignette. Deliberately here rather than baked into the sky texture: this
   is a property of the frame you're looking through, so it has to stay put
   while the sky moves behind it. Baked in, it panned around with the stars
   and read as a dark ring sitting out in space. Elliptical, so it follows
   the stage's shape instead of imposing a circle on it. */
.cm-stage-wrap::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background: radial-gradient(ellipse at 50% 50%,
    rgba(0, 0, 0, 0) 40%,
    rgba(0, 0, 0, 0.18) 72%,
    rgba(0, 0, 0, 0.5) 100%);
}

/* Above the vignette overlay, or they'd be dimmed by it. */
.cm-tooltip,
.cm-loading {
  z-index: 2;
}

.cm-stage {
  width: 100%;
  height: 100%;
  cursor: grab;
  touch-action: none;
}

.cm-stage.dragging { cursor: grabbing; }

.cm-stage canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.cm-loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(320px, 70%);
  text-align: center;
}

.cm-loading[hidden] { display: none; }

.cm-loading-text {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--bone-dim);
  margin: 0 0 10px;
}

.cm-progress {
  height: 2px;
  background: var(--line-strong);
  overflow: hidden;
}

.cm-progress-bar {
  height: 100%;
  width: 0%;
  background: var(--accent);
  transition: width 0.2s linear;
}

.cm-tooltip {
  position: absolute;
  max-width: 320px;
  background: rgba(14, 12, 8, 0.88);
  border: 1px solid var(--line-strong);
  border-left: 2px solid var(--accent);
  padding: 10px 14px;
  pointer-events: none;
  backdrop-filter: blur(3px);
}

.cm-tooltip[hidden] { display: none; }

.cm-tooltip-name {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--accent-strong);
  margin: 0 0 8px;
}

.cm-tooltip-desc {
  font-size: var(--text-sm);
  line-height: var(--leading-snug);
  color: var(--bone-100);
  margin: 0;
}
`;
