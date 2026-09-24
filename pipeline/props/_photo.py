# Procedural "photographs" for frames (numpy): landscape / sea / portrait-ish blobs. Returns bpy image.
import helpers as H
import numpy as np
def photo(name, kind=0, W=384, Hh=512, seed=1):
    y, x = np.mgrid[0:Hh, 0:W].astype(np.float32)
    y /= Hh; x /= W
    rng = np.random.default_rng(seed)
    if kind == 0:   # hills at dusk
        sky = H.ramp(y, [(0, '#e8b98a'), (0.55, '#f1d2a8'), (1, '#8fa9c4')])
        img = sky
        for k, (h0, c) in enumerate(((0.45, '#6d7d5a'), (0.32, '#4f5f41'), (0.18, '#36422c'))):
            ridge = h0 + 0.06 * np.sin(x * (5 + k * 3) + seed + k) + 0.03 * np.sin(x * 17 + k)
            m = (y < ridge)[..., None]
            img = np.where(m, np.array(H.hexc(c, False), np.float32), img)
    elif kind == 1: # sea + beach
        img = H.ramp(y, [(0, '#e4d6b8'), (0.3, '#e4d6b8'), (0.31, '#4f8ea3'), (0.6, '#6aa8bb'), (0.61, '#cfe3ee'), (1, '#9cc3dc')])
        foam = (np.abs(y - 0.31 - 0.01 * np.sin(x * 30)) < 0.006)[..., None]
        img = np.where(foam, 1.0, img)
    else:           # two people silhouettes on a warm background (family photo feel)
        img = H.ramp(y, [(0, '#5b4a3c'), (1, '#c9a887')])
        for cx, s, c in ((0.35, 1.0, '#2f3440'), (0.65, 0.9, '#7b3b2c')):
            head = ((x - cx) / 0.09) ** 2 + ((y - 0.62 * s) / 0.07) ** 2 < 1
            body = (((x - cx) / 0.17) ** 2 + ((y - 0.18) / (0.38 * s)) ** 2 < 1) & (y < 0.5 * s)
            face = np.array(H.hexc('#d8b193', False), np.float32)
            img = np.where(head[..., None], face, img)
            img = np.where(body[..., None], np.array(H.hexc(c, False), np.float32), img)
    img = img + H.fnoise(W, 1.5, 1.5, seed)[:Hh % W or Hh, :][:1, :1, None] * 0  # keep shape
    vig = 1 - 0.25 * (((x - 0.5) * 1.6) ** 2 + ((y - 0.5) * 1.6) ** 2)
    img = np.clip(img * vig[..., None], 0, 1)
    return H.save_img(img.astype(np.float32), name)
