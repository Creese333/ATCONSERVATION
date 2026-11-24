/* Service worker for ACT - Appalachian Conservation Tool (act.atconservation.com), the A.T. Resource Grid on MapLibre. Ported from AT-Resource-Grid's sw.js, version atgrid-v7.
   Opening the app: the saved copy of the page, its code and its data files is shown straight away, and a fresh copy is fetched
   in the background. If the page, its code or the grid changed, the app shows "A new version is ready".
   "Save for offline" (at the bottom of About the data) stores all the data files and the imagery tiles along the trail in a
   separate store, OFF, which survives updates to this file.
   - Saved copies are looked up by exact address, never by a search that ignores ?query text (that reads every saved tile).
   - "Updated" compares the files' contents: every publish gives all files a new date and tag, even when they have not changed.
   - Basemap tiles are left to the browser unless Save for offline has been used.
   - Only the dashboard itself is the shell (saved as index.html). Any other page is saved under its own address; saving every
     page as index.html served a second page the dashboard and then overwrote the dashboard's copy with it (fixed in atgrid-v7).
   - The data lives on the A.T. Resource Grid site (DATA below) and is kept here exactly like this site's own files.
   atc-v1: first version for this site. Looking up a saved copy no longer creates an empty offline store (atgrid-v7 did).
   atc-v2: a fresh start for every saved file, after phones kept an app.js from before the 3D button.
   atc-v3: the same, after the USGS hydrography and imagery-with-labels basemaps were removed.
   atc-v5: the same, after the lighter-drawing change was taken back out.
   atc-v6: the same, with OpenStreetMap as the opening basemap.
   atc-v7: the same, after the phone control row stopped overlapping.
   atc-v8: the same, after Describe as text was removed.
   atc-v9: the same, with the lands layer drawn without slivers in 3D.
   atc-v10: the same, with the 3D tour.
   atc-v11: the same, with the tour views matched to Casey's screenshots.
   atc-v12: the same, with tour layers kept out of the address and the ?cam readout.
   atc-v13: the same, with Casey's tour views, one layer per stop and maintained landscape labels.
   atc-v14: the same, with the select stop framed on computers and a vista photo opened on the vistas stop.
   atc-v15: the same, with the tour's popup leaving the view still and computers showing the phone views' ground.
   atc-v16: the same, with the 3D tour cutting between places behind a fade and fetching the next stop's tiles ahead.
   atc-v17: the same, with the tour's fade back in after 0.6 s at most.
   atc-v18: the same, with the tour's views stood on the real ground (not sea level).
   atc-v19: the same, with mouse tilt and the tilt and turn buttons in 3D.
   atc-v20: the same, with the 3D tour pointing to the tilt and turn buttons.
   atc-v21: the same, with the tilt and turn buttons in a dropdown under the 3D button.
   atc-v22: the same, with the tour wording for the dropdown.
   atc-v23: the same, with smaller photo previews on phones.
   atc-v24: the same, with Casey's new views for three 3D tour stops.
   atc-v25: the same, with Shelters opening the facilities question.
   atc-v26: the same, with the search description and link preview. */
const VER = 'atc-v42';
const OFF = 'atoffline-1';          /* filled by Save for offline; never cleared here */
const LIVE = 'atlive-1';            /* last copy of the trail line, mile points and point layers (shelters, campsites...) */
const DATA = 'https://grid.trailassessment.org';   /* the data site: /data/ and /images/birds/ */
const SHELL = ['./', 'index.html', 'app.js', 'atmap.js', 'inat.js', 'manifest.webmanifest', 'images/icon-192.png', 'images/icon-512.png', DATA + '/data/grid.json'];
const STATIC = ['unpkg.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];   /* MapLibre and fonts: a fixed version, kept once fetched */
const TILEHOST = 'basemap.nationalmap.gov';
const SVCHOST = 'services1.arcgis.com';
/* besides the page: the files whose change means a new version */
const WATCH = u => (u.origin === self.location.origin && /\/(app|atmap|inat)\.js$/.test(u.pathname)) || (u.origin === DATA && u.pathname === '/data/grid.json');

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VER).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith('atc-') && k !== VER).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const okToKeep = res => res && (res.ok || res.type === 'opaque');
const keep = (name, r, res) => { if (okToKeep(res)) { const cp = res.clone(); caches.open(name).then(c => c.put(r, cp)).catch(() => {}); } return res; };
let told = false;
const tellPages = msg => { if (told) return; told = true; setTimeout(() => { told = false; }, 30000);
  return self.clients.matchAll({type: 'window'}).then(cs => cs.forEach(c => c.postMessage(msg))); };

