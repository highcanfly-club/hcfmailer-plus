'use strict';

import React, {useRef} from 'react';
import PropTypes from 'prop-types';
import {useTranslation} from '../../lib/i18n';
import {LinkButton, Title, Toolbar} from '../../lib/page';
import {Table} from '../../lib/table';
import {Icon} from "../../lib/bootstrap-components";
import {useTableActionDialog} from "../../lib/modals";
import {useRequiresAuthenticatedUser} from '../../lib/hooks/useRequiresAuthenticatedUser';

export default function List({ list }) {
    const { t } = useTranslation();
    useRequiresAuthenticatedUser();

    const tableRef = useRef(null);
    const { addDeleteButton, renderDialog } = useTableActionDialog(tableRef);

    const columns = [
        { data: 1, title: t('name') },
        {
            actions: data => {
                const actions = [];

                if (list.permissions.includes('manageSegments')) {
                    actions.push({
                        label: <Icon icon="edit" title={t('edit')}/>,
                        link: `/lists/${list.id}/segments/${data[0]}/edit`
                    });

                    addDeleteButton(actions, null, `rest/segments/${list.id}/${data[0]}`, data[1], t('deletingSegment'), t('segmentDeleted'));
                }

                return actions;
            }
        }
    ];

    return (
        <div>
            {renderDialog()}
            {list.permissions.includes('manageSegments') &&
                <Toolbar>
                    <LinkButton to={`/lists/${list.id}/segments/create`} className="btn-primary" icon="plus" label={t('createSegment')}/>
                </Toolbar>
            }

            <Title>{t('segments')}</Title>

            <Table ref={tableRef} withHeader dataUrl={`rest/segments-table/${list.id}`} columns={columns} />
        </div>
    );
}

List.propTypes = {
    list: PropTypes.object
};
