// Audit trail of the AI features that read other entities (draft campaigns): who used which source, for how many tokens,
// and which campaign was created. The content of prompts and replies is deliberately not stored. Kept one year.
export const up = (knex) => (async () => {
    await knex.schema.createTable('ai_audit', table => {
        table.increments('id').primary();
        table.integer('user').unsigned().notNullable().references('users.id').onDelete('CASCADE');
        table.timestamp('created').defaultTo(knex.fn.now());
        table.string('action', 30).notNullable(); // draft-preview | draft-create
        table.string('source_type', 20).nullable(); // template | campaign
        table.integer('source_id').unsigned().nullable();
        table.integer('campaign').unsigned().nullable(); // campaign created from the draft
        table.string('mode', 10).nullable(); // byok | shared
        table.string('tier', 10).nullable();
        table.integer('input_tokens').unsigned().notNullable().defaultTo(0);
        table.integer('output_tokens').unsigned().notNullable().defaultTo(0);
        table.text('details').nullable(); // JSON: counts, warnings, never the content
        table.index(['user', 'created']);
        table.index(['created']);
    });
})();

export const down = (knex) => knex.schema.dropTableIfExists('ai_audit');
