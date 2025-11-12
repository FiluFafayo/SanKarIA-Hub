import React, { useState } from 'react';
import { Campaign, Character, Quest, WorldWeather, CONDITION_RULES } from '../../types'; // Hapus WorldTime
import { formatDndTime } from '../../utils'; // (Poin 5) Impor helper format
import { QuestLogPanel } from './QuestLogPanel';
import { NpcTrackerPanel } from './NpcTrackerPanel';
import { ExplorationMap } from './ExplorationMap'; // BARU: FASE 5
import { InfoPanelPropsSlice } from './panels/GameInfoPanel'; // FASE 3

interface InfoPanelProps {
  campaign: InfoPanelPropsSlice; // FASE 3: Gunakan slice
  players: Character[];
}

const CampaignProgressBar: React.FC<{ quests: Quest[] }> = ({ quests }) => {
    const mainQuests = quests.filter(q => q.isMainQuest);
    if (mainQuests.length === 0) {
        return null; // Don't show if there are no main quests defined
    }

    const completedMainQuests = mainQuests.filter(q => q.status === 'completed').length;
    const totalMainQuests = mainQuests.length;
    const progress = totalMainQuests > 0 ? (completedMainQuests / totalMainQuests) * 100 : 0;

    return (
        <div className="bg-gray-900/50 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-1">
                <h2 className="font-cinzel text-lg text-amber-300">Progres Kampanye</h2>
                <span className="text-sm font-mono">{completedMainQuests} / {totalMainQuests} Misi Utama</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-4 border-2 border-gray-600">
                <div 
                    className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full transition-all duration-500 ease-out" 
                    style={{ width: `${progress}%` }}
                ></div>
            </div>
        </div>
    );
};

// (Poin 5) Update WorldStatePanel untuk menggunakan number (detik)
const WorldStatePanel: React.FC<{time: number, weather: WorldWeather}> = ({ time, weather }) => {
    // const timeIcons = { 'Pagi': '☀️', 'Siang': '☀️', 'Sore': '🌇', 'Malam': '🌙' }; // Dihapus
    const weatherIcons = { 'Cerah': '😊', 'Berawan': '☁️', 'Hujan': '🌧️', 'Badai': '⛈️' };
    
    const formattedTime = formatDndTime(time); // Gunakan helper

    return (
        <div className="bg-gray-900/50 p-4 rounded-lg">
             <h2 className="font-cinzel text-lg text-amber-300 mb-2">Status Dunia</h2>
             <div className="flex justify-around text-center">
                <div>
                    {/* <span className="text-3xl">{timeIcons[time]}</span> // Dihapus */}
                    <p className="text-lg font-bold text-gray-100">{formattedTime}</p>
                </div>
                <div>
                    <span className="text-3xl">{weatherIcons[weather]}</span>
                     <p className="text-sm text-gray-300">{weather}</p>
                </div>
             </div>
        </div>
    );
}

