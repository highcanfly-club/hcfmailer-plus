function mergeTagValid(mergeTag) {
    return /^[A-Z][A-Z0-9_]*$/.test(mergeTag);
}

export { mergeTagValid };

export default {
    mergeTagValid
};
