/** @type {import('knex').Knex} */
exports.up = function(knex) {
  return knex.schema.createTable("users", (table) => {
    table.increments("id").primary();
    table.string("spotify_id").notNullable().unique();
    table.string("display_name").notNullable();
    table.string("email").unique(); // Email from Spotify might be null or not provided
    // We might add columns for access_token and refresh_token here later if needed,
    // ensuring they are encrypted.
    table.timestamps(true, true);
  });
};

/** @type {import('knex').Knex} */
exports.down = function(knex) {
  return knex.schema.dropTable("users");
}; 