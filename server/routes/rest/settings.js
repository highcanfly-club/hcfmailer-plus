import passport from '../../lib/passport.js';
import settings from '../../models/settings.js';
import routerFactory from '../../lib/router-async.js'
const router = routerFactory.create();


router.getAsync('/settings', passport.loggedIn, async (req, res) => {
    const configItems = await settings.get(req.context);
    configItems.hash = settings.hash(configItems);
    return res.json(configItems);
});

router.putAsync('/settings', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    const configItems = req.body;
    await settings.set(req.context, configItems);
    return res.json();
});

export default router;