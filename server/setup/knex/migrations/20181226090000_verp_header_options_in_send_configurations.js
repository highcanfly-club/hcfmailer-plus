export const up = (knex, Promise) => (async() => {
    await knex.schema.table('send_configurations', table => {
        table.boolean('verp_disable_sender_header').defaultTo(false);
    });
})();

export const down = (knex, Promise) => (async() => {
})();
