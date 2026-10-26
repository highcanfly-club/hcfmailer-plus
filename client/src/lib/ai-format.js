'use strict';

import i18n from './i18n';

// Balances travel as micro-units (1e-6 of the currency) so that nothing is lost to rounding
export function formatMicro(micro, currency = 'EUR') {
    return formatMoney((micro || 0) / 1e6, currency);
}

export function formatMoney(amount, currency = 'EUR') {
    try {
        return new Intl.NumberFormat(i18n.language, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(amount);
    } catch (err) {
        return `${amount.toFixed(2)} ${currency}`;
    }
}

export function formatNumber(n) {
    return new Intl.NumberFormat(i18n.language).format(n || 0);
}

export function formatDate(value) {
    return value ? new Date(value).toLocaleString(i18n.language) : '';
}
