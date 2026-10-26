// Shared (administrator's) AI offered to users without their own key, with metering and a running balance per user.
// Money is stored in micro-euros (1e-6 EUR) so that token prices per million tokens are exact integers per token.
export const up = (knex) => (async () => {
    // owner of a model: a user (BYOK) or NULL (the shared AI)
    await knex.schema.alterTable('ai_models', table => {
        table.integer('user').unsigned().nullable().alter();
    });

    await knex.schema.createTable('ai_shared_settings', table => {
        table.integer('id').unsigned().primary();
        table.decimal('price_in', 12, 4).notNullable().defaultTo(10); // per 1M input tokens
        table.decimal('price_out', 12, 4).notNullable().defaultTo(4); // per 1M output tokens
        table.string('currency', 3).notNullable().defaultTo('EUR');
        table.decimal('max_outstanding', 12, 2).notNullable().defaultTo(0); // 0 = no limit
    });
    await knex('ai_shared_settings').insert({ id: 1 });

    await knex.schema.createTable('ai_user_prefs', table => {
        table.integer('user').unsigned().primary().references('users.id').onDelete('CASCADE');
        table.boolean('shared_accepted').notNullable().defaultTo(false);
        table.timestamp('accepted_at').nullable();
    });

    await knex.schema.createTable('ai_settlements', table => {
        table.increments('id').primary();
        table.integer('user').unsigned().notNullable().references('users.id').onDelete('CASCADE');
        table.bigInteger('amount_micro').unsigned().notNullable();
        table.bigInteger('input_tokens').unsigned().notNullable();
        table.bigInteger('output_tokens').unsigned().notNullable();
        table.integer('requests').unsigned().notNullable();
        table.integer('settled_by').unsigned().nullable();
        table.timestamp('created').defaultTo(knex.fn.now());
    });

    await knex.schema.createTable('ai_usage', table => {
        table.increments('id').primary();
        table.integer('user').unsigned().notNullable().references('users.id').onDelete('CASCADE');
        table.timestamp('created').defaultTo(knex.fn.now());
        table.string('action', 20).notNullable();
        table.string('tier', 10).notNullable();
        table.string('model', 255).notNullable().defaultTo('');
        table.integer('input_tokens').unsigned().notNullable().defaultTo(0);
        table.integer('output_tokens').unsigned().notNullable().defaultTo(0);
        table.boolean('estimated').notNullable().defaultTo(false);
        table.bigInteger('cost_micro').unsigned().notNullable().defaultTo(0);
        table.integer('settlement').unsigned().nullable().references('ai_settlements.id').onDelete('SET NULL');
        table.index(['user', 'settlement']);
    });
})();

export const down = (knex) => (async () => {
    await knex.schema.dropTableIfExists('ai_usage');
    await knex.schema.dropTableIfExists('ai_settlements');
    await knex.schema.dropTableIfExists('ai_user_prefs');
    await knex.schema.dropTableIfExists('ai_shared_settings');
})();
