/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('playlist_track_comments', function(table) {
    table.increments('id').primary();
    table.integer('playlist_id').unsigned().notNullable();
    table.foreign('playlist_id').references('playlists.id').onDelete('CASCADE'); // If playlist is deleted, comments are deleted
    table.integer('user_id').unsigned().notNullable();
    table.foreign('user_id').references('users.id').onDelete('CASCADE'); // If user is deleted, their comments are deleted
    table.string('track_uri').notNullable(); // e.g., "spotify:track:xxxxxxxxx"
    table.integer('timestamp_ms').notNullable(); // Time in milliseconds into the track
    table.text('comment_text').notNullable();
    table.timestamps(true, true); // Adds created_at and updated_at columns

    table.index(['playlist_id', 'track_uri']); // Index for faster querying of comments by playlist and track
    table.index('user_id'); // Index for faster querying of comments by user
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('playlist_track_comments');
}; 