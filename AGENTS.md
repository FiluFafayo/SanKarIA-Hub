# AGENTS.md - Protokol Arsitektur Grimoire v1.0
**Dokumen Referensi:** Post-Mortem v0.x & Manifesto v1.x
**Status:** AKTIF (Pasca "Nuclear Reset")
**Penjaga Protokol:** Arsitek Sistem & Lead QA Paranoid

---

## 1. PENDAHULUAN: AUDIT SISTEM LAMA (v0.x)

Dokumen ini dibuat setelah keputusan radikal untuk melakukan **"Nuclear Reset"** pada keseluruhan UI/UX SanKarIA Hub. Untuk memahami mengapa reset ini diperlukan, kita harus jujur menganalisis arsitektur lama.

### 1.1. Filosofi Sistem Lama (v0.x)
Sistem lama adalah **"Web App yang Dipaksakan Menjadi VTT"**.

Fokus utamanya adalah fungsionalitas backend (AI DM, Supabase Sync) dengan frontend yang "cukup baik".

### 1.2. Arsitektur & Teknologi Lama (v0.x)
* **UI Framework:** React + Vite.
* **UI Kit:** **ShadCN/UI** (Modern, Flat, Desktop-first).
* **Layout:** Arsitektur "Web App" klasik.
    * `AppLayout.tsx`: Mengatur Sidebar, Header, dan Content Area.
    * `ViewManager.tsx`: Mengatur "halaman" mana yang tampil (e.g., `NexusSanctumView`, `GameScreenView`).
    * `MobileAppShell.tsx`: Upaya *patching* agar bisa dipakai di mobile, tapi pada dasarnya adalah *wrapper* dari layout desktop.
* **State:** Zustand (`appStore`, `gameStore`) + React Context. Sering terjadi *prop-drilling* atau *state* yang terlalu global.
* **Navigasi:** Berbasis URL/View-swapping. User merasa "pindah halaman web", bukan "pindah adegan game".

### 1.3. Implementasi DnD 5e & AI (v0.x)
Sistem lama **SUDAH FUNGSIONAL** di backend:
* **AI DM:** `gameService` dan `generationService` sudah bisa mengelola narasi.
* **Combat:** `useCombatSystem` sudah bisa menghitung *turn*, *damage*, dan *actions* berdasarkan aturan dasar 5e.
* **Eksplorasi:** `useExplorationSystem` bisa memproses input user (misal: "aku periksa jebakan") dan memicu AI DM.
* **Visual (AI Gen):** Mampu generate *portrait* NPC/Monster dan *map* (Eksplorasi & Battle).
* **Character:** `CreateCharacterWizard.tsx` adalah form wizard standar untuk membuat karakter (Ras, Kelas, Stats).
* **Multiplayer:** Supabase Realtime sudah dipakai untuk sinkronisasi `game_logs` dan `campaign_state`.

### 1.4. Kelemahan Fatal (Alasan "Nuclear Reset")
1.  **Game Feel = 0:** Terasa seperti membuka *dashboard* admin atau Jira, bukan bermain game RPG.
2.  **UI Bloat (Desktop-First):** `GameScreen.tsx` adalah monster monolitik 3-kolom (Chat, Main, Info) yang jika dibuka di mobile menjadi *feed* vertikal yang harus di-scroll sepanjang 5 layar. Ini **TIDAK BISA DITERIMA** untuk VTT.
3.  **Navigasi Rusak:** Menggunakan *bottom nav* (`MobileAppShell`) di dalam game memecah imersi. User harus "pindah halaman" dari Peta ke Inventory ke Chat.
4.  **Inkonsistensi Visual:** Campuran antara gambar pixel art (dari AI) dengan UI *flat design* (ShadCN) membuat visualnya "bentrok".

---

## 2. KONSEPSI SISTEM BARU (v1.x "Grimoire")

Ini adalah arsitektur yang sedang kita bangun.

### 2.1. Filosofi Sistem Baru (v1.x)
**"Game-First, Mobile-First."**

Kita tidak membuat website. Kita membuat *game client* yang kebetulan berjalan di browser. Estetika adalah **Retro RPG (Slay the Spire-style)**: semi-skeuomorphic, pixel-border, hangat, dan fokus.

