'use strict';

import React, { useState, useEffect, useRef } from 'react';
import axios from './axios';
import { useTranslation } from './i18n';
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

const TIER_LABELS = { basic: 'aiTierBasic', medium: 'aiTierMedium', high: 'aiTierHigh' };
const RESPONSIVE_HINTS = ['aiHintTitleSmaller', 'aiHintStackColumns', 'aiHintSmallerMargins', 'aiHintBiggerButtons'];
const STYLE_HINTS = ['aiHintShorter', 'aiHintWarmer', 'aiHintProfessional', 'aiHintDynamic', 'aiHintSimpler'];
const BRAND_KEY = 'hcfmailer.ai.brand';

// The host navbar restyles every .btn (white on dark): the panel buttons carry their own colours
const BTN = { border: '1px solid #4f46e5', borderRadius: 4, padding: '2px 10px', fontSize: 13, cursor: 'pointer', background: '#fff', color: '#4f46e5', marginRight: 4, marginBottom: 4 };
const btnStyle = (primary, disabled) => ({ ...BTN, ...(primary ? { background: '#4f46e5', color: '#fff' } : {}), ...(disabled ? { opacity: 0.5, cursor: 'default' } : {}) });

const panelStyle = { position: 'absolute', right: 0, top: '100%', zIndex: 2000, width: 400, background: '#fff', color: '#212529', border: '1px solid #ced4da', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,.2)', padding: 12, textAlign: 'left', fontSize: 14 };

