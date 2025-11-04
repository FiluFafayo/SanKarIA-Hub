import React, { useState, useEffect } from "react"; // Import useEffect
import { ViewWrapper } from "../components/ViewWrapper";
import { Campaign } from "../types";
import { generateId, generateJoinCode } from "../utils";
import { dataService } from "../services/dataService"; // Import dataService

// REFAKTOR G-4: Disederhanakan
interface MarketplaceViewProps {
	onClose: () => void;
	onCampaignCopied: (campaign: Campaign) => void; // Aksi dari dataStore
	userId: string;
}

const AdventurePoster: React.FC<{ campaign: Campaign; onCopy: () => void }> = ({
	campaign,
	onCopy,
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
					className="px-4 py-1.5 bg-accent-secondary hover:bg-accent-primary rounded font-cinzel transition-colors"
				>
					Salin
				</button>
			</div>
		</div>
	</div>
);

export const MarketplaceView: React.FC<MarketplaceViewProps> = ({
	onClose,
	onCampaignCopied,
	userId,
}) => {
	const [filter, setFilter] = useState("Semua");
	const [publishedCampaigns, setPublishedCampaigns] = useState<Campaign[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	// Load data mandiri
	useEffect(() => {
		const loadPublishedCampaigns = async () => {
			setIsLoading(true);
			try {
				const campaigns = await dataService.getPublishedCampaigns();
				setPublishedCampaigns(campaigns);
			} catch (error) {
				console.error("Gagal memuat marketplace:", error);
				alert("Gagal memuat Pasar Seribu Kisah. Coba lagi nanti.");
			} finally {
				setIsLoading(false);
			}
		};
		loadPublishedCampaigns();
	}, []);

	const handleCopyCampaign = async (originalCampaign: Campaign) => {
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
			currentTime: "Siang",
			currentWeather: "Cerah",
			// (ownerId akan di-set oleh dataService.createCampaign)
		};
        
        // (Poin 5) Pastikan campaign baru yang disalin juga menggunakan format waktu number
        if (typeof (newCampaign as any).currentTime === 'string') {
            (newCampaign as any).currentTime = 43200; // Fallback ke 12:00 PM
        }

		try {
			// REFAKTOR G-4: Panggil aksi dataStore untuk membuat campaign
			const createdCampaign = await dataService.createCampaign(
				newCampaign,
				userId
			);

			// REFAKTOR G-4: Panggil aksi store untuk menambah ke SSoT
			onCampaignCopied(createdCampaign);
			alert(
				`Kampanye "${originalCampaign.title}" telah disalin ke Aula Gema Anda!`
			);
		} catch (error) {
			console.error("Gagal menyalin campaign:", error);
			alert("Gagal menyalin campaign.");
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
						className={`px-4 py-2 font-cinzel rounded transition-colors ${
							filter === "Semua"
								? "bg-amber-600 text-white"
								: "bg-gray-700 text-gray-300 hover:bg-gray-600"
						}`}
					>
						Semua
					</button>
					<button
						onClick={() => setFilter("Fantasi")}
						className={`px-4 py-2 font-cinzel rounded transition-colors ${
							filter === "Fantasi"
								? "bg-amber-600 text-white"
								: "bg-gray-700 text-gray-300 hover:bg-gray-600"
						}`}
					>
						Fantasi
					</button>
					<button
						onClick={() => setFilter("Sci-Fi")}
						className={`px-4 py-2 font-cinzel rounded transition-colors ${
							filter === "Sci-Fi"
								? "bg-amber-600 text-white"
								: "bg-gray-700 text-gray-300 hover:bg-gray-600"
						}`}
					>
						Sci-Fi
					</button>
					<button
						onClick={() => setFilter("Horor")}
						className={`px-4 py-2 font-cinzel rounded transition-colors ${
							filter === "Horor"
								? "bg-amber-600 text-white"
								: "bg-gray-700 text-gray-300 hover:bg-gray-600"
						}`}
					>
						Horor
					</button>
				</div>

				{isLoading ? (
					<div className="text-amber-200/80">Memuat petualangan...</div>
				) : filteredCampaigns.length > 0 ? (
					<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
						{filteredCampaigns.map((campaign) => (
							<AdventurePoster
								key={campaign.id}
								campaign={campaign}
								onCopy={() => handleCopyCampaign(campaign)}
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
