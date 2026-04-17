'use strict';

import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from '../../lib/i18n';
import { LinkButton, Title } from '../../lib/page';
import {
    AlignedRow,
    Button,
    ButtonRow,
    CheckBox,
    Dropdown,
    Fieldset,
    filterData,
    Form,
    FormSendMethod,
    InputField,
    StaticField,
    TextArea,
} from '../../lib/form';
import { useForm } from '../../lib/hooks/useForm';
import { useErrorHandling } from '../../lib/hooks/useErrorHandling';
import { usePageHelpers } from '../../lib/hooks/usePageHelpers';
import { useRequiresAuthenticatedUser } from '../../lib/hooks/useRequiresAuthenticatedUser';
import { DeleteModalDialog } from "../../lib/modals";
import { getImportLabels } from './helpers';
import { ImportSource, inProgress, MappingType, prepInProgress, prepFinished } from '../../../../shared/imports';
import axios from "../../lib/axios";
import { getUrl } from "../../lib/urls";
import listStyles from "../styles.module.scss";
import "../../lib/styles.scss";
import interoperableErrors from "../../../../shared/interoperable-errors";


function truncate(str, len, ending = '...') {
    str = str.trim();
    if (str.length > len) {
        return str.substring(0, len - ending.length) + ending;
    } else {
        return str;
    }
}