export const InfoPanel: React.FC<InfoPanelProps> = ({ campaign, players }) => {
  const [activeTab, setActiveTab] = useState('info');

  return (
    <div className="p-comfortable rounded-comfortable h-full overflow-y-auto space-y-4 bg-surface text-strong">
      <div className="sticky top-0 bg-gray-800 z-10 flex rounded-lg overflow-hidden border border-gray-700">
        <button onClick={() => setActiveTab('info')} className={`flex-1 p-2 font-cinzel text-sm ${activeTab === 'info' ? 'bg-purple-700' : 'bg-gray-700/50 hover:bg-gray-600'}`}>Info</button>
        <button onClick={() => setActiveTab('map')} className={`flex-1 p-2 font-cinzel text-sm ${activeTab === 'map' ? 'bg-purple-700' : 'bg-gray-700/50 hover:bg-gray-600'}`} disabled={!campaign.mapImageUrl}>Peta</button>
      </div>

      {activeTab === 'info' && (
        <div className="space-y-4 animate-fade-in-fast">
          <WorldStatePanel time={campaign.currentTime} weather={campaign.currentWeather} />
          <div className="bg-gray-900/50 p-4 rounded-lg">
            <h2 className="font-cinzel text-2xl text-amber-300 border-b border-gray-600 pb-2 mb-3">Info Kampanye</h2>
            <h3 className="font-bold text-lg">{campaign.title}</h3>
            <p className="text-sm text-gray-300 mt-1 italic">{campaign.description}</p>
            <div className="mt-4">
              <label className="text-xs text-gray-400">Kode Gabung</label>
              <div className="bg-black/50 p-2 rounded text-center font-mono tracking-widest text-lg select-all">{campaign.joinCode}</div>
            </div>
          </div>
          
          <CampaignProgressBar quests={campaign.quests} />
          
          <QuestLogPanel quests={campaign.quests} />
          
          <NpcTrackerPanel npcs={campaign.npcs} />

          <div className="bg-gray-900/50 p-4 rounded-lg">
            <h2 className="font-cinzel text-2xl text-blue-300 border-b border-gray-600 pb-2 mb-3">Para Petualang</h2>
            <ul className="space-y-3">
                    {players.map(player => (
                        <li key={player.id} className="flex items-center gap-3">
                            <img src={player.image} alt={player.name} className="w-12 h-12 rounded-full border-2 border-gray-500" />
                            <div>
                                <p className="font-bold">{player.name}</p>
                                <p className="text-xs text-gray-400">{player.race} {player.class} - Level {player.level}</p>
                                {player.conditions && player.conditions.length > 0 && (
                                    <div className="mt-2">
                                        <p className="text-xs text-amber-300 font-semibold">Kondisi Aktif:</p>
                                        <ul className="mt-1 space-y-1">
                                            {player.conditions.map((c, idx) => {
                                                const eff = CONDITION_RULES[c] || {};
                                                const impact: string[] = [];
                                                if (eff.attackAdvantage) impact.push('Advantage serangan');
                                                if (eff.attackDisadvantage) impact.push('Disadvantage serangan');
                                                if (eff.grantsAdvantageToAttackers) impact.push('Musuh mendapat advantage');
                                                if (eff.grantsDisadvantageToAttackers) impact.push('Musuh mendapat disadvantage');
                                                if (eff.speedZero) impact.push('Kecepatan 0');
                                                else if (eff.speedMultiplier && eff.speedMultiplier < 1) impact.push(`Kecepatan x${eff.speedMultiplier}`);
                                                if (eff.acModifier) impact.push(`AC ${eff.acModifier >= 0 ? '+' : ''}${eff.acModifier}`);
                                                if (eff.attackRollModifier) impact.push(`Serangan ${eff.attackRollModifier >= 0 ? '+' : ''}${eff.attackRollModifier}`);
                                                return (
                                                    <li key={idx} className="text-xs text-gray-300">
                                                        <span className="inline-block px-2 py-0.5 bg-gray-700 rounded mr-2">{c}</span>
                                                        <span className="italic">{impact.length > 0 ? impact.join(', ') : '—'}</span>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                )}
                                {player.activeEffects && player.activeEffects.length > 0 && (
                                    <div className="mt-2">
                                        <p className="text-xs text-blue-300 font-semibold">Efek Sihir Aktif:</p>
                                        <ul className="mt-1 space-y-1">
                                            {player.activeEffects.map((e) => {
                                                const impact: string[] = [];
                                                if (e.acBonus) impact.push(`AC ${e.acBonus >= 0 ? '+' : ''}${e.acBonus}`);
                                                if (e.blessDie) impact.push(`Bless +1${e.blessDie}`);
                                                if (e.grantsDisadvantageToAttackers) impact.push('Penyerang mendapat disadvantage');
                                                return (
                                                    <li key={e.id} className="text-xs text-gray-300">
                                                        <span className="inline-block px-2 py-0.5 bg-indigo-700/50 rounded mr-2">{e.label || e.spellId}</span>
                                                        <span className="italic mr-2">{impact.length > 0 ? impact.join(', ') : '—'}</span>
                                                        {typeof e.remainingRounds === 'number' && (
                                                            <span className="text-xs text-gray-400">({e.remainingRounds} rnd tersisa)</span>
                                                        )}
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                )}
                                {player.concentration && (
                                    <div className="mt-2">
                                        <p className="text-xs text-green-300 font-semibold">Konsentrasi:</p>
                                        <p className="text-xs text-gray-300">
                                            {player.concentration.spellName} — {player.concentration.remainingRounds} rnd tersisa
                                        </p>
                                    </div>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
      )}

      {activeTab === 'map' && campaign.explorationGrid && (
          <div className="bg-gray-900/50 p-4 rounded-lg animate-fade-in-fast">
              <h2 className="font-cinzel text-2xl text-amber-300 border-b border-gray-600 pb-2 mb-3">Peta Eksplorasi</h2>
              {/* BARU: FASE 5 */}
              <ExplorationMap 
                grid={campaign.explorationGrid}
                fog={campaign.fogOfWar}
                playerPos={campaign.playerGridPosition}
              />
          </div>
      )}
    </div>
  );
};
