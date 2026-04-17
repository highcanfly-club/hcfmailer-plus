'use strict';

import React from 'react';
import { useTranslation } from './lib/i18n';
import { useRequiresAuthenticatedUser } from './lib/hooks/useRequiresAuthenticatedUser';
import mailtrainConfig from 'mailtrainConfig';

export default function Home() {
    useRequiresAuthenticatedUser();
    const { t } = useTranslation();

    return (
        <div>
            <h2>{t('mailtrain2')}</h2>
            <div>{t('build') + ' __BUILD_DATE__'}</div>
            <p>{mailtrainConfig.shoutout}</p>
        </div>
    );
}
