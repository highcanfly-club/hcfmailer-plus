'use strict';

import React, { useState } from 'react';
import { useTranslation } from '../lib/i18n';
import { languages } from './api-snippets';

export default function CodeExamples({ method, url, query, form, token }) {
    const { t } = useTranslation();
    const [active, setActive] = useState(languages[0].id);
    const [copied, setCopied] = useState(false);

    const language = languages.find(l => l.id === active);
    const code = language.generate({ method, url, query, form, token });

    async function copy() {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error(err);
        }
    }

    return (
        <div className="code-examples mb-3">
            <ul className="code-tabs">
                {languages.map(l => (
                    <li key={l.id}>
                        <button type="button" className={'code-tab' + (l.id === active ? ' is-active' : '')} onClick={() => setActive(l.id)}>{l.label}</button>
                    </li>
                ))}
                <li className="ms-auto">
                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={copy}>
                        <i className={'fas ' + (copied ? 'fa-check' : 'fa-copy')}/> {copied ? t('copied') : t('copy')}
                    </button>
                </li>
            </ul>
            <pre className="mt-0">{code}</pre>
        </div>
    );
}
