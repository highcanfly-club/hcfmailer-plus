'use strict';

import React, {useRef} from "react";
import {useTranslation} from '../lib/i18n';
import {LinkButton, Title, Toolbar} from "../lib/page";
import {Table} from "../lib/table";
import mailtrainConfig from "mailtrainConfig";
import {Icon} from "../lib/bootstrap-components";
import {useTableActionDialog} from "../lib/modals";
import {useRequiresAuthenticatedUser} from '../lib/hooks/useRequiresAuthenticatedUser';

export default function List(props) {
    const { t } = useTranslation();
    useRequiresAuthenticatedUser();

    const tableRef = useRef(null);
    const { addDeleteButton, renderDialog } = useTableActionDialog(tableRef);

    // There are no permissions checks here because this page makes no sense for anyone who does not have manageUsers permission
    // Once someone has this permission, then all on this page can be used.

    const columns = [
        { data: 1, title: t("username") },
    ];

    if (mailtrainConfig.isAuthMethodLocal) {
        columns.push({ data: 2, title: t("fullName") });
    }

    columns.push({ data: 3, title: t("namespace") });
    columns.push({ data: 4, title: t("role") });

    columns.push({
        actions: data => {
            const actions = [];

            actions.push({
                label: <Icon icon="edit" title={t('edit')}/>,
                link: `/users/${data[0]}/edit`
            });

            actions.push({
                label: <Icon icon="share-square" title={t('share')}/>,
                link: `/users/${data[0]}/shares`
            });

            addDeleteButton(actions, null, `rest/users/${data[0]}`, data[1], t('deletingUser'), t('userDeleted'));

            return actions;
        }
    });

    return (
        <div>
            {renderDialog()}
            <Toolbar>
                <LinkButton to="/users/create" className="btn-primary" icon="plus" label={t('createUser')}/>
            </Toolbar>

            <Title>{t('users')}</Title>

            <Table ref={tableRef} withHeader dataUrl="rest/users-table" columns={columns} />
        </div>
    );
}
