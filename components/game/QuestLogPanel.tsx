import React from 'react';
import { Quest } from '../../types';

interface QuestLogPanelProps {
    quests: Quest[];
}

const QuestItem: React.FC<{ quest: Quest }> = ({ quest }) => (
    <li>
        <details className="text-sm" open={quest.isMainQuest}>
            <summary className="font-bold cursor-pointer flex items-center gap-2">
                {quest.isMainQuest && <span className="text-yellow-400" title="Misi Utama">★</span>}
                <span className={quest.isMainQuest ? 'text-yellow-300' : ''}>{quest.title}</span>
                 {quest.status === 'proposed' && <span className="text-xs text-gray-400 italic">(Diusulkan)</span>}
            </summary>
            <div className="pl-4 border-l-2 border-gray-600 ml-1 mt-1 py-1 space-y-1">
                <p className="text-gray-300 italic">{quest.description}</p>
                {quest.reward && (
                    <p className="text-amber-400 text-xs"><strong className="font-normal">Imbalan:</strong> {quest.reward}</p>
                )}
            </div>
        </details>
    </li>
);

export const QuestLogPanel: React.FC<QuestLogPanelProps> = ({ quests }) => {
    const activeQuests = quests.filter(q => q.status === 'active' || q.status === 'proposed').sort((a,b) => (b.isMainQuest ? 1 : 0) - (a.isMainQuest ? 1 : 0));
    const completedQuests = quests.filter(q => q.status === 'completed' || q.status === 'failed');

    return (
        <div className="bg-gray-900/50 p-4 rounded-lg">
            <h2 className="font-cinzel text-2xl text-green-300 border-b border-gray-600 pb-2 mb-3">Jurnal Misi</h2>
            
            <h3 className="font-cinzel text-lg text-yellow-400 mt-2">Misi Aktif</h3>
            {activeQuests.length > 0 ? (
                <ul className="space-y-2 mt-1">
                    {activeQuests.map(quest => <QuestItem key={quest.id} quest={quest} />)}
                </ul>
            ) : (
                <p className="text-sm text-gray-400 italic mt-1">Tidak ada misi aktif.</p>
            )}

            <h3 className="font-cinzel text-lg text-gray-500 mt-4">Misi Selesai</h3>
            {completedQuests.length > 0 ? (
                <ul className="space-y-2 mt-1">
                    {completedQuests.map(quest => (
                        <li key={quest.id}>
                           <details className="text-sm text-gray-500">
                               <summary className="font-bold cursor-pointer line-through">{quest.title}</summary>
                               <p className="italic pl-4 border-l-2 border-gray-700 ml-1 mt-1 py-1">{quest.description}</p>
                           </details>
                        </li>
                    ))}
                </ul>
            ) : (
                 <p className="text-sm text-gray-500 italic mt-1">Belum ada misi yang selesai.</p>
            )}
        </div>
    );
};