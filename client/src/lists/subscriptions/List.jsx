'use strict';

import React, {useRef} from 'react';
import PropTypes from 'prop-types';
import {useTranslation} from '../../lib/i18n';
import {LinkButton, Title, Toolbar} from '../../lib/page';
import {Table} from '../../lib/table';
import {SubscriptionStatus} from '../../../../shared/lists';
import moment from 'moment';
import {Button, Icon} from "../../lib/bootstrap-components";
import {HTTPMethod} from '../../lib/axios';
import {getFieldTypes, getSubscriptionStatusLabels} from './helpers';
import {getPublicUrl, getUrl} from "../../lib/urls";
import {useTableActionDialog} from "../../lib/modals";
import {useRequiresAuthenticatedUser} from '../../lib/hooks/useRequiresAuthenticatedUser';
import {usePageHelpers} from '../../lib/hooks/usePageHelpers';
import "../styles.module.scss";

export default function List({ list, segments, segmentId }) {
    const { t } = useTranslation();
    useRequiresAuthenticatedUser();
    const { navigateTo } = usePageHelpers();

    const tableRef = useRef(null);
    const { addDeleteButton, addRestActionButton, renderDialog } = useTableActionDialog(tableRef);

    const subscriptionStatusLabels = getSubscriptionStatusLabels(t);
    const fieldTypes = getFieldTypes(t);

    function handleSegmentChange(evt) {
        const value = evt.target.value;
        navigateTo(`/lists/${list.id}/subscriptions` + (value ? '?segment=' + value : ''));
    }

    const columns = [
        { data: 1, title: t('id'), render: data => <code>{data}</code> },
        { data: 2, title: t('email'), render: data => data === null ? <span className="erased">{t('erased')}</span> : data },
        { data: 3, title: t('status'), render: (data, display, rowData) => subscriptionStatusLabels[data] + (rowData[5] ? ', ' + t('blacklisted') : '') },
        { data: 4, title: t('created'), render: data => data ? moment(data).fromNow() : '' }
    ];

    let colIdx = 6;

    for (const fld of list.listFields) {
        const indexable = fieldTypes[fld.type].indexable;

        columns.push({
            data: colIdx,
            title: fld.name,
            sortable: indexable,
            searchable: indexable
        });

        colIdx += 1;
    }

    if (list.permissions.includes('manageSubscriptions')) {
        columns.push({
            actions: data => {
                const actions = [];
                const id = data[0];
                const email = data[2];
                const status = data[3];

                actions.push({
                    label: <Icon icon="edit" title={t('edit')}/>,
                    link: `/lists/${list.id}/subscriptions/${id}/edit`
                });

                if (email && status === SubscriptionStatus.SUBSCRIBED) {
                    addRestActionButton(
                        actions,
                        { method: HTTPMethod.POST, url: `rest/subscriptions-unsubscribe/${list.id}/${id}`},
                        { icon: 'power-off', label: t('unsubscribe') },
                        t('confirmUnsubscription'),
                        t('areYouSureYouWantToUnsubscribeEmail?', {email}),
                        t('unsubscribingEmail', {email}),
                        t('emailUnsubscribed', {email}),
                        null
                    );
                }

                if (email && !data[5]) {
                    addRestActionButton(
                        actions,
                        { method: HTTPMethod.POST, url: `rest/blacklist`, data: {email} },
                        { icon: 'ban', label: t('blacklist') },
                        t('confirmEmailBlacklisting'),
                        t('areYouSureYouWantToBlacklistEmail?', {email}),
                        t('blacklistingEmail', {email}),
                        t('emailBlacklisted', {email}),
                        null
                    );
                }

                addDeleteButton(actions, null, `rest/subscriptions/${list.id}/${id}`, email, t('deletingSubscription'), t('subscriptionDeleted'));

                return actions;
            }
        });
    }

    let dataUrl = 'rest/subscriptions-table/' + list.id;
    if (segmentId) {
        dataUrl += '/' + segmentId;
    }

    return (
        <div>
            {renderDialog()}
            <Toolbar>
                <a href={getPublicUrl(`subscription/${list.cid}`, {withLocale: true})}><Button label={t('subscriptionForm-1')} className="btn-secondary"/></a>
                <a href={getUrl(`subscriptions/export/${list.id}/` + (segmentId || 0))}><Button label={t('exportAsCsv')} className="btn-primary"/></a>
                <LinkButton to={`/lists/${list.id}/subscriptions/create`} className="btn-primary" icon="plus" label={t('addSubscriber')}/>
            </Toolbar>

            <Title>{t('subscribers')}</Title>

            {list.description &&
                <div className="well well-sm">{list.description}</div>
            }

            <div className="card bg-light">
                <div className="card-body p-2">
                    <div className="form-inline">
                        <label className="mr-2">{t('segment')}</label>
                        <select className="form-control input-sm" value={segmentId || ''} onChange={handleSegmentChange}>
                            <option value="">{t('allSubscriptions')}</option>
                            {segments.map(x => (
                                <option key={x.id} value={x.id.toString()}>{x.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <Table ref={tableRef} withHeader dataUrl={dataUrl} columns={columns} />
        </div>
    );
}

List.propTypes = {
    list: PropTypes.object,
    segments: PropTypes.array,
    segmentId: PropTypes.string
};
