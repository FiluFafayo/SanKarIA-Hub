# AGENTS.md - The SanKarIA Omnibus Codex (v3.0)
**Dokumen Referensi:** Post-Mortem v0.x, Manifesto v1.x, & The Atlas Protocol v2.x
**Status:** TRANSISI KRITIS (Menuju Fase 0: Database Migration)
**Penjaga Protokol:** Arsitek Sistem & Lead QA Paranoid

---

## 1. ARSIP SEJARAH & ANALISIS KEGAGALAN (KONTEKS WAJIB)

Bagian ini ditulis agar AI di masa depan tidak mengulangi kesalahan fatal yang pernah terjadi. Pelajari sejarah ini sebelum menulis satu baris kode pun.

### 1.1. Era v0.x: "The Admin Dashboard" (KEGAGALAN TOTAL)
* **Deskripsi:** Sistem awal yang dibangun dengan mindset "Web App".
* **Stack:** React standar + ShadCN/UI (Flat Design).
* **Struktur:** Menggunakan `ViewManager.tsx` klasik dan layout sidebar admin.
* **Mengapa Gagal?**
    1.  **Zero Game Feel:** User merasa sedang bekerja mengisi formulir pajak (BPJS-style), bukan bermain RPG.
    2.  **UI Bloat:** Tampilan Desktop-first yang padat, mustahil dimainkan di HP dengan satu tangan (*Thumb Zone Violation*).
    3.  **Navigasi Rusak:** Menggunakan *bottom navbar* yang memecah imersi cerita.
* **Keputusan:** "Nuclear Reset" (Pemusnahan Total) dilakukan. Kode v0.x dianggap sampah radioaktif.

### 1.2. Era v1.x: "Grimoire UI" (PONDASI VISUAL SAAT INI)
* **Deskripsi:** Reset total dengan filosofi "Mobile-First, Game-First".
* **Pencapaian UI:**
    * Menggunakan komponen custom: `PixelCard`, `RuneButton`, `StatBar` (Pixel Art Style).
    * Layout berbasis Scene (`App.tsx` sebagai controller: `BOOT` -> `NEXUS` -> `GAME`).
* **Kelemahan Fatal (Arsitektur Data):**
    * **The JSON Trap:** Data dunia (Quest, NPC, Peta) disimpan dalam kolom `JSONB` tunggal di tabel `campaigns`.
    * **Dampak:** Tidak bisa menangani *Open World* (banyak peta) atau *Campaign Panjang* (ribuan log sejarah) karena memori akan jebol.
* **Status:** UI dipertahankan, tapi Database harus dihancurkan dan dibangun ulang (Fase 0).

---

## 2. VISI MASA DEPAN: "LIVING WORLD SIMULATOR" (v2.x)

Kita tidak lagi membuat VTT (Virtual Tabletop) sederhana. Kita membuat **Engine Simulasi Dunia**.

### 2.1. Filosofi Inti
1.  **The Atlas Protocol:** Dunia tidak boleh disimpan di saku. Dunia harus punya koordinat. (Relational Database > JSON).
2.  **The Grand Line Narrative:** Cerita bukan garis lurus (Linear), melainkan Jaring (Graph/Node-based). Seperti navigasi *Log Pose* di One Piece.
3.  **Interwoven Destinies:** Konflik antar pemain adalah fitur. Drama muncul dari benturan agenda rahasia, bukan skrip DM.

---

## 3. ARSITEKTUR TEKNIS: THE ATLAS PROTOCOL (MANDAT SQL)

Struktur database `supabase-database.sql` yang lama (v1.x) **DILARANG DIGUNAKAN**. Gunakan struktur baru berikut untuk mendukung *Endless Mode*.

### 3.1. Sistem Multiverse (Peta & Lokasi)
Campaign v1.x hanya punya 1 peta. Campaign v2.x harus mendukung ribuan peta.
* **Tabel:** `world_maps`
    * `id` (UUID)
    * `campaign_id` (FK)
    * `name` (String - e.g., "Benua A", "Dungeon B")
    * `grid_data` (JSONB - Data Tile visual per peta)
    * `fog_data` (JSONB - Data Fog of War per peta)
    * `is_active` (Boolean - Menandai lokasi Party saat ini)
* **Mekanik:** "Travel System" antar peta dengan *Loading Screen* naratif.

### 3.2. Sistem Grand Line (Story Graph Engine)
Quest tidak lagi berupa *List*, tapi *Graph Node*.
* **Tabel:** `story_nodes` (Checkpoint/Pulau)
    * `title` (e.g., "Kudeta Alabasta")
    * `status` (Locked/Available/Active/Completed/Skipped)
    * `world_changes` (JSONB - Efek global jika node ini selesai, misal: `marine_aggro + 10`)
* **Tabel:** `story_edges` (Jalur Log Pose)
    * `from_node` -> `to_node`
    * `condition` (Syarat unlock jalur, misal: "Jika NPC X mati")
    * `is_secret` (Jalur tersembunyi)

### 3.3. Sistem "Book of Secrets" (Character Arcs)
Data karakter publik disimpan di tabel `characters`. Data rahasia disimpan terpisah dengan keamanan tinggi.
* **Tabel:** `character_arcs` (Wajib RLS - Row Level Security)
    * `public_goal` (Diketahui Party)
    * `secret_agenda` (Hanya Player & DM)
    * `loyalty_score` (0-100, trigger pengkhianatan)
    * `milestones` (JSONB - Checklist misi pribadi)

