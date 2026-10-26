// "Draft campaign" tool: from an existing template or past campaign + a brief, produce a new draft campaign.
//
// Safety rules of this module:
//  - sources are read through the regular models with the caller's own context (namespace permissions apply);
//  - the model only ever sees text slots and returns text; the draft is built from *validated replacements* that are
//    re-checked against the structure of the content before being written (same links, same merge tags, same tags);
//  - nothing is sent: the campaign is created idle, with the source's lists kept for the user to review.
import { generate, resolveTier } from './features.js';
import { newMeter } from './session.js';
import { research as runResearch } from './tools.js';
import { extractSlots, prepare, validateFinal } from './slots.js';
import { renderContent } from './render.js';
import templates from '../../models/templates.js';
import campaigns from '../../models/campaigns.js';
import shares from '../../models/shares.js';
import { enforce, castToInteger } from '../helpers.js';
import { CampaignSource, CampaignType } from '../../../shared/campaigns.js';
import knex from '../knex.js';
import { base } from '../../../shared/templates.js';
import { getTrustedUrl, getSandboxUrl, getPublicUrl } from '../urls.js';

const SUPPORTED_EDITORS = ['emailbuilder', 'ckeditor5', 'grapesjs'];
const MAX_REPLACEMENTS = 500;

function describeContent(editorType, content) {
    enforce(SUPPORTED_EDITORS.includes(editorType), `Editor type "${editorType}" is not supported for AI drafts (supported: ${SUPPORTED_EDITORS.join(', ')})`);
    enforce(content && typeof content.source === 'string', 'The source has no editable content');
    return { editorType, source: content.source, style: content.style || '', sourceType: content.sourceType || 'html' };
}

async function loadSource(context, ref) {
    enforce(ref && (ref.type === 'template' || ref.type === 'campaign'), 'Invalid source');
    const id = castToInteger(ref.id);

    if (ref.type === 'template') {
        const tmpl = await templates.getById(context, id, false);
        return { kind: 'template', id, name: tmpl.name, namespace: tmpl.namespace, tagLanguage: tmpl.tag_language, ...describeContent(tmpl.type, tmpl.data) };
    }

    const campaign = await campaigns.getById(context, id, false);
    const sc = campaign.data && campaign.data.sourceCustom;
    enforce(sc && [CampaignSource.CUSTOM, CampaignSource.CUSTOM_FROM_TEMPLATE, CampaignSource.CUSTOM_FROM_CAMPAIGN].includes(campaign.source), 'This campaign has no editable content');
    return { kind: 'campaign', id, name: campaign.name, namespace: campaign.namespace, tagLanguage: sc.tag_language, campaign, ...describeContent(sc.type, sc.data) };
}

// Numbers and dates that the model wrote but that appear neither in the brief nor anywhere in the source:
// the most likely hallucinations, shown to the user as "to verify"
const FACT = /\d{1,2}\s*(?:h|:)\s*\d{0,2}|\d+(?:[.,]\d+)?\s*(?:€|eur|euros?|%|\$)|\d{1,2}(?:er)?\s+(?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)|\d{2,}/gi;

function unverifiedFacts(diff, brief, originalTexts) {
    const known = (brief + ' ' + originalTexts.join(' ')).toLowerCase().replace(/\s+/g, ' ');
    const warnings = [];
    for (const d of diff) {
        for (const token of new Set((d.after.replace(/<[^>]*>/g, ' ').match(FACT) || []).map(t => t.trim().toLowerCase().replace(/\s+/g, ' ')))) {
            if (!known.includes(token)) warnings.push({ id: d.id, token });
        }
    }
    return warnings;
}

async function preview(context, owner, { ref, brief, tier, meter = newMeter(), brand = '', useTools = true }) {
    const src = await loadSource(context, ref);

    // Optional research step: the model may consult (read-only, with the user's rights) other templates and campaigns
    let research = { notes: '', log: [] };
    if (useTools) {
        const researchTier = (await resolveTier(owner, 'correct', null)) || tier; // light task: the cheapest configured tier
        research = await runResearch(context, owner, { tier: researchTier, meter, brief, source: src, deps: { loadSource } });
    }

    const result = await generate(owner, { tier, meter, editorType: src.editorType, source: src.source, options: { brief, references: [], brand, research: research.notes } });
    meter.step('render');
    const originalTexts = extractSlots(src.editorType, src.source).slots.map(s => s.text);
    const { html } = await renderContent(src.editorType, result.source, src);
    return {
        source: { kind: src.kind, id: src.id, name: src.name, editorType: src.editorType, tagLanguage: src.tagLanguage },
        changed: result.changed,
        rejected: result.rejected,
        tier: result.tier,
        subject: result.subject || null,
        preheader: result.preheader || null,
        diff: result.diff,
        warnings: unverifiedFacts(result.diff, brief + ' ' + research.notes, originalTexts),
        research: research.log,
        // tags such as [URL_BASE] resolved so that the browser can show the images
        previewHtml: base(html, src.tagLanguage, getTrustedUrl(), getSandboxUrl(), getPublicUrl())
    };
}

