'use strict';

import React, { useEffect } from 'react';
import { useTranslation } from '../lib/i18n';
import { Title } from '../lib/page';
import { Link } from 'react-router-dom';
import {
    Button,
    ButtonRow,
    CheckBox,
    Form,
    FormSendMethod,
    InputField,
} from '../lib/form';
import { useForm } from '../lib/hooks/useForm';
import { useErrorHandling } from '../lib/hooks/useErrorHandling';
import qs from 'querystringify';
import interoperableErrors from '../../../shared/interoperable-errors';
import mailtrainConfig from 'mailtrainConfig';
import { getUrl } from '../lib/urls';

export default function Login({ location }) {
    const { t } = useTranslation();
    const { handleError } = useErrorHandling();

    const formState = useForm({
        leaveConfirmation: false,
        localValidateFormValues: (state) => {
            const username = state.getIn(['username', 'value']);
            if (!username) {
                state.setIn(['username', 'error'], t('userNameMustNotBeEmpty'));
            } else {
                state.setIn(['username', 'error'], null);
            }

            const password = state.getIn(['password', 'value']);
            if (!password) {
                state.setIn(['password', 'error'], t('passwordMustNotBeEmpty'));
            } else {
                state.setIn(['password', 'error'], null);
            }
        }
    });

    useEffect(() => {
        formState.populateFormValues({
            username: '',
            password: '',
            remember: false
        });
    }, []);

    async function submitHandler() {
        try {
            formState.disableForm();
            formState.setFormStatusMessage('info', t('verifyingCredentials'));

            const submitSuccessful = await formState.validateAndSendFormValuesToURL(FormSendMethod.POST, 'rest/login');

            if (submitSuccessful) {
                const unsafeUrl = qs.parse(location.search).next || '';
                const safeUrl = unsafeUrl.replace(/[^a-zA-Z0-9/\-]/g, '');
                const nextUrl = safeUrl || getUrl();
                window.location = nextUrl;
            } else {
                formState.enableForm();
                formState.setFormStatusMessage('warning', t('pleaseEnterYourCredentialsAndTryAgain'));
            }
        } catch (error) {
            if (error instanceof interoperableErrors.IncorrectPasswordError) {
                formState.enableForm();
                formState.setFormStatusMessage('danger',
                    <span>
                        <strong>{t('invalidUsernameOrPassword')}</strong>
                    </span>
                );
                return;
            }
            handleError(error);
        }
    }

    let passwordResetLink;
    if (mailtrainConfig.isAuthMethodLocal) {
        passwordResetLink = <Link to={`/login/forgot/${formState.getFormValue('username')}`}>{t('forgotYourPassword?')}</Link>;
    } else if (mailtrainConfig.externalPasswordResetLink) {
        passwordResetLink = <a href={mailtrainConfig.externalPasswordResetLink}>{t('forgotYourPassword?')}</a>;
    }

    if (mailtrainConfig.authMethod != 'cas') {
        return (
            <div>
                <Title>{t('signIn')}</Title>

                <Form stateOwner={formState} onSubmitAsync={submitHandler}>
                    <InputField id="username" label={t('username')}/>
                    <InputField id="password" label={t('password')} type="password" />
                    <CheckBox id="remember" text={t('rememberMe')}/>

                    <ButtonRow>
                        <Button type="submit" className="btn-primary" icon="check" label={t('signIn')}/>
                        {passwordResetLink}
                    </ButtonRow>
                </Form>
            </div>
        );
    } else {
        return (
            <div>
                <Title>{t('signIn')} CAS</Title>
                {<a href="/cas/login" class="btn btn-primary">{t('signIn')}</a>}
                {passwordResetLink}
            </div>
        );
    }
}
