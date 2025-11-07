// REFAKTOR G-4: Disederhanakan, ambil data dari store
// FASE 0: Dihapus props 'myCharacters' dan 'campaigns'
import React from "react";
import { ViewWrapper } from "../components/ViewWrapper";
import { Campaign, Character } from "../types";
import { useDataStore } from "../store/dataStore"; // G-4

interface HallOfEchoesViewProps {
	onClose: () => void;
	onSelectCampaign: (campaign: Campaign) => void; // Handler tetap di-pass
}

const CampaignPortal: React.FC<{
	campaign: Campaign;
	onSelect: () => void;
	onUpdate: (campaign: Campaign) => void;
	isMyTurn: boolean;
}> = ({ campaign, onSelect, onUpdate, isMyTurn }) => {
	const handlePublishToggle = (e: React.MouseEvent) => {
		e.stopPropagation();
		onUpdate({ ...campaign, isPublished: !campaign.isPublished });
	};

	return (
		<div
			className={`relative group w-full h-56 rounded-lg overflow-hidden shadow-lg transition-all duration-300 transform-gpu hover:scale-105 hover:shadow-2xl cursor-pointer`}
			onClick={onSelect}
		>
			<img
				src={campaign.image}
				alt={campaign.title}
				className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
			/>
			<div
				className={`absolute inset-0 bg-gradient-to-t from-black/90 to-transparent transition-all duration-300 border-4 ${isMyTurn
						? "border-amber-400 animate-pulse"
						: "border-transparent group-hover:border-amber-400"
					}`}
			></div>
			<div className="absolute bottom-0 left-0 p-4 text-white w-full">
				<h3 className="font-cinzel text-xl leading-tight">{campaign.title}</h3>
				{isMyTurn && (
					<p className="text-sm font-bold text-amber-300">Giliran Anda!</p>
				)}
				<p className="text-xs opacity-80">
					{/* FASE 0: eventLog tidak ada di SSoT, periksa playerIds saja */}
					{campaign.playerIds.length > 0
						? `${campaign.playerIds.length} pemain bergabung`
						: "Belum dimulai"}
				</p>
			</div>
			<div className="absolute top-2 right-2 bg-black/50 rounded-full px-3 py-1 text-xs text-white">
				{campaign.playerIds.length} / {campaign.maxPlayers} Pemain
			</div>
			<button
				onClick={handlePublishToggle}
				className={`absolute bottom-3 right-3 text-xs px-3 py-1.5 rounded-full transition-all duration-200 transform ${campaign.isPublished
						? "bg-red-600 hover:bg-red-500 text-white"
						: "bg-green-600 hover:bg-green-500 text-white"
					} opacity-0 group-hover:opacity-100 group-hover:translate-y-0 translate-y-2`}
			>
				{campaign.isPublished ? "Batal Terbit" : "Terbitkan"}
			</button>
		</div>
	);
};

export const HallOfEchoesView: React.FC<HallOfEchoesViewProps> = ({
	onClose,
	onSelectCampaign,
}) => {
	// REFAKTOR G-4: Ambil SSoT dari store
	const { campaigns, characters } = useDataStore((s) => s.state);
	const { saveCampaign } = useDataStore((s) => s.actions);

	const myCharacterIds = characters.map((c) => c.id);

	return (
		<ViewWrapper onClose={onClose} title="Aula Gema">
			<div className="text-center">
				<h2
					className="font-cinzel text-4xl text-white mb-2"
					style={{ textShadow: "0 0 10px #a855f7" }}
				>
					Aula Gema
				</h2>
				<p className="text-purple-200 mb-8">
					Petualangan masa lalu dan kini menanti.
				</p>
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
					{campaigns.length > 0 ? (
						campaigns.map((campaign) => {
							const isMyTurn = myCharacterIds.includes(
								campaign.currentPlayerId || ""
							);
							return (
								<CampaignPortal
									key={campaign.id}
									campaign={campaign}
									onSelect={() => onSelectCampaign(campaign)}
									onUpdate={saveCampaign}
									isMyTurn={isMyTurn}
								/>
							);
						})
					) : (
						<div className="text-purple-200 text-center col-span-full bg-bg-secondary p-8 rounded-lg">
							<p>
								Belum ada kampanye. Kunjungi Puncak Pencerita untuk membuatnya!
							</p>
						</div>
					)}
				</div>
			</div>
		</ViewWrapper>
	);
};
