'use strict';

import React, { useState, useEffect, useRef } from 'react';
import axios from './axios';
import { getUrl } from './urls';
import { Icon } from './bootstrap-components';

// The AI buttons only exist for users who configured at least one model with a key (BYOK)
let statusPromise = null;
const loadStatus = () => {
  if (!statusPromise) {
    statusPromise = axios.get(getUrl('rest/ai/status')).then(r => r.data).catch(() => ({ enabled: false, tiers: {} }));
  }
  return statusPromise;
};

const TIER_LABELS = { basic: 'Basique', medium: 'Intermédiaire', high: 'Avancé' };
const STYLE_HINTS = ['Plus court', 'Plus chaleureux', 'Plus professionnel', 'Plus dynamique', 'Plus simple'];
const BRAND_KEY = 'hcfmailer.ai.brand';

// The host navbar restyles every .btn (white on dark): the panel buttons carry their own colours
const BTN = { border: '1px solid #4f46e5', borderRadius: 4, padding: '2px 10px', fontSize: 13, cursor: 'pointer', background: '#fff', color: '#4f46e5', marginRight: 4, marginBottom: 4 };
const btnStyle = (primary, disabled) => ({ ...BTN, ...(primary ? { background: '#4f46e5', color: '#fff' } : {}), ...(disabled ? { opacity: 0.5, cursor: 'default' } : {}) });

const panelStyle = { position: 'absolute', right: 0, top: '100%', zIndex: 2000, width: 400, background: '#fff', color: '#212529', border: '1px solid #ced4da', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,.2)', padding: 12, textAlign: 'left', fontSize: 14 };

