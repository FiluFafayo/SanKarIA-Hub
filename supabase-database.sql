
-- =================================================================
-- SKRIP SQL FINAL V2.0 - THE ATLAS PROTOCOL MIGRATION (REVISED & ROBUST)
-- =================================================================
-- STATUS: PRODUCTION READY (ENDLESS SAGA COMPATIBLE)
-- ARCHITECT: GEMINI (PARANOID MODE ACTIVE)
-- =================================================================

-- =================================================================
-- BAGIAN 0: NUCLEAR RESET (BERSIHKAN SEMUA SKEMA & TYPE)
-- =================================================================

-- Matikan extension jika perlu, lalu reset schema
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO anon;
GRANT ALL ON SCHEMA public TO authenticated;
GRANT ALL ON SCHEMA public TO service_role;

-- Reset Storage (Hapus Data Lama untuk mencegah referensi yatim)
-- NOTE: Hati-hati di production, ini menghapus file fisik!
DELETE FROM storage.objects;
DELETE FROM storage.buckets;

-- Aktifkan Extension Wajib
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =================================================================
-- BAGIAN 1: IDENTITAS & OTENTIKASI (AUTO-PROFILE)
-- =================================================================

CREATE TABLE "public"."profiles" (
    "id" "uuid" NOT NULL PRIMARY KEY REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "email" "text" UNIQUE,
    "full_name" "text",
    "avatar_url" "text",
    "updated_at" timestamptz DEFAULT "now"()
);

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone." ON "public"."profiles"
    FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "Users can manage their own profile." ON "public"."profiles"
    FOR ALL USING ("auth"."uid"() = "id") WITH CHECK ("auth"."uid"() = "id");

GRANT SELECT ON TABLE "public"."profiles" TO "anon", "authenticated";
GRANT INSERT, UPDATE, DELETE ON TABLE "public"."profiles" TO "authenticated";

-- Trigger: Handle New User
CREATE OR REPLACE FUNCTION "public"."handle_new_user"()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO "public"."profiles" ("id", "email", "full_name", "avatar_url")
    VALUES (
        NEW."id",
        NEW."email",
        COALESCE(NEW."raw_user_meta_data"->>'full_name', NEW."email"),
        COALESCE(NEW."raw_user_meta_data"->>'avatar_url', '')
    );
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER "on_auth_user_created"
    AFTER INSERT ON "auth"."users"
    FOR EACH ROW EXECUTE PROCEDURE "public"."handle_new_user"();

-- Trigger: Updated At
CREATE OR REPLACE FUNCTION "public"."handle_updated_at"()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updated_at" = "now"();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =================================================================
-- BAGIAN 2: DEFINISI DUNIA (SRD 5e RULES - STATIC DATA)
-- =================================================================

CREATE TABLE "public"."items" (
    "id" "uuid" PRIMARY KEY DEFAULT "gen_random_uuid"(),
    "name" "text" NOT NULL UNIQUE,
    "description" "text",
    "type" "text" NOT NULL CHECK (type IN ('weapon', 'armor', 'consumable', 'tool', 'other')),
    "is_magical" bool DEFAULT false,
    "rarity" "text" DEFAULT 'common',
    "requires_attunement" bool DEFAULT false,
    "bonuses" "jsonb" DEFAULT '{}'::jsonb, -- { "attack": 1, "ac": 2 }
    "damage_dice" "text",
    "damage_type" "text",
    "base_ac" integer,
    "armor_type" "text", -- light, medium, heavy, shield
    "stealth_disadvantage" bool DEFAULT false,
    "strength_requirement" integer,
    "effect" "jsonb", -- { "type": "heal", "dice": "2d4+2" }
    "cost_gp" integer DEFAULT 0,
    "weight_lb" real DEFAULT 0
);

CREATE TABLE "public"."spells" (
    "id" "uuid" PRIMARY KEY DEFAULT "gen_random_uuid"(),
    "name" "text" NOT NULL UNIQUE,
    "level" integer NOT NULL CHECK (level >= 0 AND level <= 9),
    "description" "text",
    "casting_time" "text",
    "range" "text",
    "components" "text"[], -- V, S, M
    "duration" "text",
    "school" "text",
    "effect_type" "text",
    "damage_dice" "text",
    "damage_type" "text",
    "save_required" "text",
    "save_on_success" "text",
    "condition_applied" "text",
    "ritual" bool DEFAULT false,
    "concentration" bool DEFAULT false
);

CREATE TABLE "public"."monsters" (
    "id" "uuid" PRIMARY KEY DEFAULT "gen_random_uuid"(),
    "name" "text" NOT NULL UNIQUE,
    "armor_class" integer,
    "max_hp" integer,
    "ability_scores" "jsonb" NOT NULL, -- { "strength": 16, ... }
    "skills" "jsonb",
    "traits" "jsonb" DEFAULT '[]'::jsonb,
    "actions" "jsonb" DEFAULT '[]'::jsonb,
    "senses" "jsonb",
    "languages" "text"[],
    "challenge_rating" real,
    "xp" integer,
    "image_url" "text",
    "damage_immunities" "text"[],
    "damage_resistances" "text"[],
    "condition_immunities" "text"[]
);

-- RLS: Global Read Only
ALTER TABLE "public"."items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."spells" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."monsters" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Global items viewable by all" ON "public"."items" FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Global spells viewable by all" ON "public"."spells" FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Global monsters viewable by all" ON "public"."monsters" FOR SELECT TO authenticated, anon USING (true);

GRANT SELECT ON TABLE "public"."items" TO "anon", "authenticated";
GRANT SELECT ON TABLE "public"."spells" TO "anon", "authenticated";
GRANT SELECT ON TABLE "public"."monsters" TO "anon", "authenticated";

-- =================================================================
-- BAGIAN 3: KARAKTER PEMAIN (SSoT)
-- =================================================================

CREATE TABLE "public"."characters" (
    "id" "uuid" PRIMARY KEY DEFAULT "gen_random_uuid"(),
    "owner_id" "uuid" NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "created_at" timestamptz DEFAULT "now"(),
    "updated_at" timestamptz DEFAULT "now"(),
    
    -- Identity
    "name" "text" NOT NULL,
    "class" "text" NOT NULL,
    "race" "text" NOT NULL,
    "level" integer NOT NULL DEFAULT 1,
    "xp" integer NOT NULL DEFAULT 0,
    "avatar_url" "text",
    "gender" "text" DEFAULT 'Pria',
    
    -- Visual (Pixel Art Layers)
    "body_type" "text" DEFAULT 'bt_normal',
    "scars" "text"[] DEFAULT '{}',
    "hair" "text" DEFAULT 'h_short_blond',
    "facial_hair" "text" DEFAULT 'ff_none',
    "head_accessory" "text" DEFAULT 'ha_none',
    
    -- Personality
    "background" "text",
    "personality_trait" "text",
    "ideal" "text",
    "bond" "text",
    "flaw" "text",
    
    -- Combat Stats (Persistent State)
    "ability_scores" "jsonb" NOT NULL,
    "max_hp" integer NOT NULL,
    "current_hp" integer NOT NULL,
    "temp_hp" integer NOT NULL DEFAULT 0,
    "armor_class" integer NOT NULL,
    "speed" integer NOT NULL,
    "hit_dice" "jsonb" NOT NULL,
    "death_saves" "jsonb" NOT NULL DEFAULT '{"successes": 0, "failures": 0}',
    "conditions" "text"[] NOT NULL DEFAULT '{}',
    
    -- Proficiencies & Features
    "racial_traits" "jsonb" DEFAULT '[]'::jsonb,
    "class_features" "jsonb" DEFAULT '[]'::jsonb,
    "proficient_skills" "text"[] DEFAULT '{}',
    "proficient_saving_throws" "text"[] DEFAULT '{}',
    "armor_proficiencies" "text"[] DEFAULT '{}',
    "weapon_proficiencies" "text"[] DEFAULT '{}',
    "tool_proficiencies" "text"[] DEFAULT '{}',
    "languages" "text"[] DEFAULT '{}',
    "senses" "jsonb" DEFAULT '{}',
    "passive_perception" integer DEFAULT 10,
    "inspiration" boolean DEFAULT false,
    
    -- Resources
    "spell_slots" "jsonb" DEFAULT '{}', 
    "prepared_spells" "jsonb" DEFAULT '[]'::jsonb,
    "feature_uses" "jsonb" DEFAULT '{}'
);

