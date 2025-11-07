import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, ".", "");
	return {
		server: {
			port: 3000,
			host: "0.0.0.0",
		},
		plugins: [react()],
		define: {
			// FASE 2: Hapus kunci redundan. VITE_GEMINI_API_KEYS (plural) ditangani di App.tsx
			// 'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY), // Redundan
			"process.env.GEMINI_API_KEY": JSON.stringify(env.GEMINI_API_KEY), // (Dibiarkan untuk kompatibilitas, meskipun App.tsx pakai VITE_GEMINI_API_KEYS)
		},
		resolve: {
			alias: {
				"@": path.resolve(__dirname, "."),
			},
		},
	};
});
