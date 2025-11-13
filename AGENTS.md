# AGENTS.md - Protokol Arsitektur Grimoire v1.1
**Dokumen Referensi:** Post-Mortem v0.x & Manifesto v1.x
**Status:** AKTIF (Stabil Pasca "Fase Final")
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
    * `ViewManager.tsx`: Mengatur "halaman" mana yang tampil.
* **State:** Zustand (`appStore`, `gameStore`) + React Context.
* **Navigasi:** Berbasis URL/View-swapping. User merasa "pindah halaman web".

### 1.3. Kelemahan Fatal (Alasan "Nuclear Reset")
1.  **Game Feel = 0:** Terasa seperti membuka *dashboard* admin atau Jira.
2.  **UI Bloat (Desktop-First):** `GameScreen.tsx` adalah monster monolitik 3-kolom.
3.  **Navigasi Rusak:** Menggunakan *bottom nav* yang memecah imersi.
4.  **Inkonsistensi Visual:** Bentrok antara Pixel Art AI dan Flat UI.

---

## 2. KONSEPSI SISTEM BARU (v1.x "Grimoire")

Ini adalah arsitektur yang sedang kita bangun.

### 2.1. Filosofi Sistem Baru (v1.x)
**"Game-First, Mobile-First."**
Kita membuat *game client*. Estetika adalah **Retro RPG (Slay the Spire-style)**: semi-skeuomorphic, pixel-border, hangat, dan fokus.

### 2.2. Arsitektur & Teknologi Baru (v1.x)
* **UI Kit:** **"Grimoire UI"** (Custom, Hand-made).
    * `PixelCard`, `RuneButton`, `StatBar`, `AvatarFrame`, `LogDrawer`.
* **Layout:** **Scene-based State Machine.**
    * `App.tsx` menjadi *controller* utama (`BOOT`, `NEXUS`, `BATTLE`, `EXPLORATION`).
    * `GameLayout.tsx`: Viewport **Portrait 9:16**.
* **Navigasi:**
    * Tidak ada *page routing*. Interaksi terjadi dalam *Scene*.
    * Informasi sekunder diakses via **Drawers** atau **Modal**.
* **Core Principle:** **"Information on Demand, Thumb Zone Priority"**.

---

## 3. STATUS IMPLEMENTASI & PERBANDINGAN (v0.x vs v1.x)

*Update v1.1: Wizard & Rules Engine Completed*

| Fitur | Sistem Lama (v0.x) | Sistem Baru (v1.x "Grimoire") | Status Implementasi (v1.x) |
| :--- | :--- | :--- | :--- |
| **Arsitektur Layout** | `AppLayout` + `ViewManager`. | `GameLayout` + `App.tsx`. | **SELESAI (Fase 0)** |
| **UI Kit** | ShadCN/UI. | Grimoire UI Kit. | **SELESAI (Fase 1)** |
| **Menu Utama** | `NexusSanctum.tsx`. | `NexusScene.tsx`. | **SELESAI (Fase 2)** |
| **Character Wizard** | `CreateCharacterWizard.tsx`. | `CharacterWizard.tsx` (Static Assets, 5e Logic). | **TERVALIDASI (Fase 0 & 1)** |
| **Campaign Wizard** | `CreateCampaignView.tsx`. | `CampaignWizard.tsx` (3-Step, Rules Config). | **TERVALIDASI (Fase Final)** |
| **Gameplay HUD** | `GameScreen.tsx`. | `BattleScene.tsx` (3 zona mobile-first). | **SELESAI (Fase 3)** |
| **Akses Chat/Log** | Panel terpisah. | `LogDrawer.tsx`. | **SELESAI (Fase 1 & 3)** |
| **Logika Combat** | `useCombatSystem`. | `useCombatSystem` (Re-wired). | **SELESAI (Fase 3.5)** |
| **Logika Eksplorasi** | `useExplorationSystem`. | Belum ada `ExplorationScene.tsx`. | **BELUM IMPLEMENTASI** |
| **Visual Eksplorasi** | `ExplorationMap.tsx`. | Belum ada `ExplorationScene.tsx`. | **BELUM IMPLEMENTASI** |
| **Character Sheet** | Panel InfoPanel. | Belum ada (Drawer/Modal baru dibutuhkan). | **BELUM IMPLEMENTASI** |
| **Inventory** | Panel InfoPanel. | Belum ada (Drawer/Modal baru dibutuhkan). | **BELUM IMPLEMENTASI** |

---

## 4. AGEN & PERSONA (WAJIB DIPATUHI)

### Agent 1: THE ARCHITECT (System & QA)
**Tugas:** Menjaga struktur folder, refactoring, dan keamanan kode.
**SOP:**
* Fokus pada *decoupling*. UI tidak boleh tahu soal AI.
* Pantau *circular dependency* (Contoh kasus: `classes.ts` vs `defaultCharacters.ts`).

### Agent 2: THE DUNGEON MASTER (AI Game Logic)
**Tugas:** Menangani narasi, NPC, dan alur cerita.
**SOP:**
* `gameService` adalah "Otak".
* Patuhi `CampaignRules` (Level Awal, XP/Milestone) yang tersimpan di database.

### Agent 3: THE RULE LAWYER (DnD 5e Mechanics)
**Tugas:** Validasi aturan.
**SOP:**
* `services/rulesEngine.ts` adalah kitab suci.
* Karakter baru WAJIB memiliki Skill, Spell (jika Caster), dan Equipment yang legal.

### Agent 4: THE ARTIFICER (UI/UX & Frontend)
**Tugas:** Menyusun tampilan Grimoire UI.
**SOP:**
* **DILARANG KERAS** menggunakan tag HTML telanjang.
* **Asset Protocol:** Gunakan `getStaticAvatar()` untuk ras standar. Jangan memanggil AI Image Generation untuk aset statis demi performa & biaya.
* Styling WAJIB menggunakan palet Tailwind kustom (`bg-surface`, `border-wood`).

---

## 5. ROADMAP SISA (CRITICAL PATH)

Fitur kritis yang masih hilang dan harus diimplementasikan:

1.  **FASE 4: EKSPLORASI**
    * Buat `ExplorationScene.tsx`.
    * Integrasikan `useExplorationSystem`.
    * Tampilkan visual peta di "Stage Area".

2.  **FASE 5: THE GRIMOIRES (Buku Mantra & Tas)**
    * Buat `CharacterSheetDrawer.tsx` (Modal/Drawer).
    * Buat `InventoryDrawer.tsx` (Modal/Drawer).
    * *Dependency:* Data karakter kini sudah lengkap (Fase 1 Fix), tinggal menampilkannya.

3.  **FASE 6: VISUAL COMBAT (Upgrade Opsional)**
    * Integrasikan ulang `BattleMapRenderer.tsx`.
    * Toggle "Theater of the Mind" vs "Tactical Grid".

4.  **FASE 7: MULTIPLAYER RE-SYNC**
    * Validasi sinkronisasi Realtime di `BattleScene`.
    * Pastikan HP & Log Party terupdate live.