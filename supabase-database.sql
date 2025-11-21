-- =================================================================
-- SKRIP SQL FINAL V2.0 - THE ATLAS PROTOCOL MIGRATION
-- =================================================================
-- STATUS: PRODUCTION READY (ENDLESS SAGA COMPATIBLE)
-- PENJAGA PROTOKOL: ARSITEK SISTEM PARANOID
-- =================================================================

-- =================================================================
-- BAGIAN 0: NUCLEAR RESET (BERSIHKAN SEMUA SKEMA)
-- =================================================================

-- 1. Bersihkan skema 'public' dengan menghapus dan membuatnya kembali.
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO anon;
GRANT ALL ON SCHEMA public TO authenticated;
GRANT ALL ON SCHEMA public TO service_role;

-- 2. Reset Storage (Hapus Data Lama untuk mencegah referensi yatim)
DELETE FROM storage.objects;
DELETE FROM storage.buckets;

-- =================================================================
-- BAGIAN 1: IDENTITAS & OTENTIKASI
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

-- Trigger untuk membuat profil otomatis saat user sign up
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

-- =================================================================
-- BAGIAN 2: DEFINISI DUNIA (SRD 5e RULES)
-- =================================================================

CREATE TABLE "public"."items" (
    "id" "uuid" PRIMARY KEY DEFAULT "gen_random_uuid"(),
    "name" "text" NOT NULL UNIQUE,
    "description" "text",
    "type" "text" NOT NULL, -- weapon, armor, consumable, tool, other
    "is_magical" bool DEFAULT false,
    "rarity" "text" DEFAULT 'common',
    "requires_attunement" bool DEFAULT false,
    "bonuses" "jsonb", -- { "attack": 1, "ac": 2 }
    "damage_dice" "text",
    "damage_type" "text",
    "base_ac" integer,
    "armor_type" "text", -- light, medium, heavy, shield
    "stealth_disadvantage" bool DEFAULT false,
    "strength_requirement" integer,
    "effect" "jsonb" -- { "type": "heal", "dice": "2d4+2" }
);

CREATE TABLE "public"."spells" (
    "id" "uuid" PRIMARY KEY DEFAULT "gen_random_uuid"(),
    "name" "text" NOT NULL UNIQUE,
    "level" integer NOT NULL,
    "description" "text",
    "casting_time" "text",
    "range" "text",
    "components" "text"[], -- V, S, M
    "duration" "text",
    "school" "text",
    "effect_type" "text", -- damage, heal, buff, control, utility
    "damage_dice" "text",
    "damage_type" "text",
    "save_required" "text", -- dexterity, wisdom, etc
    "save_on_success" "text", -- half_damage, no_effect
    "condition_applied" "text"
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
    "xp" integer
);

-- RLS untuk tabel definisi (Semua orang bisa baca, tidak ada yang bisa edit kecuali service role)
ALTER TABLE "public"."items" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Global definitions are viewable by all." ON "public"."items" FOR SELECT TO authenticated, anon USING (true);

ALTER TABLE "public"."spells" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Global definitions are viewable by all." ON "public"."spells" FOR SELECT TO authenticated, anon USING (true);

ALTER TABLE "public"."monsters" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Global definitions are viewable by all." ON "public"."monsters" FOR SELECT TO authenticated, anon USING (true);

GRANT SELECT ON TABLE "public"."items" TO "anon", "authenticated";
GRANT SELECT ON TABLE "public"."spells" TO "anon", "authenticated";
GRANT SELECT ON TABLE "public"."monsters" TO "anon", "authenticated";

-- =================================================================
-- BAGIAN 3: KARAKTER PEMAIN (PUBLIC STATS)
-- =================================================================

