# Catatan Pengguna (Rilis v0.6.0)

Terima kasih telah mencoba SanKarIA-Hub! Berikut adalah sorotan rilis dan tips penggunaan.

## Fitur Baru
- Marketplace
  - Tabs `Campaigns / Items / Spells` untuk navigasi cepat.
  - Grid cards dengan filter di Bottom Sheet (genre, jenis/kelangkaan/magis, school/level).
- Peta Interaktif
  - Klik marker menampilkan kartu aksi kecil: `Inspect`, `Move`, `Interact`.
- Aksesibilitas
  - Toggle Push-to-Talk (PTT) dan pilihan bahasa STT di Pengaturan.
  - Skala font global (`Settings → Display → Skala UI`).
  - Mode High-Contrast untuk visibilitas lebih kuat.

## Peningkatan Performa
- Lazy-loading & async decoding pada gambar (kampanye, NPC, pemain, peta).
- Skeleton/shimmer saat loading daftar kampanye.
- Optimalisasi filter Items/Spells untuk mengurangi re-render.

## Tips Penggunaan
- Marketplace: gunakan tombol `Filter` di bawah judul untuk membuka Bottom Sheet menyaring konten.
- Peta: klik marker untuk menampilkan aksi; klik di luar untuk menutup.
- Pengaturan: aktifkan High-Contrast jika kontras kurang, atur `Skala UI` agar teks lebih nyaman.

## Dikenal & Rencana
- Aksi `Move/Interact` pada peta siap dihubungkan ke aksi kampanye (store) sesuai kebutuhan.
- Virtualisasi daftar besar dapat ditambahkan jika dataset bertambah.

Selamat menjelajah! Jika menemukan bug, silakan laporkan melalui repositori atau saluran dukungan internal.