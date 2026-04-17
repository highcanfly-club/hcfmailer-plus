import crypto from 'crypto';

function enforce(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function cleanupFromPost(value) {
    return (value || '').toString().trim();
}

function filterObject(obj, allowedKeys) {
    const result = {};
    for (const key in obj) {
        if (allowedKeys.has(key)) {
            result[key] = obj[key];
        }
    }

    return result;
}

function castToInteger(id, msg) {
    const val = parseInt(id);

    if (!Number.isInteger(val)) {
        throw new Error(msg || 'Invalid id');
    }

    return val;
}

function normalizeEmail(email) {
    const emailParts = email.split(/@/);

    if (emailParts.length !== 2) {
        return email;
    }

    const username = emailParts[0];
    const domain = emailParts[1].toLowerCase();

    return username + '@' + domain;
}

function hashEmail(email) {
    return crypto.createHash('sha512').update(normalizeEmail(email)).digest("base64");
}

export {
    enforce,
    cleanupFromPost,
    filterObject,
    castToInteger,
    normalizeEmail,
    hashEmail,
};

export default {
    castToInteger,
    cleanupFromPost,
    enforce,
    filterObject,
    hashEmail,
    normalizeEmail
};
