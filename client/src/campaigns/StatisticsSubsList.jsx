'use strict';

import React, { useRef } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from '../lib/i18n';
import { Title } from '../lib/page';
import { useRequiresAuthenticatedUser } from '../lib/hooks/useRequiresAuthenticatedUser';
import { Table } from "../lib/table";

export default function StatisticsSubsList({ entity, status, title }) {
    useRequiresAuthenticatedUser();
    const { t } = useTranslation();

    const tableRef = useRef(null);

    const subscribersColumns = [
        { data: 0, title: t('email') },
        { data: 1, title: t('subscriptionId'), render: data => <code>{data}</code> },
        { data: 2, title: t('listId'), render: data => <code>{data}</code> },
        { data: 3, title: t('list') },
        { data: 4, title: t('listNamespace') }
    ];

    return (
        <div>
            <Title>{title}</Title>

            <Table ref={tableRef} withHeader dataUrl={`rest/campaigns-subscribers-by-status-table/${entity.id}/${status}`} columns={subscribersColumns} />
        </div>
    );
}

StatisticsSubsList.propTypes = {
    entity: PropTypes.object,
    status: PropTypes.number,
    title: PropTypes.string
};
