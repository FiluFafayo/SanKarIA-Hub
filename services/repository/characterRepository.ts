import { dataService } from '../dataService';
import { Character, CharacterInventoryItem, SpellDefinition, AbilityScores, CharacterFeature, Skill, Ability } from '../../types';
import { decode } from 'base64-arraybuffer'; // BARU: Impor decoder

type DbCharacter = {
  id: string;
  owner_id: string;
  name: string;
  class: string;
  race: string;
  level: number;
  xp: number;
  avatar_url: string;
  gender: string;
  body_type: string;
  scars: string[];
  hair: string;
  facial_hair: string;
  head_accessory: string;
  background: string;
  personality_trait: string;
  ideal: string;
  bond: string;
  flaw: string;
  ability_scores: AbilityScores;
  max_hp: number;
  current_hp: number;
  temp_hp: number;
  armor_class: number;
  speed: number;
  hit_dice: Record<string, { max: number; spent: number }>;
  death_saves: { successes: number; failures: number };
  conditions: string[];
  racial_traits: CharacterFeature[];
  class_features: CharacterFeature[];
  proficient_skills: Skill[];
  proficient_saving_throws: Ability[];
  spell_slots: any[];
  // PATCH 1: Kolom tambahan
  languages?: string[];
  tool_proficiencies?: string[];
  weapon_proficiencies?: string[];
  armor_proficiencies?: string[];
  senses?: { darkvision?: number; passivePerception?: number; tremorsense?: number; truesight?: number };
  passive_perception?: number;
  inspiration?: boolean;
  prepared_spells?: string[];
  feature_uses?: Record<string, { max: number; spent: number; resetOn: 'short_rest' | 'long_rest' }>;
};

type DbCharacterInventory = {
  id: string;
  character_id: string;
  item_id: string;
  quantity: number;
  is_equipped: boolean;
};

type DbItemDefinition = {
  id: string;
  name: string;
  description?: string;
  type: 'weapon' | 'armor' | 'consumable' | 'tool' | 'other';
  is_magical: boolean;
  rarity: 'common' | 'uncommon' | 'rare' | 'very_rare' | 'legendary';
  requires_attunement: boolean;
  bonuses?: { attack?: number; damage?: number; ac?: number };
  damage_dice?: string;
  damage_type?: string;
  base_ac?: number;
  armor_type?: 'light' | 'medium' | 'heavy' | 'shield';
  stealth_disadvantage?: boolean;
  strength_requirement?: number;
  effect?: { type: 'heal' | 'damage'; dice: string };
};

type DbCharacterInventoryJoined = Omit<DbCharacterInventory, 'item_id'> & { item: DbItemDefinition };

type DbSpellDefinition = {
  id: string;
  name: string;
  level: number;
  description: string;
  casting_time: 'action' | 'bonus_action' | 'reaction' | 'minute' | 'hour';
  range: string;
  components: ('V' | 'S' | 'M')[];
  duration: string;
  school: string;
  effect_type: 'damage' | 'heal' | 'buff' | 'debuff' | 'control' | 'utility';
  damage_dice?: string;
  damage_type?: string;
  save_required?: Ability;
  save_on_success?: 'half_damage' | 'no_effect';
  condition_applied?: string;
};

type DbCharacterSpell = { id: string; character_id: string; spell_id: string };
type DbCharacterSpellJoined = Omit<DbCharacterSpell, 'spell_id'> & { spell: DbSpellDefinition };

const mapDbInventory = (dbInv: DbCharacterInventoryJoined): CharacterInventoryItem => ({
  instanceId: dbInv.id,
  item: {
    id: dbInv.item.id,
    name: dbInv.item.name,
    description: dbInv.item.description,
    type: dbInv.item.type,
    isMagical: dbInv.item.is_magical,
    rarity: dbInv.item.rarity,
    requiresAttunement: dbInv.item.requires_attunement,
    bonuses: dbInv.item.bonuses,
    damageDice: dbInv.item.damage_dice,
    damageType: dbInv.item.damage_type,
    baseAc: dbInv.item.base_ac,
    armorType: dbInv.item.armor_type,
    stealthDisadvantage: dbInv.item.stealth_disadvantage,
    strengthRequirement: dbInv.item.strength_requirement,
    effect: dbInv.item.effect,
  },
  quantity: dbInv.quantity,
  isEquipped: dbInv.is_equipped,
});

