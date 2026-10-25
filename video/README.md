# Zaka demo video

`docs/demo/zaka-demo.mp4`: 1920×1080, 30 fps, about 67 s, no voice. Every phone frame is a screenshot of the real app
(production build, live demo account, live AI) recorded by `capture.mjs` in isiXhosa: typing is captured
character by character and scrolling frame by frame. Remotion only adds the phone frame, captions and tap ripples.

```bash
# from the repo root: build and serve the app
npm run build && npx vite preview --port 4173
# then, in video/
npm install
npm run capture        # → public/rec/ (git-ignored) and src/rec.json (tap positions, frame marks)
npm run render -- --browser-executable=/path/to/chrome-headless-shell
```

Fonts in `public/fonts` (Inter, Instrument Serif) are from Google Fonts under the SIL Open Font License 1.1 and are
bundled so the render works offline. Captions are English; the app on screen is in isiXhosa (beta, machine draft).
