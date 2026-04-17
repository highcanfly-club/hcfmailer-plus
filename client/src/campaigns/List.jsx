'use strict';

import React, {useRef, useMemo} from 'react';
import {useTranslation} from '../lib/i18n';
import {ButtonDropdown, Icon} from '../lib/bootstrap-components';
import {DropdownLink, LinkButton, Title, Toolbar} from '../lib/page';
import {useRequiresAuthenticatedUser} from '../lib/hooks/useRequiresAuthenticatedUser';
import {useErrorHandling} from '../lib/hooks/useErrorHandling';
import {Table} from '../lib/table';
import moment from 'moment';
import {CampaignSource, CampaignStatus, CampaignType} from "../../../shared/campaigns";
import {getCampaignLabels} from "./helpers";
import {useTableActionDialog} from "../lib/modals";
import "./styles.scss";
import PropTypes from 'prop-types';

export default function List({ permissions, channel }) {
    const { t } = useTranslation();
    const { handleError } = useErrorHandling();
    useRequiresAuthenticatedUser();

    const tableRef = useRef(null);
    const { addDeleteButton, renderDialog } = useTableActionDialog(tableRef);

    const { campaignTypeLabels, campaignStatusLabels } = useMemo(() => getCampaignLabels(t), [t]);

    const createPermitted = permissions.createCampaign && (!channel || channel.permissions.includes('createCampaign'));

    const columns = [];
    columns.push({
        data: 1,
        title: t('name'),
        actions: data => {
            const perms = data[10];
            if (perms.includes('view')) {
                return [{label: data[1], link: `/campaigns/${data[0]}/status`}];
            } else {
                return [{label: data[1]}];
            }
        }
    });

    columns.push({ data: 2, title: t('id'), render: data => <code>{data}</code>, className: "tblCol_id" });
    columns.push({ data: 3, title: t('description') });
    columns.push({ data: 4, title: t('type'), render: data => campaignTypeLabels[data] });

    if (!channel) {
        columns.push({ data: 5, title: t('channel') });
    }

    columns.push({
        data: 6,
        title: t('status'),
        render: (data, display, rowData) => {
            if (data === CampaignStatus.SCHEDULED) {
                const scheduled = rowData[7];
                if (scheduled && new Date(scheduled) > new Date()) {
                    return t('sendingScheduled');
                } else {
                    return t('sending');
                }
            } else {
                return campaignStatusLabels[data];
            }
        }
    });
    columns.push({ data: 9, title: t('created'), render: data => moment(data).fromNow() });
    columns.push({ data: 10, title: t('namespace') });
    columns.push({
        className: "tblCol_buttons",
        actions: data => {
            const actions = [];
            const perms = data[11];
            const campaignType = data[4];
            const campaignSource = data[8];

            if (perms.includes('view')) {
                actions.push({
                    label: <Icon icon="envelope" title={t('status')}/>,
                    link: `/campaigns/${data[0]}/status`
                });
            }

            if (perms.includes('viewStats')) {
                actions.push({
                    label: <Icon icon="signal" title={t('statistics')}/>,
                    link: `/campaigns/${data[0]}/statistics`
                });
            }

            if (perms.includes('view') || perms.includes('edit')) {
                actions.push({
                    label: <Icon icon="edit" title={t('edit')}/>,
                    link: `/campaigns/${data[0]}/edit`
                });
            }

            if (perms.includes('edit') && (campaignSource === CampaignSource.CUSTOM || campaignSource === CampaignSource.CUSTOM_FROM_TEMPLATE || campaignSource === CampaignSource.CUSTOM_FROM_CAMPAIGN)) {
                actions.push({
                    label: <Icon icon="align-center" title={t('content')}/>,
                    link: `/campaigns/${data[0]}/content`
                });
            }

            if (perms.includes('viewFiles') && (campaignSource === CampaignSource.CUSTOM || campaignSource === CampaignSource.CUSTOM_FROM_TEMPLATE || campaignSource === CampaignSource.CUSTOM_FROM_CAMPAIGN)) {
                actions.push({
                    label: <Icon icon="hdd" title={t('files')}/>,
                    link: `/campaigns/${data[0]}/files`
                });
            }

            if (perms.includes('viewAttachments')) {
                actions.push({
                    label: <Icon icon="paperclip" title={t('attachments')}/>,
                    link: `/campaigns/${data[0]}/attachments`
                });
            }

            if (campaignType === CampaignType.TRIGGERED && perms.includes('viewTriggers')) {
                actions.push({
                    label: <Icon icon="bell" title={t('triggers')}/>,
                    link: `/campaigns/${data[0]}/triggers`
                });
            }

            if (perms.includes('share')) {
                actions.push({
                    label: <Icon icon="share" title={t('share')}/>,
                    link: `/campaigns/${data[0]}/share`
                });
            }

            addDeleteButton(actions, perms, `rest/campaigns/${data[0]}`, data[1], t('deletingCampaign'), t('campaignDeleted'));

            return actions;
        }
    });

    let createButton = null;

    if (createPermitted) {
        if (channel) {
            createButton = (
                <>
                    <LinkButton to={`/channels/${channel.id}/clone`} className="btn-primary" icon="clone" label={t('cloneCampaign')}/>
                    <LinkButton to={`/channels/${channel.id}/create`} className="btn-primary" icon="plus" label={t('createCampaign')}/>
                </>
            );
        } else {
            createButton = (
                <>
                    <LinkButton to={`/campaigns/clone`} className="btn-primary" icon="clone" label={t('cloneCampaign')}/>
                    <ButtonDropdown buttonClassName="btn-primary" menuClassName="dropdown-menu-right" icon="plus" label={t('createCampaign')}>
                        <DropdownLink to="/campaigns/create-regular">{t('regular')}</DropdownLink>
                        <DropdownLink to="/campaigns/create-rss">{t('rss')}</DropdownLink>
                        <DropdownLink to="/campaigns/create-triggered">{t('triggered')}</DropdownLink>
                    </ButtonDropdown>
                </>
            );
        }
    }

    return (
        <div>
            {renderDialog()}
            <Toolbar>
                {createButton}
            </Toolbar>

            <Title>{t('campaigns')}</Title>

            {channel ?
                <Table ref={tableRef} withHeader dataUrl={`rest/campaigns-by-channel-table/${channel.id}`} columns={columns} order={[5, 'desc']} />
            :
                <Table ref={tableRef} withHeader dataUrl="rest/campaigns-table" columns={columns} order={[6, 'desc']} />
            }
        </div>
    );
}

List.propTypes = {
    permissions: PropTypes.object,
    channel: PropTypes.object
};