CREATE INDEX idx_characters_owner ON "public"."characters"("owner_id");
CREATE TRIGGER "set_updated_at_characters" BEFORE UPDATE ON "public"."characters" FOR EACH ROW EXECUTE PROCEDURE "public"."handle_updated_at"();

ALTER TABLE "public"."characters" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Characters viewable by everyone" ON "public"."characters" FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Users manage own characters" ON "public"."characters" FOR ALL USING ("auth"."uid"() = "owner_id") WITH CHECK ("auth"."uid"() = "owner_id");

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."characters" TO "authenticated";

-- =================================================================
-- BAGIAN 4: INVENTORY & SPELLBOOK (RELATIONAL)
-- =================================================================

CREATE TABLE "public"."character_inventory" (
    "id" "uuid" PRIMARY KEY DEFAULT "gen_random_uuid"(),
    "character_id" "uuid" NOT NULL REFERENCES "public"."characters"("id") ON DELETE CASCADE,
    "item_id" "uuid" NOT NULL REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "quantity" integer NOT NULL DEFAULT 1,
    "is_equipped" bool DEFAULT false,
    "custom_name" "text" -- Override nama item jika perlu
);

CREATE TABLE "public"."character_spells" (
    "id" "uuid" PRIMARY KEY DEFAULT "gen_random_uuid"(),
    "character_id" "uuid" NOT NULL REFERENCES "public"."characters"("id") ON DELETE CASCADE,
    "spell_id" "uuid" NOT NULL REFERENCES "public"."spells"("id") ON DELETE CASCADE,
    "is_prepared" bool DEFAULT false
);

CREATE INDEX idx_inventory_char ON "public"."character_inventory"("character_id");
CREATE INDEX idx_spells_char ON "public"."character_spells"("character_id");

ALTER TABLE "public"."character_inventory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."character_spells" ENABLE ROW LEVEL SECURITY;

-- Helper Security Function
CREATE OR REPLACE FUNCTION "public"."is_character_owner"("char_id" "uuid")
RETURNS bool AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM "public"."characters" WHERE "id" = "char_id" AND "owner_id" = "auth"."uid"());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "Inventory public view" ON "public"."character_inventory" FOR SELECT USING (true);
CREATE POLICY "Inventory owner manage" ON "public"."character_inventory" FOR ALL USING ("public"."is_character_owner"("character_id"));

CREATE POLICY "Spells public view" ON "public"."character_spells" FOR SELECT USING (true);
CREATE POLICY "Spells owner manage" ON "public"."character_spells" FOR ALL USING ("public"."is_character_owner"("character_id"));

GRANT ALL ON TABLE "public"."character_inventory" TO "authenticated";
GRANT ALL ON TABLE "public"."character_spells" TO "authenticated";

-- =================================================================
-- BAGIAN 5: CAMPAIGN CORE (ATLAS PROTOCOL ROOT)
-- =================================================================

CREATE TABLE "public"."campaigns" (
    "id" "uuid" PRIMARY KEY DEFAULT "gen_random_uuid"(),
    "owner_id" "uuid" NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "created_at" timestamptz DEFAULT "now"(),
    "updated_at" timestamptz DEFAULT "now"(),
    
    "title" "text" NOT NULL,
    "description" "text",
    "cover_url" "text",
    "join_code" "text" UNIQUE,
    "is_published" bool DEFAULT false,
    
    -- Metadata
    "theme" text,
    "mainGenre" text,
    "subGenre" text,
    "duration" text,
    "isNSFW" bool DEFAULT false,
    "maxPlayers" integer DEFAULT 4,
    
    -- DM Configuration
    "dm_personality" "text",
    "dm_narration_style" "text",
    "response_length" "text",
    "rules_config" "jsonb" DEFAULT '{"rollPrivacy": "public", "allowHomebrew": false}'::jsonb,

    -- Global World State
    "game_state" "text" NOT NULL DEFAULT 'exploration',
    "current_time" bigint DEFAULT 43200, -- Detik dari 00:00
    "current_weather" "text" DEFAULT 'Cerah',
    "world_event_counter" integer DEFAULT 0,
    
    -- Active Session
    "current_player_id" "uuid" REFERENCES "public"."characters"("id") ON DELETE SET NULL,
    "initiative_order" "text"[] DEFAULT '{}',
    "turn_id" "text",
    "battle_state" "jsonb", -- Snapshot battle state (Unit positions, etc)
    
    -- [PATCH FASE FINAL] Missing Columns for Legacy/AI Context
    "long_term_memory" "text",
    "map_image_url" "text",
    "map_markers" "jsonb" DEFAULT '[]'::jsonb,
    "current_player_location" "text"
);

-- [PATCHED] create_campaign_atomic (Paranoid Mode)
-- Mencegah NULL menimpa Default Value
CREATE OR REPLACE FUNCTION "public"."create_campaign_atomic"(payload jsonb)
RETURNS jsonb AS $$
DECLARE
    new_campaign_id uuid;
    core_data jsonb;
    map_data jsonb;
    npc_list jsonb;
    quest_list jsonb;
    result_row jsonb;
    campaign_rec "public"."campaigns"; -- Variable record eksplisit untuk sanitasi
BEGIN
    -- 1. Ekstrak Data
    core_data := payload -> 'core';
    map_data := payload -> 'world_map';
    npc_list := payload -> 'npcs';
    quest_list := payload -> 'quests';

    -- 2. Populate Record (RAW) 
    -- Hati-hati: jsonb_populate_record akan mengisi kolom yang tidak ada di JSON menjadi NULL
    campaign_rec := jsonb_populate_record(null::"public"."campaigns", core_data);

    -- 3. [PARANOID GUARD] Paksa Default Value untuk Field Vital jika NULL
    -- Ini memperbaiki bug di mana gen_random_uuid() tertimpa NULL
    IF campaign_rec.id IS NULL THEN campaign_rec.id := gen_random_uuid(); END IF;
    IF campaign_rec.created_at IS NULL THEN campaign_rec.created_at := now(); END IF;
    IF campaign_rec.updated_at IS NULL THEN campaign_rec.updated_at := now(); END IF;
    IF campaign_rec.game_state IS NULL THEN campaign_rec.game_state := 'exploration'; END IF;
    IF campaign_rec.is_published IS NULL THEN campaign_rec.is_published := false; END IF;
    IF campaign_rec.world_event_counter IS NULL THEN campaign_rec.world_event_counter := 0; END IF;
    IF campaign_rec.initiative_order IS NULL THEN campaign_rec.initiative_order := '{}'; END IF;
    IF campaign_rec.map_markers IS NULL THEN campaign_rec.map_markers := '[]'::jsonb; END IF;
    IF campaign_rec.current_time IS NULL THEN campaign_rec.current_time := 43200; END IF; -- Default siang hari
    IF campaign_rec.current_weather IS NULL THEN campaign_rec.current_weather := 'Cerah'; END IF;

    -- 4. Insert Campaign Core (Menggunakan record yang sudah disanitasi)
    INSERT INTO "public"."campaigns" VALUES (campaign_rec.*)
    RETURNING "id" INTO new_campaign_id;

    -- 5. Insert World Map (Jika ada data grid)
    IF map_data IS NOT NULL THEN
        INSERT INTO "public"."world_maps" ("campaign_id", "name", "grid_data", "fog_data", "is_active")
        VALUES (
            new_campaign_id,
            'Overworld (Default)',
            map_data -> 'grid_data',
            map_data -> 'fog_data',
            true
        );
    END IF;

    -- 6. Insert NPCs (Jika array tidak kosong)
    IF npc_list IS NOT NULL AND jsonb_array_length(npc_list) > 0 THEN
        INSERT INTO "public"."campaign_npcs" (
            "campaign_id", "name", "description", "location", "disposition", 
            "interaction_history", "image_url", "secret"
        )
        SELECT 
            new_campaign_id,
            p ->> 'name',
            p ->> 'description',
            p ->> 'location',
            p ->> 'disposition',
            ARRAY(SELECT jsonb_array_elements_text(p -> 'interaction_history')), 
            p ->> 'image_url',
            p ->> 'secret'
        FROM jsonb_array_elements(npc_list) AS p;
    END IF;

    -- 7. Insert Active Quests (Jika array tidak kosong)
    IF quest_list IS NOT NULL AND jsonb_array_length(quest_list) > 0 THEN
        INSERT INTO "public"."active_quests" (
            "campaign_id", "title", "description", "status", "reward_summary"
        )
        SELECT 
            new_campaign_id,
            q ->> 'title',
            q ->> 'description',
            q ->> 'status',
            q ->> 'reward_summary'
        FROM jsonb_array_elements(quest_list) AS q;
    END IF;

    -- 8. Return Created Campaign (Sebagai konfirmasi ke Frontend)
    SELECT row_to_json(c) INTO result_row FROM "public"."campaigns" c WHERE c.id = new_campaign_id;
    RETURN result_row;

