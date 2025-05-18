/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    .createTable('recordings', function(table) {
      table.increments('id').primary();
      table.integer('user_id').unsigned().notNullable();
      // Ensure 'users' table and 'id' column exist for the foreign key
      table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE'); 
      table.string('name');
      table.timestamps(true, true);
    })
    .createTable('recording_segments', function(table) {
      table.increments('id').primary();
      table.integer('recording_id').unsigned().notNullable();
      table.foreign('recording_id').references('id').inTable('recordings').onDelete('CASCADE');
      table.string('type').notNullable(); // e.g., 'PLAYBACK', 'SILENCE', 'USER_INTERACTION'
      table.bigInteger('session_start_ms').notNullable(); // Timestamp when the recording session started (for this segment)
      table.integer('duration_ms').notNullable();
      table.string('track_id').nullable(); // Spotify Track ID, if applicable
      table.integer('track_start_ms').nullable(); // Position within the track when segment started
      table.integer('track_end_ms').nullable();   // Position within the track when segment ended
      table.timestamps(true, true);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('recording_segments')
    .dropTableIfExists('recordings');
};
