'use strict';

import React, {useRef} from 'react';
import {useTranslation} from '../lib/i18n';
import {Icon} from '../lib/bootstrap-components';
import {LinkButton, Title, Toolbar} from '../lib/page';
import {Table} from '../lib/table';
import {useTableActionDialog} from "../lib/modals";
import {useRequiresAuthenticatedUser} from '../lib/hooks/useRequiresAuthenticatedUser';
import "./styles.scss";
import PropTypes from 'prop-types';

export default function List({ permissions }) {
    const { t } = useTranslation();
    useRequiresAuthenticatedUser();

    const tableRef = useRef(null);
    const { addDeleteButton, renderDialog } = useTableActionDialog(tableRef);

    const createPermitted = permissions.createChannel;

    const columns = [
        {
            data: 1,
            title: t('name'),
            actions: data => {
                const perms = data[5];
                if (perms.includes('view')) {
                    return [{label: data[1], link: `/channels/${data[0]}/campaigns`}];
                } else {
                    return [{label: data[1]}];
                }
            }
        },
        { data: 2, title: t('id'), render: data => <code>{data}</code> },
        { data: 3, title: t('description') },
        { data: 4, title: t('namespace') },
        {
            className: "tblCol_buttons",
            actions: data => {
                const actions = [];
                const perms = data[5];

                if (perms.includes('view')) {
                    actions.push({
                        label: <Icon icon="inbox" title={t('campaigns')}/>,
                        link: `/channels/${data[0]}/campaigns`
                    });
                }

                if (perms.includes('view') || perms.includes('edit')) {
                    actions.push({
                        label: <Icon icon="edit" title={t('edit')}/>,
                        link: `/channels/${data[0]}/edit`
                    });
                }

                if (perms.includes('share')) {
                    actions.push({
                        label: <Icon icon="share" title={t('share')}/>,
                        link: `/channels/${data[0]}/share`
                    });
                }

                addDeleteButton(actions, perms, `rest/channels/${data[0]}`, data[1], t('deletingChannel'), t('channelDeleted'));

                return actions;
            }
        }
    ];

    return (
        <div>
            {renderDialog()}
            <Toolbar>
                {createPermitted &&
                    <LinkButton to="/channels/create" className="btn-primary" icon="plus" label={t('createChannel')}/>
                }
            </Toolbar>

            <Title>{t('channels')}</Title>

            <Table ref={tableRef} withHeader dataUrl="rest/channels-table" columns={columns} />
        </div>
    );
}

List.propTypes = {
    permissions: PropTypes.object
};
