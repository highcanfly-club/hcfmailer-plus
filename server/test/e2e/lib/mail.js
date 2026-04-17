import config from './config.js';
import driver from './mocha-e2e.js';
import page from './page.js';


module.exports = (...extras) => page({

    async fetchMail(address) {
        await driver.sleep(1000);
        await driver.navigate().to(`${config.mailUrl}/${address}`);
        await this.waitUntilVisible();
    },

    async ensureUrl() {
        throw new Error('Unsupported method.');
    }

}, ...extras);
