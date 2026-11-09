import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { createBadgeTexture } from './badge.js';

const TAU = Math.PI * 2;
const point = (p) => new THREE.Vector3(...p);

function surfaceGeometry(rows, columns, sample, reverse = false) {
  const positions = [], uvs = [], indices = [];
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= columns; i++) {
      positions.push(...sample(i / columns, j / rows));
      uvs.push(i / columns, j / rows);
    }
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < columns; i++) {
      const a = j * (columns + 1) + i, b = a + columns + 1;
      if (reverse) indices.push(a, a + 1, b, b, a + 1, b + 1);
      else indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function faceDepth(x, y) {
  const cheek = 0.70 + 0.31 * Math.sqrt(Math.max(0, 1 - (x / 0.89) ** 2 - ((y - 2.84) / 0.715) ** 2));
  const mouthHollow = 0.035 * Math.exp(-x*x/0.014 - ((y-2.66)/0.105)**4);
  return cheek - mouthHollow;
}

export function createHoodGeometry() {
  const start = Math.asin(0.915 / 1.17);
  return surfaceGeometry(88, 144, (u, v) => {
    const phi = u * TAU;
    const theta = start + v * (Math.PI - start);
    const lip = ((Math.PI - theta) / (Math.PI - start)) ** 3;
    const ry = 1.18 - 0.247 * lip;
    const peak = 0.045 * Math.exp(-(((phi - 1.27) / 0.12) ** 2) - ((theta - 1.45) / 0.26) ** 2);
    return [
      1.17 * Math.sin(theta) * Math.cos(phi),
      3.1 - 0.26 * lip + ry * Math.sin(theta) * Math.sin(phi) + peak,
      1.04 * Math.cos(theta) + 0.05 * lip,
    ];
  });
}

function microTexture() {
  const size = 256, data = new Uint8Array(size * size * 4);
  let seed = 73;
  for (let i = 0; i < size * size; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const n = 110 + (seed >>> 26);
    data.set([n, n, n, 255], i * 4);
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 5);
  texture.needsUpdate = true;
  return texture;
}

function canvasTexture(draw, width = 1024, height = width) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function faceTexture() {
  return canvasTexture((ctx, w, h) => {
    ctx.fillStyle = '#e8ad89';
    ctx.fillRect(0, 0, w, h);
    for (const x of [0.245, 0.755]) {
      const gradient = ctx.createRadialGradient(w * x, h * 0.51, 0, w * x, h * 0.51, w * 0.145);
      gradient.addColorStop(0, 'rgba(230,124,126,0.46)');
      gradient.addColorStop(0.55, 'rgba(236,142,141,0.28)');
      gradient.addColorStop(1, 'rgba(236,142,141,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
    }
  });
}

export function createFigure({ onTextureReady } = {}) {
  const figure = new THREE.Group();
  figure.name = 'forest-figure';
  const grain = microTexture();
  const physical = (color, roughness, extra = {}) => new THREE.MeshPhysicalMaterial({
    color, roughness, metalness: 0, clearcoat: 0.22, clearcoatRoughness: 0.36,
    bumpMap: grain, bumpScale: 0.004, ...extra,
  });
  const materials = {
    shell: physical('#653718', 0.43),
    rim: physical('#57351e', 0.36),
    suit: physical('#76502c', 0.43),
    skin: physical('#e8ad89', 0.46, { clearcoat: 0.2, sheen: 0.12, sheenColor: new THREE.Color('#fbd4c0') }),
    face: physical('#ffffff', 0.44, { map: faceTexture(), clearcoat: 0.24 }),
    hair: physical('#171713', 0.58, { clearcoat: 0.08, bumpScale: 0.0005 }),
    ink: physical('#171d19', 0.49, { clearcoat: 0.1 }),
    green: physical('#075436', 0.32),
    bamboo: physical('#664025', 0.45),
    node: physical('#986c3e', 0.47),
    yellow: physical('#f6bc2f', 0.37),
    yellowEdge: physical('#d79b1d', 0.42),
    mouth: physical('#8d211e', 0.42),
    tongue: physical('#f37467', 0.42),
  };

  function mesh(geometry, material, position = [0, 0, 0], parent = figure) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(...position);
    object.castShadow = object.receiveShadow = true;
    parent.add(object);
    return object;
  }
  function ellipsoid(position, scale, material, parent = figure) {
    const object = mesh(new THREE.SphereGeometry(1, 48, 32), material, position, parent);
    object.scale.set(...scale);
    return object;
  }
  function tube(points, radius, material, closed = false, parent = figure) {
    const curve = new THREE.CatmullRomCurve3(points.map(point), closed, 'centripetal');
    return mesh(new THREE.TubeGeometry(curve, Math.max(32, points.length * 12), radius, 10, closed), material, [0, 0, 0], parent);
  }
  function capsule(a, b, radius, material, parent = figure) {
    const from = point(a), to = point(b), delta = to.clone().sub(from);
    const object = mesh(new THREE.CapsuleGeometry(radius, delta.length(), 10, 20), material, from.add(to).multiplyScalar(0.5).toArray(), parent);
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    return object;
  }
  function faceShape(shape, material, offset = 0.012, depth = 0.012) {
    let geometry = new THREE.ShapeGeometry(shape, 40).toNonIndexed();
    for (let pass = 0; pass < 4; pass++) {
      const source = geometry.attributes.position.array, vertices = [];
      for (let i = 0; i < source.length; i += 9) {
        const a = [...source.slice(i, i+3)], b = [...source.slice(i+3, i+6)], c = [...source.slice(i+6,i+9)];
        const ab = a.map((v,k)=>(v+b[k])/2), bc = b.map((v,k)=>(v+c[k])/2), ca = c.map((v,k)=>(v+a[k])/2);
        vertices.push(...a,...ab,...ca,...ab,...b,...bc,...ca,...bc,...c,...ab,...bc,...ca);
      }
      geometry.dispose();
      geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices,3));
    }
    const positions = geometry.attributes.position, uv = [];
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = 2.84 + (positions.getY(i)-2.87)*0.84;
      positions.setY(i,y);
      positions.setZ(i,faceDepth(x,y)+offset+depth);
      uv.push(x/2+0.5,y/4);
    }
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    const smoothGeometry = mergeVertices(geometry, 0.00001);
    geometry.dispose();
    geometry = smoothGeometry;
    geometry.computeVertexNormals();
    return mesh(geometry, material);
  }

  // A continuous open shell leaves a real recess around the face.
  mesh(createHoodGeometry(), materials.shell).name = 'hood';
  const opening = [];
  for (let i = 0; i < 128; i++) {
    const t = i / 128 * TAU;
    opening.push([0.915 * Math.cos(t), 2.84 + 0.73 * Math.sin(t), 0.704]);
  }
  tube(opening, 0.032, materials.rim, true).name = 'hood-opening';
  const faceGeo = surfaceGeometry(128, 192, (u, v) => {
    const angle = u * TAU, radius = v;
    const x = 0.89 * radius * Math.cos(angle), y = 2.84 + 0.715 * radius * Math.sin(angle);
    return [x, y, faceDepth(x, y)];
  });
  const faceUvs = faceGeo.attributes.uv, facePositions = faceGeo.attributes.position;
  for (let i = 0; i < faceUvs.count; i++) {
    faceUvs.setXY(i, facePositions.getX(i) / 1.78 + 0.5, (facePositions.getY(i) - 2.84) / 1.43 + 0.5);
  }
  mesh(faceGeo, materials.face).name = 'face';

  const hair = new THREE.Shape();
  hair.moveTo(-0.34,3.70);
  hair.bezierCurveTo(0.10,3.79,0.65,3.57,0.79,3.27);
  hair.bezierCurveTo(0.73,3.16,0.47,3.30,0.30,3.46);
  hair.bezierCurveTo(0.35,3.33,0.38,3.24,0.34,3.20);
  hair.bezierCurveTo(0.23,3.19,0.06,3.37,-0.01,3.50);
  hair.bezierCurveTo(0.00,3.35,0.00,3.27,-0.04,3.24);
  hair.bezierCurveTo(-0.21,3.30,-0.37,3.50,-0.34,3.70);
  const fringe=faceShape(hair,materials.hair,0.030,0.025);
  fringe.name='fringe';
  const hairPositions=fringe.geometry.attributes.position;
  for(let i=0;i<hairPositions.count;i++) {
    const x=hairPositions.getX(i),y=hairPositions.getY(i);
    hairPositions.setZ(i,hairPositions.getZ(i)+0.026*Math.exp(-(((y-3.36)/0.19)**2)));
  }
  fringe.geometry.computeVertexNormals();

  const eye = new THREE.Shape();
  eye.absellipse(-0.325, 3.035, 0.092, 0.123, -0.18, TAU - 0.18, false, -0.16);
  faceShape(eye, materials.ink, 0.009, 0.004);
  const wink = [[0.265, 2.91], [0.32, 2.945], [0.38, 2.94], [0.435, 2.902]];
  tube(wink.map(([x, y]) => [x, 2.84+(y-2.87)*0.84, faceDepth(x, 2.84+(y-2.87)*0.84) + 0.017]), 0.015, materials.ink);
  tube([[0.255, 2.96], [0.32, 2.995], [0.39, 2.99], [0.446, 2.95]].map(([x, y]) => [x, 2.84+(y-2.87)*0.84, faceDepth(x, 2.84+(y-2.87)*0.84) + 0.016]), 0.012, materials.ink);

  const mouth = new THREE.Shape();
  mouth.moveTo(-0.145, 2.795);
  mouth.quadraticCurveTo(-0.03, 2.72, 0.145, 2.785);
  mouth.bezierCurveTo(0.125, 2.53, -0.14, 2.465, -0.145, 2.795);
  faceShape(mouth, materials.mouth, 0.002, 0.001).name = 'smile-cavity';
  const tongue = new THREE.Shape();
  tongue.moveTo(-0.0927, 2.631);
  tongue.quadraticCurveTo(-0.018, 2.676, 0.0918, 2.64);
  tongue.bezierCurveTo(0.054,2.568,-0.063,2.5725,-0.0927,2.631);
  const tongueMesh=faceShape(tongue,materials.tongue,0.004,0.001);
  const tonguePositions=tongueMesh.geometry.attributes.position;
  for(let i=0;i<tonguePositions.count;i++) {
    const x=tonguePositions.getX(i),y=tonguePositions.getY(i);
    tonguePositions.setZ(i,tonguePositions.getZ(i)+0.006*Math.exp(-x*x/0.008-((y-2.63)/0.07)**2));
  }
  tongueMesh.geometry.computeVertexNormals();

  // One closed garment surface, with the crotch cut into its hem.
  const outline = new THREE.CatmullRomCurve3([
    [0,0.64,0],[0.45,0.60,0],[0.65,0.62,0],[0.69,0.81,0],
    [0.72,1.15,0],[0.66,1.52,0],[0.53,1.88,0],[0.37,2.15,0],[0,2.22,0]
  ].map(point));
  const body = mesh(surfaceGeometry(112,128,(u,v)=>{
    const p=outline.getPoint(v), a=u*TAU, x=p.x*Math.sin(a);
    const notch=0.16*Math.exp(-x*x/0.012)*Math.exp(-(((p.y-0.62)/0.12)**2));
    return [x,p.y+notch,p.x*0.78*Math.cos(a)];
  },true),materials.suit);
  body.name='seed-suit';
  const legProfile=new THREE.CatmullRomCurve3([
    [0,0.181,0],[0.19,0.181,0.235],[0.235,0.205,0.28],
    [0.245,0.265,0.295],[0.235,0.33,0.275],
    [0.22,0.41,0.225],[0.22,0.57,0.21],[0.22,0.74,0.21],[0,0.74,0]
  ].map(point));
  for (const side of [-1,1]) {
    const leg=mesh(surfaceGeometry(88,80,(u,v)=>{
      const p=legProfile.getPoint(v),a=u*TAU;
      const roundedSquare=(t)=>Math.sign(t)*Math.pow(Math.abs(t),0.72);
      const forward=0.065*(1-THREE.MathUtils.smoothstep(p.y,0.30,0.48));
      return [p.x*roundedSquare(Math.sin(a)),Math.max(0.181,p.y),p.z*roundedSquare(Math.cos(a))+forward];
    },true),materials.skin,[side*0.33,0,0]);
    leg.name=side<0?'left-leg-and-foot':'right-leg-and-foot';
  }

  const seedGeo = new THREE.SphereGeometry(1, 12, 12);
  for (let row = 0; row < 6; row++) {
    const y = 0.79 + row * 0.205;
    for (let j = 0; j < 13; j++) {
      const a = (j + (row % 2) * 0.47) / 13 * TAU;
      let lo=0.30,hi=1;
      for(let k=0;k<28;k++) { const mid=(lo+hi)/2; if(outline.getPoint(mid).y<y) lo=mid; else hi=mid; }
      const r=outline.getPoint((lo+hi)/2).x;
      const seed = mesh(seedGeo, materials.ink, [(r + 0.009) * Math.sin(a), y + 0.013 * Math.sin(j * 7 + row), (r * 0.78 + 0.009) * Math.cos(a)]);
      seed.scale.set(0.016, 0.047 + 0.008 * Math.sin(j * 5 + row), 0.006);
      seed.rotation.y = a;
      seed.rotation.z = 0.12 * Math.sin(j * 9 + row * 3);
    }
  }

  function arm(points, radius) {
    const curve=new THREE.CatmullRomCurve3(points.map(point),false,'centripetal');
    const geometry=new THREE.TubeGeometry(curve,96,radius,32,false);
    const vertices=geometry.attributes.position;
    for(let row=0;row<=96;row++) {
      const t=row/96,center=curve.getPointAt(t),taper=1-0.48*t;
      for(let col=0;col<=32;col++) {
        const i=row*33+col;
        vertices.setXYZ(i,center.x+(vertices.getX(i)-center.x)*taper,center.y+(vertices.getY(i)-center.y)*taper,center.z+(vertices.getZ(i)-center.z)*taper);
      }
    }
    geometry.computeVertexNormals();
    mesh(geometry,materials.skin);
    ellipsoid(points[0],[radius,radius,radius],materials.skin);
  }
  arm([[-0.48, 2.01, 0.06], [-0.72, 2.18, 0.26], [-0.96, 2.43, 0.56], [-1.035, 2.66, 0.79]], 0.205);
  arm([[0.48, 2.01, 0.03], [0.75, 2.10, 0.23], [0.96, 2.25, 0.45], [1.08, 2.40, 0.64]], 0.20);
  ellipsoid([-1.035, 2.775, 0.91], [0.18, 0.205, 0.15], materials.skin);
  const roundHand = ellipsoid([1.12, 2.48, 0.70], [0.185, 0.185, 0.185], materials.skin);
  roundHand.name = 'round-hand';

  const bamboo = new THREE.Group();
  bamboo.name = 'bamboo';
  bamboo.position.set(-1.035, 2.46, 0.79);
  bamboo.rotation.z = 0.06;
  figure.add(bamboo);
  for (const [x, y, height, tilt] of [[-0.075, 0.4, 0.89, 0.10], [0.07, 0.47, 0.96, -0.11]]) {
    const stalk = new THREE.Group();
    stalk.position.set(x, y, 0);
    stalk.rotation.z = tilt;
    bamboo.add(stalk);
    mesh(new THREE.CylinderGeometry(0.048, 0.059, height, 24), materials.bamboo, [0, 0, 0], stalk);
    for (let k = -1; k <= 1; k++) {
      mesh(new THREE.CylinderGeometry(0.053, 0.055, 0.026, 24), materials.node, [0, k * 0.235, 0], stalk);
    }
    for (let k = 0; k < 7; k++) {
      const angle = (k - 3) * 0.39;
      const start = new THREE.Vector3(0, height * 0.43, 0);
      const end = new THREE.Vector3(Math.sin(angle) * (0.28 + (k % 3) * 0.045), height * 0.43 + Math.cos(angle) * (0.28 + (k % 3) * 0.065), Math.sin(k * 3) * 0.12);
      const middle = start.clone().lerp(end, 0.5);
      middle.z += 0.065;
      const spine = new THREE.QuadraticBezierCurve3(start, middle, end);
      const leaf = surfaceGeometry(18, 8, (u, v) => {
        const p = spine.getPoint(v), width = Math.sin(v * Math.PI) ** 0.8 * 0.048;
        p.x += (u - 0.5) * width * 2 * Math.cos(angle);
        p.y -= (u - 0.5) * width * 2 * Math.sin(angle);
        p.z += Math.sin(u * Math.PI) * 0.021 * Math.sin(v * Math.PI);
        return p.toArray();
      });
      const leafMaterial = materials.green.clone();
      leafMaterial.side = THREE.DoubleSide;
      mesh(leaf, leafMaterial, [0, 0, 0], stalk);
    }
  }

  tube([[-0.40, 2.08, 0.32], [-0.22, 1.8, 0.45], [0.07, 1.43, 0.54], [0.48, 1.13, 0.44], [0.73, 1.22, 0], [0.46, 1.69, -0.36], [0.05, 2.02, -0.32], [-0.40, 2.08, 0.32]], 0.023, materials.green).name = 'bag-strap';
  const bag = new THREE.Group();
  bag.name = 'yellow-bag';
  bag.position.set(0.55, 1.03, 0.49);
  bag.rotation.set(-0.02, 0.15, 0.055);
  figure.add(bag);
  mesh(new RoundedBoxGeometry(0.395, 0.54, 0.14, 5, 0.045), materials.yellowEdge, [0, 0, 0], bag);
  mesh(new RoundedBoxGeometry(0.36, 0.49, 0.10, 5, 0.035), materials.yellow, [0, 0, 0.042], bag);
  const flap = new THREE.Shape();
  flap.moveTo(-0.187, 0.245); flap.lineTo(0.187, 0.245); flap.lineTo(0.174, 0.13);
  flap.quadraticCurveTo(0, 0.005, -0.174, 0.13); flap.closePath();
  mesh(new THREE.ExtrudeGeometry(flap, { depth: 0.022, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.008, bevelSegments: 3, curveSegments: 24 }), materials.yellow, [0, 0, 0.095], bag);
  ellipsoid([0, 0.139, 0.132], [0.023, 0.023, 0.012], materials.yellowEdge, bag);

  const badge = new THREE.Group();
  badge.name = 'chest-badge';
  badge.position.set(-0.31, 1.62, 0.443);
  badge.rotation.set(-0.20, -0.22, 0);
  figure.add(badge);
  const disc = mesh(new THREE.CylinderGeometry(0.168, 0.168, 0.025, 64), materials.yellowEdge, [0, 0, 0], badge);
  disc.rotation.x = Math.PI / 2;
  const badgeMat = physical('#ffffff', 0.53, { map: createBadgeTexture(onTextureReady), bumpScale: 0.001, metalness: 0.05, clearcoat: 0.08 });
  mesh(new THREE.CircleGeometry(0.153, 64), badgeMat, [0, 0, 0.014], badge);

  const baseProfile = [[0, 0.022], [1.08, 0.022], [1.15, 0.035], [1.18, 0.065], [1.18, 0.14], [1.16, 0.17], [1.11, 0.181], [0, 0.181]].map(([x, y]) => new THREE.Vector2(x, y));
  mesh(new THREE.LatheGeometry(baseProfile, 144), materials.shell).name = 'round-base';
  return figure;
}