### 2.2. Arsitektur & Teknologi Baru (v1.x)
* **UI Kit:** **"Grimoire UI"** (Custom, Hand-made).
    * `PixelCard`, `RuneButton`, `StatBar`, `AvatarFrame`, `LogDrawer`.
    * **Aturan:** Dilarang menggunakan komponen ShadCN. Dilarang pakai *border-radius*.
* **Layout:** **Scene-based State Machine.**
    * `App.tsx` menjadi *controller* utama yang menentukan *Scene* mana yang aktif (`BOOT`, `NEXUS`, `BATTLE`, `EXPLORATION`).
    * `GameLayout.tsx`: Kontainer kaku yang memaksa viewport **Portrait 9:16**. Di desktop, viewport ini akan di-center dengan *letterboxing* (The Void).
* **Navigasi:**
    * Tidak ada *page routing*.
    * Interaksi terjadi dalam *Scene* (e.g., `NexusScene` menangani klik "Api" atau "Gerbang").
    * Informasi sekunder (Chat, Inventory, CharSheet) diakses via **Drawers** atau **Modal** di atas *Scene* aktif.
* **Core Principle:** **"Information on Demand, Thumb Zone Priority"**. Tombol aksi utama (kartu skill) harus di jangkauan jempol.

---

## 3. STATUS IMPLEMENTASI & PERBANDINGAN (v0.x vs v1.x)

Ini adalah *delta* antara apa yang kita miliki, apa yang kita inginkan, dan apa yang sudah selesai.

| Fitur | Sistem Lama (v0.x) | Sistem Baru (v1.x "Grimoire") | Status Implementasi (v1.x) |
| :--- | :--- | :--- | :--- |
| **Arsitektur Layout** | `AppLayout` + `ViewManager` (Web routing). | `GameLayout` (Mobile 9:16) + `App.tsx` (State Machine). | **SELESAI (Fase 0)** |
| **UI Kit** | ShadCN/UI (Modern, Flat, Bulat). | Grimoire UI Kit (Pixel, Skeuomorphic, Tajam). | **SELESAI (Fase 1)** |
| **Menu Utama** | `NexusSanctum.tsx` (List link/tombol web). | `NexusScene.tsx` (Visual Api Unggun & Gerbang). | **SELESAI (Fase 2)** |
| **Character Wizard** | `CreateCharacterWizard.tsx` (Form HTML panjang). | `CharacterWizard.tsx` (Modal Grimoire UI, step-by-step). | **SELESAI (Fase 2.5)** |
| **Campaign Wizard** | `CreateCampaignView.tsx` (Form HTML). | `CampaignWizard.tsx` (Modal Grimoire UI). | **SELESAI (Fase 2.5)** |
| **Gameplay HUD** | `GameScreen.tsx` (3 kolom desktop, 1 kolom mobile super panjang). | `BattleScene.tsx` (3 zona mobile-first: Stage, Vitals, Deck). | **SELESAI (Fase 3)** |
| **Akses Chat/Log** | Panel terpisah, selalu terlihat (di desktop). | `LogDrawer.tsx` (Tersembunyi di bawah, *swipe-up*). | **SELESAI (Fase 1 & 3)** |
| **Logika Combat** | `useCombatSystem` (Fungsional). | `useCombatSystem` (Kabelnya disambungkan ulang ke `BattleScene`). | **SELESAI (Fase 3.5)** |
| **Visual Combat** | `BattleMapRenderer.tsx` (Grid 2D Pixel). | `BattleStage.tsx` (**Theater of the Mind** - Visual monster besar). | **TERGANTI (Downgrade)** |
| **Logika Eksplorasi** | `useExplorationSystem` (Fungsional). | Belum ada `ExplorationScene.tsx`. | **BELUM IMPLEMENTASI** |
| **Visual Eksplorasi** | `ExplorationMap.tsx` (Gambar AI). | Belum ada `ExplorationScene.tsx`. | **BELUM IMPLEMENTASI** |
| **Character Sheet** | Panel terpisah (InfoPanel) di `GameScreen`. | Belum ada (Drawer/Modal baru dibutuhkan). | **BELUM IMPLEMENTASI** |
| **Inventory** | Panel terpisah (InfoPanel) di `GameScreen`. | Belum ada (Drawer/Modal baru dibutuhkan). | **BELUM IMPLEMENTASI** |
| **Multiplayer Sync** | Fungsional (via Supabase & `gameStore`). | UI `AvatarFrame` ada. Logic backend ada. Sinkronisasi UI *realtime* belum divalidasi penuh di UI baru. | **BELUM IMPLEMENTASI** |