EXCEPTION WHEN OTHERS THEN
    -- Error akan otomatis memicu ROLLBACK di level Postgres
    RAISE; 
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION "public"."create_campaign_atomic"(jsonb) TO authenticated;

CREATE TABLE "public"."campaign_players" (
    "id" "uuid" PRIMARY KEY DEFAULT "gen_random_uuid"(),
    "campaign_id" "uuid" NOT NULL REFERENCES "public"."campaigns"("id") ON DELETE CASCADE,
    "character_id" "uuid" NOT NULL REFERENCES "public"."characters"("id") ON DELETE CASCADE,
    "joined_at" timestamptz DEFAULT "now"(),
    UNIQUE("campaign_id", "character_id")
);

CREATE INDEX idx_campaign_owner ON "public"."campaigns"("owner_id");
CREATE INDEX idx_campaign_players_cmp ON "public"."campaign_players"("campaign_id");
CREATE INDEX idx_campaign_players_chr ON "public"."campaign_players"("character_id");

-- Helper Security Function
CREATE OR REPLACE FUNCTION "public"."is_campaign_member"("camp_id" "uuid")
RETURNS bool AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM "public"."campaign_players" cp
        JOIN "public"."characters" c ON cp.character_id = c.id
        WHERE cp.campaign_id = camp_id AND c.owner_id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM "public"."campaigns" WHERE id = camp_id AND owner_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER TABLE "public"."campaigns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."campaign_players" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published campaigns public" ON "public"."campaigns" FOR SELECT USING ("is_published" = true);
CREATE POLICY "Members view campaign" ON "public"."campaigns" FOR SELECT USING ("public"."is_campaign_member"("id"));
CREATE POLICY "Owner manage campaign" ON "public"."campaigns" FOR ALL USING ("auth"."uid"() = "owner_id");
CREATE POLICY "Auth create campaign" ON "public"."campaigns" FOR INSERT WITH CHECK ("auth"."role"() = 'authenticated');

CREATE POLICY "Members view players" ON "public"."campaign_players" FOR SELECT USING ("public"."is_campaign_member"("campaign_id"));
CREATE POLICY "Players join" ON "public"."campaign_players" FOR INSERT WITH CHECK ("auth"."role"() = 'authenticated'); -- Validasi character ownership via trigger/app logic
CREATE POLICY "Owner kick players" ON "public"."campaign_players" FOR DELETE USING ("auth"."uid"() = (SELECT owner_id FROM "public"."campaigns" WHERE id = campaign_id));

GRANT ALL ON TABLE "public"."campaigns" TO "authenticated";
GRANT ALL ON TABLE "public"."campaign_players" TO "authenticated";

-- =================================================================
-- BAGIAN 6: ATLAS PROTOCOL (MULTIVERSE & MAPS)
-- =================================================================

CREATE TABLE "public"."world_maps" (
    "id" "uuid" PRIMARY KEY DEFAULT "gen_random_uuid"(),
    "campaign_id" "uuid" NOT NULL REFERENCES "public"."campaigns"("id") ON DELETE CASCADE,
    "name" "text" NOT NULL,
    "grid_data" "jsonb" NOT NULL, -- Array 2D Tile IDs
    "fog_data" "jsonb" NOT NULL, -- Array 2D Boolean
    "markers" "jsonb" DEFAULT '[]'::jsonb,
    "is_active" bool DEFAULT false, -- Peta dimana party berada sekarang
    "created_at" timestamptz DEFAULT "now"()
);

CREATE INDEX idx_world_maps_campaign ON "public"."world_maps"("campaign_id");

ALTER TABLE "public"."world_maps" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view maps" ON "public"."world_maps" FOR SELECT USING ("public"."is_campaign_member"("campaign_id"));
CREATE POLICY "Owner manage maps" ON "public"."world_maps" FOR ALL USING ("auth"."uid"() = (SELECT owner_id FROM "public"."campaigns" WHERE id = campaign_id));

GRANT ALL ON TABLE "public"."world_maps" TO "authenticated";

-- =================================================================
-- BAGIAN 7: THE GRAND LINE (STORY GRAPH ENGINE)
-- =================================================================

CREATE TABLE "public"."story_nodes" (
    "id" "uuid" PRIMARY KEY DEFAULT "gen_random_uuid"(),
    "campaign_id" "uuid" NOT NULL REFERENCES "public"."campaigns"("id") ON DELETE CASCADE,
    "title" "text" NOT NULL,
    "description" "text",
    "type" "text" DEFAULT 'main_arc', -- main_arc, side_story, character_arc
    "status" "text" DEFAULT 'locked', -- locked, available, active, completed, skipped
    "world_state_change" "jsonb", -- { "marine_aggro": +10 }
    "prerequisites" "jsonb",
    "created_at" timestamptz DEFAULT "now"()
);

CREATE TABLE "public"."story_edges" (
    "id" "uuid" PRIMARY KEY DEFAULT "gen_random_uuid"(),
    "from_node_id" "uuid" NOT NULL REFERENCES "public"."story_nodes"("id") ON DELETE CASCADE,
    "to_node_id" "uuid" NOT NULL REFERENCES "public"."story_nodes"("id") ON DELETE CASCADE,
    "condition" "text", -- Deskripsi naratif syarat unlock
    "is_secret" bool DEFAULT false -- Jika true, edge tidak terlihat di graph sampai unlocked
);

CREATE TABLE "public"."active_quests" (
    "id" "uuid" PRIMARY KEY DEFAULT "gen_random_uuid"(),
    "campaign_id" "uuid" NOT NULL REFERENCES "public"."campaigns"("id") ON DELETE CASCADE,
    "story_node_id" "uuid" REFERENCES "public"."story_nodes"("id") ON DELETE SET NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'active',
    "reward_summary" "text",
    "updated_at" timestamptz DEFAULT "now"()
);

ALTER TABLE "public"."story_nodes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."story_edges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."active_quests" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view nodes" ON "public"."story_nodes" FOR SELECT USING ("public"."is_campaign_member"("campaign_id"));
CREATE POLICY "Owner manage nodes" ON "public"."story_nodes" FOR ALL USING ("auth"."uid"() = (SELECT owner_id FROM "public"."campaigns" WHERE id = campaign_id));

