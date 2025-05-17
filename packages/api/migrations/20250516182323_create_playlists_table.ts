import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable("playlists", (table) => {
    table.increments("id").primary();
    table.string("name").notNullable();
    table.string("spotify_playlist_id").notNullable().unique();
    table.text("description");
    table.integer("votes").notNullable().defaultTo(0);
    table.decimal("latitude", 10, 8); // Precision of 10 digits with 8 decimal places
    table.decimal("longitude", 11, 8); // Precision of 11 digits with 8 decimal places
    table.timestamps(true, true); // Adds created_at and updated_at
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable("playlists");
}

