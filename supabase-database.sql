-- =================================================================
-- SKRIP SQL FINAL (CLEAN, CREATE, SEED) - VERSI 4 (PATCHED)
-- =================================================================

-- =================================================================
-- MANDAT 4.4: CLEAN SLATE (HAPUS SEMUA TABEL LAMA)
-- =================================================================
DROP TABLE IF EXISTS "public"."game_events" CASCADE;
DROP TABLE IF EXISTS "public"."campaign_monsters" CASCADE;
DROP TABLE IF EXISTS "public"."campaign_players" CASCADE;
DROP TABLE IF EXISTS "public"."character_inventory" CASCADE;
DROP TABLE IF EXISTS "public"."character_spells" CASCADE;
DROP TABLE IF EXISTS "public"."campaigns" CASCADE;
DROP TABLE IF EXISTS "public"."characters" CASCADE;
DROP TABLE IF EXISTS "public"."profiles" CASCADE;
DROP TABLE IF EXISTS "public"."items" CASCADE;
DROP TABLE IF EXISTS "public"."spells" CASCADE;
DROP TABLE IF EXISTS "public"."monsters" CASCADE;
DROP FUNCTION IF EXISTS "public"."handle_new_user"() CASCADE;
DROP FUNCTION IF EXISTS "public"."is_character_owner"("character_id_to_check" "uuid") CASCADE;
DROP FUNCTION IF EXISTS "public"."is_campaign_member"("campaign_id_to_check" "uuid") CASCADE;

-- =================================================================
-- BAGIAN 1: TABEL PROFIL & PENGGUNA (Otentikasi)
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
    FOR SELECT USING (true);
CREATE POLICY "Users can insert or update their own profile." ON "public"."profiles"
    FOR ALL USING ("auth"."uid"() = "id")
    WITH CHECK ("auth"."uid"() = "id");

CREATE OR REPLACE FUNCTION "public"."handle_new_user"()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO "public"."profiles" ("id", "email", "full_name", "avatar_url")
    VALUES (
        "new"."id",
        "new"."email",
        "new"."raw_user_meta_data"->>'full_name',
        "new"."raw_user_meta_data"->>'avatar_url'
    );
    RETURN "new";
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER "on_auth_user_created"
    AFTER INSERT ON "auth"."users"
    FOR EACH ROW EXECUTE PROCEDURE "public"."handle_new_user"();

-- =================================================================
-- BAGIAN 2: TABEL DEFINISI GLOBAL (Data Aturan D&D)
-- =================================================================

CREATE TABLE "public"."items" (
    "id" "uuid" PRIMARY KEY DEFAULT "gen_random_uuid"(),
    "name" "text" NOT NULL UNIQUE,
    "description" "text",
    "type" "text" NOT NULL,
    "is_magical" bool DEFAULT false,
    "rarity" "text" DEFAULT 'common',
    "requires_attunement" bool DEFAULT false,
    "bonuses" "jsonb",
    "damage_dice" "text",
    "damage_type" "text",
    "base_ac" integer,
    "armor_type" "text",
    "stealth_disadvantage" bool DEFAULT false,
    "strength_requirement" integer,
    "effect" "jsonb"
);

CREATE TABLE "public"."spells" (
    "id" "uuid" PRIMARY KEY DEFAULT "gen_random_uuid"(),
    "name" "text" NOT NULL UNIQUE,
    "level" integer NOT NULL,
    "description" "text",
    "casting_time" "text",
    "range" "text",
    "components" "text"[],
    "duration" "text",
    "school" "text",
    "effect_type" "text",
    "damage_dice" "text",
    "damage_type" "text",
    "save_required" "text",
    "save_on_success" "text",
    "condition_applied" "text"
);

CREATE TABLE "public"."monsters" (
    "id" "uuid" PRIMARY KEY DEFAULT "gen_random_uuid"(),
    "name" "text" NOT NULL UNIQUE,
    "armor_class" integer,
    "max_hp" integer,
    "ability_scores" "jsonb" NOT NULL,
    "skills" "jsonb",
    "traits" "jsonb" DEFAULT '[]'::jsonb,
    "actions" "jsonb" DEFAULT '[]'::jsonb,
    "senses" "jsonb",
    "languages" "text"[],
    "challenge_rating" real,
    "xp" integer
);