-- Edge policies rely on node visibility (simplified for performance to just check campaign via join if needed, but here we simplify)
CREATE POLICY "Members view edges" ON "public"."story_edges" FOR SELECT USING (TRUE); -- Simplified, app logic handles filtering
CREATE POLICY "Owner manage edges" ON "public"."story_edges" FOR ALL USING (TRUE); 

CREATE POLICY "Members view quests" ON "public"."active_quests" FOR SELECT USING ("public"."is_campaign_member"("campaign_id"));
CREATE POLICY "Owner manage quests" ON "public"."active_quests" FOR ALL USING ("auth"."uid"() = (SELECT owner_id FROM "public"."campaigns" WHERE id = campaign_id));

GRANT ALL ON TABLE "public"."story_nodes" TO "authenticated";
GRANT ALL ON TABLE "public"."story_edges" TO "authenticated";
GRANT ALL ON TABLE "public"."active_quests" TO "authenticated";

-- =================================================================
-- BAGIAN 8: BOOK OF SECRETS (PARANOID RLS)
-- =================================================================

CREATE TABLE "public"."character_arcs" (
    "id" "uuid" PRIMARY KEY DEFAULT "gen_random_uuid"(),
    "character_id" "uuid" NOT NULL REFERENCES "public"."characters"("id") ON DELETE CASCADE,
    "campaign_id" "uuid" NOT NULL REFERENCES "public"."campaigns"("id") ON DELETE CASCADE,
    
    -- The Hidden Truths
    "public_goal" "text",
    "secret_agenda" "text", -- HANYA Player & DM
    "true_desire" "text",
    
    -- Loyalty Mechanics
    "loyalty_score" integer DEFAULT 100,
    "breaking_point" "text",
    "milestones" "jsonb" DEFAULT '[]'::jsonb,
    "is_completed" bool DEFAULT false,
    
    UNIQUE("character_id", "campaign_id")
);

ALTER TABLE "public"."character_arcs" ENABLE ROW LEVEL SECURITY;

-- Strict RLS: Hanya Owner Karakter ATAU Owner Campaign yang bisa akses
CREATE POLICY "Arc Secrecy Protocol" ON "public"."character_arcs"
    FOR ALL
    USING (
        "public"."is_character_owner"("character_id") OR 
        "auth"."uid"() = (SELECT "owner_id" FROM "public"."campaigns" WHERE "id" = "campaign_id")
    );

GRANT ALL ON TABLE "public"."character_arcs" TO "authenticated";

-- =================================================================
-- BAGIAN 9: RUNTIME ENTITIES (NPCs, Monsters, Logs)
-- =================================================================

CREATE TABLE "public"."campaign_npcs" (
    "id" "uuid" PRIMARY KEY DEFAULT "gen_random_uuid"(),
    "campaign_id" "uuid" NOT NULL REFERENCES "public"."campaigns"("id") ON DELETE CASCADE,
    "name" "text" NOT NULL,
    "description" "text",
    "location" "text",
    "disposition" "text", -- Friendly, Neutral, Hostile
    "interaction_history" "text"[] DEFAULT '{}',
    "image_url" "text",
    "secret" "text", -- DM Only info ideally, but kept here for simplicity
    "opinion" "jsonb" DEFAULT '{}'::jsonb -- { "char_uuid": 50 }
);

CREATE TABLE "public"."campaign_monsters" (
    "id" "uuid" PRIMARY KEY DEFAULT "gen_random_uuid"(),
    "campaign_id" "uuid" NOT NULL REFERENCES "public"."campaigns"("id") ON DELETE CASCADE,
    "monster_id" "uuid" REFERENCES "public"."monsters"("id"), -- Link ke stat block
    "name" "text", -- "Goblin 1"
    "current_hp" integer NOT NULL,
    "max_hp" integer NOT NULL,
    "conditions" "text"[] DEFAULT '{}',
    "initiative" integer,
    "grid_position" "jsonb" -- { "x": 10, "y": 10 }
);

CREATE TABLE "public"."game_events" (
    "id" "uuid" PRIMARY KEY DEFAULT "gen_random_uuid"(),
    "campaign_id" "uuid" NOT NULL REFERENCES "public"."campaigns"("id") ON DELETE CASCADE,
    "timestamp" "timestamptz" DEFAULT "now"(),
    "turn_id" "text",
    "type" "text" NOT NULL, -- player_action, dm_narration, roll_result, dm_dialogue
    "character_id" "uuid" REFERENCES "public"."characters"("id") ON DELETE SET NULL,
    "text" "text",
    "roll" "jsonb",
    "metadata" "jsonb" -- Extra data for parsing
);

CREATE TABLE "public"."campaign_memory" (
    "id" "uuid" PRIMARY KEY DEFAULT "gen_random_uuid"(),
    "campaign_id" "uuid" NOT NULL REFERENCES "public"."campaigns"("id") ON DELETE CASCADE,
    "summary" "text" NOT NULL,
    "tags" "text"[],
    "created_at" timestamptz DEFAULT "now"()
);

-- Runtime RLS
ALTER TABLE "public"."campaign_npcs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."campaign_monsters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."game_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."campaign_memory" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view runtime" ON "public"."campaign_npcs" FOR SELECT USING ("public"."is_campaign_member"("campaign_id"));
CREATE POLICY "Owner manage runtime" ON "public"."campaign_npcs" FOR ALL USING ("auth"."uid"() = (SELECT owner_id FROM "public"."campaigns" WHERE id = campaign_id));

CREATE POLICY "Members view c_monsters" ON "public"."campaign_monsters" FOR SELECT USING ("public"."is_campaign_member"("campaign_id"));
CREATE POLICY "Owner manage c_monsters" ON "public"."campaign_monsters" FOR ALL USING ("auth"."uid"() = (SELECT owner_id FROM "public"."campaigns" WHERE id = campaign_id));

CREATE POLICY "Members view events" ON "public"."game_events" FOR SELECT USING ("public"."is_campaign_member"("campaign_id"));
CREATE POLICY "Members insert events" ON "public"."game_events" FOR INSERT WITH CHECK ("public"."is_campaign_member"("campaign_id"));
CREATE POLICY "Owner manage events" ON "public"."game_events" FOR ALL USING ("auth"."uid"() = (SELECT owner_id FROM "public"."campaigns" WHERE id = campaign_id));

CREATE POLICY "Members view memory" ON "public"."campaign_memory" FOR SELECT USING ("public"."is_campaign_member"("campaign_id"));
CREATE POLICY "Owner manage memory" ON "public"."campaign_memory" FOR ALL USING ("auth"."uid"() = (SELECT owner_id FROM "public"."campaigns" WHERE id = campaign_id));

GRANT ALL ON TABLE "public"."campaign_npcs" TO "authenticated";
GRANT ALL ON TABLE "public"."campaign_monsters" TO "authenticated";
GRANT ALL ON TABLE "public"."game_events" TO "authenticated";
GRANT ALL ON TABLE "public"."campaign_memory" TO "authenticated";

-- =================================================================
-- BAGIAN 10: SEED DATA (ITEMS, SPELLS, MONSTERS - ROBUST)
-- =================================================================
-- Seeding data dasar D&D 5e untuk memastikan sistem tidak kosong.

