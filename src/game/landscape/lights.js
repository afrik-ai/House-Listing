import * as THREE from 'three';
import { GeoBuilder } from './util.js';
import { PATH_LIGHTS } from './materials.js';

// Slim black aluminium bollards (80 x 80 mm, 0.72 m) with a frosted light band under a cap.
// At night the band glows (blooms) and each bollard lights the ground/grass around it through the
// shared PATH_LIGHTS uniforms evaluated in the landscape shaders (no real three.js lights).
export function buildBollards(ctx) {
  const { site, group } = ctx;
  const G = site.grade_y;
  const pts = (site.bollards || []).slice(0, 16);
  if (!pts.length) return null;
  const H = 0.72, W = 0.08;
  const body = new GeoBuilder();
  body.box(-W / 2, 0, -W / 2, W / 2, H - 0.16, W / 2, 1, { skip: ['-y'] });
  body.box(-W / 2 - 0.004, H - 0.03, -W / 2 - 0.004, W / 2 + 0.004, H, W / 2 + 0.004, 1, { skip: [] });   // cap
  body.box(-0.012, H - 0.16, -0.012, 0.012, H - 0.03, 0.012, 1);                                        // core behind the diffuser
  body.box(-W / 2 - 0.01, -0.06, -W / 2 - 0.01, W / 2 + 0.01, 0.008, W / 2 + 0.01, 1, { skip: ['-y'] }); // foot plate
  const lens = new GeoBuilder();
  lens.box(-W / 2 + 0.006, H - 0.155, -W / 2 + 0.006, W / 2 - 0.006, H - 0.035, W / 2 - 0.006, 1, { skip: ['-y', '+y'] });
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x131416, roughness: 0.42, metalness: 0.55 });
  const lensMat = new THREE.MeshStandardMaterial({ color: 0xd8d4cc, roughness: 0.3, metalness: 0, emissive: new THREE.Color(1.0, 0.78, 0.52), emissiveIntensity: 0 });
  const bm = new THREE.InstancedMesh(body.build(), bodyMat, pts.length);
  const lm = new THREE.InstancedMesh(lens.build(), lensMat, pts.length);
  const m = new THREE.Matrix4();
  pts.forEach(([x, z], i) => {
    m.makeRotationY((i * 0.37) % (Math.PI / 2)).setPosition(x, G, z);
    bm.setMatrixAt(i, m); lm.setMatrixAt(i, m);
    ctx.colliderBoxes.push([x - 0.07, G - 0.2, z - 0.07, x + 0.07, G + H, z + 0.07]);
  });
  for (const im of [bm, lm]) { im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.receiveShadow = true; }
  bm.castShadow = true; lm.castShadow = false;
  bm.name = 'LS_bollards'; lm.name = 'LS_bollard_lenses';
  group.add(bm, lm);
  pts.forEach(([x, z], i) => PATH_LIGHTS.uPath.value[i].set(x, G + H - 0.09, z));
  return {
    setNight(k) {
      lensMat.emissiveIntensity = 14 * k;
      PATH_LIGHTS.uPathCol.value.setRGB(1.0, 0.74, 0.46).multiplyScalar(0.55 * k);
    },
    points: pts,
  };
}
