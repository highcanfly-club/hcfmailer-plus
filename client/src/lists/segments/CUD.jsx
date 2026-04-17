'use strict';

import React, { useEffect, useState, useRef } from "react";
import PropTypes from "prop-types";
import { useTranslation } from '../../lib/i18n';
import { LinkButton, Title, Toolbar } from "../../lib/page";
import {
    ButtonRow,
    Dropdown,
    filterData,
    Form,
    FormSendMethod,
    InputField,
} from "../../lib/form";
import { useForm } from '../../lib/hooks/useForm';
import { useErrorHandling } from '../../lib/hooks/useErrorHandling';
import { usePageHelpers } from '../../lib/hooks/usePageHelpers';
import { useRequiresAuthenticatedUser } from '../../lib/hooks/useRequiresAuthenticatedUser';
import { DeleteModalDialog } from "../../lib/modals";

import "./CUD.scss";
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from "react-dnd-html5-backend";
import { TouchBackend } from "react-dnd-touch-backend";
import SortableTree from "react-sortable-tree";
import 'react-sortable-tree/style.css';
import { ActionLink, Button, Icon } from "../../lib/bootstrap-components";
import { getRuleHelpers } from "./helpers";
import RuleSettingsPane from "./RuleSettingsPane";
import clone from "clone";
import { enableDeleteModal } from "../../settings/settings";

const isTouchDevice = !!('ontouchstart' in window || navigator.maxTouchPoints);

