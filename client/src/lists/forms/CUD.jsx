'use strict';

import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Trans } from 'react-i18next';
import { useTranslation } from '../../lib/i18n';
import { LinkButton, Title } from '../../lib/page';
import {
    ACEEditor,
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
    TableSelect,
    TextArea,
} from '../../lib/form';
import { useForm } from '../../lib/hooks/useForm';
import { useErrorHandling } from '../../lib/hooks/useErrorHandling';
import { usePageHelpers } from '../../lib/hooks/usePageHelpers';
import { useRequiresAuthenticatedUser } from '../../lib/hooks/useRequiresAuthenticatedUser';
import { getDefaultNamespace, NamespaceSelect, validateNamespace } from '../../lib/namespace';
import { DeleteModalDialog } from "../../lib/modals";
import mailtrainConfig from 'mailtrainConfig';
import { getTrustedUrl, getUrl } from "../../lib/urls";
import { ActionLink, Icon } from "../../lib/bootstrap-components";
import "../../lib/styles.scss";
import "./styles.scss";
import axios from "../../lib/axios";

export default function CUD({ action, entity, permissions }) {
    useRequiresAuthenticatedUser();
    const { t } = useTranslation();
    const { handleError } = useErrorHandling();
    const { navigateToWithFlashMessage } = usePageHelpers();

    const [previewContents, setPreviewContents] = useState(null);
    const [previewFullscreen, setPreviewFullscreen] = useState(false);
    const [previewKey, setPreviewKey] = useState(null);
    const [previewLabel, setPreviewLabel] = useState('');

    const serverValidatedFields = [
        'layout',
        'web_subscribe',
        'web_confirm_subscription_notice',
        'mail_confirm_subscription_html',
        'mail_confirm_subscription_text',
        'mail_already_subscribed_html',
        'mail_already_subscribed_text',
        'web_subscribed_notice',
        'mail_subscription_confirmed_html',
        'mail_subscription_confirmed_text',
        'web_manage',
        'web_manage_address',
        'web_updated_notice',
        'web_unsubscribe',
        'web_confirm_unsubscription_notice',
        'mail_confirm_unsubscription_html',
        'mail_confirm_unsubscription_text',
        'mail_confirm_address_change_html',
        'mail_confirm_address_change_text',
        'web_unsubscribed_notice',
        'mail_unsubscription_confirmed_html',
        'mail_unsubscription_confirmed_text',
        'web_manual_unsubscribe_notice',
        'web_privacy_policy_notice'
    ];

    const helpEmailText = t('thePlaintextVersionForThisEmail');
    const helpMjmlGeneral = <Trans i18nKey="customFormsUseMjmlForFormattingSeeThe">Custom forms use MJML for formatting. See the MJML documentation <a className="mjml-documentation" href="https://mjml.io/documentation/">here</a></Trans>;

    const templateSettings = {
        layout: { label: t('layout'), mode: 'html', help: helpMjmlGeneral, isLayout: true },
        form_input_style: { label: t('formInputStyle'), mode: 'css', help: t('thisCssStylesheetDefinesTheAppearanceOf') },
        web_subscribe: { label: t('webSubscribe'), mode: 'html', help: helpMjmlGeneral },
        web_confirm_subscription_notice: { label: t('webConfirmSubscriptionNotice'), mode: 'html', help: helpMjmlGeneral },
        mail_confirm_subscription_html: { label: t('mailConfirmSubscriptionMjml'), mode: 'html', help: helpMjmlGeneral },
        mail_confirm_subscription_text: { label: t('mailConfirmSubscriptionText'), mode: 'text', help: helpEmailText },
        mail_already_subscribed_html: { label: t('mailAlreadySubscribedMjml'), mode: 'html', help: helpMjmlGeneral },
        mail_already_subscribed_text: { label: t('mailAlreadySubscribedText'), mode: 'text', help: helpEmailText },
        web_subscribed_notice: { label: t('webSubscribedNotice'), mode: 'html', help: helpMjmlGeneral },
        mail_subscription_confirmed_html: { label: t('mailSubscriptionConfirmedMjml'), mode: 'html', help: helpMjmlGeneral },
        mail_subscription_confirmed_text: { label: t('mailSubscriptionConfirmedText'), mode: 'text', help: helpEmailText },
        web_manage: { label: t('webManagePreferences'), mode: 'html', help: helpMjmlGeneral },
        web_manage_address: { label: t('webManageAddress'), mode: 'html', help: helpMjmlGeneral },
        mail_confirm_address_change_html: { label: t('mailConfirmAddressChangeMjml'), mode: 'html', help: helpMjmlGeneral },
        mail_confirm_address_change_text: { label: t('mailConfirmAddressChangeText'), mode: 'text', help: helpEmailText },
        web_updated_notice: { label: t('webUpdatedNotice'), mode: 'html', help: helpMjmlGeneral },
        web_unsubscribe: { label: t('webUnsubscribe'), mode: 'html', help: helpMjmlGeneral },
        web_confirm_unsubscription_notice: { label: t('webConfirmUnsubscriptionNotice'), mode: 'html', help: helpMjmlGeneral },
        mail_confirm_unsubscription_html: { label: t('mailConfirmUnsubscriptionMjml'), mode: 'html', help: helpMjmlGeneral },
        mail_confirm_unsubscription_text: { label: t('mailConfirmUnsubscriptionText'), mode: 'text', help: helpEmailText },
        web_unsubscribed_notice: { label: t('webUnsubscribedNotice'), mode: 'html', help: helpMjmlGeneral },
        mail_unsubscription_confirmed_html: { label: t('mailUnsubscriptionConfirmedMjml'), mode: 'html', help: helpMjmlGeneral },
        mail_unsubscription_confirmed_text: { label: t('mailUnsubscriptionConfirmedText'), mode: 'text', help: helpEmailText },
        web_manual_unsubscribe_notice: { label: t('webManualUnsubscribeNotice'), mode: 'html', help: helpMjmlGeneral },
        web_privacy_policy_notice: { label: t('privacyPolicy'), mode: 'html', help: helpMjmlGeneral }
    };

    const templateGroups = {
        general: { label: t('general'), options: ['layout', 'form_input_style'] },
        subscribe: {
            label: t('subscribe'),
            options: ['web_subscribe', 'web_confirm_subscription_notice', 'mail_confirm_subscription_html', 'mail_confirm_subscription_text', 'mail_already_subscribed_html', 'mail_already_subscribed_text', 'web_subscribed_notice', 'mail_subscription_confirmed_html', 'mail_subscription_confirmed_text']
        },
        manage: {
            label: t('manage'),
            options: ['web_manage', 'web_manage_address', 'mail_confirm_address_change_html', 'mail_confirm_address_change_text', 'web_updated_notice']
        },
        unsubscribe: {
            label: t('unsubscribe'),
            options: ['web_unsubscribe', 'web_confirm_unsubscription_notice', 'mail_confirm_unsubscription_html', 'mail_confirm_unsubscription_text', 'web_unsubscribed_notice', 'mail_unsubscription_confirmed_html', 'mail_unsubscription_confirmed_text', 'web_manual_unsubscribe_notice']
        },
        gdpr: { label: t('dataProtection'), options: ['web_privacy_policy_notice'] }
    };

    function supplyDefaults(data) {
        for (const key in mailtrainConfig.defaultCustomFormValues) {
            if (!data[key]) {
                data[key] = mailtrainConfig.defaultCustomFormValues[key];
            }
        }
    }

    const formState = useForm({
        serverValidation: {
            url: 'rest/forms-validate',
            changed: serverValidatedFields
        },
        onChange: {
            previewList: (newState, key, oldValue, newValue) => {
                newState.formState.setIn(['data', 'previewContents', 'value'], null);
            }
        },
        getFormValuesMutator: (data, originalData) => {
            supplyDefaults(data);
            data.selectedTemplate = (originalData && originalData.selectedTemplate) || 'layout';
        },
        submitFormValuesMutator: (data) => {
            return filterData(data, ['name', 'description', 'namespace',
                'fromExistingEntity', 'existingEntity',
                'layout', 'form_input_style',
                'web_subscribe', 'web_confirm_subscription_notice', 'mail_confirm_subscription_html', 'mail_confirm_subscription_text',
                'mail_already_subscribed_html', 'mail_already_subscribed_text', 'web_subscribed_notice', 'mail_subscription_confirmed_html', 'mail_subscription_confirmed_text',
                'web_manage', 'web_manage_address', 'web_updated_notice',
                'web_unsubscribe', 'web_confirm_unsubscription_notice', 'mail_confirm_unsubscription_html', 'mail_confirm_unsubscription_text',
                'mail_confirm_address_change_html', 'mail_confirm_address_change_text',
                'web_unsubscribed_notice', 'mail_unsubscription_confirmed_html', 'mail_unsubscription_confirmed_text', 'web_manual_unsubscribe_notice', 'web_privacy_policy_notice'
            ]);
        },
        localValidateFormValues: (state) => {
            if (!state.getIn(['name', 'value'])) {
                state.setIn(['name', 'error'], t('nameMustNotBeEmpty'));
            } else {
                state.setIn(['name', 'error'], null);
            }

            validateNamespace(t, state);

            if (state.getIn(['fromExistingEntity', 'value']) && !state.getIn(['existingEntity', 'value'])) {
                state.setIn(['existingEntity', 'error'], t('sourceCustomFormsMustNotBeEmpty'));
            } else {
                state.setIn(['existingEntity', 'error'], null);
            }

            let formsServerValidationRunning = false;
            const formsErrors = [];

            for (const fld of serverValidatedFields) {
                const serverValidation = state.getIn([fld, 'serverValidation']);

                if (serverValidation && serverValidation.errors) {
                    formsErrors.push(...serverValidation.errors.map(x => <div><em>{templateSettings[fld].label}</em>{' '}–{' '}{x}</div>));
                } else if (!serverValidation) {
                    formsServerValidationRunning = true;
                }
            }

            if (!formsErrors.length && formsServerValidationRunning) {
                formsErrors.push(t('validationIsInProgress'));
            }

            if (formsErrors.length) {
                state.setIn(['selectedTemplate', 'error'],
                    <div><strong>{t('listOfErrorsInTemplates') + ':'}</strong>
                        <ul>
                            {formsErrors.map((msg, idx) => <li key={idx}>{msg}</li>)}
                        </ul>
                    </div>);
            } else {
                state.setIn(['selectedTemplate', 'error'], null);
            }
        }
    });

    useEffect(() => {
        if (entity) {
            formState.getFormValuesFromEntity(entity);
        } else {
            const data = {
                name: '',
                description: '',
                fromExistingEntity: false,
                existingEntity: null,
                selectedTemplate: 'layout',
                namespace: getDefaultNamespace(permissions)
            };
            supplyDefaults(data);
            formState.populateFormValues(data);
        }
    }, []);

    async function submitHandler(submitAndLeave) {
        let sendMethod, url;
        if (entity) {
            sendMethod = FormSendMethod.PUT;
            url = `rest/forms/${entity.id}`;
        } else {
            sendMethod = FormSendMethod.POST;
            url = 'rest/forms';
        }

        try {
            formState.disableForm();
            formState.setFormStatusMessage('info', t('saving'));

            const submitResult = await formState.validateAndSendFormValuesToURL(sendMethod, url);

            if (submitResult) {
                if (entity) {
                    if (submitAndLeave) {
                        navigateToWithFlashMessage('/lists/forms', 'success', t('customFormsUpdated'));
                    } else {
                        await formState.getFormValuesFromURL(`rest/forms/${entity.id}`).catch(handleError);
                        formState.enableForm();
                        formState.setFormStatusMessage('success', t('customFormsUpdated'));
                    }
                } else {
                    if (submitAndLeave) {
                        navigateToWithFlashMessage('/lists/forms', 'success', t('customFormsCreated'));
                    } else {
                        navigateToWithFlashMessage(`/lists/forms/${submitResult}/edit`, 'success', t('customFormsCreated'));
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

    async function preview(formKey) {
        const data = {
            formKey,
            template: formState.getFormValue(formKey),
            layout: formState.getFormValue('layout'),
            formInputStyle: formState.getFormValue('form_input_style'),
            listId: formState.getFormValue('previewList')
        };

        const response = await axios.post(getUrl('rest/forms-preview'), data);

        setPreviewKey(formKey);
        setPreviewContents(response.data.content);
        setPreviewLabel(templateSettings[formKey].label);
    }

    const isEdit = !!entity;
    const canDelete = isEdit && entity.permissions.includes('delete');

    const templateOptGroups = [];
    for (const grpKey in templateGroups) {
        const grp = templateGroups[grpKey];
        templateOptGroups.push({
            key: grpKey,
            label: grp.label,
            options: grp.options.map(opt => ({
                key: opt,
                label: templateSettings[opt].label
            }))
        });
    }

    const customFormsColumns = [
        { data: 1, title: t('name') },
        { data: 2, title: t('description') },
        { data: 3, title: t('namespace') }
    ];

    const listsColumns = [
        { data: 0, title: "#" },
        { data: 1, title: t('name') },
        { data: 2, title: t('id'), render: data => <code>{data}</code> },
        { data: 5, title: t('namespace') }
    ];

    const previewListId = formState.getFormValue('previewList');
    const selectedTemplate = formState.getFormValue('selectedTemplate');

    return (
        <div className={previewFullscreen ? "withElementInFullscreen" : ''}>
            {canDelete &&
                <DeleteModalDialog
                    stateOwner={formState}
                    visible={action === 'delete'}
                    deleteUrl={`rest/forms/${entity.id}`}
                    backUrl={`/lists/forms/${entity.id}/edit`}
                    successUrl="/lists/forms"
                    deletingMsg={t('deletingForm')}
                    deletedMsg={t('formDeleted')}/>
            }

            <Title>{isEdit ? t('editCustomForms') : t('createCustomForms')}</Title>

            <Form stateOwner={formState} onSubmitAsync={(...args) => submitHandler(...args)}>
                <InputField id="name" label={t('name')}/>

                <TextArea id="description" label={t('description')}/>

                <NamespaceSelect/>

                {!isEdit &&
                    <CheckBox id="fromExistingEntity" label={t('customForms')} text={t('cloneFromExistingCustomForms')}/>
                }

                {formState.getFormValue('fromExistingEntity') ?
                    <TableSelect id="existingEntity" label={t('sourceCustomForms')} withHeader dropdown dataUrl='rest/forms-table' columns={customFormsColumns} selectionLabelIndex={1} />
                :
                    <>
                        <Fieldset label={t('formsPreview')}>
                            <TableSelect id="previewList" label={t('listToPreviewOn')} withHeader dropdown dataUrl='rest/lists-table' columns={listsColumns} selectionLabelIndex={1} help={t('selectListWhoseFieldsWillBeUsedToPreview')}/>

                            { previewListId &&
                            <div>
                                <AlignedRow>
                                    <div>
                                        <small>
                                            {t('noteTheseLinksAreSolelyForAQuickPreview')}
                                        </small>
                                    </div>
                                    <p>
                                        <ActionLink onClickAsync={async () => await preview('web_subscribe')}>Subscribe</ActionLink>
                                        {' | '}
                                        <ActionLink onClickAsync={async () => await preview('web_confirm_subscription_notice')}>Confirm Subscription Notice</ActionLink>
                                        {' | '}
                                        <ActionLink onClickAsync={async () => await preview('web_confirm_unsubscription_notice')}>Confirm Unsubscription Notice</ActionLink>
                                        {' | '}
                                        <ActionLink onClickAsync={async () => await preview('web_subscribed_notice')}>Subscribed Notice</ActionLink>
                                        {' | '}
                                        <ActionLink onClickAsync={async () => await preview('web_updated_notice')}>Updated Notice</ActionLink>
                                        {' | '}
                                        <ActionLink onClickAsync={async () => await preview('web_unsubscribed_notice')}>Unsubscribed Notice</ActionLink>
                                        {' | '}
                                        <ActionLink onClickAsync={async () => await preview('web_manual_unsubscribe_notice')}>Manual Unsubscribe Notice</ActionLink>
                                        {' | '}
                                        <ActionLink onClickAsync={async () => await preview('web_unsubscribe')}>Unsubscribe</ActionLink>
                                        {' | '}
                                        <ActionLink onClickAsync={async () => await preview('web_manage')}>Manage</ActionLink>
                                        {' | '}
                                        <ActionLink onClickAsync={async () => await preview('web_manage_address')}>Manage Address</ActionLink>
                                        {' | '}
                                        <ActionLink onClickAsync={async () => await preview('web_privacy_policy_notice')}>Privacy Policy</ActionLink>
                                    </p>
                                </AlignedRow>
                                {previewContents &&
                                <div className={previewFullscreen ? formsStyles.editorFullscreen : formsStyles.editor}>
                                    <div className={formsStyles.navbar}>
                                        <div className={formsStyles.navbarLeft}>
                                            {previewFullscreen && <img className={formsStyles.logo} src={getTrustedUrl('static/mailtrain-notext.png')}/>}
                                            <div className={formsStyles.title}>{t('formPreview') + ' ' + previewLabel}</div>
                                        </div>
                                        <div className={formsStyles.navbarRight}>
                                            <a className={formsStyles.btn} onClick={() => preview(previewKey)} title={t('refresh')}><Icon icon="sync-alt"/></a>
                                            <a className={formsStyles.btn} onClick={() => setPreviewFullscreen(!previewFullscreen)} title={t('maximizeEditor')}><Icon icon="window-maximize"/></a>
                                            <a className={formsStyles.btn} onClick={() => { setPreviewContents(null); setPreviewFullscreen(false); }} title={t('closePreview')}><Icon icon="window-close"/></a>
                                        </div>
                                    </div>
                                    <iframe className={formsStyles.host} src={"data:text/html;charset=utf-8," + encodeURIComponent(previewContents)}></iframe>
                                </div>
                                }
                            </div>
                            }
                        </Fieldset>

                        { selectedTemplate &&
                        <Fieldset label={t('templates')}>
                            <Dropdown id="selectedTemplate" label={t('edit')} options={templateOptGroups} help={templateSettings[selectedTemplate].help}/>
                            <ACEEditor id={selectedTemplate} height="500px" mode={templateSettings[selectedTemplate].mode}/>
                        </Fieldset>
                        }
                    </>
                }

                <ButtonRow>
                    <Button type="submit" className="btn-primary" icon="check" label={t('save')}/>
                    <Button type="submit" className="btn-primary" icon="check" label={t('saveAndLeave')} onClickAsync={async () => await submitHandler(true)}/>
                    {canDelete && <LinkButton className="btn-danger" icon="trash-alt" label={t('delete')} to={`/lists/forms/${entity.id}/delete`}/>}
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
