/**
 * Service Worker for AwkwardDM Resources
 * Provides offline functionality and caching for better performance
 */

const CACHE_NAME = 'awkwarddm-resources-v1.7.0';
const STATIC_CACHE_NAME = 'awkwarddm-static-v1.7.0';
const DYNAMIC_CACHE_NAME = 'awkwarddm-dynamic-v1.7.0';

// Files to cache immediately on install. Paths are relative - they resolve
// against this script's own URL, which keeps caching correct whether the
// site is served from a domain root or a GitHub Pages /RepoName/ subpath.
const STATIC_ASSETS = [
  './',
  './index.html',
  './app-modular.js',
  './style.css',
  './enhanced-styles.css',
  './content/homepage.json',
  './content/list.json',
  // Fonts
  './fonts/ibm-plex-serif-600.woff2',
  './fonts/ibm-plex-sans-var.woff2',
  './fonts/ibm-plex-mono-400.woff2',
  './fonts/ibm-plex-mono-500.woff2',
  './content/constellations.json',
  // Add widget files
  './widgets/constellation.js',
  './widgets/flanking.js',
  './widgets/flexbonus.js',
  './widgets/flexcasting.js',
  './widgets/heritage.js',
  './widgets/homebrew.js',
  './widgets/important.js',  './widgets/inspiration.js',
  './widgets/intelligence.js',
  './widgets/resurrection.js',
  './widgets/signature.js',
  './widgets/skills.js',
  './widgets/warlock.js',
  // Nebula Generator (vendored, see vendor/nebula/NOTICE.md). The
  // Constellation Map loads these 19 modules in dependency order at runtime,
  // so a partial cache is worse than none - if any one is missing offline,
  // the sky can't render at all.
  './vendor/nebula/skyGenerator.js',
  './vendor/nebula/source/Colour.js',
  './vendor/nebula/source/Random.js',
  './vendor/nebula/source/Noise.js',
  './vendor/nebula/source/ObjectPool.js',
  './vendor/nebula/source/Vector3.js',
  './vendor/nebula/source/Layer.js',
  './vendor/nebula/source/Random/SeedRandom.js',
  './vendor/nebula/source/Random/Gaussian.js',
  './vendor/nebula/source/Noise/josephg_noisejs.js',
  './vendor/nebula/source/Noise/Perlin.js',
  './vendor/nebula/source/Noise/Simplex.js',
  './vendor/nebula/source/Noise/Blender.js',
  './vendor/nebula/source/Noise/Blender/TwoD/FastVoroni.js',
  './vendor/nebula/source/LayerPointStars.js',
  './vendor/nebula/source/LayerBigStars.js',
  './vendor/nebula/source/LayerBrightStar.js',
  './vendor/nebula/source/LayerNebula3.js',
  './vendor/nebula/source/LayerMilkyWay3.js',
  './vendor/nebula/source/LayerVignette.js',
  // SunCalc (vendored, see vendor/suncalc/NOTICE.md) - the moon's phase.
  './vendor/suncalc/suncalc.js'
];

// Files that should be cached dynamically
const DYNAMIC_CACHE_PATTERNS = [
  /\/pdfs\//,
  /\/images\//,
  /\/videos\//,
  /\/modules\//
];

// Maximum number of items in dynamic cache
const MAX_DYNAMIC_CACHE_SIZE = 50;

/**
 * Install event - cache static assets
 */
self.addEventListener('install', (event) => {
  console.log('SW: Installing service worker...');
  
  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(STATIC_CACHE_NAME).then((cache) => {
        console.log('SW: Caching static assets...');
        return cache.addAll(STATIC_ASSETS);
      }),
      // Initialize dynamic cache
      caches.open(DYNAMIC_CACHE_NAME)
    ]).then(() => {
      console.log('SW: Service worker installed successfully');
      return self.skipWaiting();
    }).catch((error) => {
      console.error('SW: Error during install:', error);
    })
  );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('SW: Activating service worker...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      const validCaches = [STATIC_CACHE_NAME, DYNAMIC_CACHE_NAME];
      
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!validCaches.includes(cacheName)) {
            console.log('SW: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('SW: Service worker activated');
      return self.clients.claim();
    }).catch((error) => {
      console.error('SW: Error during activation:', error);
    })
  );
});

/**
 * Fetch event - serve cached content or fetch from network
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip external requests
  if (url.origin !== location.origin) {
    return;
  }
  
  event.respondWith(
    handleFetchRequest(request)
  );
});

/**
 * Handle fetch requests with caching strategy
 * @param {Request} request - The fetch request
 * @returns {Promise<Response>} Response from cache or network
 */
async function handleFetchRequest(request) {
  const url = new URL(request.url);
  
  try {
    // Strategy 1: Cache first for static assets
    if (isStaticAsset(url.pathname)) {
      return await cacheFirst(request);
    }
    
    // Strategy 2: Network first for dynamic content
    if (isDynamicAsset(url.pathname)) {
      return await networkFirst(request);
    }
    
    // Strategy 3: Stale while revalidate for API calls
    if (isApiCall(url.pathname)) {
      return await staleWhileRevalidate(request);
    }
    
    // Default: Network only
    return await fetch(request);
    
  } catch (error) {
    console.error('SW: Error handling fetch request:', error);
    
    // Return offline fallback if available
    return await getOfflineFallback(request);
  }
}