export default function CUD({ action, list, fields, entity }) {
    useRequiresAuthenticatedUser();
    const { t } = useTranslation();
    const { handleError } = useErrorHandling();
    const { navigateToWithFlashMessage } = usePageHelpers();

    const ruleHelpers = getRuleHelpers(t, fields);

    function getTreeFromRules(rules) {
        const tree = [];
        for (const rule of rules) {
            const ruleTreeLabel = ruleHelpers.getTreeLabel(rule);
            const title = ruleTreeLabel || t('newRule');

            tree.push({
                rule,
                title,
                expanded: true,
                children: getTreeFromRules(rule.rules || [])
            });
        }
        return tree;
    }

    function getRulesFromTree(tree) {
        const rules = [];
        for (const node of tree) {
            const rule = node.rule;
            if (ruleHelpers.isCompositeRuleType(rule.type)) {
                rule.rules = getRulesFromTree(node.children);
            }
            rules.push(rule);
        }
        return rules;
    }

    const [rulesTree, setRulesTree] = useState(getTreeFromRules([]));
    const [ruleOptionsVisible, setRuleOptionsVisible] = useState(undefined);

    const formState = useForm({
        getFormValuesMutator: (data, originalData) => {
            data.rootRuleType = data.settings.rootRule.type;
            data.selectedRule = (originalData && originalData.selectedRule) || null;

            setRulesTree(getTreeFromRules(data.settings.rootRule.rules));
        },
        submitFormValuesMutator: (data) => {
            data.settings.rootRule.type = data.rootRuleType;
            data = clone(data);
            return filterData(data, ['name', 'settings']);
        },
        localValidateFormValues: (state) => {
            if (!state.getIn(['name', 'value'])) {
                state.setIn(['name', 'error'], t('nameMustNotBeEmpty'));
            } else {
                state.setIn(['name', 'error'], null);
            }

            if (state.getIn(['selectedRule', 'value']) === null) {
                state.setIn(['selectedRule', 'error'], null);
            }
        }
    });

    useEffect(() => {
        if (entity) {
            formState.getFormValuesFromEntity(entity);
        } else {
            formState.populateFormValues({
                name: '',
                settings: {
                    rootRule: {
                        type: 'all',
                        rules: []
                    }
                },
                rootRuleType: 'all',
                selectedRule: null
            });
        }
    }, []);

    async function submitHandler(submitAndLeave) {
        let sendMethod, url;
        if (entity) {
            sendMethod = FormSendMethod.PUT;
            url = `rest/segments/${list.id}/${entity.id}`;
        } else {
            sendMethod = FormSendMethod.POST;
            url = `rest/segments/${list.id}`;
        }

        try {
            formState.disableForm();
            formState.setFormStatusMessage('info', t('saving'));

            const submitResult = await formState.validateAndSendFormValuesToURL(sendMethod, url);

            if (submitResult) {
                if (entity) {
                    if (submitAndLeave) {
                        navigateToWithFlashMessage(`/lists/${list.id}/segments`, 'success', t('segmentUpdated'));
                    } else {
                        await formState.getFormValuesFromURL(`rest/segments/${list.id}/${entity.id}`).catch(handleError);
                        formState.enableForm();
                        formState.setFormStatusMessage('success', t('segmentUpdated'));
                    }
                } else {
                    if (submitAndLeave) {
                        navigateToWithFlashMessage(`/lists/${list.id}/segments`, 'success', t('segmentCreated'));
                    } else {
                        navigateToWithFlashMessage(`/lists/${list.id}/segments/${submitResult}/edit`, 'success', t('segmentCreated'));
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

    function onRulesChanged(newRulesTree) {
        formState.getFormValue('settings').rootRule.rules = getRulesFromTree(newRulesTree);
        setRulesTree(newRulesTree);
    }

    function showRuleOptions(rule) {
        formState.updateFormValue('selectedRule', rule);
        setRuleOptionsVisible(true);
    }

    function onRuleSettingsPaneClose() {
        formState.updateFormValue('selectedRule', null);
        setRuleOptionsVisible(false);
        setRulesTree(getTreeFromRules(formState.getFormValue('settings').rootRule.rules));
    }

    function onRuleSettingsPaneDelete() {
        const selectedRule = formState.getFormValue('selectedRule');
        formState.updateFormValue('selectedRule', null);
        setRuleOptionsVisible(false);
        deleteRule(selectedRule);
    }

    function onRuleSettingsPaneUpdated(hasErrors) {
        // We can't directly set the error field; re-trigger validation by setting selectedRule again
        // The localValidateFormValues handles selectedRule error
        formState.updateFormValue('_ruleHasErrors', hasErrors);
    }

    function addRule(rule) {
        if (!ruleOptionsVisible) {
            const rules = formState.getFormValue('settings').rootRule.rules;
            rules.push(rule);

            formState.updateFormValue('selectedRule', rule);
            setRuleOptionsVisible(true);
            setRulesTree(getTreeFromRules(rules));
        }
    }

    async function addCompositeRule() {
        addRule({ type: 'all', rules: [] });
    }

    async function addPrimitiveRule() {
        addRule({ type: null });
    }

    function deleteRule(ruleToDelete) {
        let finishedSearching = false;

        function childrenWithoutRule(rules) {
            const newRules = [];
            for (const rule of rules) {
                if (finishedSearching) {
                    newRules.push(rule);
                } else if (rule !== ruleToDelete) {
                    const newRule = Object.assign({}, rule);
                    if (rule.rules) {
                        newRule.rules = childrenWithoutRule(rule.rules);
                    }
                    newRules.push(newRule);
                } else {
                    finishedSearching = true;
                }
            }
            return newRules;
        }

        const rules = childrenWithoutRule(formState.getFormValue('settings').rootRule.rules);
        formState.getFormValue('settings').rootRule.rules = rules;
        setRulesTree(getTreeFromRules(rules));
    }

    const isEdit = !!entity;
    const selectedRule = formState.getFormValue('selectedRule');

    let ruleOptionsVisibilityClass = '';
    if (ruleOptionsVisible !== undefined) {
        if (ruleOptionsVisible) {
            ruleOptionsVisibilityClass = ' ' + "ruleOptionsVisible";
        } else {
            ruleOptionsVisibilityClass = ' ' + "ruleOptionsHidden";
        }
    }

    return (
        <DndProvider backend={isTouchDevice ? TouchBackend : HTML5Backend}>
            <div>
                {isEdit &&
                    <DeleteModalDialog
                        stateOwner={formState}
                        visible={action === 'delete'}
                        deleteUrl={`rest/segments/${list.id}/${entity.id}`}
                        backUrl={`/lists/${list.id}/segments/${entity.id}/edit`}
                        successUrl={`/lists/${list.id}/segments`}
                        deletingMsg={t('deletingSegment')}
                        deletedMsg={t('segmentDeleted')}/>
                }

                <Title>{isEdit ? t('editSegment') : t('createSegment')}</Title>

                <Form stateOwner={formState} onSubmitAsync={(...args) => submitHandler(...args)}>
                    <h3>{t('segmentOptions')}</h3>

                    <InputField id="name" label={t('name')} />
                    <Dropdown id="rootRuleType" label={t('toplevelMatchType')} options={ruleHelpers.getCompositeRuleTypeOptions()} />
                </Form>

                <hr />

                <div className={"rulePane" + ruleOptionsVisibilityClass}>
                    <div className={"leftPane"}>
                        <div className={"leftPaneInner"}>
                            <Toolbar>
                                <Button className="btn-secondary" label={t('addCompositeRule')} onClickAsync={(...args) => addCompositeRule(...args)}/>
                                <Button className="btn-secondary" label={t('addRule')} onClickAsync={(...args) => addPrimitiveRule(...args)}/>
                            </Toolbar>

                            <h3>{t('rules')}</h3>

                            <div className="clearfix"/>

                            <div className={"ruleTree"}>
                                <SortableTree
                                    treeData={rulesTree}
                                    onChange={newRulesTree => onRulesChanged(newRulesTree)}
                                    isVirtualized={false}
                                    canDrop={ data => !data.nextParent || (ruleHelpers.isCompositeRuleType(data.nextParent.rule.type)) }
                                    generateNodeProps={data => ({
                                        buttons: [
                                            <ActionLink onClickAsync={async () => !ruleOptionsVisible && showRuleOptions(data.node.rule)} className={"ruleActionLink"}><Icon icon="edit" title={t('edit')}/></ActionLink>,
                                            <ActionLink onClickAsync={async () => !ruleOptionsVisible && deleteRule(data.node.rule)} className={"ruleActionLink"}><Icon icon="trash-alt" title={t('delete')}/></ActionLink>
                                        ]
                                    })}
                                />
                            </div>
                        </div>

                        <div className={"leftPaneOverlay"} />

                        <div className={"paneDivider"}>
                            <div className={"paneDividerSolidBackground"}/>
                        </div>
                    </div>

                    <div className={"rightPane"}>
                        <div className={"rightPaneInner"}>
                            {selectedRule &&
                                <RuleSettingsPane rule={selectedRule} fields={fields} onChange={onRuleSettingsPaneUpdated} onClose={onRuleSettingsPaneClose} onDelete={onRuleSettingsPaneDelete} forceShowValidation={formState.isFormValidationShown()}/>}
                        </div>
                    </div>
                </div>

                <hr/>
                <ButtonRow format="wide" className={`col-12 ${"toolbar"}`}>
                    <Button type="submit" className="btn-primary" icon="check" label={t('save')} onClickAsync={async () => await submitHandler(false)}/>
                    <Button type="submit" className="btn-primary" icon="check" label={t('saveAndLeave')} onClickAsync={async () => await submitHandler(true)}/>

                    {enableDeleteModal && isEdit && <LinkButton className="btn-danger" icon="trash-alt" label={t('delete')} to={`/lists/${list.id}/segments/${entity.id}/delete`}/> }
                </ButtonRow>
            </div>
        </DndProvider>
    );
}

CUD.propTypes = {
    action: PropTypes.string.isRequired,
    list: PropTypes.object,
    fields: PropTypes.array,
    entity: PropTypes.object
};
