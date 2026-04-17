import knex from './knex.js';

function getRequestContext(req) {
    const context = {
        user: req.user
    };

    return context;
}

const adminContext = {
    user: {
        admin: true,
        id: 0,
        username: '',
        name: '',
        email: ''
    }
};

function getAdminContext() {
    return adminContext;
}

export { getRequestContext, getAdminContext };

export default {
    getAdminContext,
    getRequestContext
};