export function AIToolbar({ editorType, getState, onApplied }) {
  const { t } = useTranslation();
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
        throw new Error(t('aiEditorNotReady'));
      }
      const body = { editorType, source: state.source, tier: tier || undefined };
      if (mode === 'rewrite' || mode === 'responsive') body.instruction = instruction;
      if (mode === 'responsive') body.style = state.style;
      if (mode === 'generate') {
        body.brief = brief;
        body.brand = brand;
        body.references = selectedRefs;
        try { window.localStorage.setItem(BRAND_KEY, brand); } catch (e) { /* storage unavailable */ }
      }
      const res = (await axios.post(getUrl(`rest/ai/${mode}`), body)).data;
      if (res.empty) {
        setMessage(t('aiNothingToProcess'));
      } else if (mode === 'responsive') {
        if (res.changed > 0) {
          previous.current = state;
          onApplied({ source: res.source, style: res.style !== undefined ? res.style : state.style });
        }
        setResult(null);
        setMessage(res.rejectedReason ? t('aiResponsiveRejected', { reason: res.rejectedReason }) : (res.summary ? t('aiResponsiveDoneSummary', { summary: res.summary }) : t('aiResponsiveDone')));
      } else {
        previous.current = state;
        onApplied({ source: res.source, style: state.style });
        setResult(res);
        setMessage(`${t('aiTextsChanged', { n: res.changed })}${res.rejected ? t('aiTextsRejected', { n: res.rejected }) : ''}.`);
      }
    } catch (err) {
      const data = err.response && err.response.data;
      setMessage(t('aiErrorPrefix', { message: (data && data.message) || err.message }));
    } finally {
      setBusy(false);
    }
  };

  const undo = () => {
    if (previous.current) {
      onApplied({ source: previous.current.source, style: previous.current.style });
      previous.current = null;
      setResult(null);
      setMessage(t('aiUndone'));
    }
  };

  const canRun = !busy && (mode === 'correct' || ((mode === 'rewrite' || mode === 'responsive') && instruction.trim()) || (mode === 'generate' && brief.trim()));
  const tabButton = (key, label) => <button key={key} style={btnStyle(mode === key)} onClick={() => { setMode(key); setMessage(null); }}>{label}</button>;

  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <a className="btn" onClick={() => setOpen(!open)} title={t('aiToolbarTitle')}><Icon icon="magic" /></a>
      {open && (
        <div style={panelStyle}>
          <div className="mb-2">{tabButton('correct', t('aiTabCorrect'))}{tabButton('rewrite', t('aiTabRewrite'))}{tabButton('generate', t('aiTabGenerate'))}{(editorType === 'emailbuilder' || editorType === 'grapesjs') && tabButton('responsive', t('aiTabMobile'))}</div>

          {mode === 'correct' && <p>{t('aiCorrectHelp')}</p>}

          {mode === 'rewrite' && (
            <>
              <textarea className="form-control mb-1" rows={3} placeholder={t('aiRewritePlaceholder')} value={instruction} onChange={e => setInstruction(e.target.value)} />
              <div className="mb-2">{STYLE_HINTS.map(h => <button key={h} style={btnStyle(false)} onClick={() => setInstruction(t(h))}>{t(h)}</button>)}</div>
            </>
          )}

          {mode === 'responsive' && (
            <>
              <p className="mb-1">{t('aiResponsiveHelp')}</p>
              <textarea className="form-control mb-1" rows={3} placeholder={t('aiResponsivePlaceholder')} value={instruction} onChange={e => setInstruction(e.target.value)} />
              <div className="mb-2">{RESPONSIVE_HINTS.map(h => <button key={h} style={btnStyle(false)} onClick={() => setInstruction(t(h))}>{t(h)}</button>)}</div>
            </>
          )}

          {mode === 'generate' && (
            <>
              <p className="mb-1">{t('aiGenerateHelp')}</p>
              <textarea className="form-control mb-1" rows={4} placeholder={t('aiBriefPlaceholder')} value={brief} onChange={e => setBrief(e.target.value)} />
              <textarea className="form-control mb-1" rows={2} placeholder={t('aiBrandPlaceholder')} value={brand} onChange={e => setBrand(e.target.value)} />
              {references && (references.templates.length > 0 || references.campaigns.length > 0) && (
                <details className="mb-2">
                  <summary>{t('aiReferencesSummary', { n: selectedRefs.length })}</summary>
                  <div style={{ maxHeight: 130, overflowY: 'auto' }}>
                    {[...references.templates.map(r => ({ ...r, type: 'template' })), ...references.campaigns.map(r => ({ ...r, type: 'campaign' }))].map(r => (
                      <label key={r.type + r.id} className="d-block">
                        <input type="checkbox" className="me-1" checked={selectedRefs.some(s => s.type === r.type && s.id === r.id)} onChange={() => toggleRef({ type: r.type, id: r.id })} />
                        {r.type === 'template' ? t('aiRefTemplateName', { name: r.name }) : t('aiRefCampaignName', { name: r.name })}
                      </label>
                    ))}
                  </div>
                </details>
              )}
            </>
          )}

          <div className="d-flex align-items-center">
            {Object.keys(status.tiers).length > 1 && (
              <select className="form-select form-select-sm me-2" style={{ width: 'auto' }} value={tier} onChange={e => setTier(e.target.value)} title={t('aiModelUsed')}>
                <option value="">{t('aiModelAuto')}</option>
                {Object.keys(status.tiers).map(tierKey => <option key={tierKey} value={tierKey}>{t(TIER_LABELS[tierKey])}</option>)}
              </select>
            )}
            <button style={btnStyle(true, !canRun)} disabled={!canRun} onClick={run}>{busy ? t('aiRunning') : t('aiRun')}</button>
            {previous.current && <button style={{ ...btnStyle(false, busy), marginLeft: 8 }} disabled={busy} onClick={undo}>{t('aiUndo')}</button>}
          </div>

          {message && <div className="mt-2">{message}</div>}
          {result && (result.subject || result.preheader) && (
            <div className="mt-2">
              {result.subject && <div><strong>{t('aiSuggestedSubject')}</strong> <input className="form-control form-control-sm" readOnly value={result.subject} onFocus={e => e.target.select()} /></div>}
              {result.preheader && <div className="mt-1"><strong>{t('aiPreheader')}</strong> <input className="form-control form-control-sm" readOnly value={result.preheader} onFocus={e => e.target.select()} /></div>}
            </div>
          )}
          <div className="text-muted mt-2" style={{ fontSize: 12 }}>{t('aiNotSavedNote')}</div>
        </div>
      )}
    </span>
  );
}
