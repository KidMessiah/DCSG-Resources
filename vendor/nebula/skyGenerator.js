/*
Sky generator - drives Delvar's Nebula Generator (vendored verbatim under
`source/`, GPL-3.0, see NOTICE.md) as a plain function that renders into an
offscreen canvas.

This is an adaptation of upstream's `source/nebula.js`: the seeded
configuration below and the layer stack in `createLayers()` follow it
parameter-for-parameter, in the same order, off the same seeded RNG - which is
the whole point, since changing any of it changes what a seed looks like. What
is NOT upstream's is the plumbing: no RequireJS, no query vars, no DOM lookups,
a fixed render size instead of the viewport's, and a progressive
layer-at-a-time driver so the page stays responsive while it renders.
*/

// Fixed render size. Upstream uses the viewport, but several seeded parameters
// are derived from the width (nebula `scale`, milky way `scale`/`nScale`), so
// a viewport-sized render means the same seed looks different on every
// monitor. Pinning it is what makes "canonical sky" a meaningful idea at all.
// 16:9 to match the dome's angular aspect in the widget, and small enough that
// the per-pixel noise work stays in the low seconds - the nebula layers are
// soft, so the texture upscales onto the dome without reading as blurry.
export const SKY_WIDTH = 1280;
export const SKY_HEIGHT = 720;

// --- Module loading ------------------------------------------------------
// Upstream's files are AMD (`define(name, deps, factory)`) and expect
// RequireJS. Rather than edit vendored code, install a tiny synchronous
// `define` and load the files in dependency order - every module here is a
// plain factory with no async behaviour, so resolving deps straight out of a
// registry is enough.

const MODULE_ORDER = [
  'Colour',
  'Random',
  'Noise',
  'ObjectPool',
  'Vector3',
  'Layer',
  'Random/SeedRandom',
  'Random/Gaussian',
  'Noise/josephg_noisejs',
  'Noise/Perlin',
  'Noise/Simplex',
  'Noise/Blender',
  'Noise/Blender/TwoD/FastVoroni',
  'LayerPointStars',
  'LayerBigStars',
  'LayerBrightStar',
  'LayerNebula3',
  'LayerMilkyWay3',
  'LayerVignette'
];

const BASE = new URL('./source/', import.meta.url);

let modulesPromise = null;

function loadScript(url) {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = url;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error('Failed to load ' + url));
    document.head.appendChild(el);
  });
}

async function loadModules() {
  const registry = Object.create(null);

  // Installed only for the duration of the load, then removed - `define` is a
  // global other libraries sniff for, and leaving a fake AMD loader lying
  // around would make anything else on the page misdetect its environment.
  const previousDefine = window.define;
  window.define = function (name, deps, factory) {
    const args = (deps || []).map(dep => {
      if (!(dep in registry)) {
        throw new Error(`Nebula module "${name}" wants "${dep}" before it was loaded`);
      }
      return registry[dep];
    });
    registry[name] = factory.apply(null, args);
  };
  window.define.amd = {};

  try {
    for (const name of MODULE_ORDER) {
      await loadScript(new URL(name + '.js', BASE).href);
      if (!(name in registry)) {
        throw new Error(`Nebula module "${name}" did not register itself`);
      }
    }
  } finally {
    if (previousDefine === undefined) delete window.define;
    else window.define = previousDefine;
  }

  return registry;
}

function modules() {
  if (!modulesPromise) {
    // Cached at module scope: the widget can be torn down and rebuilt (the
    // site keeps widget DOM in a cache and re-mounts it), and re-fetching
    // and re-evaluating 20 scripts each time would be pure waste.
    modulesPromise = loadModules().catch(err => {
      modulesPromise = null; // let a later attempt retry rather than latch the failure
      throw err;
    });
  }
  return modulesPromise;
}

// A few of Delvar's layers (LayerMilkyWay3 in particular) call console.log
// directly with per-run debug output (density ranges, star counts) - fine
// for his own standalone page, noisy in an app that generates skies
// routinely. Rather than edit vendored code, this silences console.log for
// the duration of a call and restores it in a finally, the same
// don't-touch-the-vendor-files approach the AMD shim above uses. Only log
// is touched - warn/error still surface normally. Every vendor entry point
// this wraps (startProcessing, generateNebulaData) is synchronous, so this
// stays synchronous too rather than risking a suppression window that
// outlives the call via an await.
function withoutVendorLogs(fn) {
  const original = console.log;
  console.log = () => {};
  try {
    return fn();
  } finally {
    console.log = original;
  }
}