ALTER TABLE "public"."items" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Global definitions are viewable by all." ON "public"."items" FOR SELECT USING (true);
ALTER TABLE "public"."spells" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Global definitions are viewable by all." ON "public"."spells" FOR SELECT USING (true);
ALTER TABLE "public"."monsters" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Global definitions are viewable by all." ON "public"."monsters" FOR SELECT USING (true);

-- =================================================================
-- BAGIAN 3: TABEL KARAKTER (SSoT untuk Player)
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
    -- FASE 0: TAMBAHAN KOLOM VISUAL
    "gender" "text" DEFAULT 'Pria',
    "body_type" "text" DEFAULT 'bt_normal',
    "scars" "text"[] DEFAULT '{}',
    "hair" "text" DEFAULT 'h_short_blond',
    "facial_hair" "text" DEFAULT 'ff_none',
    "head_accessory" "text" DEFAULT 'ha_none',
    -- AKHIR TAMBAHAN
    "background" "text",
    "personality_trait" "text",
    "ideal" "text",
    "bond" "text",
    "flaw" "text",
    "ability_scores" "jsonb" NOT NULL,
    "max_hp" integer NOT NULL,
    "current_hp" integer NOT NULL,
    "temp_hp" integer NOT NULL DEFAULT 0,
    "armor_class" integer NOT NULL,
    "speed" integer NOT NULL,
    "hit_dice" "jsonb" NOT NULL,
    "death_saves" "jsonb" NOT NULL DEFAULT '{"successes": 0, "failures": 0}',
    "conditions" "text"[] NOT NULL DEFAULT '{}',
    "racial_traits" "jsonb" DEFAULT '[]'::jsonb,
    "class_features" "jsonb" DEFAULT '[]'::jsonb,
    "proficient_skills" "text"[] DEFAULT '{}',
    "proficient_saving_throws" "text"[] DEFAULT '{}',
    "spell_slots" "jsonb" DEFAULT '{}',
    -- PATCH 1: Bidang kepatuhan aturan inti D&D
    "languages" "text"[] DEFAULT '{}',
    "tool_proficiencies" "text"[] DEFAULT '{}',
    "weapon_proficiencies" "text"[] DEFAULT '{}',
    "armor_proficiencies" "text"[] DEFAULT '{}',
    "senses" "jsonb" DEFAULT '{}'::jsonb,
    "passive_perception" integer DEFAULT 10,
    "inspiration" bool DEFAULT false,
    "prepared_spells" "jsonb" DEFAULT '[]'::jsonb,
    "feature_uses" "jsonb" DEFAULT '{}'::jsonb
);
ALTER TABLE "public"."characters" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Characters are viewable by everyone." ON "public"."characters"
    FOR SELECT USING (true);
CREATE POLICY "Users can manage their own characters." ON "public"."characters"
    FOR ALL USING ("auth"."uid"() = "owner_id")
    WITH CHECK ("auth"."uid"() = "owner_id");

-- =================================================================
-- BAGIAN 4: TABEL RELASIONAL (Karakter -> Definisi)
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

CREATE OR REPLACE FUNCTION "public"."is_character_owner"("character_id_to_check" "uuid")
RETURNS bool AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM "public"."characters"
        WHERE "id" = "character_id_to_check" AND "owner_id" = "auth"."uid"()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "All character inventories/spells are viewable." ON "public"."character_inventory"
    FOR SELECT USING (true);
CREATE POLICY "All character known spells are viewable." ON "public"."character_spells"
    FOR SELECT USING (true);
CREATE POLICY "Users can manage their own character's inventory." ON "public"."character_inventory"
    FOR ALL USING ( "public"."is_character_owner"("character_id") )
    WITH CHECK ( "public"."is_character_owner"("character_id") );
CREATE POLICY "Users can manage their own character's known spells." ON "public"."character_spells"
    FOR ALL USING ( "public"."is_character_owner"("character_id") )
    WITH CHECK ( "public"."is_character_owner"("character_id") );

