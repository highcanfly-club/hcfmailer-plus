'use strict';

import React, { Component, useState, useRef } from 'react';
import axios, { HTTPMethod } from './axios';
import { useTranslation, withTranslation } from './i18n';
import PropTypes from 'prop-types';
import { Icon, ModalDialog } from "./bootstrap-components";
import { getUrl } from "./urls";
import { withPageHelpers } from "./page";
import './styles.scss';
import interoperableErrors from '../../../shared/interoperable-errors';
import { Link } from "react-router-dom";
import { withComponentMixins } from "./decorator-helpers";
import { wrapWithAsyncErrorHandler } from "./error-handling";
import ACEEditorRaw from 'react-ace';const RestActionModalDialog =

withComponentMixins([
withTranslation,
withPageHelpers]
)(class
RestActionModalDialog extends Component {
  static propTypes = {
    title: PropTypes.string.isRequired,
    message: PropTypes.string.isRequired,
    stateOwner: PropTypes.object,
    visible: PropTypes.bool.isRequired,
    actionMethod: PropTypes.func.isRequired,
    actionUrl: PropTypes.string.isRequired,
    actionData: PropTypes.object,

    backUrl: PropTypes.string,
    successUrl: PropTypes.string,

    onBack: PropTypes.func,
    onPerformingAction: PropTypes.func,
    onSuccess: PropTypes.func,

    actionInProgressMsg: PropTypes.string.isRequired,
    actionDoneMsg: PropTypes.string.isRequired,

    onErrorAsync: PropTypes.func
  };

  async hideModal(isBack) {
    if (this.props.backUrl) {
      this.navigateTo(this.props.backUrl);
    } else {
      if (isBack) {
        this.props.onBack();
      } else {
        this.props.onPerformingAction();
      }
    }
  }

  async performAction() {
    const props = this.props;
    const t = props.t;
    const owner = props.stateOwner;

    await this.hideModal(false);

    try {
      if (!owner) {
        this.setFlashMessage('info', props.actionInProgressMsg);
      } else {
        owner.disableForm();
        owner.setFormStatusMessage('info', props.actionInProgressMsg);
      }

      await axios.method(props.actionMethod, getUrl(props.actionUrl), props.actionData);

      if (props.successUrl) {
        this.navigateToWithFlashMessage(props.successUrl, 'success', props.actionDoneMsg);
      } else {
        props.onSuccess();
        this.setFlashMessage('success', props.actionDoneMsg);
      }
    } catch (err) {
      if (props.onErrorAsync) {
        await props.onErrorAsync(err);
      } else {
        throw err;
      }
    }
  }

  render() {
    const t = this.props.t;

    return (
      <ModalDialog hidden={!this.props.visible} title={this.props.title} onCloseAsync={async () => await this.hideModal(true)} buttons={[
      { label: t('no'), className: 'btn-primary', onClickAsync: async () => await this.hideModal(true) },
      { label: t('yes'), className: 'btn-danger', onClickAsync: (...args) => this.performAction(...args) }]
      }>
                {this.props.message}
            </ModalDialog>);

  }
});export { RestActionModalDialog };

const entityTypeLabels = {
  'namespace': (t) => t('namespace'),
  'list': (t) => t('list'),
  'customForm': (t) => t('customForms'),
  'campaign': (t) => t('campaign'),
  'template': (t) => t('template'),
  'sendConfiguration': (t) => t('sendConfiguration-1'),
  'report': (t) => t('report'),
  'reportTemplate': (t) => t('reportTemplate'),
  'mosaicoTemplate': (t) => t('mosaicoTemplate'),
  'user': (t) => t('user')
};

