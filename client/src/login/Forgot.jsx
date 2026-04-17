'use strict';

import React, { useEffect } from 'react';
import { useTranslation } from '../lib/i18n';
import { Title } from '../lib/page';
import { Button, ButtonRow, Form, FormSendMethod, InputField } from '../lib/form';
import { useForm } from '../lib/hooks/useForm';
import { useErrorHandling } from '../lib/hooks/useErrorHandling';
import { usePageHelpers } from '../lib/hooks/usePageHelpers';

export default function Forgot({ match }) {
    const { t } = useTranslation();
    const { handleError } = useErrorHandling();
    const { navigateToWithFlashMessage } = usePageHelpers();

    const formState = useForm({
        leaveConfirmation: false,
        localValidateFormValues: (state) => {
            const username = state.getIn(['usernameOrEmail', 'value']);
            if (!username) {
                state.setIn(['usernameOrEmail', 'error'], t('usernameOrEmailMustNotBeEmpty'));
            } else {
                state.setIn(['usernameOrEmail', 'error'], null);
            }
        }
    });

    useEffect(() => {
        formState.populateFormValues({
            usernameOrEmail: match.params.username || ''
        });
    }, []);

    async function submitHandler() {
        try {
            formState.disableForm();
            formState.setFormStatusMessage('info', t('processing-1'));

            const submitSuccessful = await formState.validateAndSendFormValuesToURL(FormSendMethod.POST, 'rest/password-reset-send');

            if (submitSuccessful) {
                navigateToWithFlashMessage('/login', 'success', t('ifTheUsernameEmailExistsInTheSystem'));
            } else {
                formState.enableForm();
                formState.setFormStatusMessage('warning', t('pleaseEnterYourUsernameEmailAndTryAgain'));
            }
        } catch (error) {
            handleError(error);
        }
    }

    return (
        <div>
            <Title>{t('passwordReset')}</Title>

            <p>{t('pleaseProvideTheUsernameOrEmailAddress')}</p>

            <p>{t('weWillSendYouAnEmailThatWillAllowYouTo')}</p>

            <Form stateOwner={formState} onSubmitAsync={submitHandler}>
                <InputField id="usernameOrEmail" label={t('usernameOrEmail')}/>

                <ButtonRow>
                    <Button type="submit" className="btn-primary" icon="check" label={t('sendEmail')}/>
                </ButtonRow>
            </Form>
        </div>
    );
}
