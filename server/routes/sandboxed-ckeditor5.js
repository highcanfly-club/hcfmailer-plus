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
import { prepareUploadedImages } from '../lib/image-upload.js';

users.registerRestrictedAccessTokenMethod('ckeditor5', async ({entityTypeId, entityId}) => {
    if (entityTypeId === 'template') {
        const tmpl = await templates.getById(contextHelpers.getAdminContext(), entityId, false);

        if (tmpl.type === 'ckeditor5') {
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
            res.render('ckeditor5/root', {
                layout: 'ckeditor5/layout',
                reactCsrfToken: req.csrfToken(),
                mailtrainConfig: JSON.stringify(mailtrainConfig),
                isDev,
                scriptFiles: isDev
                    ? [
                        { src: getSandboxUrl('client/@vite/client'), type: 'module' },
                        { src: getSandboxUrl('client/src/lib/sandboxed-ckeditor5-root.jsx'), type: 'module' }
                    ]
                    : [{ src: getSandboxUrl('client/ckeditor5-root.js'), type: 'module' }],
                publicPath: getSandboxUrl()
            });
        });

        fileHelpers.installUploadHandler(router, '/upload/:type/:entityId', files.ReplacementBehavior.RENAME, null, 'file', resp => {
            return {
                files: resp.files.map(f => ({ name: f.name, url: f.url, size: f.size }))
            };
        }, prepareUploadedImages);
    }

    return router;
}

export { getRouter };

export default {
    getRouter
};
