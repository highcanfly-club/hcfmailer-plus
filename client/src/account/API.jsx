'use strict';

import React, { useState, useEffect } from 'react';
import { useTranslation } from '../lib/i18n';
import { Trans } from 'react-i18next';
import { Title } from '../lib/page';
import { useErrorHandling } from '../lib/hooks/useErrorHandling';
import { useRequiresAuthenticatedUser } from '../lib/hooks/useRequiresAuthenticatedUser';
import axios from '../lib/axios';
import { Button } from '../lib/bootstrap-components';
import { getUrl } from '../lib/urls';
import CodeExamples from './CodeExamples';
import './styles.scss';

export default function API() {
    const { t } = useTranslation();
    const { handleError } = useErrorHandling();
    useRequiresAuthenticatedUser();

    const [accessToken, setAccessToken] = useState(null);
    const [openCall, setOpenCall] = useState(null);

    function toggleCall(id) {
        setOpenCall(current => current === id ? null : id);
    }

    useEffect(() => {
        loadAccessToken();
    }, []);

    async function loadAccessToken() {
        try {
            const response = await axios.get(getUrl('rest/access-token'));
            setAccessToken(response.data);
        } catch (error) {
            handleError(error);
        }
    }

    async function resetAccessToken() {
        const response = await axios.post(getUrl('rest/access-token-reset'));
        setAccessToken(response.data);
    }

    const token = accessToken || 'ACCESS_TOKEN';

    let accessTokenMsg;
    if (accessToken) {
        accessTokenMsg = <div>{t('personalAccessToken') + ': '}<code>{token}</code></div>;
    } else {
        accessTokenMsg = <div>{t('accessTokenNotYetGenerated')}</div>;
    }

    return (
        <div className={'api'}>
            <Title>{t('api')}</Title>

            <div className="card mb-3">
                <div className="card-body">
                    <div className="float-end">
                        <Button label={accessToken ? t('resetAccessToken') : t('generateAccessToken')} icon="redo" className="btn-info" onClickAsync={resetAccessToken} />
                    </div>
                    {accessTokenMsg}
                </div>
            </div>

            <div className="card mb-3">
                <div className="card-body">
                    <h4 className="card-title">{t('notesAboutTheApi')}</h4>

                    <ul className="card-text">
                        <li>
                            <Trans i18nKey="apiResponseIsAJsonStructureWithErrorAnd">API response is a JSON structure with <code>error</code> and <code>data</code> properties. If the response <code>error</code> has a value set then the request failed.</Trans>
                        </li>
                        <li>
                            <Trans i18nKey="youNeedToDefineProperContentTypeWhen">You need to define proper <code>Content-Type</code> when making a request. You can either use <code>application/x-www-form-urlencoded</code> for normal form data or <code>application/json</code> for a JSON payload. Using <code>multipart/form-data</code> is not supported.</Trans>
                        </li>
                    </ul>
                </div>
            </div>

<div className="accordion" id="apicalls">
    <div className="card">
        <div className="card-header">
          <button type="button" className="btn btn-link" onClick={() => toggleCall('moresubscribers')}><h4>GET /api/subscriptions/:listCid – {t('getSubscribers')}</h4></button>
        </div>
        <div id="moresubscribers" className={'collapse' + (openCall === 'moresubscribers' ? ' show' : '')}>
            <div className="card-body">
               <p>
                    {t('getSubscribers')}
                </p>

                <p>
                    {t('queryParams')}
                </p>
                <ul>
                    <li><strong>access_token</strong> – {t('yourPersonalAccessToken')}
                        <ul>
                        <li><strong>start</strong> – {t('startPosition')} (<em>{t('optionalDefault0')}</em>)</li>
                        <li><strong>limit</strong> – {t('limitEmailsCountInResponse')} (<em>{t('optionalDefault10000')}</em>)</li>
                        </ul>
                    </li>
                </ul>

                <p>
                    <strong>{t('example')}</strong>
                </p>

                <pre>curl -XGET '{getUrl(`api/subscriptions/P5wKkz-e7?access_token=${token}&limit=10&start=10&search=gmail`)}' </pre>
                <CodeExamples method="GET" url={getUrl('api/subscriptions/P5wKkz-e7')} token={token} query={{limit:'10',start:'10',search:'gmail'}} />

            </div>
        </div>
    </div>
    <div className="card">
        <div className="card-header">
          <h4><button type="button" className="btn btn-link" onClick={() => toggleCall('moresubscribe')}><h4>POST /api/subscribe/:listCid – {t('addSubscription')}</h4></button></h4>
        </div>
        <div id="moresubscribe" className={'collapse' + (openCall === 'moresubscribe' ? ' show' : '')}>
            <div className="card-body">
                <p>
                    {t('thisApiCallEitherInsertsANewSubscription')}
                </p>

                <p>
                    {t('queryParams')}
                </p>
                <ul>
                    <li><strong>access_token</strong> – {t('yourPersonalAccessToken')}</li>
                </ul>

                <p>
                    <strong>POST</strong> {t('arguments')}
                </p>
                <ul>
                    <li><strong>EMAIL</strong> – {t('subscribersEmailAddress')} (<em>{t('required')}</em>)</li>
                    <li><strong>MERGE_FIRST_NAME</strong> – {t('subscribersFirstName')}</li>
                    <li><strong>MERGE_LAST_NAME</strong> – {t('subscribersLastName')}</li>
                    <li><strong>TIMEZONE</strong> – {t('subscribersTimezoneEgEuropeTallinnPstOr')}</li>
                    <li><strong>MERGE_TAG_VALUE</strong> – {t('customFieldValueUseYesnoForOptionGroup')}</li>
                </ul>

                <p>
                    {t('additionalPostArguments')}:
                </p>

                <ul>
                    <li>
                        <strong>FORCE_SUBSCRIBE</strong> – {t('setToYesIfYouWantToMakeSureTheEmailIs')}
                        by default.
                    </li>
                    <li>
                        <strong>REQUIRE_CONFIRMATION</strong> – {t('setToYesIfYouWantToSendConfirmationEmail')}
                    </li>
                </ul>

                <p>
                    <strong>{t('example')}</strong>
                </p>

                <pre>curl -XPOST '{getUrl(`api/subscribe/B16uVTdW?access_token=${token}`)}' \<br/>
--data 'EMAIL=test@example.com&amp;MERGE_CHECKBOX=yes&amp;REQUIRE_CONFIRMATION=yes'</pre>
                <CodeExamples method="POST" url={getUrl('api/subscribe/B16uVTdW')} token={token} form={{EMAIL:'test@example.com',MERGE_CHECKBOX:'yes',REQUIRE_CONFIRMATION:'yes'}} />

                <p>
                    {t('responseExample')}:
                </p>
                <pre>"data": ("id":"TTrw41znK")</pre>

            </div>
        </div>
    </div>
    <div className="card">
        <div className="card-header">
          <button type="button" className="btn btn-link" onClick={() => toggleCall('moreunsubscribe')}><h4>POST /api/unsubscribe/:listCId – {t('removeSubscription')}</h4></button>
        </div>
        <div id="moreunsubscribe" className={'collapse' + (openCall === 'moreunsubscribe' ? ' show' : '')}>
            <div className="card-body">
                <p>
                    {t('thisApiCallMarksASubscriptionAs')}
                </p>

                <p>
                    {t('queryParams')}
                </p>
                <ul>
                    <li><strong>access_token</strong> – {t('yourPersonalAccessToken')}</li>
                </ul>

                <p>
                    <strong>POST</strong> {t('arguments')}
                </p>
                <ul>
                    <li><strong>EMAIL</strong> – {t('subscribersEmailAddress')} (<em>{t('required')}</em>)</li>
                </ul>

                <p>
                    <strong>{t('example')}</strong>
                </p>

                <pre>curl -XPOST '{getUrl(`api/unsubscribe/B16uVTdW?access_token=${token}`)}' \<br/>
--data 'EMAIL=test@example.com'</pre>
                <CodeExamples method="POST" url={getUrl('api/unsubscribe/B16uVTdW')} token={token} form={{EMAIL:'test@example.com'}} />

                <p>
                    {t('responseExample')}:
                </p>
                <pre>"data": ("id":"TTrw41znK", "unsubscribed":true)</pre>

            </div>
        </div>
    </div>
    <div className="card">
        <div className="card-header">
          <button type="button" className="btn btn-link" onClick={() => toggleCall('moredelete')}><h4>POST /api/delete/:listCId – {t('deleteSubscription')}</h4></button>
        </div>
        <div id="moredelete" className={'collapse' + (openCall === 'moredelete' ? ' show' : '')}>
            <div className="card-body">
                <p>
                    {t('thisApiCallDeletesASubscription')}
                </p>

                <p>
                    {t('queryParams')}
                </p>
                <ul>
                    <li><strong>access_token</strong> – {t('yourPersonalAccessToken')}</li>
                </ul>

                <p>
                    <strong>POST</strong> {t('arguments')}
                </p>
                <ul>
                    <li><strong>EMAIL</strong> – {t('subscribersEmailAddress')} (<em>{t('required')}</em>)</li>
                </ul>

                <p>
                    <strong>{t('example')}</strong>
                </p>

                <pre>curl -XPOST '{getUrl(`api/delete/B16uVTdW?access_token=${token}`)}' \<br/>
--data 'EMAIL=test@example.com'</pre>
                <CodeExamples method="POST" url={getUrl('api/delete/B16uVTdW')} token={token} form={{EMAIL:'test@example.com'}} />
                <p>
                    {t('responseExample')}:
                </p>
                <pre>"data": ("id":"TTrw41znK", "deleted":true)</pre>

            </div>
        </div>
    </div>
    <div className="card">
        <div className="card-header">
          <button type="button" className="btn btn-link" onClick={() => toggleCall('morefield')}><h4>POST /api/field/:listId – {t('addNewCustomField')}</h4></button>
        </div>
        <div id="morefield" className={'collapse' + (openCall === 'morefield' ? ' show' : '')}>
            <div className="card-body">
                <p>
                    {t('thisApiCallCreatesANewCustomFieldForA')}
                </p>

                <p>
                    {t('queryParams')}
                </p>
                <ul>
                    <li><strong>access_token</strong> – {t('yourPersonalAccessToken')}</li>
                </ul>

                <p>
                    <strong>POST</strong> {t('arguments')}
                </p>
                <ul>
                    <li><strong>NAME</strong> – {t('fieldName')} (<em>{t('required')}</em>)</li>
                    <li><strong>TYPE</strong> – {t('oneOfTheFollowingTypes')}
                        <ul>
                            <li><strong>text</strong> &ndash; Text</li>
                            <li><strong>website</strong> &ndash; Website</li>
                            <li><strong>longtext</strong> &ndash; Multi-line text</li>
                            <li><strong>gpg</strong> &ndash; GPG Public Key</li>
                            <li><strong>number</strong> &ndash; Number</li>
                            <li><strong>radio</strong> &ndash; Radio Buttons</li>
                            <li><strong>checkbox</strong> &ndash; Checkboxes</li>
                            <li><strong>dropdown</strong> &ndash; Drop Down</li>
                            <li><strong>date-us</strong> &ndash; Date (MM/DD/YYY)</li>
                            <li><strong>date-eur</strong> &ndash; Date (DD/MM/YYYY)</li>
                            <li><strong>birthday-us</strong> &ndash; Birthday (MM/DD)</li>
                            <li><strong>birthday-eur</strong> &ndash; Birthday (DD/MM)</li>
                            <li><strong>json</strong> &ndash; JSON value for custom rendering</li>
                            <li><strong>option</strong> &ndash; Option</li>
                        </ul>
                    </li>
                    <li><strong>GROUP</strong> – {t('ifTheTypeIsOptionThenYouAlsoNeedTo')}</li>
                    <li><strong>GROUP_TEMPLATE</strong> – {t('templateForTheGroupElementIfNotSetThen')}</li>
                    <li><strong>VISIBLE</strong> – yes/no, {t('ifNotVisibleThenTheSubscriberCanNotView')}</li>
                </ul>

                <p>
                    <strong>{t('example')}</strong>
                </p>

                <pre>curl -XPOST '{getUrl(`api/field/B16uVTdW?access_token=${token}`)}' \<br/>
--data 'NAME=Comment&TYPE=text'</pre>
                <CodeExamples method="POST" url={getUrl('api/field/B16uVTdW')} token={token} form={{NAME:'Comment',TYPE:'text'}} />
                <p>
                    {t('responseExample')}:
                </p>
                <pre>"data": ("id":22, "tag":"MERGE_COMMENT")</pre>
            </div>
        </div>
    </div>
    <div className="card">
        <div className="card-header">
          <button type="button" className="btn btn-link" onClick={() => toggleCall('moreblacklistget')}><h4>GET /api/blacklist/get – {t('getListOfBlacklistedEmails')}</h4></button>
        </div>
        <div id="moreblacklistget" className={'collapse' + (openCall === 'moreblacklistget' ? ' show' : '')}>
            <div className="card-body">
               <p>
                    {t('thisApiCallGetListOfBlacklistedEmails')}
                </p>

                <p>
                    {t('queryParams')}
                </p>
                <ul>
                    <li><strong>access_token</strong> – {t('yourPersonalAccessToken')}
                        <ul>
                        <li><strong>start</strong> – {t('startPosition')} (<em>{t('optionalDefault0')}</em>)</li>
                        <li><strong>limit</strong> – {t('limitEmailsCountInResponse')} (<em>{t('optionalDefault10000')}</em>)</li>
                        <li><strong>search</strong> – {t('filterByPartOfEmail')} (<em>{t('optionalDefault')}</em>)</li>
                        </ul>
                    </li>
                </ul>

                <p>
                    <strong>{t('example')}</strong>
                </p>

                <pre>curl -XGET '{getUrl(`api/blacklist/get?access_token=${token}&limit=10&start=10&search=gmail`)}' </pre>
                <CodeExamples method="GET" url={getUrl('api/blacklist/get')} token={token} query={{limit:'10',start:'10',search:'gmail'}} />

            </div>
        </div>
    </div>
    <div className="card">
        <div className="card-header">
          <button type="button" className="btn btn-link" onClick={() => toggleCall('moreblacklistadd')}><h4>POST /api/blacklist/add – {t('addEmailToBlacklist')}</h4></button>
        </div>
        <div id="moreblacklistadd" className={'collapse' + (openCall === 'moreblacklistadd' ? ' show' : '')}>
            <div className="card-body">
                <p>
                    {t('thisApiCallEitherAddEmailsToBlacklist')}
                </p>

                <p>
                    {t('queryParams')}
                </p>
                <ul>
                    <li><strong>access_token</strong> – {t('yourPersonalAccessToken')}</li>
                </ul>

                <p>
                    <strong>POST</strong> {t('arguments')}
                </p>
                <ul>
                    <li><strong>EMAIL</strong> – {t('emailAddress')} (<em>{t('required')}</em>)</li>
                </ul>

                <p>
                    <strong>{t('example')}</strong>
                </p>

                <pre>curl -XPOST '{getUrl(`api/blacklist/add?access_token=${token}`)}' \<br/>
--data 'EMAIL=test@example.com'</pre>
                <CodeExamples method="POST" url={getUrl('api/blacklist/add')} token={token} form={{EMAIL:'test@example.com'}} />
            </div>
        </div>
    </div>
    <div className="card">
        <div className="card-header">
          <button type="button" className="btn btn-link" onClick={() => toggleCall('moreblacklistdelete')}><h4>POST /api/blacklist/delete – {t('deleteEmailFromBlacklist')}</h4></button>
        </div>
        <div id="moreblacklistdelete" className={'collapse' + (openCall === 'moreblacklistdelete' ? ' show' : '')}>
            <div className="card-body">
                <p>
                    {t('thisApiCallEitherDeleteEmailsFrom')}
                </p>

                <p>
                    {t('queryParams')}
                </p>
                <ul>
                    <li><strong>access_token</strong> – {t('yourPersonalAccessToken')}</li>
                </ul>

                <p>
                    <strong>POST</strong> {t('arguments')}
                </p>
                <ul>
                    <li><strong>EMAIL</strong> – {t('emailAddress')} (<em>{t('required')}</em>)</li>
                </ul>

                <p>
                    <strong>{t('example')}</strong>
                </p>

                <pre>curl -XPOST '{getUrl(`api/blacklist/delete?access_token=${token}`)}' \<br/>
--data 'EMAIL=test@example.com'</pre>
                <CodeExamples method="POST" url={getUrl('api/blacklist/delete')} token={token} form={{EMAIL:'test@example.com'}} />
            </div>
        </div>
    </div>
    <div className="card">
        <div className="card-header">
          <button type="button" className="btn btn-link" onClick={() => toggleCall('morelistsemail')}><h4>GET /api/lists/:email – {t('getTheListsAUserHasSubscribedTo')}</h4></button>
        </div>
        <div id="morelistsemail" className={'collapse' + (openCall === 'morelistsemail' ? ' show' : '')}>
            <div className="card-body">
                <p>
                    {t('retrieveTheListsThatTheUserWithEmailHas')}
                </p>

                <p>
                    {t('queryParams')}
                </p>
                <ul>
                    <li><strong>access_token</strong> – {t('yourPersonalAccessToken')}</li>
                </ul>

                <p>
                    <strong>{t('example')}</strong>
                </p>

                <pre>curl -XGET '{getUrl(`api/lists/test@example.com?access_token=${token}`)}'</pre>
                <CodeExamples method="GET" url={getUrl('api/lists/test@example.com')} token={token} />
            </div>
        </div>
    </div>
    <div className="card">
        <div className="card-header">
          <button type="button" className="btn btn-link" onClick={() => toggleCall('morelistsnamespace')}><h4>GET /api/lists-by-namespace/:namespaceId – {t('getTheListsInANamespace')}</h4></button>
        </div>
        <div id="morelistsnamespace" className={'collapse' + (openCall === 'morelistsnamespace' ? ' show' : '')}>
            <div className="card-body">
                <p>
                  {t('retrieveTheListsThatTheNamespaceWith')}
                </p>

                <p>
                  {t('queryParams')}
                </p>
                <ul>
                  <li><strong>access_token</strong> – {t('yourPersonalAccessToken')}</li>
                </ul>

                <p>
                  <strong>{t('example')}</strong>
                </p>

                <pre>curl -XGET '{getUrl(`api/lists-by-namespace/1?access_token=${token}`)}'</pre>
                <CodeExamples method="GET" url={getUrl('api/lists-by-namespace/1')} token={token} />
            </div>
        </div>
    </div>
    <div className="card">
        <div className="card-header">
          <button type="button" className="btn btn-link" onClick={() => toggleCall('morecreatelist')}><h4>POST /api/list – {t('createList')}</h4></button>
        </div>
        <div id="morecreatelist" className={'collapse' + (openCall === 'morecreatelist' ? ' show' : '')}>
            <div className="card-body">
                <p>
                  {t('createsANewListOfSubscribers')}
                </p>

                <p>
                  {t('queryParams')}
                </p>
                <ul>
                  <li><strong>access_token</strong> – {t('yourPersonalAccessToken')}</li>
                </ul>

                <p>
                  <strong>POST</strong> {t('arguments')}
                </p>
                <ul>
                  <li><strong>NAMESPACE</strong> – {t('namespace')} (<em>{t('required')}</em>)</li>
                  <li><strong>UNSUBSCRIPTION_MODE</strong> – {t('unsubscription')} (<em>{t('required')}</em>):
                    <ul>
                      <li><strong>0</strong> - {t('onestepIeNoEmailWithConfirmationLink')}</li>
                      <li><strong>1</strong> - {t('onestepWithUnsubscriptionFormIeNoEmail')}</li>
                      <li><strong>2</strong> - {t('twostepIeAnEmailWithConfirmationLinkWill')}</li>
                      <li><strong>3</strong> - {t('twostepWithUnsubscriptionFormIeAnEmail')}</li>
                      <li><strong>4</strong> - {t('manualIeUnsubscriptionHasToBePerformedBy')}</li>
                    </ul>
                  </li>
                  <li><strong>NAME</strong> – {t('name')}</li>
                  <li><strong>DESCRIPTION</strong> – {t('description')}</li>
                  <li><strong>HOMEPAGE</strong> – {t('homepage')}</li>
                  <li><strong>CONTACT_EMAIL</strong> – {t('contactEmail')}</li>
                  <li><strong>DEFAULT_FORM</strong> – {t('webAndEmailFormsAndTemplatesUsedIn')}</li>
                  <li><strong>FIELDWIZARD</strong> – {t('representationOfSubscribersName')}:
                    <ul>
                      <li><strong>none</strong> - {t('emptyCustomNoFields')}</li>
                      <li><strong>full_name</strong> - {t('nameOneField')}</li>
                      <li><strong>first_last_name</strong> - {t('firstNameAndLastNameTwoFields')}</li>
                    </ul>
                  </li>
                  <li><strong>TO_NAME</strong> – {t('recipientsNameTemplate')}</li>
                  <li><strong>LISTUNSUBSCRIBE_DISABLED</strong> – {t('doNotSendListUnsubscribeHeaders')}</li>
                  <li><strong>PUBLIC_SUBSCRIBE</strong> – {t('allowPublicUsersToSubscribeThemselves')}</li>
                  <li><strong>SEND_CONFIGURATION</strong> – {t('sendConfiguration')}</li>
                </ul>

                <p>
                  <strong>{t('example')}</strong>
                </p>

                <pre>curl -XPOST '{getUrl(`api/list?access_token=${token}`)}' \<br/>
                  -d 'NAMESPACE=1' \<br/>
                  -d 'UNSUBSCRIPTION_MODE=0' \<br/>
                  -d 'NAME=list1' \<br/>
                  -d 'DESCRIPTION=a very nice list' \<br/>
                  -d 'CONTACT_EMAIL=test@example.com' \<br/>
                  -d 'HOMEPAGE=example.com' \<br/>
                  -d 'FIELDWIZARD=first_last_name' \<br/>
                  -d 'SEND_CONFIGURATION=1' \<br/>
                  -d 'PUBLIC_SUBSCRIBE=1' \<br/>
                  -d 'LISTUNSUBSCRIBE_DISABLED=0'
                </pre>
                <CodeExamples method="POST" url={getUrl('api/list')} token={token} form={{NAMESPACE:'1',UNSUBSCRIPTION_MODE:'0',NAME:'list1',DESCRIPTION:'a very nice list',CONTACT_EMAIL:'test@example.com',HOMEPAGE:'example.com',FIELDWIZARD:'first_last_name',SEND_CONFIGURATION:'1',PUBLIC_SUBSCRIBE:'1',LISTUNSUBSCRIBE_DISABLED:'0'}} />
                <p>
                    {t('responseExample')}:
                </p>
                <pre>"data": ("id":"WSGjaP1fY")</pre>
            </div>
        </div>
    </div>
    <div className="card">
        <div className="card-header">
          <button type="button" className="btn btn-link" onClick={() => toggleCall('moredeletelist')}><h4>DELETE /api/list/:listCId – {t('deleteList')}</h4></button>
        </div>
        <div id="moredeletelist" className={'collapse' + (openCall === 'moredeletelist' ? ' show' : '')}>
            <div className="card-body">
                <p>
                  {t('deletesAListOfSubscribers')}
                </p>

                <p>
                  {t('queryParams')}
                </p>
                <ul>
                  <li><strong>access_token</strong> – {t('yourPersonalAccessToken')}</li>
                </ul>

                <p>
                  <strong>{t('example')}</strong>
                </p>

                <pre>curl -XDELETE '{getUrl(`api/list/WSGjaP1fY?access_token=${token}`)}'</pre>
                <CodeExamples method="DELETE" url={getUrl('api/list/WSGjaP1fY')} token={token} />
                <p>
                    {t('responseExample')}:
                </p>
                <pre>{t('emptyObject')}</pre>
            </div>
        </div>
    </div>
    <div className="card">
        <div className="card-header">
          <button type="button" className="btn btn-link" onClick={() => toggleCall('morerss')}><h4>GET /api/rss/fetch/:campaignCid – {t('triggerFetchOfACampaign')}</h4></button>
        </div>
        <div id="morerss" className={'collapse' + (openCall === 'morerss' ? ' show' : '')}>
            <div className="card-body">
                <p>
                    {t('forcesTheRssFeedCheckToImmediatelyCheck')}
                </p>

                <p>
                    {t('queryParams')}
                </p>
                <ul>
                    <li><strong>access_token</strong> – {t('yourPersonalAccessToken')}</li>
                </ul>

                <p>
                    <strong>{t('example')}</strong>
                </p>

                <pre>curl -XGET '{getUrl(`api/rss/fetch/5OOnZKrp0?access_token=${token}`)}'</pre>
                <CodeExamples method="GET" url={getUrl('api/rss/fetch/5OOnZKrp0')} token={token} />
            </div>
        </div>
    </div>
    <div className="card">
        <div className="card-header">
          <button type="button" className="btn btn-link" onClick={() => toggleCall('moretemplate')}><h4>POST /api/templates/:templateId/send – {t('sendTransactionalEmail')}</h4></button>
        </div>
        <div id="moretemplate" className={'collapse' + (openCall === 'moretemplate' ? ' show' : '')}>
            <div className="card-body">
                <p>
                    {t('sendSingleEmailByTemplateWithGiven')}
                </p>

                <p>
                    {t('queryParams')}
                </p>
                <ul>
                    <li><strong>access_token</strong> – {t('yourPersonalAccessToken')}</li>
                </ul>

                <p>
                    <strong>POST</strong> {t('arguments')}
                </p>
                <ul>
                    <li><strong>EMAIL</strong> – {t('emailAddress')} (<em>{t('required')}</em>)</li>
                    <li><strong>SEND_CONFIGURATION_ID</strong> – {t('idOfConfigurationUsedToCreateMailer')}</li>
                    <li><strong>SUBJECT</strong> – {t('subject')}</li>
                    <li><strong>TAGS</strong> – {t('mapOfTemplateVariablesToReplace')}</li>
                    <li><strong>ATTACHMENTS</strong> – {t('attachmentsFormatAsConsumedByNodemailer')}</li>
                </ul>

                <p>
                    <strong>{t('example')}</strong>
                </p>

                <pre>curl -XPOST '{getUrl(`api/templates/1/send?access_token=${token}`)}' \<br/>
--data 'EMAIL=test@example.com&amp;SUBJECT=Test&amp;TAGS[FOO]=bar&amp;TAGS[TEST]=example'</pre>
                <CodeExamples method="POST" url={getUrl('api/templates/1/send')} token={token} form={{EMAIL:'test@example.com',SUBJECT:'Test','TAGS[FOO]':'bar','TAGS[TEST]':'example'}} />
            </div>
        </div>
    </div>
</div>



        </div>
    );
}
