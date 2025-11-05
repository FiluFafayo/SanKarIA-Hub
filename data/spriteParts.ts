// data/spriteParts.ts
// Ini adalah definisi SSoT untuk SETIAP lapisan piksel yang akan kita gambar
// di canvas tersembunyi. "color" di sini adalah kode internal kita, 
// yang akan dirender oleh pixelRenderer.ts (di Fase 2).

// Tipe SpritePart diadaptasi dari P2 (pixel-vtt-stylizer [cite: 416-418])
export interface SpritePart {
  id: string;
  name: string; // Nama deskriptif
  color: string; // Warna Heksadesimal untuk digambar di canvas
  layer: SpriteLayer; // Kategori lapisan
}

// Tipe Kategori Lapisan BARU (sesuai permintaanmu)
export type SpriteLayer =
  | 'gender_base'
  | 'race_base'
  | 'body_type'
  | 'facial_feature'
  | 'head_accessory'
  | 'hair'
  | 'armor_torso'
  | 'armor_legs'
  | 'weapon_right_hand'
  | 'weapon_left_hand';

// Struktur Kategori BARU yang detail
export type SpriteLayerCategory = {
  gender_base: SpritePart[];
  race_base: SpritePart[];
  body_type: SpritePart[];
  facial_feature: SpritePart[];
  head_accessory: SpritePart[];
  hair: SpritePart[];
  armor_torso: SpritePart[];
  armor_legs: SpritePart[];
  weapon_right_hand: SpritePart[];
  weapon_left_hand: SpritePart[];
};

