'use strict';

import React, {useEffect, useRef, useState} from 'react';
import PropTypes from 'prop-types';
import {useTranslation} from '../lib/i18n';
import {LinkButton, Title} from '../lib/page';
import {
    AlignedRow,
    ButtonRow,
    CheckBox,
    DateTimePicker,
    Form,
    InputField,
    TableSelect,
} from '../lib/form';
import {useErrorHandling} from '../lib/hooks/useErrorHandling';
import {usePageHelpers} from '../lib/hooks/usePageHelpers';
import {useRequiresAuthenticatedUser} from '../lib/hooks/useRequiresAuthenticatedUser';
import {useForm} from '../lib/hooks/useForm';
import {getCampaignLabels} from './helpers';
import {Table} from "../lib/table";
import {Button, Icon, ModalDialog} from "../lib/bootstrap-components";
import axios from "../lib/axios";
import {getPublicUrl, getSandboxUrl, getUrl} from "../lib/urls";
import interoperableErrors from '../../../shared/interoperable-errors';
import {CampaignStatus, CampaignType} from "../../../shared/campaigns";
import moment from 'moment-timezone';
import campaignsStyles from "./styles.module.scss";
import {TestSendModalDialog, TestSendModalDialogMode} from "./TestSendModalDialog";
import "../lib/styles.scss";

function PreviewForTestUserModalDialog({ visible, onHide, entity }) {
    const { t } = useTranslation();
    const { handleError } = useErrorHandling();

    const formState = useForm({
        leaveConfirmation: false,
        localValidateFormValues(state) {
            if (!state.getIn(['testUser', 'value'])) {
                state.setIn(['testUser', 'error'], t('subscriptionHasToBeSelectedToShowThe'));
            } else {
                state.setIn(['testUser', 'error'], null);
            }
        }
    });

    useEffect(() => {
        formState.populateFormValues({ testUser: null });
    }, []);

    async function previewAsync() {
        try {
            if (formState.isFormWithoutErrors()) {
                const campaignCid = entity.cid;
                const [listCid, subscriptionCid] = formState.getFormValue('testUser').split(':');

                if (entity.type === CampaignType.RSS) {
                    const result = await axios.post(getUrl('rest/restricted-access-token'), {
                        method: 'rssPreview',
                        params: { campaignCid, listCid }
                    });

                    const accessToken = result.data;
                    window.open(getSandboxUrl(`cpgs/rss-preview/${campaignCid}/${listCid}/${subscriptionCid}`, accessToken, {withLocale: true}), '_blank');

                } else if (entity.type === CampaignType.REGULAR || entity.type === CampaignType.RSS_ENTRY) {
                    window.open(getPublicUrl(`archive/${campaignCid}/${listCid}/${subscriptionCid}`, {withLocale: true}), '_blank');

                } else {
                    throw new Error('Preview not supported');
                }
            } else {
                formState.showFormValidation();
            }
        } catch (e) {
            handleError(e);
        }
    }

    const testUsersColumns = [
        { data: 1, title: t('email') },
        { data: 2, title: t('subscriptionId'), render: data => <code>{data}</code> },
        { data: 3, title: t('listId'), render: data => <code>{data}</code> },
        { data: 4, title: t('list') },
        { data: 5, title: t('listNamespace') }
    ];

    return (
        <ModalDialog hidden={!visible} title={t('previewCampaign')} onCloseAsync={() => onHide()} buttons={[
            { label: t('preview'), className: 'btn-primary', onClickAsync: previewAsync },
            { label: t('close'), className: 'btn-danger', onClickAsync: () => onHide() }
        ]}>
            <Form stateOwner={formState}>
                <TableSelect id="testUser" label={t('previewAs')} withHeader dropdown dataUrl={`rest/campaigns-test-users-table/${entity.id}`} columns={testUsersColumns} selectionLabelIndex={1} />
            </Form>
        </ModalDialog>
    );
}

PreviewForTestUserModalDialog.propTypes = {
    visible: PropTypes.bool.isRequired,
    onHide: PropTypes.func.isRequired,
    entity: PropTypes.object.isRequired,
};

