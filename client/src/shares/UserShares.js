'use strict';

import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {withTranslation} from '../lib/i18n';
import {requiresAuthenticatedUser, Title, withPageHelpers} from '../lib/page';
import {withAsyncErrorHandler, withErrorHandling} from '../lib/error-handling';
import {Table} from '../lib/table';
import axios from '../lib/axios';
import {Icon} from "../lib/bootstrap-components";
import {getUrl} from "../lib/urls";
import {withComponentMixins} from "../lib/decorator-helpers";

@withComponentMixins([
    withTranslation,
    withErrorHandling,
    withPageHelpers,
    requiresAuthenticatedUser
])
export default class UserShares extends Component {
    constructor(props) {
        super(props);

        this.sharesTables = {};
    }

    static propTypes = {
        user: PropTypes.object
    }

    @withAsyncErrorHandler
    async deleteShare(entityTypeId, entityId) {
        const data = {
            entityTypeId,
            entityId,
            userId: this.props.user.id
        };

        await axios.put(getUrl('rest/shares'), data);
        for (const key in this.sharesTables) {
            this.sharesTables[key].refresh();
        }
    }

    componentDidMount() {
    }

    render() {
        const t = this.props.t;

        const renderSharesTable = (entityTypeId, title) => {
            const columns = [
                { data: 0, title: t('name') },
                { data: 1, title: t('role') },
                {
                    actions: data => {
                        const actions = [];
                        const autoGenerated = data[3];
                        const perms = data[4];

                        if (!autoGenerated && perms.includes('share')) {
                            actions.push({
                                label: <Icon icon="trash-alt" title={t('remove')}/>,
                                action: () => this.deleteShare(entityTypeId, data[2])
                            });
                        }

                        return actions;
                    }
                }
            ];

            return (
                <div>
                    <h3>{title}</h3>
                    <Table ref={node => this.sharesTables[entityTypeId] = node} withHeader dataUrl={`rest/shares-table-by-user/${entityTypeId}/${this.props.user.id}`} columns={columns} />
                </div>
            );
        };

        return (
            <div>
                <Title>{t('sharesForUserUsername', {username: this.props.user.username})}</Title>

                {renderSharesTable('namespace', t('namespaces'))}
                {renderSharesTable('list', t('lists'))}
                {renderSharesTable('template', t('Templates'))}
                {renderSharesTable('mosaicoTemplate', t('Mosaico Templates'))}
                {renderSharesTable('campaign', t('Campaigns'))}
                {renderSharesTable('customForm', t('customForms-1'))}
                {renderSharesTable('report', t('reports'))}
                {renderSharesTable('reportTemplate', t('reportTemplates'))}
                {renderSharesTable('sendConfiguration', t('Send Configurations'))}
            </div>
        );
    }
}
