'use strict';

import React, {useEffect, useRef, useState} from 'react';
import PropTypes from 'prop-types';
import {useTranslation} from '../lib/i18n';
import {LinkButton, Title} from '../lib/page';
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
    TableSelect,
    TextArea,
} from '../lib/form';
import {getDefaultNamespace, NamespaceSelect, validateNamespace} from '../lib/namespace';
import {DeleteModalDialog} from "../lib/modals";
import mailtrainConfig from 'mailtrainConfig';
import {getModals, getTagLanguages, getTemplateTypes, getTypeForm, ResourceType} from '../templates/helpers';
import axios from '../lib/axios';
import "../lib/styles.scss";
import "./styles.scss";
import {getUrl} from "../lib/urls";
import {campaignOverridables, CampaignSource, CampaignStatus} from "../../../shared/campaigns";
import moment from 'moment';
import {getMailerTypes} from "../send-configurations/helpers";
import {getCampaignLabels, ListsSelectorHelper} from "../campaigns/helpers";
import interoperableErrors from "../../../shared/interoperable-errors";
import {Trans} from "react-i18next";
import {enableDeleteModal} from "../settings/settings";
import {useErrorHandling} from '../lib/hooks/useErrorHandling';
import {usePageHelpers} from '../lib/hooks/usePageHelpers';
import {useRequiresAuthenticatedUser} from '../lib/hooks/useRequiresAuthenticatedUser';
import {useForm} from '../lib/hooks/useForm';

