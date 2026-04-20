import config from 'config';

if (!config.roles) {
    config.roles = config.defaultRoles;
}

export default config;
