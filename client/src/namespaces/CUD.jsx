'use strict';

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from '../lib/i18n';
import { LinkButton, requiresAuthenticatedUser, Title, withPageHelpers } from '../lib/page';
import {
    Button,
    ButtonRow,
    filterData,
    Form,
    FormSendMethod,
    InputField,
    TextArea,
    TreeTableSelect,
} from '../lib/form';
import axios from '../lib/axios';
import { useErrorHandling } from '../lib/hooks/useErrorHandling';
import { usePageHelpers } from '../lib/hooks/usePageHelpers';
import { useRequiresAuthenticatedUser } from '../lib/hooks/useRequiresAuthenticatedUser';
import { useForm } from '../lib/hooks/useForm';
import interoperableErrors from '../../../shared/interoperable-errors';
import { DeleteModalDialog } from '../lib/modals';
import mailtrainConfig from 'mailtrainConfig';
import { getGlobalNamespaceId } from '../../../shared/namespaces';
import { getUrl } from '../lib/urls';
import { getDefaultNamespace } from '../lib/namespace';
import { enableDeleteModal } from '../settings/settings';

export default function CUD({ action, entity, permissions }) {
    const { t } = useTranslation();
    const { handleError } = useErrorHandling();
    const { navigateToWithFlashMessage } = usePageHelpers();
    useRequiresAuthenticatedUser();

    const [treeData, setTreeData] = useState(undefined);

    const isEditGlobal = () => entity && entity.id === getGlobalNamespaceId();

    const formState = useForm({
        submitFormValuesMutator: (data) => {
            return filterData(data, ['name', 'description', 'namespace']);
        },
        localValidateFormValues: (state) => {
            if (!state.getIn(['name', 'value']).trim()) {
                state.setIn(['name', 'error'], t('nameMustNotBeEmpty'));
            } else {
                state.setIn(['name', 'error'], null);
            }

            if (!isEditGlobal()) {
                if (!state.getIn(['namespace', 'value'])) {
                    state.setIn(['namespace', 'error'], t('parentNamespaceMustBeSelected'));
                } else {
                    state.setIn(['namespace', 'error'], null);
                }
            }
        }
    });

    async function loadTreeData() {
        try {
            if (!isEditGlobal()) {
                const response = await axios.get(getUrl('rest/namespaces-tree'));
                const data = response.data;
                for (const root of data) {
                    root.expanded = true;
                }

                if (entity && !isEditGlobal()) {
                    removeNsIdSubtree(data);
                }

                setTreeData(data);
            }
        } catch (error) {
            handleError(error);
        }
    }

    function removeNsIdSubtree(data) {
        for (let idx = 0; idx < data.length; idx++) {
            const entry = data[idx];
            if (entry.key === entity.id) {
                data.splice(idx, 1);
                return true;
            }
            if (removeNsIdSubtree(entry.children)) {
                return true;
            }
        }
    }

    useEffect(() => {
        if (entity) {
            formState.getFormValuesFromEntity(entity);
        } else {
            formState.populateFormValues({
                name: '',
                description: '',
                namespace: getDefaultNamespace(permissions)
            });
        }

        loadTreeData();
    }, []);

    async function submitHandler(submitAndLeave = false) {
        let sendMethod, url;
        if (entity) {
            sendMethod = FormSendMethod.PUT;
            url = `rest/namespaces/${entity.id}`;
        } else {
            sendMethod = FormSendMethod.POST;
            url = 'rest/namespaces';
        }

        try {
            formState.disableForm();
            formState.setFormStatusMessage('info', t('saving'));

            const submitResult = await formState.validateAndSendFormValuesToURL(sendMethod, url);

            if (submitResult) {
                if (entity) {
                    if (submitAndLeave) {
                        navigateToWithFlashMessage('/namespaces', 'success', t('namespaceUpdated'));
                    } else {
                        await formState.getFormValuesFromURL(`rest/namespaces/${entity.id}`);
                        await loadTreeData();
                        formState.enableForm();
                        formState.setFormStatusMessage('success', t('namespaceUpdated'));
                    }
                } else {
                    if (submitAndLeave) {
                        navigateToWithFlashMessage('/namespaces', 'success', t('namespaceCreated'));
                    } else {
                        navigateToWithFlashMessage(`/namespaces/${submitResult}/edit`, 'success', t('namespaceCreated'));
                    }
                }
            } else {
                formState.enableForm();
                formState.setFormStatusMessage('warning', t('thereAreErrorsInTheFormPleaseFixThemAnd'));
            }
        } catch (error) {
            if (error instanceof interoperableErrors.LoopDetectedError) {
                formState.setFormStatusMessage('danger',
                    <span>
                        <strong>{t('yourUpdatesCannotBeSaved')}</strong>{' '}
                        {t('thereHasBeenALoopDetectedInTheAssignment')}
                    </span>
                );
                return;
            }

            if (error instanceof interoperableErrors.DependencyNotFoundError) {
                formState.setFormStatusMessage('danger',
                    <span>
                        <strong>{t('yourUpdatesCannotBeSaved')}</strong>{' '}
                        {t('itSeemsThatTheParentNamespaceHasBeen')}
                    </span>
                );
                return;
            }

            handleError(error);
        }
    }

    const isEdit = !!entity;
    const canDelete = isEdit && !isEditGlobal() && mailtrainConfig.user.namespace !== entity.id && entity.permissions.includes('delete');

    return (
        <div>
            {canDelete &&
                <DeleteModalDialog
                    stateOwner={formState}
                    visible={action === 'delete'}
                    deleteUrl={`rest/namespaces/${entity.id}`}
                    backUrl={`/namespaces/${entity.id}/edit`}
                    successUrl="/namespaces"
                    deletingMsg={t('deletingNamespace')}
                    deletedMsg={t('namespaceDeleted')} />
            }

            <Title>{isEdit ? t('editNamespace') : t('createNamespace')}</Title>

            <Form stateOwner={formState} onSubmitAsync={submitHandler}>
                <InputField id="name" label={t('name')}/>
                <TextArea id="description" label={t('description')}/>

                {!isEditGlobal() &&
                    <TreeTableSelect id="namespace" label={t('parentNamespace')} data={treeData}/>}

                <ButtonRow>
                    <Button type="submit" className="btn-primary" icon="check" label={t('save')}/>
                    <Button type="submit" className="btn-primary" icon="check" label={t('saveAndLeave')} onClickAsync={() => submitHandler(true)}/>
                    {enableDeleteModal && canDelete && <LinkButton className="btn-danger" icon="trash-alt" label={t('delete')} to={`/namespaces/${entity.id}/delete`}/>}
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
