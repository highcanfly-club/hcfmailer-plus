import { castToInteger } from '../lib/helpers.js';
import { SubscriptionStatus } from '../../shared/lists.js';
import passport from '../lib/passport.js';
import routerFactory from '../lib/router-async.js'
const router = routerFactory.create();
import subscriptions from '../models/subscriptions.js';
import { stringify } from 'csv-stringify';
import fields from '../models/fields.js';
import lists from '../models/lists.js';
import moment from 'moment';


router.getAsync('/export/:listId/:segmentId', passport.loggedIn, async (req, res) => {
    const statusStrings = {
        [SubscriptionStatus.SUBSCRIBED]: 'subscribed',
        [SubscriptionStatus.UNSUBSCRIBED]: 'unsubscribed',
        [SubscriptionStatus.BOUNCED]: 'bounced',
        [SubscriptionStatus.COMPLAINED]: 'complained'
    };

    const listId = castToInteger(req.params.listId);
    const segmentId = castToInteger(req.params.segmentId);

    const flds = await fields.list(req.context, listId);

    const columns = [
        { key: 'cid', header: 'cid' },
        { key: 'status', header: 'status' },
        { key: 'hash_email', header: 'HASH_EMAIL' },
        { key: 'email', header: 'EMAIL' },
    ];

    for (const fld of flds) {
        if (fld.column) {
            columns.push({
                key: fld.column,
                header: fld.key
            });
        }
    }

    const list = await lists.getById(req.context, listId);

    const headers = {
        'Content-Disposition': `attachment;filename=subscriptions-${list.cid}-${segmentId}-${moment().toISOString()}.csv`,
        'Content-Type': 'text/csv'
    };

    res.set(headers);

    const stringifier = stringify({
        columns,
        header: true,
        delimiter: ','
    });

    stringifier.pipe(res);

    for await (const subscription of subscriptions.listIterator(req.context, listId, segmentId, false)) {
        subscription.status = statusStrings[subscription.status];

        stringifier.write(subscription);
    }

    stringifier.end();
});

export default router;
