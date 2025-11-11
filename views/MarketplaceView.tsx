import React, { useState, useEffect, useMemo } from "react"; // Import useMemo
import { ViewWrapper } from "../components/ViewWrapper";
import { Campaign } from "../types";
import { generateId, generateJoinCode } from "../utils";
import { useDataStore } from "../store/dataStore"; // Gunakan store sebagai boundary
import { Tabs } from "../components/ui/Tabs";
import { Card } from "../components/ui/Card";
import { BottomSheet } from "../components/mobile/BottomSheet";
import { ITEM_DEFINITIONS } from "../data/items";
import { SPELL_DEFINITIONS } from "../data/spells";

// REFAKTOR G-4: Disederhanakan
interface MarketplaceViewProps {
    onClose: () => void;
    userId: string;
}

const AdventurePoster: React.FC<{ campaign: Campaign; onCopy: () => void, isCopying: boolean }> = ({ // FASE 2
	campaign,
	onCopy,
	isCopying, // FASE 2
}) => (
	<div className="group bg-bg-secondary rounded-lg shadow-lg overflow-hidden transform hover:-translate-y-2 transition-transform duration-300">
		<img
			src={campaign.image}
			alt={campaign.title}
			className="w-full h-48 object-cover"
			loading="lazy"
			decoding="async"
			fetchpriority="low"
		/>
		<div className="p-4 text-white">
			<h3 className="font-cinzel truncate text-lg">{campaign.title}</h3>
			<p className="text-xs text-gray-400 h-10">
				{campaign.description.substring(0, 70)}...
			</p>
			<div className="flex justify-between items-center mt-3 text-xs">
				<span className="text-gray-300">
					{campaign.playerIds.length} / {campaign.maxPlayers} pemain
				</span>
				<button
					onClick={onCopy}
					className="px-4 py-1.5 bg-accent-secondary hover:bg-accent-primary rounded font-cinzel transition-colors
								disabled:bg-gray-600 disabled:cursor-not-allowed" // FASE 2
					disabled={isCopying} // FASE 2
				>
					{isCopying ? "Menyalin..." : "Salin"}
				</button>
			</div>
		</div>
	</div>
);

