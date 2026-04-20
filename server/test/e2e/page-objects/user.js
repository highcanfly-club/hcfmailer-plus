import config from '../lib/config.js';
import web from '../lib/web.js';

export { login, url, elementsToWaitFor, elements, passwordInput, submitButton };
    }),

    logout: web({
        baseUrl: config.baseTrustedUrl,
        requestUrl: '/users/logout',
        url: '/'
    }),

    account: web({
        baseUrl: config.baseTrustedUrl,
        url: '/users/account',
        elementsToWaitFor: ['form'],
        elements: {
            form: 'form[action="/users/account"]',
            emailInput: 'form[action="/users/account"] input[name="email"]'
        }
    })
};

export default {
    elements,
    elementsToWaitFor,
    login,
    passwordInput,
    submitButton,
    url
};
