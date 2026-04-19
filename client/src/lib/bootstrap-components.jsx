'use strict';

import React, { Component } from 'react';
import { withTranslation } from './i18n';
import PropTypes from 'prop-types';
import { wrapWithAsyncErrorHandler, withErrorHandling } from './error-handling';
import { withComponentMixins } from "./decorator-helpers";
import Dropdown from 'react-bootstrap/Dropdown';const DismissibleAlert =

withComponentMixins([
withTranslation,
withErrorHandling]
)(class
DismissibleAlert extends Component {constructor(props) {super(props);this.onClose = wrapWithAsyncErrorHandler(this, this.onClose);}
  static propTypes = {
    severity: PropTypes.string.isRequired,
    onCloseAsync: PropTypes.func
  };


  onClose() {
    if (this.props.onCloseAsync) {
      this.props.onCloseAsync();
    }
  }

  render() {
    const t = this.props.t;

    return (
      <div className={`alert alert-${this.props.severity} alert-dismissible`} role="alert">
                <button type="button" className="close" aria-label={t('close')} onClick={(...args) => this.onClose(...args)}><span aria-hidden="true">&times;</span></button>
                {this.props.children}
            </div>);

  }
});export { DismissibleAlert };

export class Icon extends Component {
  static propTypes = {
    icon: PropTypes.string.isRequired,
    family: PropTypes.string,
    title: PropTypes.string,
    className: PropTypes.string
  };

  static defaultProps = {
    family: 'fas'
  };

  render() {
    const props = this.props;

    if (props.family === 'fas' || props.family === 'far') {
      return <i className={`${props.family} fa-${props.icon} ${props.className || ''}`} title={props.title} />;
    } else {
      console.error(`Icon font family ${props.family} not supported. (icon: ${props.icon}, title: ${props.title})`);
      return null;
    }
  }
}const Button =

withComponentMixins([
withErrorHandling]
)(class
Button extends Component {constructor(props) {super(props);this.onClick = wrapWithAsyncErrorHandler(this, this.onClick);}
  static propTypes = {
    onClickAsync: PropTypes.func,
    label: PropTypes.string,
    icon: PropTypes.string,
    iconTitle: PropTypes.string,
    className: PropTypes.string,
    title: PropTypes.string,
    type: PropTypes.string,
    disabled: PropTypes.bool
  };


  async onClick(evt) {
    if (this.props.onClickAsync) {
      evt.preventDefault();
      await this.props.onClickAsync(evt);
    }
  }

  render() {
    const props = this.props;

    let className = 'btn';
    if (props.className) {
      className = className + ' ' + props.className;
    }

    let type = props.type || 'button';

    let icon;
    if (props.icon) {
      icon = <Icon icon={props.icon} title={props.iconTitle} />;
    }

    let iconSpacer;
    if (props.icon && props.label) {
      iconSpacer = ' ';
    }

    return (
      <button type={type} className={className} onClick={(...args) => this.onClick(...args)} title={this.props.title} disabled={this.props.disabled}>{icon}{iconSpacer}{props.label}</button>);

  }
});export { Button };

export class ButtonDropdown extends Component {
  static propTypes = {
    label: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    icon: PropTypes.string,
    className: PropTypes.string,
    buttonClassName: PropTypes.string,
    menuClassName: PropTypes.string
  };

  render() {
    const props = this.props;

    const className = 'btn-group' + (props.className ? ' ' + props.className : '');
    const buttonClassName = 'btn dropdown-toggle' + (props.buttonClassName ? ' ' + props.buttonClassName : '');
    const menuClassName = 'dropdown-menu' + (props.menuClassName ? ' ' + props.menuClassName : '');

    let icon;
    if (props.icon) {
      icon = <Icon icon={props.icon} />;
    }

    let iconSpacer;
    if (props.icon && props.label) {
      iconSpacer = ' ';
    }

    return (
      <Dropdown className={className}>
              <Dropdown.Toggle id="dropdown-basic">
              {icon}{iconSpacer}{props.label}
              </Dropdown.Toggle>
        
              <Dropdown.Menu>
              {props.children}
              </Dropdown.Menu>
            </Dropdown>);

  }
}const ActionLink =

withComponentMixins([
withErrorHandling]
)(class
ActionLink extends Component {constructor(props) {super(props);this.onClick = wrapWithAsyncErrorHandler(this, this.onClick);}
  static propTypes = {
    onClickAsync: PropTypes.func,
    className: PropTypes.string,
    href: PropTypes.string
  };


  async onClick(evt) {
    if (this.props.onClickAsync) {
      evt.preventDefault();
      evt.stopPropagation();

      await this.props.onClickAsync(evt);
    }
  }

  render() {
    const props = this.props;

    return (
      <a href={props.href || ''} className={props.className} onClick={(...args) => this.onClick(...args)}>{props.children}</a>);

  }
});export { ActionLink };


export class DropdownActionLink extends Component {
  static propTypes = {
    onClickAsync: PropTypes.func,
    className: PropTypes.string,
    disabled: PropTypes.bool
  };

