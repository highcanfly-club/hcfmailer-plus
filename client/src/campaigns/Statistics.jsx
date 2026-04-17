'use strict';

import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from '../lib/i18n';
import { Trans } from 'react-i18next';
import { Title } from '../lib/page';
import { useErrorHandling } from '../lib/hooks/useErrorHandling';
import { useRequiresAuthenticatedUser } from '../lib/hooks/useRequiresAuthenticatedUser';
import axios from "../lib/axios";
import { getUrl } from "../lib/urls";
import { AlignedRow } from "../lib/form";
import { Icon } from "../lib/bootstrap-components";

import "./styles.scss";
import { Link } from "react-router-dom";

export default function Statistics({ entity: entityProp }) {
    useRequiresAuthenticatedUser();
    const { t } = useTranslation();
    const { handleError } = useErrorHandling();

    const [entity, setEntity] = useState(entityProp);

    const refreshTimeoutHandlerRef = useRef(null);
    const refreshTimeoutIdRef = useRef(0);

    async function refreshEntity() {
        try {
            const resp = await axios.get(getUrl(`rest/campaigns-stats/${entityProp.id}`));
            setEntity(resp.data);
        } catch (e) {
            handleError(e);
        }
    }

    async function periodicRefreshTask() {
        await refreshEntity();
        if (refreshTimeoutHandlerRef.current) {
            refreshTimeoutIdRef.current = setTimeout(refreshTimeoutHandlerRef.current, 60000);
        }
    }

    useEffect(() => {
        refreshTimeoutHandlerRef.current = periodicRefreshTask;
        periodicRefreshTask();

        return () => {
            clearTimeout(refreshTimeoutIdRef.current);
            refreshTimeoutHandlerRef.current = null;
        };
    }, []);

    const total = entity.total;

    const renderMetrics = (key, label, showZoomIn = true) => {
        const val = entity[key];

        return (
            <AlignedRow label={label}><span className={"statsMetrics"}>{val}</span>{showZoomIn && <span className={"zoomIn"}><Link to={`/campaigns/${entity.id}/statistics/${key}`}><Icon icon="search-plus"/></Link></span>}</AlignedRow>
        );
    };

    const renderMetricsWithProgress = (key, label, progressBarClass, showZoomIn = true) => {
        const val = entity[key];

        if (!total) {
            return renderMetrics(key, label);
        }

        const rate = Math.round(val / total * 100);

        return (
            <AlignedRow label={label}>
                {showZoomIn && <span className={"statsProgressBarZoomIn"}><Link to={`/campaigns/${entity.id}/statistics/${key}`}><Icon icon="search-plus"/></Link></span>}
                <div className={`progress ${"statsProgressBar"}`}>
                    <div
                        className={`progress-bar progress-bar-${progressBarClass}`}
                        role="progressbar"
                        style={{ minWidth: '6em', width: rate + '%' }}>
                        {val}&nbsp;({rate}%)
                    </div>
                </div>
            </AlignedRow>
        );
    };

    return (
        <div>
            <Title>{t('campaignStatistics')}</Title>

            {renderMetrics('total', t('total'), false)}
            {renderMetrics('delivered', t('delivered'))}
            {renderMetrics('blacklisted', t('blacklisted'), false)}
            {renderMetricsWithProgress('bounced', t('bounced'), 'info')}
            {renderMetricsWithProgress('complained', t('complaints'), 'danger')}
            {renderMetricsWithProgress('unsubscribed', t('unsubscribed'), 'warning')}
            {!entity.open_tracking_disabled && renderMetricsWithProgress('opened', t('opened'), 'success')}
            {!entity.click_tracking_disabled && renderMetricsWithProgress('clicks', t('clicked'), 'success')}

            <hr/>

            <h3>{t('quickReports')}</h3>
            <small className="text-muted"><Trans i18nKey="belowYouCanDownloadPremadeReportsRelated">{t('statsInfo')} <Link to="/reports">{t('report_plural')}</Link> {t('functionnalityOfProduct')}.</Trans></small>
            <ul className="list-unstyled my-3">
                <li><a href={getUrl(`quick-rpts/open-and-click-counts/${entity.id}`)}>{t('clickPerSubscriber')}</a></li>
            </ul>
        </div>
    );
}

Statistics.propTypes = {
    entity: PropTypes.object
};
