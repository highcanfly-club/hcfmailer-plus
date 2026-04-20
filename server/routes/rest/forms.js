import { castToInteger } from '../../lib/helpers.js';
import passport from '../../lib/passport.js';
import lists from '../../models/lists.js';
import forms from '../../models/forms.js';
import fields from '../../models/fields.js';
import settings from '../../models/settings.js';
import tools from '../../lib/tools.js';
import contextHelpers from '../../lib/context-helpers.js';
import routerFactory from '../../lib/router-async.js'
const router = routerFactory.create();


router.postAsync('/forms-table', passport.loggedIn, async (req, res) => {
    return res.json(await forms.listDTAjax(req.context, req.body));
});

router.getAsync('/forms/:formId', passport.loggedIn, async (req, res) => {
    const entity = await forms.getById(req.context, castToInteger(req.params.formId));
    entity.hash = forms.hash(entity);
    return res.json(entity);
});

router.postAsync('/forms', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    return res.json(await forms.create(req.context, req.body));
});

router.putAsync('/forms/:formId', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    const entity = req.body;
    entity.id = castToInteger(req.params.formId);

    await forms.updateWithConsistencyCheck(req.context, entity);
    return res.json();
});

router.deleteAsync('/forms/:formId', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    await forms.remove(req.context, castToInteger(req.params.formId));
    return res.json();
});

router.postAsync('/forms-validate', passport.loggedIn, async (req, res) => {
    return res.json(await forms.serverValidate(req.context, req.body));
});

router.postAsync('/forms-preview', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    function sortAndFilterCustomFieldsBy(key) {
        data.customFields = data.customFields.filter(fld => fld[key] !== null);
        data.customFields.sort((a, b) => a[key] - b[key]);
    }

    const formKey = req.body.formKey;
    const listId = req.body.listId;

    const data = {};

    const list = await lists.getById(req.context, listId);
    data.title = list.name;
    data.cid = list.cid;

    data.isWeb = true;
    data.customFields = await fields.forHbs(req.context, listId, {});

    const configItems = await settings.get(contextHelpers.getAdminContext(), ['pgpPrivateKey']);
    data.hasPubkey = !!configItems.pgpPrivateKey;

    data.formInputStyle = req.body.formInputStyle;

    if (formKey === 'web_subscribe') {
        sortAndFilterCustomFieldsBy('order_subscribe');
    } else if (formKey === 'web_manage') {
        sortAndFilterCustomFieldsBy('order_manage');
    }

    const tmpl = {
        template: req.body.template,
        layout: req.body.layout,
        type: 'mjml'
    };

    const htmlRenderer = await tools.getTemplate(tmpl, req.locale);

    return res.json({content: htmlRenderer(data)});
});

export default router;