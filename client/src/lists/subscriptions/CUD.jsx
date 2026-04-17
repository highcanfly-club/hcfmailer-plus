'use strict';

import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { HTTPMethod } from '../../lib/axios';
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
} from '../../lib/form';
import { useForm } from '../../lib/hooks/useForm';
import { useErrorHandling } from '../../lib/hooks/useErrorHandling';
import { usePageHelpers } from '../../lib/hooks/usePageHelpers';
import { useRequiresAuthenticatedUser } from '../../lib/hooks/useRequiresAuthenticatedUser';
import { RestActionModalDialog } from "../../lib/modals";
import interoperableErrors from '../../../../shared/interoperable-errors';
import { getFieldColumn, SubscriptionStatus } from '../../../../shared/lists';
import { getFieldTypes, getSubscriptionStatusLabels } from './helpers';
import moment from 'moment-timezone';
import { enableDeleteModal } from "../../settings/settings";

export default function CUD({ action, list, fieldsGrouped, entity }) {
    useRequiresAuthenticatedUser();
    const { t } = useTranslation();
    const { handleError } = useErrorHandling();
    const { navigateToWithFlashMessage } = usePageHelpers();

    const subscriptionStatusLabels = getSubscriptionStatusLabels(t);
    const fieldTypes = getFieldTypes(t);

    const timezoneOptions = [
        { key: '', label: t('notSelected') },
        ...moment.tz.names().map(tz => ({ key: tz.toLowerCase(), label: tz }))
    ];

    const formState = useForm({
        serverValidation: {
            url: `rest/subscriptions-validate/${list.id}`,
            changed: ['email'],
            extra: ['id']
        },
        getFormValuesMutator: (data) => {
            data.status = data.status.toString();
            data.tz = data.tz || '';

            for (const fld of fieldsGrouped) {
                fieldTypes[fld.type].assignFormData(fld, data);
            }
        },
        submitFormValuesMutator: (data) => {
            data.status = parseInt(data.status);
            data.tz = data.tz || null;

            const allowedCols = ['email', 'tz', 'is_test', 'status'];

            for (const fld of fieldsGrouped) {
                fieldTypes[fld.type].assignEntity(fld, data);
                allowedCols.push(getFieldColumn(fld));
            }

            return filterData(data, allowedCols);
        },
        localValidateFormValues: (state) => {
            const emailServerValidation = state.getIn(['email', 'serverValidation']);
            if (!state.getIn(['email', 'value'])) {
                state.setIn(['email', 'error'], t('emailMustNotBeEmpty-1'));
            } else if (!emailServerValidation) {
                state.setIn(['email', 'error'], t('validationIsInProgress'));
            } else if (emailServerValidation.exists) {
                state.setIn(['email', 'error'], t('anotherSubscriptionWithTheSameEmail'));
            } else {
                state.setIn(['email', 'error'], null);
            }

            for (const fld of fieldsGrouped) {
                fieldTypes[fld.type].validate(fld, state);
            }
        }
    });

    useEffect(() => {
        if (entity) {
            formState.getFormValuesFromEntity(entity);
        } else {
            const data = {
                email: '',
                tz: '',
                is_test: false,
                status: SubscriptionStatus.SUBSCRIBED
            };

            for (const fld of fieldsGrouped) {
                fieldTypes[fld.type].initFormData(fld, data);
            }

            formState.populateFormValues(data);
        }
    }, []);

    async function submitHandler(submitAndLeave) {
        let sendMethod, url;
        if (entity) {
            sendMethod = FormSendMethod.PUT;
            url = `rest/subscriptions/${list.id}/${entity.id}`;
        } else {
            sendMethod = FormSendMethod.POST;
            url = `rest/subscriptions/${list.id}`;
        }

        try {
            formState.disableForm();
            formState.setFormStatusMessage('info', t('saving'));

            const submitResult = await formState.validateAndSendFormValuesToURL(sendMethod, url);

            if (submitResult) {
                if (entity) {
                    if (submitAndLeave) {
                        navigateToWithFlashMessage(`/lists/${list.id}/subscriptions`, 'success', t('subscriptionUpdated'));
                    } else {
                        await formState.getFormValuesFromURL(`rest/subscriptions/${list.id}/${entity.id}`).catch(handleError);
                        formState.enableForm();
                        formState.setFormStatusMessage('success', t('subscriptionUpdated'));
                    }
                } else {
                    if (submitAndLeave) {
                        navigateToWithFlashMessage(`/lists/${list.id}/subscriptions`, 'success', t('subscriptionCreated'));
                    } else {
                        navigateToWithFlashMessage(`/lists/${list.id}/subscriptions/${submitResult}/edit`, 'success', t('subscriptionCreated'));
                    }
                }
            } else {
                formState.enableForm();
                formState.setFormStatusMessage('warning', t('thereAreErrorsInTheFormPleaseFixThemAnd'));
            }
        } catch (error) {
            console.log(error);
            if (error instanceof interoperableErrors.DuplicitEmailError) {
                formState.setFormStatusMessage('danger',
                    <span>
                        <strong>{t('yourUpdatesCannotBeSaved')}</strong>{' '}
                        {t('itSeemsThatAnotherSubscriptionWithThe')}
                    </span>
                );
                return;
            }
            handleError(error);
        }
    }

    const isEdit = !!entity;

    const statusOptions = Object.keys(subscriptionStatusLabels)
        .map(key => ({ key, label: subscriptionStatusLabels[key] }));

    const customFields = [];
    for (const fld of fieldsGrouped) {
        customFields.push(fieldTypes[fld.type].form(fld));
    }

    return (
        <div>
            {isEdit &&
                <div>
                    <RestActionModalDialog
                        title={t('confirmDeletion')}
                        message={t('areYouSureYouWantToDeleteSubscriptionFor', { email: formState.getFormValue('email') || '' })}
                        stateOwner={formState}
                        visible={action === 'delete'}
                        actionMethod={HTTPMethod.DELETE}
                        actionUrl={`rest/subscriptions/${list.id}/${entity.id}`}
                        backUrl={`/lists/${list.id}/subscriptions/${entity.id}/edit`}
                        successUrl={`/lists/${list.id}/subscriptions`}
                        actionInProgressMsg={t('deletingSubscription')}
                        actionDoneMsg={t('subscriptionDeleted')}/>
                </div>
            }

            <Title>{isEdit ? t('editSubscription') : t('createSubscription')}</Title>

            <Form stateOwner={formState} onSubmitAsync={(...args) => submitHandler(...args)}>
                <InputField id="email" label={t('email')}/>

                {customFields}
                <hr />

                <Dropdown id="tz" label={t('timezone')} options={timezoneOptions}/>

                <Dropdown id="status" label={t('subscriptionStatus')} options={statusOptions}/>

                <CheckBox id="is_test" text={t('testUser?')} help={t('ifCheckedThenThisSubscriptionCanBeUsed')}/>

                {!isEdit &&
                    <AlignedRow>
                        <p className="text-warning">
                            {t('noEmailConfirmation')}
                        </p>
                    </AlignedRow>
                }
                <ButtonRow>
                    <Button type="submit" className="btn-primary" icon="check" label={t('save')}/>
                    <Button type="submit" className="btn-primary" icon="check" label={t('saveAndLeave')} onClickAsync={async () => await submitHandler(true)}/>
                    {enableDeleteModal && isEdit && <LinkButton className="btn-danger" icon="trash-alt" label={t('delete')} to={`/lists/${list.id}/subscriptions/${entity.id}/delete`}/>}
                </ButtonRow>
            </Form>
        </div>
    );
}

CUD.propTypes = {
    action: PropTypes.string.isRequired,
    list: PropTypes.object,
    fieldsGrouped: PropTypes.array,
    entity: PropTypes.object
};
