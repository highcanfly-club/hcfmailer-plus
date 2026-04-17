'use strict';

import React, {useRef} from 'react';
import {useTranslation} from '../lib/i18n';
import {LinkButton, Title, Toolbar} from '../lib/page';
import {Table} from '../lib/table';
import {Icon} from "../lib/bootstrap-components";
import {useTableActionDialog} from "../lib/modals";
import {useRequiresAuthenticatedUser} from '../lib/hooks/useRequiresAuthenticatedUser';
import PropTypes from 'prop-types';

export default function List({ permissions }) {
    const { t } = useTranslation();
    useRequiresAuthenticatedUser();

    const tableRef = useRef(null);
    const { addDeleteButton, renderDialog } = useTableActionDialog(tableRef);

    const createPermitted = permissions.createList;
    const customFormsPermitted = permissions.createCustomForm || permissions.viewCustomForm;

    const columns = [
        {
            data: 1,
            title: t('name'),
            actions: data => {
                const perms = data[7];
                if (perms.includes('viewSubscriptions')) {
                    return [{label: data[1], link: `/lists/${data[0]}/subscriptions`}];
                } else {
                    return [{label: data[1]}];
                }
            }
        },
        { data: 2, title: t('id'), render: data => <code>{data}</code> },
        { data: 3, title: t('subscribers') },
        { data: 4, title: t('description') },
        { data: 5, title: t('namespace') },
        {
            actions: data => {
                const actions = [];
                const triggersCount = data[6];
                const perms = data[7];

                if (perms.includes('viewSubscriptions')) {
                    actions.push({
                        label: <Icon icon="user" title="Subscribers"/>,
                        link: `/lists/${data[0]}/subscriptions`
                    });
                }

                if (perms.includes('edit')) {
                    actions.push({
                        label: <Icon icon="edit" title={t('edit')}/>,
                        link: `/lists/${data[0]}/edit`
                    });
                }

                if (perms.includes('viewFields')) {
                    actions.push({
                        label: <Icon icon="th-list" title={t('fields')}/>,
                        link: `/lists/${data[0]}/fields`
                    });
                }

                if (perms.includes('viewSegments')) {
                    actions.push({
                        label: <Icon icon="tags" title={t('segments')}/>,
                        link: `/lists/${data[0]}/segments`
                    });
                }

                if (perms.includes('viewImports')) {
                    actions.push({
                        label: <Icon icon="file-import" title={t('imports')}/>,
                        link: `/lists/${data[0]}/imports`
                    });
                }

                if (triggersCount > 0) {
                    actions.push({
                        label: <Icon icon="bell" title={t('triggers')}/>,
                        link: `/lists/${data[0]}/triggers`
                    });
                }

                if (perms.includes('share')) {
                    actions.push({
                        label: <Icon icon="share" title={t('share')}/>,
                        link: `/lists/${data[0]}/share`
                    });
                }

                addDeleteButton(actions, perms, `rest/lists/${data[0]}`, data[1], t('deletingList'), t('listDeleted'));

                return actions;
            }
        }
    ];

    return (
        <div>
            {renderDialog()}
            <Toolbar>
                { createPermitted &&
                    <LinkButton to="/lists/create" className="btn-primary" icon="plus" label={t('createList')}/>
                }
                { customFormsPermitted &&
                    <LinkButton to="/lists/forms" className="btn-primary" label={t('customForms-1')}/>
                }
            </Toolbar>

            <Title>{t('lists')}</Title>

            <Table ref={tableRef} withHeader dataUrl="rest/lists-table" columns={columns} />
        </div>
    );
}

List.propTypes = {
    permissions: PropTypes.object
};
