import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema
    .createTable('recordings', function(table) {
      table.increments('id').primary();
      table.integer('user_id').unsigned().notNullable();
      table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.string('name');
      table.timestamps(true, true);
    })
    .createTable('recording_segments', function(table) {
      table.increments('id').primary();
      table.integer('recording_id').unsigned().notNullable();
      table.foreign('recording_id').references('id').inTable('recordings').onDelete('CASCADE');
      table.string('type').notNullable();
      table.bigInteger('session_start_ms').notNullable();
      table.integer('duration_ms').notNullable();
      table.string('track_id').nullable();
      table.integer('track_start_ms').nullable();
      table.integer('track_end_ms').nullable();
      table.timestamps(true, true);
    });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema
    .dropTableIfExists('recording_segments')
    .dropTableIfExists('recordings');
} 