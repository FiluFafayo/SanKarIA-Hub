import React, { useState, useEffect } from "react"; // Import useEffect
import { ViewWrapper } from "../components/ViewWrapper";
import { Campaign } from "../types";
import { generateId, generateJoinCode } from "../utils";
import { useDataStore } from "../store/dataStore"; // Gunakan store sebagai boundary

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
	const [filter, setFilter] = useState("Semua");
	const [publishedCampaigns, setPublishedCampaigns] = useState<Campaign[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [statusMessage, setStatusMessage] = useState(""); // FASE 2: Error Handling
	const [copyingId, setCopyingId] = useState<string | null>(null); // FASE 2: Loading per item

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
				<div className="flex justify-center mb-6 gap-4">
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

				{isLoading ? (
					<div className="text-amber-200/80">Memuat petualangan...</div>
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
				)}
			</div>
		</ViewWrapper>
	);
};