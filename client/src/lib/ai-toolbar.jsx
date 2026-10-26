'use strict';

import React, { useState, useEffect, useRef } from 'react';
import axios from './axios';
import { useTranslation } from './i18n';
import { getUrl } from './urls';
import { Icon } from './bootstrap-components';
import { formatMicro, formatMoney, formatNumber } from './ai-format';
import { useAIRun, AIProgress, AIDebugToggle, AIDebugButton } from './ai-run';

// The AI button exists for users with their own key (BYOK) or when the administrator offers a shared AI (then a click
// opens the offer first). Without either, there is no button at all.
export const fetchStatus = () => axios.get(getUrl('rest/ai/status')).then(r => r.data).catch(() => ({ enabled: false, tiers: {} }));

const SEEN_KEY = 'hcfmailer.ai.seen';
const wasSeen = () => { try { return window.localStorage.getItem(SEEN_KEY) === '1'; } catch (e) { return true; } };
const markSeen = () => { try { window.localStorage.setItem(SEEN_KEY, '1'); } catch (e) { /* storage unavailable */ } };

// Attention-grabbing button: gradient pill with a pulsing halo, until the user opened the assistant once
const ANIMATIONS = `
@keyframes aiPulse { 0% { box-shadow: 0 0 0 0 rgba(168,85,247,.75); } 70% { box-shadow: 0 0 0 11px rgba(168,85,247,0); } 100% { box-shadow: 0 0 0 0 rgba(168,85,247,0); } }
@keyframes aiShine { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
@keyframes aiWiggle { 0%, 88%, 100% { transform: rotate(0); } 92% { transform: rotate(-14deg); } 96% { transform: rotate(14deg); } }`;
const robotButtonStyle = attract => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 12px', margin: '0 6px', borderRadius: 999, cursor: 'pointer',
  color: '#fff', fontWeight: 600, fontSize: 13, textDecoration: 'none', border: '1px solid rgba(255,255,255,.6)',
  background: 'linear-gradient(90deg, #6366f1, #a855f7, #ec4899, #6366f1)', backgroundSize: '200% 100%',
  animation: attract ? 'aiPulse 1.8s infinite, aiShine 4s linear infinite' : 'aiShine 8s linear infinite'
});

const TIER_LABELS = { basic: 'aiTierBasic', medium: 'aiTierMedium', high: 'aiTierHigh' };
const RESPONSIVE_HINTS = ['aiHintTitleSmaller', 'aiHintStackColumns', 'aiHintSmallerMargins', 'aiHintBiggerButtons'];
const STYLE_HINTS = ['aiHintShorter', 'aiHintWarmer', 'aiHintProfessional', 'aiHintDynamic', 'aiHintSimpler'];
const BRAND_KEY = 'hcfmailer.ai.brand';

// The host navbar restyles every .btn (white on dark): the panel buttons carry their own colours
const BTN = { border: '1px solid #4f46e5', borderRadius: 4, padding: '2px 10px', fontSize: 13, cursor: 'pointer', background: '#fff', color: '#4f46e5', marginRight: 4, marginBottom: 4 };
const btnStyle = (primary, disabled) => ({ ...BTN, ...(primary ? { background: '#4f46e5', color: '#fff' } : {}), ...(disabled ? { opacity: 0.5, cursor: 'default' } : {}) });

const panelStyle = { position: 'absolute', right: 0, top: '100%', zIndex: 2000, width: 400, background: '#fff', color: '#212529', border: '1px solid #ced4da', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,.2)', padding: 12, textAlign: 'left', fontSize: 14 };