export default function CUD({ action, entity, permissions, type }) {
    const { t } = useTranslation();
    const { handleError } = useErrorHandling();
    const { navigateToWithFlashMessage } = usePageHelpers();
    useRequiresAuthenticatedUser();

    const templateTypes = getTemplateTypes(t, 'data_sourceCustom_', ResourceType.CAMPAIGN, true);
    const tagLanguages = getTagLanguages(t);
    const mailerTypes = getMailerTypes(t);
    const { campaignTypeLabels } = getCampaignLabels(t);

    const sourceLabels = {
        [CampaignSource.CUSTOM]: t('customContent'),
        [CampaignSource.CUSTOM_FROM_CAMPAIGN]: t('customContentClonedFromAnotherCampaign'),
        [CampaignSource.TEMPLATE]: t('template'),
        [CampaignSource.CUSTOM_FROM_TEMPLATE]: t('customContentClonedFromTemplate'),
        [CampaignSource.URL]: t('url')
    };

    const sourceLabelsOrder = [
        CampaignSource.CUSTOM, CampaignSource.CUSTOM_FROM_CAMPAIGN, CampaignSource.TEMPLATE, CampaignSource.CUSTOM_FROM_TEMPLATE, CampaignSource.URL
    ];

    const sourceOptions = sourceLabelsOrder.map(key => ({key, label: sourceLabels[key]}));
    const customTemplateTypeOptions = mailtrainConfig.editors.map(key => ({key, label: templateTypes[key].typeName}));
    const customTemplateTagLanguageOptions = mailtrainConfig.tagLanguages.map(key => ({key, label: tagLanguages[key].name}));

    const [sendConfiguration, setSendConfiguration] = useState(null);
    const fetchSendConfigurationIdRef = useRef(null);

    async function fetchSendConfiguration(sendConfigurationId) {
        if (sendConfigurationId) {
            fetchSendConfigurationIdRef.current = sendConfigurationId;
            try {
                const result = await axios.get(getUrl(`rest/send-configurations-public/${sendConfigurationId}`));
                if (sendConfigurationId === fetchSendConfigurationIdRef.current) {
                    setSendConfiguration(result.data);
                }
            } catch (err) {
                if (err instanceof interoperableErrors.PermissionDeniedError) {
                    setSendConfiguration(null);
                } else {
                    handleError(err);
                }
            }
        }
    }

    function populateTemplateDefaults(data) {
        data.data_sourceTemplate = null;
        data.data_sourceCampaign = null;
        data.data_sourceCustom_type = mailtrainConfig.editors[0];
        data.data_sourceCustom_tag_language = mailtrainConfig.tagLanguages[0];
        data.data_sourceCustom_data = {};
        Object.assign(data, templateTypes[mailtrainConfig.editors[0]].initData());
        data.data_sourceUrl = '';
    }

    const formState = useForm({
        onChangeBeforeValidation: (mutStateData, key, oldValue, newValue) => {
            if (key === 'data_sourceCustom_type') {
                if (newValue) templateTypes[newValue].afterTypeChange(mutStateData);
            }
            if (key === 'data_sourceCustom_tag_language') {
                if (newValue) {
                    const currentType = mutStateData.getIn(['data_sourceCustom_type', 'value']);
                    const isEdit = !!entity;
                    templateTypes[currentType].afterTagLanguageChange(mutStateData, isEdit);
                }
            }
            listsSelectorHelperRef.current.onFormChangeBeforeValidation(mutStateData, key, oldValue, newValue);
        },
        getFormValuesMutator(data) {
            populateTemplateDefaults(data);

            if (data.source === CampaignSource.TEMPLATE || data.source === CampaignSource.CUSTOM_FROM_TEMPLATE) {
                data.data_sourceTemplate = data.data.sourceTemplate;
            } else if (data.source === CampaignSource.CUSTOM_FROM_CAMPAIGN) {
                data.data_sourceCampaign = data.data.sourceCampaign;
            } else if (data.source === CampaignSource.CUSTOM) {
                data.data_sourceCustom_type = data.data.sourceCustom.type;
                data.data_sourceCustom_tag_language = data.data.sourceCustom.tag_language;
                data.data_sourceCustom_data = data.data.sourceCustom.data;
                templateTypes[data.data.sourceCustom.type].afterLoad(data);
            } else if (data.source === CampaignSource.URL) {
                data.data_sourceUrl = data.data.sourceUrl;
            }

            for (const overridable of campaignOverridables) {
                if (data[overridable + '_override'] === null) {
                    data[overridable + '_override'] = '';
                    data[overridable + '_overriden'] = false;
                } else {
                    data[overridable + '_overriden'] = true;
                }
            }

            listsSelectorHelperRef.current.getFormValuesMutator(data);
            fetchSendConfiguration(data.send_configuration);
        },
        submitFormValuesMutator(data) {
            const isEdit = !!entity;
            data.source = Number.parseInt(data.source);
            data.data = {};

            if (data.source === CampaignSource.TEMPLATE || data.source === CampaignSource.CUSTOM_FROM_TEMPLATE) {
                data.data.sourceTemplate = data.data_sourceTemplate;
            } else if (data.source === CampaignSource.CUSTOM_FROM_CAMPAIGN) {
                data.data.sourceCampaign = data.data_sourceCampaign;
            } else if (data.source === CampaignSource.CUSTOM) {
                templateTypes[data.data_sourceCustom_type].beforeSave(data);
                data.data.sourceCustom = {
                    type: data.data_sourceCustom_type,
                    tag_language: data.data_sourceCustom_tag_language,
                    data: data.data_sourceCustom_data,
                };
            } else if (data.source === CampaignSource.URL) {
                data.data.sourceUrl = data.data_sourceUrl;
            }

            for (const overridable of campaignOverridables) {
                if (!data[overridable + '_overriden']) {
                    data[overridable + '_override'] = null;
                }
                delete data[overridable + '_overriden'];
            }

            listsSelectorHelperRef.current.submitFormValuesMutator(data);

            return filterData(data, [
                'name', 'description', 'namespace', 'cpg_name', 'cpg_description', 'send_configuration',
                'subject', 'from_name_override', 'from_email_override', 'reply_to_override',
                'data', 'click_tracking_disabled', 'open_tracking_disabled', 'unsubscribe_url',
                'source', 'lists'
            ]);
        },
        localValidateFormValues(state) {
            for (const key of state.keys()) {
                state.setIn([key, 'error'], null);
            }

            if (!state.getIn(['name', 'value'])) {
                state.setIn(['name', 'error'], t('nameMustNotBeEmpty'));
            }

            const sourceTypeKey = Number.parseInt(state.getIn(['source', 'value']));

            if (sourceTypeKey === CampaignSource.TEMPLATE || sourceTypeKey === CampaignSource.CUSTOM_FROM_TEMPLATE) {
                if (!state.getIn(['data_sourceTemplate', 'value'])) {
                    state.setIn(['data_sourceTemplate', 'error'], t('templateMustBeSelected'));
                }
            } else if (sourceTypeKey === CampaignSource.CUSTOM_FROM_CAMPAIGN) {
                if (!state.getIn(['data_sourceCampaign', 'value'])) {
                    state.setIn(['data_sourceCampaign', 'error'], t('campaignMustBeSelected'));
                }
            } else if (sourceTypeKey === CampaignSource.CUSTOM) {
                const customTemplateTypeKey = state.getIn(['data_sourceCustom_type', 'value']);
                if (!customTemplateTypeKey) {
                    state.setIn(['data_sourceCustom_type', 'error'], t('typeMustBeSelected'));
                }
                if (!state.getIn(['data_sourceCustom_tag_language', 'value'])) {
                    state.setIn(['data_sourceCustom_tag_language', 'error'], t('tagLanguageMustBeSelected'));
                }
                if (customTemplateTypeKey) {
                    templateTypes[customTemplateTypeKey].validate(state);
                }
            } else if (sourceTypeKey === CampaignSource.URL) {
                if (!state.getIn(['data_sourceUrl', 'value'])) {
                    state.setIn(['data_sourceUrl', 'error'], t('urlMustNotBeEmpty'));
                }
            }

            listsSelectorHelperRef.current.localValidateFormValues(state);
            validateNamespace(t, state);
        }
    });

    const listsSelectorHelperRef = useRef(null);
    if (!listsSelectorHelperRef.current) {
        listsSelectorHelperRef.current = new ListsSelectorHelper(formState, t, 'lists', true);
    }

    const sendConfigId = formState.getFormValue('send_configuration');
    useEffect(() => {
        setSendConfiguration(null);
        if (sendConfigId) fetchSendConfiguration(sendConfigId);
    }, [sendConfigId]);

    useEffect(() => {
        if (entity) {
            formState.getFormValuesFromEntity(entity);
        } else {
            const data = {};

            for (const overridable of campaignOverridables) {
                data[overridable + '_override'] = '';
                data[overridable + '_overriden'] = false;
            }

            data.type = type;
            data.name = '';
            data.description = '';
            data.cpg_name = '';
            data.cpg_description = '';

            listsSelectorHelperRef.current.populateFrom(data, []);

            data.send_configuration = null;
            data.namespace = getDefaultNamespace(permissions);
            data.subject = '';
            data.click_tracking_disabled = false;
            data.open_tracking_disabled = false;
            data.unsubscribe_url = '';
            data.source = CampaignSource.CUSTOM;

            populateTemplateDefaults(data);

            formState.populateFormValues(data);
        }
    }, []);

    async function submitHandler(submitAndLeave) {
        try {
            let sendMethod, url;
            if (entity) {
                sendMethod = FormSendMethod.PUT;
                url = `rest/channels/${entity.id}`;
            } else {
                sendMethod = FormSendMethod.POST;
                url = 'rest/channels';
            }

            formState.disableForm();
            formState.setFormStatusMessage('info', t('saving'));

            const submitResult = await formState.validateAndSendFormValuesToURL(sendMethod, url);

            if (submitResult) {
                if (entity) {
                    if (submitAndLeave) {
                        navigateToWithFlashMessage('/channels', 'success', t('channelUpdated'));
                    } else {
                        await formState.getFormValuesFromURL(`rest/channels/${entity.id}`);
                        formState.enableForm();
                        formState.setFormStatusMessage('success', t('channelUpdated'));
                    }
                } else {
                    if (submitAndLeave) {
                        navigateToWithFlashMessage('/channels', 'success', t('channelCreated'));
                    } else {
                        navigateToWithFlashMessage(`/channels/${submitResult}/edit`, 'success', t('channelCreated'));
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
    const canModify = !isEdit || entity.permissions.includes('edit');
    const canDelete = isEdit && entity.permissions.includes('delete');

    const sourceTypeKey = Number.parseInt(formState.getFormValue('source'));

    const sendConfigurationsColumns = [
        { data: 1, title: t('name') },
        { data: 2, title: t('id'), render: data => <code>{data}</code> },
        { data: 3, title: t('description') },
        { data: 4, title: t('type'), render: data => mailerTypes[data].typeName },
        { data: 6, title: t('namespace') }
    ];

    let sendSettings;
    if (formState.getFormValue('send_configuration')) {
        if (sendConfiguration) {
            sendSettings = [];

            const addOverridable = (id, label) => {
                if (sendConfiguration[id + '_overridable']) {
                    if (formState.getFormValue(id + '_overriden')) {
                        sendSettings.push(<InputField label={label} key={id + '_override'} id={id + '_override'}/>);
                    } else {
                        sendSettings.push(
                            <StaticField key={id + '_original'} label={label} id={id + '_original'} className={"formDisabled"}>
                                {sendConfiguration[id]}
                            </StaticField>
                        );
                    }
                    sendSettings.push(<CheckBox key={id + '_overriden'} id={id + '_overriden'} text={t('override')} className={campaignsStyles.overrideCheckbox}/>);
                } else {
                    sendSettings.push(
                        <StaticField key={id + '_original'} label={label} id={id + '_original'} className={"formDisabled"}>
                            {sendConfiguration[id]}
                        </StaticField>
                    );
                }
            };

            addOverridable('from_name', t('fromName'));
            addOverridable('from_email', t('fromEmailAddress'));
            addOverridable('reply_to', t('replytoEmailAddress'));
        } else {
            sendSettings = <AlignedRow>{t('loadingSendConfiguration')}</AlignedRow>;
        }
    } else {
        sendSettings = null;
    }

    let templateModals = null;
    let templateEdit = null;
    if (sourceTypeKey === CampaignSource.TEMPLATE || (!isEdit && sourceTypeKey === CampaignSource.CUSTOM_FROM_TEMPLATE)) {
        const templatesColumns = [
            { data: 1, title: t('name') },
            { data: 2, title: t('description') },
            { data: 3, title: t('type'), render: data => templateTypes[data].typeName },
            { data: 5, title: t('created'), render: data => moment(data).fromNow() },
            { data: 6, title: t('namespace') },
        ];

        let help = null;
        if (sourceTypeKey === CampaignSource.CUSTOM_FROM_TEMPLATE) {
            help = t('selectingATemplateCreatesACampaign');
        }

        templateEdit = <TableSelect key="templateSelect" id="data_sourceTemplate" label={t('template')} withHeader dropdown dataUrl='rest/templates-table' columns={templatesColumns} selectionLabelIndex={1} help={help}/>;

    } else if (sourceTypeKey === CampaignSource.CUSTOM_FROM_CAMPAIGN) {
        const campaignsColumns = [
            { data: 1, title: t('name') },
            { data: 2, title: t('id'), render: data => <code>{data}</code> },
            { data: 3, title: t('description') },
            { data: 4, title: t('type'), render: data => campaignTypeLabels[data] },
            { data: 5, title: t('created'), render: data => moment(data).fromNow() },
            { data: 6, title: t('namespace') }
        ];

        templateEdit = <TableSelect key="campaignSelect" id="data_sourceCampaign" label={t('campaign')} withHeader dropdown dataUrl='rest/campaigns-with-content-table' columns={campaignsColumns} selectionLabelIndex={1} help={t('contentOfTheSelectedCampaignWillBeCopied')}/>;

    } else if (sourceTypeKey === CampaignSource.CUSTOM) {
        const customTemplateTypeKey = formState.getFormValue('data_sourceCustom_type');

        if (customTemplateTypeKey) {
            templateModals = getModals(formState, customTemplateTypeKey, isEdit);
            const customTemplateTypeForm = getTypeForm(formState, customTemplateTypeKey, false);

            templateEdit = <div>
                <Dropdown id="data_sourceCustom_type" label={t('type')} options={customTemplateTypeOptions}/>
                <Dropdown id="data_sourceCustom_tag_language" label={t('tagLanguage')} options={customTemplateTagLanguageOptions}/>
                {customTemplateTypeForm}
            </div>;
        } else {
            templateEdit = <div>
                <Dropdown id="data_sourceCustom_type" label={t('type')} options={customTemplateTypeOptions}/>
                <Dropdown id="data_sourceCustom_tag_language" label={t('tagLanguage')} options={customTemplateTagLanguageOptions}/>
            </div>;
        }

    } else if (sourceTypeKey === CampaignSource.URL) {
        templateEdit = <InputField id="data_sourceUrl" label={t('renderUrl')} help={t('ifAMessageIsSentThenThisUrlWillBePosTed')}/>;
    }

    return (
        <div>
            {enableDeleteModal && canDelete &&
                <DeleteModalDialog
                    stateOwner={formState}
                    visible={action === 'delete'}
                    deleteUrl={`rest/channels/${entity.id}`}
                    backUrl={`/channels/${entity.id}/edit`}
                    successUrl="/channels"
                    deletingMsg={t('deletingChannel')}
                    deletedMsg={t('channelDeleted')}/>
            }
            {templateModals}

            <Title>{isEdit ? t('editChannel') : t('createChannel')}</Title>

            {!canModify &&
            <div className="alert alert-warning" role="alert">
                <Trans i18nKey="warning!YouDoNotHaveNecessaryPermissions-1"><b>Warning!</b> You do not have necessary permissions to edit this channel. Any changes that you perform here will be lost.</Trans>
            </div>
            }

            {isEdit && entity.status === CampaignStatus.SENDING &&
                <div className={`alert alert-info`} role="alert">
                    {t('formCannotBeEditedBecauseTheCampaignIs')}
                </div>
            }

            <Form stateOwner={formState} onSubmitAsync={submitHandler}>
                <InputField id="name" label={t('name')}/>

                {isEdit &&
                <StaticField id="cid" className={"formDisabled"} label={t('id')}>
                    {formState.getFormValue('cid')}
                </StaticField>
                }

                <TextArea id="description" label={t('description')}/>

                <NamespaceSelect/>

                <hr/>
                <Fieldset label={t('campaignDefaults')}>
                    <InputField id="cpg_name" label={t('campaignName-1')}/>
                    <TextArea id="cpg_description" label={t('campaignDescription')}/>
                </Fieldset>

                <hr/>

                {listsSelectorHelperRef.current.render()}

                <hr/>

                <Fieldset label={t('sendSettings')}>
                    <TableSelect id="send_configuration" label={t('sendConfiguration-1')} withHeader withClear dropdown dataUrl='rest/send-configurations-table' columns={sendConfigurationsColumns} selectionLabelIndex={1} />
                    {sendSettings}
                    <InputField label={t('subjectLine')} key="subject" id="subject"/>
                    <InputField id="unsubscribe_url" label={t('customUnsubscribeUrl')}/>
                </Fieldset>

                <hr/>

                <Fieldset label={t('tracking')}>
                    <CheckBox id="open_tracking_disabled" text={t('disableOpenedTracking')}/>
                    <CheckBox id="click_tracking_disabled" text={t('disableClickedTracking')}/>
                </Fieldset>

                <hr/>
                <Fieldset label={t('template')}>
                    <Dropdown id="source" label={t('contentSource')} options={sourceOptions}/>
                </Fieldset>

                {templateEdit}

                <ButtonRow>
                    {canModify &&
                        <>
                            <Button type="submit" className="btn-primary" icon="check" label={t('save')}/>
                            <Button type="submit" className="btn-primary" icon="check" label={t('saveAndLeave')} onClickAsync={async () => await submitHandler(true)}/>
                        </>
                    }
                    {enableDeleteModal && canDelete && <LinkButton className="btn-danger" icon="trash-alt" label={t('delete')} to={`/channels/${entity.id}/delete`}/>}
                </ButtonRow>
            </Form>
        </div>
    );
}

CUD.propTypes = {
    action: PropTypes.string.isRequired,
    entity: PropTypes.object,
    permissions: PropTypes.object,
    type: PropTypes.number
};
