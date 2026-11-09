import * as THREE from 'three';

export function createBadgeTexture(onReady = () => {}) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  ctx.fillStyle = '#edbd32';
  ctx.fillRect(0, 0, 1024, 1024);
  const emblem = new Image();
  emblem.onload = () => {
    ctx.clearRect(0, 0, 1024, 1024);
    ctx.drawImage(emblem, 18, 18, 988, 988);
    // Reuse the official emblem's alpha exactly; the figurine has dark print on yellow resin.
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#372b11';
    ctx.fillRect(0, 0, 1024, 1024);
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#edbd32';
    ctx.fillRect(0, 0, 1024, 1024);
    ctx.globalCompositeOperation = 'source-over';
    texture.needsUpdate = true;
    onReady();
  };
  emblem.onerror = () => {
    console.error('西南财经大学校徽加载失败');
    onReady();
  };
  emblem.src = new URL('./assets/swufe-emblem-official.png', import.meta.url).href;
  return texture;
}
