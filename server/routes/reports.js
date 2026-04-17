import { castToInteger } from '../lib/helpers.js';
import passport from '../lib/passport.js';
import reports from '../models/reports.js';
import reportHelpers from '../lib/report-helpers.js';
import shares from '../models/shares.js';
import contextHelpers from '../lib/context-helpers.js';
import routerFactory from '../lib/router-async.js'
const router = routerFactory.create();


const fileSuffixes = {
    'text/html': '.html',
    'text/csv': '.csv'
};

router.getAsync('/:id/download', passport.loggedIn, async (req, res) => {
    const reportId = castToInteger(req.params.id);
    await shares.enforceEntityPermission(req.context, 'report', reportId, 'viewContent');

    const report = await reports.getByIdWithTemplate(contextHelpers.getAdminContext(), reportId, false);

    if (report.state == reports.ReportState.FINISHED) {
        const headers = {
            'Content-Disposition': 'attachment;filename=' + reportHelpers.nameToFileName(report.name) + (fileSuffixes[report.mime_type] || ''),
            'Content-Type': report.mime_type
        };

        res.sendFile(reportHelpers.getReportContentFile(report), {headers: headers});

    } else {
        return res.status(404).send('Report not found');
    }
});

export default router;
