'use strict';

import React, {useRef} from 'react';
import {useTranslation} from '../lib/i18n';
import {Icon} from '../lib/bootstrap-components';
import {LinkButton, Title, Toolbar} from '../lib/page';
import {Table} from '../lib/table';
import moment from 'moment';
import {getTagLanguages, getTemplateTypes} from './helpers';
import {useTableActionDialog} from "../lib/modals";
import {useRequiresAuthenticatedUser} from '../lib/hooks/useRequiresAuthenticatedUser';
import PropTypes from 'prop-types';

export default function List({ permissions }) {
    const { t } = useTranslation();
    useRequiresAuthenticatedUser();

    const tableRef = useRef(null);
    const { addDeleteButton, renderDialog } = useTableActionDialog(tableRef);

    const templateTypes = getTemplateTypes(t);
    const tagLanguages = getTagLanguages(t);

    const createPermitted = permissions.createTemplate;
    const mosaicoTemplatesPermitted = permissions.createMosaicoTemplate || permissions.viewMosaicoTemplate;

    const columns = [
        { data: 1, title: t('name') },
        { data: 2, title: t('description') },
        { data: 3, title: t('type'), render: data => templateTypes[data].typeName },
        { data: 4, title: t('tagLanguage'), render: data => tagLanguages[data].name },
        { data: 5, title: t('created'), render: data => moment(data).fromNow() },
        { data: 6, title: t('namespace') },
        {
            actions: data => {
                const actions = [];
                const perms = data[7];

                if (perms.includes('view') || perms.includes('edit')) {
                    actions.push({
                        label: <Icon icon="edit" title={t('edit')}/>,
                        link: `/templates/${data[0]}/edit`
                    });
                }

                if (perms.includes('viewFiles')) {
                    actions.push({
                        label: <Icon icon="hdd" title={t('files')}/>,
                        link: `/templates/${data[0]}/files`
                    });
                }

                if (perms.includes('share')) {
                    actions.push({
                        label: <Icon icon="share" title={t('share')}/>,
                        link: `/templates/${data[0]}/share`
                    });
                }

                addDeleteButton(actions, perms, `rest/templates/${data[0]}`, data[1], t('deletingTemplate'), t('templateDeleted'));

                return actions;
            }
        }
    ];

    return (
        <div>
            {renderDialog()}
            <Toolbar>
                {createPermitted &&
                   <LinkButton to="/templates/create" className="btn-primary" icon="plus" label={t('createTemplate')}/>
                }
                {mosaicoTemplatesPermitted &&
                    <LinkButton to="/templates/mosaico" className="btn-primary" label={t('mosaicoTemplates')}/>
                }
            </Toolbar>

            <Title>{t('templates')}</Title>

            <Table ref={tableRef} withHeader dataUrl="rest/templates-table" columns={columns} />
        </div>
    );
}

List.propTypes = {
    permissions: PropTypes.object
};
