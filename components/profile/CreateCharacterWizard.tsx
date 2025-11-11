import React, { useMemo, useState, useEffect } from "react";
import {
  Character,
  Ability,
  Skill,
  ALL_ABILITIES,
  AbilityScores,
  CharacterInventoryItem,
  SpellDefinition,
  ItemDefinition,
} from "../../types";
import {
  getAllRaces,
  getAllClasses,
  getAllBackgrounds,
  getItemDef,
  findRace,
  findClass,
  findBackground,
  findSpell,
  RaceData,
  ClassData,
  BackgroundData,
  getRawCharacterTemplates,
  RawCharacterData,
  EquipmentChoice,
} from "../../data/registry";
import { SelectionCard } from "../SelectionCard";
import { AbilityRoller } from "./AbilityRoller";
import { SPRITE_PARTS } from "../../data/spriteParts";
import { renderCharacterLayout } from "../../services/pixelRenderer";
import { generationService } from "../../services/ai/generationService";
import { getAbilityModifier } from "../../utils";

const createInvItem = (
  def: ItemDefinition,
  qty = 1,
  equipped = false
): Omit<CharacterInventoryItem, "instanceId"> => ({
  item: def,
  quantity: qty,
  isEquipped: equipped,
});

const getDefaultEquipment = (
  charClass: ClassData
): Record<number, EquipmentChoice["options"][0]> => {
  const defaults: Record<number, EquipmentChoice["options"][0]> = {};
  charClass.startingEquipment.choices.forEach((choice, idx) => {
    defaults[idx] = choice.options[0];
  });
  return defaults;
};

