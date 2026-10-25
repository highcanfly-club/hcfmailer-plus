// Shrinks images uploaded from the template editors before they are stored (see file-helpers.installUploadHandler)
import gmBase from 'gm';
import bluebird from 'bluebird';
import fs from 'fs-extra';

const gm = gmBase.subClass({ imageMagick: true });

// Emails are 600 px wide: 1200 px keeps images sharp on high-density screens without bloating the message
const DEFAULT_MAX_IMAGE_WIDTH = 1200;
const MIN_IMAGE_WIDTH = 16;
const MAX_IMAGE_WIDTH = 2400;

// The editors may ask for a smaller size (?maxWidth=600 for half width, 128 for an icon...)
function getRequestedWidth(req) {
    const requested = Number.parseInt(req && req.query && req.query.maxWidth, 10);
    if (Number.isNaN(requested)) {
        return DEFAULT_MAX_IMAGE_WIDTH;
    }
    return Math.min(MAX_IMAGE_WIDTH, Math.max(MIN_IMAGE_WIDTH, requested));
}
const RESIZABLE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const KEPT_AS_IS_TYPES = new Set(['image/gif']);

export async function prepareUploadedImages(uploadedFiles, req) {
    const maxWidth = getRequestedWidth(req);

    for (const file of uploadedFiles) {
        if (KEPT_AS_IS_TYPES.has(file.mimetype)) {
            continue; // animated GIFs would lose their animation
        }
        if (!RESIZABLE_TYPES.has(file.mimetype)) {
            await Promise.all(uploadedFiles.map(f => fs.remove(f.path)));
            throw new Error('Unsupported image type: ' + file.mimetype + ' (use JPEG, PNG, WebP or GIF)');
        }

        const magick = gm(file.path).autoOrient().strip().resize(maxWidth, null, '>');
        if (file.mimetype === 'image/jpeg') {
            magick.quality(85);
        }
        await bluebird.promisify(magick.write.bind(magick))(file.path);
        file.size = (await fs.stat(file.path)).size;
    }
}

export default {
    prepareUploadedImages
};
