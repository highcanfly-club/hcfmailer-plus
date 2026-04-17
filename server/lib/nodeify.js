import nodeify from 'nodeify';

const nodeifyPromise = nodeify;

const nodeifyFunction = (asyncFun) => {
    return (...args) => {
        const callback = args.pop();

        const promise = asyncFun(...args);

        return nodeifyPromise(promise, callback);
    };
};

export { nodeifyPromise, nodeifyFunction };

export default {
    nodeifyFunction,
    nodeifyPromise
};
