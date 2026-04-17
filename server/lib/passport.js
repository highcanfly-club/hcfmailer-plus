import { createRequire } from 'module';
import { nodeifyFunction, nodeifyPromise } from './nodeify.js';
import config from './config.js';
import log from './log.js';
import util from 'util';
import passport from 'passport';
import LocalStrategy from 'passport-local';
import csurf from 'csurf';
import bodyParser from 'body-parser';
import users from '../models/users.js';
import interoperableErrors from '../../shared/interoperable-errors.js';
import contextHelpers from './context-helpers.js';

const require = createRequire(import.meta.url);

const csrfProtection = csurf({ cookie: true });
const parseForm = bodyParser.urlencoded({
    extended: false,
    limit: config.www.postSize
});

let authMode = 'local';

let LdapStrategy;
let ldapStrategyOpts;
if (config.ldap.enabled) {
    const ldapProtocol = config.ldap.secure ? 'ldaps' : 'ldap';
    if (!config.ldap.method || config.ldap.method === 'ldapjs') {
        try {
            LdapStrategy = require('passport-ldapjs').Strategy;
            authMode = 'ldap';
            log.info('LDAP', 'Found module "passport-ldapjs". It will be used for LDAP auth.');

            ldapStrategyOpts = {
                server: {
                    url: ldapProtocol + '://' + config.ldap.host + ':' + config.ldap.port
                },
                base: config.ldap.baseDN,
                search: {
                    filter: config.ldap.filter,
                    attributes: [config.ldap.uidTag, config.ldap.nameTag, config.ldap.mailTag],
                    scope: 'sub'
                },
                uidTag: config.ldap.uidTag,
                bindUser: config.ldap.bindUser,
                bindPassword: config.ldap.bindPassword
            };

        } catch (exc) {
            log.info('LDAP', 'Module "passport-ldapjs" not installed. It will not be used for LDAP auth.');
        }
    }

    if (!LdapStrategy && (!config.ldap.method || config.ldap.method === 'ldapauth')) {
        try {
            LdapStrategy = require('passport-ldapauth').Strategy;
            authMode = 'ldapauth';
            log.info('LDAP', 'Found module "passport-ldapauth". It will be used for LDAP auth.');

            ldapStrategyOpts = {
                server: {
                    url: ldapProtocol + '://' + config.ldap.host + ':' + config.ldap.port,
                    searchBase: config.ldap.baseDN,
                    searchFilter: config.ldap.filter,
                    searchAttributes: [config.ldap.uidTag, config.ldap.nameTag, config.ldap.mailTag],
                    bindDN: config.ldap.bindUser,
                    bindCredentials: config.ldap.bindPassword
                }
            };
        } catch (exc) {
            log.info('LDAP', 'Module "passport-ldapauth" not installed. It will not be used for LDAP auth.');
        }
    }
}

const loggedIn = (req, res, next) => {
    if (!req.user) {
        next(new interoperableErrors.NotLoggedInError());
    } else {
        next();
    }
};

const authByAccessToken = (req, res, next) => {
    const accessToken = req.get('access-token') || req.query.access_token;

    if (!accessToken) {
        res.status(403);
        res.json({
            error: 'Missing access_token',
            data: []
        });
        return;
    }

    users.getByAccessToken(accessToken).then(user => {
        req.user = user;
        next();
    }).catch(err => {
        if (err instanceof interoperableErrors.PermissionDeniedError) {
            res.status(403);
            res.json({
                error: 'Invalid or expired access_token',
                data: []
            });
        } else {
            res.status(500);
            res.json({
                error: err.message || err,
                data: []
            });
        }
    });
};

const tryAuthByRestrictedAccessToken = (req, res, next) => {
    const pathComps = req.url.split('/');

    pathComps.shift();
    const restrictedAccessToken = pathComps.shift();
    pathComps.unshift('');

    const url = pathComps.join('/');

    req.url = url;

    users.getByRestrictedAccessToken(restrictedAccessToken).then(user => {
        req.user = user;
        next();
    }).catch(err => {
        next();
    });
};

const setupRegularAuth = (app) => {
    app.use(passport.initialize());
    app.use(passport.session());
};

const restLogout = (req, res) => {
    req.logout({}, () => { log.info(`User logged out`); });
    res.json();
};

