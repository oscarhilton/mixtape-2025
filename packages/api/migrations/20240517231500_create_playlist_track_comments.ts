import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('playlist_track_comments', function(table) {
    table.increments('id').primary();
    table.integer('playlist_id').unsigned().notNullable();
    table.foreign('playlist_id').references('playlists.id').onDelete('CASCADE');
    table.integer('user_id').unsigned().notNullable();
    table.foreign('user_id').references('users.id').onDelete('CASCADE');
    table.string('track_uri').notNullable();
    table.integer('timestamp_ms').notNullable();
    table.text('comment_text').notNullable();
    table.timestamps(true, true);
    table.index(['playlist_id', 'track_uri']);
    table.index('user_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('playlist_track_comments');
} 