/**
 * Cache first strategy - check cache first, fallback to network
 * @param {Request} request - The request
 * @returns {Promise<Response>} Cached or network response
 */
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // Not in cache, fetch from network and cache
  const networkResponse = await fetch(request);
  
  if (networkResponse.ok) {
    const cache = await caches.open(STATIC_CACHE_NAME);
    cache.put(request, networkResponse.clone());
  }
  
  return networkResponse;
}

/**
 * Network first strategy - try network first, fallback to cache
 * @param {Request} request - The request
 * @returns {Promise<Response>} Network or cached response
 */
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache successful response
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
      
      // Cleanup cache if too large
      cleanupDynamicCache();
    }
    
    return networkResponse;
    
  } catch (error) {
    // Network failed, try cache
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw error;
  }
}

/**
 * Stale while revalidate strategy - serve from cache, update in background
 * @param {Request} request - The request
 * @returns {Promise<Response>} Cached response (updated in background)
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  // Fetch from network in background to update cache
  const networkPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch((error) => {
    console.warn('SW: Failed to update cache from network:', error);
  });
  
  // Return cached response immediately, or wait for network if no cache
  return cachedResponse || await networkPromise;
}

/**
 * Get offline fallback response
 * @param {Request} request - The original request
 * @returns {Promise<Response>} Fallback response
 */
async function getOfflineFallback(request) {
  // Try to return a cached version of the main page
  if (request.mode === 'navigate') {
    const cachedIndex = await caches.match('./index.html');
    if (cachedIndex) {
      return cachedIndex;
    }
  }
  
  // Return a simple offline message
  return new Response(
    JSON.stringify({
      error: 'offline',
      message: 'This content is not available offline. Please check your internet connection.'
    }),
    {
      status: 503,
      statusText: 'Service Unavailable',
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
}

/**
 * Check if URL is a static asset
 * @param {string} pathname - URL pathname
 * @returns {boolean} True if static asset
 */
function isStaticAsset(pathname) {
  return STATIC_ASSETS.some(asset => 
    pathname === asset || pathname.endsWith(asset)
  );
}

/**
 * Check if URL is a dynamic asset
 * @param {string} pathname - URL pathname
 * @returns {boolean} True if dynamic asset
 */
function isDynamicAsset(pathname) {
  return DYNAMIC_CACHE_PATTERNS.some(pattern => 
    pattern.test(pathname)
  );
}

/**
 * Check if URL is an API call
 * @param {string} pathname - URL pathname
 * @returns {boolean} True if API call
 */
function isApiCall(pathname) {
  return pathname.includes('/api/') ||
         pathname.includes('/content/') ||
         pathname.endsWith('.json');
}

/**
 * Clean up dynamic cache to prevent unlimited growth
 */
async function cleanupDynamicCache() {
  const cache = await caches.open(DYNAMIC_CACHE_NAME);
  const keys = await cache.keys();
  
  if (keys.length > MAX_DYNAMIC_CACHE_SIZE) {
    // Remove oldest entries (FIFO)
    const keysToDelete = keys.slice(0, keys.length - MAX_DYNAMIC_CACHE_SIZE);
    
    await Promise.all(
      keysToDelete.map(key => cache.delete(key))
    );
    
    console.log(`SW: Cleaned up ${keysToDelete.length} old cache entries`);
  }
}

/**
 * Handle messages from the main thread
 */
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'GET_CACHE_INFO':
      getCacheInfo().then(info => {
        event.ports[0].postMessage({ type: 'CACHE_INFO', data: info });
      });
      break;
      
    case 'CLEAR_CACHE':
      clearAllCaches().then(() => {
        event.ports[0].postMessage({ type: 'CACHE_CLEARED' });
      });
      break;
      
    case 'PRELOAD_RESOURCES':
      preloadResources(data.urls).then(() => {
        event.ports[0].postMessage({ type: 'PRELOAD_COMPLETE' });
      });
      break;
      
    default:
      console.warn('SW: Unknown message type:', type);
  }
});

/**
 * Get cache information
 * @returns {Promise<object>} Cache statistics
 */
async function getCacheInfo() {
  const cacheNames = await caches.keys();
  const info = {};
  
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    info[cacheName] = {
      size: keys.length,
      urls: keys.map(request => request.url)
    };
  }
  
  return info;
}

/**
 * Clear all caches
 * @returns {Promise<void>}
 */
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames.map(cacheName => caches.delete(cacheName))
  );
  console.log('SW: All caches cleared');
}

/**
 * Preload specific resources
 * @param {Array<string>} urls - URLs to preload
 * @returns {Promise<void>}
 */
async function preloadResources(urls) {
  const cache = await caches.open(DYNAMIC_CACHE_NAME);
  
  const preloadPromises = urls.map(async (url) => {
    try {
      const response = await fetch(url);
      if (response.ok) {
        await cache.put(url, response);
        console.log('SW: Preloaded:', url);
      }
    } catch (error) {
      console.warn('SW: Failed to preload:', url, error);
    }
  });
  
  await Promise.all(preloadPromises);
}

console.log('SW: Service worker script loaded');