const restLogin = (req, res, next) => {
    passport.authenticate(authMode, (err, user, info) => {
        if (err) {
            return next(err);
        }

        if (!user) {
            return next(new interoperableErrors.IncorrectPasswordError());
        }

        req.logIn(user, err => {
            if (err) {
                return next(err);
            }

            if (req.body.remember) {
                req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
            } else {
                req.session.cookie.expires = false;
            }

            return res.json();
        });
    })(req, res, next);
};

let CasStrategy;
if (config.cas && config.cas.enabled === true) {
    try {
        CasStrategy = require('passport-cas2').Strategy;
        authMode = 'cas';
        log.info('CAS', 'Found module "passport-cas2". It will be used for CAS auth.');
    } catch (exc) {
        log.info('CAS', 'Module passport-cas2 not installed.');
    }
}

let authMethod;
let isAuthMethodLocal;
let authenticateCas;
let logoutCas;

if (CasStrategy) {
    log.info('Using CAS auth (passport-cas2)');
    authMethod = 'cas';
    isAuthMethodLocal = false;

    const cas = new CasStrategy({
        casURL: config.cas.url,
        propertyMap: {
            displayName: config.cas.nameTag,
            emails: config.cas.mailTag
        }
    },
    nodeifyFunction(async (username, profile) => {
        try {
            const user = await users.getByUsername(username);

            log.info('CAS', 'Old User: ' + JSON.stringify(profile));
            return {
                id: user.id,
                username,
                name: profile.displayName,
                email: profile.emails[0].value,
                role: user.role
            };
        } catch (err) {
            if (err instanceof interoperableErrors.NotFoundError) {
                const userId = await users.create(contextHelpers.getAdminContext(), {
                    username,
                    role: config.cas.newUserRole,
                    namespace: config.cas.newUserNamespaceId,
                    name: profile.displayName,
                    email: profile.emails[0].value
                });
                log.info('CAS', 'New User: ' + JSON.stringify(profile));

                return {
                    id: userId,
                    username,
                    name: profile.displayName,
                    email: profile.emails[0].value,
                    role: config.cas.newUserRole
                };
            } else {
                throw err;
            }
        }
    }));
    passport.use(cas);
    passport.serializeUser((user, done) => done(null, user));
    passport.deserializeUser((user, done) => done(null, user));

    authenticateCas = passport.authenticate('cas', { failureRedirect: '/login?cas-login-error' });
    logoutCas = (req, res) => {
        cas.logout(req, res, config.www.trustedUrlBase + '/?cas-logout-success');
    };

} else if (LdapStrategy) {
    log.info('Using LDAP auth (passport-' + (authMode === 'ldap' ? 'ldapjs' : authMode) + ')');
    authMethod = 'ldap';
    isAuthMethodLocal = false;

    passport.use(new LdapStrategy(ldapStrategyOpts, nodeifyFunction(async profile => {
        try {
            const user = await users.getByUsername(profile[config.ldap.uidTag]);

            return {
                id: user.id,
                username: profile[config.ldap.uidTag],
                name: profile[config.ldap.nameTag],
                email: profile[config.ldap.mailTag],
                role: user.role
            };

        } catch (err) {
            if (err instanceof interoperableErrors.NotFoundError) {
                const userId = await users.create(contextHelpers.getAdminContext(), {
                    username: profile[config.ldap.uidTag],
                    role: config.ldap.newUserRole,
                    namespace: config.ldap.newUserNamespaceId
                });

                return {
                    id: userId,
                    username: profile[config.ldap.uidTag],
                    name: profile[config.ldap.nameTag],
                    email: profile[config.ldap.mailTag],
                    role: config.ldap.newUserRole
                };
            } else {
                throw err;
            }
        }
    })));

    passport.serializeUser((user, done) => done(null, user));
    passport.deserializeUser((user, done) => done(null, user));

} else {
    log.info('Using local auth');
    authMethod = 'local';
    isAuthMethodLocal = true;

    passport.use(new LocalStrategy(nodeifyFunction(async (username, password) => await users.getByUsernameIfPasswordMatch(contextHelpers.getAdminContext(), username, password))));

    passport.serializeUser((user, done) => done(null, user.id));
    passport.deserializeUser((id, done) => nodeifyPromise(users.getById(contextHelpers.getAdminContext(), id), done));
}

export default {
    csrfProtection,
    parseForm,
    loggedIn,
    authByAccessToken,
    tryAuthByRestrictedAccessToken,
    setupRegularAuth,
    restLogout,
    restLogin,
    authMethod,
    isAuthMethodLocal,
    authenticateCas,
    logoutCas
};
