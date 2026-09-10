# Werket Deployment

## Website

The repository includes `Dockerfile` and `render.yaml` for Render:

1. Create a Render account and choose **New > Blueprint**.
2. Select `https://github.com/ZebraCodeX/Werket`.
3. Render reads `render.yaml`, builds the container, and exposes port `8765`.
4. Set a custom domain in Render after the first deploy.

The service binds to `0.0.0.0` and honors Render's `PORT` environment variable.

## Mobile installation

Werket is already a PWA. On Android or iOS, open the deployed HTTPS URL and
choose **Install app** or **Add to Home Screen**.

For store packages, use PWABuilder against the deployed HTTPS URL:

- Android: generate an Android package and sign it with a Google Play upload key.
- iOS: generate the Xcode package and sign it with an Apple Developer team.

Store submission requires the publisher accounts, signing keys, privacy policy,
app screenshots, and store metadata. Those credentials must not be committed
to this repository.