// --- Seeds ---------------------------------------------------------------

/** A fresh random seed string, in upstream's format (8 hex chars). */
export function randomSeed(length = 8, base = 16) {
  const pow = Math.pow(base, length) - 1;
  const i = pow + Math.round(Math.random() * pow);
  const r = i.toString(base);
  return r.substring(r.length - length);
}

// --- Configuration -------------------------------------------------------
// Follows upstream `generateConfiguration()`. The order of `seedRandom`
// calls is load-bearing: each one consumes RNG state, so reordering or
// dropping a call silently changes every sky. Kept exactly as upstream has
// it, oddities included (see the stray `seedRandom.between(0.4, 1)` and the
// `brightStars.lenght` typo, both upstream's and both left alone because
// removing them would shift the sequence).

function buildSettings(Colour, seedRandom, seed, width, height) {
  const settings = {
    seed,
    pixleScale: 1,
    width,
    height,
    nebulaMode: 3,
    milkyWayMode: 3,
    vignette: true
  };
  settings.realWidth = Math.floor(settings.width / settings.pixleScale);
  settings.realHeight = Math.floor(settings.height / settings.pixleScale);

  const pointStars = { name: 'pointStars' };
  pointStars.seed = settings.seed + '-' + pointStars.name;
  seedRandom.setSeed(pointStars.seed);
  pointStars.density = seedRandom.between(0.005, 0.05);
  pointStars.brightness = seedRandom.between(0.1, 0.2);
  settings.pointStars = pointStars;

  const bigStars = { name: 'bigStars' };
  bigStars.seed = settings.seed + '-' + bigStars.name;
  seedRandom.setSeed(bigStars.seed);
  bigStars.density = pointStars.density; // copy density from point stars
  settings.bigStars = bigStars;

  const brightStar = { seed: settings.seed + '-brightStar' };
  seedRandom.setSeed(brightStar.seed);
  brightStar.maxTotalBrightness = seedRandom.between(0, 2);
  const brightStars = [];

  for (let i = 0, tb = 0; tb <= brightStar.maxTotalBrightness && i < 25; i++) {
    const t2 = {};
    t2.name = 'brightStar-' + i;
    t2.seed = settings.seed + '-' + t2.name;
    seedRandom.setSeed(t2.seed);

    t2.h = seedRandom.between(0, 1);
    t2.brightness = seedRandom.between(0.1, 1);

    t2.starRadius = seedRandom.between(1 / 256, 5 / 256);
    const t = Math.pow(seedRandom.between(0, 1), 3);
    t2.glowRadius = 0.05 + (t * (brightStar.maxTotalBrightness - tb));
    t2.glowRadius = Math.max(0.05, Math.min(t2.glowRadius, 1));

    t2.x = seedRandom.between(0, 1);
    t2.y = seedRandom.between(0, 1);
    t2.z = seedRandom.between(0, 1);
    t2.z = t2.z * t2.z * 2;

    tb += t2.glowRadius * t2.glowRadius;
    brightStars.push(t2);
  }
  settings.brightStar = brightStar;
  settings.brightStars = brightStars;

  const nebula = { seed: settings.seed + '-nebula' };
  seedRandom.setSeed(nebula.seed);
  nebula.count = Math.round(seedRandom.between(1, 4));
  const nebulas = [];

  for (let i = 0; i < nebula.count; i++) {
    const t = {};
    t.name = 'nebula-' + i;
    t.seed = settings.seed + '-' + t.name;
    seedRandom.setSeed(t.seed);

    t.scale = seedRandom.between(settings.realWidth / 2, settings.realWidth * 2);
    t.roughness = 1;
    seedRandom.between(0.4, 1); // upstream: result discarded, but it advances the RNG
    t.lacunarity = seedRandom.between(2, 4);
    t.octaves = seedRandom.between(5, 8);
    t.offsetX = seedRandom.between(0, 50000);
    t.offsetY = seedRandom.between(0, 50000);
    t.alphaExponent = seedRandom.between(1, 5);
    t.distortionFactor = seedRandom.between(0.5, 2);
    t.distortionScale = seedRandom.between(0.5, 5);
    t.hueFactor = seedRandom.between(-1, 1);
    t.dHuePwr = seedRandom.between(0, 1);
    t.normalize = false;

    t.colour = new Colour.hsla(
      seedRandom.between(0, 1),
      seedRandom.between(0, 1),
      seedRandom.between(0.25, 1),
      seedRandom.between(0.5, 1)
    );
    // `lenght` is upstream's typo, so this is always undefined -> falsy ->
    // always takes the random branch. Preserved: "fixing" it would change
    // every seed's ambient lighting.
    t.ambiant = brightStars.lenght === 0 ? 1 : seedRandom.between(0, 1);
    nebulas.push(t);
  }

  settings.nebula = nebula;
  settings.nebulas = nebulas;

  const milkyWay = { name: 'milkyWay' };
  milkyWay.seed = settings.seed + '-' + milkyWay.name;
  seedRandom.setSeed(milkyWay.seed);

  milkyWay.scale = seedRandom.between(settings.realWidth / 5, settings.realWidth / 10);
  milkyWay.nScale = seedRandom.between(settings.realWidth / 5, settings.realWidth / 6);
  milkyWay.widthDevisor = seedRandom.between(2, 8);

  milkyWay.gaussianVariance = 0.02 + seedRandom.betweenPow(0, 1, 4);
  milkyWay.gaussianRange = seedRandom.between(0.1, 0.8);

  milkyWay.gaussianMultiplier = seedRandom.between(0.05, 0.5);
  milkyWay.gaussianMin = seedRandom.between(0, 0.6 - milkyWay.gaussianMultiplier);
  milkyWay.alphaExponent = seedRandom.between(1, 5);

  milkyWay.roughness = 0.75;
  milkyWay.lacunarity = seedRandom.between(1.5, 3);

  milkyWay.octaves = seedRandom.between(7, 9);
  milkyWay.offsetX = seedRandom.between(0, 50000);
  milkyWay.offsetY = seedRandom.between(0, 50000);
  milkyWay.distortionFactor = seedRandom.between(1, 2);
  milkyWay.distortionScale = seedRandom.between(1, 3);
  milkyWay.hueFactor = seedRandom.between(-0.5, 0.5);
  milkyWay.dHuePwr = seedRandom.between(1, 1.5);

  milkyWay.colour = new Colour.hsla(
    seedRandom.between(0, 1),
    seedRandom.between(0, 1),
    seedRandom.between(0.25, 1),
    seedRandom.between(0.5, 1)
  );
  milkyWay.rotation = seedRandom.between(0, Math.PI);
  milkyWay.brightness = seedRandom.between(0.1, 1);

  settings.milkyWay = milkyWay;
  settings.ratioWidthHeight = settings.width / settings.height;

  return settings;
}

