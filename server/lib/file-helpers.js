import { castToInteger } from './helpers.js';
import passport from './passport.js';
import files from '../models/files.js';
import path from 'path';
import multerFactory from 'multer';

const uploadedFilesDir = path.join(files.filesDir, 'uploaded');

const multer = multerFactory({
    dest: uploadedFilesDir
});

function installUploadHandler(router, url, replacementBehavior, type, subType, transformResponseFn) {
    router.postAsync(url, passport.loggedIn, multer.array('files[]'), async (req, res) => {
        return res.json(await files.createFiles(req.context, type || req.params.type, subType || req.params.subType, castToInteger(req.params.entityId), req.files, replacementBehavior, transformResponseFn));
    });
}

export { installUploadHandler, uploadedFilesDir };

export default {
    installUploadHandler,
    uploadedFilesDir
};
