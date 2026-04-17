'use strict';

import React, { useRef } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from '../lib/i18n';
import { Title } from '../lib/page';
import { useRequiresAuthenticatedUser } from '../lib/hooks/useRequiresAuthenticatedUser';
import { Table } from "../lib/table";

export default function StatisticsLinkClicks({ entity, title }) {
    useRequiresAuthenticatedUser();
    const { t } = useTranslation();

    const tableRef = useRef(null);

    const linksColumns = [
        { data: 0, title: t('url'), render: data => <code>{data}</code> },
        { data: 1, title: t('uniqueVisitors') },
        { data: 2, title: t('totalClicks') }
    ];

    return (
        <div>
            <Title>{t('campaignLinks')}</Title>

            <Table ref={tableRef} withHeader dataUrl={`rest/campaigns-link-clicks-table/${entity.id}`} columns={linksColumns} />
        </div>
    );
}

StatisticsLinkClicks.propTypes = {
    entity: PropTypes.object,
    title: PropTypes.string
};