const mapDbSpell = (dbSpell: DbCharacterSpellJoined): SpellDefinition => ({
  id: dbSpell.spell.id,
  name: dbSpell.spell.name,
  level: dbSpell.spell.level,
  description: dbSpell.spell.description,
  castingTime: dbSpell.spell.casting_time,
  range: dbSpell.spell.range,
  components: dbSpell.spell.components,
  duration: dbSpell.spell.duration,
  school: dbSpell.spell.school,
  effectType: dbSpell.spell.effect_type,
  damageDice: dbSpell.spell.damage_dice,
  damageType: dbSpell.spell.damage_type,
  saveRequired: dbSpell.spell.save_required,
  saveOnSuccess: dbSpell.spell.save_on_success,
  conditionApplied: dbSpell.spell.condition_applied,
});

const mapDbCharacter = (
  dbChar: DbCharacter,
  allInventory: DbCharacterInventoryJoined[],
  allSpells: DbCharacterSpellJoined[]
): Character => {
  const inventory = allInventory
    .filter((i) => i.character_id === dbChar.id)
    .map((i) => mapDbInventory(i));
  const knownSpells = allSpells
    .filter((s) => s.character_id === dbChar.id)
    .map((s) => mapDbSpell(s));

  return {
    id: dbChar.id,
    ownerId: dbChar.owner_id,
    name: dbChar.name,
    class: dbChar.class,
    race: dbChar.race,
    level: dbChar.level,
    xp: dbChar.xp,
    avatar_url: dbChar.avatar_url,
    gender: dbChar.gender,
    bodyType: dbChar.body_type,
    scars: dbChar.scars,
    hair: dbChar.hair,
    facialHair: dbChar.facial_hair,
    headAccessory: dbChar.head_accessory,
    background: dbChar.background,
    personalityTrait: dbChar.personality_trait,
    ideal: dbChar.ideal,
    bond: dbChar.bond,
    flaw: dbChar.flaw,
    abilityScores: dbChar.ability_scores,
    maxHp: dbChar.max_hp,
    currentHp: dbChar.current_hp,
    tempHp: dbChar.temp_hp,
    armorClass: dbChar.armor_class,
    speed: dbChar.speed,
    hitDice: dbChar.hit_dice,
    deathSaves: dbChar.death_saves,
    conditions: dbChar.conditions || [],
    racialTraits: dbChar.racial_traits || [],
    classFeatures: dbChar.class_features || [],
    proficientSkills: dbChar.proficient_skills || [],
    proficientSavingThrows: dbChar.proficient_saving_throws || [],
    spellSlots: dbChar.spell_slots || [],
    // PATCH 1: bidang baru
    languages: dbChar.languages || [],
    toolProficiencies: dbChar.tool_proficiencies || [],
    weaponProficiencies: dbChar.weapon_proficiencies || [],
    armorProficiencies: dbChar.armor_proficiencies || [],
    senses: dbChar.senses || {},
    passivePerception: dbChar.passive_perception ?? (dbChar.senses?.passivePerception ?? undefined),
    inspiration: dbChar.inspiration ?? false,
    preparedSpells: dbChar.prepared_spells || [],
    featureUses: dbChar.feature_uses || undefined,
    inventory,
    knownSpells,
  };
};

