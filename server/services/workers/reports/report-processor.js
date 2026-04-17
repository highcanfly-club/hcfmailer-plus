import { SubscriptionSource, SubscriptionStatus } from '../../../../shared/lists.js';
import { renderCsvFromStream } from '../../../lib/report-helpers.js';
import reports from '../../../models/reports.js';
import lists from '../../../models/lists.js';
import subscriptions from '../../../models/subscriptions.js';
import campaigns from '../../../models/campaigns.js';
import handlebars from 'handlebars';
import vm from 'vm';
import log from '../../../lib/log.js';
import knex from '../../../lib/knex.js';
import contextHelpers from '../../../lib/context-helpers.js';
import stream from 'stream';
import '../../../lib/fork.js';

async function main() {
    try {
        const context = contextHelpers.getAdminContext();

        const userFieldGetters = {
            'campaign': id => campaigns.getById(context, id, false, campaigns.Content.ALL),
            'list': id => lists.getById(context, id)
        };

        const reportId = Number(process.argv[2]);

        const report = await reports.getByIdWithTemplate(context, reportId, false);

        const inputs = {};

        for (const spec of report.user_fields) {
            const getter = userFieldGetters[spec.type];
            if (!getter) {
                throw new Error('Unknown user field type "' + spec.type + '".');
            }

            const entities = [];
            for (const id of report.params[spec.id]) {
                entities.push(await getter(id));
            }

            if (spec.minOccurences == 1 && spec.maxOccurences == 1) {
                inputs[spec.id] = entities[0];
            } else {
                inputs[spec.id] = entities;
            }
        }

        const campaignsProxy = {
            getCampaignStatistics: reports.getCampaignStatistics,
            getCampaignOpenStatistics: reports.getCampaignOpenStatistics,
            getCampaignClickStatistics: reports.getCampaignClickStatistics,
            getCampaignLinkClickStatistics: reports.getCampaignLinkClickStatistics,
            getCampaignStatisticsStream: reports.getCampaignStatisticsStream,
            getCampaignOpenStatisticsStream: reports.getCampaignOpenStatisticsStream,
            getCampaignClickStatisticsStream: reports.getCampaignClickStatisticsStream,
            getCampaignLinkClickStatisticsStream: reports.getCampaignLinkClickStatisticsStream,
            getById: campaignId => campaigns.getById(context, campaignId, false, campaigns.Content.ALL)
        };

        const subscriptionsProxy = {
            list: (listId, grouped, offset, limit) => subscriptions.list(context, listId, grouped, offset, limit)
        };

        const sandbox = {
            console,
            campaigns: campaignsProxy,
            subscriptions: subscriptionsProxy,
            stream,
            knex,
            process,
            inputs,
            SubscriptionSource,
            SubscriptionStatus,
            renderCsvFromStream: (readable, opts, transform) => renderCsvFromStream(readable, process.stdout, opts, transform),

            render: data => {
                const hbsTmpl = handlebars.compile(report.hbs);
                const reportText = hbsTmpl(data);

                process.stdout.write(reportText);
            }
        };

        const js =
            '(async function() {' +
            report.js +
            '})().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); })';

        const script = new vm.Script(js);

        script.runInNewContext(sandbox, {displayErrors: true, timeout: 120000});

    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

main();

