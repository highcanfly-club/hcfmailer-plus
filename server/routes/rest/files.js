import { castToInteger } from '../../lib/helpers.js';
import passport from '../../lib/passport.js';
import files from '../../models/files.js';
import routerFactory from '../../lib/router-async.js'
const router = routerFactory.create();
import fileHelpers from '../../lib/file-helpers.js';


router.postAsync('/files-table/:type/:subType/:entityId', passport.loggedIn, async (req, res) => {
    return res.json(await files.listDTAjax(req.context, req.params.type, req.params.subType, castToInteger(req.params.entityId), req.body));
});

router.getAsync('/files-list/:type/:subType/:entityId', passport.loggedIn, async (req, res) => {
    return res.json(await files.list(req.context, req.params.type, req.params.subType, castToInteger(req.params.entityId)));
});

router.getAsync('/files/:type/:subType/:fileId', passport.loggedIn, async (req, res) => {
    const file = await files.getFileById(req.context, req.params.type, req.params.subType, castToInteger(req.params.fileId));
    res.type(file.mimetype);
    return res.download(file.path, file.name);
});

router.deleteAsync('/files/:type/:subType/:fileId', passport.loggedIn, async (req, res) => {
    await files.removeFile(req.context, req.params.type, req.params.subType, castToInteger(req.params.fileId));
    return res.json();
});

fileHelpers.installUploadHandler(router, '/files/:type/:subType/:entityId');

export default router;