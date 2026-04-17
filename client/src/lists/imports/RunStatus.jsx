'use strict';

import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from '../../lib/i18n';
import { Title } from '../../lib/page';
import { AlignedRow } from '../../lib/form';
import { useErrorHandling } from '../../lib/hooks/useErrorHandling';
import { useRequiresAuthenticatedUser } from '../../lib/hooks/useRequiresAuthenticatedUser';
import { getImportLabels } from './helpers';
import axios from "../../lib/axios";
import { getUrl } from "../../lib/urls";
import moment from "moment";
import { runStatusInProgress } from "../../../../shared/imports";
import { Table } from "../../lib/table";

export default function RunStatus({ entity: entityProp, imprt, list }) {
    useRequiresAuthenticatedUser();
    const { t } = useTranslation();
    const { handleError } = useErrorHandling();

    const [entity, setEntity] = useState(entityProp);

    const { importSourceLabels, importStatusLabels, runStatusLabels } = getImportLabels(t);

    const refreshTimeoutHandlerRef = useRef(null);
    const refreshTimeoutIdRef = useRef(0);
    const failedTableNodeRef = useRef(null);

    async function refreshEntity() {
        try {
            const resp = await axios.get(getUrl(`rest/import-runs/${list.id}/${imprt.id}/${entityProp.id}`));
            setEntity(resp.data);

            if (failedTableNodeRef.current) {
                failedTableNodeRef.current.refresh();
            }
        } catch (e) {
            handleError(e);
        }
    }

    async function periodicRefreshTask() {
        if (runStatusInProgress(entity.status)) {
            await refreshEntity();
            if (refreshTimeoutHandlerRef.current) {
                refreshTimeoutIdRef.current = setTimeout(refreshTimeoutHandlerRef.current, 2000);
            }
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

    const columns = [
        { data: 1, title: t('row') },
        { data: 2, title: t('email') },
        { data: 3, title: t('reason'), render: data => t(...JSON.parse(data)) }
    ];

    return (
        <div>
            <Title>{t('importRunStatus')}</Title>

            <AlignedRow label={t('importName')}>{imprt.name}</AlignedRow>
            <AlignedRow label={t('importSource')}>{importSourceLabels[imprt.source]}</AlignedRow>
            <AlignedRow label={t('runStarted')}>{moment(entity.created).fromNow()}</AlignedRow>
            {entity.finished && <AlignedRow label={t('runFinished')}>{moment(entity.finished).fromNow()}</AlignedRow>}
            <AlignedRow label={t('runStatus')}>{runStatusLabels[entity.status]}</AlignedRow>
            <AlignedRow label={t('processedEntries')}>{entity.processed}</AlignedRow>
            <AlignedRow label={t('newEntries')}>{entity.new}</AlignedRow>
            <AlignedRow label={t('failedEntries')}>{entity.failed}</AlignedRow>
            {entity.error && <AlignedRow label={t('error')}><pre>{entity.error}</pre></AlignedRow>}

            <hr/>
            <h3>{t('failedRows')}</h3>
            <Table ref={failedTableNodeRef} withHeader dataUrl={`rest/import-run-failed-table/${list.id}/${imprt.id}/${entityProp.id}`} columns={columns} />
        </div>
    );
}

RunStatus.propTypes = {
    entity: PropTypes.object,
    imprt: PropTypes.object,
    list: PropTypes.object
};
