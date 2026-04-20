import { renderCsvFromStream } from '../lib/report-helpers.js';
import { castToInteger } from '../lib/helpers.js';
import { SubscriptionStatus } from '../../shared/lists.js';
import { LinkId } from '../models/links.js';
import passport from '../lib/passport.js';
import shares from '../models/shares.js';
import contextHelpers from '../lib/context-helpers.js';
import reports from '../models/reports.js';
import campaigns from '../models/campaigns.js';
import knex from '../lib/knex.js';
import moment from 'moment';
import routerFactory from '../lib/router-async.js'
const router = routerFactory.create();


router.getAsync('/open-and-click-counts/:campaignId', passport.loggedIn, async (req, res) => {
    const campaignId = castToInteger(req.params.campaignId);

    await shares.enforceEntityPermission(req.context, 'campaign', campaignId, 'viewStats');
    const campaign = await campaigns.getById(req.context, campaignId, false);

    const listFields = await reports.getCampaignCommonListFields(campaign);

    const results = await reports.getCampaignStatisticsStream(
        campaign,
        ['subscription:email', 'open_tracker:count', 'click_tracker:count', 'open_tracker:country', 'open_tracker:created', 'open_tracker:deviceType', ...Object.keys(listFields)],
        [
            {type: 'links', prefix: 'open_tracker', onConditions: {link: knex.raw('?', [LinkId.OPEN])} },
            {type: 'links', prefix: 'click_tracker', onConditions: {link: knex.raw('?', [LinkId.GENERAL_CLICK])} }
        ],
        null,
        (qry, col) => qry
            .where(col('subscription:status'), SubscriptionStatus.SUBSCRIBED)
    );

    res.set({
        'Content-Disposition': `attachment;filename=campaign-open-and-click-counts-${campaign.cid}.csv`,
        'Content-Type': 'text/csv'
    });

    await renderCsvFromStream(
        results,
        res,
        {
            header: true,
            columns: [
                { key: 'subscription:email', header: 'Email' },
                { key: 'open_tracker:count', header: 'Open count' },
                { key: 'click_tracker:count', header: 'Click count' },
                { key: 'open_tracker:country', header: 'Country (first open)' },
                { key: 'open_tracker:created', header: 'Date/time (first open)' },
                { key: 'open_tracker:deviceType', header: 'Device type (first open)' },
                ...Object.keys(listFields).map(key => ({key, header: listFields[key].key}))
            ],
            delimiter: ','
        },
        async (row, encoding) => ({
                ...row,
                'open_tracker:created': moment(row['open_tracker:created']).toISOString()
            })
    );
});

export default router;
