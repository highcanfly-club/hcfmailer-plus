'use strict';

import React, {useRef} from 'react';
import {useTranslation} from '../lib/i18n';
import {Icon} from '../lib/bootstrap-components';
import {LinkButton, Title, Toolbar} from '../lib/page';
import {Table} from '../lib/table';
import moment from 'moment';
import {getMailerTypes} from './helpers';
import {useTableActionDialog} from "../lib/modals";
import {useRequiresAuthenticatedUser} from '../lib/hooks/useRequiresAuthenticatedUser';
import PropTypes from 'prop-types';

export default function List({ permissions }) {
    const { t } = useTranslation();
    useRequiresAuthenticatedUser();

    const tableRef = useRef(null);
    const { addDeleteButton, renderDialog } = useTableActionDialog(tableRef);

    const mailerTypes = getMailerTypes(t);
    const createPermitted = permissions.createSendConfiguration;

    const columns = [
        { data: 1, title: t('name') },
        { data: 2, title: t('id'), render: data => <code>{data}</code> },
        { data: 3, title: t('description') },
        { data: 4, title: t('type'), render: data => mailerTypes[data].typeName },
        { data: 5, title: t('created'), render: data => moment(data).fromNow() },
        { data: 6, title: t('namespace') },
        {
            actions: data => {
                const actions = [];
                const perms = data[7];

                if (perms.includes('edit')) {
                    actions.push({
                        label: <Icon icon="edit" title={t('edit')}/>,
                        link: `/send-configurations/${data[0]}/edit`
                    });
                }

                if (perms.includes('share')) {
                    actions.push({
                        label: <Icon icon="share" title={t('share')}/>,
                        link: `/send-configurations/${data[0]}/share`
                    });
                }

                addDeleteButton(actions, perms, `rest/send-configurations/${data[0]}`, data[1], t('deletingSendConfiguration'), t('sendConfigurationDeleted'));

                return actions;
            }
        }
    ];

    return (
        <div>
            {renderDialog()}
            {createPermitted &&
                <Toolbar>
                    <LinkButton to="/send-configurations/create" className="btn-primary" icon="plus" label={t('createSendConfiguration')}/>
                </Toolbar>
            }

            <Title>{t('sendConfigurations-1')}</Title>

            <Table ref={tableRef} withHeader dataUrl="rest/send-configurations-table" columns={columns} />
        </div>
    );
}

List.propTypes = {
    permissions: PropTypes.object
};