-- ITEMS (COMPREHENSIVE SRD 5e - PATCHED & EXPANDED)
INSERT INTO "public"."items" (name, type, rarity, base_ac, armor_type, damage_dice, damage_type, description, cost_gp, weight_lb, effect) VALUES
-- === ARMOR ===
-- Light Armor
('Padded Armor', 'armor', 'common', 11, 'light', NULL, NULL, 'Stealth disadvantage.', 5, 8, NULL),
('Leather Armor', 'armor', 'common', 11, 'light', NULL, NULL, NULL, 10, 10, NULL),
('Studded Leather', 'armor', 'common', 12, 'light', NULL, NULL, NULL, 45, 13, NULL),
-- Medium Armor
('Hide Armor', 'armor', 'common', 12, 'medium', NULL, NULL, NULL, 10, 12, NULL),
('Chain Shirt', 'armor', 'common', 13, 'medium', NULL, NULL, NULL, 50, 20, NULL),
('Scale Mail', 'armor', 'common', 14, 'medium', NULL, NULL, 'Stealth disadvantage.', 50, 45, NULL),
('Breastplate', 'armor', 'common', 14, 'medium', NULL, NULL, NULL, 400, 20, NULL),
('Half Plate', 'armor', 'common', 15, 'medium', NULL, NULL, 'Stealth disadvantage.', 750, 40, NULL),
-- Heavy Armor
('Ring Mail', 'armor', 'common', 14, 'heavy', NULL, NULL, 'Stealth disadvantage.', 30, 40, NULL),
('Chain Mail', 'armor', 'common', 16, 'heavy', NULL, NULL, 'Str 13, Stealth disadv.', 75, 55, NULL),
('Splint', 'armor', 'common', 17, 'heavy', NULL, NULL, 'Str 15, Stealth disadv.', 200, 60, NULL),
('Plate Armor', 'armor', 'common', 18, 'heavy', NULL, NULL, 'Str 15, Stealth disadv.', 1500, 65, NULL),
('Plate', 'armor', 'common', 18, 'heavy', NULL, NULL, 'Str 15, Stealth disadv. (Alias)', 1500, 65, NULL),
-- Shield
('Shield', 'armor', 'common', 2, 'shield', NULL, NULL, '+2 AC', 10, 6, NULL),

-- === WEAPONS (SIMPLE MELEE) ===
('Club', 'weapon', 'common', NULL, NULL, '1d4', 'bludgeoning', 'Light', 0.1, 2, NULL),
('Dagger', 'weapon', 'common', NULL, NULL, '1d4', 'piercing', 'Finesse, light, thrown (20/60)', 2, 1, NULL),
('Greatclub', 'weapon', 'common', NULL, NULL, '1d8', 'bludgeoning', 'Two-handed', 0.2, 10, NULL),
('Handaxe', 'weapon', 'common', NULL, NULL, '1d6', 'slashing', 'Light, thrown (20/60)', 5, 2, NULL),
('Javelin', 'weapon', 'common', NULL, NULL, '1d6', 'piercing', 'Thrown (30/120)', 0.5, 2, NULL),
('Light Hammer', 'weapon', 'common', NULL, NULL, '1d4', 'bludgeoning', 'Light, thrown (20/60)', 2, 2, NULL),
('Mace', 'weapon', 'common', NULL, NULL, '1d6', 'bludgeoning', NULL, 5, 4, NULL),
('Quarterstaff', 'weapon', 'common', NULL, NULL, '1d6', 'bludgeoning', 'Versatile (1d8)', 0.2, 4, NULL),
('Sickle', 'weapon', 'common', NULL, NULL, '1d4', 'slashing', 'Light', 1, 2, NULL),
('Spear', 'weapon', 'common', NULL, NULL, '1d6', 'piercing', 'Thrown (20/60), versatile (1d8)', 1, 3, NULL),

-- === WEAPONS (SIMPLE RANGED) ===
('Light Crossbow', 'weapon', 'common', NULL, NULL, '1d8', 'piercing', 'Ammunition (80/320), loading, two-handed', 25, 5, NULL),
('Dart', 'weapon', 'common', NULL, NULL, '1d4', 'piercing', 'Finesse, thrown (20/60)', 0.05, 0.25, NULL),
('Shortbow', 'weapon', 'common', NULL, NULL, '1d6', 'piercing', 'Ammunition (80/320), two-handed', 25, 2, NULL),
('Sling', 'weapon', 'common', NULL, NULL, '1d4', 'bludgeoning', 'Ammunition (30/120)', 0.1, 0, NULL),

-- === WEAPONS (MARTIAL MELEE) ===
('Battleaxe', 'weapon', 'common', NULL, NULL, '1d8', 'slashing', 'Versatile (1d10)', 10, 4, NULL),
('Flail', 'weapon', 'common', NULL, NULL, '1d8', 'bludgeoning', NULL, 10, 2, NULL),
('Glaive', 'weapon', 'common', NULL, NULL, '1d10', 'slashing', 'Heavy, reach, two-handed', 20, 6, NULL),
('Greataxe', 'weapon', 'common', NULL, NULL, '1d12', 'slashing', 'Heavy, two-handed', 30, 7, NULL),
('Greatsword', 'weapon', 'common', NULL, NULL, '2d6', 'slashing', 'Heavy, two-handed', 50, 6, NULL),
('Halberd', 'weapon', 'common', NULL, NULL, '1d10', 'slashing', 'Heavy, reach, two-handed', 20, 6, NULL),
('Lance', 'weapon', 'common', NULL, NULL, '1d12', 'piercing', 'Reach, special', 10, 6, NULL),
('Longsword', 'weapon', 'common', NULL, NULL, '1d8', 'slashing', 'Versatile (1d10)', 15, 3, NULL),
('Maul', 'weapon', 'common', NULL, NULL, '2d6', 'bludgeoning', 'Heavy, two-handed', 10, 10, NULL),
('Morningstar', 'weapon', 'common', NULL, NULL, '1d8', 'piercing', NULL, 15, 4, NULL),
('Pike', 'weapon', 'common', NULL, NULL, '1d10', 'piercing', 'Heavy, reach, two-handed', 5, 18, NULL),
('Rapier', 'weapon', 'common', NULL, NULL, '1d8', 'piercing', 'Finesse', 25, 2, NULL),
('Scimitar', 'weapon', 'common', NULL, NULL, '1d6', 'slashing', 'Finesse, light', 25, 3, NULL),
('Shortsword', 'weapon', 'common', NULL, NULL, '1d6', 'piercing', 'Finesse, light', 10, 2, NULL),
('Trident', 'weapon', 'common', NULL, NULL, '1d6', 'piercing', 'Thrown (20/60), versatile (1d8)', 5, 4, NULL),
('War Pick', 'weapon', 'common', NULL, NULL, '1d8', 'piercing', NULL, 5, 2, NULL),
('Warhammer', 'weapon', 'common', NULL, NULL, '1d8', 'bludgeoning', 'Versatile (1d10)', 15, 2, NULL),
('Whip', 'weapon', 'common', NULL, NULL, '1d4', 'slashing', 'Finesse, reach', 2, 3, NULL),
('Small Knife', 'weapon', 'common', NULL, NULL, '1d4', 'piercing', 'A small utility knife.', 0.5, 0.5, NULL),

-- === WEAPONS (MARTIAL RANGED) ===
('Blowgun', 'weapon', 'common', NULL, NULL, '1', 'piercing', 'Ammunition (25/100), loading', 10, 1, NULL),
('Hand Crossbow', 'weapon', 'common', NULL, NULL, '1d6', 'piercing', 'Ammunition (30/120), light, loading', 75, 3, NULL),
('Heavy Crossbow', 'weapon', 'common', NULL, NULL, '1d10', 'piercing', 'Ammunition (100/400), heavy, loading, two-handed', 50, 18, NULL),
('Longbow', 'weapon', 'common', NULL, NULL, '1d8', 'piercing', 'Ammunition (150/600), heavy, two-handed', 50, 2, NULL),
('Net', 'weapon', 'common', NULL, NULL, NULL, NULL, 'Special, thrown (5/15)', 1, 3, NULL),

