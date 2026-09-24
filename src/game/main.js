// Entry for house.html: /house.html?id=villa-nova[&quality=high][&tod=day][&harness=1]
import { Game, createDebugApi } from './Game.js';
import { Loading } from '../ui/Loading.js';

const params = new URLSearchParams(location.search);
const houseId = (params.get('id') || 'villa-nova').replace(/[^a-z0-9_-]/gi, '');
const harness = params.has('harness') ? params.get('harness') !== '0' : navigator.webdriver === true;

const canvas = document.getElementById('gl') || document.body.appendChild(Object.assign(document.createElement('canvas'), { id: 'gl' }));
canvas.tabIndex = 0;
document.documentElement.style.background = '#0b0d10';
document.body.style.margin = '0';
document.body.style.background = '#0b0d10';
document.body.style.overflow = 'hidden';

// HMR re-executes this module (it self-accepts below); boot only once per page.
if (!window.__gameBooted) {
window.__gameBooted = true;
const game = new Game({
  canvas,
  houseId,
  harness,
  quality: params.get('quality') || 'high',
  tod: params.get('tod') || 'day',
});
new Loading(game, { houseId });

window.__game = createDebugApi(game);
game.start();
}

// A module swap under HMR would leave a half-disposed WebGL context; reload the page instead.
// Harness pages (screenshots/critics) keep the code they booted with: a reload mid-capture is what
// broke the harness, and every harness run loads fresh code anyway. `&hmr=1` restores reloads.
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    if (harness && !params.has('hmr')) console.info('[hmr] update ignored (harness page; add &hmr=1 to reload on edits)');
    else location.reload();
  });
}
