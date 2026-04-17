import { getTrustedUrl } from '../lib/urls.js';
import { AppType } from '../../shared/app.js';
import passport from '../lib/passport.js';
import clientHelpers from '../lib/client-helpers.js';
import routerFactory from '../lib/router-async.js';

async function getRouter(appType) {
    const router = routerFactory.create();

    if (appType === AppType.TRUSTED) {
        router.getAsync('/*', passport.csrfProtection, async (req, res) => {
            const mailtrainConfig = await clientHelpers.getAnonymousConfig(req.context, appType);
            if (req.user) {
                Object.assign(mailtrainConfig, await clientHelpers.getAuthenticatedConfig(req.context));
            }

            const isDev = process.env.NODE_ENV === 'development';
            res.render('root', {
                reactCsrfToken: req.csrfToken(),
                mailtrainConfig: JSON.stringify(mailtrainConfig),
                isDev,
                scriptFiles: isDev
                    ? [
                        { src: getTrustedUrl('client/@vite/client'), type: 'module' },
                        { src: getTrustedUrl('client/src/root.jsx'), type: 'module' }
                    ]
                    : [
                        { src: getTrustedUrl('client/root.js'), type: 'module' }
                    ],
                publicPath: getTrustedUrl()
            });
        });
    }

    return router;
}

export { getRouter };

export default {
    getRouter
};
