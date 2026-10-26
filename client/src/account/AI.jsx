'use strict';

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '../lib/i18n';
import { Title } from '../lib/page';
import { useErrorHandling } from '../lib/hooks/useErrorHandling';
import { useRequiresAuthenticatedUser } from '../lib/hooks/useRequiresAuthenticatedUser';
import axios from '../lib/axios';
import { getUrl } from '../lib/urls';

const TIERS = [
    { key: 'basic', title: 'aiTierBasic', help: 'aiTierBasicHelp' },
    { key: 'medium', title: 'aiTierMedium', help: 'aiTierMediumHelp' },
    { key: 'high', title: 'aiTierHigh', help: 'aiTierHighHelp' }
];

const EMPTY = { protocol: 'openai', baseUrl: '', model: '', keyMode: 'failover', temperature: '', maxTokens: '' };

function TierCard({ tier, settings, model, reload }) {
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

    const save = () => run(() => axios.put(getUrl(`rest/ai/settings/${tier.key}`), { ...form, baseUrl: form.baseUrl || defaultUrl }));
    const remove = () => window.confirm(t('aiConfirmDelete')) && run(() => axios.delete(getUrl(`rest/ai/settings/${tier.key}`)));
    // Several keys can be pasted at once, separated by commas, spaces or line breaks: each one is created separately
    const pastedKeys = newKey.apiKey.split(/[\s,;]+/).filter(k => k.length > 0);
    const addKey = () => run(async () => {
        for (let i = 0; i < pastedKeys.length; i++) {
            const label = pastedKeys.length > 1 && newKey.label ? `${newKey.label} ${i + 1}` : newKey.label;
            await axios.post(getUrl(`rest/ai/settings/${tier.key}/keys`), { label, apiKey: pastedKeys[i] });
        }
        setNewKey({ label: '', apiKey: '' });
    });
    const removeKey = id => run(() => axios.delete(getUrl(`rest/ai/keys/${id}`)));
    const testConnection = async () => {
        setBusy(true);
        setTest(null);
        try { setTest((await axios.post(getUrl(`rest/ai/settings/${tier.key}/test`))).data); } catch (err) { handleError(err); } finally { setBusy(false); }
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

export default function AI() {
    const { t } = useTranslation();
    const { handleError } = useErrorHandling();
    useRequiresAuthenticatedUser();
    const [settings, setSettings] = useState(null);

    const reload = useCallback(async () => {
        try { setSettings((await axios.get(getUrl('rest/ai/settings'))).data); } catch (err) { handleError(err); }
    }, []);
    useEffect(() => { reload(); }, [reload]);

    if (!settings) return <div />;

    return (
        <div>
            <Title>{t('aiPageTitle')}</Title>
            {!settings.configured && <div className="alert alert-warning">{t('aiNotEnabled')}</div>}
            <p>{t('aiIntro')}</p>
            {TIERS.map(tier => <TierCard key={tier.key} tier={tier} settings={settings} model={settings.models[tier.key]} reload={reload} />)}
        </div>
    );
}
