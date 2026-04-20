'use strict';

import React, {useRef} from 'react';
import PropTypes from 'prop-types';
import {useTranslation} from '../../lib/i18n';
import {LinkButton, Title, Toolbar} from '../../lib/page';
import {Table} from '../../lib/table';
import {getFieldTypes} from './helpers';
import {Icon} from "../../lib/bootstrap-components";
import {useTableActionDialog} from "../../lib/modals";
import {useRequiresAuthenticatedUser} from '../../lib/hooks/useRequiresAuthenticatedUser';

export default function List({ list }) {
    const { t } = useTranslation();
    useRequiresAuthenticatedUser();

    const tableRef = useRef(null);
    const { addDeleteButton, renderDialog } = useTableActionDialog(tableRef);

    const fieldTypes = getFieldTypes(t);

    const columns = [
        { data: 4, title: "#" },
        { data: 1, title: t('name'),
            render: (data, cmd, rowData) => rowData[5] !== null ? <span><Icon icon="dot-circle"/> {data}</span> : data
        },
        { data: 2, title: t('type'), render: data => fieldTypes[data].label, sortable: false, searchable: false },
        { data: 3, title: t('mergeTag') },
        {
            actions: data => {
                const actions = [];

                if (list.permissions.includes('manageFields')) {
                    actions.push({
                        label: <Icon icon="edit" title={t('edit')}/>,
                        link: `/lists/${list.id}/fields/${data[0]}/edit`
                    });

                    addDeleteButton(actions, null, `rest/fields/${list.id}/${data[0]}`, data[1], t('deletingField'), t('fieldDeleted'));
                }

                return actions;
            }
        }
    ];

    return (
        <div>
            {renderDialog()}
            {list.permissions.includes('manageFields') &&
                <Toolbar>
                    <LinkButton to={`/lists/${list.id}/fields/create`} className="btn-primary" icon="plus" label={t('createField')}/>
                </Toolbar>
            }

            <Title>{t('fields')}</Title>

            <Table ref={tableRef} withHeader dataUrl={`rest/fields-table/${list.id}`} columns={columns} />
        </div>
    );
}

List.propTypes = {
    list: PropTypes.object
};
