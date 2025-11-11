# Changelog

## v0.6.0 — Polishing, Performance, QA

- Marketplace: Tabs `Campaigns/Items/Spells`, grid cards, dan Bottom Sheet filter.
- Interactive Map: kartu aksi kecil pada klik marker (`Inspect/Move/Interact`).
- Aksesibilitas: PTT toggle, STT bahasa dari Settings, font scale global, high-contrast mode.
- Performa: lazy-loading & async decoding gambar (poster kampanye, NPC, pemain, peta), memo hasil filter, skeleton/shimmer saat loading.
- Responsivitas: tap target `Tabs` diperbesar (`min-h-[44px]`), penyesuaian hover/tooltip.
- Bugfix: gating VoicePTT di `ActionBar`/`ChatSheet`, penggunaan `sttLang` dari settings.

## v0.5.x — Systems & UX Enhancements

- Refactor eksplorasi (G-2) ke satu panggilan AI dan penanganan tool calls.
- Fog of War dan grid eksplorasi default, fallback choices.
- Otomasi pembuatan potret NPC (opsional) dengan status pending.

## v0.4.x — Data & Marketplace

- Seeding kampanye default; repository pengelolaan data.
- Hall of Echoes dan Marketplace awalan.

## v0.3.x — Game Loop & Combat

- Sistem combat, tracking efek, kondisi, dan roll.

## v0.2.x — Auth & Layout

- Auth repo & AppLayout, ViewManager.

## v0.1.x — Bootstrap

- Scaffold aplikasi, konfigurasi Vite/Tailwind, struktur komponen dasar.