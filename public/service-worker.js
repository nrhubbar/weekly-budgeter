/**
 * Thank you to iamshaunjp on github.
 * This code is copied from: https://github.com/iamshaunjp/pwa-tutorial/blob/lesson-29/public/sw.js
 */

const staticCacheName = 'site-static-v2';
const dynamicCacheName = 'site-dynamic-v2';
const assets = [
  '/',
  '/index.html',
  '/main.js',
  '/index.css',
];

// cache size limit function
const limitCacheSize = (name, size) => {
    caches.open(name).then(cache => {
      cache.keys().then(keys => {
        if(keys.length > size){
          cache.delete(keys[0]).then(limitCacheSize(name, size));
        }
      });
    });
  };

// install event
self.addEventListener('install', evt => {
//console.log('service worker installed');
evt.waitUntil(
    caches.open(staticCacheName).then((cache) => {
    console.log('caching shell assets');
    cache.addAll(assets);
    })
);
});

// activate event
self.addEventListener('activate', evt => {
//console.log('service worker activated');
evt.waitUntil(
    caches.keys().then(keys => {
    //console.log(keys);
    return Promise.all(keys
        .filter(key => key !== staticCacheName && key !== dynamicCacheName)
        .map(key => caches.delete(key))
    );
    })
);
});

// fetch events
self.addEventListener('fetch', evt => {
if(evt.request.url.indexOf('firestore.googleapis.com') === -1){
    evt.respondWith(
    caches.match(evt.request).then(cacheRes => {
        return cacheRes || fetch(evt.request).then(fetchRes => {
        return caches.open(dynamicCacheName).then(cache => {
            cache.put(evt.request.url, fetchRes.clone());
            // check cached items size
            limitCacheSize(dynamicCacheName, 15);
            return fetchRes;
        })
        });
    }).catch(() => {
        if(evt.request.url.indexOf('.html') > -1){
        return caches.match('/pages/fallback.html');
        } 
    })
    );
}
});