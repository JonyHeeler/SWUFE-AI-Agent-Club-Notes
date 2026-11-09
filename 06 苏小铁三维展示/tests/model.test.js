import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createFigure, faceDepth } from '../src/model.js';

test('the reconstructed figure has complete, finite 3D geometry and separate reference details', () => {
  const figure = createFigure();
  for (const name of ['hood', 'hood-opening', 'face', 'fringe', 'smile-cavity', 'seed-suit', 'bamboo', 'round-hand', 'left-leg-and-foot', 'right-leg-and-foot', 'yellow-bag', 'bag-strap', 'chest-badge', 'round-base']) {
    assert.ok(figure.getObjectByName(name), `Missing ${name}`);
  }
  let triangles = 0;
  figure.traverse((object) => {
    if (!object.isMesh) return;
    const geometry = object.geometry;
    for (const attribute of ['position', 'normal', 'uv']) {
      for (const value of geometry.attributes[attribute].array) assert.ok(Number.isFinite(value), `${object.name}: invalid ${attribute}`);
    }
    assert.ok(object.castShadow && object.receiveShadow);
    triangles += geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3;
  });
  const bounds = new THREE.Box3().setFromObject(figure);
  assert.ok(bounds.min.y >= 0 && bounds.max.y > 4 && bounds.max.y < 4.6);
  assert.ok(bounds.max.x - bounds.min.x > 2.4);
  assert.ok(bounds.max.z - bounds.min.z > 2);
  assert.ok(triangles > 100000 && triangles < 600000);
  assert.ok(faceDepth(0, 2.87) > faceDepth(0.8, 2.87));
});

test('legs extend into the garment and their flat soles rest on the display base', () => {
  const figure = createFigure();
  for (const side of ['left', 'right']) {
    const leg = figure.getObjectByName(`${side}-leg-and-foot`);
    const bounds = new THREE.Box3().setFromObject(leg);
    assert.ok(Math.abs(bounds.min.y - 0.181) < 0.001, 'sole must rest on the base');
    assert.ok(bounds.max.y > 0.71, 'leg must enter the trouser opening');
    const positions = leg.geometry.attributes.position;
    let shinVertices = 0, soleVertices = 0;
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      if (y > 0.45 && y < 0.57 && Math.abs(positions.getX(i)) > 0.15) shinVertices++;
      if (Math.abs(y - 0.181) < 0.0001) soleVertices++;
    }
    assert.ok(shinVertices > 40, 'shin must have real volume');
    assert.ok(soleVertices > 80, 'sole must contain a flat contact surface');
  }
});

test('the simplified right hand is one smooth sphere without fingers', () => {
  const figure = createFigure();
  const hand = figure.getObjectByName('round-hand');
  assert.ok(hand?.isMesh);
  assert.equal(hand.geometry.type, 'SphereGeometry');
  assert.equal(hand.children.length, 0);
  assert.ok(Math.abs(hand.scale.x - hand.scale.y) < 1e-8);
  assert.ok(Math.abs(hand.scale.y - hand.scale.z) < 1e-8);
  const bounds = new THREE.Box3().setFromObject(hand);
  assert.ok(bounds.max.y - bounds.min.y > 0.35);
});
