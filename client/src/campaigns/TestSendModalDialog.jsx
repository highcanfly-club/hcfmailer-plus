'use strict';

import React, {useEffect} from 'react';
import {useTranslation} from '../lib/i18n';
import PropTypes from 'prop-types';
import {ModalDialog} from "../lib/bootstrap-components";
import {CheckBox, Dropdown, Form, InputField, TableSelect} from "../lib/form";
import {getMailerTypes} from "../send-configurations/helpers";
import axios from '../lib/axios';
import {getUrl} from '../lib/urls';
import {CampaignType} from "../../../shared/campaigns";
import {useErrorHandling} from '../lib/hooks/useErrorHandling';
import {useForm} from '../lib/hooks/useForm';

const Target = {
    CAMPAIGN_ONE: 'campaign_one',
    CAMPAIGN_ALL: 'campaign_all',
    LIST_ONE: 'list_one',
    LIST_ALL: 'list_all'
};

export const TestSendModalDialogMode = {
    TEMPLATE: 0,
    CAMPAIGN_CONTENT: 1,
    CAMPAIGN_STATUS: 2
}

export function TestSendModalDialog({ visible, mode, onHide, getDataAsync, campaign, template }) {
    const { t } = useTranslation();
    const { handleError } = useErrorHandling();

    const mailerTypes = getMailerTypes(t);

    const formState = useForm({
        leaveConfirmation: false,
        onChangeBeforeValidation: {
            list: (mutStateData, key, oldValue, newValue) => {
                mutStateData.setIn(['segment', 'value'], null);
            }
        },
        localValidateFormValues(state) {
            const target = formState.getFormValue('target');

            state.setIn(['listCid', 'error'], null);
            state.setIn(['sendConfiguration', 'error'], null);
            state.setIn(['testUserSubscriptionCid', 'error'], null);
            state.setIn(['testUserListAndSubscriptionCid', 'error'], null);
            state.setIn(['list', 'error'], null);
            state.setIn(['segment', 'error'], null);

            if (mode === TestSendModalDialogMode.TEMPLATE) {
                if (!state.getIn(['listCid', 'value'])) {
                    state.setIn(['listCid', 'error'], t('listHasToBeSelected'));
                }
                if (!state.getIn(['sendConfiguration', 'value'])) {
                    state.setIn(['sendConfiguration', 'error'], t('sendConfigurationHasToBeSelected'));
                }
                if (!state.getIn(['testUserSubscriptionCid', 'value'])) {
                    state.setIn(['testUserSubscriptionCid', 'error'], t('subscriptionHasToBeSelected'));
                }
            }

            if ((mode === TestSendModalDialogMode.CAMPAIGN_CONTENT || mode === TestSendModalDialogMode.CAMPAIGN_STATUS) && target === Target.CAMPAIGN_ONE) {
                if (!state.getIn(['testUserListAndSubscriptionCid', 'value'])) {
                    state.setIn(['testUserListAndSubscriptionCid', 'error'], t('subscriptionHasToBeSelected'));
                }
            }

            if ((mode === TestSendModalDialogMode.CAMPAIGN_CONTENT || mode === TestSendModalDialogMode.CAMPAIGN_STATUS) && target === Target.LIST_ONE) {
                if (!state.getIn(['listCid', 'value'])) {
                    state.setIn(['listCid', 'error'], t('listHasToBeSelected'));
                }
                if (!state.getIn(['testUserSubscriptionCid', 'value'])) {
                    state.setIn(['testUserSubscriptionCid', 'error'], t('subscriptionHasToBeSelected'));
                }
            }

            if ((mode === TestSendModalDialogMode.CAMPAIGN_CONTENT || mode === TestSendModalDialogMode.CAMPAIGN_STATUS) && target === Target.LIST_ALL) {
                if (!state.getIn(['list', 'value'])) {
                    state.setIn(['list', 'error'], t('listMustBeSelected'));
                }
                if (state.getIn(['useSegmentation', 'value']) && !state.getIn(['segment', 'value'])) {
                    state.setIn(['segment', 'error'], t('segmentMustBeSelected'));
                }
            }
        }
    });

    useEffect(() => {
        formState.populateFormValues({
            target: Target.CAMPAIGN_ONE,
            testUserSubscriptionCid: null,
            testUserListAndSubscriptionCid: null,
            subjectPrepend: '',
            subjectAppend: t('test'),
            sendConfiguration: null,
            listCid: null,
            list: null,
            segment: null,
            useSegmentation: false
        });
    }, []);

    async function performAction() {
        try {
            if (formState.isFormWithoutErrors()) {
                formState.hideFormValidation();
                formState.disableForm();
                formState.setFormStatusMessage('info', t('sendingTestEmail'));

                const data = {};

                if (mode === TestSendModalDialogMode.CAMPAIGN_CONTENT || mode === TestSendModalDialogMode.TEMPLATE) {
                    const contentData = await getDataAsync();
                    data.html = contentData.html;
                    data.text = contentData.text;
                    data.tagLanguage = contentData.tagLanguage;
                }

                if (mode === TestSendModalDialogMode.TEMPLATE) {
                    data.templateId = template.id;
                    data.listCid = formState.getFormValue('listCid');
                    data.subscriptionCid = formState.getFormValue('testUserSubscriptionCid');
                    data.sendConfigurationId = formState.getFormValue('sendConfiguration');

                } else if (mode === TestSendModalDialogMode.CAMPAIGN_STATUS || mode === TestSendModalDialogMode.CAMPAIGN_CONTENT) {
                    data.campaignId = campaign.id;
                    data.subjectPrepend = formState.getFormValue('subjectPrepend');
                    data.subjectAppend = formState.getFormValue('subjectAppend');

                    const target = formState.getFormValue('target');
                    if (target === Target.CAMPAIGN_ONE) {
                        const [listCid, subscriptionCid] = formState.getFormValue('testUserListAndSubscriptionCid').split(':');
                        data.listCid = listCid;
                        data.subscriptionCid = subscriptionCid;

                    } else if (target === Target.LIST_ALL) {
                        data.listId = formState.getFormValue('list');
                        data.segmentId = formState.getFormValue('useSegmentation') ? formState.getFormValue('segment') : null;

                    } else if (target === Target.LIST_ONE) {
                        data.listCid = formState.getFormValue('listCid');
                        data.subscriptionCid = formState.getFormValue('testUserSubscriptionCid');
                    }
                }

                await axios.post(getUrl('rest/campaign-test-send'), data);

                formState.clearFormStatusMessage();
                formState.enableForm();
                onHide();

            } else {
                formState.showFormValidation();
            }
        } catch (e) {
            handleError(e);
        }
    }

    const content = [];
    const target = formState.getFormValue('target');

    if (mode === TestSendModalDialogMode.CAMPAIGN_CONTENT || mode === TestSendModalDialogMode.CAMPAIGN_STATUS) {
        const targetOpts = [
            {key: Target.CAMPAIGN_ONE, label: t('singleTestUserOfTheCampaign')},
            {key: Target.CAMPAIGN_ALL, label: t('allTestUsersOfTheCampaign')},
            {key: Target.LIST_ONE, label: t('singleTestUserFromAList')},
            {key: Target.LIST_ALL, label: t('allTestUsersFromAListsegment')}
        ];

        content.push(
            <Dropdown key="target" id="target" format="wide" label={t('selectToWhereYouWantToSendTheTest')} options={targetOpts}/>
        );
    }

    if (mode === TestSendModalDialogMode.TEMPLATE) {
        const listCid = formState.getFormValue('listCid');

        const testUsersColumns = [
            { data: 1, title: t('subscriptionId'), render: data => <code>{data}</code> },
            { data: 2, title: t('email') }
        ];

        const listsColumns = [
            { data: 1, title: t('name') },
            { data: 2, title: t('id'), render: data => <code>{data}</code> },
            { data: 3, title: t('subscribers') },
            { data: 4, title: t('description') },
            { data: 5, title: t('namespace') }
        ];

        const sendConfigurationsColumns = [
            { data: 1, title: t('name') },
            { data: 2, title: t('id'), render: data => <code>{data}</code> },
            { data: 3, title: t('description') },
            { data: 4, title: t('type'), render: data => mailerTypes[data].typeName },
            { data: 6, title: t('namespace') }
        ];

        content.push(
            <TableSelect key="sendConfiguration" id="sendConfiguration" format="wide" label={t('sendConfiguration-1')} withHeader dropdown dataUrl='rest/send-configurations-with-send-permission-table' columns={sendConfigurationsColumns} selectionLabelIndex={1} />
        );

        content.push(
            <TableSelect key="listCid" id="listCid" format="wide" label={t('list')} withHeader dropdown dataUrl={`rest/lists-table`} columns={listsColumns} selectionKeyIndex={2} selectionLabelIndex={1} />
        );

        if (listCid) {
            content.push(
                <TableSelect key="testUserSubscriptionCid" id="testUserSubscriptionCid" format="wide" label={t('subscription')} withHeader dropdown dataUrl={`rest/subscriptions-test-user-table/${listCid}`} columns={testUsersColumns} selectionKeyIndex={1} selectionLabelIndex={2} />
            );
        }
    }

    if ((mode === TestSendModalDialogMode.CAMPAIGN_CONTENT || mode === TestSendModalDialogMode.CAMPAIGN_STATUS) && target === Target.CAMPAIGN_ONE) {
        const testUsersColumns = [
            {data: 1, title: t('email')},
            {data: 2, title: t('subscriptionId'), render: data => <code>{data}</code>},
            {data: 3, title: t('listId'), render: data => <code>{data}</code>},
            {data: 4, title: t('list')},
            {data: 5, title: t('listNamespace')}
        ];

        content.push(
            <TableSelect key="testUserListAndSubscriptionCid" id="testUserListAndSubscriptionCid" format="wide" label={t('subscription')} withHeader dropdown dataUrl={`rest/campaigns-test-users-table/${campaign.id}`} columns={testUsersColumns} selectionLabelIndex={1} />
        );
    }

    if ((mode === TestSendModalDialogMode.CAMPAIGN_CONTENT || mode === TestSendModalDialogMode.CAMPAIGN_STATUS) && target === Target.LIST_ONE) {
        const listCid = formState.getFormValue('listCid');

        const listsColumns = [
            { data: 1, title: t('name') },
            { data: 2, title: t('id'), render: data => <code>{data}</code> },
            { data: 3, title: t('subscribers') },
            { data: 4, title: t('description') },
            { data: 5, title: t('namespace') }
        ];

        const testUsersColumns = [
            { data: 1, title: t('subscriptionId'), render: data => <code>{data}</code> },
            { data: 2, title: t('email') }
        ];

        content.push(
            <TableSelect key="listCid" id="listCid" format="wide" label={t('list')} withHeader dropdown dataUrl={`rest/lists-table`} columns={listsColumns} selectionKeyIndex={2} selectionLabelIndex={1} />
        );

        if (listCid) {
            content.push(
                <TableSelect key="testUserSubscriptionCid" id="testUserSubscriptionCid" format="wide" label={t('subscription')} withHeader dropdown dataUrl={`rest/subscriptions-test-user-table/${listCid}`} columns={testUsersColumns} selectionKeyIndex={1} selectionLabelIndex={2} />
            );
        }
    }

    if ((mode === TestSendModalDialogMode.CAMPAIGN_CONTENT || mode === TestSendModalDialogMode.CAMPAIGN_STATUS) && target === Target.LIST_ALL) {
        const listsColumns = [
            { data: 1, title: t('name') },
            { data: 2, title: t('id'), render: data => <code>{data}</code> },
            { data: 3, title: t('subscribers') },
            { data: 4, title: t('description') },
            { data: 5, title: t('namespace') }
        ];

        const segmentsColumns = [
            { data: 1, title: t('name') }
        ];

        content.push(
            <TableSelect key="list" id="list" format="wide" label={t('list')} withHeader dropdown dataUrl='rest/lists-table' columns={listsColumns} selectionLabelIndex={1} />
        );

        const selectedList = formState.getFormValue('list');
        content.push(
            <div key="segment">
                <CheckBox id="useSegmentation" format="wide" text={t('useAParticularSegment')}/>
                {selectedList && formState.getFormValue('useSegmentation') &&
                    <TableSelect id="segment" format="wide" withHeader dropdown dataUrl={`rest/segments-table/${selectedList}`} columns={segmentsColumns} selectionLabelIndex={1} />
                }
            </div>
        );
    }

    if (mode === TestSendModalDialogMode.CAMPAIGN_CONTENT || mode === TestSendModalDialogMode.CAMPAIGN_STATUS) {
        content.push(
            <InputField key="subjectPrepend" id="subjectPrepend" format="wide" label={t('prependToSubject')}/>
        );

        content.push(
            <InputField key="subjectAppend" id="subjectAppend" format="wide" label={t('appendToSubject')}/>
        );
    }

    return (
        <ModalDialog hidden={!visible} title={t('sendTestEmail')} onCloseAsync={() => onHide()} buttons={[
            { label: t('send'), className: 'btn-primary', onClickAsync: performAction },
            { label: t('close'), className: 'btn-danger', onClickAsync: () => onHide() }
        ]}>
            <Form stateOwner={formState} format="wide">
                {content}
            </Form>
        </ModalDialog>
    );
}

TestSendModalDialog.propTypes = {
    visible: PropTypes.bool.isRequired,
    mode: PropTypes.number.isRequired,
    onHide: PropTypes.func.isRequired,
    getDataAsync: PropTypes.func,
    campaign: PropTypes.object,
    template: PropTypes.object
};