export const CreateCharacterWizard: React.FC<{
  onCancel: () => void;
  userId: string;
  onSaveNewCharacter: (
    charData: Omit<Character, "id" | "ownerId" | "inventory" | "knownSpells">,
    inventoryData: Omit<CharacterInventoryItem, "instanceId">[],
    spellData: SpellDefinition[]
  ) => Promise<Character>;
  templateToPreFill?: RawCharacterData | null;
  clearTemplateToPreFill?: () => void;
}> = ({
  onCancel,
  userId,
  onSaveNewCharacter,
  templateToPreFill,
  clearTemplateToPreFill,
}) => {
  const RACES: RaceData[] = useMemo(() => getAllRaces() || [], []);
  const CLASS_DEFINITIONS: Record<string, ClassData> = useMemo(
    () => getAllClasses() || {},
    []
  );
  const BACKGROUNDS: BackgroundData[] = useMemo(
    () => getAllBackgrounds() || [],
    []
  );

  const [step, setStep] = useState(1);
  const [statusMessage, setStatusMessage] = useState("");
  const TOTAL_STEPS = 7;
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"Pria" | "Wanita">("Pria");
  const [hair, setHair] = useState("h_short_blond");
  const [facialHair, setFacialHair] = useState("ff_none");
  const [headAccessory, setHeadAccessory] = useState("ha_none");
  const [bodyType, setBodyType] = useState("bt_normal");
  const [scars, setScars] = useState<string[]>([]);

  const [selectedRace, setSelectedRace] = useState<RaceData>(
    () => findRace("Human") || RACES[0]
  );
  const [selectedClass, setSelectedClass] = useState<ClassData>(
    () => findClass("Fighter") || Object.values(CLASS_DEFINITIONS)[0]
  );
  const [abilityScores, setAbilityScores] = useState<Partial<AbilityScores>>({});
  // Patch 2: mode generasi kemampuan
  const [abilityMethod, setAbilityMethod] = useState<"roll" | "array" | "pointbuy">("roll");
  const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
  const [arrayAssignments, setArrayAssignments] = useState<Record<Ability, number>>({} as any);
  const [pointBuyScores, setPointBuyScores] = useState<Record<Ability, number>>({
    strength: 8,
    dexterity: 8,
    constitution: 8,
    intelligence: 8,
    wisdom: 8,
    charisma: 8,
  } as any);
  const pointBuyCost = (score: number) => {
    if (score <= 8) return 0;
    if (score === 9) return 1;
    if (score === 10) return 2;
    if (score === 11) return 3;
    if (score === 12) return 4;
    if (score === 13) return 5;
    if (score === 14) return 7;
    if (score === 15) return 9;
    return Infinity;
  };
  const totalPointBuySpent = useMemo(
    () => ALL_ABILITIES.reduce((sum, ab) => sum + pointBuyCost(pointBuyScores[ab as Ability]), 0),
    [pointBuyScores]
  );
  const remainingPointBuy = 27 - totalPointBuySpent;
  const [selectedBackground, setSelectedBackground] = useState<BackgroundData>(
    () => findBackground("Acolyte") || BACKGROUNDS[0]
  );
  const [selectedSkills, setSelectedSkills] = useState<Skill[]>([]);
  // Patch 2: Bahasa dan alat
  const ALL_LANGUAGES = [
    "Common",
    "Dwarvish",
    "Elvish",
    "Halfling",
    "Infernal",
    "Orc",
    "Gnomish",
    "Draconic",
    "Goblin",
    "Sylvan",
    "Celestial",
    "Undercommon",
  ];
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const TOOL_OPTIONS = [
    "Thieves' Tools",
    "Artisan's Tools",
    "Navigator's Tools",
    "Herbalism Kit",
    "Musical Instrument",
  ];
  const [selectedTools, setSelectedTools] = useState<string[]>([]);

  // Patch 2: Mode pembuatan (Manual vs AI Assist)
  const [creationMode, setCreationMode] = useState<"manual" | "ai">("manual");

  // Patch 2: Prepared spells selection (manual)
  const [selectedPreparedSpells, setSelectedPreparedSpells] = useState<string[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<
    Record<number, EquipmentChoice["options"][0]>
  >(() =>
    getDefaultEquipment(
      findClass("Fighter") || Object.values(CLASS_DEFINITIONS)[0]
    )
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const templates = getRawCharacterTemplates();

  const setCharacterStep = setStep;
  const setAbilityScore = (ability: Ability, score: number) => {
    setAbilityScores((prev) => ({ ...prev, [ability]: score }));
  };
  const toggleScar = (partId: string) => {
    setScars((currentScars) => {
      const newScars = currentScars.includes(partId)
        ? currentScars.filter((s) => s !== partId)
        : [...currentScars, partId];
      return newScars;
    });
  };
  const handleClassChange = (className: string) => {
    const newClass = CLASS_DEFINITIONS[className] || CLASS_DEFINITIONS["Fighter"];
    setSelectedClass(newClass);
    setSelectedSkills([]);
    setSelectedEquipment(getDefaultEquipment(newClass));
  };

  const abilitiesToRoll = useMemo(() => ALL_ABILITIES, []);
  const currentAbilityIndex = Object.keys(abilityScores).length;

  const handleAbilityRollComplete = (ability: Ability, score: number) => {
    setAbilityScore(ability, score);
    if (currentAbilityIndex === abilitiesToRoll.length - 1) {
      setCharacterStep(4);
    }
  };

  const preFillData = (template: RawCharacterData) => {
    setStatusMessage(`Memuat ${template.name}...`);
    setName(template.name);
    setGender(template.gender);
    setHair(template.hair);
    setFacialHair(template.facialHair);
    setHeadAccessory(template.headAccessory);
    setBodyType(template.bodyType);
    setScars(template.scars || []);

    const race = findRace(template.race);
    if (race) setSelectedRace(race);

    const classData = findClass(template.class);
    if (classData) {
      setSelectedClass(classData);
      const templateEquipment: Record<number, EquipmentChoice["options"][0]> = {};
      classData.startingEquipment.choices.forEach((choice, index) => {
        const chosenOptionName = template.startingEquipment?.[index];
        const foundOption = choice.options.find((opt) => opt.name === chosenOptionName);
        templateEquipment[index] = foundOption || choice.options[0];
      });
      setSelectedEquipment(templateEquipment);
    } else {
      setSelectedEquipment(getDefaultEquipment(findClass("Fighter")!));
    }

    const background = findBackground(template.background);
    if (background) setSelectedBackground(background);

    setAbilityScores(template.abilityScores);
    setSelectedSkills(template.proficientSkills);
    // Patch 2: bahasa default dari ras
    const defaults: string[] = [];
    if (selectedRace.name === "Human") defaults.push("Common");
    if (selectedRace.name === "Elf") defaults.push("Common", "Elvish");
    if (selectedRace.name === "Dwarf") defaults.push("Common", "Dwarvish");
    if (selectedRace.name === "Halfling") defaults.push("Common", "Halfling");
    if (selectedRace.name === "Tiefling") defaults.push("Common", "Infernal");
    setSelectedLanguages(defaults);

    setStatusMessage("");
  };

  useEffect(() => {
    if (templateToPreFill) {
      preFillData(templateToPreFill);
      setStep(7);
      clearTemplateToPreFill?.();
    }
  }, [templateToPreFill, clearTemplateToPreFill]);

  const handleTemplateCopy = (template: RawCharacterData) => {
    setIsCopying(true);
    preFillData(template);
    setStep(7);
    setIsCopying(false);
  };

  const handleSave = async () => {
    // Validasi dan kunci skor kemampuan berdasarkan metode
    let finalBaseScores: AbilityScores;
    if (abilityMethod === "roll") {
      if (Object.keys(abilityScores).length !== 6) {
        setStatusMessage("ERROR: Selesaikan pelemparan semua dadu kemampuan.");
        return;
      }
      finalBaseScores = abilityScores as AbilityScores;
    } else if (abilityMethod === "array") {
      const allAssigned = ALL_ABILITIES.every((ab) => typeof arrayAssignments[ab as Ability] === "number");
      if (!allAssigned) {
        setStatusMessage("ERROR: Tetapkan semua nilai Standard Array ke kemampuan.");
        return;
      }
      finalBaseScores = arrayAssignments as AbilityScores;
    } else {
      if (remainingPointBuy < 0) {
        setStatusMessage("ERROR: Point Buy melebihi 27 poin.");
        return;
      }
      finalBaseScores = pointBuyScores as AbilityScores;
    }

    setIsSaving(true);
    setStatusMessage("Merakit jiwa...");

    try {
      const baseScores = finalBaseScores;
      const finalScores = { ...baseScores } as AbilityScores;
      for (const [ability, bonus] of Object.entries(
        selectedRace.abilityScoreBonuses
      )) {
        if (typeof bonus === "number") finalScores[ability as Ability] += bonus;
      }
      const profSkills = new Set<Skill>([
        ...selectedBackground.skillProficiencies,
        ...(selectedRace.proficiencies?.skills || []),
        ...selectedSkills,
      ]);
      const conModifier = getAbilityModifier(finalScores.constitution);
      const dexModifier = getAbilityModifier(finalScores.dexterity);
      const maxHp = selectedClass.hpAtLevel1(conModifier);
      let inventoryData: Omit<CharacterInventoryItem, "instanceId">[] = [];

      selectedClass.startingEquipment.fixed.forEach((item) => {
        try {
          inventoryData.push(createInvItem(getItemDef(item.itemName), item.quantity));
        } catch (e) {
          console.warn(e);
        }
      });
      Object.values(selectedEquipment).forEach((chosenOption) => {
        chosenOption.itemNames.forEach((itemName) => {
          try {
            inventoryData.push(
              createInvItem(getItemDef(itemName), chosenOption.quantity || 1)
            );
          } catch (e) {
            console.warn(e);
          }
        });
      });
      selectedBackground.equipment.forEach((itemName) => {
        try {
          inventoryData.push(createInvItem(getItemDef(itemName)));
        } catch (e) {
          console.warn(e);
        }
      });

      let armorClass = 10 + dexModifier;
      let equippedArmorDef: ItemDefinition | null = null;
      const armorIndex = inventoryData.findIndex(
        (i) => i.item.type === "armor" && i.item.armorType !== "shield"
      );
      const shieldIndex = inventoryData.findIndex((i) => i.item.name === "Shield");
      if (armorIndex > -1) {
        inventoryData[armorIndex].isEquipped = true;
        equippedArmorDef = inventoryData[armorIndex].item;
      }
      if (shieldIndex > -1) {
        inventoryData[shieldIndex].isEquipped = true;
      }
      if (equippedArmorDef) {
        const baseAc = equippedArmorDef.baseAc || 10;
        if (equippedArmorDef.armorType === "light") armorClass = baseAc + dexModifier;
        else if (equippedArmorDef.armorType === "medium") armorClass = baseAc + Math.min(2, dexModifier);
        else if (equippedArmorDef.armorType === "heavy") armorClass = baseAc;
      }
      if (shieldIndex > -1) armorClass += 2;
      // Patch 2: bonus AC dari item yang dipakai
      const equippedItemsWithBonus = inventoryData.filter(
        (i) => i.isEquipped && i.item.bonuses?.ac
      );
      equippedItemsWithBonus.forEach((i) => {
        armorClass += i.item.bonuses!.ac || 0;
      });

      const spellSlots = selectedClass.spellcasting?.spellSlots || [];

      const spellData: SpellDefinition[] = [];
      (selectedClass.spellcasting?.knownCantrips || []).forEach((spellName) => {
        const def = findSpell(spellName);
        if (def) {
          spellData.push(def);
        } else {
          console.warn(`[ProfileWizard] Gagal menemukan definisi spell: ${spellName}`);
        }
      });
      (selectedClass.spellcasting?.knownSpells || []).forEach((spellName) => {
        const def = findSpell(spellName);
        if (def) {
          spellData.push(def);
        } else {
          console.warn(`[ProfileWizard] Gagal menemukan definisi spell: ${spellName}`);
        }
      });

      // Patch 2: Passive Perception & Senses
      const wisMod = getAbilityModifier(finalScores.wisdom);
      const hasPerceptionProf = Array.from(profSkills).includes(Skill.Perception);
      const passivePerception = 10 + wisMod + (hasPerceptionProf ? 2 : 0);
      const senses: { darkvision?: number } = {};
      if (selectedRace.senses?.darkvision) senses.darkvision = selectedRace.senses.darkvision;

      // Bahasa akhir (AI Assist menambahkan saran)
      let finalLanguages = selectedLanguages;
      if (creationMode === "ai") {
        const defaults = new Set(finalLanguages);
        if (selectedRace.name === "Human") defaults.add("Common");
        if (selectedBackground.name.toLowerCase().includes("acolyte")) defaults.add("Celestial");
        finalLanguages = Array.from(defaults);
      }

      const newCharData: Omit<
        Character,
        "id" | "ownerId" | "inventory" | "knownSpells"
      > = {
        name,
        class: selectedClass.name,
        race: selectedRace.name,
        level: 1,
        xp: 0,
        image: selectedRace.img,
        background: selectedBackground.name,
        gender: gender,
        bodyType: bodyType,
        scars: scars,
        hair: hair,
        facialHair: facialHair,
        headAccessory: headAccessory,
        personalityTrait: "",
        ideal: "",
        bond: "",
        flaw: "",
        abilityScores: finalScores,
        maxHp: Math.max(1, maxHp),
        currentHp: Math.max(1, maxHp),
        tempHp: 0,
        armorClass: armorClass,
        speed: selectedRace.speed,
        hitDice: { [selectedClass.hitDice]: { max: 1, spent: 0 } },
        deathSaves: { successes: 0, failures: 0 },
        conditions: [],
        racialTraits: selectedRace.traits,
        classFeatures: selectedClass.features,
        proficientSkills: Array.from(profSkills),
        proficientSavingThrows: selectedClass.proficiencies.savingThrows,
        spellSlots: spellSlots,
        // Patch 2: isi bidang tambahan (Patch 1)
        languages: finalLanguages,
        toolProficiencies: selectedTools,
        weaponProficiencies: (selectedRace.proficiencies?.weapons || []).concat(
          selectedClass.proficiencies.weapons as any
        ),
        armorProficiencies: selectedClass.proficiencies.armor as any,
        senses,
        passivePerception,
        inspiration: false,
        preparedSpells: [],
        featureUses: undefined,
      };

      setStatusMessage("Merender layout piksel...");
      const layout = renderCharacterLayout(newCharData as Character);

      setStatusMessage("Menghubungi AI untuk visual...");
      const VISUAL_STYLE_PROMPT =
        "digital painting, fantasy art, detailed, high quality, vibrant colors, style of D&D 5e sourcebooks, character portrait, full body";
      const getPartName = (arr: any[], id: string) =>
        arr.find((p) => p.id === id)?.name || "";
      const prompt = `Potret HD, ${newCharData.gender} ${newCharData.race} ${newCharData.class}, ${getPartName(
        SPRITE_PARTS.hair,
        newCharData.hair
      )}, ${getPartName(SPRITE_PARTS.facial_feature, newCharData.facialHair)}, ${newCharData.scars
        .map((id) => getPartName(SPRITE_PARTS.facial_feature, id))
        .join(", ")}, ${VISUAL_STYLE_PROMPT}`;

      const imageUrl = await generationService.stylizePixelLayout(
        layout,
        prompt,
        "Sprite"
      );
      newCharData.image = imageUrl;

      // Patch 2: auto/pilihan prepared spells untuk kelas yang menyiapkan
      const PREPARING_CLASSES: Record<string, Ability> = {
        Cleric: Ability.Wisdom,
        Druid: Ability.Wisdom,
        Paladin: Ability.Charisma,
        Ranger: Ability.Wisdom,
        Wizard: Ability.Intelligence,
      };
      if (selectedClass.spellcasting && PREPARING_CLASSES[selectedClass.name]) {
        const spellAbility = PREPARING_CLASSES[selectedClass.name];
        const mod = getAbilityModifier(finalScores[spellAbility]);
        const maxPrepared = Math.max(1, 1 + mod);
        const candidates = (selectedClass.spellcasting.knownSpells || [])
          .map((nm) => findSpell(nm))
          .filter((s): s is SpellDefinition => !!s && s.level === 1);
        let prepared: string[];
        if (creationMode === "ai" && selectedPreparedSpells.length === 0) {
          prepared = candidates
            .sort((a, b) => (a.name < b.name ? -1 : 1))
            .slice(0, maxPrepared)
            .map((s) => s.name);
        } else if (selectedPreparedSpells.length > 0) {
          prepared = selectedPreparedSpells.slice(0, maxPrepared);
        } else {
          prepared = candidates.slice(0, maxPrepared).map((s) => s.name);
        }
        newCharData.preparedSpells = prepared;
      }

      setStatusMessage("Menyimpan ke database...");
      await onSaveNewCharacter(newCharData, inventoryData, spellData);
    } catch (e: any) {
      console.error("Gagal finalisasi karakter:", e);
      setStatusMessage(`ERROR: Gagal menyimpan karakter. ${e.message || "Coba lagi."}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    if (step > 2) {
      setCharacterStep(step - 1);
    } else if (step === 2) {
      setCharacterStep(1);
    } else {
      onCancel();
    }
  };

  const handleSkillToggle = (skill: Skill) => {
    const limit = selectedClass.proficiencies.skills.choices;
    setSelectedSkills((currentSkills) => {
      const newSkills = currentSkills.includes(skill)
        ? currentSkills.filter((s) => s !== skill)
        : currentSkills.length < limit
        ? [...currentSkills, skill]
        : currentSkills;

      if (newSkills.length > limit) {
        console.warn(`Anda hanya bisa memilih ${limit} skill.`);
        return currentSkills;
      }
      return newSkills;
    });
  };

  const handleEquipmentSelect = (choiceIndex: number, optionIndex: number) => {
    setSelectedEquipment((prev) => ({
      ...prev,
      [choiceIndex]: selectedClass.startingEquipment.choices[choiceIndex].options[
        optionIndex
      ],
    }));
  };

  return (
    <div className="w-full h-full flex flex-col">
      <h3 className="font-cinzel text-2xl text-blue-200 mb-4 text-center pt-4">
        Menciptakan Jiwa Baru (Langkah {step}/{TOTAL_STEPS})
      </h3>

      {step > 1 && (
        <button
          onClick={handleBack}
          className="absolute top-4 left-4 font-cinzel text-gray-300 hover:text-white z-10"
        >
          &larr; Kembali
        </button>
      )}

      {step === 1 && (
        <div className="p-4 flex flex-col items-center flex-grow animate-fade-in-fast">
          <h3 className="font-cinzel text-xl text-blue-200 mb-4">Bagaimana Anda ingin memulai?</h3>
          <button
            onClick={() => setStep(2)}
            disabled={isCopying}
            className="w-full max-w-sm font-cinzel text-lg bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-lg shadow-lg disabled:bg-gray-600"
          >
            Mulai dari Awal
          </button>

          <div className="mt-4 w-full max-w-sm">
            <label className="block mb-1 font-cinzel text-sm">Mode Pembuatan</label>
            <select
              value={creationMode}
              onChange={(e) => setCreationMode(e.target.value as any)}
              className="w-full bg-black/50 border border-blue-400 rounded px-2 py-1"
            >
              <option value="manual">Manual</option>
              <option value="ai">AI Assist</option>
            </select>
          </div>

          <div className="flex items-center gap-4 my-4 w-full max-w-sm">
            <div className="flex-grow border-t border-blue-400/30"></div>
            <span className="text-blue-200/70 text-sm">ATAU</span>
            <div className="flex-grow border-t border-blue-400/30"></div>
          </div>

          <h4 className="font-cinzel text-lg mb-2">Pilih dari Template</h4>
          {statusMessage && (
            <p
              className={`text-center text-sm mb-2 ${statusMessage.startsWith("ERROR:") ? "text-red-400" : "text-amber-300"}`}
            >
              {statusMessage}
            </p>
          )}

          <div className="grid grid-cols-3 gap-4 w-full max-w-sm">
            {templates.map((template) => (
              <div key={template.name} className="relative">
                <SelectionCard
                  key={template.name}
                  title={template.name}
                  description={`${template.race} ${template.class}`}
                  imageUrl={template.image}
                  isSelected={isCopying && statusMessage.includes(template.name)}
                  onClick={() => !isCopying && handleTemplateCopy(template)}
                />
                {isCopying && statusMessage.includes(template.name) && (
                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center rounded-lg animate-fade-in-fast">
                    <div className="w-8 h-8 border-2 border-t-amber-400 border-gray-600 rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex-grow"></div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col flex-grow animate-fade-in-fast p-4">
          <div className="grid grid-cols-2 gap-x-4">
            <div>
              <label className="block mb-1 font-cinzel text-sm">Nama</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-black/50 border border-blue-400 rounded px-2 py-1 mb-4"
              />
            </div>
            <div>
              <label className="block mb-1 font-cinzel text-sm">Jenis Kelamin</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as "Pria" | "Wanita")}
                className="w-full bg-black/50 border border-blue-400 rounded px-2 py-1 mb-4"
              >
                <option value="Pria">Pria</option>
                <option value="Wanita">Wanita</option>
              </select>
            </div>
          </div>

          <label className="block mb-1 font-cinzel text-sm">Ras</label>
          <div className="grid grid-cols-5 gap-2 mb-4">
            {RACES.map((r) => (
              <SelectionCard
                key={r.name}
                title={r.name}
                imageUrl={r.img}
                isSelected={selectedRace.name === r.name}
                onClick={() => setSelectedRace(r)}
              />
            ))}
          </div>

          <div className="grid grid-cols-2 gap-x-4">
            <div>
              <label className="block mb-1 font-cinzel text-sm">Kelas</label>
              <select
                value={selectedClass.name}
                onChange={(e) => handleClassChange(e.target.value)}
                className="w-full bg-black/50 border border-blue-400 rounded px-2 py-1 mb-4"
              >
                {Object.keys(CLASS_DEFINITIONS).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block mb-1 font-cinzel text-sm">Tipe Tubuh</label>
              <select
                value={bodyType}
                onChange={(e) => setBodyType(e.target.value)}
                className="w-full bg-black/50 border border-blue-400 rounded px-2 py-1 mb-4"
              >
                {SPRITE_PARTS.body_type.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-x-4">
            <div>
              <label className="block mb-1 font-cinzel text-sm">Rambut</label>
              <select
                value={hair}
                onChange={(e) => setHair(e.target.value)}
                className="w-full bg-black/50 border border-blue-400 rounded px-2 py-1 mb-4"
              >
                {SPRITE_PARTS.hair.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block mb-1 font-cinzel text-sm">Fitur Wajah</label>
              <select
                value={facialHair}
                onChange={(e) => setFacialHair(e.target.value)}
                className="w-full bg-black/50 border border-blue-400 rounded px-2 py-1 mb-4"
              >
                {SPRITE_PARTS.facial_feature.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block mb-1 font-cinzel text-sm">Aksesori Kepala</label>
              <select
                value={headAccessory}
                onChange={(e) => setHeadAccessory(e.target.value)}
                className="w-full bg-black/50 border border-blue-400 rounded px-2 py-1 mb-4"
              >
                {SPRITE_PARTS.head_accessory.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="block mb-1 font-cinzel text-sm">Luka & Tanda</label>
          <div className="flex flex-wrap gap-2 mb-4">
            {SPRITE_PARTS.facial_feature
              .filter((p) => p.name.includes("Luka") || p.name.includes("Buta"))
              .map((p) => (
                <label
                  key={p.id}
                  className={`p-2 rounded-lg cursor-pointer text-xs ${scars.includes(p.id) ? "bg-blue-600" : "bg-black/30 hover:bg-black/50"}`}
                >
                  <input
                    type="checkbox"
                    className="mr-2"
                    checked={scars.includes(p.id)}
                    onChange={() => toggleScar(p.id)}
                  />
                  {p.name}
                </label>
              ))}
          </div>

          <div className="text-xs bg-black/20 p-3 rounded">
            <p>{selectedClass.description}</p>
            <p className="mt-2">
              <strong>Proficiency:</strong> {selectedClass.proficiencies.armor.join(
                ", "
              ) || "None"}
              , {selectedClass.proficiencies.weapons.join(", ")}.
            </p>
            <p>
              <strong>Saving Throw:</strong> {selectedClass.proficiencies.savingThrows.join(
                ", "
              )}.
            </p>
          </div>

          <div className="flex-grow"></div>
          <div className="flex justify-between">
            <button onClick={handleBack} className="font-cinzel text-gray-300 hover:text-white">
              &larr; Kembali
            </button>
            <button
              onClick={() => name.trim() && setCharacterStep(3)}
              disabled={!name.trim()}
              className="font-cinzel bg-blue-600 hover:bg-blue-500 px-4 py-1 rounded disabled:bg-gray-500"
            >
              Lanjutkan
            </button>
          </div>
        </div>
      )}

      {step === 3 && abilityMethod === "roll" && currentAbilityIndex < abilitiesToRoll.length && (
        <AbilityRoller
          key={abilitiesToRoll[currentAbilityIndex]}
          ability={abilitiesToRoll[currentAbilityIndex]}
          onRoll={handleAbilityRollComplete}
          currentScore={abilityScores[abilitiesToRoll[currentAbilityIndex]] || null}
        />
      )}

      {step === 3 && (
        <div className="flex flex-col flex-grow animate-fade-in-fast p-4">
          <label className="block mb-2 font-cinzel text-sm">Metode Kemampuan</label>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {["roll", "array", "pointbuy"].map((m) => (
              <button
                key={m}
                onClick={() => setAbilityMethod(m as any)}
                className={`font-cinzel px-3 py-2 rounded ${abilityMethod === m ? "bg-blue-600" : "bg-black/40 hover:bg-black/60"}`}
              >
                {m === "roll" ? "Lempar Dadu" : m === "array" ? "Standard Array" : "Point Buy"}
              </button>
            ))}
          </div>

          {abilityMethod === "array" && (
            <div className="space-y-3">
              {ALL_ABILITIES.map((ab) => (
                <div key={ab} className="grid grid-cols-2 gap-2 items-center">
                  <span className="font-cinzel capitalize">{ab}</span>
                  <select
                    value={arrayAssignments[ab as Ability] ?? ""}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setArrayAssignments((prev) => ({ ...prev, [ab as Ability]: val }));
                    }}
                    className="bg-black/50 border border-blue-400 rounded px-2 py-1"
                  >
                    <option value="">Pilih nilai</option>
                    {STANDARD_ARRAY.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
              ))}
              <div className="flex justify-between mt-4">
                <button onClick={() => setCharacterStep(2)} className="font-cinzel text-gray-300 hover:text-white">&larr; Kembali</button>
                <button onClick={() => setCharacterStep(4)} className="font-cinzel bg-blue-600 hover:bg-blue-500 px-4 py-1 rounded">Lanjutkan</button>
              </div>
            </div>
          )}

          {abilityMethod === "pointbuy" && (
            <div className="space-y-3">
              <p className="text-sm">Alokasi 27 poin. Rentang 8–15. Biaya meningkat sesuai aturan 5e.</p>
              {ALL_ABILITIES.map((ab) => (
                <div key={ab} className="grid grid-cols-3 gap-2 items-center">
                  <span className="font-cinzel capitalize">{ab}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPointBuyScores((prev) => ({
                        ...prev,
                        [ab as Ability]: Math.max(8, (prev[ab as Ability] || 8) - 1),
                      }))}
                      className="px-2 py-1 bg-black/40 hover:bg-black/60 rounded"
                    >-</button>
                    <span className="w-8 text-center">{pointBuyScores[ab as Ability]}</span>
                    <button
                      onClick={() => setPointBuyScores((prev) => {
                        const current = prev[ab as Ability] || 8;
                        const next = Math.min(15, current + 1);
                        const newScores = { ...prev, [ab as Ability]: next } as Record<Ability, number>;
                        const spent = ALL_ABILITIES.reduce((sum, a) => sum + pointBuyCost(newScores[a as Ability]), 0);
                        if (spent > 27) return prev;
                        return newScores;
                      })}
                      className="px-2 py-1 bg-black/40 hover:bg-black/60 rounded"
                    >+</button>
                  </div>
                  <span className="text-xs text-gray-400">Biaya: {pointBuyCost(pointBuyScores[ab as Ability])}</span>
                </div>
              ))}
              <p className={`text-sm ${remainingPointBuy < 0 ? "text-red-400" : "text-amber-300"}`}>Sisa Poin: {remainingPointBuy}</p>
              <div className="flex justify-between mt-2">
                <button onClick={() => setCharacterStep(2)} className="font-cinzel text-gray-300 hover:text-white">&larr; Kembali</button>
                <button onClick={() => setCharacterStep(4)} className="font-cinzel bg-blue-600 hover:bg-blue-500 px-4 py-1 rounded">Lanjutkan</button>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 4 && (
        <div className="flex flex-col flex-grow animate-fade-in-fast p-4">
          <label className="block mb-1 font-cinzel text-sm">Background</label>
          <div className="grid grid-cols-3 gap-2 mb-4 max-h-80 overflow-y-auto">
            {BACKGROUNDS.map((b) => (
              <SelectionCard
                key={b.name}
                title={b.name}
                imageUrl={`https://picsum.photos/seed/${b.name.toLowerCase()}/200`}
                isSelected={selectedBackground.name === b.name}
                onClick={() => setSelectedBackground(b)}
              />
            ))}
          </div>

          <div className="bg-black/20 p-3 rounded text-sm space-y-2">
            <p>{selectedBackground.description}</p>
            <p>
              <strong>Fitur: {selectedBackground.feature.name}</strong>
            </p>
            <p className="text-xs italic">{selectedBackground.feature.description}</p>
            <p className="text-xs">
              <strong>Proficiency Skill:</strong> {selectedBackground.skillProficiencies.join(
                ", "
              )}
            </p>
          </div>

          <div className="flex-grow"></div>
          <div className="flex justify-between">
            <button onClick={() => setCharacterStep(3)} className="font-cinzel text-gray-300 hover:text-white">
              &larr; Lempar Ulang
            </button>
            <button onClick={() => setCharacterStep(5)} className="font-cinzel bg-blue-600 hover:bg-blue-500 px-4 py-1 rounded">
              Lanjutkan
            </button>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="flex flex-col flex-grow animate-fade-in-fast p-4">
          <h4 className="font-cinzel text-xl text-blue-200 mb-2">Pilihan Skill Kelas</h4>
          <p className="text-sm mb-4">
            Sebagai {selectedClass.name}, pilih <strong>{selectedClass.proficiencies.skills.choices}</strong> skill berikut:
          </p>
          <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
            {selectedClass.proficiencies.skills.options.map((skill) => (
              <label
                key={skill}
                className={`p-3 rounded-lg cursor-pointer ${selectedSkills.includes(skill) ? "bg-blue-600" : "bg-black/30 hover:bg-black/50"}`}
              >
                <input
                  type="checkbox"
                  className="mr-2"
                  checked={selectedSkills.includes(skill)}
                  onChange={() => handleSkillToggle(skill)}
                />
                {skill}
              </label>
            ))}
          </div>
          <h4 className="font-cinzel text-xl text-blue-200 mt-6 mb-2">Bahasa</h4>
          <p className="text-sm mb-2">Bahasa awal berdasarkan ras. Tambahkan bahasa tambahan jika diizinkan background.</p>
          <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
            {ALL_LANGUAGES.map((lang) => (
              <label key={lang} className={`p-3 rounded-lg cursor-pointer ${selectedLanguages.includes(lang) ? "bg-blue-600" : "bg-black/30 hover:bg-black/50"}`}>
                <input
                  type="checkbox"
                  className="mr-2"
                  checked={selectedLanguages.includes(lang)}
                  onChange={() => {
                    setSelectedLanguages((prev) => (
                      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
                    ));
                  }}
                />
                {lang}
              </label>
            ))}
          </div>
          <h4 className="font-cinzel text-xl text-blue-200 mt-6 mb-2">Tool Proficiency</h4>
          <p className="text-sm mb-2">Pilih alat yang kamu kuasai (opsional, tergantung background).</p>
          <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
            {TOOL_OPTIONS.map((tool) => (
              <label key={tool} className={`p-3 rounded-lg cursor-pointer ${selectedTools.includes(tool) ? "bg-blue-600" : "bg-black/30 hover:bg-black/50"}`}>
                <input
                  type="checkbox"
                  className="mr-2"
                  checked={selectedTools.includes(tool)}
                  onChange={() => {
                    setSelectedTools((prev) => (
                      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
                    ));
                  }}
                />
                {tool}
              </label>
            ))}
          </div>
          <div className="flex-grow"></div>
          <div className="flex justify-between">
            <button onClick={() => setCharacterStep(4)} className="font-cinzel text-gray-300 hover:text-white">
              &larr; Ganti Background
            </button>
            <button
              onClick={() => setStep(6)}
              disabled={selectedSkills.length !== selectedClass.proficiencies.skills.choices}
              className="font-cinzel bg-blue-600 hover:bg-blue-500 px-4 py-1 rounded disabled:bg-gray-500"
            >
              Lanjutkan
            </button>
          </div>
        </div>
      )}

      {step === 6 && (
        <div className="flex flex-col flex-grow animate-fade-in-fast p-4">
          <h4 className="font-cinzel text-xl text-blue-200 mb-2">Pilihan Equipment</h4>
          <p className="text-sm mb-4">Pilih equipment awal Anda:</p>
          <div className="space-y-4 max-h-72 overflow-y-auto pr-2">
            {selectedClass.startingEquipment.choices.map((choice, choiceIndex) => (
              <div key={choiceIndex}>
                <label className="block mb-1 text-sm text-gray-300">{choice.description}</label>
                <select
                  value={choice.options.findIndex(
                    (opt) => opt.name === selectedEquipment[choiceIndex]?.name
                  )}
                  onChange={(e) =>
                    handleEquipmentSelect(choiceIndex, parseInt(e.target.value, 10))
                  }
                  className="w-full bg-black/50 border border-blue-400 rounded px-2 py-1"
                >
                  {choice.options.map((option, optionIndex) => (
                    <option key={option.name} value={optionIndex}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          {selectedClass.spellcasting && (["Cleric", "Druid", "Paladin", "Ranger", "Wizard"].includes(selectedClass.name)) && (
            <div className="mt-6">
              <h4 className="font-cinzel text-xl text-blue-200 mb-2">Siapkan Spell (Level 1)</h4>
              <p className="text-sm mb-2">Pilih spell level 1 untuk dipersiapkan. Jumlah tergantung ability mod + level.</p>
              <div className="text-xs text-gray-400 mb-2">Spell disarankan akan dipilih otomatis jika Mode = AI Assist.</div>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {(selectedClass.spellcasting.knownSpells || [])
                  .map((nm) => findSpell(nm))
                  .filter((s): s is SpellDefinition => !!s && s.level === 1)
                  .map((spell) => (
                    <label key={spell.name} className={`p-3 rounded-lg cursor-pointer ${selectedPreparedSpells.includes(spell.name) ? "bg-blue-600" : "bg-black/30 hover:bg-black/50"}`}>
                      <input
                        type="checkbox"
                        className="mr-2"
                        checked={selectedPreparedSpells.includes(spell.name)}
                        onChange={() => {
                          setSelectedPreparedSpells((prev) => (
                            prev.includes(spell.name)
                              ? prev.filter((n) => n !== spell.name)
                              : [...prev, spell.name]
                          ));
                        }}
                      />
                      {spell.name}
                    </label>
                  ))}
              </div>
            </div>
          )}
          <div className="flex-grow"></div>
          <div className="flex justify-between">
            <button onClick={() => setCharacterStep(5)} className="font-cinzel text-gray-300 hover:text-white">
              &larr; Ganti Skill
            </button>
            <button onClick={() => setCharacterStep(7)} className="font-cinzel bg-blue-600 hover:bg-blue-500 px-4 py-1 rounded">
              Lanjutkan
            </button>
          </div>
        </div>
      )}

      {step === 7 && (
        <div className="flex flex-col flex-grow animate-fade-in-fast p-4">
          <p className="text-center text-lg text-gray-300 mb-4">
            Inilah takdirmu. Tinjau nilaimu sebelum melangkah ke dunia.
          </p>
          <div className="grid grid-cols-3 gap-x-4 gap-y-4 p-4 bg-black/20 rounded-lg">
            {ALL_ABILITIES.map((ability) => {
              const baseScore = abilityScores[ability] || 0;
              const raceBonus = selectedRace.abilityScoreBonuses[ability] || 0;
              const finalScore = baseScore + raceBonus;
              const modifier = getAbilityModifier(finalScore);
              return (
                <div key={ability} className="text-center">
                  <p className="font-cinzel text-lg capitalize text-blue-200">{ability}</p>
                  <p className="font-bold text-4xl">{finalScore}</p>
                  <p className="text-xs text-gray-400">({baseScore} + {raceBonus} Ras)</p>
                  <p className="font-bold text-md text-amber-300">
                    Mod: {modifier >= 0 ? "+" : ""}
                    {modifier}
                  </p>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="bg-black/20 p-3 rounded">
              <p className="font-cinzel text-sm">Bahasa</p>
              <p className="text-xs text-gray-300">{selectedLanguages.join(", ") || "(Belum dipilih)"}</p>
            </div>
            <div className="bg-black/20 p-3 rounded">
              <p className="font-cinzel text-sm">Tool Proficiency</p>
              <p className="text-xs text-gray-300">{selectedTools.join(", ") || "(Tidak ada)"}</p>
            </div>
          </div>
          <div className="flex-grow"></div>
          <div className="flex justify-between">
            <button onClick={() => setCharacterStep(6)} className="font-cinzel text-gray-300 hover:text-white" disabled={isSaving}>
              &larr; Ganti Equipment
            </button>
            {(isSaving || statusMessage) && (
              <p className={`text-center animate-pulse ${statusMessage.startsWith("ERROR:") ? "text-red-400" : "text-amber-300"}`}>
                {isSaving ? statusMessage || "Menyimpan..." : statusMessage}
              </p>
            )}
            <button onClick={handleSave} className="font-cinzel bg-blue-600 hover:bg-blue-500 px-4 py-1 rounded disabled:bg-gray-500" disabled={isSaving}>
              {isSaving ? "Memproses..." : "Selesaikan"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};