import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { getTrustedUrl, getSandboxUrl, getPublicUrl } from './lib/urls.js';
import { AppType } from '../shared/app.js';
import { createClient } from 'redis';
import { createProxyMiddleware } from 'http-proxy-middleware';
import config from './lib/config.js';
import log from './lib/log.js';
import express from 'express';
import expressLocale from 'express-locale';
import bodyParser from 'body-parser';
import path from 'path';
import favicon from 'serve-favicon';
import logger from 'morgan';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import flash from 'connect-flash';
import hbs from 'hbs';
import compression from 'compression';
import passport from './lib/passport.js';
import contextHelpers from './lib/context-helpers.js';
import api from './routes/api.js';
import reports from './routes/reports.js';
import quickReports from './routes/quick-reports.js';
import subscriptions from './routes/subscriptions.js';
import campaigns from './routes/campaigns.js';
import subscription from './routes/subscription.js';
import sandboxedMosaico from './routes/sandboxed-mosaico.js';
import sandboxedCKEditor from './routes/sandboxed-ckeditor.js';
import sandboxedGrapesJS from './routes/sandboxed-grapesjs.js';
import sandboxedCodeEditor from './routes/sandboxed-codeeditor.js';
import files from './routes/files.js';
import links from './routes/links.js';
import archive from './routes/archive.js';
import webhooks from './routes/webhooks.js';
import namespacesRest from './routes/rest/namespaces.js';
import sendConfigurationsRest from './routes/rest/send-configurations.js';
import usersRest from './routes/rest/users.js';
import accountRest from './routes/rest/account.js';
import reportTemplatesRest from './routes/rest/report-templates.js';
import reportsRest from './routes/rest/reports.js';
import channelsRest from './routes/rest/channels.js';
import campaignsRest from './routes/rest/campaigns.js';
import triggersRest from './routes/rest/triggers.js';
import listsRest from './routes/rest/lists.js';
import formsRest from './routes/rest/forms.js';
import fieldsRest from './routes/rest/fields.js';
import importsRest from './routes/rest/imports.js';
import importRunsRest from './routes/rest/import-runs.js';
import sharesRest from './routes/rest/shares.js';
import segmentsRest from './routes/rest/segments.js';
import subscriptionsRest from './routes/rest/subscriptions.js';
import templatesRest from './routes/rest/templates.js';
import mosaicoTemplatesRest from './routes/rest/mosaico-templates.js';
import blacklistRest from './routes/rest/blacklist.js';
import editorsRest from './routes/rest/editors.js';
import filesRest from './routes/rest/files.js';
import settingsRest from './routes/rest/settings.js';
import index from './routes/index.js';
import interoperableErrors from '../shared/interoperable-errors.js';
import { RedisStore } from 'connect-redis';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// These are routes for the new React-based client

let isReady = false;
function setReady() {
    isReady = true;
}

hbs.registerPartials(__dirname + '/views/partials');
hbs.registerPartials(__dirname + '/views/subscription/partials/');

/**
 * We need this helper to make sure that we consume flash messages only
 * when we are able to actually display these. Otherwise we might end up
 * in a situation where we consume a flash messages but then comes a redirect
 * and the message is never displayed
 */
hbs.registerHelper('flash_messages', function () {
    if (typeof this.flash !== 'function') {
        return '';
    }

    const messages = this.flash();
    const response = [];

    // group messages by type
    for (const key in messages) {
        let el = '<div class="alert alert-' + key + ' alert-dismissible" role="alert"><button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button>';

        if (key === 'danger') {
            el += '<span class="glyphicon glyphicon-exclamation-sign" aria-hidden="true"></span> ';
        }

        let rows = [];

        for (const message of messages[key]) {
            rows.push(hbs.handlebars.escapeExpression(message).replace(/(\r\n|\n|\r)/gm, '<br>'));
        }

        if (rows.length > 1) {
            el += '<p>' + rows.join('</p>\n<p>') + '</p>';
        } else {
            el += rows.join('');
        }

        el += '</div>';

        response.push(el);
    }

    return new hbs.handlebars.SafeString(
        response.join('\n')
    );
});