/* the offline store, opened once and looked at again every 20 s (Save for offline and its removal happen in the page).
   offStore() is null when there is no store, so tiles need not pass through here at all. */
let offOpen = Promise.resolve(undefined), offHas, offAt = 0;
function offStore() {
  if (Date.now() - offAt > 20000) { offAt = Date.now();
    const p = caches.has(OFF).then(h => { offHas = h; return h ? caches.open(OFF) : undefined; }).catch(() => undefined);
    if (offHas === undefined) offOpen = p; else p.then(c => { offOpen = Promise.resolve(c); }); }
  return offHas === false ? null : offOpen;
}
offStore();

/* the saved copy of an address: this version's store first, then the offline store (exact address, no scan) */
async function savedCopy(key) {
  /* caches.match with a cacheName does not create the store: opening OFF here would make it exist, empty, and every tile
     would then pass through this worker as if Save for offline had been used */
  for (const name of [VER, OFF]) { const m = await caches.match(key, {cacheName: name}); if (m) return m; }
  return undefined;
}
async function sameBody(a, b) {
  const [x, y] = await Promise.all([a.arrayBuffer(), b.arrayBuffer()]);
  if (x.byteLength !== y.byteLength) return false;
  const [h1, h2] = await Promise.all([crypto.subtle.digest('SHA-256', x), crypto.subtle.digest('SHA-256', y)]);
  const u = new Uint8Array(h1), v = new Uint8Array(h2); for (let i = 0; i < u.length; i++) if (u[i] !== v[i]) return false; return true;
}

/* the saved copy right away; a fresh copy in the background (and a note to the page when the page, its code or the grid really changed).
   isShell: the dashboard, saved as index.html. Everything else is saved under its own address. */
function fastThenFresh(e, r, isShell) {
  const u = new URL(r.url), key = isShell ? new URL('index.html', self.registration.scope).href : u.origin + u.pathname;
  const saved = savedCopy(key);
  const fresh = fetch(r, {cache: 'no-cache'}).then(async res => {
    if (res.ok && (res.type === 'basic' || res.type === 'cors')) {
      if (isShell || WATCH(u)) {
        const old = await saved;
        if (old && !(await sameBody(old, res.clone()).catch(() => true))) tellPages({type: 'updated'});
      }
      const c = await caches.open(VER); await c.put(key, res.clone());
    }
    return res;
  });
  e.waitUntil(fresh.catch(() => {}));
  return saved.then(m => m ? m.clone() : fresh).catch(() => fresh);   /* the page gets a copy; the saved one is kept for the comparison */
}

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);

  if (u.origin === self.location.origin) {
    const isShell = u.pathname.endsWith('/') || u.pathname.endsWith('/index.html');   /* the dashboard, under either address */
    const isPage = r.mode === 'navigate' || isShell;
    if (isPage || /\.js$/.test(u.pathname) || u.pathname.includes('/data/') || u.pathname.includes('/images/')) {
      e.respondWith(fastThenFresh(e, r, isShell).catch(() => savedCopy(u.origin + u.pathname).then(m => m || Response.error())));
      return;
    }
    e.respondWith(fetch(r).then(res => res.type === 'basic' ? keep(VER, r, res) : res)
      .catch(() => savedCopy(u.origin + u.pathname).then(m => m || Response.error())));
    return;
  }

  /* the data site's files: kept like this site's own */
  if (u.origin === DATA && (u.pathname.startsWith('/data/') || u.pathname.startsWith('/images/'))) {
    e.respondWith(fastThenFresh(e, r, false).catch(() => savedCopy(u.origin + u.pathname).then(m => m || Response.error())));
    return;
  }

  /* imagery tiles: a saved tile is used straight away; others come from the network */
  if (u.hostname === TILEHOST && u.pathname.includes('/tile/')) {
    if (offStore() === null) return;   /* nothing saved: the browser fetches and keeps the tile itself */
    e.respondWith(offOpen.then(c => c ? c.match(r.url) : undefined).then(m => m || fetch(r)).catch(() => fetch(r)));
    return;
  }

  /* trail line, mile points and point layers: network first, last copy offline (area-by-area queries are not kept) */
  if (u.hostname === SVCHOST && !u.searchParams.has('geometry')) {
    e.respondWith(fetch(r).then(res => keep(LIVE, r, res)).catch(() => caches.open(LIVE).then(c => c.match(r.url)).then(m => m || Response.error())));
    return;
  }

  /* MapLibre and fonts: kept once fetched */
  if (STATIC.includes(u.hostname)) {
    e.respondWith(caches.open(VER).then(c => c.match(r)).then(m => m || fetch(r).then(res => keep(VER, r, res))));
  }
});