// --- Layers --------------------------------------------------------------
// Same stack, same order, same composite operations as upstream. Order
// matters visually (the first vignette multiplies the nebulae down before the
// bright stars are added on top of it, so the stars stay bright while the
// gas doesn't).

function makeCanvas(name, width, height) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  c.id = name;
  return c;
}

// Bright stars carry pixel coordinates that the NEBULA layers read back
// (pushBrightStarsForward indexes the depth array by realX/realY), so this
// has to run before any layer is processed - including when the bright-star
// layers themselves are being skipped in gas-only mode.
function placeBrightStars(settings) {
  const supersampling = 1;
  const maxGlowRadius = (((settings.width / 7.5) * supersampling) / settings.pixleScale) * 2;

  for (const s of settings.brightStars) {
    s.realX = Math.floor(s.x * settings.width);
    s.realY = Math.floor(s.y * settings.height);
    s.realZ = Math.floor(s.z * (settings.width / 2));
    s.realWidth = s.realHeight = (Math.floor((s.glowRadius * maxGlowRadius) / 2) * 2) + 1; // odd, so it has a centre pixel
  }
}

/**
 * Builds the layer stack as an array of FACTORIES rather than instances.
 *
 * That indirection is not stylistic. LayerNebula3 allocates six
 * full-resolution Float32Arrays up front (density, dHue, depth, directLight,
 * smoothDirectLight, and a 3-wide normal array) - about 266MB each at
 * 3840x2160. Constructing every layer before processing any of them, which
 * is what upstream does and what this used to do, therefore meant holding
 * four nebulae's worth of those at once and blowing past a gigabyte on a
 * bake. Creating each layer only when it's about to be processed, and
 * dropping it once it's been drawn, keeps the peak at roughly one nebula.
 *
 * @param {'all'|'gas'} mode 'all' is upstream's full stack. 'gas' leaves only
 *   the milky way and the nebulae, omitting both the three star layers and
 *   the two vignettes:
 *
 *   - The stars come back as real 3D geometry (see generateStarField), rather
 *     than as 1px marks baked into a texture that then gets magnified.
 *   - The vignettes are a property of a FRAME, not of the sky. Upstream shows
 *     one fixed rectangular image, so baking them in is right there. Here the
 *     texture is wrapped on a dome the viewer pans around, so a baked vignette
 *     slides about with the stars and reads as a dark ring hanging in space
 *     instead of as falloff at the edge of the picture. The widget draws its
 *     own, fixed to the viewport, where it belongs.
 *
 *     They also degrade badly at anything near a square aspect: upstream's
 *     second vignette runs from min(w,h)/2 to max(w,h)/2*0.9, which is a broad
 *     falloff at 16:9 but collapses to a narrow, hard-edged ring as the two
 *     sides approach each other.
 */
