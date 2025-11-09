import React, { Dispatch, SetStateAction, useState } from "react";
import { ViewWrapper } from "../components/ViewWrapper";
import { useGameStore } from "../store/gameStore";

// REFAKTOR G-4: Disederhanakan
interface SettingsViewProps {
	onClose: () => void;
	currentTheme: string;
	setTheme: Dispatch<SetStateAction<string>>;
	userEmail?: string | null;
	onSignOut: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
    onClose,
    currentTheme,
    setTheme,
    userEmail,
    onSignOut,
}) => {
    const [activeStation, setActiveStation] = useState("Audio");
    const [masterVolume, setMasterVolume] = useState(100);
    const [musicVolume, setMusicVolume] = useState(75);
    const [infoMessage, setInfoMessage] = useState<string | null>(null);

	return (
		<ViewWrapper onClose={onClose} title="Bengkel Juru Cipta">
			<div className="bg-bg-secondary border border-yellow-700/50 rounded-lg shadow-2xl text-amber-100 flex flex-col md:flex-row min-h-[600px]">
				{/* Sidebar */}
				<div className="w-full md:w-1/3 bg-black/30 p-4 md:p-6 border-b md:border-b-0 md:border-r border-yellow-800/30 md:rounded-l-lg">
					<h2 className="font-cinzel text-2xl md:text-3xl mb-4 md:mb-6 text-center md:text-left">
						Stasiun Kerja
					</h2>
					<nav className="flex flex-row md:flex-col gap-2">
						<button
							onClick={() => setActiveStation("Audio")}
							className={`flex-1 md:flex-none p-3 rounded text-center md:text-left font-cinzel transition-colors ${activeStation === "Audio"
									? "bg-amber-700 text-white"
									: "hover:bg-amber-800/50"
								}`}
						>
							Audio
						</button>
						<button
							onClick={() => setActiveStation("Display")}
							className={`flex-1 md:flex-none p-3 rounded text-center md:text-left font-cinzel transition-colors ${activeStation === "Display"
									? "bg-amber-700 text-white"
									: "hover:bg-amber-800/50"
								}`}
						>
							Tampilan
						</button>
						<button
							onClick={() => setActiveStation("Gameplay")}
							className={`flex-1 md:flex-none p-3 rounded text-center md:text-left font-cinzel transition-colors ${activeStation === "Gameplay"
								? "bg-amber-700 text-white"
								: "hover:bg-amber-800/50"
							}`}
						>
							Permainan
						</button>
					</nav>
					{userEmail && (
						<div className="pt-4 mt-4 border-t border-amber-800/30">
							<p className="text-sm">
								Anda masuk sebagai:{" "}
								<strong className="text-amber-300">{userEmail}</strong>
							</p>
                            <button
                                onClick={() => {
                                    setInfoMessage("Anda telah keluar.");
                                    onSignOut();
                                }}
                                className="mt-2 text-sm font-cinzel bg-red-800 hover:bg-red-700 text-white px-4 py-1 rounded transition-colors"
                            >
                                Keluar
                            </button>
                        </div>
                    )}
                </div>
                {/* Content */}
                <div className="w-full md:w-2/3 p-6 md:p-8">
                    {infoMessage && (
                        <div className="mb-4 p-3 rounded bg-amber-800/40 border border-amber-600 text-amber-100 font-cinzel text-sm">
                            {infoMessage}
                        </div>
                    )}
                    {activeStation === "Audio" && (
                        <div>
							<h3 className="text-2xl font-cinzel mb-2">Gramofon Ajaib</h3>
							<p className="text-sm text-amber-200/70 mb-6">
								Sesuaikan suasana pendengaran dari pengalaman Anda.
							</p>
							<div className="space-y-6">
								<div>
									<label className="block mb-1">Volume Utama</label>
									<input
										type="range"
										className="w-full accent-amber-500"
										value={masterVolume}
										onChange={(e) =>
											setMasterVolume(parseInt(e.target.value, 10))
										}
									/>
								</div>
								<div>
									<label className="block mb-1">Volume Musik</label>
									<input
										type="range"
										className="w-full accent-amber-500"
										value={musicVolume}
										onChange={(e) =>
											setMusicVolume(parseInt(e.target.value, 10))
										}
									/>
								</div>
								<div>
									<label className="block mb-1">Suara AI DM</label>
									<select className="w-full bg-black/30 border border-amber-800 rounded px-3 py-2">
										<option>Piringan Kristal - 'Sejarawan'</option>
										<option>Piringan Obsidian - 'Pelawak'</option>
									</select>
								</div>
							</div>
						</div>
					)}
					{activeStation === "Display" && (
						<div>
							<h3 className="text-2xl font-cinzel mb-2">Astrolab Optik</h3>
							<p className="text-sm text-amber-200/70 mb-6">
								Kalibrasi antarmuka visual Anda.
							</p>
							<div className="space-y-6">
								<div>
									<label className="block mb-1">Tema UI</label>
									<select
										value={currentTheme}
										onChange={(e) => setTheme(e.target.value)}
										className="w-full bg-black/30 border border-amber-800 rounded px-3 py-2"
									>
										<option value="theme-sanc">Nadi Suaka (Default)</option>
										<option value="theme-oracle">Orakel Cahaya Bintang</option>
										<option value="theme-sunstone">
											Perpustakaan Batu Surya
										</option>
									</select>
								</div>
								<div>
									<label className="block mb-1 text-gray-500">
										Ukuran Font (Segera Hadir)
									</label>
									<input type="range" className="w-full" disabled />
								</div>
							</div>
						</div>
					)}
					{activeStation === "Gameplay" && (
						<div>
							<h3 className="text-2xl font-cinzel mb-2">Konduktor Permainan</h3>
							<p className="text-sm text-amber-200/70 mb-6">
								Pengaturan perilaku sistem selama sesi.
							</p>
							<div className="space-y-6">
								<AutoNpcPortraitToggle />
							</div>
						</div>
					)}
				</div>
			</div>
		</ViewWrapper>
	);
};

const AutoNpcPortraitToggle: React.FC = () => {
    const autoEnabled = useGameStore((s) => s.runtime.runtimeSettings.autoNpcPortraits);
    const setAuto = useGameStore((s) => s.actions.setAutoNpcPortraits);
    return (
        <div className="flex items-center justify-between">
            <div>
                <label className="block mb-1 font-cinzel">Buat potret NPC otomatis</label>
                <p className="text-xs text-amber-200/70">
                    Saat aktif, sistem akan mencoba membuat potret dari ringkasan NPC.
                </p>
            </div>
            <label className="inline-flex items-center cursor-pointer">
                <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={autoEnabled}
                    onChange={(e) => setAuto(e.target.checked)}
                />
                <div className="w-11 h-6 bg-amber-900 peer-focus:outline-none rounded-full peer peer-checked:bg-amber-600 transition-colors relative">
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-black/70 rounded-full transition-all ${autoEnabled ? 'translate-x-5 bg-amber-950' : ''}`}></span>
                </div>
            </label>
        </div>
    );
};
