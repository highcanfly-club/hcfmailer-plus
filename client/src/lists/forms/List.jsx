'use strict';

import React, {useRef} from 'react';
import {useTranslation} from '../../lib/i18n';
import {LinkButton, Title, Toolbar} from '../../lib/page';
import {Table} from '../../lib/table';
import {Icon} from "../../lib/bootstrap-components";
import {useTableActionDialog} from "../../lib/modals";
import {useRequiresAuthenticatedUser} from '../../lib/hooks/useRequiresAuthenticatedUser';
import PropTypes from 'prop-types';

export default function List({ permissions }) {
    const { t } = useTranslation();
    useRequiresAuthenticatedUser();

    const tableRef = useRef(null);
    const { addDeleteButton, renderDialog } = useTableActionDialog(tableRef);

    const createPermitted = permissions.createCustomForm;

    const columns = [
        { data: 1, title: t('name') },
        { data: 2, title: t('description') },
        { data: 3, title: t('namespace') },
        {
            actions: data => {
                const actions = [];
                const perms = data[4];

                if (perms.includes('edit')) {
                    actions.push({
                        label: <Icon icon="edit" title={t('edit')}/>,
                        link: `/lists/forms/${data[0]}/edit`
                    });
                }
                if (perms.includes('share')) {
                    actions.push({
                        label: <Icon icon="share" title={t('share')}/>,
                        link: `/lists/forms/${data[0]}/share`
                    });
                }

                addDeleteButton(actions, perms, `rest/forms/${data[0]}`, data[1], t('deletingForm'), t('formDeleted'));

                return actions;
            }
        }
    ];

    return (
        <div>
            {renderDialog()}
            {createPermitted &&
                <Toolbar>
                    <LinkButton to="/lists/forms/create" className="btn-primary" icon="plus" label={t('createCustomForm')}/>
                </Toolbar>
            }

            <Title>{t('forms')}</Title>

            <Table ref={tableRef} withHeader dataUrl="rest/forms-table" columns={columns} />
        </div>
    );
}

List.propTypes = {
    permissions: PropTypes.object
};
