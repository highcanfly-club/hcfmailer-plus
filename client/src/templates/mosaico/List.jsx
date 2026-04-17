'use strict';

import React, {useRef} from 'react';
import {useTranslation} from '../../lib/i18n';
import {ButtonDropdown, Icon} from '../../lib/bootstrap-components';
import {DropdownLink, Title, Toolbar} from '../../lib/page';
import {Table} from '../../lib/table';
import moment from 'moment';
import {getTemplateTypes} from './helpers';
import {getTagLanguages} from '../helpers';
import {useTableActionDialog} from "../../lib/modals";
import {useRequiresAuthenticatedUser} from '../../lib/hooks/useRequiresAuthenticatedUser';
import PropTypes from 'prop-types';

export default function List({ permissions }) {
    const { t } = useTranslation();
    useRequiresAuthenticatedUser();

    const tableRef = useRef(null);
    const { addDeleteButton, renderDialog } = useTableActionDialog(tableRef);

    const templateTypes = getTemplateTypes(t);
    const tagLanguages = getTagLanguages(t);

    const createPermitted = permissions.createMosaicoTemplate;

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
                        link: `/templates/mosaico/${data[0]}/edit`
                    });
                }

                if (perms.includes('viewFiles')) {
                    actions.push({
                        label: <Icon icon="hdd" title={t('files')}/>,
                        link: `/templates/mosaico/${data[0]}/files`
                    });
                }

                if (perms.includes('viewFiles')) {
                    actions.push({
                        label: <Icon icon="th-large" title={t('blockThumbnails')}/>,
                        link: `/templates/mosaico/${data[0]}/blocks`
                    });
                }

                if (perms.includes('share')) {
                    actions.push({
                        label: <Icon icon="share" title={t('share')}/>,
                        link: `/templates/mosaico/${data[0]}/share`
                    });
                }

                addDeleteButton(actions, perms, `rest/mosaico-templates/${data[0]}`, data[1], t('deletingMosaicoTemplate'), t('mosaicoTemplateDeleted'));

                return actions;
            }
        }
    ];

    return (
        <div>
            {renderDialog()}
            {createPermitted &&
                <Toolbar>
                    <ButtonDropdown buttonClassName="btn-primary" menuClassName="dropdown-menu-right" label={t('createMosaicoTemplate')}>
                        <DropdownLink to="/templates/mosaico/create">{t('blank')}</DropdownLink>
                        <DropdownLink to="/templates/mosaico/create/versafix">{t('versafixOne')}</DropdownLink>
                        <DropdownLink to="/templates/mosaico/create/mjml-sample">{t('mjmlSample')}</DropdownLink>
                    </ButtonDropdown>
                </Toolbar>
            }

            <Title>{t('mosaicoTemplates')}</Title>

            <Table ref={tableRef} withHeader dataUrl="rest/mosaico-templates-table" columns={columns} />
        </div>
    );
}

List.propTypes = {
    permissions: PropTypes.object
};
