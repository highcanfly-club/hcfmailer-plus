'use strict';

import React, {useEffect} from 'react';
import PropTypes from 'prop-types';
import {Trans} from 'react-i18next';
import {useTranslation} from '../lib/i18n';
import {LinkButton, Title} from '../lib/page';
import {
    Button,
    ButtonRow,
    CheckBox,
    Dropdown,
    filterData,
    Form,
    FormSendMethod,
    InputField,
    StaticField,
    TableSelect,
    TextArea,
} from '../lib/form';
import {DeleteModalDialog} from '../lib/modals';
import {getDefaultNamespace, NamespaceSelect, validateNamespace} from '../lib/namespace';
import {FieldWizard, UnsubscriptionMode} from '../../../shared/lists';
import "../lib/styles.scss";
import {getMailerTypes} from "../send-configurations/helpers";
import {useErrorHandling} from '../lib/hooks/useErrorHandling';
import {usePageHelpers} from '../lib/hooks/usePageHelpers';
import {useRequiresAuthenticatedUser} from '../lib/hooks/useRequiresAuthenticatedUser';
import {useForm} from '../lib/hooks/useForm';
import {enableDeleteModal} from "../settings/settings";

export default function CUD({ action, entity, permissions }) {
    const { t } = useTranslation();
    const { handleError } = useErrorHandling();
    const { navigateToWithFlashMessage } = usePageHelpers();
    useRequiresAuthenticatedUser();

    const mailerTypes = getMailerTypes(t);

    const formState = useForm({
        getFormValuesMutator(data) {
            data.form = data.default_form ? 'custom' : 'default';
            data.listunsubscribe_disabled = !!data.listunsubscribe_disabled;
        },
        submitFormValuesMutator(data) {
            if (data.form === 'default') {
                data.default_form = null;
            }
            if (data.fieldWizard === FieldWizard.FIRST_LAST_NAME || data.fieldWizard === FieldWizard.NAME) {
                data.to_name = null;
            }
            return filterData(data, ['name', 'description', 'default_form', 'public_subscribe', 'unsubscription_mode',
                'contact_email', 'homepage', 'namespace', 'to_name', 'listunsubscribe_disabled', 'send_configuration',
                'fieldWizard'
            ]);
        },
        localValidateFormValues(state) {
            if (!state.getIn(['name', 'value'])) {
                state.setIn(['name', 'error'], t('nameMustNotBeEmpty'));
            } else {
                state.setIn(['name', 'error'], null);
            }

            if (!state.getIn(['send_configuration', 'value'])) {
                state.setIn(['send_configuration', 'error'], t('sendConfigurationMustBeSelected'));
            } else {
                state.setIn(['send_configuration', 'error'], null);
            }

            if (state.getIn(['form', 'value']) === 'custom' && !state.getIn(['default_form', 'value'])) {
                state.setIn(['default_form', 'error'], t('customFormMustBeSelected'));
            } else {
                state.setIn(['default_form', 'error'], null);
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
                form: 'default',
                default_form: 'default',
                public_subscribe: true,
                contact_email: '',
                homepage: '',
                unsubscription_mode: UnsubscriptionMode.ONE_STEP,
                namespace: getDefaultNamespace(permissions),
                to_name: '',
                fieldWizard: FieldWizard.FIRST_LAST_NAME,
                send_configuration: null,
                listunsubscribe_disabled: false
            });
        }
    }, []);

    async function submitHandler(submitAndLeave) {
        try {
            let sendMethod, url;
            if (entity) {
                sendMethod = FormSendMethod.PUT;
                url = `rest/lists/${entity.id}`;
            } else {
                sendMethod = FormSendMethod.POST;
                url = 'rest/lists';
            }

            formState.disableForm();
            formState.setFormStatusMessage('info', t('saving'));

            const submitResult = await formState.validateAndSendFormValuesToURL(sendMethod, url);

            if (submitResult) {
                if (entity) {
                    if (submitAndLeave) {
                        navigateToWithFlashMessage('/lists', 'success', t('listUpdated'));
                    } else {
                        await formState.getFormValuesFromURL(`rest/lists/${entity.id}`);
                        formState.enableForm();
                        formState.setFormStatusMessage('success', t('listUpdated'));
                    }
                } else {
                    if (submitAndLeave) {
                        navigateToWithFlashMessage('/lists', 'success', t('listCreated'));
                    } else {
                        navigateToWithFlashMessage(`/lists/${submitResult}/edit`, 'success', t('listCreated'));
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

    const unsubcriptionModeOptions = [
        { key: UnsubscriptionMode.ONE_STEP, label: t('onestepIeNoEmailWithConfirmationLink') },
        { key: UnsubscriptionMode.ONE_STEP_WITH_FORM, label: t('onestepWithUnsubscriptionFormIeNoEmail') },
        { key: UnsubscriptionMode.TWO_STEP, label: t('twostepIeAnEmailWithConfirmationLinkWill') },
        { key: UnsubscriptionMode.TWO_STEP_WITH_FORM, label: t('twostepWithUnsubscriptionFormIeAnEmail') },
        { key: UnsubscriptionMode.MANUAL, label: t('manualIeUnsubscriptionHasToBePerformedBy') }
    ];

    const formsOptions = [
        { key: 'default', label: t('defaultMailtrainForms') },
        { key: 'custom', label: t('customFormsSelectFormBelow') }
    ];

    const customFormsColumns = [
        {data: 0, title: "#"},
        {data: 1, title: t('name')},
        {data: 2, title: t('description')},
        {data: 3, title: t('namespace')}
    ];

    const sendConfigurationsColumns = [
        { data: 1, title: t('name') },
        { data: 2, title: t('id'), render: data => <code>{data}</code> },
        { data: 3, title: t('description') },
        { data: 4, title: t('type'), render: data => mailerTypes[data].typeName },
        { data: 6, title: t('namespace') }
    ];

    let toNameFields;
    if (isEdit) {
        toNameFields = <InputField id="to_name" label={t('recipientsNameTemplate')} help={t('specifyUsingMergeTagsOfThisListHowTo')}/>;
    } else {
        const fieldWizardOptions = [
            {key: FieldWizard.NONE, label: t('emptyCustomNoFields')},
            {key: FieldWizard.NAME, label: t('nameOneField')},
            {key: FieldWizard.FIRST_LAST_NAME, label: t('firstNameAndLastNameTwoFields')},
        ];

        const fieldWizardValue = formState.getFormValue('fieldWizard');
        const fieldWizardSelector = <Dropdown id="fieldWizard" label={t('representationOfSubscribersName')} options={fieldWizardOptions} help={t('selectHowTheNameOfASubscriberWillBe')}/>;

        if (fieldWizardValue === FieldWizard.NONE) {
            toNameFields = (
                <>
                    {fieldWizardSelector}
                    <InputField id="to_name" label={t('recipientsNameTemplate')} help={t('specifyUsingMergeTagsOfThisListHowTo')}/>
                </>
            );
        } else {
            toNameFields = fieldWizardSelector;
        }
    }

    return (
        <div>
            {enableDeleteModal && canDelete &&
                <DeleteModalDialog
                    stateOwner={formState}
                    visible={action === 'delete'}
                    deleteUrl={`rest/lists/${entity.id}`}
                    backUrl={`/lists/${entity.id}/edit`}
                    successUrl="/lists"
                    deletingMsg={t('deletingList')}
                    deletedMsg={t('listDeleted')}/>
            }

            <Title>{isEdit ? t('editList') : t('createList')}</Title>

            <Form stateOwner={formState} onSubmitAsync={submitHandler}>
                <InputField id="name" label={t('name')}/>

                {isEdit &&
                    <StaticField id="cid" className={"formDisabled"} label={t('id')} help={t('thisIsTheListIdDisplayedToTheSubscribers')}>
                        {formState.getFormValue('cid')}
                    </StaticField>
                }

                <TextArea id="description" label={t('description')}/>

                <InputField id="contact_email" label={t('contactEmail')} help={t('contactEmailUsedInSubscriptionFormsAnd')}/>
                <InputField id="homepage" label={t('homepage')} help={t('homepageUrlUsedInSubscriptionFormsAnd')}/>
                {toNameFields}
                <TableSelect id="send_configuration" label={t('sendConfiguration-1')} withHeader dropdown dataUrl='rest/send-configurations-table' columns={sendConfigurationsColumns} selectionLabelIndex={1} help={t('sendConfigurationThatWillBeUsedFor')}/>

                <NamespaceSelect/>

                <Dropdown id="form" label={t('forms')} options={formsOptions} help={t('webAndEmailFormsAndTemplatesUsedIn')}/>

                {formState.getFormValue('form') === 'custom' &&
                    <TableSelect id="default_form" label={t('customForms')} withHeader dropdown dataUrl='rest/forms-table' columns={customFormsColumns} selectionLabelIndex={1} help={<Trans i18nKey="theCustomFormUsedForThisListYouCanCreate">The custom form used for this list. You can create a form <a href={`/lists/forms/create`}>here</a>.</Trans>}/>
                }

                <CheckBox id="public_subscribe" label={t('subscription')} text={t('allowPublicUsersToSubscribeThemselves')}/>

                <Dropdown id="unsubscription_mode" label={t('unsubscription')} options={unsubcriptionModeOptions} help={t('selectHowAnUnsuscriptionRequestBy')}/>

                <CheckBox id="listunsubscribe_disabled" label={t('unsubscribeHeader')} text={t('doNotSendListUnsubscribeHeaders')}/>

                <ButtonRow>
                    <Button type="submit" className="btn-primary" icon="check" label={t('save')}/>
                    <Button type="submit" className="btn-primary" icon="check" label={t('saveAndLeave')} onClickAsync={async () => await submitHandler(true)}/>
                    {false && canDelete && <LinkButton className="btn-danger" icon="trash-alt" label={t('delete')} to={`/lists/${entity.id}/delete`}/>}
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
