// Per-user AI settings (BYOK): up to three models (basic, medium, high), each with its own list of API keys
export const up = (knex) => (async () => {
    await knex.schema.createTable('ai_models', table => {
        table.increments('id').primary();
        table.integer('user').unsigned().notNullable().references('users.id').onDelete('CASCADE');
        table.string('tier', 10).notNullable(); // basic | medium | high
        table.string('protocol', 20).notNullable(); // anthropic | openai | gemini | cohere | mistral
        table.string('base_url', 512).notNullable();
        table.string('model', 255).notNullable();
        table.string('key_mode', 12).notNullable().defaultTo('failover'); // failover | roundrobin
        table.integer('rr_counter').unsigned().notNullable().defaultTo(0);
        table.float('temperature').nullable();
        table.integer('max_tokens').unsigned().nullable();
        table.timestamp('created').defaultTo(knex.fn.now());
        table.unique(['user', 'tier']);
    });

    await knex.schema.createTable('ai_keys', table => {
        table.increments('id').primary();
        table.integer('model').unsigned().notNullable().references('ai_models.id').onDelete('CASCADE');
        table.string('label', 100).notNullable().defaultTo('');
        table.text('secret').notNullable(); // AES-256-GCM, never returned to clients
        table.string('last4', 8).notNullable().defaultTo('');
        table.integer('position').unsigned().notNullable().defaultTo(0);
        table.timestamp('cooldown_until').nullable();
        table.integer('uses').unsigned().notNullable().defaultTo(0);
        table.integer('failures').unsigned().notNullable().defaultTo(0);
        table.timestamp('created').defaultTo(knex.fn.now());
    });
})();

export const down = (knex) => (async () => {
    await knex.schema.dropTableIfExists('ai_keys');
    await knex.schema.dropTableIfExists('ai_models');
})();
