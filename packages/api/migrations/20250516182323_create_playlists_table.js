/** @type {import('knex').Knex} */
exports.up = function(knex) {
  return knex.schema.createTable("playlists", (table) => {
    table.increments("id").primary();
    table.string("spotify_id").notNullable().unique();
    table.string("name").notNullable();
    table.string("description");
    table.string("owner_id").notNullable();
    table.foreign("owner_id").references("spotify_id").inTable("users");
    table.timestamps(true, true);
  });
};

/** @type {import('knex').Knex} */
exports.down = function(knex) {
  return knex.schema.dropTable("playlists");
}; 