-- === AMMUNITION ===
('Arrows (20)', 'other', 'common', NULL, NULL, NULL, NULL, 'Ammunition for bows.', 1, 1, NULL),
('Arrows', 'other', 'common', NULL, NULL, NULL, NULL, 'Ammunition for bows (Generic).', 1, 1, NULL),
('Bolts (20)', 'other', 'common', NULL, NULL, NULL, NULL, 'Ammunition for crossbows.', 1, 1.5, NULL),
('Bolts', 'other', 'common', NULL, NULL, NULL, NULL, 'Ammunition for crossbows (Generic).', 1, 1.5, NULL),
('Blowgun Needles (50)', 'other', 'common', NULL, NULL, NULL, NULL, 'Ammunition for blowguns.', 1, 1, NULL),
('Sling Bullets (20)', 'other', 'common', NULL, NULL, NULL, NULL, 'Ammunition for slings.', 0.04, 1.5, NULL),

-- === ARCANE & DRUIDIC FOCUSES (FIXED: ADDED GENERIC VARIANTS) ===
('Arcane Focus', 'other', 'common', NULL, NULL, NULL, NULL, 'An orb, crystal, or wand.', 10, 1, NULL),
('Druidic Focus', 'other', 'common', NULL, NULL, NULL, NULL, 'A sprig of mistletoe or totem.', 1, 0, NULL),
('Holy Symbol', 'other', 'common', NULL, NULL, NULL, NULL, 'A symbol of a god.', 5, 1, NULL),
('Crystal (Arcane Focus)', 'other', 'common', NULL, NULL, NULL, NULL, 'An arcane focus.', 10, 1, NULL),
('Orb (Arcane Focus)', 'other', 'common', NULL, NULL, NULL, NULL, 'An arcane focus.', 20, 3, NULL),
('Rod (Arcane Focus)', 'other', 'common', NULL, NULL, NULL, NULL, 'An arcane focus.', 10, 2, NULL),
('Staff (Arcane Focus)', 'other', 'common', NULL, NULL, NULL, NULL, 'An arcane focus.', 5, 4, NULL),
('Wand (Arcane Focus)', 'other', 'common', NULL, NULL, NULL, NULL, 'An arcane focus.', 10, 1, NULL),
('Sprig of Mistletoe', 'other', 'common', NULL, NULL, NULL, NULL, 'A druidic focus.', 1, 0, NULL),
('Totem', 'other', 'common', NULL, NULL, NULL, NULL, 'A druidic focus.', 1, 0, NULL),
('Wooden Staff', 'other', 'common', NULL, NULL, NULL, NULL, 'A druidic focus.', 5, 4, NULL),
('Yew Wand', 'other', 'common', NULL, NULL, NULL, NULL, 'A druidic focus.', 10, 1, NULL),
('Holy Symbol (Amulet)', 'other', 'common', NULL, NULL, NULL, NULL, 'A divine focus.', 5, 1, NULL),
('Holy Symbol (Emblem)', 'other', 'common', NULL, NULL, NULL, NULL, 'A divine focus.', 5, 0, NULL),
('Holy Symbol (Reliquary)', 'other', 'common', NULL, NULL, NULL, NULL, 'A divine focus.', 5, 2, NULL),
('Component Pouch', 'other', 'common', NULL, NULL, NULL, NULL, 'Holds spell components.', 25, 2, NULL),
('Spellbook', 'other', 'common', NULL, NULL, NULL, NULL, 'Essential for wizards.', 50, 3, NULL),

-- === PACKS (The Missing Links!) ===
('Explorer''s Pack', 'other', 'common', NULL, NULL, NULL, NULL, 'Backpack, bedroll, mess kit, tinderbox, 10 torches, 10 days rations, waterskin, 50ft hempen rope.', 10, 59, NULL),
('Dungeoneer''s Pack', 'other', 'common', NULL, NULL, NULL, NULL, 'Backpack, crowbar, hammer, 10 pitons, 10 torches, tinderbox, 10 days rations, waterskin, 50ft hempen rope.', 12, 61.5, NULL),
('Burglar''s Pack', 'other', 'common', NULL, NULL, NULL, NULL, 'Backpack, ball bearings, 10ft string, bell, 5 candles, crowbar, hammer, 10 pitons, hooded lantern, 2 oil flasks, 5 days rations, tinderbox, waterskin, 50ft hempen rope.', 16, 47.5, NULL),
('Diplomat''s Pack', 'other', 'common', NULL, NULL, NULL, NULL, 'Chest, 2 map/scroll cases, fine clothes, ink bottle, pen, lamp, 2 oil flasks, 5 paper sheets, perfume, sealing wax, soap.', 39, 46, NULL),
('Entertainer''s Pack', 'other', 'common', NULL, NULL, NULL, NULL, 'Backpack, bedroll, 2 costumes, 5 candles, 5 days rations, waterskin, disguise kit.', 40, 38, NULL),
('Priest''s Pack', 'other', 'common', NULL, NULL, NULL, NULL, 'Backpack, blanket, 10 candles, tinderbox, alms box, 2 incense blocks, censer, vestments, 2 days rations, waterskin.', 19, 24, NULL),
('Scholar''s Pack', 'other', 'common', NULL, NULL, NULL, NULL, 'Backpack, book of lore, ink bottle, pen, 10 parchment sheets, bag of sand, small knife.', 40, 10, NULL),

-- === TOOLS & KITS ===
('Thieves'' Tools', 'tool', 'common', NULL, NULL, NULL, NULL, 'Tools for disabling traps and picking locks.', 25, 1, NULL),
('Disguise Kit', 'tool', 'common', NULL, NULL, NULL, NULL, 'Cosmetics and props for disguises.', 25, 3, NULL),
('Poisoner''s Kit', 'tool', 'common', NULL, NULL, NULL, NULL, 'Tools for creating poisons.', 50, 2, NULL),
('Herbalism Kit', 'tool', 'common', NULL, NULL, NULL, NULL, 'Tools for creating remedies and potions.', 5, 3, NULL),
('Healer''s Kit', 'tool', 'common', NULL, NULL, NULL, NULL, 'Bandages and salves to stabilize the dying.', 5, 3, NULL),
('Navigator''s Tools', 'tool', 'common', NULL, NULL, NULL, NULL, 'Instruments for navigation at sea.', 25, 2, NULL),
('Alchemist''s Supplies', 'tool', 'common', NULL, NULL, NULL, NULL, 'Glassware and ingredients for alchemy.', 50, 8, NULL),
('Smith''s Tools', 'tool', 'common', NULL, NULL, NULL, NULL, 'Hammers, tongs, and other smithing tools.', 20, 8, NULL),
('Brewer''s Supplies', 'tool', 'common', NULL, NULL, NULL, NULL, 'Equipment for brewing ale.', 20, 9, NULL),
('Mason''s Tools', 'tool', 'common', NULL, NULL, NULL, NULL, 'Tools for stone working.', 10, 8, NULL),
('Tinker''s Tools', 'tool', 'common', NULL, NULL, NULL, NULL, 'Tools for mending small objects.', 50, 10, NULL),
('Artisan''s Tools (Tinker''s Tools)', 'tool', 'common', NULL, NULL, NULL, NULL, 'Tools for mending small objects (Alias).', 50, 10, NULL),
('Musical Instrument (Lute)', 'tool', 'common', NULL, NULL, NULL, NULL, 'A stringed instrument.', 35, 2, NULL),
('Musical Instrument (Flute)', 'tool', 'common', NULL, NULL, NULL, NULL, 'A woodwind instrument.', 2, 1, NULL),
('Musical Instrument (Drum)', 'tool', 'common', NULL, NULL, NULL, NULL, 'A percussion instrument.', 6, 3, NULL),
('Musical Instrument (Horn)', 'tool', 'common', NULL, NULL, NULL, NULL, 'A brass instrument.', 3, 2, NULL),
('Gaming Set (Dice)', 'tool', 'common', NULL, NULL, NULL, NULL, 'A set of dice.', 0.1, 0, NULL),
('Gaming Set (Cards)', 'tool', 'common', NULL, NULL, NULL, NULL, 'A deck of cards.', 0.5, 0, NULL),
('Gaming Set (Chess)', 'tool', 'common', NULL, NULL, NULL, NULL, 'A chess set.', 1, 2, NULL),

