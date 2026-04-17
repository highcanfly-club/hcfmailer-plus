import { castToInteger } from '../../lib/helpers.js';
import passport from '../../lib/passport.js';
import namespaces from '../../models/namespaces.js';
import routerFactory from '../../lib/router-async.js'
const router = routerFactory.create();


router.getAsync('/namespaces/:nsId', passport.loggedIn, async (req, res) => {
    const ns = await namespaces.getById(req.context, castToInteger(req.params.nsId));

    ns.hash = namespaces.hash(ns);

    return res.json(ns);
});

router.postAsync('/namespaces', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    return res.json(await namespaces.create(req.context, req.body));
});

router.putAsync('/namespaces/:nsId', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    const ns = req.body;
    ns.id = castToInteger(req.params.nsId);

    await namespaces.updateWithConsistencyCheck(req.context, ns);
    return res.json();
});

router.deleteAsync('/namespaces/:nsId', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    await namespaces.remove(req.context, castToInteger(req.params.nsId));
    return res.json();
});

router.getAsync('/namespaces-tree', passport.loggedIn, async (req, res) => {

    const tree = await namespaces.listTree(req.context);

    return res.json(tree);
});

export default router;
