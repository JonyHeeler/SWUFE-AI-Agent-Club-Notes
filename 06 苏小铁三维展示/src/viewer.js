import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { createFigure } from './model.js';

export function createViewer(host, { onReady, onInteraction, onError }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.94;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-label', '西南财经大学吉祥物苏小铁，拖动旋转，滚轮缩放。也可使用方向键和加减号。');
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.tabIndex = 0;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e8eeea');
  scene.fog = new THREE.Fog('#e8eeea', 17, 35);
  const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 50);
  const initialPosition = new THREE.Vector3(1.35, 2.9, 9.5);
  camera.position.copy(initialPosition);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 2.12, 0);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.rotateSpeed = 0.65;
  controls.zoomSpeed = 0.7;
  controls.minDistance = 5.4;
  controls.maxDistance = 14;
  controls.minPolarAngle = 0.13;
  controls.maxPolarAngle = Math.PI - 0.13;
  controls.autoRotate = false;
  controls.autoRotateSpeed = 0.65;
  controls.saveState();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  controls.enableDamping = !reducedMotion.matches;

  RectAreaLightUniformsLib.init();
  const studio = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(studio, 0.16);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.48;
  studio.dispose();
  pmrem.dispose();

  const key = new THREE.DirectionalLight('#fff1dc', 1.7);
  key.position.set(-3.5, 6, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -4, right: 4, top: 5, bottom: -3, near: 0.1, far: 18 });
  key.shadow.normalBias = 0.025;
  key.shadow.bias = -0.00015;
  key.shadow.radius = 5;
  key.shadow.blurSamples = 12;
  key.target.position.set(0, 1.8, 0);
  scene.add(key, key.target);

  const softbox = new THREE.RectAreaLight('#fff8eb', 2.8, 3.5, 5);
  softbox.position.set(-4, 4.5, 4);
  softbox.lookAt(0, 2.4, 0);
  const rim = new THREE.RectAreaLight('#e5e9eb', 3, 2.5, 4);
  rim.position.set(3.3, 4.8, -3);
  rim.lookAt(0, 2.5, 0);
  const fill = new THREE.RectAreaLight('#ffffff', 0.8, 4, 3);
  fill.position.set(2.5, 3.3, 5);
  fill.lookAt(0, 2, 0);
  scene.add(softbox, rim, fill);

  const figure = createFigure({ onTextureReady: () => { dirty = true; } });
  scene.add(figure);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#e8eeea', roughness: 1, metalness: 0 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.005;
  floor.receiveShadow = true;
  scene.add(floor);
  // Keep the underside inspectable when the viewer moves below the base.
  floor.material.side = THREE.FrontSide;
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 128;
  const ctx = shadowCanvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(29,39,30,.30)');
  gradient.addColorStop(0.45, 'rgba(29,39,30,.13)');
  gradient.addColorStop(1, 'rgba(29,39,30,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 3.8), new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }));
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = 0.009;
  scene.add(contact);

  let disposed = false, dirty = true, ready = false, lastTime;
  const markDirty = () => { dirty = true; };
  const start = () => {
    controls.autoRotate = false;
    onInteraction();
    markDirty();
  };
  controls.addEventListener('start', start);
  controls.addEventListener('change', markDirty);

  const resize = () => {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.fov = width / height < 0.75 ? 43 : 33;
    camera.updateProjectionMatrix();
    markDirty();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  const reset = () => {
    controls.autoRotate = false;
    controls.reset();
    onInteraction();
    markDirty();
  };
  const keydown = (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '0', 'Home'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === '0' || event.key === 'Home') return reset();
    start();
    const offset = camera.position.clone().sub(controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    const step = 0.12;
    if (event.key === 'ArrowLeft') spherical.theta -= step;
    if (event.key === 'ArrowRight') spherical.theta += step;
    if (event.key === 'ArrowUp') spherical.phi -= step;
    if (event.key === 'ArrowDown') spherical.phi += step;
    if (event.key === '+' || event.key === '=') spherical.radius *= 0.9;
    if (event.key === '-') spherical.radius *= 1.1;
    spherical.radius = THREE.MathUtils.clamp(spherical.radius, controls.minDistance, controls.maxDistance);
    spherical.phi = THREE.MathUtils.clamp(spherical.phi, controls.minPolarAngle, controls.maxPolarAngle);
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
    controls.update();
    markDirty();
  };
  const motionChange = () => {
    controls.enableDamping = !reducedMotion.matches;
    if (reducedMotion.matches) {
      controls.autoRotate = false;
      onInteraction();
    }
    markDirty();
  };
  const contextLost = (event) => {
    event.preventDefault();
    renderer.setAnimationLoop(null);
    onError('图形显示暂时中断，请重新加载页面。');
  };
  renderer.domElement.addEventListener('keydown', keydown);
  renderer.domElement.addEventListener('webglcontextlost', contextLost);
  reducedMotion.addEventListener('change', motionChange);
  document.addEventListener('visibilitychange', markDirty);

  renderer.setAnimationLoop((time) => {
    if (disposed || document.hidden) { lastTime = undefined; return; }
    const delta = lastTime === undefined ? 1 / 60 : Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;
    const changed = controls.update(delta);
    if (dirty || changed || !ready) {
      renderer.render(scene, camera);
      dirty = false;
      if (!ready) {
        ready = true;
        renderer.domElement.dataset.ready = 'true';
        onReady();
      }
    }
  });

  return {
    reset,
    setRotating(value) { controls.autoRotate = value; markDirty(); },
    dispose() {
      disposed = true;
      renderer.setAnimationLoop(null);
      observer.disconnect();
      controls.removeEventListener('start', start);
      controls.removeEventListener('change', markDirty);
      controls.dispose();
      renderer.domElement.removeEventListener('keydown', keydown);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      reducedMotion.removeEventListener('change', motionChange);
      document.removeEventListener('visibilitychange', markDirty);
      const geometries = new Set(), materials = new Set(), textures = new Set();
      scene.traverse((object) => {
        if (object.geometry) geometries.add(object.geometry);
        if (object.material) {
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
            materials.add(material);
            for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
          }
        }
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
      environment.dispose();
      key.shadow.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