function createLayers(m, settings, mode, milkyWayOpacity) {
  const factories = [];
  const withStars = mode !== 'gas';
  const withVignette = settings.vignette && mode !== 'gas';
  const halfMax = Math.max(settings.realWidth / 2, settings.realHeight / 2);
  const halfMin = Math.min(settings.realWidth / 2, settings.realHeight / 2);

  placeBrightStars(settings);

  // Milky Way - rendered on its own oversized, rotated canvas (its diagonal,
  // so no corner of the output is ever left uncovered once it's turned).
  factories.push(() => {
    const s = settings.milkyWay;
    const tw = Math.floor(Math.sqrt(Math.pow(settings.realWidth, 2) + Math.pow(settings.realHeight, 2)));
    const th = Math.floor(tw / s.widthDevisor);
    const layer = new m['LayerMilkyWay3'](makeCanvas(s.name, tw, th), undefined, undefined, s);
    layer.setTransform(1, 1, settings.realWidth / 2, settings.realHeight / 2, Math.floor(tw / 2), Math.floor(th / 2), s.rotation);
    layer.opacity = milkyWayOpacity;
    return layer;
  });

  if (withStars) {
    factories.push(() => {
      const s = settings.pointStars;
      const layer = new m['LayerPointStars'](makeCanvas(s.name, settings.realWidth, settings.realHeight), s.seed, s.density, s.brightness);
      layer.compositeOperation = 'lighter';
      return layer;
    });

    factories.push(() => {
      const s = settings.bigStars;
      const layer = new m['LayerBigStars'](makeCanvas(s.name, settings.realWidth, settings.realHeight), s.seed, s.density);
      layer.compositeOperation = 'lighter';
      return layer;
    });
  }

  settings.nebulas.forEach(s => {
    factories.push(() => new m['LayerNebula3'](
      makeCanvas(s.name, settings.realWidth, settings.realHeight),
      undefined, undefined, undefined, undefined, s, settings.brightStars
    ));
  });

  if (withVignette) {
    factories.push(() => {
      const layer = new m['LayerVignette'](makeCanvas('Vignette-0', settings.realWidth, settings.realHeight), 0.25, halfMax, halfMin * 0.5);
      layer.compositeOperation = 'multiply';
      return layer;
    });
  }

  if (withStars) {
    settings.brightStars.forEach(s => {
      factories.push(() => {
        const layer = new m['LayerBrightStar'](makeCanvas(s.name, s.realWidth, s.realWidth), s.seed, s.h, s.brightness, s.starRadius, s.glowRadius);
        layer.compositeOperation = 'lighter';
        layer.setTransform(1, 1, s.realX, s.realY, Math.floor(s.realWidth / 2), Math.floor(s.realWidth / 2));
        return layer;
      });
    });
  }

  if (withVignette) {
    factories.push(() => {
      const layer = new m['LayerVignette'](makeCanvas('Vignette-1', settings.realWidth, settings.realHeight), 1, halfMax * 0.9, halfMin);
      layer.compositeOperation = 'soft-light';
      return layer;
    });
  }

  return factories;
}