export function AIToolbar({ editorType, getState, onApplied }) {
  const [status, setStatus] = useState(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('correct');
  const [tier, setTier] = useState('');
  const [instruction, setInstruction] = useState('');
  const [brief, setBrief] = useState('');
  const [brand, setBrand] = useState(() => { try { return window.localStorage.getItem(BRAND_KEY) || ''; } catch (e) { return ''; } });
  const [references, setReferences] = useState(null);
  const [selectedRefs, setSelectedRefs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [result, setResult] = useState(null);
  const previous = useRef(null);

  useEffect(() => { loadStatus().then(setStatus); }, []);

  useEffect(() => {
    if (open && mode === 'generate' && references === null) {
      axios.get(getUrl('rest/ai/references')).then(r => setReferences(r.data)).catch(() => setReferences({ templates: [], campaigns: [] }));
    }
  }, [open, mode, references]);

  if (!status || !status.enabled) {
    return null;
  }

  const toggleRef = ref => setSelectedRefs(current => {
    const key = ref.type + ':' + ref.id;
    if (current.some(r => r.type + ':' + r.id === key)) return current.filter(r => r.type + ':' + r.id !== key);
    return current.length >= 3 ? current : [...current, ref];
  });

  const run = async () => {
    setBusy(true);
    setMessage(null);
    setResult(null);
    try {
      const state = await getState();
      if (!state || typeof state.source !== 'string') {
        throw new Error('L’éditeur n’est pas encore prêt.');
      }
      const body = { editorType, source: state.source, tier: tier || undefined };
      if (mode === 'rewrite') body.instruction = instruction;
      if (mode === 'generate') {
        body.brief = brief;
        body.brand = brand;
        body.references = selectedRefs;
        try { window.localStorage.setItem(BRAND_KEY, brand); } catch (e) { /* storage unavailable */ }
      }
      const res = (await axios.post(getUrl(`rest/ai/${mode}`), body)).data;
      if (res.empty) {
        setMessage('Aucun texte à traiter dans ce contenu.');
      } else {
        previous.current = state;
        onApplied({ source: res.source, style: state.style });
        setResult(res);
        setMessage(`${res.changed} texte(s) modifié(s)${res.rejected ? `, ${res.rejected} proposition(s) ignorée(s) car elles altéraient les liens ou les balises` : ''}.`);
      }
    } catch (err) {
      const data = err.response && err.response.data;
      setMessage('Erreur : ' + ((data && data.message) || err.message));
    } finally {
      setBusy(false);
    }
  };

  const undo = () => {
    if (previous.current) {
      onApplied({ source: previous.current.source, style: previous.current.style });
      previous.current = null;
      setResult(null);
      setMessage('Modification annulée.');
    }
  };

  const canRun = !busy && (mode === 'correct' || (mode === 'rewrite' && instruction.trim()) || (mode === 'generate' && brief.trim()));
  const tabButton = (key, label) => <button key={key} style={btnStyle(mode === key)} onClick={() => { setMode(key); setMessage(null); }}>{label}</button>;

  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <a className="btn" onClick={() => setOpen(!open)} title="Assistant IA"><Icon icon="magic" /></a>
      {open && (
        <div style={panelStyle}>
          <div className="mb-2">{tabButton('correct', 'Corriger')}{tabButton('rewrite', 'Réécrire')}{tabButton('generate', 'Générer')}</div>

          {mode === 'correct' && <p>Corrige l’orthographe, la grammaire et la ponctuation sans toucher à la mise en page, aux liens ni aux balises de fusion.</p>}

          {mode === 'rewrite' && (
            <>
              <textarea className="form-control mb-1" rows={3} placeholder="Consigne : ex. rends le ton plus chaleureux" value={instruction} onChange={e => setInstruction(e.target.value)} />
              <div className="mb-2">{STYLE_HINTS.map(h => <button key={h} style={btnStyle(false)} onClick={() => setInstruction(h)}>{h}</button>)}</div>
            </>
          )}

          {mode === 'generate' && (
            <>
              <p className="mb-1">Remplit les textes du contenu actuel (votre modèle) à partir de votre demande. Sans contenu, un squelette est utilisé.</p>
              <textarea className="form-control mb-1" rows={4} placeholder="Sujet, informations à inclure (dates, offres, liens), public visé…" value={brief} onChange={e => setBrief(e.target.value)} />
              <textarea className="form-control mb-1" rows={2} placeholder="Ton / marque (optionnel, mémorisé)" value={brand} onChange={e => setBrand(e.target.value)} />
              {references && (references.templates.length > 0 || references.campaigns.length > 0) && (
                <details className="mb-2">
                  <summary>Newsletters de référence pour le style ({selectedRefs.length}/3)</summary>
                  <div style={{ maxHeight: 130, overflowY: 'auto' }}>
                    {[...references.templates.map(r => ({ ...r, type: 'template' })), ...references.campaigns.map(r => ({ ...r, type: 'campaign' }))].map(r => (
                      <label key={r.type + r.id} className="d-block">
                        <input type="checkbox" className="me-1" checked={selectedRefs.some(s => s.type === r.type && s.id === r.id)} onChange={() => toggleRef({ type: r.type, id: r.id })} />
                        {r.type === 'template' ? 'Modèle' : 'Campagne'} : {r.name}
                      </label>
                    ))}
                  </div>
                </details>
              )}
            </>
          )}

          <div className="d-flex align-items-center">
            {Object.keys(status.tiers).length > 1 && (
              <select className="form-select form-select-sm me-2" style={{ width: 'auto' }} value={tier} onChange={e => setTier(e.target.value)} title="Modèle utilisé">
                <option value="">Modèle : auto</option>
                {Object.keys(status.tiers).map(t => <option key={t} value={t}>{TIER_LABELS[t]}</option>)}
              </select>
            )}
            <button style={btnStyle(true, !canRun)} disabled={!canRun} onClick={run}>{busy ? 'En cours…' : 'Lancer'}</button>
            {previous.current && <button style={{ ...btnStyle(false, busy), marginLeft: 8 }} disabled={busy} onClick={undo}>Annuler</button>}
          </div>

          {message && <div className="mt-2">{message}</div>}
          {result && (result.subject || result.preheader) && (
            <div className="mt-2">
              {result.subject && <div><strong>Objet suggéré :</strong> <input className="form-control form-control-sm" readOnly value={result.subject} onFocus={e => e.target.select()} /></div>}
              {result.preheader && <div className="mt-1"><strong>Pré-en-tête :</strong> <input className="form-control form-control-sm" readOnly value={result.preheader} onFocus={e => e.target.select()} /></div>}
            </div>
          )}
          <div className="text-muted mt-2" style={{ fontSize: 12 }}>Le contenu modifié n’est enregistré qu’avec le bouton Enregistrer.</div>
        </div>
      )}
    </span>
  );
}
