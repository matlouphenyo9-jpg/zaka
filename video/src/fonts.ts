// Fonts are bundled in public/fonts (Inter and Instrument Serif, SIL Open Font License) so renders work offline.
import { continueRender, delayRender, staticFile } from 'remotion';

export const inter = 'ZakaInter';
export const serif = 'ZakaSerif';

const faces = [
  new FontFace(inter, `url(${staticFile('fonts/Inter-Variable.woff2')}) format('woff2')`, { weight: '400 700' }),
  new FontFace(serif, `url(${staticFile('fonts/InstrumentSerif-Regular.woff2')}) format('woff2')`, { style: 'normal' }),
  new FontFace(serif, `url(${staticFile('fonts/InstrumentSerif-Italic.woff2')}) format('woff2')`, { style: 'italic' }),
];
const handle = delayRender('Loading fonts');
Promise.all(faces.map((f) => f.load()))
  .then((loaded) => {
    loaded.forEach((f) => document.fonts.add(f));
    continueRender(handle);
  })
  .catch((e) => {
    throw e;
  });