// Draws one finished layer onto the accumulating output. Upstream redraws
// every layer from scratch after each one finishes; doing it incrementally
// gives an identical result (the layers are drawn in the same order either
// way, and each composite op applies to whatever is already underneath) but
// lets each layer's canvas be released as soon as it has been drawn.
function drawLayer(ctx, layer) {
  ctx.save();
  // Per-layer opacity is ours, not upstream's - it has no notion of one.
  // Used to hold the milky way back, which at full strength is bright enough
  // to fog the whole sky and flatten everything else out.
  ctx.globalAlpha = layer.opacity === undefined ? 1 : layer.opacity;
  ctx.globalCompositeOperation = layer.compositeOperation;
  ctx.translate(layer.offsetX, layer.offsetY);
  ctx.scale(layer.scaleX, layer.scaleY);
  ctx.rotate(layer.rotation);
  ctx.translate(-layer.regX, -layer.regY);
  ctx.drawImage(layer.canvas, 0, 0);
  ctx.restore();
}

// --- Public entry point --------------------------------------------------

/**
 * Render one sky.
 *
 * Layers are processed one per macrotask rather than in a single blocking
 * loop (upstream does the same): the nebula layers are seconds of per-pixel
 * JS each, and running them back to back would lock the tab up entirely with
 * no way to show progress.
 *
 * @param {object}   options
 * @param {string}   options.seed        Seed string; same seed, same sky.
 * @param {Function} [options.onProgress] Called `(done, total, canvas)` after
 *                                        each layer, with the canvas composited
 *                                        so far - use it to show the sky building.
 * @param {Function} [options.isCancelled] Polled between layers; return true to
 *                                         abandon the render (e.g. the seed
 *                                         changed, or the widget was unmounted).
 * @returns {Promise<{canvas: HTMLCanvasElement, seed: string, settings: object}>}
 */
export async function generateSky({
  seed,
  width = SKY_WIDTH,
  height = SKY_HEIGHT,
  mode = 'all',
  milkyWayOpacity = 1,
  onProgress,
  isCancelled
} = {}) {
  const m = await modules();

  const seedRandom = new m['Random'].SeedRandom();
  const settings = buildSettings(m['Colour'], seedRandom, seed, width, height);

  const output = makeCanvas('sky-' + seed, settings.realWidth, settings.realHeight);
  const ctx = output.getContext('2d');
  ctx.save();
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, output.width, output.height);
  ctx.restore();

  const factories = createLayers(m, settings, mode, milkyWayOpacity);

  for (let i = 0; i < factories.length; i++) {
    if (isCancelled && isCancelled()) return null;

    // Built here, not up front, and deliberately not retained afterwards -
    // see createLayers for why. Scoped to the iteration so the layer and its
    // (very large) buffers become collectable as soon as it's been drawn.
    let layer = factories[i]();
    if (layer.status === m['Layer'].Status.ReadyForProcessing) {
      withoutVendorLogs(() => layer.startProcessing());
    }
    if (layer.status === m['Layer'].Status.Success) {
      drawLayer(ctx, layer);
    }
    layer = null;

    if (onProgress) onProgress(i + 1, factories.length, output);

    // Yield so the browser can paint the partial sky and stay interactive.
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  return { canvas: output, seed, settings };
}

/**
 * The milky way's own stars, as data.
 *
 * LayerMilkyWay3 splats a dense star field along its band (splatStars) and
 * bakes it into the same canvas as the diffuse gas. That's the last place
 * stars were still being baked into a texture, so it's the last place they
 * still looked soft and refused to twinkle - the same problem the point and
 * big stars had before they became geometry.
 *
 * This replays his splat loop to recover those stars as positions instead of
 * pixels. It reads his arrays and draws from his RNG in his order, so the
 * distribution - including the lens-shaped envelope, which comes from
 * scaling the across-band spread by the gaussian PDF of the along-band
 * position - is his.
 *
 * Two things are deliberately NOT his:
 *
 *  - It runs at the reference resolution rather than the gas texture's. His
 *    star count is width*height*brightness*0.05, so at bake resolution the
 *    same seed would splat nine times as many stars as at preview. Pinning it
 *    keeps a seed's sky the same sky at any gas resolution.
 *  - `nebulaToCanvas` reads a module-scoped buffer that only `startProcessing`
 *    allocates, so the gas and the splat can't be driven separately on one
 *    instance. This uses its own instance and calls `generateNebulaData`
 *    alone, which touches no such buffer.
 *
 * @returns {Promise<{positions: Float32Array, colors: Float32Array,
 *   radii: Float32Array, count: number}>} Positions normalised 0..1 across
 *   the reference image; radii in reference-image pixels, as with bigStars.
 */
