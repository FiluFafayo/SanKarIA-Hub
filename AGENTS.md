# AGENTS.md - Protokol Arsitektur Grimoire v1.2 (Full Context)
**Dokumen Referensi:** Post-Mortem v0.x & Manifesto v1.x
**Status:** RILIS STABIL (Fase Konstruksi Selesai - Masuk Runtime Testing)
**Penjaga Protokol:** Arsitek Sistem & Lead QA Paranoid

---

## 1. HISTORI & KONTEKS: MENGAPA KITA ADA DI SINI?

Bagian ini dipertahankan agar AI di masa depan memahami alasan di balik keputusan arsitektur saat ini.

### 1.1. Audit Post-Mortem Sistem Lama (v0.x "Nexus Sanctum")
Sistem lama adalah **"Web App yang Dipaksakan Menjadi VTT"**.
* **Filosofi:** Fokus fungsionalitas backend (Supabase Sync) dengan frontend generik.
* **Arsitektur:** `ViewManager.tsx` yang menukar-nukar halaman penuh (Full Page Swap).
* **UI Kit:** ShadCN/UI (Flat, Modern, Desktop-first). Sangat tidak cocok untuk game fantasi.
* **Kelemahan Fatal (Alasan Nuclear Reset):**
    1.  **Game Feel Nol:** Terasa seperti membuka dashboard admin/Jira, bukan game.
    2.  **UI Bloat:** `GameScreen.tsx` adalah monster monolitik yang tidak responsif di mobile.
    3.  **Dead-End Logic:** Navigasi berbasis URL memecah imersi dan state sering hilang saat refresh.

### 1.2. Konsepsi Sistem Baru (v1.x "Grimoire Engine")
* **Filosofi:** **"Game-First, Mobile-First, Retro-Soul."**
* **Arsitektur:** **Scene-based State Machine** (BOOT -> NEXUS -> EXPLORATION <-> BATTLE).
* **UI Kit:** **"Grimoire UI"** (Custom, Pixel-art borders, Skeuomorphic).
* **Prinsip:** "Information on Demand, Thumb Zone Priority". Data sekunder (Sheet/Tas) disembunyikan di Drawer, layar utama untuk Visual Dunia.

---

## 2. ARSITEKTUR STATE MACHINE (CORE v1.2)

Jantung aplikasi bukan lagi Router, melainkan State Machine di `App.tsx` yang diawasi ketat.

### 2.1. The Four States
1.  **BOOT:**
    * Inisialisasi Auth (Supabase Gotrue).
    * Inisialisasi Data SSoT (Single Source of Truth) dari DB.
    * *Visual:* "Grimoire Loading Screen" (bukan log teks kasar).
2.  **NEXUS (The Hub):**
    * Pilih Karakter (Campfire).
    * Buat/Gabung Campaign (Dungeon Gate).
    * *Logic:* Memastikan user memiliki `playingCharacter` dan `playingCampaign` sebelum diizinkan lanjut.
3.  **EXPLORATION (The World):**
    * **Wadah:** `ExplorationScene.tsx`.
    * **Fungsi:** Roleplay bebas, Navigasi Peta (Grid/Fog), Interaksi NPC.
    * **Watcher:** Memantau `campaign.gameState`. Jika berubah jadi 'combat', otomatis lempar ke BATTLE.
4.  **BATTLE (The War Room):**
    * **Wadah:** `BattleScene.tsx`.
    * **Fungsi:** Mode Taktis (Initiative, Action Economy, HP Management).
    * **Fitur:** Dual-View (Theater of Mind vs Tactical Grid).
    * **Exit:** Saat musuh habis, state dikembalikan ke EXPLORATION.

---

## 3. KOMPARASI IMPLEMENTASI: NEXUS SANCTUM (LAMA) VS GRIMOIRE (BARU)

Tabel ini menunjukkan evolusi fitur.
*Status Update: Semua fitur kritikal Fase 0-6 kini berstatus **SELESAI**.*