function SendControls({ entity, refreshEntity }) {
    const { t } = useTranslation();
    const { handleError } = useErrorHandling();

    const [showTestSendModal, setShowTestSendModal] = useState(false);
    const [previewForTestUserVisible, setPreviewForTestUserVisible] = useState(false);
    const [modal, setModal] = useState({ visible: false, title: '', message: '', callback: null });

    const timezoneOptions = useRef(moment.tz.names().map(x => [x])).current;

    const formState = useForm({
        leaveConfirmation: false,
        localValidateFormValues(state) {
            state.setIn(['date', 'error'], null);
            state.setIn(['time', 'error'], null);
            state.setIn(['timezone', 'error'], null);

            if (state.getIn(['sendLater', 'value'])) {
                const dateValue = state.getIn(['date', 'value']).trim();
                if (!dateValue) {
                    state.setIn(['date', 'error'], t('dateMustNotBeEmpty'));
                } else if (!moment(dateValue, 'YYYY-MM-DD', true).isValid()) {
                    state.setIn(['date', 'error'], t('dateIsInvalid'));
                }

                const timeValue = state.getIn(['time', 'value']).trim();
                if (!timeValue) {
                    state.setIn(['time', 'error'], t('timeMustNotBeEmpty'));
                } else if (!moment(timeValue, 'HH:mm', true).isValid()) {
                    state.setIn(['time', 'error'], t('timeIsInvalid'));
                }

                const timezone = state.getIn(['timezone', 'value']);
                if (!timezone) {
                    state.setIn(['timezone', 'error'], t('timezoneMustBeSelected'));
                }
            }
        }
    });

    function populateSendLater() {
        if (entity.scheduled) {
            const timezone = entity.data.timezone || moment.tz.guess();
            const date = moment.tz(entity.scheduled, timezone);
            formState.populateFormValues({
                sendLater: true,
                date: date.format('YYYY-MM-DD'),
                time: date.format('HH:mm'),
                timezone
            });
        } else {
            formState.populateFormValues({
                sendLater: false,
                date: '',
                time: '',
                timezone: moment.tz.guess()
            });
        }
    }

    useEffect(() => {
        populateSendLater();
    }, [entity.scheduled]);

    async function postAndMaskStateError(url, data) {
        try {
            await axios.post(getUrl(url), data);
        } catch (err) {
            if (err instanceof interoperableErrors.InvalidStateError) {
                // mask the error, just refresh
            } else {
                throw err;
            }
        }
    }

    async function scheduleAsync() {
        try {
            if (formState.isFormWithoutErrors()) {
                const data = formState.getFormValues();
                const dateTime = moment.tz(data.date + ' ' + data.time, 'YYYY-MM-DD HH:mm', data.timezone);

                await postAndMaskStateError(`rest/campaign-start-at/${entity.id}`, {
                    startAt: dateTime.valueOf(),
                    timezone: data.timezone
                });
            } else {
                formState.showFormValidation();
            }
            await refreshEntity();
        } catch (e) {
            handleError(e);
        }
    }

    async function startAsync() {
        try {
            await postAndMaskStateError(`rest/campaign-start/${entity.id}`);
            await refreshEntity();
        } catch (e) {
            handleError(e);
        }
    }

    async function stopAsync() {
        try {
            await postAndMaskStateError(`rest/campaign-stop/${entity.id}`);
            await refreshEntity();
        } catch (e) {
            handleError(e);
        }
    }

    async function resetAsync() {
        try {
            await postAndMaskStateError(`rest/campaign-reset/${entity.id}`);
            await refreshEntity();
        } catch (e) {
            handleError(e);
        }
    }

    async function enableAsync() {
        try {
            await postAndMaskStateError(`rest/campaign-enable/${entity.id}`);
            await refreshEntity();
        } catch (e) {
            handleError(e);
        }
    }

    async function disableAsync() {
        try {
            await postAndMaskStateError(`rest/campaign-disable/${entity.id}`);
            await refreshEntity();
        } catch (e) {
            handleError(e);
        }
    }

    function openActionDialog(title, message, callback) {
        setModal({ visible: true, title, message, callback });
    }

    function closeModal(confirmed) {
        if (confirmed && modal.callback) {
            modal.callback();
        }
        setModal({ visible: false, title: '', message: '', callback: null });
    }

    const testSendPermitted = entity.permissions.includes('sendToTestUsers');
    const sendPermitted = entity.permissions.includes('send');

    const dialogs = (
        <>
            <TestSendModalDialog
                mode={TestSendModalDialogMode.CAMPAIGN_STATUS}
                visible={showTestSendModal}
                onHide={() => setShowTestSendModal(false)}
                campaign={entity}
            />
            <PreviewForTestUserModalDialog
                visible={previewForTestUserVisible}
                onHide={() => setPreviewForTestUserVisible(false)}
                entity={entity}
            />
            <ModalDialog hidden={!modal.visible} title={modal.title} onCloseAsync={() => closeModal(false)} buttons={[
                { label: t('no'), className: 'btn-primary', onClickAsync: () => closeModal(false) },
                { label: t('yes'), className: 'btn-danger', onClickAsync: () => closeModal(true) }
            ]}>
                {modal.message}
            </ModalDialog>
        </>
    );

    const testButtons = (
        <>
            <Button className="btn-success" label={t('preview')} onClickAsync={async () => setPreviewForTestUserVisible(true)}/>
            {testSendPermitted && <Button className="btn-success" label={t('testSend')} onClickAsync={async () => setShowTestSendModal(true)}/>}
        </>
    );

    let sendStatus = null;
    if (entity.status === CampaignStatus.IDLE || entity.status === CampaignStatus.PAUSED || (entity.status === CampaignStatus.SCHEDULED && entity.scheduled)) {
        sendStatus = (
            <AlignedRow label={t('sendStatus')}>
                {entity.status === CampaignStatus.SCHEDULED ? t('campaignIsScheduledForDelivery') : t('campaignIsReadyToBeSentOut')}
            </AlignedRow>
        );
    } else if (entity.status === CampaignStatus.PAUSING) {
        sendStatus = (
            <AlignedRow label={t('sendStatus')}>
                {t('campaignIsBeingPausedPleaseWait')}
            </AlignedRow>
        );
    } else if (entity.status === CampaignStatus.SENDING || (entity.status === CampaignStatus.SCHEDULED && !entity.scheduled)) {
        sendStatus = (
            <AlignedRow label={t('sendStatus')}>
                {t('campaignIsBeingSentOut')}
            </AlignedRow>
        );
    } else if (entity.status === CampaignStatus.FINISHED) {
        sendStatus = (
            <AlignedRow label={t('sendStatus')}>
                {sendPermitted ? t('allMessagesSent!HitContinueIfYouWantTo') : t('allMessagesSent!')}
            </AlignedRow>
        );
    } else if (entity.status === CampaignStatus.INACTIVE) {
        sendStatus = (
            <AlignedRow label={t('sendStatus')}>
                {sendPermitted ? t('yourCampaignIsCurrentlyDisabledClick') : t('yourCampaignIsCurrentlyDisabled')}
            </AlignedRow>
        );
    } else if (entity.status === CampaignStatus.ACTIVE) {
        sendStatus = (
            <AlignedRow label={t('sendStatus')}>
                {t('yourCampaignIsEnabledAndSendingMessages')}
            </AlignedRow>
        );
    }

    let content = null;
    let sendButtons = null;
    if (sendPermitted) {
        if (entity.status === CampaignStatus.IDLE || entity.status === CampaignStatus.PAUSED || (entity.status === CampaignStatus.SCHEDULED && entity.scheduled)) {

            const timezoneColumns = [
                { data: 0, title: t('timezone') }
            ];

            const dateValue = (formState.getFormValue('date') || '').trim();
            const timeValue = (formState.getFormValue('time') || '').trim();
            const timezone = formState.getFormValue('timezone');

            let dateTimeHelp = t('selectDateTimeAndATimezoneToDisplayThe');
            let dateTimeAlert = null;
            if (moment(dateValue, 'YYYY-MM-DD', true).isValid() && moment(timeValue, 'HH:mm', true).isValid() && timezone) {
                const dateTime = moment.tz(dateValue + ' ' + timeValue, 'YYYY-MM-DD HH:mm', timezone);
                dateTimeHelp = dateTime.toString();
                if (!moment().isBefore(dateTime)) {
                    dateTimeAlert = <div className="alert alert-danger" role="alert">{t('scheduledDatetimeSeemsToBeInThePastIfYou')}</div>;
                }
            }

            content = (
                <Form stateOwner={formState}>
                    {entity.status !== CampaignStatus.SCHEDULED &&
                        <CheckBox id="sendLater" label={t('sendLater')} text={t('scheduleDeliveryAtAParticularDatetime')}/>
                    }
                    {formState.getFormValue('sendLater') &&
                    <div>
                        <DateTimePicker id="date" label={t('date')} />
                        <InputField id="time" label={t('time')} help={t('enter24HourTimeInFormatHhmmEg1348')}/>
                        <TableSelect id="timezone" label={t('timezone')} dropdown columns={timezoneColumns} selectionKeyIndex={0} selectionLabelIndex={0} data={timezoneOptions}
                                     help={dateTimeHelp}
                        />
                        {dateTimeAlert && <AlignedRow>{dateTimeAlert}</AlignedRow>}
                    </div>
                    }
                </Form>
            );

            sendButtons = (
                <>
                    {formState.getFormValue('sendLater') ?
                        <Button className="btn-primary" icon="play" label={entity.status === CampaignStatus.SCHEDULED ? t('rescheduleSend') : t('scheduleSend')} onClickAsync={() => openActionDialog(t('confirmLaunch'), t('doYouWantToScheduleTheCampaignForLaunch?'), scheduleAsync)}/>
                        :
                        <Button className="btn-primary" icon="play" label={t('send')} onClickAsync={() => openActionDialog(t('confirmLaunch'), t('doYouWantToLaunchTheCampaign?'), startAsync)}/>
                    }
                    {entity.status === CampaignStatus.SCHEDULED && <Button className="btn-primary" icon="pause" label={t('cancelScheduling')} onClickAsync={stopAsync}/>}
                    {entity.status === CampaignStatus.PAUSED && <Button className="btn-primary" icon="redo" label={t('reset')} onClickAsync={() => openActionDialog(t('confirmReset'), t('doYouWantToResetTheCampaign?All'), resetAsync)}/>}
                    {entity.status === CampaignStatus.PAUSED && <LinkButton className="btn-secondary" icon="signal" label={t('viewStatistics')} to={`/campaigns/${entity.id}/statistics`}/>}
                </>
            );

        } else if (entity.status === CampaignStatus.PAUSING) {
            sendButtons = (
                <>
                    <Button className="btn-primary" icon="pause" label={t('pausing')} disabled={true}/>
                    <LinkButton className="btn-secondary" icon="signal" label={t('viewStatistics')} to={`/campaigns/${entity.id}/statistics`}/>
                </>
            );

        } else if (entity.status === CampaignStatus.SENDING || (entity.status === CampaignStatus.SCHEDULED && !entity.scheduled)) {
            sendButtons = (
                <>
                    <Button className="btn-primary" icon="pause" label={t('pause')} onClickAsync={stopAsync}/>
                    <LinkButton className="btn-secondary" icon="signal" label={t('viewStatistics')} to={`/campaigns/${entity.id}/statistics`}/>
                </>
            );

        } else if (entity.status === CampaignStatus.FINISHED) {
            sendButtons = (
                <>
                    <Button className="btn-primary" icon="play" label={t('continue')} onClickAsync={() => openActionDialog(t('confirmLaunch'), t('doYouWantToLaunchTheCampaign?'), startAsync)}/>
                    <Button className="btn-primary" icon="redo" label={t('reset')} onClickAsync={() => openActionDialog(t('confirmReset'), t('doYouWantToResetTheCampaign?All'), resetAsync)}/>
                    <LinkButton className="btn-secondary" icon="signal" label={t('viewStatistics')} to={`/campaigns/${entity.id}/statistics`}/>
                </>
            );

        } else if (entity.status === CampaignStatus.INACTIVE) {
            sendButtons = (
                <>
                    <Button className="btn-primary" icon="play" label={t('enable')} onClickAsync={enableAsync}/>
                </>
            );

        } else if (entity.status === CampaignStatus.ACTIVE) {
            sendButtons = (
                <>
                    <Button className="btn-primary" icon="stop" label={t('disable')} onClickAsync={disableAsync}/>
                </>
            );
        }
    }

    return (
        <div>
            {dialogs}
            {sendStatus}
            {content}
            <ButtonRow className={campaignsStyles.sendButtonRow}>
                {sendButtons}
                {testButtons}
            </ButtonRow>
        </div>
    );
}

