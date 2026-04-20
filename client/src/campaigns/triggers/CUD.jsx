'use strict';

import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from '../../lib/i18n';
import { LinkButton, Title } from '../../lib/page';
import {
    AlignedRow,
    Button,
    ButtonRow,
    CheckBox,
    Dropdown,
    filterData,
    Form,
    FormSendMethod,
    InputField,
    TableSelect,
    TextArea,
} from '../../lib/form';
import { useForm } from '../../lib/hooks/useForm';
import { useErrorHandling } from '../../lib/hooks/useErrorHandling';
import { usePageHelpers } from '../../lib/hooks/usePageHelpers';
import { useRequiresAuthenticatedUser } from '../../lib/hooks/useRequiresAuthenticatedUser';
import { DeleteModalDialog } from "../../lib/modals";
import { getTriggerTypes } from './helpers';
import { Entity, Event } from '../../../../shared/triggers';
import moment from 'moment';
import { getCampaignLabels } from "../helpers";
import { enableDeleteModal } from "../../settings/settings";

export default function CUD({ action, campaign, entity }) {
    useRequiresAuthenticatedUser();
    const { t } = useTranslation();
    const { handleError } = useErrorHandling();
    const { navigateToWithFlashMessage } = usePageHelpers();

    const campaignTypeLabels = getCampaignLabels(t);
    const { entityLabels, eventLabels } = getTriggerTypes(t);

    const entityOptions = [
        { key: Entity.SUBSCRIPTION, label: entityLabels[Entity.SUBSCRIPTION] },
        { key: Entity.CAMPAIGN, label: entityLabels[Entity.CAMPAIGN] }
    ];

    const SubscriptionEvent = Event[Entity.SUBSCRIPTION];
    const CampaignEvent = Event[Entity.CAMPAIGN];
    const eventOptions = {
        [Entity.SUBSCRIPTION]: [
            { key: SubscriptionEvent.CREATED, label: eventLabels[Entity.SUBSCRIPTION][SubscriptionEvent.CREATED] },
            { key: SubscriptionEvent.UPDATED, label: eventLabels[Entity.SUBSCRIPTION][SubscriptionEvent.UPDATED] },
            { key: SubscriptionEvent.LATEST_OPEN, label: eventLabels[Entity.SUBSCRIPTION][SubscriptionEvent.LATEST_OPEN] },
            { key: SubscriptionEvent.LATEST_CLICK, label: eventLabels[Entity.SUBSCRIPTION][SubscriptionEvent.LATEST_CLICK] }
        ],
        [Entity.CAMPAIGN]: [
            { key: CampaignEvent.DELIVERED, label: eventLabels[Entity.CAMPAIGN][CampaignEvent.DELIVERED] },
            { key: CampaignEvent.OPENED, label: eventLabels[Entity.CAMPAIGN][CampaignEvent.OPENED] },
            { key: CampaignEvent.CLICKED, label: eventLabels[Entity.CAMPAIGN][CampaignEvent.CLICKED] },
            { key: CampaignEvent.NOT_OPENED, label: eventLabels[Entity.CAMPAIGN][CampaignEvent.NOT_OPENED] },
            { key: CampaignEvent.NOT_CLICKED, label: eventLabels[Entity.CAMPAIGN][CampaignEvent.NOT_CLICKED] }
        ]
    };

    const formState = useForm({
        getFormValuesMutator: (data) => {
            data.daysAfter = (Math.round(data.seconds / (3600 * 24))).toString();

            if (data.entity === Entity.SUBSCRIPTION) {
                data.subscriptionEvent = data.event;
            } else {
                data.subscriptionEvent = Event[Entity.SUBSCRIPTION].CREATED;
            }

            if (data.entity === Entity.CAMPAIGN) {
                data.campaignEvent = data.event;
            } else {
                data.campaignEvent = Event[Entity.CAMPAIGN].DELIVERED;
            }
        },
        submitFormValuesMutator: (data) => {
            data.seconds = Number.parseInt(data.daysAfter) * 3600 * 24;

            if (data.entity === Entity.SUBSCRIPTION) {
                data.event = data.subscriptionEvent;
            } else if (data.entity === Entity.CAMPAIGN) {
                data.event = data.campaignEvent;
            }

            return filterData(data, ['name', 'description', 'entity', 'event', 'seconds', 'enabled', 'source_campaign']);
        },
        localValidateFormValues: (state) => {
            const entityKey = state.getIn(['entity', 'value']);

            if (!state.getIn(['name', 'value'])) {
                state.setIn(['name', 'error'], t('nameMustNotBeEmpty'));
            } else {
                state.setIn(['name', 'error'], null);
            }

            const daysAfter = state.getIn(['daysAfter', 'value']).trim();
            if (daysAfter === '') {
                state.setIn(['daysAfter', 'error'], t('valuesMustNotBeEmpty'));
            } else if (isNaN(daysAfter) || Number.parseInt(daysAfter) < 0) {
                state.setIn(['daysAfter', 'error'], t('valueMustBeANonnegativeNumber'));
            } else {
                state.setIn(['daysAfter', 'error'], null);
            }

            if (entityKey === Entity.CAMPAIGN && !state.getIn(['source_campaign', 'value'])) {
                state.setIn(['source_campaign', 'error'], t('sourceCampaignMustNotBeEmpty'));
            } else {
                state.setIn(['source_campaign', 'error'], null);
            }
        }
    });

    useEffect(() => {
        if (entity) {
            formState.getFormValuesFromEntity(entity);
        } else {
            formState.populateFormValues({
                name: '',
                description: '',
                entity: Entity.SUBSCRIPTION,
                subscriptionEvent: Event[Entity.SUBSCRIPTION].CREATED,
                campaignEvent: Event[Entity.CAMPAIGN].DELIVERED,
                daysAfter: '',
                enabled: true,
                source_campaign: null
            });
        }
    }, []);

    async function submitHandler(submitAndLeave) {
        let sendMethod, url;
        if (entity) {
            sendMethod = FormSendMethod.PUT;
            url = `rest/triggers/${campaign.id}/${entity.id}`;
        } else {
            sendMethod = FormSendMethod.POST;
            url = `rest/triggers/${campaign.id}`;
        }

        try {
            formState.disableForm();
            formState.setFormStatusMessage('info', t('saving'));

            const submitResult = await formState.validateAndSendFormValuesToURL(sendMethod, url);

            if (submitResult) {
                if (entity) {
                    if (submitAndLeave) {
                        navigateToWithFlashMessage(`/campaigns/${campaign.id}/triggers`, 'success', t('triggerUpdated'));
                    } else {
                        await formState.getFormValuesFromURL(`rest/triggers/${campaign.id}/${entity.id}`).catch(handleError);
                        formState.enableForm();
                        formState.setFormStatusMessage('success', t('triggerUpdated'));
                    }
                } else {
                    if (submitAndLeave) {
                        navigateToWithFlashMessage(`/campaigns/${campaign.id}/triggers`, 'success', t('triggerCreated'));
                    } else {
                        navigateToWithFlashMessage(`/campaigns/${campaign.id}/triggers/${submitResult}/edit`, 'success', t('triggerCreated'));
                    }
                }
            } else {
                formState.enableForm();
                formState.setFormStatusMessage('warning', t('thereAreErrorsInTheFormPleaseFixThemAnd'));
            }
        } catch (error) {
            handleError(error);
        }
    }

    const isEdit = !!entity;
    const entityKey = formState.getFormValue('entity');

    const campaignsColumns = [
        { data: 1, title: t('name') },
        { data: 2, title: t('id'), render: data => <code>{data}</code> },
        { data: 3, title: t('description') },
        { data: 4, title: t('type'), render: data => campaignTypeLabels[data] },
        { data: 5, title: t('created'), render: data => moment(data).fromNow() },
        { data: 6, title: t('namespace') }
    ];

    const campaignLists = campaign.lists.map(x => x.list).join(';');

    return (
        <div>
            {isEdit &&
                <DeleteModalDialog
                    stateOwner={formState}
                    visible={action === 'delete'}
                    deleteUrl={`rest/triggers/${campaign.id}/${entity.id}`}
                    backUrl={`/campaigns/${campaign.id}/triggers/${entity.id}/edit`}
                    successUrl={`/campaigns/${campaign.id}/triggers`}
                    deletingMsg={t('deletingTrigger')}
                    deletedMsg={t('triggerDeleted')}/>
            }

            <Title>{isEdit ? t('editTrigger') : t('createTrigger')}</Title>

            <Form stateOwner={formState} onSubmitAsync={(...args) => submitHandler(...args)}>
                <InputField id="name" label={t('name')}/>
                <TextArea id="description" label={t('description')}/>

                <Dropdown id="entity" label={t('entity')} options={entityOptions} help={t('selectTheTypeOfTheTriggerRule')}/>

                <InputField id="daysAfter" label={t('triggerFires')}/>

                <AlignedRow>days after:</AlignedRow>

                {entityKey === Entity.SUBSCRIPTION && <Dropdown id="subscriptionEvent" label={t('event')} options={eventOptions[Entity.SUBSCRIPTION]} help={t('selectTheEventThatTriggersSendingThe')}/>}

                {entityKey === Entity.CAMPAIGN && <Dropdown id="campaignEvent" label={t('event')} options={eventOptions[Entity.CAMPAIGN]} help={t('selectTheEventThatTriggersSendingThe')}/>}

                {entityKey === Entity.CAMPAIGN &&
                    <TableSelect id="source_campaign" label={t('campaign')} withHeader dropdown dataUrl={`rest/campaigns-others-by-list-table/${campaign.id}/${campaignLists}`} columns={campaignsColumns} selectionLabelIndex={1} />
                }

                <CheckBox id="enabled" text={t('enabled')}/>

                <ButtonRow>
                    <Button type="submit" className="btn-primary" icon="check" label={t('save')}/>
                    <Button type="submit" className="btn-primary" icon="check" label={t('saveAndLeave')} onClickAsync={async () => await submitHandler(true)}/>
                    {isEdit && <LinkButton className="btn-danger" icon="trash-alt" label={t('delete')} to={`/campaigns/${campaign.id}/triggers/${entity.id}/delete`}/>}
                </ButtonRow>
            </Form>
        </div>
    );
}

CUD.propTypes = {
    action: PropTypes.string.isRequired,
    campaign: PropTypes.object,
    entity: PropTypes.object
};
