'use strict';

import React, { useState, useEffect } from 'react';
import { useTranslation } from '../lib/i18n';
import { Title } from '../lib/page';
import { Link } from 'react-router-dom';
import {
    Button,
    ButtonRow,
    filterData,
    Form,
    FormSendMethod,
    InputField,
} from '../lib/form';
import { useForm } from '../lib/hooks/useForm';
import { useErrorHandling } from '../lib/hooks/useErrorHandling';
import { usePageHelpers } from '../lib/hooks/usePageHelpers';
import passwordValidator from '../../../shared/password-validator';
import axios from '../lib/axios';
import interoperableErrors from '../../../shared/interoperable-errors';
import { getUrl } from '../lib/urls';

const ResetTokenValidationState = {
    PENDING: 0,
    VALID: 1,
    INVALID: 2
};

export default function Reset({ match }) {
    const { t } = useTranslation();
    const { handleError } = useErrorHandling();
    const { navigateToWithFlashMessage } = usePageHelpers();
    const pwValidator = passwordValidator(t);

    const [resetTokenValidationState, setResetTokenValidationState] = useState(ResetTokenValidationState.PENDING);

    const formState = useForm({
        leaveConfirmation: false,
        submitFormValuesMutator: (data) => {
            return filterData(data, ['username', 'password', 'resetToken']);
        },
        localValidateFormValues: (state) => {
            const password = state.getIn(['password', 'value']) || '';
            const password2 = state.getIn(['password2', 'value']) || '';

            let passwordMsgs = [];

            if (password) {
                const passwordResults = pwValidator.test(password);
                passwordMsgs.push(...passwordResults.errors);
            }

            if (passwordMsgs.length > 1) {
                passwordMsgs = passwordMsgs.map((msg, idx) => <div key={idx}>{msg}</div>);
            }

            state.setIn(['password', 'error'], passwordMsgs.length > 0 ? passwordMsgs : null);
            state.setIn(['password2', 'error'], password !== password2 ? t('passwordsMustMatch') : null);
        }
    });

    useEffect(() => {
        const params = match.params;
        formState.populateFormValues({
            username: params.username,
            resetToken: params.resetToken,
            password: '',
            password2: ''
        });

        validateResetToken();
    }, []);

    async function validateResetToken() {
        try {
            const params = match.params;
            const response = await axios.post(getUrl('rest/password-reset-validate'), {
                username: params.username,
                resetToken: params.resetToken
            });
            setResetTokenValidationState(response.data ? ResetTokenValidationState.VALID : ResetTokenValidationState.INVALID);
        } catch (error) {
            handleError(error);
        }
    }

    async function submitHandler() {
        try {
            formState.disableForm();
            formState.setFormStatusMessage('info', t('resettingPassword'));

            const submitSuccessful = await formState.validateAndSendFormValuesToURL(FormSendMethod.POST, 'rest/password-reset');

            if (submitSuccessful) {
                navigateToWithFlashMessage('/login', 'success', t('passwordReset-1'));
            } else {
                formState.enableForm();
                formState.setFormStatusMessage('warning', t('thereAreErrorsInTheFormPleaseFixThemAnd'));
            }
        } catch (error) {
            if (error instanceof interoperableErrors.InvalidTokenError) {
                formState.setFormStatusMessage('danger',
                    <span>
                        <strong>{t('yourPasswordCannotBeReset')}</strong>{' '}
                        {t('thePasswordResetTokenHasExpired')}{' '}<Link to={`/login/forgot/${formState.getFormValue('username')}`}>{t('clickHereToRequestANewPasswordResetLink')}</Link>
                    </span>
                );
                return;
            }
            handleError(error);
        }
    }

    if (resetTokenValidationState === ResetTokenValidationState.PENDING) {
        return (
            <p>{t('validatingPasswordResetToken')}</p>
        );
    } else if (resetTokenValidationState === ResetTokenValidationState.INVALID) {
        return (
            <div>
                <Title>{t('thePasswordCannotBeReset')}</Title>
                <p>{t('thePasswordResetTokenHasExpired')}{' '}<Link to={`/login/forgot/${formState.getFormValue('username')}`}>{t('clickHereToRequestANewPasswordResetLink')}</Link></p>
            </div>
        );
    } else {
        return (
            <div>
                <Title>{t('setNewPasswordFor') + ' ' + formState.getFormValue('username')}</Title>

                <Form stateOwner={formState} onSubmitAsync={submitHandler}>
                    <InputField id="password" label={t('newPassword')} type="password"/>
                    <InputField id="password2" label={t('confirmPassword')} type="password"/>

                    <ButtonRow>
                        <Button type="submit" className="btn-primary" icon="check" label={t('resetPassword')}/>
                    </ButtonRow>
                </Form>
            </div>
        );
    }
}