SendControls.propTypes = {
    entity: PropTypes.object.isRequired,
    refreshEntity: PropTypes.func.isRequired
};

export default function Status({ entity: initialEntity }) {
    const { t } = useTranslation();
    const { handleError } = useErrorHandling();
    useRequiresAuthenticatedUser();

    const [entity, setEntity] = useState(initialEntity);
    const [sendConfiguration, setSendConfiguration] = useState(null);
    const [sendConfigurationNotPermitted, setSendConfigurationNotPermitted] = useState(false);

    const { campaignTypeLabels, campaignStatusLabels } = getCampaignLabels(t);

    async function refreshEntity() {
        try {
            const resp = await axios.get(getUrl(`rest/campaigns-settings/${initialEntity.id}`));
            const newEntity = resp.data;
            setEntity(newEntity);

            try {
                const configResp = await axios.get(getUrl(`rest/send-configurations-public/${newEntity.send_configuration}`));
                setSendConfiguration(configResp.data);
                setSendConfigurationNotPermitted(false);
            } catch (err) {
                if (err instanceof interoperableErrors.PermissionDeniedError) {
                    setSendConfiguration(null);
                    setSendConfigurationNotPermitted(true);
                } else {
                    throw err;
                }
            }
        } catch (e) {
            handleError(e);
        }
    }

    useEffect(() => {
        let active = true;

        async function periodicTask() {
            await refreshEntity();
            if (active) {
                timeoutId = setTimeout(periodicTask, 10000);
            }
        }

        let timeoutId = setTimeout(periodicTask, 0);

        return () => {
            active = false;
            clearTimeout(timeoutId);
        };
    }, []);

    let sendSettings;
    if (sendConfiguration) {
        sendSettings = [];

        const addOverridable = (id, label) => {
            if (sendConfiguration[id + '_overridable'] == 1 && entity[id + '_override'] != null) {
                sendSettings.push(<AlignedRow key={id} label={label}>{entity[id + '_override']}</AlignedRow>);
            } else {
                sendSettings.push(<AlignedRow key={id} label={label}>{sendConfiguration[id]}</AlignedRow>);
            }
        };

        addOverridable('from_name', t('fromName'));
        addOverridable('from_email', t('fromEmailAddress'));
        addOverridable('reply_to', t('replytoEmailAddress'));
        sendSettings.push(<AlignedRow key="subject" label={t('subjectLine')}>{entity.subject}</AlignedRow>);
    } else {
        sendSettings = sendConfigurationNotPermitted ? null : <AlignedRow>{t('loadingSendConfiguration')}</AlignedRow>;
    }

    const listsColumns = [
        { data: 1, title: t('name') },
        { data: 2, title: t('id'), render: data => <code>{data}</code> },
        { data: 4, title: t('segment') },
        { data: 3, title: t('listNamespace') }
    ];

    const campaignsChildrenColumns = [
        { data: 1, title: t('name') },
        { data: 2, title: t('id'), render: data => <code>{data}</code> },
        { data: 5, title: t('status'), render: (data) => campaignStatusLabels[data] },
        { data: 8, title: t('created'), render: data => moment(data).fromNow() },
        {
            actions: data => {
                const actions = [];
                const perms = data[10];

                if (perms.includes('view')) {
                    actions.push({
                        label: <Icon icon="envelope" title={t('status')}/>,
                        link: `/campaigns/${data[0]}/status`
                    });
                }

                return actions;
            }
        }
    ];

    return (
        <div>
            <Title>{t('campaignStatus')}</Title>

            <AlignedRow label={t('name')}>{entity.name}</AlignedRow>
            <AlignedRow label={t('sent')}>{entity.delivered}</AlignedRow>
            <AlignedRow label={t('status')}>{campaignStatusLabels[entity.status]}</AlignedRow>

            {sendSettings}

            <AlignedRow label={t('targetListssegments')}>
                <Table withHeader dataUrl={`rest/lists-with-segment-by-campaign-table/${initialEntity.id}`} columns={listsColumns} />
            </AlignedRow>

            <hr/>
            <SendControls entity={entity} refreshEntity={refreshEntity}/>

            {entity.type === CampaignType.RSS &&
                <div>
                    <hr/>
                    <h3>RSS Entries</h3>
                    <p>{t('ifANewEntryIsFoundFromCampaignFeedANew')}</p>
                    <Table withHeader dataUrl={`rest/campaigns-children/${initialEntity.id}`} columns={campaignsChildrenColumns} order={[3, 'desc']}/>
                </div>
            }
        </div>
    );
}

Status.propTypes = {
    entity: PropTypes.object
};
