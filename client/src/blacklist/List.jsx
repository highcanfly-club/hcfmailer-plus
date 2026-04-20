'use strict';

import React, {useRef} from "react";
import {useTranslation} from '../lib/i18n';
import {Title} from "../lib/page";
import {Table} from "../lib/table";
import {ButtonRow, Form, FormSendMethod, InputField} from "../lib/form";
import {Button} from "../lib/bootstrap-components";
import {HTTPMethod} from "../lib/axios";
import {useTableActionDialog} from "../lib/modals";
import {useRequiresAuthenticatedUser} from '../lib/hooks/useRequiresAuthenticatedUser';
import {useForm} from '../lib/hooks/useForm';

export default function List(props) {
    const { t } = useTranslation();
    useRequiresAuthenticatedUser();

    const tableRef = useRef(null);
    const { addRestActionButton, renderDialog } = useTableActionDialog(tableRef);

    const stateOwner = useForm({
        leaveConfirmation: false,
        serverValidation: {
            url: 'rest/blacklist-validate',
            changed: ['email']
        },
        localValidateFormValues: (state) => {
            const email = state.getIn(['email', 'value']);
            const emailServerValidation = state.getIn(['email', 'serverValidation']);

            if (!email) {
                state.setIn(['email', 'error'], t('emailMustNotBeEmpty-1'));
            } else if (emailServerValidation && emailServerValidation.invalid) {
                state.setIn(['email', 'error'], t('invalidEmailAddress'));
            } else if (emailServerValidation && emailServerValidation.exists) {
                state.setIn(['email', 'error'], t('theEmailIsAlreadyOnBlacklist'));
            } else if (!emailServerValidation) {
                state.setIn(['email', 'error'], t('validationIsInProgress'));
            } else {
                state.setIn(['email', 'error'], null);
            }
        }
    });

    React.useEffect(() => {
        stateOwner.populateFormValues({ email: '' });
    }, []);

    async function submitHandler() {
        stateOwner.disableForm();
        stateOwner.setFormStatusMessage('info', t('saving'));

        const submitSuccessful = await stateOwner.validateAndSendFormValuesToURL(FormSendMethod.POST, 'rest/blacklist');

        if (submitSuccessful) {
            stateOwner.hideFormValidation();
            stateOwner.populateFormValues({ email: '' });
            stateOwner.enableForm();
            stateOwner.clearFormStatusMessage();
            tableRef.current && tableRef.current.refresh();
        } else {
            stateOwner.enableForm();
            stateOwner.setFormStatusMessage('warning', t('thereAreErrorsInTheFormPleaseFixThemAnd-1'));
        }
    }

    const columns = [
        { data: 0, title: t('email') },
        {
            actions: data => {
                const actions = [];
                const email = data[0];

                addRestActionButton(
                    actions,
                    { method: HTTPMethod.DELETE, url: `rest/blacklist/${email}`},
                    { icon: 'trash-alt', label: t('removeFromBlacklist') },
                    t('confirmRemovalFromBlacklist'),
                    t('areYouSureYouWantToRemoveEmailFromThe', {email}),
                    t('removingEmailFromTheBlacklist', {email}),
                    t('emailRemovedFromTheBlacklist', {email}),
                    null
                );

                return actions;
            }
        }
    ];

    return (
        <div>
            {renderDialog()}
            <Title>{t('blacklist')}</Title>

            <h3 className="legend">{t('addEmailToBlacklist-1')}</h3>
            <Form stateOwner={stateOwner} onSubmitAsync={submitHandler}>
                <InputField id="email" label={t('email')}/>

                <ButtonRow>
                    <Button type="submit" className="btn-primary" icon="check" label={t('addToBlacklist')}/>
                </ButtonRow>
            </Form>

            <hr/>

            <h3 className="legend">{t('blacklistedEmails')}</h3>

            <Table ref={tableRef} withHeader dataUrl="rest/blacklist-table" columns={columns} />
        </div>
    );
}

List.propTypes = {
};
