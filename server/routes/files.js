import routerFactory from '../lib/router-async.js'
const router = routerFactory.create();
import files from '../models/files.js';
import contextHelpers from '../lib/context-helpers.js';


router.getAsync('/:type/:subType/:entityId/:fileName', async (req, res) => {
    const file = await files.getFileByFilename(contextHelpers.getAdminContext(), req.params.type, req.params.subType, req.params.entityId, req.params.fileName);
    res.type(file.mimetype);
    return res.download(file.path, file.name);
});

export default router;
