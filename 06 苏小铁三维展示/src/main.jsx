import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createViewer } from './viewer.js';
import './style.css';

function RotateIcon({ paused = false }) {
  return paused
    ? <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M7 5v10M13 5v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
    : <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M15.5 8a6 6 0 1 0 .1 4M15.5 4.5V8H12" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function App() {
  const host = useRef(null), viewer = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [rotating, setRotating] = useState(false);
  useEffect(() => {
    try {
      viewer.current = createViewer(host.current, {
        onReady: () => setReady(true),
        onInteraction: () => setRotating(false),
        onError: setError,
      });
    } catch (e) {
      console.error(e);
      setError('无法开启 3D 显示，请使用支持 WebGL 2 的浏览器，并开启硬件加速。');
    }
    return () => { viewer.current?.dispose(); viewer.current = null; };
  }, []);
  const toggleRotation = () => {
    const next = !rotating;
    setRotating(next);
    viewer.current?.setRotating(next);
  };
  return <main className="app">
    <header className="masthead">
      <div className="identity">苏小铁</div>
    </header>
    <section className="stage" aria-label="西南财经大学吉祥物苏小铁三维展示">
      <div className="viewer" ref={host} />
      {!ready && !error && <div className="loading" role="status"><span className="loading-dot" />加载中…</div>}
      {error && <div className="error" role="alert"><p>{error}</p><button onClick={() => window.location.reload()}>重新加载</button></div>}
    </section>
    <footer className="toolbar">
      <div className="gesture-hint"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 11V6a1.5 1.5 0 0 1 3 0v5-7a1.5 1.5 0 0 1 3 0v7-5a1.5 1.5 0 0 1 3 0v6-3a1.5 1.5 0 0 1 3 0v7c0 4-2 6-6 6-3 0-4-2-6-4l-3-4c-1-2 1-3 2-2l1 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" /></svg><span>拖动旋转<span className="hint-divider">/</span>滚轮缩放</span></div>
      <div className="controls">
        <button className="rotate-button" onClick={toggleRotation} aria-pressed={rotating} disabled={!ready || !!error} title="拖动时停止自动旋转"><RotateIcon paused={rotating} /><span>{rotating ? '暂停旋转' : '自动旋转'}</span></button>
        <span className="control-divider" />
        <button className="reset-button" onClick={() => viewer.current?.reset()} disabled={!ready || !!error} aria-label="回到初始视角" title="回到初始视角"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M6.5 4H4v2.5M13.5 4H16v2.5M4 13.5V16h2.5M16 13.5V16h-2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.3" /></svg></button>
      </div>
    </footer>
  </main>;
}

const root = createRoot(document.getElementById('root'));
root.render(<App />);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
