import { Skill } from '../types';

interface ClassSkillInfo {
  choices: number;
  options: Skill[];
}

export const CLASS_SKILL_OPTIONS: { [key: string]: ClassSkillInfo } = {
  Barbarian: {
    choices: 2,
    options: [
      Skill.AnimalHandling,
      Skill.Athletics,
      Skill.Intimidation,
      Skill.Nature,
      Skill.Perception,
      Skill.Survival,
    ],
  },
  Cleric: {
    choices: 2,
    options: [
      Skill.History,
      Skill.Insight,
      Skill.Medicine,
      Skill.Persuasion,
      Skill.Religion,
    ],
  },
  Fighter: {
    choices: 2,
    options: [
      Skill.Acrobatics,
      Skill.AnimalHandling,
      Skill.Athletics,
      Skill.History,
      Skill.Insight,
      Skill.Intimidation,
      Skill.Perception,
      Skill.Survival,
    ],
  },
  Ranger: {
    choices: 3,
    options: [
      Skill.AnimalHandling,
      Skill.Athletics,
      Skill.Insight,
      Skill.Investigation,
      Skill.Nature,
      Skill.Perception,
      Skill.Stealth,
      Skill.Survival,
    ],
  },
  Rogue: {
    choices: 4,
    options: [
      Skill.Acrobatics,
      Skill.Athletics,
      Skill.Deception,
      Skill.Insight,
      Skill.Intimidation,
      Skill.Investigation,
      Skill.Perception,
      Skill.Performance,
      Skill.Persuasion,
      Skill.SleightOfHand,
      Skill.Stealth,
    ],
  },
  Wizard: {
    choices: 2,
    options: [
      Skill.Arcana,
      Skill.History,
      Skill.Insight,
      Skill.Investigation,
      Skill.Medicine,
      Skill.Religion,
    ],
  },
};