export async function generateMilkyWayStars({ seed } = {}) {
  const m = await modules();
  const Colour = m['Colour'];

  const settings = buildSettings(Colour, new m['Random'].SeedRandom(), seed, SKY_WIDTH, SKY_HEIGHT);
  const s = settings.milkyWay;

  // Same band canvas his layer would get: the output's diagonal, so no corner
  // is left uncovered once the band is rotated.
  const tw = Math.floor(Math.sqrt(SKY_WIDTH * SKY_WIDTH + SKY_HEIGHT * SKY_HEIGHT));
  const th = Math.floor(tw / s.widthDevisor);

  const layer = new m['LayerMilkyWay3'](makeCanvas('milkyWay-stars', tw, th), undefined, undefined, s);
  withoutVendorLogs(() => layer.generateNebulaData()); // fills densityArray / darkArray / dHueArray

  const count = Math.round(tw * th * s.brightness * 0.05);
  const cos = Math.cos(s.rotation);
  const sin = Math.sin(s.rotation);
  const regX = Math.floor(tw / 2);
  const regY = Math.floor(th / 2);

  const us = [], vs = [], cols = [], rads = [];

  // His loop retries (i--) when a sample lands outside the band, which
  // terminates fine for any sane gaussian range but has no hard bound. The
  // attempt cap is purely a safety net against a pathological seed hanging
  // the page; at 40x the star count it will not be reached in practice, so
  // it can't quietly change what a seed looks like.
  const maxAttempts = count * 40;
  let attempts = 0;

  for (let i = 0; i < count && attempts < maxAttempts; i++) {
    attempts++;

    const x = layer.gaussian.random() * 2;
    if (x < -1 || x > 1) { i--; continue; }
    const g = layer.gaussian.pdf(x);
    const y = layer.gaussian.random() * 2 * (g + 0.5);
    if (y < -1 || y > 1) { i--; continue; }

    // Continuous position for PLACEMENT; a separately-floored copy only for
    // indexing into his per-pixel arrays, which have no sub-pixel data to
    // give.
    //
    // His own splatStars floors this same value for both the array lookup
    // AND the draw position - fine for him, because his band canvas IS the
    // output resolution, so the floor lands one row per output pixel and is
    // invisible. Here that same integer grid becomes the star's placement
    // across a dome that can be far larger than the reference render, so its
    // coarse axis (th, as few as ~183 rows depending on the seed's
    // widthDevisor) shows up as a visible lattice of rows once magnified and
    // supersampled. Keeping the placement continuous removes the grid
    // without changing which stars exist or how bright they are - it only
    // un-quantizes where within their pixel each one sits.
    const bandXf = (x + 1) * 0.5 * tw;
    const bandYf = (y + 1) * 0.5 * th;
    const bandX = Math.floor(bandXf);
    const bandY = Math.floor(bandYf);
    const j = bandX + bandY * tw;

    // His rejections, and note he does NOT retry these - they just thin the
    // field out where the band is dark or empty.
    if (layer.darkArray[j] > 0.99 || layer.densityArray[j] <= 0) continue;

    const density = Math.max(0, Math.min(layer.densityArray[j], 1));
    if (density <= 0) continue;

    const hue = (s.colour.h + (layer.dHueArray[j] * s.hueFactor * (1 - layer.darkArray[j]))) % 1;
    const radius = layer.seedRandom.betweenPow(0.4, 2, 4.5);

    // Band canvas -> output image, applying the same transform the layer is
    // composited with (rotate about the band's centre, then centre on the
    // output). Stars landing outside the image are dropped, because that's
    // what the canvas would have clipped away.
    const dx = bandXf - regX;
    const dy = bandYf - regY;
    const u = (dx * cos - dy * sin + SKY_WIDTH / 2) / SKY_WIDTH;
    const v = (dx * sin + dy * cos + SKY_HEIGHT / 2) / SKY_HEIGHT;
    if (u < 0 || u > 1 || v < 0 || v > 1) continue;

    const rgba = Colour.hslaToRgba(hue, s.colour.s, density, 1);
    us.push(u);
    vs.push(v);
    // Density is both his lightness and his alpha, so it counts twice toward
    // how bright a star reads. Folding it in here keeps the faint outskirts
    // of the band faint instead of flattening the whole cloud to one value.
    cols.push(rgba.r * density, rgba.g * density, rgba.b * density);
    rads.push(radius);
  }

  const n = us.length;
  const positions = new Float32Array(n * 2);
  const colors = new Float32Array(n * 3);
  const radii = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    positions[i * 2] = us[i];
    positions[i * 2 + 1] = vs[i];
    colors[i * 3] = cols[i * 3];
    colors[i * 3 + 1] = cols[i * 3 + 1];
    colors[i * 3 + 2] = cols[i * 3 + 2];
    radii[i] = rads[i];
  }
  return { positions, colors, radii, count: n };
}

