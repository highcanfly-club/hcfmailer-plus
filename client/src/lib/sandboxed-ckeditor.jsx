'use strict';

import React, { Component } from 'react';
import { withTranslation } from './i18n';
import PropTypes from "prop-types";
import "./sandboxed-ckeditor.scss";

import { UntrustedContentHost } from './untrusted';
import { Icon } from "./bootstrap-components";
import { getTrustedUrl } from "./urls";

import { initialHeight } from "./sandboxed-ckeditor-shared";
import { withComponentMixins } from "./decorator-helpers";
import { getTagLanguageFromEntity } from "./sandbox-common";
import { ResponsivePreview } from "./responsive-preview";
import { AIToolbar } from "./ai-toolbar";

const navbarHeight = 34; // Sync this with navbarheight in sandboxed-ckeditor.scss
const CKEditorHost =
withComponentMixins([
withTranslation],
['exportState'])(class
CKEditorHost extends Component {
  constructor(props) {
    super(props);

    this.state = {
      fullscreen: false,
      aiEpoch: 0,
      aiSource: null
    };

    this.onWindowResizeHandler = (...args) => this.onWindowResize(...args);
    this.contentNodeRefHandler = (node) => this.contentNode = node;
  }

  static propTypes = {
    entityTypeId: PropTypes.string,
    entity: PropTypes.object,
    initialSource: PropTypes.string,
    title: PropTypes.string,
    onSave: PropTypes.func,
    canSave: PropTypes.bool,
    onTestSend: PropTypes.func,
    onShowExport: PropTypes.func,
    onFullscreenAsync: PropTypes.func,
    editorType: PropTypes.string // 'ckeditor' (CKEditor 4, default) or 'ckeditor5'
  };

  // Applying an AI result reloads the editor with the new source; it is saved with the normal Save button
  applyAI({ source }) {
    this.setState(state => ({ aiSource: source, aiEpoch: state.aiEpoch + 1 }));
  }

  async toggleFullscreenAsync() {
    const fullscreen = !this.state.fullscreen;
    this.setState({
      fullscreen
    });
    await this.props.onFullscreenAsync(fullscreen);

    let newHeight;
    if (fullscreen) {
      newHeight = window.innerHeight - navbarHeight;
    } else {
      newHeight = initialHeight;
    }
    await this.contentNode.ask('setHeight', newHeight);
  }

  async exportState() {
    return await this.contentNode.ask('exportState');
  }

  onWindowResize() {
    if (this.state.fullscreen) {
      const newHeight = window.innerHeight - navbarHeight;
      // noinspection JSIgnoredPromiseFromCall
      this.contentNode.ask('setHeight', newHeight);
    }
  }

  componentDidMount() {
    window.addEventListener('resize', this.onWindowResizeHandler, false);
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.onWindowResizeHandler, false);
  }

  render() {
    const t = this.props.t;
    const editorType = this.props.editorType || 'ckeditor';

    const editorData = {
      entityTypeId: this.props.entityTypeId,
      entityId: this.props.entity.id,
      tagLanguage: getTagLanguageFromEntity(this.props.entity, this.props.entityTypeId),
      initialSource: this.state.aiSource !== null ? this.state.aiSource : this.props.initialSource
    };

    const tokenData = {
      entityTypeId: this.props.entityTypeId,
      entityId: this.props.entity.id
    };

    return (
      <div className={this.state.fullscreen ? "editorFullscreen" : "editor"}>
                <div className={"navbar"}>
                    <div className={"navbarLeft"}>
                        {this.state.fullscreen && <img className={"logo"} src={getTrustedUrl('static/mailtrain-notext.png')} />}
                        <div className={"title"}>{this.props.title}</div>
                    </div>
                    <div className={"navbarRight"}>
                        <ResponsivePreview getHtml={() => this.contentNode.ask('exportState')} tagLanguage={getTagLanguageFromEntity(this.props.entity, this.props.entityTypeId)} />
                        <AIToolbar editorType={editorType} getState={() => this.contentNode.ask('exportState')} onApplied={(...args) => this.applyAI(...args)} />
                        {this.props.canSave ? <a className={"btn"} onClick={this.props.onSave} title={t('save')}><Icon icon="save" /></a> : <span className={"btnDisabled"}><Icon icon="save" /></span>}
                        <a className={"btn"} onClick={this.props.onTestSend} title={t('sendTestEmail-1')}><Icon icon="at" /></a>
                        <a className={"btn"} onClick={() => this.props.onShowExport('html', 'HTML')} title={t('showHtml')}><Icon icon="file-code" /></a>
                        <a className={"btn"} onClick={(...args) => this.toggleFullscreenAsync(...args)} title={t('maximizeEditor')}><Icon icon="window-maximize" /></a>
                    </div>
                </div>
                <UntrustedContentHost key={`ai-${this.state.aiEpoch}`} ref={this.contentNodeRefHandler} className={"host"} singleToken={true} contentProps={editorData} contentSrc={`${editorType}/editor`} tokenMethod={editorType} tokenParams={editorData} />
            </div>);

  }
});export { CKEditorHost };