'use strict';

import React, { Component } from 'react';
import { withTranslation } from './i18n';
import PropTypes from "prop-types";
import "./sandboxed-grapesjs.scss";

import { UntrustedContentHost } from './untrusted';
import { Icon } from "./bootstrap-components";
import { getTrustedUrl } from "./urls";
import { withComponentMixins } from "./decorator-helpers";
import { GrapesJSSourceType } from "./sandboxed-grapesjs-shared";
import { getTagLanguageFromEntity } from "./sandbox-common";
import { ResponsivePreview } from "./responsive-preview";
import { AIToolbar } from "./ai-toolbar";

const GrapesJSHost =

withComponentMixins([
withTranslation],
['exportState'])(class
GrapesJSHost extends Component {
  constructor(props) {
    super(props);

    this.state = {
      fullscreen: false,
      aiEpoch: 0,
      aiSource: null,
      aiStyle: null
    };

    this.contentNodeRefHandler = (node) => this.contentNode = node;
  }

  static propTypes = {
    entityTypeId: PropTypes.string,
    entity: PropTypes.object,
    initialSource: PropTypes.string,
    initialStyle: PropTypes.string,
    sourceType: PropTypes.string,
    title: PropTypes.string,
    onSave: PropTypes.func,
    canSave: PropTypes.bool,
    onTestSend: PropTypes.func,
    onShowExport: PropTypes.func,
    onFullscreenAsync: PropTypes.func
  };

  async toggleFullscreenAsync() {
    const fullscreen = !this.state.fullscreen;
    this.setState({
      fullscreen
    });
    await this.props.onFullscreenAsync(fullscreen);
  }

  // Applying an AI result reloads the editor with the new source; it is saved with the normal Save button
  applyAI({ source, style }) {
    this.setState(state => ({ aiSource: source, aiStyle: style, aiEpoch: state.aiEpoch + 1 }));
  }

  async exportState() {
    return await this.contentNode.ask('exportState');
  }

  render() {
    const t = this.props.t;

    const editorData = {
      entityTypeId: this.props.entityTypeId,
      entityId: this.props.entity.id,
      tagLanguage: getTagLanguageFromEntity(this.props.entity, this.props.entityTypeId),
      initialSource: this.state.aiSource !== null ? this.state.aiSource : this.props.initialSource,
      initialStyle: this.state.aiStyle !== null ? this.state.aiStyle : this.props.initialStyle,
      sourceType: this.props.sourceType
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
                        <AIToolbar editorType="grapesjs" getState={() => this.contentNode.ask('exportState')} onApplied={(...args) => this.applyAI(...args)} />
                        {this.props.canSave ? <a className={"btn"} onClick={this.props.onSave} title={t('save')}><Icon icon="save" /></a> : <span className={"btnDisabled"}><Icon icon="save" /></span>}
                        <a className={"btn"} onClick={this.props.onTestSend} title={t('sendTestEmail-1')}><Icon icon="at" /></a>
                        <a className={"btn"} onClick={() => this.props.onShowExport('html', 'HTML')} title={t('showHtml')}><Icon icon="file-code" /></a>
                        {this.props.sourceType === GrapesJSSourceType.MJML && <a className={"btn"} onClick={() => this.props.onShowExport('mjml', 'MJML')} title={t('showMjml')}>MJML</a>}
                        <a className={"btn"} onClick={(...args) => this.toggleFullscreenAsync(...args)} title={t('maximizeEditor')}><Icon icon="window-maximize" /></a>
                    </div>
                </div>
                <UntrustedContentHost key={`ai-${this.state.aiEpoch}`} ref={this.contentNodeRefHandler} className={"host"} singleToken={true} contentProps={editorData} contentSrc="grapesjs/editor" tokenMethod="grapesjs" tokenParams={tokenData} />
            </div>);

  }
});export { GrapesJSHost };