/**
 * One of Delvar's bright stars - the spiked, glowing kind - rendered on its
 * own, to a canvas of your choosing, unconnected to any sky.
 *
 * The widget uses this to give each constellation a single anchor star. It's
 * his LayerBrightStar doing all the work, exactly as it does for the sky's
 * own bright stars; only the parameters are ours. Everything in his renderer
 * is sized as a fraction of canvas.width, so `size` is pure resolution - it
 * changes how sharp the sprite is, not what it looks like.
 *
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function makeBrightStarSprite({
  seed,
  hue = 0.11,
  brightness = 0.85,
  starRadius = 3 / 256,
  glowRadius = 0.34,
  size = 256
} = {}) {
  const m = await modules();
  const canvas = makeCanvas('sprite-' + seed, size, size);
  const layer = new m['LayerBrightStar'](canvas, seed, hue, brightness, starRadius, glowRadius);
  withoutVendorLogs(() => layer.startProcessing());
  return canvas;
}

/**
 * A seeded RNG from the vendored seedrandom, for callers that want to derive
 * their own deterministic values (star jitter, depths) from the same seed.
 */
export async function seededRandom(seed) {
  const m = await modules();
  return new m['Random'].SeedRandom(seed);
}

// --- Star field ----------------------------------------------------------
// Delvar's three star layers rasterise into pixels: point stars are single
// pixels, big stars are 0.5-2px radial gradients, bright stars are a sprite
// drawn onto their own small canvas. Baked into a texture and then stretched
// over the dome, all three turn to mush - they are the reason the sky reads
// as low resolution, far more than the gas does.
//
// So instead of taking his pixels, this replays the exact same seeded
// sampling loops and hands back the stars as *data*, for the widget to draw
// as real geometry at screen resolution. The RNG call order below mirrors
// LayerPointStars.startProcessing and LayerBigStars.startProcessing
// statement for statement; change the order and you change every seed.
//
// Star counts are always computed at the reference resolution rather than
// the gas texture's, because his density is per-pixel: rendering the gas at
// 4K would otherwise multiply the star count ninefold and give a completely
// different sky.

/**
 * @returns {Promise<{pointStars: object, bigStars: object, brightStars: Array}>}
 *   Positions are normalised 0..1 across the image, so the widget can map
 *   them onto the dome's angular span at whatever resolution it likes.
 */
/**
 * @param {number} [options.pointStarDensityMultiplier] Scales the ordinary
 *   point-star COUNT above what Delvar's own density formula gives.
 * @param {number} [options.bigStarDensityMultiplier] Same, for the rarer
 *   "big star" gradient dots - a separate knob because they read as a
 *   distinct population (fewer, brighter, no twinkle-amount parity with the
 *   point field) and tuning one shouldn't silently drag the other along.
 *
 * Either multiplier is applied by continuing to draw from the SAME seeded
 * RNG stream past Delvar's original count rather than starting a new one, so
 * the first N stars (his count) are pixel-for-pixel identical to
 * multiplier=1 - a boost only ever adds stars, never changes the ones that
 * were already there. Neither touches the milky way's own star count, which
 * has its own dedicated tuning (see NOTICE.md / generateMilkyWayStars) and
 * was deliberately not the thing found sparse.
 */
