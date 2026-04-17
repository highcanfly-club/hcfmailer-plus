'use strict';

import React, {useRef} from 'react';
import PropTypes from 'prop-types';
import {useTranslation} from '../../lib/i18n';
import {LinkButton, Title, Toolbar} from '../../lib/page';
import {Table} from '../../lib/table';
import {getTriggerTypes} from './helpers';
import {Icon} from "../../lib/bootstrap-components";
import mailtrainConfig from 'mailtrainConfig';
import {useTableActionDialog} from "../../lib/modals";
import {useRequiresAuthenticatedUser} from '../../lib/hooks/useRequiresAuthenticatedUser';

export default function List({ campaign }) {
    const { t } = useTranslation();
    useRequiresAuthenticatedUser();

    const tableRef = useRef(null);
    const { addDeleteButton, renderDialog } = useTableActionDialog(tableRef);

    const {entityLabels, eventLabels} = getTriggerTypes(t);

    const columns = [
        { data: 1, title: t('name') },
        { data: 2, title: t('description') },
        { data: 3, title: t('entity'), render: data => entityLabels[data], searchable: false },
        { data: 4, title: t('event'), render: (data, cmd, rowData) => eventLabels[rowData[3]][data], searchable: false },
        { data: 5, title: t('daysAfter'), render: data => Math.round(data / (3600 * 24)) },
        { data: 6, title: t('enabled'), render: data => data ? t('yes') : t('no'), searchable: false},
        {
            actions: data => {
                const actions = [];

                if (mailtrainConfig.globalPermissions.setupAutomation && campaign.permissions.includes('manageTriggers')) {
                    actions.push({
                        label: <Icon icon="edit" title={t('edit')}/>,
                        link: `/campaigns/${campaign.id}/triggers/${data[0]}/edit`
                    });
                }

                if (campaign.permissions.includes('manageTriggers')) {
                    addDeleteButton(actions, null, `rest/triggers/${campaign.id}/${data[0]}`, data[1], t('deletingTrigger'), t('triggerDeleted'));
                }

                return actions;
            }
        }
    ];

    return (
        <div>
            {renderDialog()}
            {mailtrainConfig.globalPermissions.setupAutomation && campaign.permissions.includes('manageTriggers') &&
                <Toolbar>
                    <LinkButton to={`/campaigns/${campaign.id}/triggers/create`} className="btn-primary" icon="plus" label={t('createTrigger')}/>
                </Toolbar>
            }

            <Title>{t('triggers')}</Title>

            <Table ref={tableRef} withHeader dataUrl={`rest/triggers-by-campaign-table/${campaign.id}`} columns={columns} />
        </div>
    );
}

List.propTypes = {
    campaign: PropTypes.object
};
