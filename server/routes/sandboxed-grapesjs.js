import { getTrustedUrl, getSandboxUrl, getPublicUrl } from '../lib/urls.js';
import { AppType } from '../../shared/app.js';
import routerFactory from '../lib/router-async.js';
import passport from '../lib/passport.js';
import clientHelpers from '../lib/client-helpers.js';
import users from '../models/users.js';
import files from '../models/files.js';
import fileHelpers from '../lib/file-helpers.js';
import templates from '../models/templates.js';
import contextHelpers from '../lib/context-helpers.js';

users.registerRestrictedAccessTokenMethod('grapesjs', async ({entityTypeId, entityId}) => {
    if (entityTypeId === 'template') {
        const tmpl = await templates.getById(contextHelpers.getAdminContext(), entityId, false);

        if (tmpl.type === 'grapesjs') {
            return {
                permissions: {
                    'template': {
                        [entityId]: new Set(['viewFiles', 'manageFiles', 'view'])
                    }
                }
            };
        }
    }
});

async function getRouter(appType) {
    const router = routerFactory.create();
    
    if (appType === AppType.SANDBOXED) {
        router.getAsync('/editor', passport.csrfProtection, async (req, res) => {
            const mailtrainConfig = await clientHelpers.getAnonymousConfig(req.context, appType);

            const isDev = process.env.NODE_ENV === 'development' && process.env.VITE_PREVIEW !== 'true';
            res.render('grapesjs/root', {
                layout: 'grapesjs/layout',
                reactCsrfToken: req.csrfToken(),
                mailtrainConfig: JSON.stringify(mailtrainConfig),
                isDev,
                scriptFiles: isDev
                    ? [
                        { src: getSandboxUrl('client/@vite/client'), type: 'module' },
                        { src: getSandboxUrl('client/src/lib/sandboxed-grapesjs-root.jsx'), type: 'module' }
                    ]
                    : [{ src: getSandboxUrl('client/grapesjs-root.js'), type: 'module' }],
                publicPath: getSandboxUrl()
            });
        });

        fileHelpers.installUploadHandler(router, '/upload/:type/:entityId', files.ReplacementBehavior.RENAME, null, 'file', resp => {
            return {
                data: resp.files.map( f => ({type: 'image', src: f.url}) )
            };
        });

    }

    return router;
}

export { getRouter };

export default {
    getRouter
};
