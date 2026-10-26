'use strict';

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from './axios';
import { useTranslation } from './i18n';
import { getUrl } from './urls';
import { Icon } from './bootstrap-components';
import { OfferDialog, fetchStatus } from './ai-toolbar';
import { formatMicro, formatNumber } from './ai-format';
import { useAIRun, AIProgress, AIDebugToggle, AIDebugButton } from './ai-run';

// Draft a campaign from a template or a past campaign. Two steps: brief + source, then a preview where every rewritten text
// can be kept or refused. Nothing is sent: the result is an idle campaign that the user reviews in the usual editor.
const BRAND_KEY = 'hcfmailer.ai.brand';
// The rewritten texts come from a model: they are shown as plain text, never injected as HTML into the application
const toText = html => new DOMParser().parseFromString(html, 'text/html').body.textContent;

const overlay = { position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(33,37,41,.75)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto' };
const dialog = { background: '#fff', color: '#212529', textAlign: 'left', borderRadius: 10, padding: 20, width: '100%', maxWidth: 1100, boxShadow: '0 8px 32px rgba(0,0,0,.4)' };

function Wizard({ status, onClose }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [sources, setSources] = useState(null);
  const [ref, setRef] = useState('');
  const [brief, setBrief] = useState('');
  const [brand, setBrand] = useState(() => { try { return window.localStorage.getItem(BRAND_KEY) || ''; } catch (e) { return ''; } });
  const [tier, setTier] = useState('');
  const [useTools, setUseTools] = useState(true);
  const aiRun = useAIRun();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [kept, setKept] = useState({});
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [created, setCreated] = useState(null);
  const [width, setWidth] = useState(600);

  useEffect(() => {
    axios.get(getUrl('rest/ai/draft/sources')).then(r => setSources(r.data)).catch(() => setSources({ templates: [], campaigns: [] }));
  }, []);

  const parsedRef = ref ? { type: ref.split(':')[0], id: Number(ref.split(':')[1]) } : null;
  const sourceName = () => {
    if (!sources || !parsedRef) return '';
    const list = parsedRef.type === 'template' ? sources.templates : sources.campaigns;
    return (list.find(s => s.id === parsedRef.id) || {}).name || '';
  };

  const fail = err => {
    if (err.stopped) {
      setError(t('aiStopped'));
      return;
    }
    const data = err.response && err.response.data;
    setError(t('aiErrorPrefix', { message: (data && data.message) || err.message }));
  };

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      try { window.localStorage.setItem(BRAND_KEY, brand); } catch (e) { /* storage unavailable */ }
      const res = await aiRun.run('rest/ai/draft/preview', { ref: parsedRef, brief, brand, tier: tier || undefined, useTools });
      setResult(res);
      setKept(Object.fromEntries(res.diff.map(d => [d.id, true])));
      setName(`[Brouillon IA] ${sourceName()}`);
      setSubject(res.subject || '');
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const replacements = Object.fromEntries(result.diff.filter(d => kept[d.id]).map(d => [d.id, d.after]));
      setCreated((await axios.post(getUrl('rest/ai/draft/create'), { ref: parsedRef, replacements, name, subject })).data);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const money = micro => formatMicro(micro, status.prices && status.prices.currency);
  const warnById = id => (result.warnings || []).filter(w => w.id === id).map(w => w.token);

  let body;
  if (created) {
    body = (
      <>
        <div className="alert alert-success">{t('aiDraftDone', { name: created.name })} {t('aiDraftNothingSent')}</div>
        <p>{created.listsKept > 0 ? t('aiDraftListsKept', { n: created.listsKept }) : t('aiDraftNoLists')}{created.listsSkipped > 0 ? ' ' + t('aiDraftListsSkipped', { n: created.listsSkipped }) : ''}</p>
        <button className="btn btn-primary me-2" onClick={() => { onClose(); navigate(`/campaigns/${created.campaignId}/edit`); }}>{t('aiDraftOpen')}</button>
        <button className="btn btn-link" onClick={onClose}>{t('aiPreviewClose')}</button>
      </>
    );
  } else if (result) {
    const totalKept = Object.values(kept).filter(Boolean).length;
    body = (
      <div className="row">
        <div className="col-lg-6">
          <div className="mb-2"><label className="form-label">{t('aiDraftName')}</label><input className="form-control" value={name} onChange={e => setName(e.target.value)} /></div>
          <div className="mb-3"><label className="form-label">{t('aiDraftSubject')}</label><input className="form-control" value={subject} onChange={e => setSubject(e.target.value)} /></div>
          {result.preheader && <p className="text-muted">{t('aiPreheader')} {result.preheader}</p>}
          {result.warnings.length > 0 && <div className="alert alert-warning">{t('aiDraftWarnings')} <strong>{[...new Set(result.warnings.map(w => w.token))].join(' · ')}</strong></div>}
          {result.research && result.research.length > 0 && (
            <p className="text-muted small">{t('aiDraftConsulted')} {result.research.map((r, i) => <span key={i}>{i > 0 && ' · '}{['search_sources', 'read_source', 'list_merge_tags', 'campaign_stats'].includes(r.tool) ? t('aiDraftTool_' + r.tool) : r.tool}{r.error ? ` (${t('aiDraftToolUnavailable')})` : ''}</span>)}</p>
          )}
          <AIDebugButton run={aiRun} />
          <p>{t('aiDraftChanges', { n: result.changed })}</p>
          <div style={{ maxHeight: 340, overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: 6 }}>
            {result.diff.map(d => (
              <label key={d.id} className="d-block p-2 border-bottom" style={{ cursor: 'pointer', background: warnById(d.id).length ? '#fff8e1' : undefined }}>
                <input type="checkbox" className="me-2" checked={!!kept[d.id]} onChange={e => setKept(k => ({ ...k, [d.id]: e.target.checked }))} />
                <span className="text-muted" style={{ textDecoration: 'line-through' }}>{toText(d.before)}</span>
                <br />
                <strong>{toText(d.after)}</strong>
              </label>
            ))}
          </div>
          {status.mode === 'shared' && result.billing && <p className="text-muted mt-2">{t('aiLastRequestCost', { amount: money(result.billing.costMicro), input: formatNumber(result.billing.inputTokens), output: formatNumber(result.billing.outputTokens) })} — {t('aiOutstanding', { amount: money(result.billing.outstandingMicro) })}</p>}
        </div>
        <div className="col-lg-6">
          <div className="mb-2">{[390, 600].map(w => <button key={w} className={'btn btn-sm me-1 ' + (width === w ? 'btn-primary' : 'btn-outline-secondary')} onClick={() => setWidth(w)}>{w}</button>)}</div>
          <div style={{ overflow: 'auto', border: '1px solid #dee2e6', borderRadius: 6, background: '#e9ecef', textAlign: 'center' }}>
            <iframe title={t('aiPreviewTitle')} sandbox="" srcDoc={result.previewHtml} style={{ width, maxWidth: '100%', height: 560, border: 0, background: '#fff' }} />
          </div>
        </div>
        <div className="col-12 mt-3">
          <button className="btn btn-primary me-2" disabled={busy || !totalKept || !name.trim()} onClick={create}>{busy ? t('aiDraftCreating') : t('aiDraftCreate')}</button>
          <button className="btn btn-outline-secondary me-2" disabled={busy} onClick={() => setResult(null)}>{t('aiDraftBack')}</button>
        </div>
      </div>
    );
  } else {
    const none = sources && sources.templates.length === 0 && sources.campaigns.length === 0;
    body = (
      <>
        <p>{t('aiDraftIntro')}</p>
        {none && <div className="alert alert-info">{t('aiDraftNoSources')}</div>}
        <div className="mb-3">
          <label className="form-label">{t('aiDraftSource')}</label>
          <select className="form-select" value={ref} onChange={e => setRef(e.target.value)} disabled={!sources}>
            <option value="">{t('aiDraftSourcePlaceholder')}</option>
            {sources && sources.templates.length > 0 && <optgroup label={t('aiDraftGroupTemplates')}>{sources.templates.map(s => <option key={'t' + s.id} value={`template:${s.id}`}>{s.name} ({s.editor})</option>)}</optgroup>}
            {sources && sources.campaigns.length > 0 && <optgroup label={t('aiDraftGroupCampaigns')}>{sources.campaigns.map(s => <option key={'c' + s.id} value={`campaign:${s.id}`}>{s.name} ({s.editor})</option>)}</optgroup>}
          </select>
        </div>
        <div className="mb-2">
          <label className="form-label">{t('aiDraftBrief')}</label>
          <textarea className="form-control" rows={5} placeholder={t('aiBriefPlaceholder')} value={brief} onChange={e => setBrief(e.target.value)} />
        </div>
        <div className="form-check mb-2">
          <input type="checkbox" className="form-check-input" id="ai-draft-tools" checked={useTools} onChange={e => setUseTools(e.target.checked)} />
          <label className="form-check-label" htmlFor="ai-draft-tools">{t('aiDraftUseTools')}</label>
        </div>
        <textarea className="form-control mb-3" rows={2} placeholder={t('aiBrandPlaceholder')} value={brand} onChange={e => setBrand(e.target.value)} />
        <div className="d-flex align-items-center">
          {Object.keys(status.tiers).length > 1 && (
            <select className="form-select me-2" style={{ width: 'auto' }} value={tier} onChange={e => setTier(e.target.value)} title={t('aiModelUsed')}>
              <option value="">{t('aiModelAuto')}</option>
              {Object.keys(status.tiers).map(k => <option key={k} value={k}>{t({ basic: 'aiTierBasic', medium: 'aiTierMedium', high: 'aiTierHigh' }[k])}</option>)}
            </select>
          )}
          <button className="btn btn-primary" disabled={busy || !parsedRef || !brief.trim()} onClick={generate}>{busy ? t('aiDraftGenerating') : t('aiDraftGenerate')}</button>
        </div>
        <AIProgress run={aiRun} />
        <AIDebugButton run={aiRun} />
        <div className="mt-2"><AIDebugToggle run={aiRun} /></div>
      </>
    );
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={dialog} onClick={e => e.stopPropagation()}>
        <div className="d-flex justify-content-between align-items-start">
          <h4><Icon icon="robot" /> {t('aiDraftTitle')}</h4>
          <button className="btn-close" aria-label={t('aiPreviewClose')} onClick={onClose} />
        </div>
        {error && <div className="alert alert-danger">{error}</div>}
        {body}
      </div>
    </div>
  );
}

// Button for the campaigns list: hidden when the user has no AI at all, opens the offer first when they have no key of their own
export function AIDraftButton() {
  const { t } = useTranslation();
  const [status, setStatus] = useState(null);
  const [open, setOpen] = useState(false);
  const [offer, setOffer] = useState(false);

  useEffect(() => { fetchStatus().then(setStatus); }, []);
  if (!status || !status.enabled) return null;

  const click = async () => {
    const fresh = await fetchStatus();
    setStatus(fresh);
    if (!fresh.enabled) return;
    if (fresh.mode === 'offer') setOffer(true);
    else setOpen(true);
  };
  const accept = async () => {
    await axios.post(getUrl('rest/ai/shared/accept'));
    setStatus(await fetchStatus());
    setOffer(false);
    setOpen(true);
  };

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={click}><Icon icon="robot" /> {t('aiDraftButton')}</button>
      {offer && status.mode === 'offer' && <OfferDialog status={status} onAccept={accept} onClose={() => setOffer(false)} />}
      {open && <Wizard status={status} onClose={() => setOpen(false)} />}
    </>
  );
}
