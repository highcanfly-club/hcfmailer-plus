'use strict';

import React, {useRef} from 'react';
import {useTranslation} from '../lib/i18n';
import {LinkButton, Title, Toolbar} from '../lib/page';
import {TreeTable} from '../lib/tree';
import {Icon} from "../lib/bootstrap-components";
import {useTableActionDialog} from "../lib/modals";
import {getGlobalNamespaceId} from "../../../shared/namespaces";
import {useRequiresAuthenticatedUser} from '../lib/hooks/useRequiresAuthenticatedUser';
import mailtrainConfig from 'mailtrainConfig';
import PropTypes from 'prop-types';

export default function List({ permissions }) {
    const { t } = useTranslation();
    useRequiresAuthenticatedUser();

    const tableRef = useRef(null);
    const { addDeleteButton, renderDialog } = useTableActionDialog(tableRef);

    const createPermitted = permissions.createNamespace;

    const actions = node => {
        const actions = [];

        if (node.data.permissions.includes('edit')) {
            actions.push({
                label: <Icon icon="edit" title={t('edit')}/>,
                link: `/namespaces/${node.key}/edit`
            });
        }

        if (node.data.permissions.includes('share')) {
            actions.push({
                label: <Icon icon="share" title={t('share')}/>,
                link: `/namespaces/${node.key}/share`
            });
        }

        const namespaceId = Number.parseInt(node.key);
        if (namespaceId !== getGlobalNamespaceId() && mailtrainConfig.user.namespace !== namespaceId) {
            addDeleteButton(actions, node.data.permissions, `rest/namespaces/${node.key}`, node.data.unsanitizedTitle, t('deletingNamespace'), t('namespaceDeleted'));
        }

        return actions;
    };

    return (
        <div>
            {renderDialog()}
            {createPermitted &&
                <Toolbar>
                    <LinkButton to="/namespaces/create" className="btn-primary" icon="plus" label={t('createNamespace')}/>
                </Toolbar>
            }

            <Title>{t('namespaces')}</Title>

            <TreeTable ref={tableRef} withHeader withDescription dataUrl="rest/namespaces-tree" actions={actions} />
        </div>
    );
}

List.propTypes = {
    permissions: PropTypes.object
};
