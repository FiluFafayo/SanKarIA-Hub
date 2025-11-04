// REFAKTOR G-4: File BARU.
// Komponen ini berisi logika 'renderView' yang sebelumnya ada di App.tsx.
// Ia mengambil SSoT dan handler dari store/props dan menyuntikkannya
// ke view yang sesuai.

import React from 'react';
import { Location, Campaign, Character } from '../types';
import { useAppStore } from '../store/appStore';
import { useDataStore } from '../store/dataStore';

// Import Views
import { CreateCampaignView } from '../views/CreateCampaignView';
import { HallOfEchoesView } from '../views/HallOfEchoesView';
import { JoinCampaignView } from '../views/JoinCampaignView';
import { MarketplaceView } from '../views/MarketplaceView';
import { SettingsView } from '../views/SettingsView';
import { ProfileView } from '../views/ProfileView';
import { CharacterSelectionView } from '../views/CharacterSelectionView';

interface ViewManagerProps {
    userId: string;
    userEmail?: string;
    theme: string;
    setTheme: React.Dispatch<React.SetStateAction<string>>;
    onSelectCampaign: (campaign: Campaign) => void;
    onCharacterSelection: (character: Character) => void;
}

export const ViewManager: React.FC<ViewManagerProps> = ({ 
    userId, userEmail, theme, setTheme,
    onSelectCampaign, onCharacterSelection
}) => {
    
    // Ambil state navigasi
    const { currentView, campaignToJoinOrStart, returnToNexus } = useAppStore(s => ({
        currentView: s.navigation.currentView,
        campaignToJoinOrStart: s.navigation.campaignToJoinOrStart,
        returnToNexus: s.actions.returnToNexus
    }));

    // Ambil data SSoT
    const { campaigns, characters } = useDataStore(s => s.state);
    
    // Ambil Aksi SSoT
    const { createCampaign, updateCampaign, addCampaign } = useDataStore(s => s.actions);

    // Ini adalah logika 'renderView' yang lama
    if (currentView === 'character-selection' && campaignToJoinOrStart) {
      return (
        <CharacterSelectionView
          characters={characters.filter(c => c.ownerId === userId)} // Hanya karakter milikku
          onSelect={onCharacterSelection}
          onClose={returnToNexus}
        />
      );
    }

    switch (currentView) {
      case Location.StorytellersSpire:
        return <CreateCampaignView 
                    onClose={returnToNexus} 
                    // createCampaign (dari dataStore) menangani AI call + save
                    onCreateCampaign={(campaignData) => createCampaign(campaignData, userId)} 
                />;
      case Location.HallOfEchoes:
        return <HallOfEchoesView 
                    onClose={returnToNexus} 
                    campaigns={campaigns} // SSoT
                    onSelectCampaign={onSelectCampaign} // Handler dari AppLayout
                    myCharacters={characters} // SSoT
                    onUpdateCampaign={updateCampaign} // Aksi SSoT
                />;
      case Location.WanderersTavern:
        return <JoinCampaignView 
                    onClose={returnToNexus} 
                    onCampaignFound={onSelectCampaign} // Disederhanakan: jika ketemu, langsung mulai alur select
                />;
      case Location.MarketOfAThousandTales:
        return <MarketplaceView 
                    onClose={returnToNexus} 
                    onCampaignCopied={addCampaign} // Aksi SSoT
                    userId={userId} 
                />;
      case Location.TinkerersWorkshop:
        return <SettingsView 
                    onClose={returnToNexus} 
                    currentTheme={theme} 
                    setTheme={setTheme}
                    userEmail={userEmail}
                    onSignOut={() => dataService.signOut()}
                />;
      case Location.MirrorOfSouls:
        return <ProfileView 
                  onClose={returnToNexus} 
                  userId={userId} 
                />; // Disederhanakan, ProfileView akan ambil data dari store
      default:
        return null; // 'nexus' ditangani oleh AppLayout
    }
};