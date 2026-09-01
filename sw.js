/* Dirt Dog Card Scanner — vCard handoff worker.
 *
 * iOS only shows the "Create New Contact / Add to Existing Contact" sheet when
 * Safari NAVIGATES to a URL whose response is text/vcard. A scripted download or
 * navigator.share() lands in the generic file path instead, which is the
 * dead-end Quick Look preview.
 *
 * The card is generated on-device, so there is no server URL to point at. This
 * worker manufactures one: the page stages the vCard text into Cache Storage,
 * then a plain <a href="contact.vcf"> is a real navigation that this worker
 * answers with the correct Content-Type. Nothing leaves the phone.
 */

const CACHE = "vcf-handoff";
const SINGLE = "vcf-payload-single";
const BATCH = "vcf-payload-batch";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

function notStaged() {
  return new Response("No contact staged. Go back and scan a card.", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

async function serve(key, filename) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(key);
  if (!hit) return notStaged();
  const text = await hit.text();
  return new Response(text, {
    status: 200,
    headers: {
      // text/vcard is the registered type for UTI public.vcard; "inline" keeps
      // Safari on the preview/handoff path rather than forcing a download.
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": 'inline; filename="' + filename + '"',
      "Cache-Control": "no-store, must-revalidate",
    },
  });
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith("/contact.vcf")) {
    event.respondWith(serve(SINGLE, "contact.vcf"));
  } else if (url.pathname.endsWith("/contacts.vcf")) {
    event.respondWith(serve(BATCH, "contacts.vcf"));
  }
});
