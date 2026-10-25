'use strict';

import React, { useState, useEffect, useCallback } from 'react';
import { Title } from '../lib/page';
import { useErrorHandling } from '../lib/hooks/useErrorHandling';
import { useRequiresAuthenticatedUser } from '../lib/hooks/useRequiresAuthenticatedUser';
import axios from '../lib/axios';
import { getUrl } from '../lib/urls';

const TIERS = [
    { key: 'basic', title: 'Basique', help: 'Corrections d’orthographe et de grammaire : un modèle rapide et économique suffit.' },
    { key: 'medium', title: 'Intermédiaire', help: 'Réécriture et changement de ton.' },
    { key: 'high', title: 'Avancé', help: 'Génération d’une newsletter complète : le modèle le plus capable.' }
];

const EMPTY = { protocol: 'openai', baseUrl: '', model: '', keyMode: 'failover', temperature: '', maxTokens: '' };

function TierCard({ tier, settings, model, reload }) {
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
    const remove = () => window.confirm('Supprimer ce modèle et ses clés ?') && run(() => axios.delete(getUrl(`rest/ai/settings/${tier.key}`)));
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
                <h4 className="card-title">{tier.title} {model && model.keys.length > 0 && <span className="badge bg-success">actif</span>}</h4>
                <p className="text-muted">{tier.help}</p>

                <div className="row g-2 mb-2">
                    <div className="col-md-3">
                        <label className="form-label">Protocole</label>
                        <select className="form-select" value={form.protocol} onChange={e => changeProtocol(e.target.value)}>
                            {settings.protocols.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                    <div className="col-md-5">
                        <label className="form-label">URL de base</label>
                        <input className="form-control" value={form.baseUrl} placeholder={defaultUrl} onChange={e => set('baseUrl', e.target.value)} />
                    </div>
                    <div className="col-md-4">
                        <label className="form-label">Modèle</label>
                        <input className="form-control" value={form.model} placeholder="ex. claude-sonnet-5-5" onChange={e => set('model', e.target.value)} />
                    </div>
                </div>
                <div className="row g-2 mb-3">
                    <div className="col-md-4">
                        <label className="form-label">Utilisation des clés</label>
                        <select className="form-select" value={form.keyMode} onChange={e => set('keyMode', e.target.value)}>
                            <option value="failover">Basculement (la suivante en cas d’erreur)</option>
                            <option value="roundrobin">Tourniquet (une clé différente à chaque requête)</option>
                        </select>
                    </div>
                    <div className="col-md-4">
                        <label className="form-label">Température (optionnel)</label>
                        <input className="form-control" type="number" step="0.1" min="0" max="2" value={form.temperature} onChange={e => set('temperature', e.target.value)} />
                    </div>
                    <div className="col-md-4">
                        <label className="form-label">Jetons de sortie max. (optionnel)</label>
                        <input className="form-control" type="number" min="256" value={form.maxTokens} onChange={e => set('maxTokens', e.target.value)} />
                    </div>
                </div>

                <div className="mb-3">
                    <button className="btn btn-primary me-2" disabled={busy || !form.model} onClick={save}>Enregistrer</button>
                    {model && <button className="btn btn-outline-danger me-2" disabled={busy} onClick={remove}>Supprimer</button>}
                    {model && model.keys.length > 0 && <button className="btn btn-outline-secondary" disabled={busy} onClick={testConnection}>Tester la connexion</button>}
                    {test && <span className={'ms-3 ' + (test.ok ? 'text-success' : 'text-danger')}>{test.ok ? 'Connexion réussie' : test.message}</span>}
                </div>

                {model && (
                    <>
                        <h5>Clés d’API</h5>
                        {model.keys.length === 0 && <p className="text-muted">Aucune clé : sans clé, les fonctions IA restent masquées dans les éditeurs.</p>}
                        <ul className="list-group mb-2">
                            {model.keys.map(k => (
                                <li key={k.id} className="list-group-item d-flex justify-content-between align-items-center">
                                    <span>
                                        {k.label || 'Clé'} <code>…{k.last4}</code>
                                        <small className="text-muted ms-2">{k.uses} requête(s){k.failures ? `, ${k.failures} erreur(s)` : ''}</small>
                                        {k.cooling && <span className="badge bg-warning text-dark ms-2">en pause</span>}
                                    </span>
                                    <button className="btn btn-sm btn-outline-danger" disabled={busy} onClick={() => removeKey(k.id)}>Retirer</button>
                                </li>
                            ))}
                        </ul>
                        <div className="row g-2">
                            <div className="col-md-3"><input className="form-control" placeholder="Nom (optionnel)" value={newKey.label} onChange={e => setNewKey(k => ({ ...k, label: e.target.value }))} /></div>
                            <div className="col-md-6"><input className="form-control" type="password" autoComplete="off" placeholder="Clé d’API (plusieurs : séparées par des virgules)" value={newKey.apiKey} onChange={e => setNewKey(k => ({ ...k, apiKey: e.target.value }))} /></div>
                            <div className="col-md-3"><button className="btn btn-outline-primary" disabled={busy || pastedKeys.length === 0 || pastedKeys.some(k => k.length < 8)} onClick={addKey}>{pastedKeys.length > 1 ? `Ajouter les ${pastedKeys.length} clés` : 'Ajouter la clé'}</button></div>
                        </div>
                    </>
                )}
                {!model && <p className="text-muted">Enregistrez d’abord le modèle, puis ajoutez ses clés.</p>}
            </div>
        </div>
    );
}

export default function AI() {
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
            <Title>Intelligence artificielle</Title>
            {!settings.configured && (
                <div className="alert alert-warning">L’IA n’est pas activée sur ce serveur : l’administrateur doit définir la variable <code>AI_ENCRYPTION_KEY</code>.</div>
            )}
            <p>
                Utilisez votre propre compte chez un fournisseur d’IA (Anthropic, OpenAI, Mistral, OpenRouter…). Vos clés sont chiffrées sur le serveur, ne sont jamais réaffichées
                et ne servent qu’à vos propres requêtes. Les boutons IA n’apparaissent dans les éditeurs que lorsqu’au moins un modèle a une clé.
            </p>
            {TIERS.map(tier => <TierCard key={tier.key} tier={tier} settings={settings} model={settings.models[tier.key]} reload={reload} />)}
        </div>
    );
}
