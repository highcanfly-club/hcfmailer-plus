import { castToInteger } from '../../lib/helpers.js';
import passport from '../../lib/passport.js';
import importRuns from '../../models/import-runs.js';
import routerFactory from '../../lib/router-async.js'
const router = routerFactory.create();


router.postAsync('/import-runs-table/:listId/:importId', passport.loggedIn, async (req, res) => {
    return res.json(await importRuns.listDTAjax(req.context, castToInteger(req.params.listId), castToInteger(req.params.importId), req.body));
});

router.postAsync('/import-run-failed-table/:listId/:importId/:importRunId', passport.loggedIn, async (req, res) => {
    return res.json(await importRuns.listFailedDTAjax(req.context, castToInteger(req.params.listId), castToInteger(req.params.importId), castToInteger(req.params.importRunId), req.body));
});

router.getAsync('/import-runs/:listId/:importId/:runId', passport.loggedIn, async (req, res) => {
    const entity = await importRuns.getById(req.context, castToInteger(req.params.listId), castToInteger(req.params.importId), castToInteger(req.params.runId));
    return res.json(entity);
});

export default router;