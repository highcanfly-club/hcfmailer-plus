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
    Dropdown,
    filterData,
    Form,
    FormSendMethod,
    InputField,
    TextArea,
} from '../../lib/form';
import { useForm } from '../../lib/hooks/useForm';
import { useErrorHandling } from '../../lib/hooks/useErrorHandling';
import { usePageHelpers } from '../../lib/hooks/usePageHelpers';
import { useRequiresAuthenticatedUser } from '../../lib/hooks/useRequiresAuthenticatedUser';
import { getDefaultNamespace, NamespaceSelect, validateNamespace } from '../../lib/namespace';
import { DeleteModalDialog } from '../../lib/modals';
import 'ace-builds/src-noconflict/mode-javascript';
import 'ace-builds/src-noconflict/mode-json';
import 'ace-builds/src-noconflict/mode-handlebars';
import { enableDeleteModal } from '../../settings/settings';

export default function CUD({ action, wizard, entity, permissions }) {
    const { t } = useTranslation();
    const { handleError } = useErrorHandling();
    const { navigateToWithFlashMessage } = usePageHelpers();
    useRequiresAuthenticatedUser();

    const formState = useForm({
        submitFormValuesMutator: (data) => {
            return filterData(data, ['name', 'description', 'mime_type', 'user_fields', 'js', 'hbs', 'namespace']);
        },
        localValidateFormValues: (state) => {
            if (!state.getIn(['name', 'value'])) {
                state.setIn(['name', 'error'], t('nameMustNotBeEmpty'));
            } else {
                state.setIn(['name', 'error'], null);
            }

            if (!state.getIn(['mime_type', 'value'])) {
                state.setIn(['mime_type', 'error'], t('mimeTypeMustBeSelected'));
            } else {
                state.setIn(['mime_type', 'error'], null);
            }

            try {
                const userFields = JSON.parse(state.getIn(['user_fields', 'value']));
                state.setIn(['user_fields', 'error'], null);
            } catch (err) {
                if (err instanceof SyntaxError) {
                    state.setIn(['user_fields', 'error'], t('syntaxErrorInTheUserFieldsSpecification'));
                }
            }

            validateNamespace(t, state);
        }
    });

    useEffect(() => {
        if (entity) {
            formState.getFormValuesFromEntity(entity);
        } else {
            if (wizard === 'open-counts') {
                formState.populateFormValues({
                    name: '',
                    description: 'Generates a campaign report listing all subscribers along with open counts.',
                    namespace: getDefaultNamespace(permissions),
                    mime_type: 'text/html',
                    user_fields:
                        '[\n' +
                        '  {\n' +
                        '    "id": "campaign",\n' +
                        '    "name": "Campaign",\n' +
                        '    "type": "campaign",\n' +
                        '    "minOccurences": 1,\n' +
                        '    "maxOccurences": 1\n' +
                        '  }\n' +
                        ']',
                    js:
                        'const results = await campaigns.getCampaignOpenStatistics(inputs.campaign, ["*"])\n' +
                        'render({ results })',
                    hbs:
                        '<h2>{{title}}</h2>\n' +
                        '\n' +
                        '<div class="table-responsive">\n' +
                        '  <table class="table table-bordered table-hover" width="100%">\n' +
                        '    <thead>\n' +
                        '    <th>\n' +
                        '      Email\n' +
                        '    </th>\n' +
                        '    <th>\n' +
                        '      Open Count\n' +
                        '    </th>\n' +
                        '    </thead>\n' +
                        '    {{#if results}}\n' +
                        '      <tbody>\n' +
                        '      {{#each results}}\n' +
                        '        <tr>\n' +
                        '          <th scope="row">\n' +
                        '            {{subscription:email}}\n' +
                        '          </th>\n' +
                        '          <td style="width: 20%;">\n' +
                        '            {{tracker:count}}\n' +
                        '          </td>\n' +
                        '        </tr>\n' +
                        '      {{/each}}\n' +
                        '      </tbody>\n' +
                        '    {{/if}}\n' +
                        '  </table>\n' +
                        '</div>'
                });

            } else if (wizard === 'open-counts-csv') {
                formState.populateFormValues({
                    name: '',
                    description: 'Generates a campaign report as CSV that lists all subscribers along with open counts.',
                    namespace: getDefaultNamespace(permissions),
                    mime_type: 'text/csv',
                    user_fields:
                        '[\n' +
                        '  {\n' +
                        '    "id": "campaign",\n' +
                        '    "name": "Campaign",\n' +
                        '    "type": "campaign",\n' +
                        '    "minOccurences": 1,\n' +
                        '    "maxOccurences": 1\n' +
                        '  }\n' +
                        ']',
                    js: 'const results = await campaigns.getCampaignOpenStatisticsStream(inputs.campaign, [\'subscription:email\', \'tracker:count\'], null, (query, col) => query.where(col(\'subscription:status\'), SubscriptionStatus.SUBSCRIBED));\n' +
                        '\n' +
                        'await renderCsvFromStream(\n' +
                        '  results, \n' +
                        '  {\n' +
                        '    header: true,\n' +
                        '    columns: [ { key: \'subscription:email\', header: \'Email\' }, { key: \'tracker:count\', header: \'Open count\' } ],\n' +
                        '    delimiter: \',\'\n' +
                        '  },\n' +
                        '  async (row, encoding) => row\n' +
                        ');',
                    hbs: ''
                });

            } else if (wizard === 'aggregated-open-counts') {
                formState.populateFormValues({
                    name: '',
                    description: 'Generates a campaign report with results are aggregated by "Country" custom field. (Note that this custom field has to be presents in the subscription custom fields.)',
                    namespace: getDefaultNamespace(permissions),
                    mime_type: 'text/html',
                    user_fields:
                        '[\n' +
                        '  {\n' +
                        '    "id": "campaign",\n' +
                        '    "name": "Campaign",\n' +
                        '    "type": "campaign",\n' +
                        '    "minOccurences": 1,\n' +
                        '    "maxOccurences": 1\n' +
                        '  }\n' +
                        ']',
                    js:
                        'const results = await campaigns.getCampaignOpenStatistics(inputs.campaign, ["field:country", "count_opened", "count_all"], (query, col) =>\n' +
                        '  query.count("* AS count_all")\n' +
                        '    .select(knex.raw("SUM(IF(`" + col("tracker:count") +"` IS NULL, 0, 1)) AS count_opened"))\n' +
                        '    .groupBy(col("field:country"))\n' +
                        ')\n' +
                        '\n' +
                        'for (const row of results) {\n' +
                        '    row.percentage = Math.round((row["tracker:count"] / row.count_all) * 100)\n' +
                        '}\n' +
                        '\n' +
                        'render({ results })',
                    hbs:
                        '<h2>{{title}}</h2>\n' +
                        '\n' +
                        '<div class="table-responsive">\n' +
                        '  <table class="table table-bordered table-hover" width="100%">\n' +
                        '    <thead>\n' +
                        '      <th>\n' +
                        '        Country\n' +
                        '      </th>\n' +
                        '      <th>\n' +
                        '        Opened\n' +
                        '      </th>\n' +
                        '      <th>\n' +
                        '        All\n' +
                        '      </th>\n' +
                        '      <th>\n' +
                        '        Percentage\n' +
                        '      </th>\n' +
                        '    </thead>\n' +
                        '    {{#if results}}\n' +
                        '    <tbody>\n' +
                        '    {{#each results}}\n' +
                        '      <tr>\n' +
                        '        <th scope="row">\n' +
                        '          {{field:merge_country}}\n' +
                        '        </th>\n' +
                        '        <td style="width: 20%;">\n' +
                        '          {{count_opened}}\n' +
                        '        </td>\n' +
                        '        <td style="width: 20%;">\n' +
                        '          {{count_all}}\n' +
                        '        </td>\n' +
                        '        <td style="width: 20%;">\n' +
                        '          {{percentage}}%\n' +
                        '        </td>\n' +
                        '      </tr>\n' +
                        '    {{/each}}\n' +
                        '    </tbody>\n' +
                        '    {{/if}}\n' +
                        '  </table>\n' +
                        '</div>'
                });

            } else {
                formState.populateFormValues({
                    name: '',
                    description: '',
                    namespace: getDefaultNamespace(permissions),
                    mime_type: 'text/html',
                    user_fields: '',
                    js: '',
                    hbs: ''
                });
            }
        }
    }, []);

    async function submitHandler(submitAndLeave = false) {
        let sendMethod, url;
        if (entity) {
            sendMethod = FormSendMethod.PUT;
            url = `rest/report-templates/${entity.id}`;
        } else {
            sendMethod = FormSendMethod.POST;
            url = 'rest/report-templates';
        }

        try {
            formState.disableForm();
            formState.setFormStatusMessage('info', t('saving'));

            const submitResult = await formState.validateAndSendFormValuesToURL(sendMethod, url);

            if (submitResult) {
                if (entity) {
                    if (submitAndLeave) {
                        navigateToWithFlashMessage('/reports/templates', 'success', t('reportTemplateUpdated'));
                    } else {
                        await formState.getFormValuesFromURL(`rest/report-templates/${entity.id}`);
                        formState.enableForm();
                        formState.setFormStatusMessage('success', t('reportTemplateUpdated'));
                    }
                } else {
                    if (submitAndLeave) {
                        navigateToWithFlashMessage('/reports/templates', 'success', t('reportTemplateCreated'));
                    } else {
                        navigateToWithFlashMessage(`/reports/templates/${submitResult}/edit`, 'success', t('reportTemplateCreated'));
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
    const canDelete = isEdit && entity.permissions.includes('delete');

    return (
        <div>
            {canDelete &&
                <DeleteModalDialog
                    stateOwner={formState}
                    visible={action === 'delete'}
                    deleteUrl={`rest/report-templates/${entity.id}`}
                    backUrl={`/reports/templates/${entity.id}/edit`}
                    successUrl="/reports/templates"
                    deletingMsg={t('deletingReportTemplate')}
                    deletedMsg={t('reportTemplateDeleted')}/>
            }

            <Title>{isEdit ? t('editReportTemplate') : t('createReportTemplate')}</Title>

            <Form stateOwner={formState} onSubmitAsync={submitHandler}>
                <InputField id="name" label={t('name')}/>
                <TextArea id="description" label={t('description')}/>
                <Dropdown id="mime_type" label={t('type')} options={[{key: 'text/html', label: t('html')}, {key: 'text/csv', label: t('csv')}]}/>
                <NamespaceSelect/>
                <ACEEditor id="user_fields" height="250px" mode="json" label={t('userSelectableFields')} help={t('jsonSpecificationOfUserSelectableFields')}/>
                <ACEEditor id="js" height="700px" mode="javascript" label={t('dataProcessingCode')} help={<Trans i18nKey="writeTheBodyOfTheJavaScriptFunctionWith">Write the body of the JavaScript function with signature <code>async function(inputs)</code> that returns an object to be rendered by the Handlebars template below.</Trans>}/>
                <ACEEditor id="hbs" height="700px" mode="handlebars" label={t('renderingTemplate')} help={<Trans i18nKey="useHtmlWithHandlebarsSyntaxSee">Use HTML with Handlebars syntax. See documentation <a href="http://handlebarsjs.com/">here</a>.</Trans>}/>

                <ButtonRow>
                    <Button type="submit" className="btn-primary" icon="check" label={t('save')}/>
                    <Button type="submit" className="btn-primary" icon="check" label={t('saveAndLeave')} onClickAsync={() => submitHandler(true)}/>
                    {enableDeleteModal && canDelete &&
                        <LinkButton className="btn-danger" icon="trash-alt" label={t('delete')} to={`/reports/templates/${entity.id}/delete`}/>
                    }
                </ButtonRow>
            </Form>
        </div>
    );
}

CUD.propTypes = {
    action: PropTypes.string.isRequired,
    wizard: PropTypes.string,
    entity: PropTypes.object,
    permissions: PropTypes.object
};
