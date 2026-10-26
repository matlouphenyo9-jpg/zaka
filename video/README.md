# Zaka demo video

`docs/demo/zaka-demo.mp4`: 1920×1080, 30 fps, 77 s, no voice, in English. Every phone frame is a screenshot of the real app
(production build, live demo account, live AI) recorded by `capture.mjs` in one pass on a freshly reset demo: typing is
captured character by character and scrolling frame by frame, and the on-screen numbers are saved to `src/rec.json` so the
captions can quote them. Remotion only adds the phone frame, captions and tap ripples.

```bash
# from the repo root: build and serve the app
npm run build && npx vite preview --port 4173
# then, in video/
npm install
npm run capture        # → public/rec/ (git-ignored) and src/rec.json (tap positions, frame marks)
npm run render -- --browser-executable=/path/to/chrome-headless-shell
```

Fonts in `public/fonts` (Inter, Instrument Serif) are from Google Fonts under the SIL Open Font License 1.1 and are
bundled so the render works offline. Captions and app are in English; one short moment switches Home to isiZulu (beta) and back.