  render() {
    const props = this.props;

    let clsName = "dropdown-item ";
    if (props.disabled) {
      clsName += "disabled ";
    }

    clsName += props.className;

    return (
      <ActionLink className={clsName} onClickAsync={props.onClickAsync}>{props.children}</ActionLink>);

  }
}


/** The `DropdownActionLink` closes the dropdown when clicked (because `evt.stopPropagation()` does not work correctly
 *  with React events). Use this component if you need the Dropdown to remain opened when action link is clicked. */const DropdownActionLinkKeepOpen =
withComponentMixins([
withErrorHandling]
)(class
DropdownActionLinkKeepOpen extends Component {constructor(props) {super(props);this.onClick = wrapWithAsyncErrorHandler(this, this.onClick);}
  static propTypes = {
    onClickAsync: PropTypes.func,
    className: PropTypes.string,
    disabled: PropTypes.bool
  };


  onClick(evt) {
    if (this.props.onClickAsync) {
      evt.preventDefault();
      evt.stopPropagation();

      this.props.onClickAsync(evt);
    }
  }

  componentDidMount() {
    this.element.addEventListener('click', (...args) => this.onClick(...args));
  }

  componentWillUnmount() {
    this.element.removeEventListener('click', (...args) => this.onClick(...args));
  }

  render() {
    const props = this.props;

    let clsName = "dropdown-item ";
    if (props.disabled) {
      clsName += "disabled ";
    }

    clsName += props.className;

    return (
      <a href={props.href || ''} className={clsName} ref={(node) => this.element = node}>{props.children}</a>);

  }
});export { DropdownActionLinkKeepOpen };


export class DropdownDivider extends Component {
  static propTypes = {
    className: PropTypes.string
  };

  render() {
    const props = this.props;

    let className = 'dropdown-divider';
    if (props.className) {
      className = className + ' ' + props.className;
    }

    return (
      <div className={className} />);

  }
}const ModalDialog =


withComponentMixins([
withTranslation,
withErrorHandling]
)(class
ModalDialog extends Component {
  constructor(props) {{
      super(props);

      const t = props.t;
    }this.onClose = wrapWithAsyncErrorHandler(this, this.onClose);}

  static propTypes = {
    title: PropTypes.string,
    onCloseAsync: PropTypes.func,
    onButtonClickAsync: PropTypes.func,
    buttons: PropTypes.array,
    hidden: PropTypes.bool,
    className: PropTypes.string
  };

  /*
    this.props.hidden - this is the desired state of the modal
    this.hidden - this is the actual state of the modal - this is because there is no public API on Bootstrap modal to know whether the modal is shown or not
   */

  componentDidMount() {
    const jqModal = jQuery(this.domModal);

    jqModal.on('shown.bs.modal', () => jqModal.focus());
    jqModal.on('hide.bs.modal', (...args) => this.onHide(...args));

    this.hidden = this.props.hidden;
    jqModal.modal({
      show: !this.props.hidden
    });
  }

  componentDidUpdate() {
    if (this.props.hidden != this.hidden) {
      const jqModal = jQuery(this.domModal);
      this.hidden = this.props.hidden;
      jqModal.modal(this.props.hidden ? 'hide' : 'show');
    }
  }

  componentWillUnmount() {
    // We discard the modal in a hard way (without hiding it). Thus we have to take care of the backgrop too.
    jQuery('.modal-backdrop').remove();
  }

  onHide(evt) {
    // Hide event is emited is both when hidden through user action or through API. We have to let the API
    // calls through, otherwise the modal would never hide. The user actions, which change the desired state,
    // are capture, converted to onClose callback and prevented. It's up to the parent to decide whether to
    // hide the modal or not.
    if (!this.props.hidden) {
      // noinspection JSIgnoredPromiseFromCall
      this.onClose();
      evt.preventDefault();
    }
  }


  async onClose() {
    if (this.props.onCloseAsync) {
      await this.props.onCloseAsync();
    }
  }

  async onButtonClick(idx) {
    const buttonSpec = this.props.buttons[idx];
    if (buttonSpec.onClickAsync) {
      await buttonSpec.onClickAsync(idx);
    }
  }

  render() {
    const props = this.props;
    const t = props.t;

    let buttons;

    if (this.props.buttons) {
      buttons = [];
      for (let idx = 0; idx < this.props.buttons.length; idx++) {
        const buttonSpec = this.props.buttons[idx];
        const button = <Button key={idx} label={buttonSpec.label} className={buttonSpec.className} onClickAsync={async () => await this.onButtonClick(idx)} />;
        buttons.push(button);
      }
    }

    return (
      <div
        ref={(domElem) => {this.domModal = domElem;}}
        className={'modal fade' + (props.className ? ' ' + props.className : '')}
        tabIndex="-1" role="dialog" aria-labelledby="myModalLabel">

                <div className="modal-dialog" role="document">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h4 className="modal-title">{this.props.title}</h4>
                            <button type="button" className="close" aria-label={t('close')} onClick={(...args) => this.onClose(...args)}><span aria-hidden="true">&times;</span></button>
                        </div>
                        <div className="modal-body">{this.props.children}</div>
                        {buttons &&
            <div className="modal-footer">
                                {buttons}
                            </div>
            }
                    </div>
                </div>
            </div>);

  }
});export { ModalDialog };