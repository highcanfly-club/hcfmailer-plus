'use strict';

import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from '../lib/i18n';
import { LinkButton, Title } from '../lib/page';
import {
    Button,
    ButtonRow,
    filterData,
    Form,
    FormSendMethod,
    InputField,
    TableSelect,
} from '../lib/form';
import { useForm } from '../lib/hooks/useForm';
import { useErrorHandling } from '../lib/hooks/useErrorHandling';
import { usePageHelpers } from '../lib/hooks/usePageHelpers';
import { useRequiresAuthenticatedUser } from '../lib/hooks/useRequiresAuthenticatedUser';
import interoperableErrors from '../../../shared/interoperable-errors';
import passwordValidator from '../../../shared/password-validator';
import mailtrainConfig from 'mailtrainConfig';
import { getDefaultNamespace, NamespaceSelect, validateNamespace } from '../lib/namespace';
import { DeleteModalDialog } from '../lib/modals';
import { enableDeleteModal } from '../settings/settings';

export default function CUD({ action, entity, permissions }) {
    const { t } = useTranslation();
    const { handleError } = useErrorHandling();
    const { navigateToWithFlashMessage } = usePageHelpers();
    useRequiresAuthenticatedUser();

    const pwValidator = passwordValidator(t);

    const formState = useForm({
        serverValidation: {
            url: 'rest/users-validate',
            changed: mailtrainConfig.isAuthMethodLocal ? ['username', 'email'] : ['username'],
            extra: ['id']
        },
        getFormValuesMutator: (data) => {
            data.password = '';
            data.password2 = '';
        },
        submitFormValuesMutator: (data) => {
            return filterData(data, ['username', 'name', 'email', 'password', 'namespace', 'role']);
        },
        localValidateFormValues: (state) => {
            const isEdit = !!entity;

            const username = state.getIn(['username', 'value']);
            const usernameServerValidation = state.getIn(['username', 'serverValidation']);

            if (!username) {
                state.setIn(['username', 'error'], t('userNameMustNotBeEmpty'));
            } else if (usernameServerValidation && usernameServerValidation.exists) {
                state.setIn(['username', 'error'], t('theUserNameAlreadyExistsInTheSystem'));
            } else if (!usernameServerValidation) {
                state.setIn(['username', 'error'], t('validationIsInProgress'));
            } else {
                state.setIn(['username', 'error'], null);
            }

            if (!state.getIn(['role', 'value'])) {
                state.setIn(['role', 'error'], t('roleMustBeSelected'));
            } else {
                state.setIn(['role', 'error'], null);
            }

            if (mailtrainConfig.isAuthMethodLocal) {
                const email = state.getIn(['email', 'value']);
                const emailServerValidation = state.getIn(['email', 'serverValidation']);

                if (!email) {
                    state.setIn(['email', 'error'], t('emailMustNotBeEmpty-1'));
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
                const passwordResults = pwValidator.test(password);

                let passwordMsgs = [];

                if (!isEdit && !password) {
                    passwordMsgs.push(t('passwordMustNotBeEmpty'));
                }

                if (password) {
                    passwordMsgs.push(...passwordResults.errors);
                }

                if (passwordMsgs.length > 1) {
                    passwordMsgs = passwordMsgs.map((msg, idx) => <div key={idx}>{msg}</div>);
                }

                state.setIn(['password', 'error'], passwordMsgs.length > 0 ? passwordMsgs : null);
                state.setIn(['password2', 'error'], password !== password2 ? t('passwordsMustMatch') : null);
            }

            validateNamespace(t, state);
        }
    });

    useEffect(() => {
        if (entity) {
            formState.getFormValuesFromEntity(entity);
        } else {
            formState.populateFormValues({
                username: '',
                name: '',
                email: '',
                password: '',
                password2: '',
                namespace: getDefaultNamespace(permissions),
                role: null
            });
        }
    }, []);

    async function submitHandler(submitAndLeave = false) {
        let sendMethod, url;
        if (entity) {
            sendMethod = FormSendMethod.PUT;
            url = `rest/users/${entity.id}`;
        } else {
            sendMethod = FormSendMethod.POST;
            url = 'rest/users';
        }

        try {
            formState.disableForm();
            formState.setFormStatusMessage('info', t('saving'));

            const submitResult = await formState.validateAndSendFormValuesToURL(sendMethod, url);

            if (submitResult) {
                if (entity) {
                    if (submitAndLeave) {
                        navigateToWithFlashMessage('/users', 'success', t('userUpdated'));
                    } else {
                        await formState.getFormValuesFromURL(`rest/users/${entity.id}`);
                        formState.enableForm();
                        formState.setFormStatusMessage('success', t('userUpdated'));
                    }
                } else {
                    if (submitAndLeave) {
                        navigateToWithFlashMessage('/users', 'success', t('userCreated'));
                    } else {
                        navigateToWithFlashMessage(`/users/${submitResult}/edit`, 'success', t('userCreated'));
                    }
                }
            } else {
                formState.enableForm();
                formState.setFormStatusMessage('warning', t('thereAreErrorsInTheFormPleaseFixThemAnd'));
            }
        } catch (error) {
            if (error instanceof interoperableErrors.DuplicitNameError) {
                formState.setFormStatusMessage('danger',
                    <span>
                        <strong>{t('yourUpdatesCannotBeSaved')}</strong>{' '}
                        {t('theUsernameIsAlreadyAssignedToAnother')}
                    </span>
                );
                return;
            }

            if (error instanceof interoperableErrors.DuplicitEmailError) {
                formState.setFormStatusMessage('danger',
                    <span>
                        <strong>{t('yourUpdatesCannotBeSaved')}</strong>{' '}
                        {t('theEmailIsAlreadyAssignedToAnotherUser-1')}
                    </span>
                );
                return;
            }

            handleError(error);
        }
    }

    const isEdit = !!entity;
    const userId = formState.getFormValue('id');
    const canDelete = isEdit && userId !== 1 && mailtrainConfig.user.id !== userId;

    const rolesColumns = [
        { data: 1, title: t('name') },
        { data: 2, title: t('description') },
    ];

    return (
        <div>
            {canDelete &&
                <DeleteModalDialog
                    stateOwner={formState}
                    visible={action === 'delete'}
                    deleteUrl={`rest/users/${entity.id}`}
                    backUrl={`/users/${entity.id}/edit`}
                    successUrl="/users"
                    deletingMsg={t('deletingUser')}
                    deletedMsg={t('userDeleted')}/>
            }

            <Title>{isEdit ? t('editUser') : t('createUser')}</Title>

            <Form stateOwner={formState} onSubmitAsync={submitHandler}>
                <InputField id="username" label={t('userName')}/>
                {mailtrainConfig.isAuthMethodLocal &&
                    <div>
                        <InputField id="name" label={t('fullName')}/>
                        <InputField id="email" label={t('email')}/>
                        <InputField id="password" label={t('password')} type="password"/>
                        <InputField id="password2" label={t('repeatPassword')} type="password"/>
                    </div>
                }
                <TableSelect id="role" label={t('role')} withHeader dropdown dataUrl={'rest/shares-roles-table/global'} columns={rolesColumns} selectionLabelIndex={1}/>
                <NamespaceSelect/>

                <ButtonRow>
                    <Button type="submit" className="btn-primary" icon="check" label={t('save')}/>
                    <Button type="submit" className="btn-primary" icon="check" label={t('saveAndLeave')} onClickAsync={() => submitHandler(true)}/>
                    {enableDeleteModal && canDelete && <LinkButton className="btn-danger" icon="trash-alt" label={t('deleteUser')} to={`/users/${entity.id}/delete`}/>}
                </ButtonRow>
            </Form>
        </div>
    );
}

CUD.propTypes = {
    action: PropTypes.string.isRequired,
    entity: PropTypes.object,
    permissions: PropTypes.object
};