function _getDependencyErrorMessage(err, t, name) {
  return (
    <div>
            {err.data.dependencies.length > 0 ?
      <>
                    <p>{t('cannoteDeleteNameDueToTheFollowing', { name })}</p>
                    <ul className={"errorsList"}>
                        {err.data.dependencies.map((dep) =>
          dep.link ?
          <li key={dep.link}><Link
              to={dep.link}>{entityTypeLabels[dep.entityTypeId](t)}: {dep.name}</Link></li> :
          // if no dep.link is present, it means the user has no permission to view the entity, thus only id without the link is shown
          <li key={dep.id}>{entityTypeLabels[dep.entityTypeId](t)}: [{dep.id}]</li>
          )}
                        {err.data.andMore && <li>{t('andMore')}</li>}
                    </ul>
                </> :

      <p>{t('cannotDeleteNameDueToHiddenDependencies', { name })}</p>
      }
        </div>);

}const DeleteModalDialog =


withComponentMixins([
withTranslation,
withPageHelpers]
)(class
DeleteModalDialog extends Component {
  constructor(props) {
    super(props);
    const t = props.t;
  }

  static propTypes = {
    visible: PropTypes.bool.isRequired,
    stateOwner: PropTypes.object.isRequired,
    deleteUrl: PropTypes.string.isRequired,
    backUrl: PropTypes.string.isRequired,
    successUrl: PropTypes.string.isRequired,
    deletingMsg: PropTypes.string.isRequired,
    deletedMsg: PropTypes.string.isRequired,
    name: PropTypes.string
  };

  async onErrorAsync(err) {
    const t = this.props.t;

    if (err instanceof interoperableErrors.DependencyPresentError) {
      const owner = this.props.stateOwner;

      const name = owner.getFormValue('name');
      this.setFlashMessage('danger', _getDependencyErrorMessage(err, t, name));

      window.scrollTo(0, 0); // This is to scroll up because the flash message appears on top and it's quite misleading if the delete fails and the message is not in the viewport

      owner.enableForm();
      owner.clearFormStatusMessage();

    } else {
      throw err;
    }
  }

  render() {
    const t = this.props.t;
    const owner = this.props.stateOwner;
    const name = this.props.name || owner.getFormValue('name') || '';

    return <RestActionModalDialog
      title={t('confirmDeletion')}
      message={t('bugmodal') + '\r' + t('areYouSureYouWantToDeleteName?', { name })}
      stateOwner={this.props.stateOwner}
      visible={this.props.visible}
      actionMethod={HTTPMethod.DELETE}
      actionUrl={this.props.deleteUrl}
      backUrl={this.props.backUrl}
      successUrl={this.props.successUrl}
      actionInProgressMsg={this.props.deletingMsg}
      actionDoneMsg={this.props.deletedMsg}
      onErrorAsync={(...args) => this.onErrorAsync(...args)} />;

  }
});export { DeleteModalDialog };

export function tableRestActionDialogInit(owner) {
  owner.tableRestActionDialogData = {};
  owner.state.tableRestActionDialogShown = false;
}



function _hide(owner, dontRefresh = false) {
  const refreshTables = owner.tableRestActionDialogData.refreshTables;

  owner.setState({ tableRestActionDialogShown: false });

  if (!dontRefresh) {
    owner.tableRestActionDialogData = {};

    if (refreshTables) {
      refreshTables();
    } else {
      owner.table.refresh();
    }
  } else {
    // _hide is called twice: (1) at performing action, and at (2) success. Here we keep the refreshTables
    // reference till it is really needed in step #2.
    owner.tableRestActionDialogData = { refreshTables };
  }
}

