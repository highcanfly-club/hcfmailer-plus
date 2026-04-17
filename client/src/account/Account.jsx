'use strict';

import React, { useEffect } from 'react';
import { useTranslation } from '../lib/i18n';
import { Trans } from 'react-i18next';
import { Title } from '../lib/page';
import {
    Button,
    ButtonRow,
    Fieldset,
    filterData,
    Form,
    FormSendMethod,
    InputField,
} from '../lib/form';
import { useForm } from '../lib/hooks/useForm';
import { useErrorHandling } from '../lib/hooks/useErrorHandling';
import { usePageHelpers } from '../lib/hooks/usePageHelpers';
import { useRequiresAuthenticatedUser } from '../lib/hooks/useRequiresAuthenticatedUser';
import passwordValidator from '../../../shared/password-validator';
import interoperableErrors from '../../../shared/interoperable-errors';
import mailtrainConfig from 'mailtrainConfig';

export default function Account() {
    const { t } = useTranslation();
    const { handleError } = useErrorHandling();
    const { setFlashMessage } = usePageHelpers();
    useRequiresAuthenticatedUser();

    const pwValidator = passwordValidator(t);

    const formState = useForm({
        serverValidation: {
            url: 'rest/account-validate',
            changed: ['email', 'currentPassword']
        },
        getFormValuesMutator: (data) => {
            data.password = '';
            data.password2 = '';
            data.currentPassword = '';
        },
        submitFormValuesMutator: (data) => {
            return filterData(data, ['name', 'email', 'password', 'currentPassword']);
        },
        localValidateFormValues: (state) => {
            const email = state.getIn(['email', 'value']);
            const emailServerValidation = state.getIn(['email', 'serverValidation']);

            if (!email) {
                state.setIn(['email', 'error'], t('emailMustNotBeEmpty'));
            } else if (emailServerValidation && emailServerValidation.invalid) {
                state.setIn(['email', 'error'], t('invalidEmailAddress'));
            } else if (emailServerValidation && emailServerValidation.exists) {
                state.setIn(['email', 'error'], t('theEmailIsAlreadyAssociatedWithAnother'));
            } else if (!emailServerValidation) {
                state.setIn(['email', 'error'], t('validationIsInProgress'));
            } else {
                state.setIn(['email', 'error'], null);
            }

            const name = state.getIn(['name', 'value']);
            if (!name) {
                state.setIn(['name', 'error'], t('fullNameMustNotBeEmpty'));
            } else {
                state.setIn(['name', 'error'], null);
            }

            const password = state.getIn(['password', 'value']) || '';
            const password2 = state.getIn(['password2', 'value']) || '';
            const currentPassword = state.getIn(['currentPassword', 'value']) || '';

            let passwordMsgs = [];

            if (password || currentPassword) {
                const passwordResults = pwValidator.test(password);
                passwordMsgs.push(...passwordResults.errors);

                const currentPasswordServerValidation = state.getIn(['currentPassword', 'serverValidation']);

                if (!currentPassword) {
                    state.setIn(['currentPassword', 'error'], t('currentPasswordMustNotBeEmpty'));
                } else if (currentPasswordServerValidation && currentPasswordServerValidation.incorrect) {
                    state.setIn(['currentPassword', 'error'], t('incorrectPassword'));
                } else if (!currentPasswordServerValidation) {
                    state.setIn(['email', 'error'], t('validationIsInProgress'));
                } else {
                    state.setIn(['currentPassword', 'error'], null);
                }
            }

            if (passwordMsgs.length > 1) {
                passwordMsgs = passwordMsgs.map((msg, idx) => <div key={idx}>{msg}</div>);
            }

            state.setIn(['password', 'error'], passwordMsgs.length > 0 ? passwordMsgs : null);
            state.setIn(['password2', 'error'], password !== password2 ? t('passwordsMustMatch') : null);
        }
    });

    useEffect(() => {
        formState.getFormValuesFromURL('rest/account').catch(handleError);
    }, []);

    async function submitHandler() {
        try {
            formState.disableForm();
            formState.setFormStatusMessage('info', t('updatingUserProfile'));

            const submitSuccessful = await formState.validateAndSendFormValuesToURL(FormSendMethod.POST, 'rest/account');

            if (submitSuccessful) {
                setFlashMessage('success', t('userProfileUpdated'));
                formState.hideFormValidation();
                formState.updateFormValue('password', '');
                formState.updateFormValue('password2', '');
                formState.updateFormValue('currentPassword', '');
                formState.clearFormStatusMessage();
                formState.enableForm();
            } else {
                formState.enableForm();
                formState.setFormStatusMessage('warning', t('thereAreErrorsInTheFormPleaseFixThemAnd'));
            }
        } catch (error) {
            if (error instanceof interoperableErrors.IncorrectPasswordError) {
                formState.enableForm();
                formState.setFormStatusMessage('danger',
                    <span>
                        <strong>{t('yourUpdatesCannotBeSaved')}</strong>{' '}
                        {t('thePasswordIsIncorrectPossiblyJust')}
                    </span>
                );
                formState.scheduleFormRevalidate();
                return;
            }

            if (error instanceof interoperableErrors.DuplicitEmailError) {
                formState.enableForm();
                formState.setFormStatusMessage('danger',
                    <span>
                        <strong>{t('yourUpdatesCannotBeSaved')}</strong>{' '}
                        {t('theEmailIsAlreadyAssignedToAnotherUser')}
                    </span>
                );
                formState.scheduleFormRevalidate();
                return;
            }

            handleError(error);
        }
    }

    if (mailtrainConfig.isAuthMethodLocal) {
        return (
            <div>
                <Title>{t('account')}</Title>

                <Form stateOwner={formState} onSubmitAsync={submitHandler}>
                    <Fieldset label={t('generalSettings')}>
                        <InputField id="name" label={t('fullName')}/>
                        <InputField id="email" label={t('email')} help={t('thisAddressIsUsedForAccountRecoveryIn')}/>
                    </Fieldset>

                    <Fieldset label={t('passwordChange')}>
                        <p>{t('youOnlyNeedToFillOutThisFormIfYouWantTo')}</p>
                        <InputField id="currentPassword" label={t('currentPassword')} type="password" />
                        <InputField id="password" label={t('newPassword')} type="password" />
                        <InputField id="password2" label={t('confirmPassword')} type="password" />
                    </Fieldset>

                    <ButtonRow>
                        <Button type="submit" className="btn-primary" icon="check" label={t('update')}/>
                    </ButtonRow>
                </Form>
            </div>
        );
    } else {
        return (
            <div>
                <Title>{t('account')}</Title>

                <p>{t('accountManagementIsNotPossibleBecause')}</p>

                {mailtrainConfig.externalPasswordResetLink && <p><Trans i18nKey="ifYouWantToChangeThePasswordUseThisLink">If you want to change the password, use <a href={mailtrainConfig.externalPasswordResetLink}>this link</a>.</Trans></p>}
            </div>
        );
    }
}
