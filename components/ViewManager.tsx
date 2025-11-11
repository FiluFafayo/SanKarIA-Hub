// REFAKTOR G-4: File BARU.
// Komponen ini berisi logika 'renderView' yang sebelumnya ada di App.tsx.
// Ia mengambil SSoT dan handler dari store/props dan menyuntikkannya
// ke view yang sesuai.

import React from 'react';
// FASE 1 FIX: Hapus impor ganda
import { Location, Campaign, Character } from '../types';
import { useAppStore } from '../store/appStore';
import { useDataStore } from '../store/dataStore';
import { useGameStore } from '../store/gameStore';

// Import Views
import { NexusSanctum } from './NexusSanctum'; // FASE 0: Import Nexus
import { CreateCampaignView } from '../views/CreateCampaignView';
import { HallOfEchoesView } from '../views/HallOfEchoesView';
import { JoinCampaignView } from '../views/JoinCampaignView';
import { MarketplaceView } from '../views/MarketplaceView';
import { SettingsView } from '../views/SettingsView';
import { WireframePreview } from '../views/WireframePreview';
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
    const { currentView, campaignToJoinOrStart, returnToNexus, pushNotification } = useAppStore(s => ({
        currentView: s.navigation.currentView,
        campaignToJoinOrStart: s.navigation.campaignToJoinOrStart,
        returnToNexus: s.actions.returnToNexus,
        pushNotification: s.actions.pushNotification
    }));

    // Ambil data SSoT
    const { campaigns, characters } = useDataStore(s => s.state);
    
    // Ambil Aksi SSoT
    const { createCampaign, signOut } = useDataStore(s => s.actions);

    // Ini adalah logika 'renderView' yang lama
    if (currentView === 'character-selection' && campaignToJoinOrStart) {
      return (
        <CharacterSelectionView
          characters={characters.filter(c => c.ownerId === userId)} // Hanya karakter milikku
          onSelect={onCharacterSelection}
          onClose={returnToNexus}
          userId={userId}
        />
      );
    }

    // FASE 0: ViewManager sekarang menangani SEMUA view, termasuk 'nexus'
    switch (currentView) {
      case 'nexus':
        return <NexusSanctum userEmail={userEmail} userId={userId} />;
      case 'wireframe-preview':
        return <WireframePreview />;
      case Location.StorytellersSpire:
        return <CreateCampaignView 
                    onClose={returnToNexus} 
                    onCreateCampaign={(campaignData) => createCampaign(campaignData, userId)} 
                />;
      case Location.HallOfEchoes:
        return <HallOfEchoesView 
                    onClose={returnToNexus} 
                    // campaigns, myCharacters, dan onUpdateCampaign dihapus
                    // View akan mengambilnya dari dataStore
                    onSelectCampaign={onSelectCampaign} // Handler dari AppLayout
                />;
      case Location.WanderersTavern:
        return <JoinCampaignView 
                    onClose={returnToNexus} 
                    onCampaignFound={onSelectCampaign} // Disederhanakan: jika ketemu, langsung mulai alur select
                />;
      case Location.MarketOfAThousandTales:
        return <MarketplaceView 
                    onClose={returnToNexus} 
                    userId={userId} 
                />;
      case Location.TinkerersWorkshop:
        return <SettingsView 
                    onClose={returnToNexus} 
                    currentTheme={theme} 
                    setTheme={setTheme}
                    userEmail={userEmail}
                    onSignOut={() => {
                      // Reset runtime tanpa menyimpan jika user logout di tengah permainan
                      useGameStore.getState().actions.resetRuntimeOnLogout();
                      // Tampilkan toast global
                      pushNotification({ message: 'Anda telah keluar.', type: 'success' });
                      // Lanjutkan proses sign out untuk membersihkan SSoT dan sesi auth
                      signOut();
                    }}
                />;
      case Location.MirrorOfSouls:
        return <ProfileView 
                  onClose={returnToNexus} 
                  userId={userId} 
                />; // Disederhanakan, ProfileView akan ambil data dari store
      default:
        return <NexusSanctum userEmail={userEmail} userId={userId} />; // Fallback aman
    }
};