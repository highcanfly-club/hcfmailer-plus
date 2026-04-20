'use strict';

import React, {useEffect} from 'react';
import PropTypes from 'prop-types';
import {useTranslation} from '../lib/i18n';
import {Title} from '../lib/page';
import {Button, ButtonRow, Form, TableSelect} from '../lib/form';
import {useErrorHandling} from '../lib/hooks/useErrorHandling';
import {usePageHelpers} from '../lib/hooks/usePageHelpers';
import {useRequiresAuthenticatedUser} from '../lib/hooks/useRequiresAuthenticatedUser';
import {useForm} from '../lib/hooks/useForm';
import {getTagLanguages, getTemplateTypes, ResourceType} from '../templates/helpers';
import moment from 'moment';
import {getMailerTypes} from "../send-configurations/helpers";
import {getCampaignLabels} from "./helpers";

export default function Clone({ cloneFromChannel }) {
    const { t } = useTranslation();
    const { handleError } = useErrorHandling();
    const { navigateTo } = usePageHelpers();
    useRequiresAuthenticatedUser();

    const templateTypes = getTemplateTypes(t, 'data_sourceCustom_', ResourceType.CAMPAIGN);
    const tagLanguages = getTagLanguages(t);
    const mailerTypes = getMailerTypes(t);
    const { campaignTypeLabels } = getCampaignLabels(t);

    const formState = useForm({
        leaveConfirmation: false,
        localValidateFormValues: (state) => {
            for (const key of state.keys()) {
                state.setIn([key, 'error'], null);
            }
            if (!state.getIn(['sourceCampaign', 'value'])) {
                state.setIn(['sourceCampaign', 'error'], t('campaignMustBeSelected'));
            }
        }
    });

    useEffect(() => {
        formState.populateFormValues({ sourceCampaign: null });
    }, []);

    async function submitHandler() {
        try {
            const sourceCampaign = formState.getFormValue('sourceCampaign');
            navigateTo(`/campaigns/clone/${sourceCampaign}`);
        } catch (e) {
            handleError(e);
        }
    }

    const campaignsColumns = [
        { data: 1, title: t('name') },
        { data: 2, title: t('id'), render: data => <code>{data}</code> },
        { data: 3, title: t('description') },
        { data: 4, title: t('type'), render: data => campaignTypeLabels[data] },
        { data: 9, title: t('created'), render: data => moment(data).fromNow() },
        { data: 10, title: t('namespace') }
    ];

    let campaignSelect;
    if (cloneFromChannel) {
        campaignSelect = <TableSelect id="sourceCampaign" label={t('campaign')} withHeader dropdown dataUrl={`rest/campaigns-by-channel-table/${cloneFromChannel.id}`} columns={campaignsColumns} order={[4, 'desc']} selectionLabelIndex={1} help={t('selectCampaignToBeCloned')}/>;
    } else {
        campaignSelect = <TableSelect id="sourceCampaign" label={t('campaign')} withHeader dropdown dataUrl='rest/campaigns-table' columns={campaignsColumns} order={[4, 'desc']} selectionLabelIndex={1} help={t('selectCampaignToBeCloned')}/>;
    }

    return (
        <div>
            <Title>{t('createCampaign')}</Title>

            <Form stateOwner={formState} onSubmitAsync={submitHandler}>
                {campaignSelect}

                <ButtonRow>
                    <Button type="submit" className="btn-primary" icon="chevron-right" label={t('next')}/>
                </ButtonRow>
            </Form>
        </div>
    );
}

Clone.propTypes = {
    cloneFromChannel: PropTypes.object
};
