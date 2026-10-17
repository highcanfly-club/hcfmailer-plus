'use strict';

import './public-path';

import React, { Component } from 'react';
import { createRoot } from 'react-dom/client';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { renderToStaticMarkup } from '@usewaypoint/email-builder';
import { TranslationRoot, withTranslation } from './i18n';
import { parentRPC, UntrustedContentRoot } from './untrusted';
import PropTypes from "prop-types";
import "./sandboxed-ckeditor.scss";
import { getPublicUrl, getSandboxUrl, getTrustedUrl } from "./urls";
import { base, unbase } from "../../../shared/templates";

import EmailBuilderApp from './email-builder/EditorApp';
import theme from './email-builder/theme';
import { getDocument, resetDocument } from './email-builder/documents/editor/EditorContext';
import EMPTY_EMAIL_MESSAGE from './email-builder/getConfiguration/empty-email-message';

import { withComponentMixins } from "./decorator-helpers";

const EmailBuilderSandbox =
withComponentMixins([
withTranslation]
)(class
EmailBuilderSandbox extends Component {
  constructor(props) {
    super(props);

    const trustedUrlBase = getTrustedUrl();
    const sandboxUrlBase = getSandboxUrl();
    const publicUrlBase = getPublicUrl();

    let document = EMPTY_EMAIL_MESSAGE;
    if (this.props.initialSource) {
      try {
        document = JSON.parse(base(this.props.initialSource, this.props.tagLanguage, trustedUrlBase, sandboxUrlBase, publicUrlBase));
      } catch (err) {
        console.error('Invalid Email Builder document', err);
      }
    }

    // The editor state lives in a module-level store, so it has to be loaded before the first render
    resetDocument(document);
  }

  static propTypes = {
    entityTypeId: PropTypes.string,
    entityId: PropTypes.number,
    tagLanguage: PropTypes.string,
    initialSource: PropTypes.string
  };

  async exportState(method, params) {
    const trustedUrlBase = getTrustedUrl();
    const sandboxUrlBase = getSandboxUrl();
    const publicUrlBase = getPublicUrl();

    const document = getDocument();
    const unbasedSource = unbase(JSON.stringify(document), this.props.tagLanguage, trustedUrlBase, sandboxUrlBase, publicUrlBase, true);
    const unbasedBody = unbase(renderToStaticMarkup(document, { rootBlockId: 'root' }), this.props.tagLanguage, trustedUrlBase, sandboxUrlBase, publicUrlBase, true);

    return {
      source: unbasedSource,
      // renderToStaticMarkup already returns a complete HTML document
      html: unbasedBody
    };
  }

  async setHeight(method, height) {
    this.setState({ height });
  }

  state = { height: null };

  componentDidMount() {
    parentRPC.setMethodHandler('exportState', (...args) => this.exportState(...args));
    parentRPC.setMethodHandler('setHeight', (...args) => this.setHeight(...args));
  }

  render() {
    return (
      <div className="sandbox" style={{ height: this.state.height ? this.state.height + 'px' : '100vh' }}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <EmailBuilderApp />
        </ThemeProvider>
      </div>
    );
  }
});

function init() {
  parentRPC.init();
  const root = createRoot(document.getElementById('root'));
  root.render(
    <TranslationRoot>
      <UntrustedContentRoot render={(props) => <EmailBuilderSandbox {...props} />} />
    </TranslationRoot>
  );
}

window.MailtrainReactBody = { default: init };