CREATE TABLE "public"."characters" (
    "id" "uuid" PRIMARY KEY DEFAULT "gen_random_uuid"(),
    "owner_id" "uuid" NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "name" "text" NOT NULL,
    "class" "text" NOT NULL,
    "race" "text" NOT NULL,
    "level" integer NOT NULL DEFAULT 1,
    "xp" integer NOT NULL DEFAULT 0,
    "avatar_url" "text",
    "gender" "text" DEFAULT 'Pria',
    
    -- Visual Customization (Pixel Art Layers)
    "body_type" "text" DEFAULT 'bt_normal',
    "scars" "text"[] DEFAULT '{}',
    "hair" "text" DEFAULT 'h_short_blond',
    "facial_hair" "text" DEFAULT 'ff_none',
    "head_accessory" "text" DEFAULT 'ha_none',
    
    -- Background & Personality (Public)
    "background" "text",
    "personality_trait" "text",
    "ideal" "text",
    "bond" "text",
    "flaw" "text",
    
    -- Combat Stats (Persistent)
    "ability_scores" "jsonb" NOT NULL,
    "max_hp" integer NOT NULL,
    "current_hp" integer NOT NULL,
    "temp_hp" integer NOT NULL DEFAULT 0,
    "armor_class" integer NOT NULL,
    "speed" integer NOT NULL,
    "hit_dice" "jsonb" NOT NULL,
    "death_saves" "jsonb" NOT NULL DEFAULT '{"successes": 0, "failures": 0}',
    "conditions" "text"[] NOT NULL DEFAULT '{}',
    
    -- Features & Proficiencies
    "racial_traits" "jsonb" DEFAULT '[]'::jsonb,
    "class_features" "jsonb" DEFAULT '[]'::jsonb,
    "proficient_skills" "text"[] DEFAULT '{}',
    "proficient_saving_throws" "text"[] DEFAULT '{}',
    "languages" "text"[] DEFAULT '{}',
    "spell_slots" "jsonb" DEFAULT '{}', -- { "1": { "max": 2, "spent": 0 } }
    "prepared_spells" "jsonb" DEFAULT '[]'::jsonb
);

ALTER TABLE "public"."characters" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Characters are viewable by everyone." ON "public"."characters"
    FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Users can manage their own characters." ON "public"."characters"
    FOR ALL USING ("auth"."uid"() = "owner_id") WITH CHECK ("auth"."uid"() = "owner_id");

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."characters" TO "authenticated";
GRANT SELECT ON TABLE "public"."characters" TO "anon";

-- =================================================================
-- BAGIAN 4: INVENTORY & SPELLBOOK (RELASIONAL)
-- =================================================================

CREATE TABLE "public"."character_inventory" (
    "id" "uuid" PRIMARY KEY DEFAULT "gen_random_uuid"(),
    "character_id" "uuid" NOT NULL REFERENCES "public"."characters"("id") ON DELETE CASCADE,
    "item_id" "uuid" NOT NULL REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "quantity" integer NOT NULL DEFAULT 1,
    "is_equipped" bool DEFAULT false
);

