'use strict';

import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { Trans } from 'react-i18next';
import { useTranslation } from '../../lib/i18n';
import { LinkButton, Title } from '../../lib/page';
import {
    ACEEditor,
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
    TableSelect,
    TextArea,
} from '../../lib/form';
import { useForm } from '../../lib/hooks/useForm';
import { useErrorHandling } from '../../lib/hooks/useErrorHandling';
import { usePageHelpers } from '../../lib/hooks/usePageHelpers';
import { useRequiresAuthenticatedUser } from '../../lib/hooks/useRequiresAuthenticatedUser';
import { DeleteModalDialog } from "../../lib/modals";
import { getFieldTypes } from './helpers';
import validators from '../../../../shared/validators';
import slugify from 'slugify';
import { DateFormat, parseBirthday, parseDate } from '../../../../shared/date';
import "../../lib/styles.scss";
import 'ace-builds/src-noconflict/mode-json';
import 'ace-builds/src-noconflict/mode-handlebars';

export default function CUD({ action, list, fields, entity }) {
    useRequiresAuthenticatedUser();
    const { t } = useTranslation();
    const { handleError } = useErrorHandling();
    const { navigateToWithFlashMessage } = usePageHelpers();

    const fieldTypes = getFieldTypes(t);

    function parseEnumOptions(text) {
        const errors = [];
        const options = [];

        const lines = text.split('\n');
        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
            const line = lines[lineIdx].trim();

            if (line != '') {
                const matches = line.match(/^([^|]*)[|](.*)$/);
                if (matches) {
                    const key = matches[1].trim();
                    const label = matches[2].trim();
                    options.push({ key, label });
                } else {
                    errors.push(t('errorOnLineLine', { line: lineIdx + 1 }));
                }
            }
        }

        if (errors.length) {
            return { errors };
        } else {
            return { options };
        }
    }

    function renderEnumOptions(options) {
        return options.map(opt => `${opt.key}|${opt.label}`).join('\n');
    }

    function onChangeName(mutStateData, attr, oldValue, newValue) {
        const oldComputedKey = ('MERGE_' + slugify(oldValue, '_')).toUpperCase().replace(/[^A-Z0-9_]/g, '');
        const oldKey = mutStateData.getIn(['key', 'value']);

        if (oldKey === '' || oldKey === oldComputedKey) {
            const newKey = ('MERGE_' + slugify(newValue, '_')).toUpperCase().replace(/[^A-Z0-9_]/g, '');
            mutStateData.setIn(['key', 'value'], newKey);
        }
    }

    const formState = useForm({
        serverValidation: {
            url: `rest/fields-validate/${list.id}`,
            changed: ['key'],
            extra: ['id']
        },
        onChangeBeforeValidation: {
            name: (...args) => onChangeName(...args)
        },
        getFormValuesMutator: (data) => {
            data.settings = data.settings || {};

            if (data.default_value === null) {
                data.default_value = '';
            }

            if (data.help === null) {
                data.help = '';
            }

            data.isInGroup = data.group !== null;

            data.enumOptions = '';
            data.dateFormat = DateFormat.EU;
            data.renderTemplate = '';

            switch (data.type) {
                case 'checkbox-grouped':
                case 'radio-grouped':
                case 'dropdown-grouped':
                case 'json':
                    data.renderTemplate = data.settings.renderTemplate;
                    break;

                case 'radio-enum':
                case 'dropdown-enum':
                    data.enumOptions = renderEnumOptions(data.settings.options);
                    data.renderTemplate = data.settings.renderTemplate;
                    break;

                case 'date':
                case 'birthday':
                    data.dateFormat = data.settings.dateFormat;
                    break;

                case 'option':
                    data.checkedLabel = data.isInGroup ? '' : data.settings.checkedLabel;
                    data.uncheckedLabel = data.isInGroup ? '' : data.settings.uncheckedLabel;
                    break;
            }

            data.orderListBefore = data.orderListBefore.toString();
            data.orderSubscribeBefore = data.orderSubscribeBefore.toString();
            data.orderManageBefore = data.orderManageBefore.toString();
        },
        submitFormValuesMutator: (data) => {
            if (data.default_value.trim() === '') {
                data.default_value = null;
            }

            if (data.help.trim() === '') {
                data.help = null;
            }

            if (!data.isInGroup) {
                data.group = null;
            }

            data.settings = {};
            switch (data.type) {
                case 'checkbox-grouped':
                case 'radio-grouped':
                case 'dropdown-grouped':
                case 'json':
                    data.settings.renderTemplate = data.renderTemplate;
                    break;

                case 'radio-enum':
                case 'dropdown-enum':
                    data.settings.options = parseEnumOptions(data.enumOptions).options;
                    data.settings.renderTemplate = data.renderTemplate;
                    break;

                case 'date':
                case 'birthday':
                    data.settings.dateFormat = data.dateFormat;
                    break;

                case 'option':
                    if (!data.isInGroup) {
                        data.settings.checkedLabel = data.checkedLabel;
                        data.settings.uncheckedLabel = data.uncheckedLabel;
                    }
                    break;
            }

            if (data.group !== null) {
                data.orderListBefore = data.orderSubscribeBefore = data.orderManageBefore = 'none';
            } else {
                data.orderListBefore = Number.parseInt(data.orderListBefore) || data.orderListBefore;
                data.orderSubscribeBefore = Number.parseInt(data.orderSubscribeBefore) || data.orderSubscribeBefore;
                data.orderManageBefore = Number.parseInt(data.orderManageBefore) || data.orderManageBefore;
            }

            return filterData(data, ['name', 'help', 'key', 'default_value', 'required', 'type', 'group', 'settings',
                'orderListBefore', 'orderSubscribeBefore', 'orderManageBefore']);
        },
        localValidateFormValues: (state) => {
            if (!state.getIn(['name', 'value'])) {
                state.setIn(['name', 'error'], t('nameMustNotBeEmpty'));
            } else {
                state.setIn(['name', 'error'], null);
            }

            const keyServerValidation = state.getIn(['key', 'serverValidation']);
            if (!validators.mergeTagValid(state.getIn(['key', 'value']))) {
                state.setIn(['key', 'error'], t('mergeTagIsInvalidMayMustBeUppercaseAnd'));
            } else if (!keyServerValidation) {
                state.setIn(['key', 'error'], t('validationIsInProgress'));
            } else if (keyServerValidation.exists) {
                state.setIn(['key', 'error'], t('anotherFieldWithTheSameMergeTagExists'));
            } else {
                state.setIn(['key', 'error'], null);
            }

            const type = state.getIn(['type', 'value']);

            const group = state.getIn(['group', 'value']);
            const isInGroup = state.getIn(['isInGroup', 'value']);
            if (isInGroup && !group) {
                state.setIn(['group', 'error'], t('groupHasToBeSelected'));
            } else {
                state.setIn(['group', 'error'], null);
            }

            const defaultValue = state.getIn(['default_value', 'value']);
            if (defaultValue === '') {
                state.setIn(['default_value', 'error'], null);
            } else if (type === 'number' && !/^[0-9]*$/.test(defaultValue.trim())) {
                state.setIn(['default_value', 'error'], t('defaultValueIsNotIntegerNumber'));
            } else if (type === 'date' && !parseDate(state.getIn(['dateFormat', 'value']), defaultValue)) {
                state.setIn(['default_value', 'error'], t('defaultValueIsNotAProperlyFormattedDate'));
            } else if (type === 'birthday' && !parseBirthday(state.getIn(['dateFormat', 'value']), defaultValue)) {
                state.setIn(['default_value', 'error'], t('defaultValueIsNotAProperlyFormatted'));
            } else {
                state.setIn(['default_value', 'error'], null);
            }

            if (type === 'radio-enum' || type === 'dropdown-enum') {
                const enumOptions = parseEnumOptions(state.getIn(['enumOptions', 'value']));
                if (enumOptions.errors) {
                    state.setIn(['enumOptions', 'error'], <div>{enumOptions.errors.map((err, idx) => <div key={idx}>{err}</div>)}</div>);
                } else {
                    state.setIn(['enumOptions', 'error'], null);

                    if (defaultValue !== '' && !(enumOptions.options.find(x => x.key === defaultValue))) {
                        state.setIn(['default_value', 'error'], t('defaultValueIsNotOneOfTheAllowedOptions'));
                    }
                }
            } else {
                state.setIn(['enumOptions', 'error'], null);
            }
        }
    });

    useEffect(() => {
        if (entity) {
            formState.getFormValuesFromEntity(entity);
        } else {
            formState.populateFormValues({
                name: '',
                type: 'text',
                key: '',
                default_value: '',
                required: false,
                help: '',
                group: null,
                isInGroup: false,
                renderTemplate: '',
                enumOptions: '',
                dateFormat: 'eur',
                checkedLabel: '',
                uncheckedLabel: '',
                orderListBefore: 'end',
                orderSubscribeBefore: 'end',
                orderManageBefore: 'end'
            });
        }
    }, []);

    async function submitHandler(submitAndLeave) {
        let sendMethod, url;
        if (entity) {
            sendMethod = FormSendMethod.PUT;
            url = `rest/fields/${list.id}/${entity.id}`;
        } else {
            sendMethod = FormSendMethod.POST;
            url = `rest/fields/${list.id}`;
        }

        try {
            formState.disableForm();
            formState.setFormStatusMessage('info', t('saving'));

            const submitResult = await formState.validateAndSendFormValuesToURL(sendMethod, url);

            if (submitResult) {
                if (entity) {
                    if (submitAndLeave) {
                        navigateToWithFlashMessage(`/lists/${list.id}/fields`, 'success', t('fieldUpdated'));
                    } else {
                        await formState.getFormValuesFromURL(`rest/fields/${list.id}/${entity.id}`).catch(handleError);
                        formState.enableForm();
                        formState.setFormStatusMessage('success', t('fieldUpdated'));
                    }
                } else {
                    if (submitAndLeave) {
                        navigateToWithFlashMessage(`/lists/${list.id}/fields`, 'success', t('fieldCreated'));
                    } else {
                        navigateToWithFlashMessage(`/lists/${list.id}/fields/${submitResult}/edit`, 'success', t('fieldCreated'));
                    }
                }
            } else {
                formState.enableForm();
                formState.setFormStatusMessage('warning', t('thereAreErrorsInTheFormPleaseFixThemAnd'));
            }
        } catch (error) {
            handleError(error);
        }
    }

    const isEdit = !!entity;

    const getOrderOptions = fld => {
        return [
            { key: 'none', label: t('notVisible') },
            ...fields.filter(x => (!entity || x.id !== entity.id) && x[fld] !== null && x.group === null).sort((x, y) => x[fld] - y[fld]).map(x => ({ key: x.id.toString(), label: t('beforeNameType', { name: x.name, type: fieldTypes[x.type].label }) })),
            { key: 'end', label: t('atEndOfList') }
        ];
    };

    const typeOptions = Object.keys(fieldTypes).map(key => ({ key, label: fieldTypes[key].label }));

    const type = formState.getFormValue('type');
    const isInGroup = formState.getFormValue('isInGroup');

    let fieldSettings = null;
    switch (type) {
        case 'text':
        case 'website':
        case 'longtext':
        case 'gpg':
        case 'number':
            fieldSettings =
                <Fieldset label={t('fieldSettings')}>
                    <InputField id="default_value" label={t('defaultValue')} help={t('defaultValueUsedWhenTheFieldIsEmpty')}/>
                </Fieldset>;
            break;

        case 'checkbox-grouped':
        case 'radio-grouped':
        case 'dropdown-grouped':
            fieldSettings =
                <Fieldset label={t('fieldSettings')}>
                    <ACEEditor
                        id="renderTemplate"
                        label={t('template')}
                        height="250px"
                        mode="handlebars"
                        help={<Trans i18nKey="youCanControlTheAppearanceOfTheMergeTag">You can control the appearance of the merge tag with this template. The template
                            uses handlebars syntax and you can find all values from <code>{'{{values}}'}</code> array, for
                            example <code>{'{{#each values}} {{this}} {{/each}}'}</code>. If template is not defined then
                            multiple values are joined with commas.</Trans>}
                    />
                </Fieldset>;
            break;

        case 'radio-enum':
        case 'dropdown-enum':
            fieldSettings =
                <Fieldset label={t('fieldSettings')}>
                    <ACEEditor
                        id="enumOptions"
                        label={t('options')}
                        height="250px"
                        mode="text"
                        help={<Trans i18nKey="specifyTheOptionsToSelectFromInThe"><div>Specify the options to select from in the following format:<code>key|label</code>. For example:</div>
                            <div><code>au|Australia</code></div><div><code>at|Austria</code></div></Trans>}
                    />
                    <InputField id="default_value" label={t('defaultValue')} help={<Trans i18nKey="defaultKeyEgAuUsedWhenTheFieldIsEmpty">Default key (e.g. <code>au</code> used when the field is empty.')</Trans>}/>
                    <ACEEditor
                        id="renderTemplate"
                        label={t('template')}
                        height="250px"
                        mode="handlebars"
                        help={<Trans i18nKey="youCanControlTheAppearanceOfTheMergeTag-1">You can control the appearance of the merge tag with this template. The template
                            uses handlebars syntax and you can find all values from <code>{'{{values}}'}</code> array.
                            Each entry in the array is an object with attributes <code>key</code> and <code>label</code>.
                            For example <code>{'{{#each values}} {{this.value}} {{/each}}'}</code>. If template is not defined then
                            multiple values are joined with commas.</Trans>}
                    />
                </Fieldset>;
            break;

        case 'date':
            fieldSettings =
                <Fieldset label={t('fieldSettings')}>
                    <Dropdown id="dateFormat" label={t('dateFormat')}
                        options={[
                            { key: DateFormat.US, label: t('mmddyyyy') },
                            { key: DateFormat.EU, label: t('ddmmyyyy') },
                            { key: DateFormat.INTL, label: t('yyyymmdd') }
                        ]}
                    />
                    <InputField id="default_value" label={t('defaultValue')} help={<Trans i18nKey="defaultValueUsedWhenTheFieldIsEmpty">Default value used when the field is empty.</Trans>}/>
                </Fieldset>;
            break;

        case 'birthday':
            fieldSettings =
                <Fieldset label={t('fieldSettings')}>
                    <Dropdown id="dateFormat" label={t('dateFormat')}
                        options={[
                            { key: DateFormat.US, label: t('mmdd') },
                            { key: DateFormat.EU, label: t('ddmm') }
                        ]}
                    />
                    <InputField id="default_value" label={t('defaultValue')} help={<Trans i18nKey="defaultValueUsedWhenTheFieldIsEmpty">Default value used when the field is empty.</Trans>}/>
                </Fieldset>;
            break;

        case 'json':
            fieldSettings = <Fieldset label={t('fieldSettings')}>
                    <InputField id="default_value" label={t('defaultValue')} help={<Trans i18nKey="defaultKeyEgAuUsedWhenTheFieldIsEmpty">Default key (e.g. <code>au</code> used when the field is empty.')</Trans>}/>
                    <ACEEditor
                        id="renderTemplate"
                        label={t('template')}
                        height="250px"
                        mode="json"
                        help={<Trans i18nKey="youCanUseThisTemplateToRenderJsonValues">You can use this template to render JSON values (if the JSON is an array then the array is
                            exposed as <code>values</code>, otherwise you can access the JSON keys directly).</Trans>}
                    />
                </Fieldset>;
            break;

        case 'option': {
            const fieldsGroupedColumns = [
                { data: 4, title: "#" },
                { data: 1, title: t('name') },
                { data: 2, title: t('type'), render: data => fieldTypes[data].label, sortable: false, searchable: false },
                { data: 3, title: t('mergeTag') }
            ];

            fieldSettings =
                <Fieldset label={t('fieldSettings')}>
                    <CheckBox id="isInGroup" label={t('group')} text={t('belongsToCheckboxDropdownRadioGroup')}/>
                    {isInGroup &&
                        <TableSelect id="group" label={t('containingGroup')} withHeader dropdown dataUrl={`rest/fields-grouped-table/${list.id}`} columns={fieldsGroupedColumns} selectionLabelIndex={1} help={t('selectGroupToWhichTheOptionsShouldBelong')}/>
                    }
                    {!isInGroup &&
                        <>
                            <InputField id="checkedLabel" label={t('checkedLabel')} help={t('labelThatWillBeDisplayedInListAnd')}/>
                            <InputField id="uncheckedLabel" label={t('uncheckedLabel')} help={t('labelThatWillBeDisplayedInListAnd-1')}/>
                        </>
                    }
                    <InputField id="default_value" label={t('defaultValue')} help={t('defaultValueUsedWhenTheFieldIsEmpty')}/>
                </Fieldset>;
            break;
        }
    }

    return (
        <div>
            {isEdit &&
                <DeleteModalDialog
                    stateOwner={formState}
                    visible={action === 'delete'}
                    deleteUrl={`rest/fields/${list.id}/${entity.id}`}
                    backUrl={`/lists/${list.id}/fields/${entity.id}/edit`}
                    successUrl={`/lists/${list.id}/fields`}
                    deletingMsg={t('deletingField')}
                    deletedMsg={t('fieldDeleted')}/>
            }

            <Title>{isEdit ? t('editField') : t('createField')}</Title>

            <Form stateOwner={formState} onSubmitAsync={(...args) => submitHandler(...args)}>
                <InputField id="name" label={t('name')}/>

                {isEdit ?
                    <StaticField id="type" className={"formDisabled"} label={t('type')}>{(fieldTypes[formState.getFormValue('type')] || {}).label}</StaticField>
                :
                    <Dropdown id="type" label={t('type')} options={typeOptions}/>
                }

                <InputField id="key" label={t('mergeTag-1')}/>

                <TextArea id="help" label={t('helpText')}/>

                <CheckBox id="required" label={t('requiredClientsideValidationOnly')}/>

                {fieldSettings}

                {type !== 'option' &&
                    <Fieldset label={t('fieldOrder')}>
                        <Dropdown id="orderListBefore" label={t('listings')} options={getOrderOptions('order_list')} help={t('selectTheFieldBeforeWhichThisFieldShould')}/>
                        <Dropdown id="orderSubscribeBefore" label={t('subscriptionForm')} options={getOrderOptions('order_subscribe')} help={t('selectTheFieldBeforeWhichThisFieldShould-1')}/>
                        <Dropdown id="orderManageBefore" label={t('managementForm')} options={getOrderOptions('order_manage')} help={t('selectTheFieldBeforeWhichThisFieldShould-2')}/>
                    </Fieldset>
                }

                <ButtonRow>
                    <Button type="submit" className="btn-primary" icon="check" label={t('save')}/>
                    <Button type="submit" className="btn-primary" icon="check" label={t('saveAndLeave')} onClickAsync={async () => await submitHandler(true)}/>
                    {isEdit && <LinkButton className="btn-danger" icon="trash-alt" label={t('delete')} to={`/lists/${list.id}/fields/${entity.id}/delete`}/>}
                </ButtonRow>
            </Form>
        </div>
    );
}

CUD.propTypes = {
    action: PropTypes.string.isRequired,
    list: PropTypes.object,
    fields: PropTypes.array,
    entity: PropTypes.object
};
