'use strict';

import React, { useState, useEffect } from 'react';
import { Icon } from './bootstrap-components';
import { getPublicUrl, getSandboxUrl, getTrustedUrl } from './urls';
import { base } from '../../../shared/templates';

// The editors' own "mobile" toggles only narrow a box inside the page: the e-mail's @media rules look at the real
// window width and never fire. Here the exported HTML is rendered in an iframe of the chosen width, like a real phone.
const PRESETS = [
  ['320', 'iPhone SE (1re gén.)'],
  ['375', 'iPhone SE / mini'],
  ['390', 'iPhone 13 / 14'],
  ['428', 'iPhone Pro Max'],
  ['600', 'Largeur du mail'],
  ['768', 'Tablette'],
  ['1000', 'Ordinateur']
];

const barButton = active => ({ border: '1px solid #fff', borderRadius: 4, padding: '2px 8px', marginRight: 6, cursor: 'pointer', fontSize: 13, background: active ? '#fff' : 'transparent', color: active ? '#212529' : '#fff' });

export function ResponsivePreview({ getHtml, tagLanguage }) {
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState(390);
  const [html, setHtml] = useState(null);
  const [error, setError] = useState(null);
  const [viewport, setViewport] = useState(window.innerWidth);

  const load = async () => {
    setError(null);
    try {
      const state = await getHtml();
      if (!state || typeof state.html !== 'string') throw new Error('L’éditeur n’est pas encore prêt.');
      // [URL_BASE] & co. are tags in the exported HTML: resolve them so that images and fonts load in the preview
      const resolved = base(state.html, tagLanguage || 'simple', getTrustedUrl(), getSandboxUrl(), getPublicUrl());
      setHtml(resolved);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (open) {
      load();
      const onResize = () => setViewport(window.innerWidth);
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }
  }, [open]);

  const scale = Math.min(1, (viewport - 48) / width);

  return (
    <>
      <a className="btn" onClick={() => setOpen(true)} title="Aperçu à plusieurs largeurs"><Icon icon="mobile-alt" /></a>
      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(33,37,41,.92)', display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
          <div style={{ padding: '10px 16px', color: '#fff', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
            <strong style={{ marginRight: 12 }}>Aperçu</strong>
            {PRESETS.map(([w, label]) => <button key={w} title={label} style={barButton(Number(w) === width)} onClick={() => setWidth(Number(w))}>{w}</button>)}
            <input type="number" min="200" max="1600" value={width} onChange={e => setWidth(Math.max(200, Math.min(1600, Number(e.target.value) || 200)))} style={{ width: 80, marginLeft: 6 }} />
            <span style={{ marginLeft: 4 }}>px</span>
            <span style={{ marginLeft: 12, opacity: .7 }}>{(PRESETS.find(([w]) => Number(w) === width) || [])[1] || ''}</span>
            <span style={{ flex: 1 }} />
            <button style={barButton(false)} onClick={load}>Actualiser</button>
            <button style={barButton(false)} onClick={() => setOpen(false)}>Fermer</button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '0 24px 24px', display: 'flex', justifyContent: 'center' }}>
            {error && <div style={{ color: '#fff' }}>{error}</div>}
            {!error && html === null && <div style={{ color: '#fff' }}>Chargement…</div>}
            {html !== null && (
              <div style={{ width: width * scale, height: `calc((100vh - 80px) )`, flexShrink: 0 }}>
                <iframe
                  title="Aperçu responsive"
                  sandbox=""
                  srcDoc={html}
                  style={{ width, height: `calc((100vh - 80px) / ${scale})`, border: 0, background: '#fff', transformOrigin: 'top left', transform: `scale(${scale})`, borderRadius: 6 }} />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