export function tableAddDeleteButton(actions, owner, perms, deleteUrl, name, deletingMsg, deletedMsg) {
  const t = owner.props.t;

  async function onErrorAsync(err) {
    if (err instanceof interoperableErrors.DependencyPresentError) {
      owner.setFlashMessage('danger', _getDependencyErrorMessage(err, t, name));
      window.scrollTo(0, 0); // This is to scroll up because the flash message appears on top and it's quite misleading if the delete fails and the message is not in the viewport
      _hide(owner);
    } else {
      throw err;
    }
  }

  if (!perms || perms.includes('delete')) {
    if (owner.tableRestActionDialogData.shown) {
      actions.push({
        label: <Icon className={"iconDisabled"} icon="trash-alt" title={t('delete')} />
      });
    } else {
      actions.push({
        label: <Icon icon="trash-alt" title={t('delete')} />,
        action: () => {
          owner.tableRestActionDialogData = {
            shown: true,
            title: t('confirmDeletion'),
            message: t('areYouSureYouWantToDeleteName?', { name }),
            httpMethod: HTTPMethod.DELETE,
            actionUrl: deleteUrl,
            actionInProgressMsg: deletingMsg,
            actionDoneMsg: deletedMsg,
            onErrorAsync: onErrorAsync
          };

          owner.setState({
            tableRestActionDialogShown: true
          });

          owner.table.refresh();
        }
      });
    }
  }
}

export function tableAddRestActionButton(actions, owner, action, button, title, message, actionInProgressMsg, actionDoneMsg, onErrorAsync) {
  const t = owner.props.t;

  if (owner.tableRestActionDialogData.shown) {
    actions.push({
      label: <Icon className={"iconDisabled"} icon={button.icon} title={button.label} />
    });
  } else {
    actions.push({
      label: <Icon icon={button.icon} title={button.label} />,
      action: () => {
        owner.tableRestActionDialogData = {
          shown: true,
          title: title,
          message: message,
          httpMethod: action.method,
          actionUrl: action.url,
          actionData: action.data,
          actionInProgressMsg: actionInProgressMsg,
          actionDoneMsg: actionDoneMsg,
          onErrorAsync: onErrorAsync,
          refreshTables: action.refreshTables
        };

        owner.setState({
          tableRestActionDialogShown: true
        });

        if (action.refreshTables) {
          action.refreshTables();
        } else {
          owner.table.refresh();
        }
      }
    });
  }
}

export function tableRestActionDialogRender(owner) {
  const data = owner.tableRestActionDialogData;

  return <RestActionModalDialog
    title={data.title || ''}
    message={data.message || ''}
    visible={owner.state.tableRestActionDialogShown}
    actionMethod={data.httpMethod || HTTPMethod.POST}
    actionUrl={data.actionUrl || ''}
    actionData={data.actionData}
    onBack={() => _hide(owner)}
    onPerformingAction={() => _hide(owner, true)}
    onSuccess={() => _hide(owner)}
    actionInProgressMsg={data.actionInProgressMsg || ''}
    actionDoneMsg={data.actionDoneMsg || ''}
    onErrorAsync={data.onErrorAsync} />;

}

