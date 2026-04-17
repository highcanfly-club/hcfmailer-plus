'use strict';

import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from '../lib/i18n';
import { Title } from '../lib/page';
import { useErrorHandling } from '../lib/hooks/useErrorHandling';
import { useRequiresAuthenticatedUser } from '../lib/hooks/useRequiresAuthenticatedUser';
import axios from "../lib/axios";
import { getUrl } from "../lib/urls";

import { Chart } from 'react-google-charts';

import "./styles.module.scss";
import { Table } from "../lib/table";
import { Link } from "react-router-dom";

import mailtrainConfig from "mailtrainConfig";

export default function StatisticsOpened({ entity: entityProp, statisticsOpened: statisticsOpenedProp, agg }) {
    useRequiresAuthenticatedUser();
    const { t } = useTranslation();
    const { handleError } = useErrorHandling();

    const [entity, setEntity] = useState(entityProp);
    const [statisticsOpened, setStatisticsOpened] = useState(statisticsOpenedProp);

    const refreshTimeoutHandlerRef = useRef(null);
    const refreshTimeoutIdRef = useRef(0);
    const tableRef = useRef(null);

    async function refreshEntity() {
        try {
            const resp1 = await axios.get(getUrl(`rest/campaigns-settings/${entityProp.id}`));
            setEntity(resp1.data);

            const resp2 = await axios.get(getUrl(`rest/campaign-statistics/${entityProp.id}/opened`));
            setStatisticsOpened(resp2.data);
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

    const stats = statisticsOpened;

    const subscribersColumns = [
        { data: 0, title: t('email') },
        { data: 1, title: t('subscriptionId'), render: data => <code>{data}</code> },
        { data: 2, title: t('listId'), render: data => <code>{data}</code> },
        { data: 3, title: t('list') },
        { data: 4, title: t('listNamespace') },
        { data: 5, title: t('opensCount') }
    ];

    const renderNavPill = (key, label) => (
        <li role="presentation" className={agg === key ? 'active' : ''}>
            <Link to={`/campaigns/${entity.id}/statistics/opened/${key}`}>{label}</Link>
        </li>
    );

    const navPills = (
        <ul className={`nav nav-pills ${"navPills"}`}>
            {renderNavPill('countries', t('countries'))}
            {renderNavPill('devices', t('devices'))}
        </ul>
    );


    let charts = null;

    const deviceTypes = {
        desktop: t('desktop'),
        tv: t('tv'),
        tablet: t('tablet'),
        phone: t('phone'),
        bot: t('bot'),
        car: t('car'),
        console: t('console')
    };

    if (agg === 'devices') {
        charts = (
            <div className={"charts"}>
                {navPills}
                <h4 className={"chartTitle"}>{t('distributionByDeviceType')}</h4>
                <Chart
                    width="100%"
                    height="380px"
                    chartType="PieChart"
                    loader={<div>{t('loadingChart')}</div>}
                    data={[
                        [t('deviceType'), t('count')],
                        ...stats.devices.map(entry => [deviceTypes[entry.key] || t('unknown'), entry.count])
                    ]}
                    options={{
                        chartArea: { left: "25%", top: 15, width: "100%", height: 350 },
                        tooltip: { showColorCode: true },
                        legend: { position: "right", alignment: "start", textStyle: { fontSize: 14 } }
                    }}
                />
            </div>
        );
    } else if (agg === 'countries') {
        charts = (
            <div className={"charts"}>
                {navPills}
                <h4 className={"sectionTitle"}>{t('distributionByCountry')}</h4>
                <div className="row">
                    <div className={`col-md-6 ${"chart"}`}>
                        <Chart
                            width="100%"
                            height="380px"
                            chartType="PieChart"
                            loader={<div>{t('loadingChart')}</div>}
                            data={[
                                [t('country'), t('count')],
                                ...stats.countries.map(entry => [entry.key || t('unknown'), entry.count])
                            ]}
                            options={{
                                chartArea: { left: "25%", top: 15, width: "100%", height: 350 },
                                tooltip: { showColorCode: true },
                                legend: { position: "right", alignment: "start", textStyle: { fontSize: 14 } }
                            }}
                        />
                    </div>
                    <div className={`col-md-6 ${"chart"}`}>
                        <Chart
                            width="100%"
                            height="380px"
                            chartType="GeoChart"
                            data={[
                                ['Country', 'Count'],
                                ...stats.countries.map(entry => [entry.key || t('unknown'), entry.count])
                            ]}
                            mapsApiKey={mailtrainConfig.mapsApiKey}
                        />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div>
            <Title>{t('detailedStatistics')}</Title>

            {charts}

            <hr/>

            <h4 className={"sectionTitle"}>{t('listOfSubscribersThatOpenedTheCampaign')}</h4>
            <Table ref={tableRef} withHeader dataUrl={`rest/campaigns-opens-table/${entity.id}`} columns={subscribersColumns} />
        </div>
    );
}

StatisticsOpened.propTypes = {
    entity: PropTypes.object,
    statisticsOpened: PropTypes.object,
    agg: PropTypes.string
};
