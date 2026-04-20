'use strict';

import React, { useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { useTranslation } from '../../lib/i18n';
import { Button, ButtonRow, Dropdown, Form, TableSelect } from "../../lib/form";
import { useForm } from '../../lib/hooks/useForm';
import { useRequiresAuthenticatedUser } from '../../lib/hooks/useRequiresAuthenticatedUser';
import { getRuleHelpers } from "./helpers";
import { getFieldTypes } from "../fields/helpers";

import "./CUD.scss";

export default function RuleSettingsPane({ rule, fields, onChange, onClose, onDelete, forceShowValidation }) {
    useRequiresAuthenticatedUser();
    const { t } = useTranslation();

    const ruleHelpers = getRuleHelpers(t, fields);
    const fieldTypes = { ...getFieldTypes(t), ...ruleHelpers.extraFieldTypes };

    function populateRuleDefaults(mutStateData) {
        const type = mutStateData.getIn(['type', 'value']);

        if (!ruleHelpers.isCompositeRuleType(type)) {
            const column = mutStateData.getIn(['column', 'value']);

            if (column) {
                const colDef = ruleHelpers.getColumnDef(column);

                if (type) {
                    const colType = colDef.type;
                    const settings = ruleHelpers.primitiveRuleTypes[colType][type];
                    if (!settings) {
                        mutStateData.setIn(['type', 'value'], '');
                    }
                }
            }
        }
    }

    const formState = useForm({
        leaveConfirmation: false,
        onChangeBeforeValidation: (...args) => populateRuleDefaults(...args),
        localValidateFormValues: (state) => {
            for (const key of state.keys()) {
                state.setIn([key, 'error'], null);
            }

            const ruleType = state.getIn(['type', 'value']);
            if (!ruleHelpers.isCompositeRuleType(ruleType)) {
                if (!ruleType) {
                    state.setIn(['type', 'error'], t('typeMustBeSelected'));
                }

                const column = state.getIn(['column', 'value']);
                if (column) {
                    const colDef = ruleHelpers.getColumnDef(column);

                    if (ruleType) {
                        const colType = colDef.type;
                        const settings = ruleHelpers.primitiveRuleTypes[colType][ruleType];
                        settings.validate(state, colDef);
                    }
                } else {
                    state.setIn(['column', 'error'], t('fieldMustBeSelected'));
                }
            }
        }
    });

    function updateStateFromProps(populateForm) {
        if (populateForm) {
            let data;
            if (!ruleHelpers.isCompositeRuleType(rule.type)) {
                data = ruleHelpers.primitiveRuleTypesFormDataDefaults;

                const colDef = ruleHelpers.getColumnDef(rule.column);
                if (colDef) {
                    const colType = colDef.type;
                    const settings = ruleHelpers.primitiveRuleTypes[colType][rule.type];
                    Object.assign(data, settings.getFormData(rule, colDef));
                }

                data.type = rule.type || '';
                data.column = rule.column;
            } else {
                data = { type: rule.type };
            }

            formState.populateFormValues(data);
        }

        if (forceShowValidation) {
            formState.showFormValidation();
        }
    }

    useEffect(() => {
        updateStateFromProps(true);
    }, []);

    const prevRuleRef = useRef(rule);
    const prevForceShowRef = useRef(forceShowValidation);

    useEffect(() => {
        const ruleChanged = rule !== prevRuleRef.current;
        updateStateFromProps(ruleChanged);
        prevRuleRef.current = rule;
        prevForceShowRef.current = forceShowValidation;

        if (formState.isFormWithoutErrors()) {
            rule.type = formState.getFormValue('type');

            if (!ruleHelpers.isCompositeRuleType(rule.type)) {
                rule.column = formState.getFormValue('column');

                const colDef = ruleHelpers.getColumnDef(rule.column);
                const colType = colDef.type;
                const settings = ruleHelpers.primitiveRuleTypes[colType][rule.type];
                settings.assignRuleSettings(rule, key => formState.getFormValue(key), colDef);
            }

            onChange(false);
        } else {
            onChange(true);
        }
    });

    async function closeForm() {
        if (formState.isFormWithoutErrors()) {
            onClose();
        } else {
            formState.showFormValidation();
        }
    }

    async function deleteRule() {
        onDelete();
    }

    const ruleColumn = formState.getFormValue('column');

    let ruleOptions = null;
    if (ruleHelpers.isCompositeRuleType(rule.type)) {
        ruleOptions = <Dropdown id="type" label={t('type')} options={ruleHelpers.getCompositeRuleTypeOptions()} />;
    } else {
        const ruleColumnOptionsColumns = [
            { data: 1, title: t('name') },
            { data: 2, title: t('type') },
            { data: 3, title: t('mergeTag') }
        ];

        const ruleColumnOptions = ruleHelpers.fields.map(fld => [fld.column, fld.name, fieldTypes[fld.type].label, fld.key || '']);
        const ruleColumnSelect = <TableSelect id="column" label={t('field')} data={ruleColumnOptions} columns={ruleColumnOptionsColumns} dropdown withHeader selectionLabelIndex={1} />;

        let ruleTypeSelect = null;
        let ruleSettings = null;

        if (ruleColumn) {
            const colDef = ruleHelpers.getColumnDef(ruleColumn);
            if (colDef) {
                const colType = colDef.type;
                const ruleTypeOptions = ruleHelpers.getPrimitiveRuleTypeOptions(colType);
                ruleTypeOptions.unshift({ key: '', label: t('select-1') });

                if (ruleTypeOptions) {
                    ruleTypeSelect = <Dropdown id="type" label={t('type')} options={ruleTypeOptions} />;

                    const ruleType = formState.getFormValue('type');
                    if (ruleType) {
                        ruleSettings = ruleHelpers.primitiveRuleTypes[colType][ruleType].getForm(colDef);
                    }
                }
            }
        }

        ruleOptions =
            <div>
                {ruleColumnSelect}
                {ruleTypeSelect}
                {ruleSettings}
            </div>;
    }

    return (
        <div className={"ruleOptions"}>
            <h3>{t('ruleOptions')}</h3>

            <Form stateOwner={formState} onSubmitAsync={(...args) => closeForm(...args)}>

                {ruleOptions}

                <ButtonRow>
                    <Button type="submit" className="btn-primary" icon="chevron-left" label={t('ok')}/>
                    <Button className="btn-primary" icon="trash-alt" label={t('delete')} onClickAsync={(...args) => deleteRule(...args)}/>
                </ButtonRow>
            </Form>
        </div>
    );
}

RuleSettingsPane.propTypes = {
    rule: PropTypes.object.isRequired,
    fields: PropTypes.array.isRequired,
    onChange: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired,
    onDelete: PropTypes.func.isRequired,
    forceShowValidation: PropTypes.bool.isRequired
};
