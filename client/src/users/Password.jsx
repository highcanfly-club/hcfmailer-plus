'use strict';

import React, { useEffect } from 'react';
import { useTranslation } from '../lib/i18n';
import { Title } from '../lib/page';
import { Button, ButtonRow, filterData, Form, FormSendMethod, InputField } from '../lib/form';
import { useForm } from '../lib/hooks/useForm';
import { useErrorHandling } from '../lib/hooks/useErrorHandling';
import { usePageHelpers } from '../lib/hooks/usePageHelpers';
import { useRequiresAuthenticatedUser } from '../lib/hooks/useRequiresAuthenticatedUser';
import passwordValidator from '../../../shared/password-validator';

export default function Password({ entity }) {
    const { t } = useTranslation();
    const { handleError } = useErrorHandling();
    const { navigateToWithFlashMessage } = usePageHelpers();
    useRequiresAuthenticatedUser();

    const pwValidator = passwordValidator(t);

    const formState = useForm({
        submitFormValuesMutator: (data) => filterData(data, ['password']),
        localValidateFormValues: (state) => {
            const password = state.getIn(['password', 'value']) || '';
            const password2 = state.getIn(['password2', 'value']) || '';

            let passwordMsgs = password ? [...pwValidator.test(password).errors] : [t('passwordMustNotBeEmpty')];

            if (passwordMsgs.length > 1) {
                passwordMsgs = passwordMsgs.map((msg, idx) => <div key={idx}>{msg}</div>);
            }

            state.setIn(['password', 'error'], passwordMsgs.length > 0 ? passwordMsgs : null);
            state.setIn(['password2', 'error'], password !== password2 ? t('passwordsMustMatch') : null);
        }
    });

    useEffect(() => {
        formState.populateFormValues({ password: '', password2: '' });
    }, []);

    async function submitHandler() {
        try {
            formState.disableForm();
            formState.setFormStatusMessage('info', t('saving'));

            const submitResult = await formState.validateAndSendFormValuesToURL(FormSendMethod.PUT, `rest/users/${entity.id}/password`);

            if (submitResult) {
                navigateToWithFlashMessage('/users', 'success', t('passwordUpdated'));
            } else {
                formState.enableForm();
                formState.setFormStatusMessage('warning', t('thereAreErrorsInTheFormPleaseFixThemAnd'));
            }
        } catch (error) {
            handleError(error);
        }
    }

    return (
        <div>
            <Title>{t('setPassword')}</Title>

            <Form stateOwner={formState} onSubmitAsync={submitHandler}>
                <InputField id="password" label={t('newPassword')} type="password" />
                <InputField id="password2" label={t('confirmPassword')} type="password" />

                <ButtonRow>
                    <Button type="submit" className="btn-primary" icon="check" label={t('update')}/>
                </ButtonRow>
            </Form>
        </div>
    );
}