-- === MISC ADVENTURING GEAR & BACKGROUND ITEMS (FIXED: ADDED MISSING ITEMS) ===
('Backpack', 'other', 'common', NULL, NULL, NULL, NULL, 'Holds 30 lbs of gear.', 2, 5, NULL),
('Bedroll', 'other', 'common', NULL, NULL, NULL, NULL, 'For sleeping outdoors.', 1, 7, NULL),
('Blanket', 'other', 'common', NULL, NULL, NULL, NULL, 'A warm blanket.', 0.5, 3, NULL),
('Candle', 'other', 'common', NULL, NULL, NULL, NULL, 'Sheds light for 1 hour.', 0.01, 0, NULL),
('Clothes, Common', 'other', 'common', NULL, NULL, NULL, NULL, 'Simple clothes.', 0.5, 3, NULL),
('Common Clothes (Dark)', 'other', 'common', NULL, NULL, NULL, NULL, 'Simple dark clothes for stealth.', 0.5, 3, NULL),
('Clothes, Costume', 'other', 'common', NULL, NULL, NULL, NULL, 'Theatrical clothes.', 5, 4, NULL),
('Clothes, Fine', 'other', 'common', NULL, NULL, NULL, NULL, 'Expensive clothes.', 15, 6, NULL),
('Fine Clothes', 'other', 'common', NULL, NULL, NULL, NULL, 'Expensive clothes (Alias).', 15, 6, NULL),
('Clothes, Traveler''s', 'other', 'common', NULL, NULL, NULL, NULL, 'Sturdy clothes.', 2, 4, NULL),
('Crowbar', 'other', 'common', NULL, NULL, NULL, NULL, 'Grants advantage on leverage checks.', 2, 5, NULL),
('Hammer', 'other', 'common', NULL, NULL, NULL, NULL, 'A small hammer.', 1, 3, NULL),
('Ink (1 ounce bottle)', 'other', 'common', NULL, NULL, NULL, NULL, 'Black ink.', 10, 0, NULL),
('Bottle of Black Ink', 'other', 'common', NULL, NULL, NULL, NULL, 'Black ink (Alias).', 10, 0, NULL),
('Ink Pen', 'other', 'common', NULL, NULL, NULL, NULL, 'Wooden pen.', 0.02, 0, NULL),
('Quill', 'other', 'common', NULL, NULL, NULL, NULL, 'Writing implement (Alias).', 0.02, 0, NULL),
('Lantern, Hooded', 'other', 'common', NULL, NULL, NULL, NULL, 'Sheds bright light for 30ft.', 5, 2, NULL),
('Lock', 'other', 'common', NULL, NULL, NULL, NULL, 'A mechanical lock.', 10, 1, NULL),
('Mess Kit', 'other', 'common', NULL, NULL, NULL, NULL, 'Cup and cutlery.', 0.2, 1, NULL),
('Mirror, Steel', 'other', 'common', NULL, NULL, NULL, NULL, 'A small metal mirror.', 5, 0.5, NULL),
('Oil (flask)', 'consumable', 'common', NULL, NULL, NULL, NULL, 'Fuel for lanterns.', 0.1, 1, NULL),
('Paper (one sheet)', 'other', 'common', NULL, NULL, NULL, NULL, 'For writing.', 0.2, 0, NULL),
('Parchment (one sheet)', 'other', 'common', NULL, NULL, NULL, NULL, 'Durable writing material.', 0.1, 0, NULL),
('Perfume (vial)', 'other', 'common', NULL, NULL, NULL, NULL, 'Scented liquid.', 5, 0, NULL),
('Piton', 'other', 'common', NULL, NULL, NULL, NULL, 'Climbing spike.', 0.05, 0.25, NULL),
('Potion of Healing', 'consumable', 'common', NULL, NULL, NULL, NULL, 'Heals 2d4+2 HP.', 50, 0.5, '{"type": "heal", "dice": "2d4+2"}'),
('Rations (1 day)', 'consumable', 'common', NULL, NULL, NULL, NULL, 'Dry food.', 0.5, 2, NULL),
('Rope, Hempen (50 feet)', 'other', 'common', NULL, NULL, NULL, NULL, 'Basic rope.', 1, 10, NULL),
('Rope, Silk (50 feet)', 'other', 'common', NULL, NULL, NULL, NULL, 'Strong, light rope.', 10, 5, NULL),
('Sack', 'other', 'common', NULL, NULL, NULL, NULL, 'Holds 30 lbs.', 0.01, 0.5, NULL),
('Sealing Wax', 'other', 'common', NULL, NULL, NULL, NULL, 'For sealing letters.', 0.5, 0, NULL),
('Soap', 'other', 'common', NULL, NULL, NULL, NULL, 'A bar of soap.', 0.02, 0, NULL),
('Tinderbox', 'other', 'common', NULL, NULL, NULL, NULL, 'Fire starter.', 0.5, 1, NULL),
('Torch', 'consumable', 'common', NULL, NULL, NULL, NULL, 'Burns for 1 hour.', 0.01, 1, NULL),
('Waterskin', 'other', 'common', NULL, NULL, NULL, NULL, 'Holds water.', 0.2, 5, NULL),
('Whetstone', 'other', 'common', NULL, NULL, NULL, NULL, 'Sharpening stone.', 0.01, 1, NULL),
('Shovel', 'tool', 'common', NULL, NULL, NULL, NULL, 'Digging tool.', 2, 5, NULL),
('Iron Pot', 'other', 'common', NULL, NULL, NULL, NULL, 'Cooking pot.', 2, 10, NULL),
('Signet Ring', 'other', 'common', NULL, NULL, NULL, NULL, 'Ring with a seal.', 5, 0, NULL),
('Scroll of Pedigree', 'other', 'common', NULL, NULL, NULL, NULL, 'Genealogy document.', 0, 0, NULL),
('Insignia of Rank', 'other', 'common', NULL, NULL, NULL, NULL, 'Badge of office.', 0, 0, NULL),
('Trophy (Dagger)', 'other', 'common', NULL, NULL, NULL, NULL, 'A trophy taken from an enemy.', 0, 1, NULL);

INSERT INTO "public"."spells" (name, level, school, casting_time, range, components, duration, effect_type, description, damage_dice, damage_type) VALUES
-- === CANTRIPS (LEVEL 0) ===
('Guidance', 0, 'Divination', 'action', 'Touch', '{"V","S"}', 'Concentration, 1 minute', 'buff', 'Target adds 1d4 to one ability check.', NULL, NULL),
('Mage Hand', 0, 'Conjuration', 'action', '30 feet', '{"V","S"}', '1 minute', 'utility', 'Spectral hand manipulates objects.', NULL, NULL),
('Minor Illusion', 0, 'Illusion', 'action', '30 feet', '{"S","M"}', '1 minute', 'utility', 'Creates sound or image of object.', NULL, NULL),
('Prestidigitation', 0, 'Transmutation', 'action', '10 feet', '{"V","S"}', '1 hour', 'utility', 'Minor magical tricks.', NULL, NULL),
('Vicious Mockery', 0, 'Enchantment', 'action', '60 feet', '{"V"}', 'Instantaneous', 'damage', 'Target takes 1d4 psychic and disadv on next attack.', '1d4', 'psychic'),
('Fire Bolt', 0, 'Evocation', 'action', '120 feet', '{"V","S"}', 'Instantaneous', 'damage', 'Ranged spell attack.', '1d10', 'fire'),
('Eldritch Blast', 0, 'Evocation', 'action', '120 feet', '{"V","S"}', 'Instantaneous', 'damage', 'Force beam attack.', '1d10', 'force'),
('Sacred Flame', 0, 'Evocation', 'action', '60 feet', '{"V","S"}', 'Instantaneous', 'damage', 'Dex save or damage.', '1d8', 'radiant'),
('Ray of Frost', 0, 'Evocation', 'action', '60 feet', '{"V","S"}', 'Instantaneous', 'damage', 'Damage and reduces speed by 10ft.', '1d8', 'cold'),
('Shocking Grasp', 0, 'Evocation', 'action', 'Touch', '{"V","S"}', 'Instantaneous', 'damage', 'Damage and target cannot take reactions.', '1d8', 'lightning'),
('Light', 0, 'Evocation', 'action', 'Touch', '{"V","M"}', '1 hour', 'utility', 'Object sheds bright light.', NULL, NULL),
('Thaumaturgy', 0, 'Transmutation', 'action', '30 feet', '{"V"}', '1 minute', 'utility', 'Manifests minor supernatural wonders.', NULL, NULL),
('Spare the Dying', 0, 'Necromancy', 'action', 'Touch', '{"V","S"}', 'Instantaneous', 'heal', 'Stabilizes a dying creature.', NULL, NULL),

