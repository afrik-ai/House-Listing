import './loading.css';

// Loading screen -> title card ("Click to enter") -> fades out to gameplay.
// While loading, a line elevation of the house (generated from house.json) draws itself in step
// with the real load progress. Once ready, the backdrop turns translucent over the live scene
// (Game runs a slow "attract" camera behind it) and a click enters + locks the pointer.
// Also doubles as a minimal "Paused - click to resume" gate when no Menus module is installed.
const TIPS = [
  'Hold <b>Shift</b> to sprint, <b>C</b> to crouch.',
  'Look at a door or switch and press <b>E</b>.',
  'Press <b>Esc</b> for the menu, settings and photo mode.',
  'Sun, shadows and sky come from real HDR captures.',
  'Every room is walkable — both floors, terrace, balcony and garden.',
];

export class Loading {
  constructor(game, { houseId } = {}) {
    this.game = game;
    this.houseId = houseId;
    this.shown = 0;       // displayed progress (eased)
    this.target = 0;
    this.state = 'loading';
    this.el = document.createElement('div');
    this.el.id = 'loading';
    this.el.className = 'ld is-loading';
    this.el.innerHTML = `
      <div class="ld-bg"></div>
      <div class="ld-grain"></div>
      <div class="ld-top">
        <div class="ld-brand"><span class="ld-mark"></span>HOUSELISTING</div>
        <div class="ld-lot">LOT&nbsp;01 · <span data-k="id"></span></div>
      </div>
      <svg class="ld-draw" viewBox="0 0 1000 420" preserveAspectRatio="xMidYMid meet" aria-hidden="true"></svg>
      <div class="ld-main">
        <div class="ld-eyebrow">Now touring</div>
        <h1 class="ld-title" data-k="name">&nbsp;</h1>
        <p class="ld-tag" data-k="tagline"></p>
        <ul class="ld-facts" data-k="facts"></ul>
      </div>
      <div class="ld-bottom">
        <div class="ld-status">
          <span class="ld-label" data-k="label">Preparing</span>
          <span class="ld-pct" data-k="pct">0%</span>
        </div>
        <div class="ld-bar"><i data-k="bar"></i></div>
        <p class="ld-tip" data-k="tip"></p>
      </div>
      <button class="ld-enter" type="button" data-k="enter">
        <span class="ld-enter-ring"></span>
        <span class="ld-enter-txt">Click to enter</span>
        <span class="ld-enter-sub">WASD move · Mouse look · E interact · Esc menu</span>
      </button>
      <div class="ld-error" data-k="error"></div>`;
    document.body.appendChild(this.el);
    this.$ = (k) => this.el.querySelector(`[data-k="${k}"]`);
    this.$('id').textContent = (houseId || '').toUpperCase().replace(/-/g, ' ');
    this.$('name').textContent = titleCase(houseId || 'House');
    this._tipIdx = Math.floor(Math.random() * TIPS.length);
    this._nextTip();
    this._tipTimer = setInterval(() => this._nextTip(), 4200);

    this.$('enter').addEventListener('click', (e) => { e.stopPropagation(); this._enter(); });
    this.el.addEventListener('click', () => { if (this.state === 'ready' || this.state === 'paused') this._enter(); });

    game.on('progress', (p) => this.progress(p.fraction, p.label));
    game.on('ready', () => this.ready());
    game.on('error', (err) => this.error(err));
    game.on('hideui', (hidden) => { this.el.style.display = hidden ? 'none' : ''; });
    game.on('pause', (paused) => { if (!game.menus) paused ? this.showPaused() : this.hide(); });
    // Entry transition veil (Game glides the camera underneath it).
    this.veil = document.createElement('div');
    this.veil.className = 'ld-veil';
    document.body.appendChild(this.veil);
    game.on('enter-transition', (secs) => {
      this.veil.style.animationDuration = `${secs}s`;
      this.veil.classList.remove('is-on'); void this.veil.offsetWidth; this.veil.classList.add('is-on');
    });

    this._loadSpec();
    this._raf = requestAnimationFrame(this._tick.bind(this));
  }

  async _loadSpec() {
    try {
      // Same cached request House.load() uses (no duplicate fetch).
      const spec = await this.game.loader.json(`/houses/${this.houseId}/house.json`, 'house spec');
      this.$('name').textContent = spec.name || this.$('name').textContent;
      this.$('tagline').textContent = spec.tagline || '';
      this.$('facts').innerHTML = facts(spec).map(([v, k]) => `<li><b>${v}</b><span>${k}</span></li>`).join('');
      this.el.querySelector('.ld-draw').innerHTML = elevationSVG(spec);
      this._paths = [...this.el.querySelectorAll('.ld-draw .ln')];
      for (const p of this._paths) { const L = p.getTotalLength?.() || 400; p.style.strokeDasharray = `${L}`; p.style.strokeDashoffset = `${L}`; p.dataset.len = L; }
    } catch { /* spec is optional for the loading screen */ }
  }

