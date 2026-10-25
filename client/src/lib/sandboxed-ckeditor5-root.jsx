'use strict';

import './public-path';

import React, { Component } from 'react';
import { createRoot } from 'react-dom/client';
import { TranslationRoot, withTranslation } from './i18n';
import { parentRPC, UntrustedContentRoot } from './untrusted';
import PropTypes from "prop-types";
import "./sandboxed-ckeditor.scss";
import { getPublicUrl, getSandboxUrl, getTrustedUrl } from "./urls";
import { base, unbase } from "../../../shared/templates";

import {
  Alignment, Autoformat, AutoLink, BlockQuote, Bold, ClassicEditor, Essentials, FontBackgroundColor, FontColor,
  FontFamily, FontSize, GeneralHtmlSupport, Heading, HorizontalLine, Image, ImageCaption, ImageInsertViaUrl,
  ImageResize, ImageStyle, ImageToolbar, ImageUpload, Indent, IndentBlock, Italic, Link, LinkImage, List, ListProperties,
  Paragraph, PasteFromOffice, RemoveFormat, SourceEditing, SpecialCharacters, SpecialCharactersEssentials,
  Strikethrough, Table, TableCellProperties, TableColumnResize, TableProperties, TableToolbar, Underline, Undo
} from 'ckeditor5';
import 'ckeditor5/ckeditor5.css';

import axios from './axios';
import { initialHeight } from "./sandboxed-ckeditor-shared";
import { withComponentMixins } from "./decorator-helpers";

// Uploads go through the sandbox, which shrinks images to at most 1200 px wide before storing them
function createUploadAdapterPlugin(entityTypeId, entityId) {
  return function MailtrainUploadAdapter(editor) {
    editor.plugins.get('FileRepository').createUploadAdapter = loader => ({
      async upload() {
        if (!entityTypeId || !entityId) {
          throw new Error('Save the template once before uploading images.');
        }
        const form = new FormData();
        form.append('files[]', await loader.file);
        const res = await axios.post(getSandboxUrl(`ckeditor5/upload/${entityTypeId}/${entityId}`), form);
        const url = res.data && res.data.files && res.data.files[0] && res.data.files[0].url;
        if (!url) {
          throw new Error('Upload failed');
        }
        return { default: url };
      },
      abort() {}
    });
  };
}

const CKEditor5Sandbox =
withComponentMixins([
withTranslation]
)(class
CKEditor5Sandbox extends Component {
  constructor(props) {
    super(props);

    const trustedUrlBase = getTrustedUrl();
    const sandboxUrlBase = getSandboxUrl();
    const publicUrlBase = getPublicUrl();
    const source = this.props.initialSource && base(this.props.initialSource, this.props.tagLanguage, trustedUrlBase, sandboxUrlBase, publicUrlBase);

    this.source = source || '';
    this.containerRef = React.createRef();
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

    const preHtml = '<!doctype html><html><head><meta charset="utf-8"><title></title></head><body>';
    const postHtml = '</body></html>';

    const unbasedSource = unbase(this.editor ? this.editor.getData() : this.source, this.props.tagLanguage, trustedUrlBase, sandboxUrlBase, publicUrlBase, true);

    return {
      source: unbasedSource,
      html: preHtml + unbasedSource + postHtml
    };
  }

  async setHeight(method, height) {
    if (this.editor) {
      this.editor.editing.view.change(writer => {
        writer.setStyle('height', height + 'px', this.editor.editing.view.document.getRoot());
      });
    }
  }

  async componentDidMount() {
    parentRPC.setMethodHandler('exportState', (...args) => this.exportState(...args));
    parentRPC.setMethodHandler('setHeight', (...args) => this.setHeight(...args));

    try {
      const editor = await ClassicEditor.create(this.containerRef.current, {
        licenseKey: 'GPL',
        extraPlugins: [createUploadAdapterPlugin(this.props.entityTypeId, this.props.entityId)],
        initialData: this.source,
        plugins: [
          Alignment, Autoformat, AutoLink, BlockQuote, Bold, Essentials, FontBackgroundColor, FontColor, FontFamily,
          FontSize, GeneralHtmlSupport, Heading, HorizontalLine, Image, ImageCaption, ImageInsertViaUrl, ImageResize,
          ImageStyle, ImageToolbar, ImageUpload, Indent, IndentBlock, Italic, Link, LinkImage, List, ListProperties, Paragraph,
          PasteFromOffice, RemoveFormat, SourceEditing, SpecialCharacters, SpecialCharactersEssentials, Strikethrough,
          Table, TableCellProperties, TableColumnResize, TableProperties, TableToolbar, Underline, Undo
        ],
        toolbar: {
          items: [
            'undo', 'redo', '|', 'heading', '|', 'bold', 'italic', 'underline', 'strikethrough', 'removeFormat', '|',
            'fontFamily', 'fontSize', 'fontColor', 'fontBackgroundColor', '|', 'alignment', '|',
            'bulletedList', 'numberedList', 'outdent', 'indent', '|', 'link', 'uploadImage', 'insertImageViaUrl', 'insertTable',
            'horizontalLine', 'blockQuote', 'specialCharacters', '|', 'sourceEditing'
          ],
          shouldNotGroupWhenFull: true
        },
        image: {
          toolbar: ['imageStyle:inline', 'imageStyle:block', 'imageStyle:side', '|', 'toggleImageCaption', 'imageTextAlternative', '|', 'linkImage']
        },
        table: {
          contentToolbar: ['tableColumn', 'tableRow', 'mergeTableCells', 'tableProperties', 'tableCellProperties']
        },
        // E-mail templates rely on arbitrary HTML (nested tables, inline styles, merge tags), so do not let the editor strip it.
        htmlSupport: {
          allow: [{ name: /.*/, attributes: true, classes: true, styles: true }]
        }
      });

      this.editor = editor;
      this.setHeight(null, initialHeight);
    } catch (err) {
      console.error(err);
    }
  }

  componentWillUnmount() {
    if (this.editor) {
      this.editor.destroy();
      this.editor = null;
    }
  }

  render() {
    return (
      <div className="sandbox">
        <div ref={this.containerRef} />
      </div>
    );
  }
});

function init() {
  parentRPC.init();
  const root = createRoot(document.getElementById('root'));
  root.render(
    <TranslationRoot>
      <UntrustedContentRoot render={(props) => <CKEditor5Sandbox {...props} />} />
    </TranslationRoot>
  );
}

window.MailtrainReactBody = { default: init };
