import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Static world collision: one merged position-only geometry + BVH.
// The player is a vertical capsule; `pos` everywhere below is the FEET position
// (bottom of the capsule, i.e. the point that rests on the floor).
export class Physics {
  constructor({ radius = 0.3, height = 1.75, stepHeight = 0.25, gravity = -18 } = {}) {
    this.radius = radius;
    this.height = height;
    this.stepHeight = stepHeight;
    this.gravity = gravity;
    this.bvh = null;
    this.geometry = null;
    this.triangles = 0;

    this._seg = new THREE.Line3();
    this._box = new THREE.Box3();
    this._triPoint = new THREE.Vector3();
    this._capPoint = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._ray = new THREE.Ray();
    this._tmp = new THREE.Vector3();
  }

  // Build the static collider from a list of meshes (world transforms are baked in).
  setColliders(meshes) {
    const parts = [];
    for (const m of meshes) {
      if (!m.isMesh || !m.geometry?.attributes?.position) continue;
      m.updateWorldMatrix(true, false);
      let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      const pos = g.attributes.position;
      const out = new THREE.BufferGeometry();
      out.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos.array), 3));
      out.applyMatrix4(m.matrixWorld);
      parts.push(out);
      if (g !== m.geometry) g.dispose();
    }
    this.clear();
    if (!parts.length) return;
    this.geometry = mergeGeometries(parts, false);
    parts.forEach((p) => p.dispose());
    this.bvh = new MeshBVH(this.geometry, { targetLeafSize: 8 });
    this.triangles = this.geometry.attributes.position.count / 3;
  }

  clear() {
    if (this.geometry) this.geometry.dispose();
    this.geometry = null; this.bvh = null; this.triangles = 0;
  }

  // Moves a capsule at feet position `pos` by `delta`, sliding along geometry, stepping up
  // small ledges and reporting ground contact. Returns {pos, onGround, blocked}.
  moveCapsule(pos, delta, out = {}) {
    const result = out;
    result.pos = result.pos || new THREE.Vector3();
    if (!this.bvh) { result.pos.copy(pos).add(delta); result.onGround = false; result.blocked = false; return result; }

    const start = this._tmp.copy(pos);
    const p = result.pos.copy(pos).add(delta);
    let pushUp = this._resolve(p);

    const wantH = Math.hypot(delta.x, delta.z);
    const gotH = Math.hypot(p.x - start.x, p.z - start.z);
    let blocked = wantH > 1e-4 && gotH < wantH * 0.7;

    // Step-up: retry the horizontal move from stepHeight above, then drop back to the floor.
    if (blocked && this.stepHeight > 0) {
      const p2 = new THREE.Vector3(start.x, start.y + this.stepHeight, start.z);
      p2.x += delta.x; p2.z += delta.z;
      const pushUp2 = this._resolve(p2);
      const drop = this.groundBelow(p2, this.stepHeight + 0.05);
      if (drop !== null) {
        p2.y = drop;
        this._resolve(p2);
        const gotH2 = Math.hypot(p2.x - start.x, p2.z - start.z);
        if (gotH2 > gotH + 1e-3 && p2.y <= start.y + this.stepHeight + 1e-3) {
          p.copy(p2); pushUp = Math.max(pushUp2, 1e-3); blocked = gotH2 < wantH * 0.7;
        }
      }
    }

    const groundY = this.groundBelow(p, 0.08);
    result.onGround = (pushUp > 0 && delta.y <= 0) || groundY !== null;
    // Snap down onto the floor below (keeps contact when walking down steps) - but not while a
    // walkable slope is holding us up, or a ramp's foot would be snapped back to the floor forever.
    if (pushUp <= 0 && result.onGround && groundY !== null && delta.y <= 0 && p.y > groundY) p.y = groundY;
    result.blocked = blocked;
    return result;
  }

  // Pushes the capsule (feet at p) out of all intersecting triangles. Returns the total
  // upward push, which is how we detect standing on something.
  _resolve(p) {
    const r = this.radius, seg = this._seg, box = this._box;
    let pushUp = 0;
    for (let iter = 0; iter < 4; iter++) {
      seg.start.set(p.x, p.y + r, p.z);
      seg.end.set(p.x, p.y + this.height - r, p.z);
      box.makeEmpty().expandByPoint(seg.start).expandByPoint(seg.end).expandByScalar(r + 0.01);
      let moved = false;
      this.bvh.shapecast({
        intersectsBounds: (b) => b.intersectsBox(box),
        intersectsTriangle: (tri) => {
          const d = tri.closestPointToSegment(seg, this._triPoint, this._capPoint);
          if (d < r) {
            const depth = r - d;
            const dir = this._dir.subVectors(this._capPoint, this._triPoint);
            if (dir.lengthSq() < 1e-12) dir.set(0, 1, 0); else dir.normalize();
            seg.start.addScaledVector(dir, depth);
            seg.end.addScaledVector(dir, depth);
            if (dir.y > 0.5) pushUp += dir.y * depth;
            moved = true;
          }
        },
      });
      p.set(seg.start.x, seg.start.y - r, seg.start.z);
      if (!moved) break;
    }
    return pushUp;
  }

  // Y of the floor directly below feet position p within `maxDrop`, or null.
  groundBelow(p, maxDrop) {
    const hit = this.raycast(this._ray.origin.set(p.x, p.y + this.radius, p.z), this._ray.direction.set(0, -1, 0), this.radius + maxDrop);
    return hit ? hit.point.y : null;
  }

  raycast(origin, direction, far = Infinity) {
    if (!this.bvh) return null;
    this._ray.origin.copy(origin); this._ray.direction.copy(direction).normalize();
    return this.bvh.raycastFirst(this._ray, THREE.DoubleSide, 0, far);
  }
}