| Fitur | Sistem Lama (v0.x Nexus Sanctum) | Sistem Baru (v1.x Grimoire Engine) | Status Terkini (v1.2) |
| :--- | :--- | :--- | :--- |
| **Engine Layout** | `AppLayout` + `ViewManager` (Web-style) | `GameLayout` + `App.tsx` (Game Loop) | **SELESAI** |
| **Visual Style** | ShadCN (Flat/Corporate) | Grimoire Kit (Pixel/Retro/RPG) | **SELESAI** |
| **Navigasi** | Sidebar/Bottom Nav konvensional | Scene Transition & Drawers | **SELESAI** |
| **Character Creation** | Wizard panjang membosankan | `CharacterWizard` (Imersif, Step-by-step) | **SELESAI** |
| **Mode Eksplorasi** | Halaman statis / Teks saja | `ExplorationScene` + Peta Grid + Fog of War | **SELESAI** |
| **Mode Combat** | `GameScreen` (Teks berat, membingungkan) | `BattleScene` (Visual, Dual-Mode, Targeting) | **SELESAI** |
| **Inventory** | List teks biasa di panel info | `InventoryDrawer` (Grid Item, Filter Equip) | **SELESAI** |
| **Character Sheet** | Panel info yang selalu terlihat (makan tempat) | `CharacterSheetDrawer` (Tab Stats/Skill/Spell) | **SELESAI** |
| **Roleplay Input** | Chatbox biasa | Input Teks Sentral + PTT (Voice - *Planned*) | **SELESAI** |
| **AI Dungeon Master** | Chatbot terpisah | **Invisible Service** yang mengontrol narasi & aturan | **SELESAI** |

---

## 4. PROTOKOL AGEN (SOP TERBARU)

Agen AI yang membaca dokumen ini harus mengadopsi persona berikut saat memodifikasi kode.

### Agent 1: THE ARCHITECT (System & QA)
**Tugas:** Menjaga Stabilitas & Integritas Data.
* **Aturan Emas:** "Jangan biarkan User terjebak di State mati."
* **Fokus:**
    * Sinkronisasi State: Pastikan `campaignActions` selalu meng-update Store global.
    * Validasi Transisi: Cek data (HP, Inventory) saat pindah dari Explore ke Combat dan sebaliknya.
    * Clean UI: Jangan biarkan error teknis (seperti Clock Skew) merusak imersi pemain. Tampilkan Loading Screen.

### Agent 2: THE DUNGEON MASTER (AI Logic)
**Tugas:** Menjaga Jiwa RPG & Narasi.
* **Aturan Emas:** "Angka boleh kaku, tapi cerita harus cair."
* **Fokus:**
    * Interpretasi Niat: Ubah input teks pemain ("Aku salto di atas meja") menjadi mekanik game (Dex Check) yang relevan.
    * Flavor Text: Gunakan `LogDrawer` untuk mendeskripsikan hasil, bukan cuma angka.

### Agent 3: THE RULE LAWYER (5e Mechanics)
**Tugas:** Menjaga Keseimbangan & Aturan Main.
* **Aturan Emas:** "Adil itu kejam."
* **Fokus:**
    * Action Economy: Pastikan pemain tidak menyerang 2x jika cuma punya 1 Action.
    * Resource Management: Kurangi Spell Slot & Item Count secara akurat.
    * Validasi Target: Serangan harus punya target yang valid (HP > 0, Jarak cukup).

### Agent 4: THE ARTIFICER (UI/UX)
**Tugas:** Menjaga Estetika & Kenyamanan (Thumb Zone).
* **Aturan Emas:** "Layar HP itu kecil."
* **Fokus:**
    * Gunakan Drawer/Modal untuk informasi sekunder.
    * Tombol aksi utama harus besar dan mudah dijangkau jempol kanan/kiri bawah.
    * Hindari scroll panjang di tengah pertarungan.

---

## 5. ROADMAP MASA DEPAN (v1.3+)

Fase konstruksi fundamental (Fase 0-6) telah dinyatakan **SELESAI**. Kita sekarang bergerak ke fase *Polish & Expansion*.

1.  **FASE 7: SENSORY FEEDBACK (Audio & Haptics)**
    * Menambahkan BGM (Ambient/Combat).
    * SFX untuk interaksi UI dan Dice Roll.
    * Getaran (Haptics) untuk device mobile.

2.  **FASE 8: REALTIME MULTIPLAYER (The Gathering)**
    * Validasi sinkronisasi posisi player lain di `ExplorationMap`.
    * Sinkronisasi inisiatif dan giliran combat antar klien.

3.  **FASE 9: KONTEN & KEDALAMAN**
    * Implementasi Level Up yang lengkap (Feats, Subclass).
    * Perluasan database Item dan Monster.

4.  **FASE 10: OPTIMASI PERFORMA**
    * Code splitting untuk Scene yang berat.
    * Caching aset gambar yang agresif.