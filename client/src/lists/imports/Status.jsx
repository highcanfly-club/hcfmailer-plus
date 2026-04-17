'use strict';

import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from '../../lib/i18n';
import { Title } from '../../lib/page';
import { AlignedRow, ButtonRow } from '../../lib/form';
import { useErrorHandling } from '../../lib/hooks/useErrorHandling';
import { useRequiresAuthenticatedUser } from '../../lib/hooks/useRequiresAuthenticatedUser';
import { getImportLabels } from './helpers';
import { prepFinishedAndNotInProgress, runInProgress, runStatusInProgress } from '../../../../shared/imports';
import { Table } from "../../lib/table";
import { Button, Icon } from "../../lib/bootstrap-components";
import axios from "../../lib/axios";
import { getUrl } from "../../lib/urls";
import moment from "moment";
import interoperableErrors from '../../../../shared/interoperable-errors';

export default function Status({ entity: entityProp, list }) {
    useRequiresAuthenticatedUser();
    const { t } = useTranslation();
    const { handleError } = useErrorHandling();

    const [entity, setEntity] = useState(entityProp);

    const { importSourceLabels, importStatusLabels, runStatusLabels } = getImportLabels(t);

    const refreshTimeoutHandlerRef = useRef(null);
    const refreshTimeoutIdRef = useRef(0);
    const runsTableNodeRef = useRef(null);

    async function refreshEntity() {
        try {
            const resp = await axios.get(getUrl(`rest/imports/${list.id}/${entityProp.id}`));
            setEntity(resp.data);
        } catch (e) {
            handleError(e);
        }
    }

    async function periodicRefreshTask() {
        await refreshEntity();
        if (refreshTimeoutHandlerRef.current) {
            refreshTimeoutIdRef.current = setTimeout(refreshTimeoutHandlerRef.current, 2000);
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

    async function startRunAsync() {
        try {
            await axios.post(getUrl(`rest/import-start/${list.id}/${entityProp.id}`));
        } catch (err) {
            if (err instanceof interoperableErrors.InvalidStateError) {
                // mask
            } else {
                handleError(err);
                return;
            }
        }

        await refreshEntity();

        if (runsTableNodeRef.current) {
            runsTableNodeRef.current.refresh();
        }
    }

    async function stopRunAsync() {
        try {
            await axios.post(getUrl(`rest/import-stop/${list.id}/${entityProp.id}`));
        } catch (err) {
            if (err instanceof interoperableErrors.InvalidStateError) {
                // mask
            } else {
                handleError(err);
                return;
            }
        }

        await refreshEntity();

        if (runsTableNodeRef.current) {
            runsTableNodeRef.current.refresh();
        }
    }

    const columns = [
        { data: 1, title: t('started'), render: data => moment(data).fromNow() },
        { data: 2, title: t('finished'), render: data => data ? moment(data).fromNow() : '' },
        { data: 3, title: t('status'), render: data => runStatusLabels[data], sortable: false, searchable: false },
        { data: 4, title: t('processed') },
        { data: 5, title: t('new') },
        { data: 6, title: t('failed') },
        {
            actions: data => {
                const actions = [];
                const status = data[3];

                let refreshTimeout;

                if (runStatusInProgress(status)) {
                    refreshTimeout = 1000;
                }

                actions.push({
                    label: <Icon icon="eye" title={t('runStatus')}/>,
                    link: `/lists/${list.id}/imports/${entityProp.id}/status/${data[0]}`
                });

                return { refreshTimeout, actions };
            }
        }
    ];

    return (
        <div>
            <Title>{t('importStatus')}</Title>

            <AlignedRow label={t('name')}>{entity.name}</AlignedRow>
            <AlignedRow label={t('source')}>{importSourceLabels[entity.source]}</AlignedRow>
            <AlignedRow label={t('status')}>{importStatusLabels[entity.status]}</AlignedRow>
            {entity.error && <AlignedRow label={t('error')}><pre>{entity.error}</pre></AlignedRow>}

            <ButtonRow label={t('actions')}>
                {prepFinishedAndNotInProgress(entity.status) && <Button className="btn-primary" icon="play" label={t('start')} onClickAsync={(...args) => startRunAsync(...args)}/>}
                {runInProgress(entity.status) && <Button className="btn-primary" icon="stop" label={t('stop')} onClickAsync={(...args) => stopRunAsync(...args)}/>}
            </ButtonRow>

            <hr/>
            <h3>{t('importRuns')}</h3>
            <Table ref={runsTableNodeRef} withHeader dataUrl={`rest/import-runs-table/${list.id}/${entityProp.id}`} columns={columns} />
        </div>
    );
}

Status.propTypes = {
    entity: PropTypes.object,
    list: PropTypes.object
};