---

## 4. AGEN & PERSONA (WAJIB DIPATUHI)

Setiap interaksi dengan codebase ini harus mengadopsi persona yang sesuai:

### 👷 Agent 1: THE ARCHITECT (System & QA)
**Tugas:** Menjaga struktur folder, refactoring, dan keamanan kode.
**SOP:**
* Fokus pada *decoupling* (pemisahan). UI (`/components`) tidak boleh tahu soal AI. Logic (`/hooks`) tidak boleh tahu soal UI.
* Patuhi struktur `Scene-based` di `App.tsx`.
* Pantau *circular dependency* seperti elang.

### 🐲 Agent 2: THE DUNGEON MASTER (AI Game Logic)
**Tugas:** Menangani narasi, NPC, dan alur cerita.
**SOP:**
* `gameService` dan `generationService` adalah "Otak" DM.
* Setiap output narasi WAJIB memanggil fungsi `updateGameState` (via `useCombatSystem` atau `useExplorationSystem`) untuk mengubah data (HP, Lokasi), bukan hanya mengirim teks chat.

### ⚖️ Agent 3: THE RULE LAWYER (DnD 5e Mechanics)
**Tugas:** Menghitung angka, probabilitas, dan validasi aturan.
**SOP:**
* `services/battleRules.ts` dan `services/rulesEngine.ts` adalah kitab suci.
* Semua aksi (Attack, Spell) harus divalidasi oleh *Rule Lawyer* sebelum dieksekusi oleh *DM*.
* Di v1.x, kita menyederhanakan "Action" menjadi 1 AP per aksi (gaya Slay the Spire) demi *game flow* mobile, menyimpang sedikit dari DnD 5e (Action, Bonus Action, Reaction).

### 🎨 Agent 4: THE ARTIFICER (UI/UX & Frontend)
**Tugas:** Menyusun tampilan menggunakan **Grimoire UI Design System**.
**SOP:**
* **DILARANG KERAS** menggunakan tag HTML telanjang (`<button>`, `<div>` untuk card, `<input>`) untuk elemen interaktif utama.
* **WAJIB MENGGUNAKAN:**
    * `PixelCard` (untuk container)
    * `RuneButton` (untuk tombol)
    * `StatBar` (untuk HP/MP)
    * `AvatarFrame` (untuk potret)
    * `LogDrawer` (untuk chat)
    * `SkillCard` (untuk aksi)
* Styling WAJIB menggunakan palet Tailwind kustom (`bg-surface`, `border-wood`, `text-parchment`).

---

## 5. ROADMAP SISA (GAWAT DARURAT)

Berdasarkan tabel perbandingan, berikut adalah fitur kritis dari v0.x yang **HILANG** dan harus segera diimplementasikan ulang ke v1.x:

1.  **FASE 4: EKSPLORASI**
    * Buat `ExplorationScene.tsx`.
    * Integrasikan `useExplorationSystem` (logic lama).
    * Tampilkan `ExplorationMap.tsx` (visual lama) di "Stage Area" (zona atas).
    * Buat `ExplorationDeck.tsx` (zona bawah) untuk tombol aksi (Lihat, Bicara, Bergerak).

2.  **FASE 5: THE GRIMOIRES (Buku Mantra & Tas)**
    * Buat `CharacterSheetDrawer.tsx` (Modal/Drawer baru).
    * Buat `InventoryDrawer.tsx` (Modal/Drawer baru).
    * Tambahkan tombol di `BattleScene` atau `ExplorationScene` untuk membuka drawer ini.

3.  **FASE 6: VISUAL COMBAT (Upgrade Opsional)**
    * Integrasikan ulang `BattleMapRenderer.tsx` (Grid) ke dalam `BattleStage.tsx`.
    * Buat *toggle* antara "Theater of the Mind" (Monster Besar) dan "Tactical Grid" (Peta Grid).

4.  **FASE 7: MULTIPLAYER RE-SYNC**
    * Validasi penuh sinkronisasi Supabase Realtime di `BattleScene` dan `ExplorationScene`.
    * Pastikan HP `AvatarFrame` party lain ter-update *live*.
    * Pastikan `LogDrawer` ter-update *live* dari chat pemain lain.