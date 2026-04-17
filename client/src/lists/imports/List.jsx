'use strict';

import React, {useRef} from 'react';
import PropTypes from 'prop-types';
import {useTranslation} from '../../lib/i18n';
import {LinkButton, Title, Toolbar} from '../../lib/page';
import {Table} from '../../lib/table';
import {getImportLabels} from './helpers';
import {Icon} from "../../lib/bootstrap-components";
import mailtrainConfig from 'mailtrainConfig';
import moment from "moment";
import {inProgress} from '../../../../shared/imports';
import {useTableActionDialog} from "../../lib/modals";
import {useRequiresAuthenticatedUser} from '../../lib/hooks/useRequiresAuthenticatedUser';

export default function List({ list }) {
    const { t } = useTranslation();
    useRequiresAuthenticatedUser();

    const tableRef = useRef(null);
    const { addDeleteButton, renderDialog } = useTableActionDialog(tableRef);

    const {importSourceLabels, importStatusLabels} = getImportLabels(t);

    const columns = [
        { data: 1, title: t('name') },
        { data: 2, title: t('description') },
        { data: 3, title: t('source'), render: data => importSourceLabels[data], sortable: false, searchable: false },
        { data: 4, title: t('status'), render: data => importStatusLabels[data], sortable: false, searchable: false },
        { data: 5, title: t('lastRun'), render: data => data ? moment(data).fromNow() : t('never') },
        {
            actions: data => {
                const actions = [];
                const status = data[4];

                let refreshTimeout;

                if (inProgress(status)) {
                    refreshTimeout = 1000;
                }

                if (mailtrainConfig.globalPermissions.setupAutomation && list.permissions.includes('manageImports')) {
                    actions.push({
                        label: <Icon icon="edit" title={t('edit')}/>,
                        link: `/lists/${list.id}/imports/${data[0]}/edit`
                    });
                }

                actions.push({
                    label: <Icon icon="eye" title={t('detailedStatus')}/>,
                    link: `/lists/${list.id}/imports/${data[0]}/status`
                });

                if (list.permissions.includes('manageImports')) {
                    addDeleteButton(actions, null, `rest/imports/${list.id}/${data[0]}`, data[1], t('deletingImport'), t('importDeleted'));
                }

                return { refreshTimeout, actions };
            }
        }
    ];

    return (
        <div>
            {renderDialog()}
            {mailtrainConfig.globalPermissions.setupAutomation && list.permissions.includes('manageImports') &&
                <Toolbar>
                    <LinkButton to={`/lists/${list.id}/imports/create`} className="btn-primary" icon="plus" label={t('createImport')}/>
                </Toolbar>
            }

            <Title>{t('imports')}</Title>

            <Table ref={tableRef} withHeader dataUrl={`rest/imports-table/${list.id}`} columns={columns} />
        </div>
    );
}

List.propTypes = {
    list: PropTypes.object
};
