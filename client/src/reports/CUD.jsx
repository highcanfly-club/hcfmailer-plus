'use strict';

import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from '../lib/i18n';
import { LinkButton, Title } from '../lib/page';
import {
    Button,
    ButtonRow,
    Fieldset,
    filterData,
    Form,
    FormSendMethod,
    InputField,
    TableSelect,
    TableSelectMode,
    TextArea,
} from '../lib/form';
import axios from '../lib/axios';
import { useForm } from '../lib/hooks/useForm';
import { useErrorHandling } from '../lib/hooks/useErrorHandling';
import { usePageHelpers } from '../lib/hooks/usePageHelpers';
import { useRequiresAuthenticatedUser } from '../lib/hooks/useRequiresAuthenticatedUser';
import moment from 'moment';
import { getDefaultNamespace, NamespaceSelect, validateNamespace } from '../lib/namespace';
import { DeleteModalDialog } from "../lib/modals";
import { getUrl } from "../lib/urls";
import { enableDeleteModal } from "../settings/settings";

export default function CUD({ action, entity, permissions }) {
    useRequiresAuthenticatedUser();
    const { t } = useTranslation();
    const { handleError } = useErrorHandling();
    const { navigateToWithFlashMessage } = usePageHelpers();

    async function fetchUserFields(reportTemplateId) {
        try {
            const result = await axios.get(getUrl(`rest/report-template-user-fields/${reportTemplateId}`));
            formState.updateFormValue('user_fields', result.data);
        } catch (e) {
            handleError(e);
        }
    }

    const formState = useForm({
        onChange: {
            report_template: (state, key, oldVal, newVal) => {
                if (oldVal !== newVal) {
                    state.formState = state.formState.setIn(['data', 'user_fields', 'value'], '');

                    if (newVal) {
                        fetchUserFields(newVal);
                    }
                }
            }
        },
        getFormValuesMutator: (data) => {
            for (const key in data.params) {
                data[`param_${key}`] = data.params[key];
            }
        },
        submitFormValuesMutator: (data) => {
            const params = {};

            if (data.user_fields) {
                for (const spec of data.user_fields) {
                    const fldId = `param_${spec.id}`;
                    params[spec.id] = data[fldId];
                }
            }

            data.params = params;

            return filterData(data, ['name', 'description', 'report_template', 'params', 'namespace']);
        },
        localValidateFormValues: (state) => {
            if (!state.getIn(['name', 'value'])) {
                state.setIn(['name', 'error'], t('nameMustNotBeEmpty'));
            } else {
                state.setIn(['name', 'error'], null);
            }

            if (!state.getIn(['report_template', 'value'])) {
                state.setIn(['report_template', 'error'], t('reportTemplateMustBeSelected'));
            } else {
                state.setIn(['report_template', 'error'], null);
            }

            for (const paramId of state.keys()) {
                if (paramId.startsWith('param_')) {
                    state.deleteIn([paramId, 'error']);
                }
            }

            const userFieldsSpec = state.getIn(['user_fields', 'value']);
            if (userFieldsSpec) {
                for (const spec of userFieldsSpec) {
                    const fldId = `param_${spec.id}`;
                    const selection = state.getIn([fldId, 'value']) || [];

                    if (spec.maxOccurences === 1) {
                        if (spec.minOccurences === 1 && (selection === null || selection === undefined)) {
                            state.setIn([fldId, 'error'], t('exactlyOneItemHasToBeSelected'));
                        }
                    } else {
                        if (selection.length < spec.minOccurences) {
                            state.setIn([fldId, 'error'], t('atLeastCountItemsHaveToBeSelected', { count: spec.minOccurences }));
                        } else if (selection.length > spec.maxOccurences) {
                            state.setIn([fldId, 'error'], t('atMostCountItemsCanToBeSelected', { count: spec.maxOccurences }));
                        }
                    }
                }
            }

            validateNamespace(t, state);
        }
    });

    useEffect(() => {
        if (entity) {
            formState.getFormValuesFromEntity(entity);
        } else {
            formState.populateFormValues({
                name: '',
                description: '',
                report_template: null,
                namespace: getDefaultNamespace(permissions),
                user_fields: null
            });
        }
    }, []);

    async function submitHandler(submitAndLeave) {
        if (formState.getFormValue('report_template') && !formState.getFormValue('user_fields')) {
            formState.setFormStatusMessage('warning', t('reportParametersAreNotSelectedWaitFor'));
            return;
        }

        let sendMethod, url;
        if (entity) {
            sendMethod = FormSendMethod.PUT;
            url = `rest/reports/${entity.id}`;
        } else {
            sendMethod = FormSendMethod.POST;
            url = 'rest/reports';
        }

        try {
            formState.disableForm();
            formState.setFormStatusMessage('info', t('saving'));

            const submitResult = await formState.validateAndSendFormValuesToURL(sendMethod, url);

            if (submitResult) {
                if (entity) {
                    if (submitAndLeave) {
                        navigateToWithFlashMessage('/reports', 'success', t('reportUpdated'));
                    } else {
                        await formState.getFormValuesFromURL(`rest/reports/${entity.id}`).catch(handleError);
                        formState.enableForm();
                        formState.setFormStatusMessage('success', t('reportUpdated'));
                    }
                } else {
                    if (submitAndLeave) {
                        navigateToWithFlashMessage('/reports', 'success', t('reportCreated'));
                    } else {
                        navigateToWithFlashMessage(`/reports/${submitResult}/edit`, 'success', t('reportCreated'));
                    }
                }
            } else {
                formState.enableForm();
                formState.setFormStatusMessage('warning', t('thereAreErrorsInTheFormPleaseFixThemAnd'));
            }
        } catch (e) {
            handleError(e);
        }
    }

    const isEdit = !!entity;
    const canDelete = isEdit && entity.permissions.includes('delete');

    const reportTemplateColumns = [
        { data: 1, title: t('name') },
        { data: 2, title: t('description') },
        { data: 3, title: t('created'), render: data => moment(data).fromNow() }
    ];

    const userFieldsSpec = formState.getFormValue('user_fields');
    const userFields = [];

    function addUserFieldTableSelect(spec, dataUrl, selIndex, columns) {
        let dropdown, selectMode;

        if (spec.maxOccurences === 1) {
            dropdown = true;
            selectMode = TableSelectMode.SINGLE;
        } else {
            dropdown = true;
            selectMode = TableSelectMode.MULTI;
        }

        const fld = <TableSelect key={spec.id} id={`param_${spec.id}`} label={spec.name} selectionAsArray withHeader dropdown={dropdown} selectMode={selectMode} dataUrl={dataUrl} columns={columns} selectionLabelIndex={selIndex}/>;

        userFields.push(fld);
    }

    if (userFieldsSpec) {
        for (const spec of userFieldsSpec) {
            if (spec.type === 'campaign') {
                addUserFieldTableSelect(spec, 'rest/campaigns-table', 1, [
                    { data: 0, title: "#" },
                    { data: 1, title: t('name') },
                    { data: 2, title: t('description') },
                    { data: 3, title: t('status') },
                    { data: 4, title: t('created'), render: data => moment(data).fromNow() }
                ]);
            } else if (spec.type === 'list') {
                addUserFieldTableSelect(spec, 'rest/lists-table', 1, [
                    { data: 0, title: "#" },
                    { data: 1, title: t('name') },
                    { data: 2, title: t('id') },
                    { data: 3, title: t('subscribers') },
                    { data: 4, title: t('description') }
                ]);
            } else {
                userFields.push(<div className="alert alert-danger" role="alert">{t('unknownFieldTypeType', { type: spec.type })}</div>);
            }
        }
    }

    return (
        <div>
            {canDelete &&
                <DeleteModalDialog
                    stateOwner={formState}
                    visible={action === 'delete'}
                    deleteUrl={`rest/reports/${entity.id}`}
                    backUrl={`/reports/${entity.id}/edit`}
                    successUrl="/reports"
                    deletingMsg={t('deletingReport')}
                    deletedMsg={t('reportDeleted')}/>
            }

            <Title>{isEdit ? t('editReport') : t('createReport')}</Title>

            <Form stateOwner={formState} onSubmitAsync={(...args) => submitHandler(...args)}>
                <InputField id="name" label={t('name')}/>
                <TextArea id="description" label={t('description')}/>

                <TableSelect id="report_template" label={t('reportTemplate-1')} withHeader dropdown dataUrl="rest/report-templates-table" columns={reportTemplateColumns} selectionLabelIndex={1}/>

                <NamespaceSelect/>

                {userFieldsSpec ?
                    userFields.length > 0 &&
                        <Fieldset label={t('reportParameters')}>
                            {userFields}
                        </Fieldset>
                :
                    formState.getFormValue('report_template') &&
                        <div className="alert alert-info" role="alert">{t('loadingReportTemplate')}</div>
                }

                <ButtonRow>
                    <Button type="submit" className="btn-primary" icon="check" label={t('save')}/>
                    <Button type="submit" className="btn-primary" icon="check" label={t('saveAndLeave')} onClickAsync={async () => await submitHandler(true)}/>
                    {enableDeleteModal && canDelete &&
                        <LinkButton className="btn-danger" icon="trash-alt" label={t('delete')} to={`/reports/${entity.id}/delete`}/>
                    }
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
