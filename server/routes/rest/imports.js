import { castToInteger } from '../../lib/helpers.js';
import { uploadedFilesDir } from '../../lib/file-helpers.js';
import passport from '../../lib/passport.js';
import imports from '../../models/imports.js';
import routerFactory from '../../lib/router-async.js'
const router = routerFactory.create();
import path from 'path';
import files from '../../models/files.js';
import multerFactory from 'multer';

const multer = multerFactory({
    dest: uploadedFilesDir
});

router.postAsync('/imports-table/:listId', passport.loggedIn, async (req, res) => {
    return res.json(await imports.listDTAjax(req.context, castToInteger(req.params.listId), req.body));
});

router.getAsync('/imports/:listId/:importId', passport.loggedIn, async (req, res) => {
    const entity = await imports.getById(req.context, castToInteger(req.params.listId), castToInteger(req.params.importId), true);
    entity.hash = imports.hash(entity);
    return res.json(entity);
});

const fileFields = [
    {name: 'csvFile', maxCount: 1}
];

router.postAsync('/imports/:listId', passport.loggedIn, passport.csrfProtection, multer.fields(fileFields), async (req, res) => {
    const entity = JSON.parse(req.body.entity);

    return res.json(await imports.create(req.context, castToInteger(req.params.listId), entity, req.files));
});

router.putAsync('/imports/:listId/:importId', passport.loggedIn, passport.csrfProtection, multer.fields(fileFields), async (req, res) => {
    const entity = JSON.parse(req.body.entity);
    entity.id = castToInteger(req.params.importId);

    await imports.updateWithConsistencyCheck(req.context, castToInteger(req.params.listId), entity, req.files);
    return res.json();
});

router.deleteAsync('/imports/:listId/:importId', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    await imports.remove(req.context, castToInteger(req.params.listId), castToInteger(req.params.importId));
    return res.json();
});

router.postAsync('/import-start/:listId/:importId', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    return res.json(await imports.start(req.context, castToInteger(req.params.listId), castToInteger(req.params.importId)));
});

router.postAsync('/import-stop/:listId/:importId', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    return res.json(await imports.stop(req.context, castToInteger(req.params.listId), castToInteger(req.params.importId)));
});

export default router;