-- =================================================================
-- BAGIAN 5: TABEL KAMPANYE (State Sesi Permainan)
-- =================================================================

CREATE TABLE "public"."campaigns" (
    "id" "uuid" PRIMARY KEY DEFAULT "gen_random_uuid"(),
    "owner_id" "uuid" NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "title" "text" NOT NULL,
    "description" "text",
    "cover_url" "text",
    "join_code" "text" UNIQUE,
    "is_published" bool DEFAULT false,
    "dm_personality" "text",
    "dm_narration_style" "text",
    "response_length" "text",
    "game_state" "text" NOT NULL DEFAULT 'exploration',
    "current_player_id" "uuid" REFERENCES "public"."characters"("id") ON DELETE SET NULL,
    "initiative_order" "text"[] DEFAULT '{}',
    "long_term_memory" "text",
    -- FASE 0: UBAH TIPE DATA WAKTU
    "current_time" bigint DEFAULT 43200, -- (Default ke 12:00 PM dalam detik)
    "current_weather" "text" DEFAULT 'Cerah',
    "world_event_counter" integer DEFAULT 0,
    "map_image_url" "text",
    "map_markers" "jsonb"[] DEFAULT '{}',
    "current_player_location" "text",
    -- FASE 0: TAMBAHAN KOLOM PETA
    "exploration_grid" "jsonb" DEFAULT '[]'::jsonb,
    "fog_of_war" "jsonb" DEFAULT '[]'::jsonb,
    "battle_state" "jsonb", -- (Bisa null)
    "player_grid_position" "jsonb" DEFAULT '{"x": 50, "y": 50}'::jsonb,
    -- AKHIR TAMBAHAN
    "quests" "jsonb"[] DEFAULT '{}',
    "npcs" "jsonb"[] DEFAULT '{}',
    "maxPlayers" integer DEFAULT 4,
    "theme" text,
    "mainGenre" text,
    "subGenre" text,
    "duration" text,
    "isNSFW" bool DEFAULT false
);

CREATE TABLE "public"."campaign_players" (
    "id" "uuid" PRIMARY KEY DEFAULT "gen_random_uuid"(),
    "campaign_id" "uuid" NOT NULL REFERENCES "public"."campaigns"("id") ON DELETE CASCADE,
    "character_id" "uuid" NOT NULL REFERENCES "public"."characters"("id") ON DELETE CASCADE,
    UNIQUE("campaign_id", "character_id")
);

CREATE TABLE "public"."campaign_monsters" (
    "id" "uuid" PRIMARY KEY DEFAULT "gen_random_uuid"(),
    "campaign_id" "uuid" NOT NULL REFERENCES "public"."campaigns"("id") ON DELETE CASCADE,
    "monster_id" "uuid" NOT NULL REFERENCES "public"."monsters"("id"),
    "name" "text",
    "current_hp" integer NOT NULL,
    "conditions" "text"[] NOT NULL DEFAULT '{}',
    "initiative" integer
);

CREATE TABLE "public"."game_events" (
    "id" "uuid" PRIMARY KEY DEFAULT "gen_random_uuid"(),
    "campaign_id" "uuid" NOT NULL REFERENCES "public"."campaigns"("id") ON DELETE CASCADE,
    "timestamp" "timestamptz" DEFAULT "now"(),
    "turn_id" "text",
    "type" "text",
    "character_id" "uuid" REFERENCES "public"."characters"("id") ON DELETE SET NULL,
    "text" "text",
    "roll" "jsonb",
    "reason" "text"
);

ALTER TABLE "public"."campaigns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."campaign_players" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."campaign_monsters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."game_events" ENABLE ROW LEVEL SECURITY;

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
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "Published campaigns are viewable by everyone." ON "public"."campaigns"
    FOR SELECT USING ("is_published" = true);
CREATE POLICY "Campaign members can view their campaign." ON "public"."campaigns"
    FOR SELECT USING ( "public"."is_campaign_member"("id") );