export function useTableActionDialog(tableRef) {
  const { t } = useTranslation();
  const [dialogShown, setDialogShown] = useState(false);
  const dialogDataRef = useRef({});

  function hide(dontRefresh = false) {
    const refreshTables = dialogDataRef.current.refreshTables;
    setDialogShown(false);
    if (!dontRefresh) {
      dialogDataRef.current = {};
      if (refreshTables) {
        refreshTables();
      } else if (tableRef && tableRef.current) {
        tableRef.current.refresh();
      }
    } else {
      dialogDataRef.current = { refreshTables };
    }
  }

  function addDeleteButton(actions, perms, deleteUrl, name, deletingMsg, deletedMsg, setFlashMessage) {
    if (!perms || perms.includes('delete')) {
      if (dialogDataRef.current.shown) {
        actions.push({
          label: <Icon className={"iconDisabled"} icon="trash-alt" title={t('delete')} />
        });
      } else {
        actions.push({
          label: <Icon icon="trash-alt" title={t('delete')} />,
          action: () => {
            async function onErrorAsync(err) {
              if (err instanceof interoperableErrors.DependencyPresentError) {
                if (setFlashMessage) setFlashMessage('danger', _getDependencyErrorMessage(err, t, name));
                window.scrollTo(0, 0);
                hide();
              } else {
                throw err;
              }
            }

            dialogDataRef.current = {
              shown: true,
              title: t('confirmDeletion'),
              message: t('areYouSureYouWantToDeleteName?', { name }),
              httpMethod: HTTPMethod.DELETE,
              actionUrl: deleteUrl,
              actionInProgressMsg: deletingMsg,
              actionDoneMsg: deletedMsg,
              onErrorAsync
            };
            setDialogShown(true);
            if (tableRef && tableRef.current) tableRef.current.refresh();
          }
        });
      }
    }
  }

  function addRestActionButton(actions, action, button, title, message, actionInProgressMsg, actionDoneMsg, onErrorAsync) {
    if (dialogDataRef.current.shown) {
      actions.push({
        label: <Icon className={"iconDisabled"} icon={button.icon} title={button.label} />
      });
    } else {
      actions.push({
        label: <Icon icon={button.icon} title={button.label} />,
        action: () => {
          dialogDataRef.current = {
            shown: true,
            title,
            message,
            httpMethod: action.method,
            actionUrl: action.url,
            actionData: action.data,
            actionInProgressMsg,
            actionDoneMsg,
            onErrorAsync,
            refreshTables: action.refreshTables
          };
          setDialogShown(true);
          if (action.refreshTables) {
            action.refreshTables();
          } else if (tableRef && tableRef.current) {
            tableRef.current.refresh();
          }
        }
      });
    }
  }

  function renderDialog() {
    const data = dialogDataRef.current;
    return (
      <RestActionModalDialog
        title={data.title || ''}
        message={data.message || ''}
        visible={dialogShown}
        actionMethod={data.httpMethod || HTTPMethod.POST}
        actionUrl={data.actionUrl || ''}
        actionData={data.actionData}
        onBack={() => hide()}
        onPerformingAction={() => hide(true)}
        onSuccess={() => hide()}
        actionInProgressMsg={data.actionInProgressMsg || ''}
        actionDoneMsg={data.actionDoneMsg || ''}
        onErrorAsync={data.onErrorAsync} />);


  }

  return { addDeleteButton, addRestActionButton, renderDialog };
}const ContentModalDialog =


withComponentMixins([
withTranslation]
)(class
ContentModalDialog extends Component {
  constructor(props) {{
      super(props);
      const t = props.t;

      this.state = {
        content: null
      };
    }this.fetchContent = wrapWithAsyncErrorHandler(this, this.fetchContent);}

  static propTypes = {
    visible: PropTypes.bool.isRequired,
    title: PropTypes.string.isRequired,
    getContentAsync: PropTypes.func.isRequired,
    onHide: PropTypes.func.isRequired
  };


  async fetchContent() {
    const content = await this.props.getContentAsync();
    this.setState({
      content
    });
  }

  componentDidMount() {
    if (this.props.visible) {
      // noinspection JSIgnoredPromiseFromCall
      this.fetchContent();
    }
  }

  componentDidUpdate(prevProps) {
    if (this.props.visible && !prevProps.visible) {
      // noinspection JSIgnoredPromiseFromCall
      this.fetchContent();
    } else if (!this.props.visible && this.state.content !== null) {
      this.setState({
        content: null
      });
    }
  }

  render() {
    const t = this.props.t;

    return (
      <ModalDialog hidden={!this.props.visible} title={this.props.title} onCloseAsync={() => this.props.onHide()}>
                {this.props.visible && this.state.content &&
        <ACEEditorRaw
          mode='xml'
          theme="github"
          fontSize={12}
          width="100%"
          height="600px"
          showPrintMargin={false}
          value={this.state.content}
          tabSize={2}
          setOptions={{ useWorker: false }} // This disables syntax check because it does not always work well (e.g. in case of JS code in report templates)
          readOnly={true} />

        }
            </ModalDialog>);

  }
});export { ContentModalDialog };