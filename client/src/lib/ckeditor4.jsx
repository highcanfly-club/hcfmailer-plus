'use strict';

import React, { Component } from 'react';
import PropTypes from 'prop-types';

const defaultScriptUrl = 'https://cdn.ckeditor.com/4.22.1/standard/ckeditor.js';

function loadScript(url, callback) {
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.onload = () => callback(null);
    script.onerror = () => callback(new Error(`Cannot load ${url}`));
    document.head.appendChild(script);
}

// Minimal CKEditor 4 wrapper. Replaces react-ckeditor-component, which relies on ReactDOM.findDOMNode (removed in React 19).
// The editor instance is exposed as this.editorInstance.
export default class CKEditor extends Component {
    static propTypes = {
        content: PropTypes.any,
        config: PropTypes.object,
        scriptUrl: PropTypes.string,
        activeClass: PropTypes.string,
        events: PropTypes.object
    };

    static defaultProps = {
        content: '',
        config: {},
        scriptUrl: defaultScriptUrl,
        activeClass: '',
        events: {}
    };

    containerRef = React.createRef();

    componentDidMount() {
        if (window.CKEDITOR) {
            this.onLoad();
        } else {
            loadScript(this.props.scriptUrl, err => {
                if (err) {
                    console.error(err);
                } else {
                    this.onLoad();
                }
            });
        }
    }

    componentDidUpdate() {
        const editor = this.editorInstance;
        if (editor && editor.getData() !== this.props.content) {
            editor.setData(this.props.content);
        }
    }

    componentWillUnmount() {
        this.unmounting = true;
        if (this.editorInstance) {
            this.editorInstance.destroy();
            this.editorInstance = null;
        }
    }

    onLoad() {
        if (this.unmounting || this.editorInstance) return;

        if (!window.CKEDITOR) {
            console.error('CKEditor not found');
            return;
        }

        this.editorInstance = window.CKEDITOR.appendTo(this.containerRef.current, this.props.config, this.props.content);

        for (const event in this.props.events) {
            this.editorInstance.on(event, this.props.events[event]);
        }
    }

    render() {
        return <div ref={this.containerRef} className={this.props.activeClass} />;
    }
}