export const MarketplaceView: React.FC<MarketplaceViewProps> = ({
    onClose,
    userId,
}) => {
    const [activeTab, setActiveTab] = useState<'campaigns'|'items'|'spells'>('campaigns');
    const [filter, setFilter] = useState("Semua"); // untuk kampanye
    const [publishedCampaigns, setPublishedCampaigns] = useState<Campaign[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [statusMessage, setStatusMessage] = useState(""); // FASE 2: Error Handling
    const [copyingId, setCopyingId] = useState<string | null>(null); // FASE 2: Loading per item
    const [isFilterOpen, setFilterOpen] = useState(false);

    // Filter untuk Items
    const [itemType, setItemType] = useState<string>('Semua');
    const [itemRarity, setItemRarity] = useState<string>('Semua');
    const [itemMagic, setItemMagic] = useState<string>('Semua'); // 'Semua' | 'Magis' | 'Non-Magis'

    // Filter untuk Spells
    const [spellSchool, setSpellSchool] = useState<string>('Semua');
    const [spellLevel, setSpellLevel] = useState<string>('Semua');

	// Load data mandiri
    const { getPublishedCampaigns, createCampaign } = useDataStore(s => s.actions);
    useEffect(() => {
        const loadPublishedCampaigns = async () => {
            setIsLoading(true);
            setStatusMessage("");
            try {
                const campaigns = await getPublishedCampaigns();
                setPublishedCampaigns(campaigns);
            } catch (error) {
                console.error("Gagal memuat marketplace:", error);
                setStatusMessage("Gagal memuat Pasar Seribu Kisah. Coba lagi nanti.");
            } finally {
                setIsLoading(false);
            }
        };
        loadPublishedCampaigns();
    }, [getPublishedCampaigns]);

	const handleCopyCampaign = async (originalCampaign: Campaign) => {
		setCopyingId(originalCampaign.id); // FASE 2
		setStatusMessage(""); // FASE 2

		// Sesuai Tipe baru, 'ownerId' harus di-set
		const newCampaign: Omit<
			Campaign,
			| "id"
			| "eventLog"
			| "monsters"
			| "players"
			| "playerIds"
			| "choices"
			| "turnId"
			| "initiativeOrder"
		> = {
			...originalCampaign,
			joinCode: generateJoinCode(),
			playerIds: [], // Reset players
			currentPlayerId: null,
			turnId: null,
			isPublished: false, // Salinan tidak di-publish
			monsters: [],
			initiativeOrder: [],
			gameState: "exploration",
			quests: originalCampaign.quests, // Salin quests & npcs
			npcs: originalCampaign.npcs,
			worldEventCounter: 0,
			currentTime: 43200, // FASE 5 FIX: Diubah ke number (12:00 PM)
			currentWeather: "Cerah",
			// (ownerId akan di-set oleh dataService.createCampaign)
		};

		// (Poin 5) Pemeriksaan string tidak lagi diperlukan
		// if (typeof (newCampaign as any).currentTime === 'string') {
		//     (newCampaign as any).currentTime = 43200; // Fallback ke 12:00 PM
		// }

        try {
            // Gunakan aksi store untuk membuat campaign dan otomatis menambah ke SSoT
            await createCampaign(newCampaign, userId);
            // FASE 4: Ganti alert() dengan console.log untuk pesan sukses non-invasif
            // FASE 2: Ganti console.log dengan UI feedback
            setStatusMessage(
                `Kampanye "${originalCampaign.title}" telah disalin ke Aula Gema Anda!`
            );
        } catch (error) {
            console.error("Gagal menyalin campaign:", error);
            // FASE 4: Hapus alert()
            // FASE 2: Ganti console.error dengan UI feedback
            setStatusMessage(`Gagal menyalin campaign: ${error.message || 'Error tidak diketahui'}`);
        } finally {
            setCopyingId(null); // FASE 2
        }
    };

	const filteredCampaigns = publishedCampaigns.filter(
		(c) => filter === "Semua" || c.mainGenre === filter
	);

    const filteredItems = useMemo(() => ITEM_DEFINITIONS.filter(it => {
        const typeOk = itemType === 'Semua' || it.type === itemType;
        const rarityOk = itemRarity === 'Semua' || it.rarity === itemRarity;
        const magicOk = itemMagic === 'Semua' || (itemMagic === 'Magis' ? it.isMagical : !it.isMagical);
        return typeOk && rarityOk && magicOk;
    }), [itemType, itemRarity, itemMagic]);

    const filteredSpells = useMemo(() => SPELL_DEFINITIONS.filter(sp => {
        const schoolOk = spellSchool === 'Semua' || sp.school === spellSchool;
        const levelOk = spellLevel === 'Semua' || String(sp.level) === spellLevel;
        return schoolOk && levelOk;
    }), [spellSchool, spellLevel]);

	return (
		<ViewWrapper onClose={onClose} title="Pasar Seribu Kisah">
			<div className="text-center">
				<h2
					className="font-cinzel text-4xl text-white mb-2"
					style={{ textShadow: "0 0 10px #f59e0b" }}
				>
					Pasar Seribu Kisah
				</h2>
				<p className="text-amber-200 mb-8">
					Temukan petualangan yang dibuat oleh pemain sepertimu.
				</p>
				<div className="mb-4">
					<Tabs
						items={[
							{ key: 'campaigns', label: 'Campaigns' },
							{ key: 'items', label: 'Items' },
							{ key: 'spells', label: 'Spells' }
						]}
						activeKey={activeTab}
						onChange={(key) => setActiveTab(key as any)}
					/>
				</div>

				{/* Tombol Filter */}
				<div className="flex justify-center mb-6 gap-4">
					<button
						onClick={() => setFilterOpen(true)}
						className="px-4 py-2 font-cinzel rounded bg-amber-600 text-white hover:bg-amber-500 transition-colors"
					>
						Filter
					</button>
					<button
						onClick={() => setFilter("Semua")}
						className={`px-4 py-2 font-cinzel rounded transition-colors ${filter === "Semua"
								? "bg-amber-600 text-white"
								: "bg-gray-700 text-gray-300 hover:bg-gray-600"
							}`}
					>
						Semua
					</button>
					<button
						onClick={() => setFilter("Fantasi")}
						className={`px-4 py-2 font-cinzel rounded transition-colors ${filter === "Fantasi"
								? "bg-amber-600 text-white"
								: "bg-gray-700 text-gray-300 hover:bg-gray-600"
							}`}
					>
						Fantasi
					</button>
					<button
						onClick={() => setFilter("Sci-Fi")}
						className={`px-4 py-2 font-cinzel rounded transition-colors ${filter === "Sci-Fi"
								? "bg-amber-600 text-white"
								: "bg-gray-700 text-gray-300 hover:bg-gray-600"
							}`}
					>
						Sci-Fi
					</button>
					<button
						onClick={() => setFilter("Horor")}
						className={`px-4 py-2 font-cinzel rounded transition-colors ${filter === "Horor"
								? "bg-amber-600 text-white"
								: "bg-gray-700 text-gray-300 hover:bg-gray-600"
							}`}
					>
						Horor
					</button>
				</div>

				{/* FASE 2: Tampilkan Status Message */}
				{statusMessage && (
					<div className={`p-3 rounded-lg mb-4 text-center ${statusMessage.startsWith("Gagal")
							? "bg-red-800/50 text-red-200"
							: "bg-green-800/50 text-green-200"
						}`}>
						{statusMessage}
					</div>
				)}

				{activeTab === 'campaigns' && (isLoading ? (
					<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
						{Array.from({ length: 8 }).map((_, i) => (
							<div key={i} className="bg-bg-secondary border border-border-primary rounded-token-lg shadow-elevation-2 p-space-md">
								<div className="w-full h-48 rounded-token-md skeleton" />
								<div className="mt-3 space-y-2">
									<div className="h-5 w-2/3 rounded skeleton" />
									<div className="h-3 w-full rounded skeleton" />
								</div>
							</div>
						))}
					</div>
				) : filteredCampaigns.length > 0 ? (
					<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
						{filteredCampaigns.map((campaign) => (
							<AdventurePoster
								key={campaign.id}
								campaign={campaign}
								onCopy={() => handleCopyCampaign(campaign)}
								isCopying={copyingId === campaign.id} // FASE 2
							/>
						))}
					</div>
				) : (
					<div className="text-center text-amber-200/80 bg-bg-secondary p-8 rounded-lg">
						<p>Tidak ada kampanye yang diterbitkan cocok dengan filter ini.</p>
					</div>
				))}

				{activeTab === 'items' && (
					<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
						{filteredItems.length === 0 ? (
							<div className="col-span-full text-center text-amber-200/80 bg-bg-secondary p-8 rounded-lg">Tidak ada item sesuai filter.</div>
						) : filteredItems.map(it => (
							<Card key={it.name} title={it.name} subtitle={`${it.type} • ${it.rarity}${it.isMagical ? ' • Magis' : ''}`}>
								<div className="text-sm text-text-secondary">
									{it.damageDice && <div>Damage: {it.damageDice}</div>}
									{typeof it.baseAc === 'number' && <div>AC Dasar: {it.baseAc}</div>}
									{it.description && <div className="mt-1">{it.description}</div>}
								</div>
							</Card>
						))}
					</div>
				)}

				{activeTab === 'spells' && (
					<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
						{filteredSpells.length === 0 ? (
							<div className="col-span-full text-center text-amber-200/80 bg-bg-secondary p-8 rounded-lg">Tidak ada spell sesuai filter.</div>
						) : filteredSpells.map(sp => (
							<Card key={sp.name} title={sp.name} subtitle={`Lv ${sp.level} • ${sp.school}`}>
								<div className="text-sm text-text-secondary">
									{sp.effectType && <div>Efek: {sp.effectType}</div>}
									{sp.damageDice && <div>Dadu: {sp.damageDice}</div>}
									{sp.description && <div className="mt-1">{sp.description}</div>}
								</div>
							</Card>
						))}
					</div>
				)}
			</div>

			{/* Bottom Sheet Filter */}
			<BottomSheet isOpen={isFilterOpen} onClose={() => setFilterOpen(false)} title="Filter Marketplace">
				{activeTab === 'campaigns' && (
					<div className="space-y-3">
						<label className="block text-sm">Genre</label>
						<div className="flex flex-wrap gap-2">
							{['Semua','Fantasi','Sci-Fi','Horor'].map(g => (
								<button key={g} onClick={() => setFilter(g)} className={`px-3 py-1 rounded ${filter === g ? 'bg-amber-600 text-white' : 'bg-gray-700 text-gray-300'}`}>{g}</button>
							))}
						</div>
					</div>
				)}
				{activeTab === 'items' && (
					<div className="space-y-4">
						<div>
							<label className="block text-sm">Jenis Item</label>
							<select value={itemType} onChange={e => setItemType(e.target.value)} className="w-full bg-black/30 border border-amber-800 rounded px-3 py-2">
								{['Semua','armor','weapon','consumable','tool','other'].map(t => (<option key={t} value={t}>{t}</option>))}
							</select>
						</div>
						<div>
							<label className="block text-sm">Kelangkaan</label>
							<select value={itemRarity} onChange={e => setItemRarity(e.target.value)} className="w-full bg-black/30 border border-amber-800 rounded px-3 py-2">
								{['Semua','common','uncommon','rare','very_rare','legendary'].map(r => (<option key={r} value={r}>{r}</option>))}
							</select>
						</div>
						<div>
							<label className="block text-sm">Sifat Magis</label>
							<select value={itemMagic} onChange={e => setItemMagic(e.target.value)} className="w-full bg-black/30 border border-amber-800 rounded px-3 py-2">
								{['Semua','Magis','Non-Magis'].map(m => (<option key={m} value={m}>{m}</option>))}
							</select>
						</div>
					</div>
				)}
				{activeTab === 'spells' && (
					<div className="space-y-4">
						<div>
							<label className="block text-sm">Aliran (School)</label>
							<select value={spellSchool} onChange={e => setSpellSchool(e.target.value)} className="w-full bg-black/30 border border-amber-800 rounded px-3 py-2">
								{['Semua','Abjuration','Conjuration','Divination','Enchantment','Evocation','Illusion','Necromancy','Transmutation'].map(s => (<option key={s} value={s}>{s}</option>))}
							</select>
						</div>
						<div>
							<label className="block text-sm">Level</label>
							<select value={spellLevel} onChange={e => setSpellLevel(e.target.value)} className="w-full bg-black/30 border border-amber-800 rounded px-3 py-2">
								{['Semua','0','1','2','3','4','5'].map(l => (<option key={l} value={l}>{l}</option>))}
							</select>
						</div>
					</div>
				)}
				<div className="mt-4 flex justify-end">
					<button onClick={() => setFilterOpen(false)} className="px-4 py-2 bg-amber-600 text-white rounded font-cinzel">Tutup</button>
				</div>
			</BottomSheet>
		</ViewWrapper>
	);
};