CREATE POLICY "Campaign owners can manage their campaign." ON "public"."campaigns"
    FOR ALL USING ("auth"."uid"() = "owner_id")
    WITH CHECK ("auth"."uid"() = "owner_id");
CREATE POLICY "Authenticated users can create campaigns." ON "public"."campaigns"
    FOR INSERT WITH CHECK ("auth"."role"() = 'authenticated');
    
CREATE POLICY "Campaign members can see related data." ON "public"."game_events"
    FOR SELECT USING ( "public"."is_campaign_member"("campaign_id") );
CREATE POLICY "Campaign members can see related data." ON "public"."campaign_monsters"
    FOR SELECT USING ( "public"."is_campaign_member"("campaign_id") );
CREATE POLICY "Campaign members can see related data." ON "public"."campaign_players"
    FOR SELECT USING ( "public"."is_campaign_member"("campaign_id") );

-- PERBAIKAN RLS: Kebijakan ini sekarang merujuk ke owner_id yang benar
CREATE POLICY "Campaign owners can manage campaign data." ON "public"."game_events"
    FOR ALL USING ( "auth"."uid"() = (SELECT "owner_id" FROM "public"."campaigns" WHERE "id" = "campaign_id") );
CREATE POLICY "Campaign owners can manage campaign data." ON "public"."campaign_monsters"
    FOR ALL USING ( "auth"."uid"() = (SELECT "owner_id" FROM "public"."campaigns" WHERE "id" = "campaign_id") );
CREATE POLICY "Campaign owners can manage campaign data." ON "public"."campaign_players"
    FOR ALL USING ( "auth"."uid"() = (SELECT "owner_id" FROM "public"."campaigns" WHERE "id" = "campaign_id") );

CREATE POLICY "Authenticated users can join campaigns." ON "public"."campaign_players"
    FOR INSERT WITH CHECK ("auth"."role"() = 'authenticated');

-- =================================================================
-- BAGIAN 6: SEEDING DATA GLOBAL (MANUAL)
-- =================================================================

ALTER TABLE "public"."items" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."spells" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."monsters" DISABLE ROW LEVEL SECURITY;

-- 1. SEEDING ITEMS (Termasuk SEMUA item background)
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

-- 2. SEEDING SPELLS
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

-- 3. SEEDING MONSTERS (Menggunakan '::jsonb' cast)
INSERT INTO "public"."monsters" (name, armor_class, max_hp, ability_scores, skills, senses, languages, challenge_rating, xp, traits, actions) VALUES
('Goblin', 15, 7, '{"strength": 8, "dexterity": 14, "constitution": 10, "intelligence": 10, "wisdom": 8, "charisma": 8}', '{"Stealth": 6}', '{"darkvision": 60, "passivePerception": 9}', '{"Common","Goblin"}', 0.25, 50, '[{"name": "Nimble Escape", "description": "Goblin bisa mengambil aksi Disengage atau Hide sebagai Bonus Action di setiap gilirannya."}]'::jsonb, '[{"name": "Scimitar", "toHitBonus": 4, "damageDice": "1d6+2", "description": "Melee Weapon Attack."}, {"name": "Shortbow", "toHitBonus": 4, "damageDice": "1d6+2", "description": "Ranged Weapon Attack (range 80/320)."}]'::jsonb),
('Orc', 13, 15, '{"strength": 16, "dexterity": 12, "constitution": 16, "intelligence": 7, "wisdom": 11, "charisma": 10}', '{"Intimidation": 2}', '{"darkvision": 60, "passivePerception": 10}', '{"Common","Orc"}', 0.5, 100, '[{"name": "Aggressive", "description": "Sebagai Bonus Action di gilirannya, Orc bisa bergerak hingga speed-nya menuju musuh yang bisa dilihatnya."}]'::jsonb, '[{"name": "Greataxe", "toHitBonus": 5, "damageDice": "1d12+3", "description": "Melee Weapon Attack."}, {"name": "Javelin", "toHitBonus": 5, "damageDice": "1d6+3", "description": "Melee or Ranged Weapon Attack (range 30/120)."}]'::jsonb),
('Skeleton', 13, 13, '{"strength": 10, "dexterity": 14, "constitution": 15, "intelligence": 6, "wisdom": 8, "charisma": 5}', '{}', '{"darkvision": 60, "passivePerception": 9}', '{"understands all languages it knew in life but can''t speak"}', 0.25, 50, '[{"name": "Damage Vulnerabilities", "description": "Bludgeoning"}, {"name": "Damage Immunities", "description": "Poison"}, {"name": "Condition Immunities", "description": "Exhaustion, Poisoned"}]'::jsonb, '[{"name": "Shortsword", "toHitBonus": 4, "damageDice": "1d6+2", "description": "Melee Weapon Attack."}, {"name": "Shortbow", "toHitBonus": 4, "damageDice": "1d6+2", "description": "Ranged Weapon Attack (range 80/320)."}]'::jsonb),
('Wolf', 13, 11, '{"strength": 12, "dexterity": 15, "constitution": 12, "intelligence": 3, "wisdom": 12, "charisma": 6}', '{"Perception": 3, "Stealth": 4}', '{"darkvision": 0, "passivePerception": 13}', '{}', 0.25, 50, '[{"name": "Keen Hearing and Smell", "description": "Wolf punya advantage pada Wisdom (Perception) check yang mengandalkan pendengaran atau penciuman."}, {"name": "Pack Tactics", "description": "Wolf punya advantage pada attack roll terhadap target jika setidaknya satu sekutu Wolf berada dalam 5 kaki dari target dan sekutu itu tidak incapacitated."}]'::jsonb, '[{"name": "Bite", "toHitBonus": 4, "damageDice": "2d4+2", "description": "Melee Weapon Attack. Jika target adalah makhluk, ia harus lolos STR save (DC 11) atau dijatuhkan (Prone)."}]'::jsonb);

