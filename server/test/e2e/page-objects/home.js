import config from '../lib/config.js';
import web from '../lib/web.js';

export default web;({
    baseUrl: config.baseTrustedUrl,
    url: '/'
});