// DATA INTI: SPRITE_PARTS
export const SPRITE_PARTS: SpriteLayerCategory = {
  
  // Lapisan 1: Bentuk Tubuh Dasar (Jenis Kelamin)
  gender_base: [
    { id: 'gb_male', name: 'Bentuk Pria', color: '#FF0000', layer: 'gender_base' },
    { id: 'gb_female', name: 'Bentuk Wanita', color: '#00FF00', layer: 'gender_base' },
  ],

  // Lapisan 2: Tekstur Kulit/Fitur Ras
  race_base: [
    { id: 'rb_human', name: 'Kulit Human', color: '#E0A890', layer: 'race_base' },
    { id: 'rb_elf', name: 'Kulit Elf (Telinga Runcing)', color: '#F0C0A0', layer: 'race_base' },
    { id: 'rb_dwarf', name: 'Kulit Dwarf (Gempal)', color: '#D09080', layer: 'race_base' },
    { id: 'rb_orc', name: 'Kulit Orc (Hijau/Gading)', color: '#70A070', layer: 'race_base' },
    { id: 'rb_tiefling', name: 'Kulit Tiefling (Merah/Ekor)', color: '#B04040', layer: 'race_base' },
  ],

  // Lapisan 3: Tipe Tubuh (Modifikasi)
  body_type: [
    { id: 'bt_normal', name: 'Normal', color: 'rgba(0,0,0,0)', layer: 'body_type' }, // Transparan = tidak ada modifikasi
    { id: 'bt_missing_arm_r', name: 'Tangan Kanan Buntung', color: '#000001', layer: 'body_type' }, // Kode khusus untuk 'hapus'
    { id: 'bt_missing_arm_l', name: 'Tangan Kiri Buntung', color: '#000002', layer: 'body_type' },
    { id: 'bt_missing_leg_r', name: 'Kaki Kanan Buntung', color: '#000003', layer: 'body_type' },
    { id: 'bt_missing_leg_l', name: 'Kaki Kiri Buntung', color: '#000004', layer: 'body_type' },
    { id: 'bt_cybernetic_arm_r', name: 'Tangan Cybernetic Kanan', color: '#A0A0B0', layer: 'body_type' },
  ],

  // Lapisan 4: Fitur Wajah (Luka, Jenggot)
  facial_feature: [
    { id: 'ff_none', name: 'Tidak Ada', color: 'rgba(0,0,0,0)', layer: 'facial_feature' },
    { id: 'ff_scar_eye_r', name: 'Luka Mata Kanan', color: '#FF8080', layer: 'facial_feature' },
    { id: 'ff_one_eye_blind', name: 'Satu Mata Buta', color: '#FFFFFF', layer: 'facial_feature' },
    { id: 'ff_beard_long', name: 'Jenggot Panjang', color: '#504030', layer: 'facial_feature' },
    { id: 'ff_beard_short', name: 'Jenggot Pendek', color: '#605040', layer: 'facial_feature' },
    { id: 'ff_mustache', name: 'Kumis', color: '#706050', layer: 'facial_feature' },
  ],

  // Lapisan 5: Aksesori Kepala (Tanduk, dll)
  head_accessory: [
    { id: 'ha_none', name: 'Tidak Ada', color: 'rgba(0,0,0,0)', layer: 'head_accessory' },
    { id: 'ha_horns_small', name: 'Tanduk Kecil (Tiefling)', color: '#302020', layer: 'head_accessory' },
    { id: 'ha_horn_one', name: 'Tanduk Sebelah', color: '#302021', layer: 'head_accessory' },
    { id: 'ha_horns_ram', name: 'Tanduk Domba Besar', color: '#403030', layer: 'head_accessory' },
    { id: 'ha_circlet', name: 'Lingkaran Elf', color: '#F0E0B0', layer: 'head_accessory' },
    { id: 'ha_headband', name: 'Ikat Kepala', color: '#802020', layer: 'head_accessory' },
  ],

  // Lapisan 6: Rambut
  hair: [
    { id: 'h_bald', name: 'Botak', color: 'rgba(0,0,0,0)', layer: 'hair' },
    { id: 'h_long_black', name: 'Rambut Panjang Hitam', color: '#101010', layer: 'hair' },
    { id: 'h_short_blond', name: 'Rambut Pendek Pirang', color: '#F0D060', layer: 'hair' },
    { id: 'h_spiky_red', name: 'Rambut Spiky Merah', color: '#C04020', layer: 'hair' },
    { id: 'h_ponytail_brown', name: 'Kuncir Kuda Coklat', color: '#704020', layer: 'hair' },
  ],

  // Lapisan 7: Armor Torso
  armor_torso: [
    { id: 'at_common_clothes', name: 'Baju Biasa', color: '#808070', layer: 'armor_torso' },
    { id: 'at_leather_armor', name: 'Armor Kulit', color: '#8B4513', layer: 'armor_torso' },
    { id: 'at_chain_mail', name: 'Baju Zirah Rantai', color: '#C0C0C0', layer: 'armor_torso' },
    { id: 'at_plate_armor', name: 'Baju Zirah Lempeng', color: '#E0E0E0', layer: 'armor_torso' },
    { id: 'at_mage_robe', name: 'Jubah Penyihir', color: '#00008B', layer: 'armor_torso' },
    { id: 'at_scifi_armor', name: 'Armor Sci-Fi', color: '#B0F0F0', layer: 'armor_torso' },
  ],

  // Lapisan 8: Armor Kaki
  armor_legs: [
    { id: 'al_common_pants', name: 'Celana Biasa', color: '#605040', layer: 'armor_legs' },
    { id: 'al_leather_boots', name: 'Sepatu Kulit', color: '#8B5A2B', layer: 'armor_legs' },
    { id: 'al_plate_greaves', name: 'Greaves Lempeng', color: '#D0D0D0', layer: 'armor_legs' },
    { id: 'al_mage_robe_skirt', name: 'Rok Jubah', color: '#00007A', layer: 'armor_legs' },
  ],

  // Lapisan 9: Tangan Kanan
  weapon_right_hand: [
    { id: 'wrh_none', name: 'Tangan Kanan Kosong', color: 'rgba(0,0,0,0)', layer: 'weapon_right_hand' },
    { id: 'wrh_longsword', name: 'Pedang Panjang', color: '#D0D0FF', layer: 'weapon_right_hand' },
    { id: 'wrh_axe', name: 'Kapak', color: '#B0B0C0', layer: 'weapon_right_hand' },
    { id: 'wrh_dagger', name: 'Belati', color: '#A0A0A0', layer: 'weapon_right_hand' },
    { id: 'wrh_staff', name: 'Tongkat Sihir', color: '#805030', layer: 'weapon_right_hand' },
    { id: 'wrh_portal_gun', name: 'Pistol Portal', color: '#20C0F0', layer: 'weapon_right_hand' },
  ],

  // Lapisan 10: Tangan Kiri
  weapon_left_hand: [
    { id: 'wlh_none', name: 'Tangan Kiri Kosong', color: 'rgba(0,0,0,0)', layer: 'weapon_left_hand' },
    { id: 'wlh_shield', name: 'Perisai', color: '#A06040', layer: 'weapon_left_hand' },
    { id: 'wlh_dagger', name: 'Belati', color: '#A0A0A0', layer: 'weapon_left_hand' },
    { id: 'wlh_orb', name: 'Bola Sihir', color: '#F020F0', layer: 'weapon_left_hand' },
  ],
};