-- Nyalakan kembali RLS
ALTER TABLE "public"."items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."spells" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."monsters" ENABLE ROW LEVEL SECURITY;

-- =================================================================
-- BAGIAN 7: SETUP STORAGE (BARU - FIX BUCKET NOT FOUND V2)
-- =================================================================
-- Versi ini menghapus 'ALTER TABLE "storage"."objects"' yang menyebabkan error 42501.
-- Kita berasumsi RLS di storage.objects sudah aktif by default.

-- 1. Buat bucket 'assets' dan set 'public'
-- Ini memperbaiki error "Bucket not found"
INSERT INTO "storage"."buckets"
    ("id", "name", "public")
VALUES
    ('assets', 'assets', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- 2. Kebijakan RLS untuk bucket 'assets'
-- Hapus policy lama jika ada (untuk idempotency)
DROP POLICY IF EXISTS "Public Read Access" ON "storage"."objects";
DROP POLICY IF EXISTS "Authenticated Upload" ON "storage"."objects";
DROP POLICY IF EXISTS "Owner Update" ON "storage"."objects";
DROP POLICY IF EXISTS "Owner Delete" ON "storage"."objects";

-- Siapapun boleh MEMBACA (SELECT) file dari bucket 'assets' (karena public)
CREATE POLICY "Public Read Access"
    ON "storage"."objects" FOR SELECT
    USING ( "bucket_id" = 'assets' );

-- Hanya pengguna TERAUTENTIKASI (login) yang boleh MENG-UPLOAD (INSERT)
CREATE POLICY "Authenticated Upload"
    ON "storage"."objects" FOR INSERT
    TO "authenticated"
    WITH CHECK ( "bucket_id" = 'assets' );

-- Hanya PEMILIK file yang boleh MENG-UPDATE file-nya
CREATE POLICY "Owner Update"
    ON "storage"."objects" FOR UPDATE
    TO "authenticated"
    USING ( "bucket_id" = 'assets' AND "auth"."uid"() = "owner" )
    WITH CHECK ( "bucket_id" = 'assets' AND "auth"."uid"() = "owner" );

-- Hanya PEMILIK file yang boleh MENG-HAPUS file-nya
CREATE POLICY "Owner Delete"
    ON "storage"."objects" FOR DELETE
    TO "authenticated"
    USING ( "bucket_id" = 'assets' AND "auth"."uid"() = "owner" );