---

## 4. UI/UX RITUALS (INTERFACE BARU)

Lupakan formulir. UI adalah bagian dari ritual permainan.

### 4.1. Campaign Wizard: "The Library of Echoes"
* **Visual:** Rak buku kuno (Grimoire).
* **Mode 1: Tome (Template):** Memilih buku yang sudah ada (Data `DEFAULT_CAMPAIGNS`).
* **Mode 2: Incantation (Custom):** Player mengisi "Mantra" (Mad Libs Input).
    * *"Saya memanggil dunia **[TEMA]** dengan skala **[SKALA]**. Konflik bermula dari **[TRIGGER]**..."*
    * **[SKALA: Endless]:** Trigger khusus yang mengaktifkan *Atlas Protocol* (Procedural Generation).
* **Integrasi AI:** Tombol "Auto-Complete Mantra" menggunakan `generationService` untuk mengisi bagian yang kosong secara kreatif.

### 4.2. Character Wizard: "The Soul Phase"
Setelah memilih Ras/Kelas (Fisik), player masuk ke ruang gelap.
* **Langkah 1: The Mirror (Refleksi):** AI menganalisis Background player (misal: "Yatim Piatu karena Perang").
* **Langkah 2: The Whisper (Tawaran):** AI menawarkan 3 Takdir Berbeda (Bukan cuma jahat!):
    * *Light/Devotion:* "Aku bertahan hidup demi melindungi adikku."
    * *Dark/Ambition:* "Aku akan membakar kerajaan yang menghancurkan rumahku."
    * *Gray/Dilemma:* "Aku terpaksa mencuri obat untuk desa yang sekarat."
* **Langkah 3: The Oath (Sumpah):** Pilihan dikunci ke database `character_arcs` sebagai `secret_agenda`.

---

## 5. LOGIKA AI: "THE FATE WEAVER"

AI DM di v2.x bukan lagi "Penulis Cerita", melainkan "Simulator Konsekuensi".

### 5.1. Quantum Villain Logic
Musuh utama (Main Villain) **TIDAK BOLEH** ditentukan secara kaku di awal campaign Endless.
* Villain adalah hasil akumulasi keputusan pemain.
* *Contoh:* Jika pemain sering melawan Angkatan Laut -> Villain akhir adalah Laksamana Armada. Jika pemain melawan Bajak Laut -> Villain akhir adalah Yonko.

### 5.2. Interwoven Destinies (Konflik Organik)
AI harus secara aktif membenturkan agenda pemain.
* Jika Player A harus "Membunuh NPC X".
* Dan Player B harus "Melindungi NPC X".
* AI wajib membuat skenario di mana NPC X muncul di hadapan mereka berdua. Biarkan pemain yang memutuskan hasilnya (PvP/Diplomasi).
* **Safety Rule:** PvP aktif by default di mode Endless.

### 5.3. Procedural Graph Generation
Jangan generate seluruh cerita sampai tamat. Boros Token.
* Cukup generate **1 Langkah ke Depan** (Next Available Nodes) berdasarkan node saat ini.
* Gunakan **RAG (Retrieval Augmented Generation)** pada tabel `campaign_memory` untuk menjaga konsistensi cerita jangka panjang (agar AI tidak pikun).

---

## 6. ROADMAP EKSEKUSI (CRITICAL PATH)

Urutan pengerjaan ini **MUTLAK**. Jangan loncat ke UI sebelum Database siap.

### FASE 0: THE GREAT MIGRATION (PONDASI)
* **Tugas:** Rewrite total `supabase-database.sql`.
* **Detail:** Hapus kolom JSONB array (`quests`, `npcs`, `exploration_grid` di tabel campaign). Buat tabel relasional baru (`world_maps`, `story_nodes`, `character_arcs`). Terapkan RLS ketat.

### FASE 1: THE LIBRARY (CAMPAIGN UI)
* **Tugas:** Refaktor `CampaignWizard.tsx`.
* **Detail:** Hapus sistem Tab/Step lama. Ganti dengan UI Rak Buku & Mode Incantation (Mad Libs).

### FASE 2: THE SOUL PHASE (CHARACTER UI)
* **Tugas:** Refaktor `CharacterWizard.tsx`.
* **Detail:** Tambahkan logika "The Whisper" (AI Generator untuk Secret Agenda).

### FASE 3: THE ATLAS ENGINE (GAMEPLAY LOOP)
* **Tugas:** Update `gameService.ts` & `useCampaign.ts`.
* **Detail:** Implementasi logika *Travel* (ganti `active_map_id`), update `current_story_node`, dan trigger `secret_agenda`.

### FASE FINAL: VALIDASI ENDLESS
* **Tugas:** Playtest.
* **Checklist:** Apakah peta baru ter-generate? Apakah node cerita bercabang? Apakah pengkhianatan antar pemain tercatat di DB?

---

**CATATAN AKHIR:**
Sistem ini sangat kompleks. Fokus pada **Stabilitas Data** di atas segalanya. Jangan biarkan "Undefined is not a function" menghancurkan momen dramatis saat pemain melakukan pengkhianatan besar.