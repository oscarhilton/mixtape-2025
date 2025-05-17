import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable("users", (table) => {
    table.increments("id").primary();
    table.string("spotify_id").notNullable().unique();
    table.string("display_name").notNullable();
    table.string("email").unique(); // Email from Spotify might be null or not provided
    // We might add columns for access_token and refresh_token here later if needed,
    // ensuring they are encrypted.
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable("users");
}