export async function generateStarField({ seed, pointStarDensityMultiplier = 1, bigStarDensityMultiplier = 1 } = {}) {
  const m = await modules();
  const Colour = m['Colour'];
  const SeedRandom = m['Random'].SeedRandom;

  const settings = buildSettings(Colour, new SeedRandom(), seed, SKY_WIDTH, SKY_HEIGHT);
  placeBrightStars(settings);

  const width = settings.realWidth;
  const height = settings.realHeight;
  const wxh = width * height;

  // -- Point stars (mirrors LayerPointStars) --
  const ps = settings.pointStars;
  const psRandom = new SeedRandom(ps.seed);
  const psCount = Math.round(wxh * ps.density * pointStarDensityMultiplier);
  const pointPositions = new Float32Array(psCount * 2);
  const pointColors = new Float32Array(psCount * 3);
  const pointBrightness = new Float32Array(psCount);

  for (let i = 0; i < psCount; i++) {
    const p = Math.floor(psRandom.random() * wxh);
    const hue = psRandom.random();
    const saturation = psRandom.random() * 0.3;
    const lightness = Math.log(1 - psRandom.random()) * -ps.brightness;

    pointPositions[i * 2] = (p % width) / width;
    pointPositions[i * 2 + 1] = Math.floor(p / width) / height;

    // His lightness runs well past 1 (it's a log of a uniform), and the
    // canvas path just clips it. Splitting it into a clamped colour plus a
    // brightness multiplier keeps the bright tail as actual brightness
    // instead of throwing it away.
    const clamped = Math.min(lightness, 1);
    const rgba = Colour.hslaToRgba(hue, saturation, clamped, 1);
    pointColors[i * 3] = rgba.r;
    pointColors[i * 3 + 1] = rgba.g;
    pointColors[i * 3 + 2] = rgba.b;
    pointBrightness[i] = Math.max(lightness, 0);
  }

  // -- Big stars (mirrors LayerBigStars) --
  const bs = settings.bigStars;
  const bsRandom = new SeedRandom(bs.seed);
  const bsCount = Math.round(wxh * bs.density * 0.005 * bigStarDensityMultiplier);
  const bigPositions = new Float32Array(bsCount * 2);
  const bigColors = new Float32Array(bsCount * 3);
  const bigRadii = new Float32Array(bsCount);

  for (let i = 0; i < bsCount; i++) {
    const hue = bsRandom.random();
    const saturation = bsRandom.between(0.9, 1);
    const lightness = bsRandom.between(0.8, 1);
    const radius = bsRandom.between(0.5, 2);
    // Order matters: his setTransform evaluates x before y.
    const x = Math.floor(bsRandom.random() * width);
    const y = Math.floor(bsRandom.random() * height);

    const rgba = Colour.hslaToRgba(hue, saturation, Math.min(lightness, 1), 1);
    bigPositions[i * 2] = x / width;
    bigPositions[i * 2 + 1] = y / height;
    bigColors[i * 3] = rgba.r;
    bigColors[i * 3 + 1] = rgba.g;
    bigColors[i * 3 + 2] = rgba.b;
    bigRadii[i] = radius;
  }

  // -- Bright stars --
  // These keep his renderer entirely: each one is drawn by LayerBrightStar
  // onto its own canvas exactly as before, just at a larger pixel size so it
  // stays sharp as a 3D sprite. His code sizes every feature as a fraction
  // of canvas.width, so a bigger canvas is the same sprite with more pixels.
  const BRIGHT_SPRITE_MIN = 128;
  const BRIGHT_SPRITE_MAX = 1024;
  const brightStars = settings.brightStars.map(s => {
    const px = Math.min(BRIGHT_SPRITE_MAX, Math.max(BRIGHT_SPRITE_MIN, s.realWidth * 2));
    const canvas = makeCanvas(s.name, px, px);
    const layer = new m['LayerBrightStar'](canvas, s.seed, s.h, s.brightness, s.starRadius, s.glowRadius);
    withoutVendorLogs(() => layer.startProcessing());
    return {
      canvas,
      x: s.x,
      y: s.y,
      // His z is only ever used to fake lighting depth against the nebulae.
      // It is, however, a perfectly good actual depth, so the widget uses it
      // as one - the data was already three-dimensional.
      z: s.z,
      // Angular footprint, as a fraction of the image width. The widget turns
      // this into a world-space size once it knows the dome's span.
      widthFraction: s.realWidth / settings.width
    };
  });

  return {
    pointStars: { positions: pointPositions, colors: pointColors, brightness: pointBrightness, count: psCount },
    bigStars: { positions: bigPositions, colors: bigColors, radii: bigRadii, count: bsCount },
    brightStars
  };
}