export default function CUD({ action, list, fieldsGrouped, entity }) {
    useRequiresAuthenticatedUser();
    const { t } = useTranslation();
    const { handleError } = useErrorHandling();
    const { navigateTo, navigateToWithFlashMessage } = usePageHelpers();

    const { importSourceLabels, mappingTypeLabels } = getImportLabels(t);

    const importSourceOptions = [
        { key: ImportSource.CSV_FILE, label: importSourceLabels[ImportSource.CSV_FILE] },
    ];

    const mappingOptions = [
        { key: MappingType.BASIC_SUBSCRIBE, label: mappingTypeLabels[MappingType.BASIC_SUBSCRIBE] },
        { key: MappingType.BASIC_UNSUBSCRIBE, label: mappingTypeLabels[MappingType.BASIC_UNSUBSCRIBE] },
    ];

    const csvFileRef = useRef(null);
    const refreshTimeoutIdRef = useRef(0);

    const formState = useForm({
        getFormValuesMutator: (data) => {
            data.settings = data.settings || {};
            const mapping = data.mapping || {};

            if (data.source === ImportSource.CSV_FILE) {
                data.csvFileName = data.settings.csv.originalname;
                data.csvDelimiter = data.settings.csv.delimiter;
            }

            const mappingSettings = mapping.settings || {};
            data.mapping_settings_checkEmails = 'checkEmails' in mappingSettings ? !!mappingSettings.checkEmails : true;

            const mappingFlds = mapping.fields || {};
            for (const field of fieldsGrouped) {
                if (field.column) {
                    const colMapping = mappingFlds[field.column] || {};
                    data['mapping_fields_' + field.column + '_column'] = colMapping.column || '';
                } else {
                    for (const option of field.settings.options) {
                        const col = field.groupedOptions[option.key].column;
                        const colMapping = mappingFlds[col] || {};
                        data['mapping_fields_' + col + '_column'] = colMapping.column || '';
                    }
                }
            }

            const emailMapping = mappingFlds.email || {};
            data.mapping_fields_email_column = emailMapping.column || '';
        },
        submitFormValuesMutator: (data, isSubmit) => {
            const isEdit = !!entity;

            data.source = Number.parseInt(data.source);
            data.settings = {};

            let formData, csvFileSelected = false;
            if (isSubmit) {
                formData = new FormData();
            }

            if (!isEdit) {
                if (data.source === ImportSource.CSV_FILE) {
                    data.settings.csv = {};

                    if (csvFileRef.current && csvFileRef.current.files && csvFileRef.current.files.length > 0) {
                        if (isSubmit) {
                            formData.append('csvFile', csvFileRef.current.files[0]);
                        } else {
                            csvFileSelected = true;
                        }
                    }

                    data.settings.csv.delimiter = data.csvDelimiter.trim();
                }
            } else {
                data.mapping_type = Number.parseInt(data.mapping_type);
                const mapping = { fields: {}, settings: {} };

                if (data.mapping_type === MappingType.BASIC_SUBSCRIBE) {
                    mapping.settings.checkEmails = data.mapping_settings_checkEmails;

                    for (const field of fieldsGrouped) {
                        if (field.column) {
                            const colMapping = data['mapping_fields_' + field.column + '_column'];
                            if (colMapping) {
                                mapping.fields[field.column] = { column: colMapping };
                            }
                        } else {
                            for (const option of field.settings.options) {
                                const col = field.groupedOptions[option.key].column;
                                const colMapping = data['mapping_fields_' + col + '_column'];
                                if (colMapping) {
                                    mapping.fields[col] = { column: colMapping };
                                }
                            }
                        }
                    }
                }

                if (data.mapping_type === MappingType.BASIC_SUBSCRIBE || data.mapping_type === MappingType.BASIC_UNSUBSCRIBE) {
                    mapping.fields.email = { column: data.mapping_fields_email_column };
                }

                data.mapping = mapping;
            }

            if (isSubmit) {
                formData.append('entity', JSON.stringify(
                    filterData(data, ['name', 'description', 'source', 'settings', 'mapping_type', 'mapping'])
                ));
                return formData;
            } else {
                const filteredData = filterData(data, ['name', 'description', 'source', 'settings', 'mapping_type', 'mapping']);
                if (csvFileSelected) {
                    filteredData.csvFileSelected = true;
                }
                return filteredData;
            }
        },
        localValidateFormValues: (state) => {
            const isEdit = !!entity;
            const source = Number.parseInt(state.getIn(['source', 'value']));

            for (const key of state.keys()) {
                state.setIn([key, 'error'], null);
            }

            if (!state.getIn(['name', 'value'])) {
                state.setIn(['name', 'error'], t('nameMustNotBeEmpty'));
            }

            if (!isEdit) {
                if (source === ImportSource.CSV_FILE) {
                    if (!csvFileRef.current || csvFileRef.current.files.length === 0) {
                        state.setIn(['csvFileName', 'error'], t('fileMustBeSelected'));
                    }

                    if (!state.getIn(['csvDelimiter', 'value']).trim()) {
                        state.setIn(['csvDelimiter', 'error'], t('csvDelimiterMustNotBeEmpty'));
                    }
                }
            } else {
                const mappingType = Number.parseInt(state.getIn(['mapping_type', 'value']));

                if (mappingType === MappingType.BASIC_SUBSCRIBE || mappingType === MappingType.BASIC_UNSUBSCRIBE) {
                    if (!state.getIn(['mapping_fields_email_column', 'value'])) {
                        state.setIn(['mapping_fields_email_column', 'error'], t('emailMappingHasToBeProvided'));
                    }
                }
            }
        }
    });

    function initFromEntity(entityData) {
        formState.getFormValuesFromEntity(entityData);

        if (inProgress(entityData.status)) {
            refreshTimeoutIdRef.current = setTimeout(refreshEntity, 1000);
        }
    }

    async function refreshEntity() {
        try {
            const resp = await axios.get(getUrl(`rest/imports/${list.id}/${entity.id}`));
            initFromEntity(resp.data);
        } catch (e) {
            handleError(e);
        }
    }

    useEffect(() => {
        if (entity) {
            initFromEntity(entity);
        } else {
            formState.populateFormValues({
                name: '',
                description: '',
                source: ImportSource.CSV_FILE,
                csvFileName: '',
                csvDelimiter: ',',
            });
        }

        return () => {
            clearTimeout(refreshTimeoutIdRef.current);
        };
    }, []);

    async function submitHandler() {
        await save();
    }

    async function save(runAfterSave) {
        const isEdit = !!entity;

        let sendMethod, url;
        if (entity) {
            sendMethod = FormSendMethod.PUT;
            url = `rest/imports/${list.id}/${entity.id}`;
        } else {
            sendMethod = FormSendMethod.POST;
            url = `rest/imports/${list.id}`;
        }

        try {
            formState.disableForm();
            formState.setFormStatusMessage('info', t('saving'));

            const submitResponse = await formState.validateAndSendFormValuesToURL(sendMethod, url);

            if (submitResponse) {
                if (!isEdit) {
                    navigateTo(`/lists/${list.id}/imports/${submitResponse}/edit`);
                } else {
                    if (runAfterSave) {
                        try {
                            await axios.post(getUrl(`rest/import-start/${list.id}/${entity.id}`));
                        } catch (err) {
                            if (err instanceof interoperableErrors.InvalidStateError) {
                                // mask
                            } else {
                                throw err;
                            }
                        }
                    }

                    navigateToWithFlashMessage(`/lists/${list.id}/imports/${entity.id}/status`, 'success', t('importSaved'));
                }
            } else {
                formState.enableForm();
                formState.setFormStatusMessage('warning', t('thereAreErrorsInTheFormPleaseFixThemAnd'));
            }
        } catch (error) {
            handleError(error);
        }
    }

    function onFileSelected() {
        if (!formState.getFormValue('name') && csvFileRef.current.files.length > 0) {
            formState.updateFormValue('name', csvFileRef.current.files[0].name);
        }
        formState.scheduleFormRevalidate();
    }

    const isEdit = !!entity;
    const source = Number.parseInt(formState.getFormValue('source'));
    const status = formState.getFormValue('status');
    const settings = formState.getFormValue('settings');

    let settingsEdit = null;
    if (source === ImportSource.CSV_FILE) {
        if (isEdit) {
            settingsEdit =
                <div>
                    <StaticField id="csvFileName" className={"formDisabled"} label={t('file')}>{formState.getFormValue('csvFileName')}</StaticField>
                    <StaticField id="csvDelimiter" className={"formDisabled"} label={t('delimiter')}>{formState.getFormValue('csvDelimiter')}</StaticField>
                </div>;
        } else {
            settingsEdit =
                <div>
                    <AlignedRow label={t('file')}><input ref={csvFileRef} type="file" className="form-control-file" onChange={() => onFileSelected()}/></AlignedRow>
                    <InputField id="csvDelimiter" label={t('delimiter')}/>
                </div>;
        }
    }

    let mappingEdit;
    if (isEdit) {
        if (prepInProgress(status)) {
            mappingEdit = (
                <div>{t('preparationInProgressPleaseWaitTillItIs')}</div>
            );
        } else {
            let mappingSettings = null;
            const mappingType = Number.parseInt(formState.getFormValue('mapping_type'));

            if (mappingType === MappingType.BASIC_SUBSCRIBE || mappingType === MappingType.BASIC_UNSUBSCRIBE) {
                const sampleRow = formState.getFormValue('sampleRow');
                const sourceOpts = [];
                sourceOpts.push({ key: '', label: t('––Select ––') });
                if (source === ImportSource.CSV_FILE) {
                    for (const csvCol of settings.csv.columns) {
                        let help = '';
                        if (sampleRow) {
                            help = ' (' + t('eg', { keySeparator: '>', nsSeparator: '|' }) + ' ' + truncate(sampleRow[csvCol.column], 50) + ')';
                        }
                        sourceOpts.push({ key: csvCol.column, label: csvCol.name + help });
                    }
                }

                const settingsRows = [];
                const mappingRows = [
                    <Dropdown key="email" id="mapping_fields_email_column" label={t('email')} options={sourceOpts}/>
                ];

                if (mappingType === MappingType.BASIC_SUBSCRIBE) {
                    settingsRows.push(<CheckBox key="checkEmails" id="mapping_settings_checkEmails" text={t('checkImportedEmails')}/>);

                    for (const field of fieldsGrouped) {
                        if (field.column) {
                            mappingRows.push(
                                <Dropdown key={field.column} id={'mapping_fields_' + field.column + '_column'} label={field.name} options={sourceOpts}/>
                            );
                        } else {
                            for (const option of field.settings.options) {
                                const col = field.groupedOptions[option.key].column;
                                mappingRows.push(
                                    <Dropdown key={col} id={'mapping_fields_' + col + '_column'} label={field.groupedOptions[option.key].name} options={sourceOpts}/>
                                );
                            }
                        }
                    }
                }

                mappingSettings = (
                    <div>
                        {settingsRows}
                        <Fieldset label={t('mapping')} className={listStyles.mapping}>
                            {mappingRows}
                        </Fieldset>
                    </div>
                );
            }

            mappingEdit = (
                <div>
                    <Dropdown id="mapping_type" label={t('type')} options={mappingOptions}/>
                    {mappingSettings}
                </div>
            );
        }
    }

    const saveButtons = [];
    if (!isEdit) {
        saveButtons.push(<Button key="default" type="submit" className="btn-primary" icon="check" label={t('saveAndEditSettings')}/>);
    } else {
        if (prepFinished(status)) {
            saveButtons.push(<Button key="default" type="submit" className="btn-primary" icon="check" label={t('save')}/>);
            saveButtons.push(<Button key="saveAndRun" className="btn-primary" icon="check" label={t('saveAndRun')} onClickAsync={async () => await save(true)}/>);
        }
    }

    return (
        <div>
            {isEdit &&
                <DeleteModalDialog
                    stateOwner={formState}
                    visible={action === 'delete'}
                    deleteUrl={`rest/imports/${list.id}/${entity.id}`}
                    backUrl={`/lists/${list.id}/imports/${entity.id}/edit`}
                    successUrl={`/lists/${list.id}/imports`}
                    deletingMsg={t('deletingImport')}
                    deletedMsg={t('importDeleted')}/>
            }

            <Title>{isEdit ? t('editImport') : t('createImport')}</Title>

            <Form stateOwner={formState} onSubmitAsync={(...args) => submitHandler(...args)}>
                <InputField id="name" label={t('name')}/>
                <TextArea id="description" label={t('description')}/>

                {isEdit ?
                    <StaticField id="source" className={"formDisabled"} label={t('source')}>{importSourceLabels[formState.getFormValue('source')]}</StaticField>
                :
                    <Dropdown id="source" label={t('source')} options={importSourceOptions}/>
                }

                {settingsEdit}

                {mappingEdit}

                <ButtonRow>
                    {saveButtons}
                    {isEdit && <LinkButton className="btn-danger" icon="trash-alt" label={t('delete')} to={`/lists/${list.id}/imports/${entity.id}/delete`}/>}
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
