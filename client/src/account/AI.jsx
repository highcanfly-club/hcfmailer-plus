'use strict';

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '../lib/i18n';
import { Title } from '../lib/page';
import { useErrorHandling } from '../lib/hooks/useErrorHandling';
import { useRequiresAuthenticatedUser } from '../lib/hooks/useRequiresAuthenticatedUser';
import axios from '../lib/axios';
import { getUrl } from '../lib/urls';
import mailtrainConfig from 'mailtrainConfig';
import { formatMicro, formatMoney, formatNumber, formatDate } from '../lib/ai-format';

const TIERS = [
    { key: 'basic', title: 'aiTierBasic', help: 'aiTierBasicHelp' },
    { key: 'medium', title: 'aiTierMedium', help: 'aiTierMediumHelp' },
    { key: 'high', title: 'aiTierHigh', help: 'aiTierHighHelp' }
];

const EMPTY = { protocol: 'openai', baseUrl: '', model: '', keyMode: 'failover', temperature: '', maxTokens: '' };

function TierCard({ tier, settings, model, reload, apiBase = 'rest/ai' }) {
    const { t } = useTranslation();
    const { handleError } = useErrorHandling();
    const [form, setForm] = useState(EMPTY);
    const [newKey, setNewKey] = useState({ label: '', apiKey: '' });
    const [busy, setBusy] = useState(false);
    const [test, setTest] = useState(null);

    useEffect(() => {
        setForm(model ? { protocol: model.protocol, baseUrl: model.baseUrl, model: model.model, keyMode: model.keyMode, temperature: model.temperature ?? '', maxTokens: model.maxTokens ?? '' } : EMPTY);
        setTest(null);
    }, [model]);

    const set = (field, value) => setForm(f => ({ ...f, [field]: value }));
    const run = async fn => {
        setBusy(true);
        try { await fn(); await reload(); } catch (err) { handleError(err); } finally { setBusy(false); }
    };

    const defaultUrl = settings.defaultBaseUrls[form.protocol];
    const changeProtocol = protocol => {
        // follow the provider's default URL as long as the user did not type their own
        const wasDefault = !form.baseUrl || form.baseUrl === settings.defaultBaseUrls[form.protocol];
        setForm(f => ({ ...f, protocol, baseUrl: wasDefault ? settings.defaultBaseUrls[protocol] : f.baseUrl }));
    };

    const save = () => run(() => axios.put(getUrl(`${apiBase}/settings/${tier.key}`), { ...form, baseUrl: form.baseUrl || defaultUrl }));
    const remove = () => window.confirm(t('aiConfirmDelete')) && run(() => axios.delete(getUrl(`${apiBase}/settings/${tier.key}`)));
    // Several keys can be pasted at once, separated by commas, spaces or line breaks: each one is created separately
    const pastedKeys = newKey.apiKey.split(/[\s,;]+/).filter(k => k.length > 0);
    const addKey = () => run(async () => {
        for (let i = 0; i < pastedKeys.length; i++) {
            const label = pastedKeys.length > 1 && newKey.label ? `${newKey.label} ${i + 1}` : newKey.label;
            await axios.post(getUrl(`${apiBase}/settings/${tier.key}/keys`), { label, apiKey: pastedKeys[i] });
        }
        setNewKey({ label: '', apiKey: '' });
    });
    const removeKey = id => run(() => axios.delete(getUrl(`${apiBase}/keys/${id}`)));
    const testConnection = async () => {
        setBusy(true);
        setTest(null);
        try { setTest((await axios.post(getUrl(`${apiBase}/settings/${tier.key}/test`))).data); } catch (err) { handleError(err); } finally { setBusy(false); }
    };

    return (
        <div className="card mb-3">
            <div className="card-body">
                <h4 className="card-title">{t(tier.title)} {model && model.keys.length > 0 && <span className="badge bg-success">{t('aiActive')}</span>}</h4>
                <p className="text-muted">{t(tier.help)}</p>

                <div className="row g-2 mb-2">
                    <div className="col-md-3">
                        <label className="form-label">{t('aiProtocol')}</label>
                        <select className="form-select" value={form.protocol} onChange={e => changeProtocol(e.target.value)}>
                            {settings.protocols.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                    <div className="col-md-5">
                        <label className="form-label">{t('aiBaseUrl')}</label>
                        <input className="form-control" value={form.baseUrl} placeholder={defaultUrl} onChange={e => set('baseUrl', e.target.value)} />
                    </div>
                    <div className="col-md-4">
                        <label className="form-label">{t('aiModel')}</label>
                        <input className="form-control" value={form.model} placeholder={t('aiModelPlaceholder')} onChange={e => set('model', e.target.value)} />
                    </div>
                </div>
                <div className="row g-2 mb-3">
                    <div className="col-md-5">
                        <label className="form-label">{t('aiKeyUsage')}</label>
                        <select className="form-select" value={form.keyMode} onChange={e => set('keyMode', e.target.value)}>
                            <option value="failover">{t('aiKeyModeFailover')}</option>
                            <option value="roundrobin">{t('aiKeyModeRoundrobin')}</option>
                        </select>
                    </div>
                    <div className="col-md-3">
                        <label className="form-label">{t('aiTemperature')}</label>
                        <input className="form-control" type="number" step="0.1" min="0" max="2" value={form.temperature} onChange={e => set('temperature', e.target.value)} />
                    </div>
                    <div className="col-md-4">
                        <label className="form-label">{t('aiMaxTokens')}</label>
                        <input className="form-control" type="number" min="256" value={form.maxTokens} onChange={e => set('maxTokens', e.target.value)} />
                    </div>
                </div>

                <div className="mb-3">
                    <button className="btn btn-primary me-2" disabled={busy || !form.model} onClick={save}>{t('aiSave')}</button>
                    {model && <button className="btn btn-outline-danger me-2" disabled={busy} onClick={remove}>{t('aiDelete')}</button>}
                    {model && model.keys.length > 0 && <button className="btn btn-outline-secondary" disabled={busy} onClick={testConnection}>{t('aiTestConnection')}</button>}
                    {test && <span className={'ms-3 ' + (test.ok ? 'text-success' : 'text-danger')}>{test.ok ? t('aiConnectionOk') : test.message}</span>}
                </div>

                {model && (
                    <>
                        <h5>{t('aiApiKeys')}</h5>
                        {model.keys.length === 0 && <p className="text-muted">{t('aiNoKeys')}</p>}
                        <ul className="list-group mb-2">
                            {model.keys.map(k => (
                                <li key={k.id} className="list-group-item d-flex justify-content-between align-items-center">
                                    <span>
                                        {k.label || t('aiKeyDefaultLabel')} <code>…{k.last4}</code>
                                        <small className="text-muted ms-2">{t('aiRequests', { n: k.uses })}{k.failures ? `, ${t('aiErrors', { n: k.failures })}` : ''}</small>
                                        {k.cooling && <span className="badge bg-warning text-dark ms-2">{t('aiPaused')}</span>}
                                    </span>
                                    <button className="btn btn-sm btn-outline-danger" disabled={busy} onClick={() => removeKey(k.id)}>{t('aiRemove')}</button>
                                </li>
                            ))}
                        </ul>
                        <div className="row g-2">
                            <div className="col-md-3"><input className="form-control" placeholder={t('aiKeyLabelPlaceholder')} value={newKey.label} onChange={e => setNewKey(k => ({ ...k, label: e.target.value }))} /></div>
                            <div className="col-md-6"><input className="form-control" type="password" autoComplete="off" placeholder={t('aiKeyPlaceholder')} value={newKey.apiKey} onChange={e => setNewKey(k => ({ ...k, apiKey: e.target.value }))} /></div>
                            <div className="col-md-3"><button className="btn btn-outline-primary" disabled={busy || pastedKeys.length === 0 || pastedKeys.some(k => k.length < 8)} onClick={addKey}>{pastedKeys.length > 1 ? t('aiAddKeys', { n: pastedKeys.length }) : t('aiAddKey')}</button></div>
                        </div>
                    </>
                )}
                {!model && <p className="text-muted">{t('aiSaveModelFirst')}</p>}
            </div>
        </div>
    );
}

// The administrator's AI offered to users without their own key: consent, prices, and the user's running balance
function SharedAICard({ billing, reload }) {
    const { t } = useTranslation();
    const { handleError } = useErrorHandling();
    const [busy, setBusy] = useState(false);
    const { prices, balance } = billing;

    const run = async fn => {
        setBusy(true);
        try { await fn(); await reload(); } catch (err) { handleError(err); } finally { setBusy(false); }
    };

    return (
        <div className="card mb-3 border-primary">
            <div className="card-body">
                <h4 className="card-title">{t('aiSharedTitle')} {billing.accepted && <span className="badge bg-success">{t('aiActive')}</span>}</h4>
                <p>{t('aiSharedIntro')}</p>
                <ul>
                    <li>{t('aiPriceInput', { price: formatMoney(prices.in, prices.currency) })}</li>
                    <li>{t('aiPriceOutput', { price: formatMoney(prices.out, prices.currency) })}</li>
                    {prices.maxOutstanding > 0 && <li>{t('aiOfferLimit', { amount: formatMoney(prices.maxOutstanding, prices.currency) })}</li>}
                </ul>
                <p className="text-muted">{billing.accepted ? t('aiSharedAccepted') : t('aiSharedNotAccepted')} {t('aiSharedByokNote')}</p>
                {billing.accepted
                    ? <button className="btn btn-outline-secondary me-2" disabled={busy} onClick={() => run(() => axios.post(getUrl('rest/ai/shared/decline')))}>{t('aiSharedStop')}</button>
                    : <button className="btn btn-primary me-2" disabled={busy} onClick={() => run(() => axios.post(getUrl('rest/ai/shared/accept')))}>{t('aiSharedAccept')}</button>}

                <h5 className="mt-4">{t('aiBalanceTitle')}</h5>
                {balance.requests === 0
                    ? <p className="text-muted">{t('aiBalanceZero')}</p>
                    : (
                        <p>
                            <strong>{t('aiBalanceAmount', { amount: formatMicro(balance.outstandingMicro, prices.currency) })}</strong>
                            {' '}<span className="text-muted">({t('aiBalanceDetail', { requests: formatNumber(balance.requests), input: formatNumber(balance.inputTokens), output: formatNumber(balance.outputTokens) })}, {t('aiBalanceSince', { date: formatDate(balance.since) })})</span>
                        </p>
                    )}

                {billing.usage.length > 0 && (
                    <>
                        <h6>{t('aiUsageHistory')}</h6>
                        <table className="table table-sm">
                            <thead><tr><th>{t('aiUsageColDate')}</th><th>{t('aiUsageColAction')}</th><th>{t('aiUsageColTokens')}</th><th>{t('aiUsageColCost')}</th></tr></thead>
                            <tbody>
                                {billing.usage.map((u, i) => (
                                    <tr key={i} className={u.settled ? 'text-muted' : ''}>
                                        <td>{formatDate(u.created)}</td>
                                        <td>{t(ACTION_LABELS[u.action] || 'aiTabCorrect')}</td>
                                        <td>{formatNumber(u.inputTokens)} / {formatNumber(u.outputTokens)}{u.estimated ? ' ~' : ''}</td>
                                        <td>{formatMicro(u.costMicro, prices.currency)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </>
                )}
                {billing.settlements.length > 0 && (
                    <>
                        <h6>{t('aiSettlementsTitle')}</h6>
                        <ul>{billing.settlements.map((s, i) => <li key={i}>{formatDate(s.created)} — {formatMicro(s.amountMicro, prices.currency)} ({t('aiRequests', { n: s.requests })})</li>)}</ul>
                    </>
                )}
            </div>
        </div>
    );
}

// Administrator: the shared models and keys, the prices, and who owes what (with the "bill paid" reset)
function AdminSection() {
    const { t } = useTranslation();
    const { handleError } = useErrorHandling();
    const [settings, setSettings] = useState(null);
    const [pricing, setPricing] = useState(null);
    const [billing, setBilling] = useState(null);
    const [saved, setSaved] = useState(false);

    const reload = useCallback(async () => {
        try {
            const [s, p, b] = await Promise.all([axios.get(getUrl('rest/ai/admin/settings')), axios.get(getUrl('rest/ai/admin/pricing')), axios.get(getUrl('rest/ai/admin/billing'))]);
            setSettings(s.data);
            setPricing(p.data);
            setBilling(b.data);
        } catch (err) {
            if (!(err.response && err.response.status === 403)) handleError(err);
        }
    }, []);
    useEffect(() => { reload(); }, [reload]);

    if (!settings || !pricing || !billing) return null;

    const savePricing = async () => {
        try {
            await axios.put(getUrl('rest/ai/admin/pricing'), pricing);
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
            await reload();
        } catch (err) { handleError(err); }
    };
    const settle = async row => {
        if (!window.confirm(t('aiConfirmSettle', { user: row.username, amount: formatMicro(row.outstandingMicro, pricing.currency) }))) return;
        try { await axios.post(getUrl(`rest/ai/admin/billing/${row.userId}/settle`)); await reload(); } catch (err) { handleError(err); }
    };
    const setPrice = (field, value) => setPricing(p => ({ ...p, [field]: value }));

    return (
        <div className="border-top pt-4 mt-4">
            <h3>{t('aiAdminTitle')}</h3>
            <p>{t('aiAdminIntro')}</p>

            <div className="card mb-3">
                <div className="card-body">
                    <h5 className="card-title">{t('aiPricingTitle')}</h5>
                    <div className="row g-2">
                        <div className="col-md-4"><label className="form-label">{t('aiPriceInLabel')} ({pricing.currency})</label><input className="form-control" type="number" min="0" step="0.01" value={pricing.priceIn} onChange={e => setPrice('priceIn', e.target.value)} /></div>
                        <div className="col-md-4"><label className="form-label">{t('aiPriceOutLabel')} ({pricing.currency})</label><input className="form-control" type="number" min="0" step="0.01" value={pricing.priceOut} onChange={e => setPrice('priceOut', e.target.value)} /></div>
                        <div className="col-md-4"><label className="form-label">{t('aiMaxOutstandingLabel')}</label><input className="form-control" type="number" min="0" step="1" value={pricing.maxOutstanding} onChange={e => setPrice('maxOutstanding', e.target.value)} /></div>
                    </div>
                    <button className="btn btn-primary mt-3" onClick={savePricing}>{t('aiSave')}</button>
                    {saved && <span className="ms-3 text-success">{t('aiPricingSaved')}</span>}
                </div>
            </div>

            <div className="card mb-3">
                <div className="card-body">
                    <h5 className="card-title">{t('aiBillingTitle')}</h5>
                    {billing.balances.length === 0
                        ? <p className="text-muted">{t('aiBillingEmpty')}</p>
                        : (
                            <table className="table table-sm">
                                <thead><tr><th>{t('aiColUser')}</th><th>{t('aiColOutstanding')}</th><th>{t('aiColRequests')}</th><th>{t('aiUsageColTokens')}</th><th>{t('aiColSince')}</th><th /></tr></thead>
                                <tbody>
                                    {billing.balances.map(row => (
                                        <tr key={row.userId}>
                                            <td>{row.username}</td>
                                            <td><strong>{formatMicro(row.outstandingMicro, pricing.currency)}</strong></td>
                                            <td>{formatNumber(row.requests)}</td>
                                            <td>{formatNumber(row.inputTokens)} / {formatNumber(row.outputTokens)}</td>
                                            <td>{formatDate(row.since)}</td>
                                            <td><button className="btn btn-sm btn-outline-success" onClick={() => settle(row)}>{t('aiMarkPaid')}</button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    {billing.settlements.length > 0 && (
                        <>
                            <h6 className="mt-3">{t('aiSettlementsTitle')}</h6>
                            <ul>{billing.settlements.slice(0, 10).map(s => <li key={s.id}>{formatDate(s.created)} — {s.username}: {formatMicro(s.amountMicro, pricing.currency)} ({t('aiRequests', { n: s.requests })})</li>)}</ul>
                        </>
                    )}
                </div>
            </div>

            {TIERS.map(tier => <TierCard key={tier.key} tier={tier} settings={settings} model={settings.models[tier.key]} reload={reload} apiBase="rest/ai/admin" />)}
        </div>
    );
}

const ACTION_LABELS = { correct: 'aiTabCorrect', rewrite: 'aiTabRewrite', generate: 'aiTabGenerate', responsive: 'aiTabMobile' };

export default function AI() {
    const { t } = useTranslation();
    const { handleError } = useErrorHandling();
    useRequiresAuthenticatedUser();
    const [settings, setSettings] = useState(null);
    const [billing, setBilling] = useState(null);

    const reload = useCallback(async () => {
        try {
            const [s, b] = await Promise.all([axios.get(getUrl('rest/ai/settings')), axios.get(getUrl('rest/ai/billing'))]);
            setSettings(s.data);
            setBilling(b.data);
        } catch (err) { handleError(err); }
    }, []);
    useEffect(() => { reload(); }, [reload]);

    if (!settings || !billing) return <div />;

    return (
        <div>
            <Title>{t('aiPageTitle')}</Title>
            {!settings.configured && <div className="alert alert-warning">{t('aiNotEnabled')}</div>}
            <p>{t('aiIntro')}</p>
            {(billing.sharedAvailable || billing.accepted || billing.balance.requests > 0) && <SharedAICard billing={billing} reload={reload} />}
            {TIERS.map(tier => <TierCard key={tier.key} tier={tier} settings={settings} model={settings.models[tier.key]} reload={reload} />)}
            {mailtrainConfig.globalPermissions && mailtrainConfig.globalPermissions.manageSettings && <AdminSection />}
        </div>
    );
}
