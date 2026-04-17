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

users.registerRestrictedAccessTokenMethod('codeeditor', async ({entityTypeId, entityId}) => {
    if (entityTypeId === 'template') {
        const tmpl = await templates.getById(contextHelpers.getAdminContext(), entityId, false);

        if (tmpl.type === 'codeeditor') {
            return {
                permissions: {
                    'template': {
                        [entityId]: new Set(['manageFiles', 'view'])
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

            res.render('ckeditor/root', {
                layout: 'ckeditor/layout',
                reactCsrfToken: req.csrfToken(),
                mailtrainConfig: JSON.stringify(mailtrainConfig),
                scriptFiles: [
                    getSandboxUrl('client/codeeditor-root.js')
                ],
                publicPath: getSandboxUrl()
            });
        });
    }

    return router;
}

export { getRouter };

export default {
    getRouter
};
