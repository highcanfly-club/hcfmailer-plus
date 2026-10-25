'use strict';

import React from 'react';
import Account from './Account';
import API from './API';
import AI from './AI';


function getMenus(t) {
    return {
        'account': {
            title: t('account'),
            link: '/account',
            panelComponent: Account,

            children: {
                api: {
                    title: t('api'),
                    link: '/account/api',
                    panelComponent: API
                },
                ai: {
                    title: 'IA',
                    link: '/account/ai',
                    panelComponent: AI
                }
            }
        }
    };
}

export default {
    getMenus
}