  _nextTip() { this.$('tip').innerHTML = TIPS[this._tipIdx++ % TIPS.length]; }

  progress(fraction, label) {
    this.target = Math.max(this.target, Math.min(0.97, fraction || 0));
    if (label) this.$('label').textContent = /^[A-Z]/.test(label) ? label : `Loading ${label}`;
  }

  _tick() {
    this._raf = requestAnimationFrame(this._tick.bind(this));
    const goal = this.state === 'loading' ? this.target : 1;
    this.shown += (goal - this.shown) * 0.08;
    if (Math.abs(goal - this.shown) < 0.001) this.shown = goal;
    this.$('bar').style.transform = `scaleX(${this.shown.toFixed(4)})`;
    this.$('pct').textContent = `${Math.round(this.shown * 100)}%`;
    if (this._paths) {
      const n = this._paths.length;
      this._paths.forEach((p, i) => {
        const local = Math.min(1, Math.max(0, this.shown * n * 1.25 - i * 1.0) );
        p.style.strokeDashoffset = `${(1 - local) * p.dataset.len}`;
      });
    }
    if (this.state !== 'loading' && this.shown === 1 && this._raf && this.state !== 'paused' && this.el.classList.contains('is-gone')) {
      cancelAnimationFrame(this._raf); this._raf = 0;
    }
  }

  ready() {
    this.state = 'ready';
    this.$('label').textContent = 'Ready';
    clearInterval(this._tipTimer);
    this.el.classList.remove('is-loading');
    this.el.classList.add('is-ready');
    if (this.game.harness) this.hide();
  }

  _enter() {
    if (this.state === 'paused') { this.game.resume(); this.hide(); return; }
    if (this.state !== 'ready') return;
    this.game.enter();
    this.hide();
  }

  hide() {
    this.state = 'hidden';
    this.el.classList.add('is-gone');
    this.el.classList.remove('is-paused');
  }

  showPaused() {
    this.state = 'paused';
    this.el.classList.remove('is-gone', 'is-loading');
    this.el.classList.add('is-ready', 'is-paused');
    this.el.querySelector('.ld-enter-txt').textContent = 'Paused — click to resume';
    if (!this._raf) this._raf = requestAnimationFrame(this._tick.bind(this));
  }

  error(err) {
    this.state = 'error';
    this.el.classList.add('is-error');
    this.$('error').textContent = `Could not load the house: ${err?.message || err}`;
  }
}

function titleCase(id) { return id.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()); }

function facts(spec) {
  const rooms = [...(spec.ground_rooms || []), ...(spec.first_rooms || [])];
  const area = rooms.reduce((a, r) => a + (r.area || (r.rects || [r.rect]).reduce((s, q) => s + q[2] * q[3], 0)), 0);
  const beds = rooms.filter((r) => /^(bed|master$)/i.test(r.id)).length;
  const baths = rooms.filter((r) => /^bath/i.test(r.id)).length;
  const out = [[`${Math.round(area)} m²`, 'Living area'], [beds, 'Bedrooms'], [baths, 'Bathrooms'], [(spec.levels || []).length, 'Floors']];
  if (spec.site?.pool) out.push(['Pool', `${spec.site.pool.w}×${spec.site.pool.d} m`]);
  return out;
}

