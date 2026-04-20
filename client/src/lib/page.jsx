'use strict';

import React, { Component, useEffect, useRef, useMemo, useCallback } from "react";
import i18n, { withTranslation } from './i18n';
import PropTypes from "prop-types";
import { BrowserRouter, Link, Routes, Route, useNavigate, useLocation, useParams, useNavigationType } from "react-router-dom";
import { withErrorHandling } from "./error-handling";
import interoperableErrors from "../../../shared/interoperable-errors";
import { ActionLink, Button, DismissibleAlert, DropdownActionLink, Icon } from "./bootstrap-components";
import mailtrainConfig from "mailtrainConfig";
import "./styles.scss";
import { getRoutes, renderRoute, Resolver, RouteElementWrapper, SectionContentContext, toV7Path, withPageHelpers } from "./page-common";
import { getBaseDir, getUrl } from "./urls";
import { createComponentMixin, withComponentMixins } from "./decorator-helpers";
import { getLang } from "../../../shared/langs";
import NavDropdown from 'react-bootstrap/NavDropdown';

export { withPageHelpers };

/**
 * React Router v7 compatible withRouter HOC.
 * Provides v5-like history/location/match props to class components.
 * history.block() uses a guarded navigate approach (no data-router required).
 */
function withRouter(WrappedComponent) {
  function WithRouter(props) {
    const navigate = useNavigate();
    const location = useLocation();
    const params = useParams();
    const navigationType = useNavigationType();

    const listenersRef = useRef([]);
    const prevLocationRef = useRef(null);
    const blockMessageRef = useRef(null);
    const beforeUnloadCheckRef = useRef(null);
    const isBlockedRef = useRef(false);

    // Call history.listen() listeners when navigation occurs
    useEffect(() => {
      if (prevLocationRef.current !== null) {
        for (const listener of listenersRef.current) {
          listener(location, navigationType);
        }
      }
      prevLocationRef.current = location;
    }, [location, navigationType]);

    // Guarded navigate: checks dirty-state before proceeding
    const guardedNavigate = useCallback(async (path, opts) => {
      if (isBlockedRef.current) {
        const check = beforeUnloadCheckRef.current;
        if (check) {
          const shouldCancel = await check();
          if (shouldCancel) {
            const allow = window.confirm(blockMessageRef.current);
            if (!allow) return;
          }
        }
      }
      navigate(path, opts);
    }, [navigate]);

    // Build stable history object; navigate-based methods updated each render
    const historyRef = useRef(null);
    if (!historyRef.current) {
      historyRef.current = {
        push: null,
        replace: null,
        goBack: null,
        listen: (fn) => {
          listenersRef.current.push(fn);
          return () => {
            listenersRef.current = listenersRef.current.filter(l => l !== fn);
          };
        },
        block: (message) => {
          blockMessageRef.current = message;
          isBlockedRef.current = true;
          return () => { isBlockedRef.current = false; };
        },
        /** Allow the wrapped class component to supply an async dirty-check function */
        _setBeforeUnloadCheck: (fn) => {
          beforeUnloadCheckRef.current = fn;
        },
      };
    }
    historyRef.current.push = (path, state) => guardedNavigate(path, { state });
    historyRef.current.replace = (path, state) => guardedNavigate(path, { replace: true, state });
    historyRef.current.goBack = () => navigate(-1);

    const match = useMemo(
      () => ({ params, url: location.pathname, isExact: true }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [params, location.pathname]
    );

    return (
      <WrappedComponent
        {...props}
        history={historyRef.current}
        location={location}
        match={match}
      />
    );
  }

  WithRouter.displayName = `withRouter(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;
  return WithRouter;
}

class Breadcrumb extends Component {
  constructor(props) {
    super(props);
  }

  static propTypes = {
    route: PropTypes.object.isRequired,
    params: PropTypes.object.isRequired,
    resolved: PropTypes.object.isRequired
  };

  renderElement(entry, isActive) {
    const params = this.props.params;
    let title;
    if (typeof entry.title === 'function') {
      title = entry.title(this.props.resolved, params);
    } else {
      title = entry.title;
    }

    if (isActive) {
      return <li key={entry.path} className="breadcrumb-item active">{title}</li>;

    } else if (entry.externalLink) {
      let externalLink;
      if (typeof entry.externalLink === 'function') {
        externalLink = entry.externalLink(params);
      } else {
        externalLink = entry.externalLink;
      }

      return <li key={entry.path} className="breadcrumb-item"><a href={externalLink}>{title}</a></li>;

    } else if (entry.link) {
      let link;
      if (typeof entry.link === 'function') {
        link = entry.link(params);
      } else {
        link = entry.link;
      }
      return <li key={entry.path} className="breadcrumb-item"><Link to={link}>{title}</Link></li>;

    } else {
      return <li key={entry.path} className="breadcrumb-item">{title}</li>;
    }
  }

  render() {
    const route = this.props.route;

    const renderedElems = [...route.parents.map((x) => this.renderElement(x)), this.renderElement(route, true)];

    return <nav aria-label="breadcrumb"><ol className="breadcrumb">{renderedElems}</ol></nav>;
  }
}

class TertiaryNavBar extends Component {
  static propTypes = {
    route: PropTypes.object.isRequired,
    params: PropTypes.object.isRequired,
    resolved: PropTypes.object.isRequired,
    className: PropTypes.string
  };

  renderElement(key, entry) {
    const params = this.props.params;
    let title;
    if (typeof entry.title === 'function') {
      title = entry.title(this.props.resolved);
    } else {
      title = entry.title;
    }

    let liClassName = 'nav-item';
    let linkClassName = 'nav-link';
    if (entry.active) {
      linkClassName += ' active';
    }

    if (entry.link) {
      let link;

      if (typeof entry.link === 'function') {
        link = entry.link(params);
      } else {
        link = entry.link;
      }

      return <li key={key} role="presentation" className={liClassName}><Link className={linkClassName} to={link}>{title}</Link></li>;

    } else if (entry.externalLink) {
      let externalLink;
      if (typeof entry.externalLink === 'function') {
        externalLink = entry.externalLink(params);
      } else {
        externalLink = entry.externalLink;
      }

      return <li key={key} role="presentation" className={liClassName}><a className={linkClassName} href={externalLink}>{title}</a></li>;

    } else {
      return <li key={key} role="presentation" className={liClassName}>{title}</li>;
    }
  }

  render() {
    const route = this.props.route;

    const keys = Object.keys(route.navs);
    const renderedElems = [];

    for (const key of keys) {
      const entry = route.navs[key];

      let visible = true;
      if (typeof entry.visible === 'function') {
        visible = entry.visible(this.props.resolved);
      }

      if (visible) {
        renderedElems.push(this.renderElement(key, entry));
      }
    }

    if (renderedElems.length > 1) {
      let className = "tertiaryNav" + ' nav nav-pills';
      if (this.props.className) {
        className += ' ' + this.props.className;
      }

      return <ul className={className}>{renderedElems}</ul>;
    } else {
      return null;
    }
  }
}



function getLoadingMessage(t) {
  return (
    <div className="container-fluid my-3">
            {t('loading')}
        </div>);

}

function renderFrameWithContent(t, panelInFullScreen, showSidebar, primaryMenu, secondaryMenu, content) {
  if (panelInFullScreen) {
    return (
      <div key="app" className="app panel-in-fullscreen">
                <div key="appBody" className="app-body">
                    <main key="main" className="main">
                        {content}
                    </main>
                </div>
            </div>);


  } else {
    return (
      <div key="app" className={"app " + (showSidebar ? 'sidebar-lg-show' : '')}>
                <header key="appHeader" className="app-header">
                    <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
                        {showSidebar &&
            <button className="navbar-toggler sidebar-toggler" data-toggle="sidebar-show" type="button">
                            <span className="navbar-toggler-icon" />
                        </button>
            }

                        <Link className="navbar-brand" to="/"><div><Icon icon="envelope" /> HCFMailer+</div></Link>

                        <button className="navbar-toggler" type="button" data-toggle="collapse" data-target="#mtMainNavbar" aria-controls="navbarColor01" aria-expanded="false" aria-label="Toggle navigation">
                            <span className="navbar-toggler-icon" />
                        </button>

                        <div className="collapse navbar-collapse" id="mtMainNavbar">
                            {primaryMenu}
                        </div>
                    </nav>
                </header>

                <div key="appBody" className="app-body">
                    {showSidebar &&
          <div key="sidebar" className="sidebar">
                        {secondaryMenu}
                    </div>
          }
                    <main key="main" className="main">
                        {content}
                    </main>
                </div>

                <footer key="appFooter" className="footer fixed-bottom mt-auto">
                    <div className="">&copy; 2022-2026 <a href="https://sctg.eu.org">SCTG.eu.org</a>, Mailtrain.org. <a href="https://github.com/highcanfly-club/mailtrain/tree/hcf">{t('sourceOnGitHub')}</a></div>
                </footer>
            </div>);

  }
}const PanelRoute =


withComponentMixins([
withTranslation]
)(class
PanelRoute extends Component {
  constructor(props) {
    super(props);
    this.state = {
      panelInFullScreen: props.route.panelInFullScreen
    };

    this.sidebarAnimationNodeListener = (evt) => {
      if (evt.propertyName === 'left') {
        this.forceUpdate();
      }
    };

    this.setPanelInFullScreen = (panelInFullScreen) => this.setState({ panelInFullScreen });
  }

  static propTypes = {
    route: PropTypes.object.isRequired,
    location: PropTypes.object.isRequired,
    match: PropTypes.object.isRequired,
    flashMessage: PropTypes.object
  };

  registerSidebarAnimationListener() {
    if (this.sidebarAnimationNode) {
      this.sidebarAnimationNode.addEventListener("transitionend", this.sidebarAnimationNodeListener);
    }
  }

  componentDidMount() {
    this.registerSidebarAnimationListener();
  }

  componentDidUpdate(prevProps) {
    this.registerSidebarAnimationListener();
  }

  render() {
    const t = this.props.t;
    const route = this.props.route;
    const params = this.props.match.params;

    const showSidebar = !!route.secondaryMenuComponent;

    const panelInFullScreen = this.state.panelInFullScreen;

    const render = (resolved, permissions) => {
      let primaryMenu = null;
      let secondaryMenu = null;
      let content = null;

      if (resolved && permissions) {
        const compProps = {
          match: this.props.match,
          location: this.props.location,
          resolved,
          permissions,
          setPanelInFullScreen: this.setPanelInFullScreen,
          panelInFullScreen: this.state.panelInFullScreen
        };

        let panel;
        if (route.panelComponent) {
          panel = React.createElement(route.panelComponent, compProps);
        } else if (route.panelRender) {
          panel = route.panelRender(compProps);
        }

        if (route.primaryMenuComponent) {
          primaryMenu = React.createElement(route.primaryMenuComponent, compProps);
        }

        if (route.secondaryMenuComponent) {
          secondaryMenu = React.createElement(route.secondaryMenuComponent, compProps);
        }

        const panelContent =
        <div key="panel" className="container-fluid">
                        {this.props.flashMessage}
                        {panel}
                    </div>;


        if (panelInFullScreen) {
          content = panelContent;
        } else {
          content =
          <>
                            <div key="tertiaryNav" className="mt-breadcrumb-and-tertiary-navbar">
                                <Breadcrumb route={route} params={params} resolved={resolved} />
                                <TertiaryNavBar route={route} params={params} resolved={resolved} />
                            </div>
                            {panelContent}
                        </>;

        }

      } else {
        content = getLoadingMessage(t);
      }

      return renderFrameWithContent(t, panelInFullScreen, showSidebar, primaryMenu, secondaryMenu, content);
    };


    return <Resolver route={route} render={render} location={this.props.location} match={this.props.match} />;
  }
});


export class BeforeUnloadListeners {
  constructor() {
    this.listeners = new Set();
  }

  register(listener) {
    this.listeners.add(listener);
  }

  deregister(listener) {
    this.listeners.delete(listener);
  }

  shouldUnloadBeCancelled() {
    for (const lst of this.listeners) {
      if (lst.handler()) return true;
    }

    return false;
  }

  async shouldUnloadBeCancelledAsync() {
    for (const lst of this.listeners) {
      if (await lst.handlerAsync()) return true;
    }

    return false;
  }
}const SectionContent =

withRouter(
withComponentMixins([
withTranslation,
withErrorHandling],
['onNavigationConfirmationDialog'])(class
SectionContent extends Component {
  constructor(props) {
    super(props);

    this.state = {
      flashMessageText: ''
    };

    this.historyUnlisten = props.history.listen((location, action) => {
      // I don't think it is ever needed on replace action, or at least it will be better than not showing the msg,
      // and without it this won't work because first it goes to '/' -> '/workspaces' so replacing immediately
      if (action === "REPLACE") return;
      if (location.state && location.state.preserveFlashMessage) return;

      // noinspection JSIgnoredPromiseFromCall
      this.closeFlashMessage();
    });

    this.beforeUnloadListeners = new BeforeUnloadListeners();
    this.beforeUnloadHandler = (...args) => this.onBeforeUnload(...args);
    this.historyUnblock = null;
  }

  static propTypes = {
    structure: PropTypes.object.isRequired,
    root: PropTypes.string.isRequired
  };

  onBeforeUnload(event) {
    if (this.beforeUnloadListeners.shouldUnloadBeCancelled()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  onNavigationConfirmationDialog(message, callback) {
    this.beforeUnloadListeners.shouldUnloadBeCancelledAsync().then((res) => {
      if (res) {
        const allowTransition = window.confirm(message);
        callback(allowTransition);
      } else {
        callback(true);
      }
    });
  }

  componentDidMount() {
    const t = this.props.t;
    const queryParams = this.props.location.search;
    if (queryParams.indexOf('cas-login-success') > -1) this.setFlashMessage('success', t('authenticationSuccessful'));
    if (queryParams.indexOf('cas-logout-success') > -1) this.setFlashMessage('success', t('logoutSuccessful'));
    if (queryParams.indexOf('cas-login-error') > -1) this.setFlashMessage('danger', t('authenticationFailed'));

    window.addEventListener('beforeunload', this.beforeUnloadHandler);
    this.historyUnblock = this.props.history.block(t('alertQuitPage'));
    // Wire up dirty-form check so the router blocker can ask for confirmation
    // only when there are actually unsaved changes.
    this.props.history._setBeforeUnloadCheck(() => this.beforeUnloadListeners.shouldUnloadBeCancelledAsync());
  }

  componentWillUnmount() {
    window.removeEventListener('beforeunload', this.beforeUnloadHandler);
    this.historyUnblock();
  }

  setFlashMessage(severity, text) {
    this.setState({
      flashMessageText: text,
      flashMessageSeverity: severity
    });
  }

  navigateTo(path) {
    this.props.history.push(path);
  }

  navigateBack() {
    this.props.history.goBack();
  }

  navigateToWithFlashMessage(path, severity, text) {
    this.props.history.push(path, { preserveFlashMessage: true });
    this.setFlashMessage(severity, text);
  }

  ensureAuthenticated() {
    if (!mailtrainConfig.isAuthenticated) {
      if (mailtrainConfig.authMethod == 'cas') {
        window.location.href = getUrl('cas/login?next=' + encodeURIComponent(window.location.pathname));
      } else {
        this.navigateTo('/login?next=' + encodeURIComponent(window.location.pathname));
      }
    }
  }

  registerBeforeUnloadHandlers(handlers) {
    this.beforeUnloadListeners.register(handlers);
  }

  deregisterBeforeUnloadHandlers(handlers) {
    this.beforeUnloadListeners.deregister(handlers);
  }

  errorHandler(error) {
    if (error instanceof interoperableErrors.NotLoggedInError) {
      if (window.location.pathname !== '/login') {// There may be multiple async requests failing at the same time. So we take the pathname only from the first one.
        this.navigateTo('/login?next=' + encodeURIComponent(window.location.pathname));
      }
    } else if (error.response && error.response.data && error.response.data.message) {
      console.error(error);
      this.navigateToWithFlashMessage(this.props.root, 'danger', error.response.data.message);
    } else {
      console.error(error);
      this.navigateToWithFlashMessage(this.props.root, 'danger', error.message);
    }
    return true;
  }

  async closeFlashMessage() {
    this.setState({
      flashMessageText: ''
    });
  }

  renderRoute(route) {
    const t = this.props.t;

    const renderFn = (props) => {
      let flashMessage;
      if (this.state.flashMessageText) {
        flashMessage = <DismissibleAlert severity={this.state.flashMessageSeverity} onCloseAsync={(...args) => this.closeFlashMessage(...args)}>{this.state.flashMessageText}</DismissibleAlert>;
      }

      return renderRoute(
        route,
        PanelRoute,
        () => renderFrameWithContent(t, false, false, null, null, getLoadingMessage(this.props.t)),
        flashMessage,
        props
      );
    };

    const v7Path = toV7Path(route.exact ? route.path : route.path + '/*');
    return <Route key={route.path} path={v7Path} element={<RouteElementWrapper key={route.path} renderFn={renderFn} />} />;
  }

  render() {
    const routes = getRoutes(this.props.structure);

    return (
      <SectionContentContext.Provider value={this}>
                <Routes>{routes.map((x) => this.renderRoute(x))}</Routes>
            </SectionContentContext.Provider>);

  }
}));export { SectionContent };const Section =

withComponentMixins([
withTranslation]
)(class
Section extends Component {
  constructor(props) {
    super(props);
  }

  static propTypes = {
    structure: PropTypes.oneOfType([PropTypes.object, PropTypes.func]).isRequired,
    root: PropTypes.string.isRequired
  };

  render() {
    let structure = this.props.structure;
    if (typeof structure === 'function') {
      structure = structure(this.props.t);
    }

    return (
      <BrowserRouter basename={getBaseDir()}>
                    <SectionContent root={this.props.root} structure={structure} />
            </BrowserRouter>);

  }
});export { Section };


export class Title extends Component {
  render() {
    return (
      <div>
                <h2>{this.props.children}</h2>
                <hr />
            </div>);

  }
}

export class Toolbar extends Component {
  static propTypes = {
    className: PropTypes.string
  };

  render() {
    let className = "toolbar" + ' ' + "buttonRow";
    if (this.props.className) {
      className += ' ' + this.props.className;
    }

    return (
      <div className={className}>
                {this.props.children}
            </div>);

  }
}

export class LinkButton extends Component {
  static propTypes = {
    label: PropTypes.string,
    icon: PropTypes.string,
    className: PropTypes.string,
    to: PropTypes.string
  };

  render() {
    const props = this.props;

    return (
      <Link to={props.to}><Button label={props.label} icon={props.icon} className={props.className} /></Link>);

  }
}

export class DropdownLink extends Component {
  static propTypes = {
    to: PropTypes.string,
    className: PropTypes.string,
    forceReload: PropTypes.bool
  };

  render() {
    const props = this.props;

    const clsName = "dropdown-item" + (props.className ? " " + props.className : "");
    if (props.forceReload) {
      return (
        <Link to={props.to} className={clsName} onClick={() => window.location.href = props.to}>{props.children}</Link>);

    } else {
      return (
        <Link to={props.to} className={clsName}>{props.children}</Link>);

    }
  }
}

export class NavLink extends Component {
  static propTypes = {
    to: PropTypes.string,
    icon: PropTypes.string,
    iconFamily: PropTypes.string,
    className: PropTypes.string
  };

  render() {
    const props = this.props;

    const clsName = "nav-item" + (props.className ? " " + props.className : "");

    let icon;
    if (props.icon) {
      icon = <><Icon icon={props.icon} family={props.iconFamily} />{' '}</>;
    }

    return (
      <li className={clsName}><Link to={props.to} className="nav-link">{icon}{props.children}</Link></li>);

  }
}

export class NavActionLink extends Component {
  static propTypes = {
    onClickAsync: PropTypes.func,
    icon: PropTypes.string,
    iconFamily: PropTypes.string,
    className: PropTypes.string
  };

  render() {
    const props = this.props;

    const clsName = "nav-item" + (props.className ? " " + props.className : "");

    let icon;
    if (props.icon) {
      icon = <><Icon icon={props.icon} family={props.iconFamily} />{' '}</>;
    }

    return (
      <li className={clsName}><ActionLink onClickAsync={this.props.onClickAsync} className="nav-link">{icon}{props.children}</ActionLink></li>);

  }
}

// export class NavDropdown extends Component {
//     static propTypes = {
//         label: PropTypes.string,
//         icon: PropTypes.string,
//         className: PropTypes.string,
//         menuClassName: PropTypes.string
//     }

//     render() {
//         const props = this.props;

//         const className = 'nav-item dropdown' + (props.className ? ' ' + props.className : '');
//         const menuClassName = 'dropdown-menu' + (props.menuClassName ? ' ' + props.menuClassName : '');

//         return (
//             <li className={className}>
//                 {props.icon ?
//                     <a href="#" className="nav-link dropdown-toggle" data-toggle="dropdown" role="button" aria-haspopup="true" aria-expanded="false">
//                         <Icon icon={props.icon}/>{' '}{props.label}
//                     </a>
//                     :
//                     <a href="#" className="nav-link dropdown-toggle" data-toggle="dropdown" role="button" aria-haspopup="true" aria-expanded="false">
//                         {props.label}
//                     </a>
//                 }
//                 <ul className={menuClassName}>
//                     {props.children}
//                 </ul>
//             </li>
//         );
//     }
// }


export const requiresAuthenticatedUser = createComponentMixin({
  deps: [withPageHelpers],
  decoratorFn: (TargetClass, InnerClass) => {
    class RequiresAuthenticatedUser extends React.Component {
      constructor(props) {
        super(props);
        props.sectionContent.ensureAuthenticated();
      }

      render() {
        return <TargetClass {...this.props} />;
      }
    }

    return {
      cls: RequiresAuthenticatedUser
    };
  }
});

function ifLanguageisShort(lang) {
  if (typeof lang === "string" && lang.length === 2) {
    return `${lang}-${lang.toUpperCase()}`;
  } else {
    return lang;
  }
}

export function getLanguageChooser(t) {
  const languageOptions = [];
  for (const lng of mailtrainConfig.enabledLanguages) {
    const langDesc = getLang(lng);
    const label = langDesc.getLabel(t);

    languageOptions.push(
      <DropdownActionLink key={lng} onClickAsync={async () => i18n.changeLanguage(langDesc.longCode)}>{label}</DropdownActionLink>
    );
  }

  const currentLngCode = getLang(ifLanguageisShort(i18n.language)).getShortLabel(t);

  const languageChooser =
  <NavDropdown menuclassname="dropdown-menu-right" title={currentLngCode}>
            {languageOptions}
        </NavDropdown>;


  return languageChooser;
}