import { AppType } from '../../shared/app.js';
import passport from '../lib/passport.js';
import routerFactory from '../lib/router-async.js';
import campaigns from '../models/campaigns.js';
import lists from '../models/lists.js';
import users from '../models/users.js';
import contextHelpers from '../lib/context-helpers.js';

users.registerRestrictedAccessTokenMethod('rssPreview', async ({campaignCid, listCid}) => {

    const campaign = await campaigns.getByCid(contextHelpers.getAdminContext(), campaignCid);
    const list = await lists.getByCid(contextHelpers.getAdminContext(), listCid);

    return {
        permissions: {
            'campaign': {
                [campaign.id]: new Set(['view'])
            },
            'list': {
                [list.id]: new Set(['view', 'viewTestSubscriptions'])
            }
        }
    };
});

async function getRouter(appType) {
    const router = routerFactory.create();

    if (appType === AppType.SANDBOXED) {

        router.get('/rss-preview/:campaign/:list/:subscription', passport.loggedIn, (req, res, next) => {
            campaigns.getRssPreview(req.context, req.params.campaign, req.params.list, req.params.subscription)
                .then(result => {
                    const {html} = result;

                    if (html.match(/<\/body\b/i)) {
                        res.render('partials/tracking-scripts', {
                            layout: 'archive/layout-raw'
                        }, (err, scripts) => {
                            if (err) {
                                return next(err);
                            }
                            const htmlWithScripts = scripts ? html.replace(/<\/body\b/i, match => scripts + match) : html;

                            res.render('archive/view', {
                                layout: 'archive/layout-raw',
                                message: htmlWithScripts
                            });
                        });

                    } else {
                        res.render('archive/view', {
                            layout: 'archive/layout-wrapped',
                            message: html
                        });
                    }

                })
                .catch(err => next(err));
        });
    }

    return router;
}

export { getRouter };

export default {
    getRouter
};