// Checks the replacements against the structure of `source`; returns the map to apply and the number of refused ones
function validateReplacements(editorType, source, replacements) {
    enforce(replacements && typeof replacements === 'object' && !Array.isArray(replacements), 'Invalid replacements');
    const entries = Object.entries(replacements);
    enforce(entries.length <= MAX_REPLACEMENTS, 'Too many replacements');
    const parsed = extractSlots(editorType, source);
    const slots = new Map(prepare(parsed.slots).map(s => [s.id, s]));
    const valid = new Map();
    let refused = 0;
    for (const [id, text] of entries) {
        const slot = slots.get(id);
        const checked = slot ? validateFinal(slot, text) : null;
        if (checked === null) refused++;
        else valid.set(id, checked);
    }
    return { valid, refused, apply: () => parsed.apply(valid) };
}

// A template has no send configuration of its own: take one the user is allowed to use (the draft can be changed later)
async function pickSendConfiguration(context, namespace) {
    const rows = await knex('send_configurations').select('id', 'namespace').orderBy('id');
    const ordered = [...rows.filter(r => r.namespace === namespace), ...rows.filter(r => r.namespace !== namespace)];
    for (const row of ordered) {
        if (await shares.checkEntityPermission(context, 'sendConfiguration', row.id, 'viewPublic')) return row.id;
    }
    throw new Error('No send configuration is available to this user: create the campaign manually');
}

async function permittedLists(context, lists) {
    const kept = [];
    let skipped = 0;
    for (const l of lists || []) {
        if (await shares.checkEntityPermission(context, 'list', l.list, 'view')) kept.push({ list: l.list, segment: l.segment || null });
        else skipped++;
    }
    return { kept, skipped };
}

async function createDraft(context, { ref, replacements, name, subject }) {
    const src = await loadSource(context, ref);

    // 1. dry run on the source: refuse the whole draft if any replacement does not fit the content
    const dry = validateReplacements(src.editorType, src.source, replacements);
    enforce(dry.refused === 0, `${dry.refused} replacement(s) do not match the structure of the source`);

    // 2. clone with the standard mechanism (copies the files and rewrites their URLs), keeping the lists of a campaign
    const fromCampaign = src.kind === 'campaign';
    const lists = fromCampaign ? await permittedLists(context, src.campaign.lists) : { kept: [], skipped: 0 };
    const c = src.campaign;
    const title = String(name || `[Brouillon IA] ${src.name}`).slice(0, 255);
    const entity = {
        name: title,
        description: 'Brouillon généré par IA',
        namespace: src.namespace,
        type: CampaignType.REGULAR,
        source: fromCampaign ? CampaignSource.CUSTOM_FROM_CAMPAIGN : CampaignSource.CUSTOM_FROM_TEMPLATE,
        channel: null,
        send_configuration: fromCampaign ? c.send_configuration : await pickSendConfiguration(context, src.namespace),
        from_name_override: fromCampaign ? c.from_name_override : null,
        from_email_override: fromCampaign ? c.from_email_override : null,
        reply_to_override: fromCampaign ? c.reply_to_override : null,
        subject: String(subject || (fromCampaign ? c.subject : src.name) || '').slice(0, 255),
        click_tracking_disabled: fromCampaign ? c.click_tracking_disabled : false,
        open_tracking_disabled: fromCampaign ? c.open_tracking_disabled : false,
        unsubscribe_url: fromCampaign ? c.unsubscribe_url : '',
        lists: lists.kept,
        data: fromCampaign ? { sourceCampaign: src.id } : { sourceTemplate: src.id }
    };
    const id = await campaigns.create(context, entity);

    // 3. apply the replacements to the clone and render its html / text
    const created = await campaigns.getById(context, id, false);
    const sc = created.data.sourceCustom;
    const content = describeContent(sc.type, sc.data);
    const real = validateReplacements(content.editorType, content.source, replacements);
    const newData = { ...sc.data, source: real.apply() };
    const { html, text } = await renderContent(content.editorType, newData.source, { style: newData.style || '', sourceType: newData.sourceType || 'html' });
    await campaigns.updateWithConsistencyCheck(context, {
        id,
        data: { sourceCustom: { ...sc, data: newData, html, text } },
        originalHash: campaigns.hash(created, campaigns.Content.ONLY_SOURCE_CUSTOM)
    }, campaigns.Content.ONLY_SOURCE_CUSTOM);

    return { campaignId: id, name: title, listsKept: lists.kept.length, listsSkipped: lists.skipped, unmatched: real.refused };
}

export { preview, createDraft, loadSource, validateReplacements, unverifiedFacts, SUPPORTED_EDITORS };
