'use strict';

import React, {useRef} from 'react';
import PropTypes from 'prop-types';
import {useTranslation} from '../lib/i18n';
import {Title} from '../lib/page';
import {Table} from '../lib/table';
import {getTriggerTypes} from '../campaigns/triggers/helpers';
import {Icon} from "../lib/bootstrap-components";
import mailtrainConfig from 'mailtrainConfig';
import {useTableActionDialog} from "../lib/modals";
import {useRequiresAuthenticatedUser} from '../lib/hooks/useRequiresAuthenticatedUser';

export default function List({ list }) {
    const { t } = useTranslation();
    useRequiresAuthenticatedUser();

    const tableRef = useRef(null);
    const { addDeleteButton, renderDialog } = useTableActionDialog(tableRef);

    const {entityLabels, eventLabels} = getTriggerTypes(t);

    const columns = [
        { data: 1, title: t('name') },
        { data: 2, title: t('description') },
        { data: 3, title: t('campaign') },
        { data: 4, title: t('entity'), render: data => entityLabels[data], searchable: false },
        { data: 5, title: t('event'), render: (data, cmd, rowData) => eventLabels[rowData[4]][data], searchable: false },
        { data: 6, title: t('daysAfter'), render: data => Math.round(data / (3600 * 24)) },
        { data: 7, title: t('enabled'), render: data => data ? t('yes') : t('no'), searchable: false},
        {
            actions: data => {
                const actions = [];
                const perms = data[9];
                const campaignId = data[8];

                if (mailtrainConfig.globalPermissions.setupAutomation && perms.includes('manageTriggers')) {
                    actions.push({
                        label: <Icon icon="edit" title={t('edit')}/>,
                        link: `/campaigns/${campaignId}/triggers/${data[0]}/edit`
                    });
                }

                if (perms.includes('manageTriggers')) {
                    addDeleteButton(actions, null, `rest/triggers/${campaignId}/${data[0]}`, data[1], t('deletingTrigger'), t('triggerDeleted'));
                }

                return actions;
            }
        }
    ];

    return (
        <div>
            {renderDialog()}
            <Title>{t('triggers')}</Title>

            <Table ref={tableRef} withHeader dataUrl={`rest/triggers-by-list-table/${list.id}`} columns={columns} />
        </div>
    );
}

List.propTypes = {
    list: PropTypes.object
};
