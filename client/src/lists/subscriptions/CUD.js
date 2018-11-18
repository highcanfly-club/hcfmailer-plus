'use strict';

import React, {Component} from 'react';
import PropTypes
    from 'prop-types';
import {HTTPMethod} from '../../lib/axios';
import {withTranslation} from '../../lib/i18n';
import {
    NavButton,
    requiresAuthenticatedUser,
    Title,
    withPageHelpers
} from '../../lib/page';
import {
    AlignedRow,
    Button,
    ButtonRow,
    CheckBox,
    Dropdown,
    Form,
    FormSendMethod,
    InputField,
    withForm
} from '../../lib/form';
import {withErrorHandling} from '../../lib/error-handling';
import {RestActionModalDialog} from "../../lib/modals";
import interoperableErrors
    from '../../../../shared/interoperable-errors';
import {SubscriptionStatus} from '../../../../shared/lists';
import {
    getFieldTypes,
    getSubscriptionStatusLabels
} from './helpers';
import moment
    from 'moment-timezone';

@withTranslation()
@withForm
@withPageHelpers
@withErrorHandling
@requiresAuthenticatedUser
export default class CUD extends Component {
    constructor(props) {
        super(props);

        const t = props.t;

        this.state = {};

        this.subscriptionStatusLabels = getSubscriptionStatusLabels(t);
        this.fieldTypes = getFieldTypes(t);

        this.initForm({
            serverValidation: {
                url: `rest/subscriptions-validate/${this.props.list.id}`,
                changed: ['email'],
                extra: ['id']
            },
        });
    }

    static propTypes = {
        action: PropTypes.string.isRequired,
        list: PropTypes.object,
        fieldsGrouped: PropTypes.array,
        entity: PropTypes.object
    }

    componentDidMount() {
        if (this.props.entity) {
            this.getFormValuesFromEntity(this.props.entity, data => {
                data.status = data.status.toString();
                data.tz = data.tz || '';

                for (const fld of this.props.fieldsGrouped) {
                    this.fieldTypes[fld.type].assignFormData(fld, data);
                }
            });

        } else {
            const data = {
                email: '',
                tz: '',
                is_test: false,
                status: SubscriptionStatus.SUBSCRIBED
            };

            for (const fld of this.props.fieldsGrouped) {
                this.fieldTypes[fld.type].initFormData(fld, data);
            }

            this.populateFormValues(data);
        }
    }

    localValidateFormValues(state) {
        const t = this.props.t;

        const emailServerValidation = state.getIn(['email', 'serverValidation']);
        if (!state.getIn(['email', 'value'])) {
            state.setIn(['email', 'error'], t('emailMustNotBeEmpty-1'));
        } else if (!emailServerValidation) {
            state.setIn(['email', 'error'], t('validationIsInProgress'));
        } else if (emailServerValidation.exists) {
            state.setIn(['email', 'error'], t('anotherSubscriptionWithTheSameEmail'));
        } else {
            state.setIn(['email', 'error'], null);
        }

        for (const fld of this.props.fieldsGrouped) {
            this.fieldTypes[fld.type].validate(fld, state);
        }
    }

    async submitHandler() {
        const t = this.props.t;

        let sendMethod, url;
        if (this.props.entity) {
            sendMethod = FormSendMethod.PUT;
            url = `rest/subscriptions/${this.props.list.id}/${this.props.entity.id}`
        } else {
            sendMethod = FormSendMethod.POST;
            url = `rest/subscriptions/${this.props.list.id}`
        }

        try {
            this.disableForm();
            this.setFormStatusMessage('info', t('saving'));

            const submitSuccessful = await this.validateAndSendFormValuesToURL(sendMethod, url, data => {
                data.status = parseInt(data.status);
                data.tz = data.tz || null;

                for (const fld of this.props.fieldsGrouped) {
                    this.fieldTypes[fld.type].assignEntity(fld, data);
                }
            });

            if (submitSuccessful) {
                this.navigateToWithFlashMessage(`/lists/${this.props.list.id}/subscriptions`, 'success', t('susbscriptionSaved'));
            } else {
                this.enableForm();
                this.setFormStatusMessage('warning', t('thereAreErrorsInTheFormPleaseFixThemAnd'));
            }
        } catch (error) {
            if (error instanceof interoperableErrors.DuplicitEmailError) {
                this.setFormStatusMessage('danger',
                    <span>
                        <strong>{t('yourUpdatesCannotBeSaved')}</strong>{' '}
                        {t('itSeemsThatAnotherSubscriptionWithThe')}
                    </span>
                );
                return;
            }

            throw error;
        }
    }

    render() {
        const t = this.props.t;
        const isEdit = !!this.props.entity;

        const fieldsGrouped = this.props.fieldsGrouped;

        const statusOptions = Object.keys(this.subscriptionStatusLabels)
            .map(key => ({key, label: this.subscriptionStatusLabels[key]}));

        const tzOptions = [
            { key: '', label: t('notSelected') },
            ...moment.tz.names().map(tz => ({ key: tz.toLowerCase(), label: tz }))
        ];

        const customFields = [];
        for (const fld of this.props.fieldsGrouped) {
            customFields.push(this.fieldTypes[fld.type].form(fld));
        }

        return (
            <div>
                {isEdit &&
                    <div>
                        <RestActionModalDialog
                            title={t('confirmDeletion')}
                            message={t('areYouSureYouWantToDeleteSubscriptionFor', {email: this.getFormValue('email') || ''})}
                            stateOwner={this}
                            visible={this.props.action === 'delete'}
                            actionMethod={HTTPMethod.DELETE}
                            actionUrl={`rest/subscriptions/${this.props.list.id}/${this.props.entity.id}`}
                            backUrl={`/lists/${this.props.list.id}/subscriptions/${this.props.entity.id}/edit`}
                            successUrl={`/lists/${this.props.list.id}/subscriptions`}
                            actionInProgressMsg={t('deletingSubscription')}
                            actionDoneMsg={t('subscriptionDeleted')}/>
                    </div>
                }

                <Title>{isEdit ? t('editSubscription') : t('createSubscription')}</Title>

                <Form stateOwner={this} onSubmitAsync={::this.submitHandler}>
                    <InputField id="email" label={t('email')}/>

                    {customFields}

                    <hr />

                    <Dropdown id="tz" label={t('timezone')} options={tzOptions}/>

                    <Dropdown id="status" label={t('subscriptionStatus')} options={statusOptions}/>

                    <CheckBox id="is_test" text={t('testUser?')} help={t('ifCheckedThenThisSubscriptionCanBeUsed')}/>

                    {!isEdit &&
                        <AlignedRow>
                            <p className="text-warning">
                                This person will not receive a confirmation email so make sure that you have permission to
                                email them.
                            </p>
                        </AlignedRow>
                    }
                    <ButtonRow>
                        <Button type="submit" className="btn-primary" icon="ok" label={t('save')}/>
                        {isEdit && <NavButton className="btn-danger" icon="remove" label={t('delete')} linkTo={`/lists/${this.props.list.id}/subscriptions/${this.props.entity.id}/delete`}/>}
                    </ButtonRow>
                </Form>
            </div>
        );
    }
}