// South elevation line drawing from house.json (X east -> right, Y up). Purely decorative.
function elevationSVG(specIn) {
  // Normalise L-shaped rooms (`rects`) to their bounding rect for this schematic.
  const bb = (r) => {
    if (r.rect) return r;
    const q = r.rects || []; if (!q.length) return r;
    const x0 = Math.min(...q.map((a) => a[0])), z0 = Math.min(...q.map((a) => a[1]));
    const x1 = Math.max(...q.map((a) => a[0] + a[2])), z1 = Math.max(...q.map((a) => a[1] + a[3]));
    return { ...r, rect: [x0, z0, x1 - x0, z1 - z0] };
  };
  const spec = { ...specIn, ground_rooms: (specIn.ground_rooms || []).map(bb), first_rooms: (specIn.first_rooms || []).map(bb) };
  const lv = Object.fromEntries((spec.levels || []).map((l) => [l.id, l]));
  const g0 = lv.ground || { elevation: 0, clear_height: 2.85, slab: 0.3 };
  const f1 = lv.first || { elevation: 3.15, clear_height: 2.7, slab: 0.3, roof_parapet: 0.45 };
  const span = (list) => list.reduce((a, r) => [Math.min(a[0], r.rect[0]), Math.max(a[1], r.rect[0] + r.rect[2])], [Infinity, -Infinity]);
  const gr = spec.ground_rooms || [], fr = spec.first_rooms || [];
  const gx = span([...gr, ...(spec.ground_exterior || []).filter((e) => e.id !== 'driveway')]);
  const [fx0, fx1] = span(fr);
  const pool = spec.site?.pool;
  const minX = Math.min(gx[0], pool ? pool.x : gx[0]) - 1.5, maxX = gx[1] + 3;
  const top = f1.elevation + f1.clear_height + f1.slab + (f1.roof_parapet || 0) + 0.8;
  const W = 1000, H = 420, pad = 40;
  const s = Math.min((W - pad * 2) / (maxX - minX), (H - pad * 2) / (top + 1.2));
  const ox = (W - (maxX - minX) * s) / 2;
  const X = (x) => (ox + (x - minX) * s).toFixed(1);
  const Y = (y) => (H - pad - (y + 0.6) * s).toFixed(1);
  const L = [];
  const rect = (x0, y0, x1, y1, cls = 'ln') => L.push(`<path class="${cls}" d="M${X(x0)} ${Y(y0)}H${X(x1)}V${Y(y1)}H${X(x0)}Z"/>`);
  const line = (x0, y0, x1, y1, cls = 'ln') => L.push(`<path class="${cls}" d="M${X(x0)} ${Y(y0)}L${X(x1)} ${Y(y1)}"/>`);

  line(minX, 0, maxX, 0, 'ln ground');
  const gTop = g0.elevation + g0.clear_height + g0.slab;
  const bodyX0 = Math.min(...gr.map((r) => r.rect[0]));
  rect(bodyX0, 0, gx[1] - 2.3, gTop);                                    // ground body
  const fTop = f1.elevation + f1.clear_height + f1.slab;
  rect(fx0, f1.elevation, fx1, fTop);                                    // first floor box
  rect(fx0 - 0.2, fTop, fx1 + 0.2, fTop + (f1.roof_parapet || 0.45));    // fascia band
  const garage = gr.find((r) => r.id === 'garage');
  if (garage) L.push(`<path class="ln" d="M${X(fx1 + 0.2)} ${Y(gTop)}L${X(fx1 + 1.8)} ${Y(gTop + 0.9)}L${X(garage.rect[0] + garage.rect[2] - 0.6)} ${Y(gTop + 0.9)}L${X(garage.rect[0] + garage.rect[2] + 0.4)} ${Y(gTop)}"/>`);
  const terrace = (spec.ground_exterior || []).find((e) => e.id === 'terrace');
  if (terrace) {
    rect(terrace.rect[0], f1.elevation - 0.35, bodyX0, f1.elevation);    // pergola slab
    rect(terrace.rect[0] + 0.15, 0, terrace.rect[0] + 0.5, f1.elevation - 0.35);  // pillar
    rect(terrace.rect[0], f1.elevation, bodyX0, f1.elevation + 1.0, 'ln glass'); // balcony glass
  }
  // Openings on the south side of each level.
  const southOpen = (rooms, y0, head, sill) => {
    const zMax = Math.max(...rooms.map((r) => r.rect[1] + r.rect[3]));
    for (const r of rooms) {
      if (Math.abs(r.rect[1] + r.rect[3] - zMax) > 0.6) continue;
      const big = /glass|sliding/i.test(r.notes || '');
      const w = r.rect[2] * (big ? 0.7 : 0.45);
      const cx = r.rect[0] + r.rect[2] / 2;
      rect(cx - w / 2, y0 + (big ? 0.05 : sill), cx + w / 2, y0 + head, 'ln win');
      if (big) line(cx, y0 + 0.05, cx, y0 + head, 'ln win');
    }
  };
  southOpen(gr, g0.elevation, 2.45, 0.9);
  southOpen(fr, f1.elevation, 2.3, 0.9);
  if (pool) line(pool.x, -0.2, pool.x + pool.w, -0.2, 'ln water');
  // Dimension line
  line(bodyX0, -0.45, gx[1] - 2.3, -0.45, 'ln dim');
  L.push(`<text class="dim" x="${X((bodyX0 + gx[1] - 2.3) / 2)}" y="${(+Y(-0.45) + 16).toFixed(1)}">${(gx[1] - 2.3 - bodyX0).toFixed(2)} m</text>`);
  return L.join('');
}
