import routerFactory from '../lib/router-async.js'
const router = routerFactory.create();
import messageSender from '../lib/message-sender.js';


router.get('/:campaign/:list/:subscription', (req, res, next) => {
    messageSender.getMessage(req.params.campaign, req.params.list, req.params.subscription)
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

export default router;