CREATE TABLE "public"."character_spells" (
    "id" "uuid" PRIMARY KEY DEFAULT "gen_random_uuid"(),
    "character_id" "uuid" NOT NULL REFERENCES "public"."characters"("id") ON DELETE CASCADE,
    "spell_id" "uuid" NOT NULL REFERENCES "public"."spells"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."character_inventory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."character_spells" ENABLE ROW LEVEL SECURITY;

-- Helper Function untuk RLS Inventory
CREATE OR REPLACE FUNCTION "public"."is_character_owner"("character_id_to_check" "uuid")
RETURNS bool AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM "public"."characters"
        WHERE "id" = "character_id_to_check" AND "owner_id" = "auth"."uid"()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "Inventory viewable by all." ON "public"."character_inventory" FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Manage own inventory." ON "public"."character_inventory" FOR ALL USING ("public"."is_character_owner"("character_id")) WITH CHECK ("public"."is_character_owner"("character_id"));

CREATE POLICY "Spells viewable by all." ON "public"."character_spells" FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Manage own spells." ON "public"."character_spells" FOR ALL USING ("public"."is_character_owner"("character_id")) WITH CHECK ("public"."is_character_owner"("character_id"));

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."character_inventory" TO "authenticated";
GRANT SELECT ON TABLE "public"."character_inventory" TO "anon";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."character_spells" TO "authenticated";
GRANT SELECT ON TABLE "public"."character_spells" TO "anon";


-- =================================================================
-- BAGIAN 5: KAMPANYE (CORE)
-- =================================================================

CREATE TABLE "public"."campaigns" (
    "id" "uuid" PRIMARY KEY DEFAULT "gen_random_uuid"(),
    "owner_id" "uuid" NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
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
    
    -- DM Settings
    "dm_personality" "text",
    "dm_narration_style" "text",
    "response_length" "text",
    "rules_config" "jsonb" DEFAULT '{}', -- { "rollPrivacy": "public", ... }

    -- Game State Global
    "game_state" "text" NOT NULL DEFAULT 'exploration', -- exploration, combat
    "current_time" bigint DEFAULT 43200, -- Detik dari jam 00:00
    "current_weather" "text" DEFAULT 'Cerah',
    "world_event_counter" integer DEFAULT 0,
    
    -- Active Session State
    "current_player_id" "uuid" REFERENCES "public"."characters"("id") ON DELETE SET NULL,
    "initiative_order" "text"[] DEFAULT '{}',
    "turn_id" "text",
    "battle_state" "jsonb" -- { "activeUnitId": "...", "status": "Active" }
);

CREATE TABLE "public"."campaign_players" (
    "id" "uuid" PRIMARY KEY DEFAULT "gen_random_uuid"(),
    "campaign_id" "uuid" NOT NULL REFERENCES "public"."campaigns"("id") ON DELETE CASCADE,
    "character_id" "uuid" NOT NULL REFERENCES "public"."characters"("id") ON DELETE CASCADE,
    UNIQUE("campaign_id", "character_id")
);

-- Helper Function: Cek Membership Campaign
CREATE OR REPLACE FUNCTION "public"."is_campaign_member"("campaign_id_to_check" "uuid")
RETURNS bool AS $$
DECLARE
    "auth_id" "uuid" := "auth"."uid"();
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM "public"."campaign_players" "cp"
        JOIN "public"."characters" "c" ON "cp"."character_id" = "c"."id"
        WHERE "cp"."campaign_id" = "campaign_id_to_check" AND "c"."owner_id" = "auth_id"
    ) OR EXISTS (
        SELECT 1 FROM "public"."campaigns"
        WHERE "id" = "campaign_id_to_check" AND "owner_id" = "auth_id"
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER TABLE "public"."campaigns" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published campaigns viewable by everyone." ON "public"."campaigns" FOR SELECT TO authenticated, anon USING ("is_published" = true);
CREATE POLICY "Members can view campaign." ON "public"."campaigns" FOR SELECT TO authenticated USING ("public"."is_campaign_member"("id"));
CREATE POLICY "Owners can manage campaign." ON "public"."campaigns" FOR ALL USING ("auth"."uid"() = "owner_id") WITH CHECK ("auth"."uid"() = "owner_id");
CREATE POLICY "Auth users create campaigns." ON "public"."campaigns" FOR INSERT WITH CHECK ("auth"."role"() = 'authenticated');

ALTER TABLE "public"."campaign_players" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can see other members." ON "public"."campaign_players" FOR SELECT USING ("public"."is_campaign_member"("campaign_id"));
CREATE POLICY "Players can join." ON "public"."campaign_players" FOR INSERT WITH CHECK ("auth"."role"() = 'authenticated');
CREATE POLICY "Owner manage players." ON "public"."campaign_players" FOR ALL USING ("auth"."uid"() = (SELECT "owner_id" FROM "public"."campaigns" WHERE "id" = "campaign_id"));

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."campaigns" TO "authenticated";
GRANT SELECT ON TABLE "public"."campaigns" TO "anon";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."campaign_players" TO "authenticated";
GRANT SELECT ON TABLE "public"."campaign_players" TO "anon";

-- =================================================================
-- BAGIAN 6: THE ATLAS PROTOCOL (MULTIVERSE & MAPS)
-- =================================================================
-- Menggantikan JSONB 'exploration_grid' tunggal.
-- Mendukung banyak peta (Overworld, Dungeon, City).

CREATE TABLE "public"."world_maps" (
    "id" "uuid" PRIMARY KEY DEFAULT "gen_random_uuid"(),
    "campaign_id" "uuid" NOT NULL REFERENCES "public"."campaigns"("id") ON DELETE CASCADE,
    "name" "text" NOT NULL, -- e.g. "Benua A", "Goa B"
    "grid_data" "jsonb" NOT NULL, -- Array 2D Tile IDs
    "fog_data" "jsonb" NOT NULL, -- Array 2D Boolean
    "markers" "jsonb" DEFAULT '[]'::jsonb, -- POI markers
    "is_active" bool DEFAULT false, -- Menandakan peta mana yang sedang dimainkan
    "created_at" timestamptz DEFAULT "now"()
);

ALTER TABLE "public"."world_maps" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view maps." ON "public"."world_maps" FOR SELECT USING ("public"."is_campaign_member"("campaign_id"));
CREATE POLICY "Owner manage maps." ON "public"."world_maps" FOR ALL USING ("auth"."uid"() = (SELECT "owner_id" FROM "public"."campaigns" WHERE "id" = "campaign_id"));

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."world_maps" TO "authenticated";

-- =================================================================
-- BAGIAN 7: THE GRAND LINE (STORY GRAPH ENGINE)
-- =================================================================
-- Menggantikan JSONB 'quests' linear.
-- Mendukung percabangan cerita (Nodes & Edges).

CREATE TABLE "public"."story_nodes" (
    "id" "uuid" PRIMARY KEY DEFAULT "gen_random_uuid"(),
    "campaign_id" "uuid" NOT NULL REFERENCES "public"."campaigns"("id") ON DELETE CASCADE,
    "title" "text" NOT NULL, -- e.g. "Kudeta Alabasta"
    "description" "text",
    "type" "text", -- 'main_arc', 'side_story', 'character_arc'
    "status" "text" DEFAULT 'locked', -- locked, available, active, completed, skipped
    "world_state_change" "jsonb", -- Efek global: { "marine_aggro": 10 }
    "prerequisites" "jsonb" -- Syarat unlock: { "item": "Log Pose" }
);

CREATE TABLE "public"."story_edges" (
    "id" "uuid" PRIMARY KEY DEFAULT "gen_random_uuid"(),
    "from_node_id" "uuid" NOT NULL REFERENCES "public"."story_nodes"("id") ON DELETE CASCADE,
    "to_node_id" "uuid" NOT NULL REFERENCES "public"."story_nodes"("id") ON DELETE CASCADE,
    "condition" "text", -- Naratif: "Jika Luffy menonjok Tenryuubito"
    "is_secret" bool DEFAULT false
);

-- Note: Quest Log Player tetap ada untuk tracking aktif, tapi merujuk ke Node.
CREATE TABLE "public"."active_quests" (
    "id" "uuid" PRIMARY KEY DEFAULT "gen_random_uuid"(),
    "campaign_id" "uuid" NOT NULL REFERENCES "public"."campaigns"("id") ON DELETE CASCADE,
    "story_node_id" "uuid" REFERENCES "public"."story_nodes"("id"), -- Link ke Node Graph
    "title" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'active', -- active, completed, failed
    "reward_summary" "text"
);

ALTER TABLE "public"."story_nodes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."story_edges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."active_quests" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view nodes." ON "public"."story_nodes" FOR SELECT USING ("public"."is_campaign_member"("campaign_id"));
CREATE POLICY "Owner manage nodes." ON "public"."story_nodes" FOR ALL USING ("auth"."uid"() = (SELECT "owner_id" FROM "public"."campaigns" WHERE "id" = "campaign_id"));
-- Edges mengikuti permission nodes (disederhanakan via view nodes, tapi di sini eksplisit ke tabel terkait nodes)
CREATE POLICY "Members view edges." ON "public"."story_edges" FOR SELECT USING (
    EXISTS (SELECT 1 FROM "public"."story_nodes" WHERE "id" = "from_node_id" AND "public"."is_campaign_member"("campaign_id"))
);
CREATE POLICY "Owner manage edges." ON "public"."story_edges" FOR ALL USING (
    EXISTS (SELECT 1 FROM "public"."story_nodes" WHERE "id" = "from_node_id" AND "auth"."uid"() = (SELECT "owner_id" FROM "public"."campaigns" WHERE "id" = "campaign_id"))
);
CREATE POLICY "Members view quests." ON "public"."active_quests" FOR SELECT USING ("public"."is_campaign_member"("campaign_id"));
CREATE POLICY "Owner manage quests." ON "public"."active_quests" FOR ALL USING ("auth"."uid"() = (SELECT "owner_id" FROM "public"."campaigns" WHERE "id" = "campaign_id"));

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."story_nodes" TO "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."story_edges" TO "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."active_quests" TO "authenticated";

-- =================================================================
-- BAGIAN 8: THE BOOK OF SECRETS (CHARACTER ARCS)
-- =================================================================
-- Menyimpan agenda rahasia dan moralitas kompleks.
-- Wajib RLS super ketat.

CREATE TABLE "public"."character_arcs" (
    "id" "uuid" PRIMARY KEY DEFAULT "gen_random_uuid"(),
    "character_id" "uuid" NOT NULL REFERENCES "public"."characters"("id") ON DELETE CASCADE,
    "campaign_id" "uuid" NOT NULL REFERENCES "public"."campaigns"("id") ON DELETE CASCADE,
    
    -- Agenda
    "public_goal" "text", -- Diketahui Party
    "secret_agenda" "text", -- RAHASIA (Hanya Player & DM)
    "true_desire" "text", -- Deepest motivation
    
    -- Mechanics
    "loyalty_score" integer DEFAULT 100, -- 0 = Betrayal
    "breaking_point" "text", -- Trigger AI
    "milestones" "jsonb" DEFAULT '[]'::jsonb, -- Checklist personal
    "is_completed" bool DEFAULT false
);

ALTER TABLE "public"."character_arcs" ENABLE ROW LEVEL SECURITY;

-- Kebijakan RLS "Paranoid":
-- 1. Pemilik karakter BISA melihat & edit.
-- 2. Owner Campaign (DM) BISA melihat & edit.
-- 3. Player LAIN di campaign TIDAK BISA melihat.
CREATE POLICY "Owner & DM access only." ON "public"."character_arcs"
    FOR ALL
    USING (
        "public"."is_character_owner"("character_id") OR 
        "auth"."uid"() = (SELECT "owner_id" FROM "public"."campaigns" WHERE "id" = "campaign_id")
    );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."character_arcs" TO "authenticated";


-- =================================================================
-- BAGIAN 9: RUNTIME LOGS & NPCs
-- =================================================================

CREATE TABLE "public"."campaign_npcs" (
    "id" "uuid" PRIMARY KEY DEFAULT "gen_random_uuid"(),
    "campaign_id" "uuid" NOT NULL REFERENCES "public"."campaigns"("id") ON DELETE CASCADE,
    "name" "text" NOT NULL,
    "description" "text",
    "location" "text",
    "disposition" "text", -- Friendly, Neutral, Hostile
    "interaction_history" "text"[],
    "image_url" "text",
    "secret" "text", -- Fakta tersembunyi NPC
    "opinion" "jsonb" DEFAULT '{}'::jsonb -- { "char_id": 50, "char_id2": -10 }
);

CREATE TABLE "public"."campaign_monsters" (
    "id" "uuid" PRIMARY KEY DEFAULT "gen_random_uuid"(),
    "campaign_id" "uuid" NOT NULL REFERENCES "public"."campaigns"("id") ON DELETE CASCADE,
    "monster_id" "uuid" REFERENCES "public"."monsters"("id"), -- Link ke definisi
    "name" "text",
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
    "type" "text", -- player_action, dm_narration, roll_result
    "character_id" "uuid" REFERENCES "public"."characters"("id") ON DELETE SET NULL,
    "text" "text",
    "roll" "jsonb",
    "reason" "text"
);

CREATE TABLE "public"."campaign_memory" (
    "id" "uuid" PRIMARY KEY DEFAULT "gen_random_uuid"(),
    "campaign_id" "uuid" NOT NULL REFERENCES "public"."campaigns"("id") ON DELETE CASCADE,
    "summary" "text" NOT NULL,
    "tags" "text"[],
    "created_at" timestamptz DEFAULT "now"()
);

ALTER TABLE "public"."campaign_npcs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."campaign_monsters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."game_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."campaign_memory" ENABLE ROW LEVEL SECURITY;

-- Standard Policies
CREATE POLICY "Members view runtime." ON "public"."campaign_npcs" FOR SELECT USING ("public"."is_campaign_member"("campaign_id"));
CREATE POLICY "Owner manage runtime." ON "public"."campaign_npcs" FOR ALL USING ("auth"."uid"() = (SELECT "owner_id" FROM "public"."campaigns" WHERE "id" = "campaign_id"));

CREATE POLICY "Members view monsters." ON "public"."campaign_monsters" FOR SELECT USING ("public"."is_campaign_member"("campaign_id"));
CREATE POLICY "Owner manage monsters." ON "public"."campaign_monsters" FOR ALL USING ("auth"."uid"() = (SELECT "owner_id" FROM "public"."campaigns" WHERE "id" = "campaign_id"));

CREATE POLICY "Members view events." ON "public"."game_events" FOR SELECT USING ("public"."is_campaign_member"("campaign_id"));
CREATE POLICY "Owner manage events." ON "public"."game_events" FOR ALL USING ("auth"."uid"() = (SELECT "owner_id" FROM "public"."campaigns" WHERE "id" = "campaign_id"));

CREATE POLICY "Members view memory." ON "public"."campaign_memory" FOR SELECT USING ("public"."is_campaign_member"("campaign_id"));
CREATE POLICY "Owner manage memory." ON "public"."campaign_memory" FOR ALL USING ("auth"."uid"() = (SELECT "owner_id" FROM "public"."campaigns" WHERE "id" = "campaign_id"));

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."campaign_npcs" TO "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."campaign_monsters" TO "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."game_events" TO "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."campaign_memory" TO "authenticated";

-- =================================================================
-- BAGIAN 10: SEEDING DATA GLOBAL (Items, Spells, Monsters)
-- =================================================================

-- ITEMS
INSERT INTO "public"."items" (name, type, rarity, is_magical, requires_attunement, base_ac, armor_type, stealth_disadvantage, strength_requirement, damage_dice, damage_type, effect, description) VALUES
('Padded Armor', 'armor', 'common', false, false, 11, 'light', true, 0, NULL, NULL, NULL, NULL),
('Leather Armor', 'armor', 'common', false, false, 11, 'light', false, 0, NULL, NULL, NULL, NULL),
('Studded Leather', 'armor', 'common', false, false, 12, 'light', false, 0, NULL, NULL, NULL, NULL),
('Hide Armor', 'armor', 'common', false, false, 12, 'medium', false, 0, NULL, NULL, NULL, NULL),
('Chain Shirt', 'armor', 'common', false, false, 13, 'medium', false, 0, NULL, NULL, NULL, NULL),
('Scale Mail', 'armor', 'common', false, false, 14, 'medium', true, 0, NULL, NULL, NULL, NULL),
('Chain Mail', 'armor', 'common', false, false, 16, 'heavy', true, 13, NULL, NULL, NULL, NULL),
('Plate Armor', 'armor', 'common', false, false, 18, 'heavy', true, 15, NULL, NULL, NULL, NULL),
('Shield', 'armor', 'common', false, false, 2, 'shield', false, 0, NULL, NULL, NULL, NULL),
('Dagger', 'weapon', 'common', false, false, NULL, NULL, false, 0, '1d4', 'piercing', NULL, NULL),
('Mace', 'weapon', 'common', false, false, NULL, NULL, false, 0, '1d6', 'bludgeoning', NULL, NULL),
('Quarterstaff', 'weapon', 'common', false, false, NULL, NULL, false, 0, '1d6', 'bludgeoning', NULL, NULL),
('Light Crossbow', 'weapon', 'common', false, false, NULL, NULL, false, 0, '1d8', 'piercing', NULL, NULL),
('Longsword', 'weapon', 'common', false, false, NULL, NULL, false, 0, '1d8', 'slashing', NULL, NULL),
('Warhammer', 'weapon', 'common', false, false, NULL, NULL, false, 0, '1d8', 'bludgeoning', NULL, NULL),
('Rapier', 'weapon', 'common', false, false, NULL, NULL, false, 0, '1d8', 'piercing', NULL, NULL),
('Shortsword', 'weapon', 'common', false, false, NULL, NULL, false, 0, '1d6', 'piercing', NULL, NULL),
('Shortbow', 'weapon', 'common', false, false, NULL, NULL, false, 0, '1d6', 'piercing', NULL, NULL),
('Longbow', 'weapon', 'common', false, false, NULL, NULL, false, 0, '1d8', 'piercing', NULL, NULL),
('Small Knife', 'weapon', 'common', false, false, NULL, NULL, false, 0, '1d4', 'piercing', NULL, 'Pisau kecil serbaguna.'),
('Bolts', 'other', 'common', false, false, NULL, NULL, false, 0, NULL, NULL, NULL, NULL),
('Arrows', 'other', 'common', false, false, NULL, NULL, false, 0, NULL, NULL, NULL, NULL),
('Potion of Healing', 'consumable', 'common', true, false, NULL, NULL, false, 0, NULL, NULL, '{"type": "heal", "dice": "2d4+2"}', NULL),
('Holy Symbol', 'other', 'common', false, false, NULL, NULL, false, 0, NULL, NULL, NULL, NULL),
('Arcane Focus', 'other', 'common', false, false, NULL, NULL, false, 0, NULL, NULL, NULL, NULL),
('Thieves'' Tools', 'tool', 'common', false, false, NULL, NULL, false, 0, NULL, NULL, NULL, NULL),
('Explorer''s Pack', 'other', 'common', false, false, NULL, NULL, false, 0, NULL, NULL, NULL, NULL),
('Priest''s Pack', 'other', 'common', false, false, NULL, NULL, false, 0, NULL, NULL, NULL, NULL),
('Scholar''s Pack', 'other', 'common', false, false, NULL, NULL, false, 0, NULL, NULL, NULL, NULL),
('Bottle of Black Ink', 'tool', 'common', false, false, NULL, NULL, false, 0, NULL, NULL, NULL, 'Satu botol tinta hitam standar.'),
('Quill', 'tool', 'common', false, false, NULL, NULL, false, 0, NULL, NULL, NULL, 'Pena bulu untuk menulis.'),
('Crowbar', 'tool', 'common', false, false, NULL, NULL, false, 0, NULL, NULL, NULL, NULL),
('Common Clothes (Dark)', 'other', 'common', false, false, NULL, NULL, false, 0, NULL, NULL, NULL, NULL),
('Artisan''s Tools (Tinker''s Tools)', 'tool', 'common', false, false, NULL, NULL, false, 0, NULL, NULL, NULL, NULL),
('Shovel', 'tool', 'common', false, false, NULL, NULL, false, 0, NULL, NULL, NULL, NULL),
('Iron Pot', 'tool', 'common', false, false, NULL, NULL, false, 0, NULL, NULL, NULL, NULL),
('Fine Clothes', 'other', 'common', false, false, NULL, NULL, false, 0, NULL, NULL, NULL, NULL),
('Signet Ring', 'other', 'common', false, false, NULL, NULL, false, 0, NULL, NULL, NULL, NULL),
('Scroll of Pedigree', 'other', 'common', false, false, NULL, NULL, false, 0, NULL, NULL, NULL, NULL),
('Insignia of Rank', 'other', 'common', false, false, NULL, NULL, false, 0, NULL, NULL, NULL, NULL),
('Trophy (Dagger)', 'other', 'common', false, false, NULL, NULL, false, 0, NULL, NULL, NULL, 'Sebuah belati yang diambil sebagai trofi.'),
('Gaming Set (Dice)', 'tool', 'common', false, false, NULL, NULL, false, 0, NULL, NULL, NULL, NULL),
('Gaming Set (Chess)', 'tool', 'common', false, false, NULL, NULL, false, 0, NULL, NULL, NULL, NULL);

-- SPELLS
INSERT INTO "public"."spells" (name, level, school, casting_time, range, components, duration, effect_type, description, damage_dice, damage_type, save_required, save_on_success) VALUES
('Guidance', 0, 'Divination', 'action', 'Touch', '{"V","S"}', 'Concentration, 1 minute', 'buff', 'Target mendapat +1d4 untuk satu ability check pilihannya sebelum spell berakhir.', NULL, NULL, NULL, NULL),
('Light', 0, 'Evocation', 'action', 'Touch', '{"V","M"}', '1 hour', 'utility', 'Objek yang disentuh bersinar seperti obor (20ft bright, 20ft dim) selama 1 jam.', NULL, NULL, NULL, NULL),
('Sacred Flame', 0, 'Evocation', 'action', '60 feet', '{"V","S"}', 'Instantaneous', 'damage', 'Target dalam jangkauan harus lolos DEX save atau terkena 1d8 radiant damage. Target tidak mendapat bonus dari cover.', '1d8', 'radiant', 'dexterity', 'no_effect'),
('Cure Wounds', 1, 'Evocation', 'action', 'Touch', '{"V","S"}', 'Instantaneous', 'heal', 'Makhluk yang disentuh memulihkan 1d8 + MOD HP.', '1d8', NULL, NULL, NULL),
('Healing Word', 1, 'Evocation', 'bonus_action', '60 feet', '{"V"}', 'Instantaneous', 'heal', 'Makhluk yang terlihat memulihkan 1d4 + MOD HP.', '1d4', NULL, NULL, NULL),
('Guiding Bolt', 1, 'Evocation', 'action', '120 feet', '{"V","S"}', '1 round', 'damage', 'Ranged spell attack. Jika kena, 4d6 radiant damage, dan attack roll berikutnya terhadap target ini (sebelum akhir giliranmu berikutnya) memiliki advantage.', '4d6', 'radiant', NULL, NULL),
('Bless', 1, 'Enchantment', 'action', '30 feet', '{"V","S","M"}', 'Concentration, 1 minute', 'buff', 'Hingga 3 makhluk pilihanmu mendapat +1d4 untuk Attack Roll dan Saving Throw.', NULL, NULL, NULL, NULL),
('Shield of Faith', 1, 'Abjuration', 'bonus_action', '60 feet', '{"V","S","M"}', 'Concentration, 10 minutes', 'buff', 'Satu makhluk pilihanmu mendapat +2 AC selama durasi.', NULL, NULL, NULL, NULL),
('Fire Bolt', 0, 'Evocation', 'action', '120 feet', '{"V","S"}', 'Instantaneous', 'damage', 'Ranged spell attack. Jika kena, 1d10 fire damage.', '1d10', 'fire', NULL, NULL),
('Mage Hand', 0, 'Conjuration', 'action', '30 feet', '{"V","S"}', '1 minute', 'utility', 'Membuat tangan spektral yang bisa memanipulasi objek dari jauh.', NULL, NULL, NULL, NULL),
('Ray of Frost', 0, 'Evocation', 'action', '60 feet', '{"V","S"}', 'Instantaneous', 'damage', 'Ranged spell attack. Jika kena, 1d8 cold damage dan speed target berkurang 10 kaki.', '1d8', 'cold', NULL, NULL),
('Magic Missile', 1, 'Evocation', 'action', '120 feet', '{"V","S"}', 'Instantaneous', 'damage', 'Membuat 3 panah sihir, masing-masing 1d4+1 force damage. Otomatis kena.', '3d4+3', 'force', NULL, NULL),
('Shield', 1, 'Abjuration', 'reaction', 'Self', '{"V","S"}', '1 round', 'buff', 'Sebagai reaksi saat terkena serangan, kamu mendapat +5 AC hingga awal giliranmu berikutnya.', NULL, NULL, NULL, NULL),
('Mage Armor', 1, 'Abjuration', 'action', 'Touch', '{"V","S","M"}', '8 hours', 'buff', 'Makhluk yang disentuh (tanpa armor) AC-nya menjadi 13 + DEX modifier.', NULL, NULL, NULL, NULL),
('Sleep', 1, 'Enchantment', 'action', '90 feet', '{"V","S","M"}', '1 minute', 'control', 'Menidurkan makhluk dalam radius 20 kaki, total 5d8 HP, dimulai dari HP terendah.', '5d8', NULL, NULL, NULL);

-- MONSTERS
INSERT INTO "public"."monsters" (name, armor_class, max_hp, ability_scores, skills, senses, languages, challenge_rating, xp, traits, actions) VALUES
('Goblin', 15, 7, '{"strength": 8, "dexterity": 14, "constitution": 10, "intelligence": 10, "wisdom": 8, "charisma": 8}', '{"Stealth": 6}', '{"darkvision": 60, "passivePerception": 9}', '{"Common","Goblin"}', 0.25, 50, '[{"name": "Nimble Escape", "description": "Goblin bisa mengambil aksi Disengage atau Hide sebagai Bonus Action di setiap gilirannya."}]'::jsonb, '[{"name": "Scimitar", "toHitBonus": 4, "damageDice": "1d6+2", "description": "Melee Weapon Attack."}, {"name": "Shortbow", "toHitBonus": 4, "damageDice": "1d6+2", "description": "Ranged Weapon Attack (range 80/320)."}]'::jsonb),
('Orc', 13, 15, '{"strength": 16, "dexterity": 12, "constitution": 16, "intelligence": 7, "wisdom": 11, "charisma": 10}', '{"Intimidation": 2}', '{"darkvision": 60, "passivePerception": 10}', '{"Common","Orc"}', 0.5, 100, '[{"name": "Aggressive", "description": "Sebagai Bonus Action di gilirannya, Orc bisa bergerak hingga speed-nya menuju musuh yang bisa dilihatnya."}]'::jsonb, '[{"name": "Greataxe", "toHitBonus": 5, "damageDice": "1d12+3", "description": "Melee Weapon Attack."}, {"name": "Javelin", "toHitBonus": 5, "damageDice": "1d6+3", "description": "Melee or Ranged Weapon Attack (range 30/120)."}]'::jsonb),
('Skeleton', 13, 13, '{"strength": 10, "dexterity": 14, "constitution": 15, "intelligence": 6, "wisdom": 8, "charisma": 5}', '{}', '{"darkvision": 60, "passivePerception": 9}', '{"understands all languages it knew in life but can''t speak"}', 0.25, 50, '[{"name": "Damage Vulnerabilities", "description": "Bludgeoning"}, {"name": "Damage Immunities", "description": "Poison"}, {"name": "Condition Immunities", "description": "Exhaustion, Poisoned"}]'::jsonb, '[{"name": "Shortsword", "toHitBonus": 4, "damageDice": "1d6+2", "description": "Melee Weapon Attack."}, {"name": "Shortbow", "toHitBonus": 4, "damageDice": "1d6+2", "description": "Ranged Weapon Attack (range 80/320)."}]'::jsonb),
('Wolf', 13, 11, '{"strength": 12, "dexterity": 15, "constitution": 12, "intelligence": 3, "wisdom": 12, "charisma": 6}', '{"Perception": 3, "Stealth": 4}', '{"darkvision": 0, "passivePerception": 13}', '{}', 0.25, 50, '[{"name": "Keen Hearing and Smell", "description": "Wolf punya advantage pada Wisdom (Perception) check yang mengandalkan pendengaran atau penciuman."}, {"name": "Pack Tactics", "description": "Wolf punya advantage pada attack roll terhadap target jika setidaknya satu sekutu Wolf berada dalam 5 kaki dari target dan sekutu itu tidak incapacitated."}]'::jsonb, '[{"name": "Bite", "toHitBonus": 4, "damageDice": "2d4+2", "description": "Melee Weapon Attack. Jika target adalah makhluk, ia harus lolos STR save (DC 11) atau dijatuhkan (Prone)."}]'::jsonb);

-- =================================================================
-- BAGIAN 11: STORAGE SETUP
-- =================================================================

INSERT INTO "storage"."buckets" ("id", "name", "public") VALUES ('assets', 'assets', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "Public Read Access" ON "storage"."objects";
DROP POLICY IF EXISTS "Authenticated Upload" ON "storage"."objects";
DROP POLICY IF EXISTS "Owner Update" ON "storage"."objects";
DROP POLICY IF EXISTS "Owner Delete" ON "storage"."objects";

CREATE POLICY "Public Read Access" ON "storage"."objects" FOR SELECT USING ( "bucket_id" = 'assets' );
CREATE POLICY "Authenticated Upload" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ( "bucket_id" = 'assets' );
CREATE POLICY "Owner Update" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ( "bucket_id" = 'assets' AND "auth"."uid"() = "owner" ) WITH CHECK ( "bucket_id" = 'assets' AND "auth"."uid"() = "owner" );
CREATE POLICY "Owner Delete" ON "storage"."objects" FOR DELETE TO "authenticated" USING ( "bucket_id" = 'assets' AND "auth"."uid"() = "owner" );

-- =================================================================
-- AKHIR DARI SKRIP - MIGRASI TOTAL SELESAI
-- =================================================================