import { castToInteger } from '../../lib/helpers.js';
import passport from '../../lib/passport.js';
import reports from '../../models/reports.js';
import reportProcessor from '../../lib/report-processor.js';
import reportHelpers from '../../lib/report-helpers.js';
import shares from '../../models/shares.js';
import contextHelpers from '../../lib/context-helpers.js';
import routerFactory from '../../lib/router-async.js'
const router = routerFactory.create();
import fs from 'fs-extra';


router.getAsync('/reports/:reportId', passport.loggedIn, async (req, res) => {
    const report = await reports.getByIdWithTemplate(req.context, castToInteger(req.params.reportId));
    report.hash = reports.hash(report);
    return res.json(report);
});

router.postAsync('/reports', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    return res.json(await reports.create(req.context, req.body));
});

router.putAsync('/reports/:reportId', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    const report = req.body;
    report.id = castToInteger(req.params.reportId);

    await reports.updateWithConsistencyCheck(req.context, report);
    return res.json();
});

router.deleteAsync('/reports/:reportId', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    await reports.remove(req.context, castToInteger(req.params.reportId));
    return res.json();
});

router.postAsync('/reports-table', passport.loggedIn, async (req, res) => {
    return res.json(await reports.listDTAjax(req.context, req.body));
});

router.postAsync('/report-start/:id', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    const id = castToInteger(req.params.id);

    await shares.enforceEntityPermission(req.context, 'report', id, 'execute');

    const report = await reports.getByIdWithTemplate(contextHelpers.getAdminContext(), id, false);
    await shares.enforceEntityPermission(req.context, 'reportTemplate', report.report_template, 'execute');

    await reportProcessor.start(id);
    res.json();
});

router.postAsync('/report-stop/:id', async (req, res) => {
    const id = castToInteger(req.params.id);

    await shares.enforceEntityPermission(req.context, 'report', id, 'execute');

    const report = await reports.getByIdWithTemplate(contextHelpers.getAdminContext(), id, false);
    await shares.enforceEntityPermission(req.context, 'reportTemplate', report.report_template, 'execute');

    await reportProcessor.stop(id);
    res.json();
});

router.getAsync('/report-content/:id', async (req, res) => {
    const id = castToInteger(req.params.id);

    await shares.enforceEntityPermission(req.context, 'report', id, 'viewContent');

    const report = await reports.getByIdWithTemplate(contextHelpers.getAdminContext(), id, false);
    const file = reportHelpers.getReportContentFile(report);

    if (await fs.pathExists(file)) {
        res.sendFile(file);
    } else {
        res.send('');
    }
});

router.getAsync('/report-output/:id', async (req, res) => {
    const id = castToInteger(req.params.id);

    await shares.enforceEntityPermission(req.context, 'report', id, 'viewOutput');

    const report = await reports.getByIdWithTemplate(contextHelpers.getAdminContext(), id, false);
    const file = reportHelpers.getReportOutputFile(report);

    if (await fs.pathExists(file)) {
        res.sendFile(file);
    } else {
        res.send('');
    }
});

export default router;