async function createApp(appType) {
    const app = express();

    function install404Fallback(url) {
        app.use(url, (req, res, next) => {
            next(new interoperableErrors.NotFoundError());
        });

        app.use(url + '/*rest', (req, res, next) => {
            next(new interoperableErrors.NotFoundError());
        });
    }

    function useWith404Fallback(url, route) {
        app.use(url, route);
        install404Fallback(url);
    }

    // view engine setup
    app.set('views', path.join(__dirname, 'views'));
    app.set('view engine', 'hbs');

    // Handle proxies. Needed to resolve client IP
    if (config.www.proxy) {
        app.set('trust proxy', config.www.proxy);
    }

    // Do not expose software used
    app.disable('x-powered-by');

    app.use(compression());
    app.use(favicon(path.join(__dirname, '..', 'client', 'static', 'favicon.ico')));

    app.use(logger(config.www.log, {
        stream: {
            write: message => {
                message = (message || '').toString();
                if (message) {
                    log.info('HTTP', message.replace('\n', '').trim());
                }
            }
        }
    }));

    app.use(cookieParser());

    if (config.redis.enabled) {
        let redisClient = createClient({
            legacyMode: false,
            url: `redis://${config.redis.host}:${config.redis.port}`
        })
        redisClient.connect().catch(console.error)
        app.use(session({
            store: new RedisStore({ client: redisClient, ...config.redis }),
            secret: config.www.secret,
            saveUninitialized: false,
            resave: false
        }));
    } else {
        app.use(session({
            store: false,
            secret: config.www.secret,
            saveUninitialized: false,
            resave: false
        }));
    }

    app.use(expressLocale({
        priority: ['query', 'cookie', 'accept-language', 'default'],
        query: {
            name: 'locale'
        },
        cookie: {
            name: 'i18nextLng'
        },
        default: config.defaultLanguage
    }));

    app.use(flash());

    app.use(bodyParser.urlencoded({
        extended: true,
        limit: config.www.postSize
    }));

    app.use(bodyParser.text({
        limit: config.www.postSize
    }));

    app.use(bodyParser.json({
        limit: config.www.postSize
    }));

    app.use((req, res, next) => {
        if (isReady) {
            next();
        } else {
            res.status(500);
            res.render('error', {
                message: 'HCFMailer+ is starting. Try again after a few seconds.',
                error: {}
            });
        }
    });

    if (appType === AppType.TRUSTED) {
        passport.setupRegularAuth(app);
    } else if (appType === AppType.SANDBOXED) {
        app.use(passport.tryAuthByRestrictedAccessToken);
    }

    if (appType === AppType.TRUSTED || appType === AppType.SANDBOXED) {
        // Endpoint under /api are authenticated by access token
        app.all('/api', passport.authByAccessToken);
        app.all('/api/*rest', passport.authByAccessToken);
    }

    useWith404Fallback('/static', express.static(path.join(__dirname, '..', 'client', 'static')));

    // In development, proxy to Vite dev server; in production, serve vite dist
    if (process.env.NODE_ENV === 'development' && !(process.env.VITE_PREVIEW === 'true')) {


        const viteProxy = createProxyMiddleware({
            target: 'http://localhost:8080',
            changeOrigin: true,
            ws: true,
            pathFilter: (path) => path.startsWith('/client'),
            on: {
                error: (err) => {
                    log.warn('Vite dev server', 'Proxy error: %s', err.message);
                    log.warn('Vite dev server', 'Make sure Vite is running with: npm run dev:client');
                }
            }
        });

        app.use(viteProxy);

        // Static npm files: fonts served directly from node_modules in dev (viteStaticCopy only runs on build)
        useWith404Fallback('/webfonts', express.static(path.join(__dirname, '..', 'client', 'dist', 'webfonts')));
        useWith404Fallback('/static-npm/fontawesome', express.static(path.join(__dirname, '..', 'client', 'dist', 'webfonts')));
        useWith404Fallback('/static-npm/jquery.min.js', express.static(path.join(__dirname, '..', 'client', 'dist', 'jquery.min.js')));
        useWith404Fallback('/static-npm/popper.min.js', express.static(path.join(__dirname, '..', 'client', 'dist', 'popper.min.js')));
        useWith404Fallback('/static-npm/bootstrap.min.js', express.static(path.join(__dirname, '..', 'client', 'dist', 'bootstrap.min.js')));
        useWith404Fallback('/static-npm/coreui.min.js', express.static(path.join(__dirname, '..', 'client', 'dist', 'coreui.min.js')));
    } else {
        if (process.env.VITE_PREVIEW === 'true') {
            console.warn('Running in preview mode: serving pre-built client. Make sure to run "npm run build" after any change to the client code.');
        }
        // Production: serve vite dist
        useWith404Fallback('/client', express.static(path.join(__dirname, '..', 'client', 'dist')));
        useWith404Fallback('/webfonts', express.static(path.join(__dirname, '..', 'client', 'dist', 'webfonts')));
        useWith404Fallback('/static-npm/fontawesome', express.static(path.join(__dirname, '..', 'client', 'dist', 'webfonts')));
        useWith404Fallback('/static-npm/jquery.min.js', express.static(path.join(__dirname, '..', 'client', 'dist', 'jquery.min.js')));
        useWith404Fallback('/static-npm/popper.min.js', express.static(path.join(__dirname, '..', 'client', 'dist', 'popper.min.js')));
        useWith404Fallback('/static-npm/bootstrap.min.js', express.static(path.join(__dirname, '..', 'client', 'dist', 'bootstrap.min.js')));
        useWith404Fallback('/static-npm/coreui.min.js', express.static(path.join(__dirname, '..', 'client', 'dist', 'coreui.min.js')));
    }

    // Make sure flash messages are available
    // Currently, flash messages are used only from routes/subscription.js
    app.use((req, res, next) => {
        res.locals.flash = req.flash.bind(req);
        next();
    });

    // Marks the following endpoint to return JSON object when error occurs
    app.all('/api', (req, res, next) => {
        req.needsAPIJSONResponse = true;
        next();
    });
    app.all('/api/*rest', (req, res, next) => {
        req.needsAPIJSONResponse = true;
        next();
    });

    app.all('/rest', (req, res, next) => {
        req.needsRESTJSONResponse = true;
        next();
    });
    app.all('/rest/*rest', (req, res, next) => {
        req.needsRESTJSONResponse = true;
        next();
    });

    // Initializes the request context to be used for authorization
    app.use((req, res, next) => {
        req.context = contextHelpers.getRequestContext(req);
        next();
    });

    if (appType === AppType.PUBLIC) {
        useWith404Fallback('/subscription', subscription);
        useWith404Fallback('/links', links);
        useWith404Fallback('/archive', archive);
        useWith404Fallback('/files', files);
    }

    useWith404Fallback('/cpgs', await campaigns.getRouter(appType)); // This needs to be different from "campaigns", which is already used by the UI

    useWith404Fallback('/mosaico', await sandboxedMosaico.getRouter(appType));
    useWith404Fallback('/ckeditor', await sandboxedCKEditor.getRouter(appType));
    useWith404Fallback('/grapesjs', await sandboxedGrapesJS.getRouter(appType));
    useWith404Fallback('/codeeditor', await sandboxedCodeEditor.getRouter(appType));

    if (appType === AppType.TRUSTED || appType === AppType.SANDBOXED) {
        useWith404Fallback('/subscriptions', subscriptions);
        useWith404Fallback('/webhooks', webhooks);

        if (config.reports && config.reports.enabled === true) {
            useWith404Fallback('/rpts', reports); // This needs to be different from "reports", which is already used by the UI
        }

        useWith404Fallback('/quick-rpts', quickReports);

        // API endpoints
        useWith404Fallback('/api', api);

        // REST endpoints
        app.use('/rest', namespacesRest);
        app.use('/rest', sendConfigurationsRest);
        app.use('/rest', usersRest);
        app.use('/rest', accountRest);
        app.use('/rest', channelsRest);
        app.use('/rest', campaignsRest);
        app.use('/rest', triggersRest);
        app.use('/rest', listsRest);
        app.use('/rest', formsRest);
        app.use('/rest', fieldsRest);
        app.use('/rest', importsRest);
        app.use('/rest', importRunsRest);
        app.use('/rest', sharesRest);
        app.use('/rest', segmentsRest);
        app.use('/rest', subscriptionsRest);
        app.use('/rest', templatesRest);
        app.use('/rest', mosaicoTemplatesRest);
        app.use('/rest', blacklistRest);
        app.use('/rest', editorsRest);
        app.use('/rest', filesRest);
        app.use('/rest', settingsRest);

        if (config.reports && config.reports.enabled === true) {
            app.use('/rest', reportTemplatesRest);
            app.use('/rest', reportsRest);
        }
        install404Fallback('/rest');
        if (config.cas && config.cas.enabled === true) {
            app.get('/cas/login',
                passport.authenticateCas,
                function (req, res) {
                    res.redirect('/?cas-login-success');
                });
            app.get('/cas/logout', passport.logoutCas);
        }
    }

    app.use('/', await index.getRouter(appType));

    app.use((err, req, res, next) => {
        if (!err) {
            return next();
        }

        if (req.needsRESTJSONResponse) {
            const resp = {
                message: err.message,
                error: config.sendStacktracesToClient ? err : {}
            };

            if (err instanceof interoperableErrors.InteroperableError) {
                resp.type = err.type;
                resp.data = err.data;
            }

            log.verbose('HTTP', err);
            res.status(err.status || 500).json(resp);

        } else if (req.needsAPIJSONResponse) {
            const resp = {
                error: err.message || err,
                data: []
            };

            log.verbose('HTTP', err);
            return res.status(err.status || 500).json(resp);

        } else {
            // TODO: Render interoperable errors using a special client that does internationalization of the error message

            if (err instanceof interoperableErrors.NotLoggedInError) {
                return res.redirect(getTrustedUrl('/login?next=' + encodeURIComponent(req.originalUrl)));
            } else {
                let publicPath;
                if (appType === AppType.TRUSTED) {
                    publicPath = getTrustedUrl();
                } else if (appType === AppType.SANDBOXED) {
                    publicPath = getSandboxUrl();
                } else if (appType === AppType.PUBLIC) {
                    publicPath = getPublicUrl();
                }

                log.verbose('HTTP', err);
                res.status(err.status || 500);
                res.render('error', {
                    message: err.message,
                    error: config.sendStacktracesToClient ? err : {},
                    publicPath
                });
            }
        }
    });

    return app;
}

export { createApp };
export { setReady };

export default {
    createApp,
    setReady
};
