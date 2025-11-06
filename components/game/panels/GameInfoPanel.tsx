// FASE 1: Direfaktor.
// Komponen ini tidak lagi menjadi <aside> (panel layout).
// Sekarang ini HANYA KONTEN (InfoPanel) yang akan dimasukkan ke dalam SidePanel.

import React from 'react';
import { CampaignState, Character } from '../../../types';
import { InfoPanel } from '../InfoPanel';

interface GameInfoPanelProps {
    campaign: CampaignState;
    players: Character[];
}

export const GameInfoPanel: React.FC<GameInfoPanelProps> = ({ campaign, players }) => {
    return (
        // FASE 1: Hapus <aside> dan <div> wrapper.
        // InfoPanel sudah memiliki overflow-y-auto dan padding.
        <InfoPanel campaign={campaign} players={players} />
    );
};