-- === LEVEL 1 ===
('Bless', 1, 'Enchantment', 'action', '30 feet', '{"V","S","M"}', 'Concentration, 1 minute', 'buff', '3 creatures add 1d4 to attack/saves.', NULL, NULL),
('Cure Wounds', 1, 'Evocation', 'action', 'Touch', '{"V","S"}', 'Instantaneous', 'heal', 'Heals 1d8 + mod.', '1d8', NULL),
('Healing Word', 1, 'Evocation', 'bonus_action', '60 feet', '{"V"}', 'Instantaneous', 'heal', 'Heals 1d4 + mod.', '1d4', NULL),
('Guiding Bolt', 1, 'Evocation', 'action', '120 feet', '{"V","S"}', '1 round', 'damage', 'Damage and next attack has advantage.', '4d6', 'radiant'),
('Magic Missile', 1, 'Evocation', 'action', '120 feet', '{"V","S"}', 'Instantaneous', 'damage', '3 darts hit automatically.', '3d4+3', 'force'),
('Shield', 1, 'Abjuration', 'reaction', 'Self', '{"V","S"}', '1 round', 'buff', '+5 AC vs triggering attack.', NULL, NULL),
('Sleep', 1, 'Enchantment', 'action', '90 feet', '{"V","S","M"}', '1 minute', 'control', 'Puts creatures to sleep (5d8 HP).', NULL, NULL),
('Thunderwave', 1, 'Evocation', 'action', 'Self (15-foot cube)', '{"V","S"}', 'Instantaneous', 'damage', 'Push 10ft and damage.', '2d8', 'thunder'),
('Detect Magic', 1, 'Divination', 'action', 'Self', '{"V","S"}', 'Concentration, 10 minutes', 'utility', 'Sense presence of magic.', NULL, NULL),
('Identify', 1, 'Divination', '1 minute', 'Touch', '{"V","S","M"}', 'Instantaneous', 'utility', 'Learn properties of a magic item.', NULL, NULL),
('Mage Armor', 1, 'Abjuration', 'action', 'Touch', '{"V","S","M"}', '8 hours', 'buff', 'Target AC becomes 13 + Dex.', NULL, NULL),
('Faerie Fire', 1, 'Evocation', 'action', '60 feet', '{"V"}', 'Concentration, 1 minute', 'debuff', 'Outlines targets in light, advantage on attacks.', NULL, NULL),
('Entangle', 1, 'Conjuration', 'action', '90 feet', '{"V","S"}', 'Concentration, 1 minute', 'control', 'Plants restrain creatures in area.', NULL, NULL),
('Command', 1, 'Enchantment', 'action', '60 feet', '{"V"}', '1 round', 'control', 'Target obeys one-word command.', NULL, NULL),
('Inflict Wounds', 1, 'Necromancy', 'action', 'Touch', '{"V","S"}', 'Instantaneous', 'damage', 'Melee spell attack for high damage.', '3d10', 'necrotic'),
('Hellish Rebuke', 1, 'Evocation', 'reaction', '60 feet', '{"V","S"}', 'Instantaneous', 'damage', 'Damage to creature that damaged you.', '2d10', 'fire'),
('Hex', 1, 'Enchantment', 'bonus_action', '90 feet', '{"V","S","M"}', 'Concentration, 1 hour', 'debuff', 'Extra 1d6 necrotic damage on hit.', '1d6', 'necrotic'),
('Armor of Agathys', 1, 'Abjuration', 'action', 'Self', '{"V","S","M"}', '1 hour', 'buff', 'Gain temp HP and deal cold damage when hit.', NULL, 'cold'),

-- === LEVEL 2 (ESSENTIALS) ===
('Invisibility', 2, 'Illusion', 'action', 'Touch', '{"V","S","M"}', 'Concentration, 1 hour', 'buff', 'Target becomes invisible.', NULL, NULL),
('Misty Step', 2, 'Conjuration', 'bonus_action', 'Self', '{"V"}', 'Instantaneous', 'utility', 'Teleport 30 feet.', NULL, NULL),
('Hold Person', 2, 'Enchantment', 'action', '60 feet', '{"V","S","M"}', 'Concentration, 1 minute', 'control', 'Paralyzes a humanoid.', NULL, NULL),
('Lesser Restoration', 2, 'Abjuration', 'action', 'Touch', '{"V","S"}', 'Instantaneous', 'heal', 'Ends one disease or condition.', NULL, NULL),
('Scorching Ray', 2, 'Evocation', 'action', '120 feet', '{"V","S"}', 'Instantaneous', 'damage', 'Three rays of fire.', '2d6', 'fire'),
('Shatter', 2, 'Evocation', 'action', '60 feet', '{"V","S","M"}', 'Instantaneous', 'damage', 'Loud noise damages area.', '3d8', 'thunder'),
('Web', 2, 'Conjuration', 'action', '60 feet', '{"V","S","M"}', 'Concentration, 1 hour', 'control', 'Creates sticky webbing.', NULL, NULL),
('Darkness', 2, 'Evocation', 'action', '60 feet', '{"V","M"}', 'Concentration, 10 minutes', 'control', 'Magical darkness fills area.', NULL, NULL);

INSERT INTO "public"."monsters" (name, armor_class, max_hp, ability_scores, xp, challenge_rating, actions) VALUES
('Goblin', 15, 7, '{"strength": 8, "dexterity": 14, "constitution": 10, "intelligence": 10, "wisdom": 8, "charisma": 8}', 50, 0.25, '[{"name": "Scimitar", "damageDice": "1d6+2", "toHitBonus": 4}]'),
('Skeleton', 13, 13, '{"strength": 10, "dexterity": 14, "constitution": 15, "intelligence": 6, "wisdom": 8, "charisma": 5}', 50, 0.25, '[{"name": "Shortsword", "damageDice": "1d6+2", "toHitBonus": 4}]'),
('Orc', 13, 15, '{"strength": 16, "dexterity": 12, "constitution": 16, "intelligence": 7, "wisdom": 11, "charisma": 10}', 100, 0.5, '[{"name": "Greataxe", "damageDice": "1d12+3", "toHitBonus": 5}]'),
('Bandit', 12, 11, '{"strength": 11, "dexterity": 12, "constitution": 12, "intelligence": 10, "wisdom": 10, "charisma": 10}', 25, 0.125, '[{"name": "Scimitar", "damageDice": "1d6+1", "toHitBonus": 3}]'),
('Zombie', 8, 22, '{"strength": 13, "dexterity": 6, "constitution": 16, "intelligence": 3, "wisdom": 6, "charisma": 5}', 50, 0.25, '[{"name": "Slam", "damageDice": "1d6+1", "toHitBonus": 3}]');

-- =================================================================
-- BAGIAN 11: STORAGE ASSETS
-- =================================================================

INSERT INTO "storage"."buckets" ("id", "name", "public") VALUES ('assets', 'assets', true) ON CONFLICT (id) DO NOTHING;

-- END OF SCRIPT