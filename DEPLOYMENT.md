# Werket Deployment

## Website

Production URL: https://werket.onrender.com/

The repository includes `Dockerfile` and `render.yaml` for Render:

1. Create a Render account and choose **New > Blueprint**.
2. Select `https://github.com/ZebraCodeX/Werket`.
3. Render reads `render.yaml`, builds the container, and exposes port `8765`.
4. Set a custom domain in Render after the first deploy.

The service binds to `0.0.0.0` and honors Render's `PORT` environment variable.

## Mobile installation

Werket is already a PWA. On Android or iOS, open the deployed HTTPS URL and
choose **Install app** or **Add to Home Screen**. The home screen also shows an
**Install** banner when the browser offers installation.

## Search engine discoverability

The app ships with:

- `static/robots.txt` and `static/sitemap.xml` (served at `/robots.txt` and
  `/sitemap.xml`).
- Structured data (`SoftwareApplication` JSON-LD), Open Graph, and Twitter card
  tags in `<head>`.
- A descriptive `<title>` and meta description targeting Amharic and English
  speakers.

After the first deploy, submit the URL at
[Google Search Console](https://search.google.com/search-console) and request
indexing of the sitemap.

## App store packages

Use PWABuilder against the deployed HTTPS URL. Werket includes the required
store assets already: 192/512 PNG icons, maskable icons, an Apple touch icon,
and narrow/wide screenshots.

- **Google Play**: `https://www.pwabuilder.com` → Android package → sign with a
  Google Play upload key and upload in the Play Console.
- **Apple App Store**: PWABuilder Xcode package → sign with an Apple Developer
  team → submit via App Store Connect.
- **Microsoft Store**: PWABuilder Windows package → submit via Partner Center.

Store submission still requires the publisher accounts, signing keys, and store
metadata (descriptions, screenshots, categories). A privacy policy is included
at `/privacy`. Those credentials must not be committed to this repository.