// Shown on click when the user has no key of their own: bring their own key, or accept the billed shared AI
export function OfferDialog({ status, onAccept, onClose }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const { prices } = status;
  const card = { flex: '1 1 260px', border: '1px solid #ced4da', borderRadius: 8, padding: 16, background: '#fff' };
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 3500, background: 'rgba(33,37,41,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, textAlign: 'left', color: '#212529', fontWeight: 'normal' }} onClick={onClose}>
      <div style={{ background: '#f8f9fa', borderRadius: 10, padding: 20, maxWidth: 760, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,.4)' }} onClick={e => e.stopPropagation()}>
        <h4 style={{ marginTop: 0 }}><Icon icon="robot" /> {t('aiOfferTitle')}</h4>
        <p>{t('aiOfferIntro')}</p>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={card}>
            <h5>{t('aiOfferOwnKeysTitle')}</h5>
            <p>{t('aiOfferOwnKeysText')}</p>
            <a className="btn btn-outline-primary" style={{ color: '#4f46e5' }} href={getUrl('account/ai')} target="_blank" rel="noopener noreferrer">{t('aiOfferOwnKeysButton')}</a>
          </div>
          <div style={{ ...card, borderColor: '#a855f7', boxShadow: '0 0 0 2px rgba(168,85,247,.25)' }}>
            <h5>{t('aiOfferSharedTitle')}</h5>
            <p>{t('aiOfferSharedText')}</p>
            <ul>
              <li>{t('aiPriceOutput', { price: formatMoney(prices.out, prices.currency) })}</li>
              <li>{t('aiPriceInput', { price: formatMoney(prices.in, prices.currency) })}</li>
              {prices.maxOutstanding > 0 && <li>{t('aiOfferLimit', { amount: formatMoney(prices.maxOutstanding, prices.currency) })}</li>}
            </ul>
            <button className="btn btn-primary" disabled={busy} onClick={async () => { setBusy(true); try { await onAccept(); } finally { setBusy(false); } }}>{t('aiOfferSharedButton')}</button>
          </div>
        </div>
        <div style={{ textAlign: 'right', marginTop: 12 }}><button className="btn btn-link" style={{ color: '#6c757d' }} onClick={onClose}>{t('aiOfferClose')}</button></div>
      </div>
    </div>
  );
}

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
  const aiRun = useAIRun();
  const [message, setMessage] = useState(null);
  const [result, setResult] = useState(null);
  const [offerOpen, setOfferOpen] = useState(false);
  const [attract, setAttract] = useState(() => !wasSeen());
  const [lastBilling, setLastBilling] = useState(null);
  const previous = useRef(null);

  useEffect(() => { fetchStatus().then(setStatus); }, []);

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
      const res = await aiRun.run(`rest/ai/${mode}`, body);
      if (res.billing) {
        setLastBilling(res.billing);
        setStatus(current => (current && current.balance ? { ...current, balance: { ...current.balance, outstandingMicro: res.billing.outstandingMicro } } : current));
      }
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
      if (err.stopped) {
        setMessage(t('aiStopped'));
        return;
      }
      const data = err.response && err.response.data;
      if (err.response && err.response.status === 402 && data && data.code === 'offer') {
        setOfferOpen(true);
        return;
      }
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

  const accept = async () => {
    await axios.post(getUrl('rest/ai/shared/accept'));
    setStatus(await fetchStatus());
    setOfferOpen(false);
    setOpen(true);
  };

  const onButtonClick = async () => {
    markSeen();
    setAttract(false);
    const fresh = await fetchStatus(); // keys or consent may have changed in another tab
    setStatus(fresh);
    if (!fresh.enabled) return;
    if (fresh.mode === 'offer') {
      setOfferOpen(true);
    } else {
      setOpen(!open);
    }
  };

  const canRun = !busy && (mode === 'correct' || ((mode === 'rewrite' || mode === 'responsive') && instruction.trim()) || (mode === 'generate' && brief.trim()));
  const tabButton = (key, label) => <button key={key} style={btnStyle(mode === key)} onClick={() => { setMode(key); setMessage(null); }}>{label}</button>;

  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <style>{ANIMATIONS}</style>
      <a onClick={onButtonClick} title={t('aiToolbarTitle')} style={robotButtonStyle(attract)}>
        <span style={{ display: 'inline-block', animation: attract ? 'aiWiggle 3s infinite' : 'none' }}><Icon icon="robot" /></span>
        {t('aiMenu')}
      </a>
      {offerOpen && status.mode === 'offer' && <OfferDialog status={status} onAccept={accept} onClose={() => setOfferOpen(false)} />}
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

          <AIProgress run={aiRun} />
          {message && <div className="mt-2">{message}</div>}
          <AIDebugButton run={aiRun} />
          {result && (result.subject || result.preheader) && (
            <div className="mt-2">
              {result.subject && <div><strong>{t('aiSuggestedSubject')}</strong> <input className="form-control form-control-sm" readOnly value={result.subject} onFocus={e => e.target.select()} /></div>}
              {result.preheader && <div className="mt-1"><strong>{t('aiPreheader')}</strong> <input className="form-control form-control-sm" readOnly value={result.preheader} onFocus={e => e.target.select()} /></div>}
            </div>
          )}
          {status.mode === 'shared' && status.balance && (
            <div className="mt-2 p-2" style={{ background: '#f5f3ff', borderRadius: 4, fontSize: 13 }}>
              <span className="badge bg-secondary me-1">{t('aiSharedBadge')}</span>
              <strong>{t('aiOutstanding', { amount: formatMicro(status.balance.outstandingMicro, status.prices.currency) })}</strong>
              {lastBilling && <div className="text-muted">{t('aiLastRequestCost', { amount: formatMicro(lastBilling.costMicro, status.prices.currency), input: formatNumber(lastBilling.inputTokens), output: formatNumber(lastBilling.outputTokens) })}</div>}
            </div>
          )}
          <AIDebugToggle run={aiRun} />
          <div className="text-muted mt-2" style={{ fontSize: 12 }}>{t('aiNotSavedNote')}</div>
        </div>
      )}
    </span>
  );
}