export const characterRepository = {
  async getMyCharacters(userId: string): Promise<Character[]> {
    const supabase = dataService.getClient();

    const { data: charData, error: charError } = await supabase
      .from('characters')
      .select('*')
      .eq('owner_id', userId);

    if (charError) throw charError;
    if (!charData || charData.length === 0) return [];

    const charIds = (charData as DbCharacter[]).map((c) => c.id);

    const { data: inventoryData, error: invError } = await supabase
      .from('character_inventory')
      .select('*, item:item_id!inner(*)')
      .in('character_id', charIds);

    const { data: spellData, error: spellError } = await supabase
      .from('character_spells')
      .select('*, spell:spell_id!inner(*)')
      .in('character_id', charIds);

    if (invError && (invError as any).code !== 'PGRST116') throw invError;
    if (spellError && (spellError as any).code !== 'PGRST116') throw spellError;

    const characters: Character[] = (charData as DbCharacter[]).map((dbChar) =>
      mapDbCharacter(
        dbChar,
        ((inventoryData || []) as unknown as DbCharacterInventoryJoined[]),
        ((spellData || []) as unknown as DbCharacterSpellJoined[])
      )
    );
    return characters;
  },

  async saveCharacter(character: Character): Promise<Character> {
    const supabase = dataService.getClient();
    const { inventory, knownSpells, id, ...coreData } = character as any;

    const dbChar: Omit<DbCharacter, 'id' | 'owner_id'> = {
      name: coreData.name,
      class: coreData.class,
      race: coreData.race,
      level: coreData.level,
      xp: coreData.xp,
      avatar_url: coreData.avatar_url,
      gender: coreData.gender,
      body_type: coreData.bodyType,
      scars: coreData.scars,
      hair: coreData.hair,
      facial_hair: coreData.facialHair,
      head_accessory: coreData.headAccessory,
      background: coreData.background,
      personality_trait: coreData.personalityTrait,
      ideal: coreData.ideal,
      bond: coreData.bond,
      flaw: coreData.flaw,
      ability_scores: coreData.abilityScores,
      max_hp: coreData.maxHp,
      current_hp: coreData.currentHp,
      temp_hp: coreData.tempHp,
      armor_class: coreData.armorClass,
      speed: coreData.speed,
      hit_dice: coreData.hitDice,
      death_saves: coreData.deathSaves,
      conditions: coreData.conditions,
      racial_traits: coreData.racialTraits,
      class_features: coreData.classFeatures,
      proficient_skills: coreData.proficientSkills,
      proficient_saving_throws: coreData.proficientSavingThrows,
      spell_slots: coreData.spellSlots,
      // PATCH 1: bidang baru (opsional)
      languages: coreData.languages,
      tool_proficiencies: coreData.toolProficiencies,
      weapon_proficiencies: coreData.weaponProficiencies,
      armor_proficiencies: coreData.armorProficiencies,
      senses: coreData.senses,
      passive_perception: coreData.passivePerception,
      inspiration: coreData.inspiration,
      prepared_spells: coreData.preparedSpells,
      feature_uses: coreData.featureUses,
    };

    const { data, error } = await supabase
      .from('characters')
      .update(dbChar)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Gagal menyimpan karakter:', error);
      throw error;
    }

    const joinedInventory = (inventory || []).map((i: CharacterInventoryItem) => ({
      id: i.instanceId,
      character_id: id,
      is_equipped: i.isEquipped,
      item: {
        ...i.item,
        is_magical: i.item.isMagical,
        requires_attunement: i.item.requiresAttunement,
        damage_dice: i.item.damageDice,
        damage_type: i.item.damageType,
        base_ac: i.item.baseAc,
        armor_type: i.item.armorType,
        stealth_disadvantage: i.item.stealthDisadvantage,
        strength_requirement: i.item.strengthRequirement,
      },
    })) as DbCharacterInventoryJoined[];

    const joinedSpells = (knownSpells || []).map((s: SpellDefinition) => ({
      id: s.id,
      character_id: id,
      spell: {
        ...s,
        casting_time: s.castingTime,
        effect_type: s.effectType,
        damage_dice: s.damageDice,
        damage_type: s.damageType,
        save_required: s.saveRequired,
        save_on_success: s.saveOnSuccess,
        condition_applied: s.conditionApplied,
      },
    })) as DbCharacterSpellJoined[];

    return mapDbCharacter(
      data as DbCharacter,
      joinedInventory,
      joinedSpells
    );
  },

  async saveNewCharacter(
    charData: Omit<Character, 'id' | 'ownerId' | 'inventory' | 'knownSpells'>,
    inventoryData: Omit<CharacterInventoryItem, 'instanceId'>[],
    spellData: SpellDefinition[],
    ownerId: string
  ): Promise<Character> {
    const supabase = dataService.getClient();

    const { data: allItems } = await supabase.from('items').select('*');
    const { data: allSpells } = await supabase.from('spells').select('*');

    const coreDbChar: Omit<DbCharacter, 'id' | 'owner_id'> = {
      name: charData.name,
      class: charData.class,
      race: charData.race,
      level: charData.level,
      xp: charData.xp,
      avatar_url: charData.avatar_url,
      gender: charData.gender,
      body_type: charData.bodyType,
      scars: charData.scars,
      hair: charData.hair,
      facial_hair: charData.facialHair,
      head_accessory: charData.headAccessory,
      background: charData.background,
      personality_trait: charData.personalityTrait,
      ideal: charData.ideal,
      bond: charData.bond,
      flaw: charData.flaw,
      ability_scores: charData.abilityScores,
      max_hp: charData.maxHp,
      current_hp: charData.currentHp,
      temp_hp: charData.tempHp,
      armor_class: charData.armorClass,
      speed: charData.speed,
      hit_dice: charData.hitDice,
      death_saves: charData.deathSaves,
      conditions: charData.conditions,
      racial_traits: charData.racialTraits,
      class_features: charData.classFeatures,
      proficient_skills: charData.proficientSkills,
      proficient_saving_throws: charData.proficientSavingThrows,
      spell_slots: charData.spellSlots,
      // PATCH 1: bidang baru (opsional)
      languages: charData.languages,
      tool_proficiencies: charData.toolProficiencies,
      weapon_proficiencies: charData.weaponProficiencies,
      armor_proficiencies: charData.armorProficiencies,
      senses: charData.senses,
      passive_perception: charData.passivePerception,
      inspiration: charData.inspiration,
      prepared_spells: charData.preparedSpells,
      feature_uses: charData.featureUses,
    };

    const { data: newDbCharacter, error: charError } = await supabase
      .from('characters')
      .insert({ ...coreDbChar, owner_id: ownerId })
      .select()
      .single();

    if (charError) throw new Error(`Gagal menyimpan karakter baru: ${charError.message}`);

    const newCharacterId = (newDbCharacter as DbCharacter).id;

    const inventoryToInsert = (inventoryData || []).map((inv) => {
      const definition = (allItems || []).find((item: any) => item.name.toLowerCase() === inv.item.name.toLowerCase());
      if (!definition || !definition.id) {
        throw new Error(`[saveNewCharacter] Gagal menemukan ID database yang valid untuk item: ${inv.item.name}`);
      }
      return {
        character_id: newCharacterId,
        item_id: definition.id,
        quantity: inv.quantity,
        is_equipped: inv.isEquipped,
      } as Omit<DbCharacterInventory, 'id'>;
    });

    const spellsToInsert = (spellData || []).map((sp) => {
      const definition = (allSpells || []).find((spell: any) => spell.name.toLowerCase() === sp.name.toLowerCase());
      if (!definition || !definition.id) {
        throw new Error(`[saveNewCharacter] Gagal menemukan ID database yang valid untuk spell: ${sp.name}`);
      }
      return {
        character_id: newCharacterId,
        spell_id: definition.id,
      } as Omit<DbCharacterSpell, 'id'>;
    });

    if (inventoryToInsert.length > 0) {
      const { error: invError } = await supabase.from('character_inventory').insert(inventoryToInsert);
      if (invError) console.error('Gagal menyimpan inventory awal:', invError);
    }
    if (spellsToInsert.length > 0) {
      const { error: spellError } = await supabase.from('character_spells').insert(spellsToInsert);
      if (spellError) console.error('Gagal menyimpan spell awal:', spellError);
    }

    const { data: finalInventory } = await supabase
      .from('character_inventory')
      .select('*, item:item_id!inner(*)')
      .eq('character_id', newCharacterId);
    const { data: finalSpells } = await supabase
      .from('character_spells')
      .select('*, spell:spell_id!inner(*)')
      .eq('character_id', newCharacterId);

    return mapDbCharacter(
      newDbCharacter as DbCharacter,
      ((finalInventory || []) as unknown as DbCharacterInventoryJoined[]),
      ((finalSpells || []) as unknown as DbCharacterSpellJoined[])
    );
  },

  // BARU: Fungsi untuk upload blueprint, butuh 'decode'
  async uploadCharacterBlueprint(characterId: string, base64Data: string): Promise<string> {
    const supabase = dataService.getClient();
    try {
        const contentType = 'image/png';
        const base64String = base64Data.replace('data:image/png;base64,', '');
        const buffer = decode(base64String);
        
        // Simpan di folder 'blueprints' (bucket 'assets' sesuai asumsi dari file lain)
        const filePath = `blueprints/${characterId}_${Date.now()}.png`;

        const { error } = await supabase.storage
            .from('assets') // Asumsi bucket 'assets'
            .upload(filePath, buffer, {
                contentType,
                cacheControl: '600', // Cache 10 menit
                upsert: true
            });

        if (error) {
            console.error('Error uploading blueprint:', error);
            throw error;
        }

        const { data } = supabase.storage
            .from('assets')
            .getPublicUrl(filePath);

        if (!data.publicUrl) {
            throw new Error("Gagal mendapatkan URL publik untuk blueprint.");
        }
        
        console.log(`[SYS] Blueprint diupload ke: ${data.publicUrl}`);
        return data.publicUrl;

    } catch (e) {
        console.error("Kesalahan upload blueprint:", e);
        throw new Error("Gagal meng-upload blueprint karakter.");
    }
  },
};