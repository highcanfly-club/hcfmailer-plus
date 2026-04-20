'use strict';

import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { Trans } from 'react-i18next';
import { useTranslation } from '../lib/i18n';
import { requiresAuthenticatedUser, Title } from '../lib/page';
import {
    Button,
    ButtonRow,
    Fieldset,
    filterData,
    Form,
    FormSendMethod,
    InputField,
    TextArea,
} from '../lib/form';
import { useForm } from '../lib/hooks/useForm';
import { useErrorHandling } from '../lib/hooks/useErrorHandling';
import { useRequiresAuthenticatedUser } from '../lib/hooks/useRequiresAuthenticatedUser';

export default function Update({ entity }) {
    useRequiresAuthenticatedUser();
    const { t } = useTranslation();
    const { handleError } = useErrorHandling();

    const formState = useForm({
        submitFormValuesMutator: (data) => {
            return filterData(data, ['adminEmail', 'uaCode', 'mapsApiKey', 'shoutout', 'pgpPassphrase', 'pgpPrivateKey', 'defaultHomepage']);
        },
        localValidateFormValues: (state) => {
            // no-op
        }
    });

    useEffect(() => {
        formState.getFormValuesFromEntity(entity);
    }, []);

    async function submitHandler() {
        try {
            formState.disableForm();
            formState.setFormStatusMessage('info', t('saving'));

            const submitSuccessful = await formState.validateAndSendFormValuesToURL(FormSendMethod.PUT, 'rest/settings');

            if (submitSuccessful) {
                await formState.getFormValuesFromURL('rest/settings').catch(handleError);
                formState.enableForm();
                formState.setFormStatusMessage('success', t('globalSettingsSaved'));
            } else {
                formState.enableForm();
                formState.setFormStatusMessage('warning', t('thereAreErrorsInTheFormPleaseFixThemAnd'));
            }
        } catch (e) {
            handleError(e);
        }
    }

    return (
        <div>
            <Title>{t('globalSettings')}</Title>

            <Form stateOwner={formState} onSubmitAsync={(...args) => submitHandler(...args)}>
                <InputField id="adminEmail" label={t('adminEmail')} help={t('thisEmailIsUsedAsTheMainContactAndAsA')}/>
                <InputField id="defaultHomepage" label={t('defaultHomepageUrl')} help={t('thisUrlWillBeUsedInListSubscriptionForms')}/>

                <InputField id="uaCode" label={t('trackingId')} placeholder={t('uaxxxxxxx')} help={t('enterGoogleAnalyticsTrackingCode')}/>
                <InputField id="mapsApiKey" label={t('googleMapsApiKey')} placeholder={t('xxxxxx')} help={t('theMapOverviewInCampaignStatistics')}/>

                <TextArea id="shoutout" label={t('frontpageShoutOut')} help={t('htmlCodeShownInTheFrontPageHeaderSection')}/>

                <Fieldset label={t('gpgSigning')}>
                    <Trans i18nKey="onlyMessagesThatAreEncryptedCanBeSigned"><p>Only messages that are encrypted can be signed. Subsribers who have not set up a GPG public key in their profile receive normal email messages. Users with GPG key set receive encrypted messages and if you have signing key also set, the messages are signed with this key.</p></Trans>
                    <Trans i18nKey="doNotUseSensitiveKeysHereThePrivateKey"><p className="text-warning">Do not use sensitive keys here. The private key and passphrase are not encrypted in the database.</p></Trans>
                    <InputField id="pgpPassphrase" label={t('privateKeyPassphrase')} placeholder={t('passphraseForTheKeyIfSet')} help={t('onlyFillThisIfYourPrivateKeyIsEncrypted')}/>
                    <TextArea id="pgpPrivateKey" label={t('gpgPrivateKey')} placeholder={t('beginsWithBeginPgpPrivateKeyBlock')} help={t('thisValueIsOptionalIfYouDoNotProvideA')}/>
                </Fieldset>

                <hr/>
                <ButtonRow>
                    <Button type="submit" className="btn-primary" icon="check" label={t('save')}/>
                </ButtonRow>
            </Form>
        </div>
    );
}

Update.propTypes = {
    entity: PropTypes.object
};
