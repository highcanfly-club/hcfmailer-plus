'use strict';

import React, {useRef} from 'react';
import {useTranslation} from '../../lib/i18n';
import {ButtonDropdown, Icon} from '../../lib/bootstrap-components';
import {DropdownLink, Title, Toolbar} from '../../lib/page';
import {Table} from '../../lib/table';
import moment from 'moment';
import mailtrainConfig from 'mailtrainConfig';
import {useTableActionDialog} from "../../lib/modals";
import {useRequiresAuthenticatedUser} from '../../lib/hooks/useRequiresAuthenticatedUser';
import PropTypes from 'prop-types';

export default function List({ permissions }) {
    const { t } = useTranslation();
    useRequiresAuthenticatedUser();

    const tableRef = useRef(null);
    const { addDeleteButton, renderDialog } = useTableActionDialog(tableRef);

    const createPermitted = permissions.createReportTemplate && mailtrainConfig.globalPermissions.createJavascriptWithROAccess;

    const columns = [
        { data: 1, title: t('name') },
        { data: 2, title: t('description') },
        { data: 3, title: t('created'), render: data => moment(data).fromNow() },
        { data: 4, title: t('namespace') },
        {
            actions: data => {
                const actions = [];
                const perms = data[5];

                if (mailtrainConfig.globalPermissions.createJavascriptWithROAccess && perms.includes('edit')) {
                    actions.push({
                        label: <Icon icon="edit" title={t('edit')}/>,
                        link: `/reports/templates/${data[0]}/edit`
                    });
                }

                if (perms.includes('share')) {
                    actions.push({
                        label: <Icon icon="share" title={t('share')}/>,
                        link: `/reports/templates/${data[0]}/share`
                    });
                }

                addDeleteButton(actions, perms, `rest/report-templates/${data[0]}`, data[1], t('deletingReportTemplate'), t('reportTemplateDeleted'));

                return actions;
            }
        }
    ];

    return (
        <div>
            {renderDialog()}
            {createPermitted &&
                <Toolbar>
                    <ButtonDropdown buttonClassName="btn-primary" menuClassName="dropdown-menu-right" label={t('createReportTemplate')}>
                        <DropdownLink to="/reports/templates/create">{t('blank')}</DropdownLink>
                        <DropdownLink to="/reports/templates/create/open-counts">{t('openCounts')}</DropdownLink>
                        <DropdownLink to="/reports/templates/create/open-counts-csv">{t('openCountsAsCsv')}</DropdownLink>
                        <DropdownLink to="/reports/templates/create/aggregated-open-counts">{t('aggregatedOpenCounts')}</DropdownLink>
                    </ButtonDropdown>
                </Toolbar>
            }

            <Title>{t('reportTemplates')}</Title>

            <Table ref={tableRef} withHeader dataUrl="rest/report-templates-table" columns={columns} />
        </div>
    );
}

List.propTypes = {
    permissions: PropTypes.object
};
