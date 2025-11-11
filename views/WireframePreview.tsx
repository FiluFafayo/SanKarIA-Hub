import React, { useState } from 'react';
import { Header } from '../components/ui/Header';
import { Banner } from '../components/ui/Banner';
import { Card } from '../components/ui/Card';
import { Tabs } from '../components/ui/Tabs';
import { Stepper } from '../components/ui/Stepper';
import { Drawer } from '../components/ui/Drawer';
import { ModalRoll } from '../components/ui/ModalRoll';
import { QuickDock } from '../components/ui/QuickDock';
import { SwipeCard } from '../components/ui/SwipeCard';

export const WireframePreview: React.FC = () => {
  const [tab, setTab] = useState<string>('home');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [rollOpen, setRollOpen] = useState(false);
  const [dock, setDock] = useState<'explore' | 'combat' | 'chat'>('explore');
  const [showPersistBanner, setShowPersistBanner] = useState(false);
  const [chatFocus, setChatFocus] = useState(false);

  const topTabs = [
    { key: 'home', label: 'Home' },
    { key: 'campaigns', label: 'Campaigns' },
    { key: 'characters', label: 'Characters' },
    { key: 'hub', label: 'Hub' },
    { key: 'settings', label: 'Settings' },
    { key: 'explore', label: 'Explore' },
    { key: 'combat', label: 'Combat' },
    { key: 'chat', label: 'Chat' },
  ];

  return (
    <div className="w-screen min-h-[100dvh] bg-bg-primary text-text-primary flex flex-col">
      <Header title="Wireframe Kit" subtitle="Low-fi (portrait)" rightSlot={
        <div className="flex gap-2">
          <button className="px-3 py-2 bg-amber-700 text-white rounded-token-md" onClick={() => setDrawerOpen(true)}>Drawer</button>
          <button className="px-3 py-2 bg-purple-700 text-white rounded-token-md" onClick={() => setRollOpen(true)}>Modal Roll</button>
          <button className="px-3 py-2 bg-emerald-700 text-white rounded-token-md" onClick={() => setShowPersistBanner(v => !v)}>{showPersistBanner ? 'Hide' : 'Show'} Persist Banner</button>
        </div>
      } />
      <Banner message="Contoh banner auto-hide (info)" type="info" />
      {showPersistBanner && (
        <Banner message="Quest Updated: Temukan Sunstone di gurun timur" type="success" persist />
      )}
      <Tabs items={topTabs} activeKey={tab} onChange={setTab} />
      <div className="flex-1 overflow-y-auto p-space-md">
        {tab === 'home' && (
          <div className="grid grid-cols-1 gap-3">
            <Card title="Home" subtitle="Ringkasan kampanye & karakter">
              <p>Wireframe konten ringkas dengan kartu.</p>
            </Card>
          </div>
        )}
        {tab === 'campaigns' && (
          <div className="space-y-3">
            <Stepper steps={["Pilih Template", "Isi Detail", "Konfirmasi"]} activeIndex={0} />
            <Card title="Campaigns" subtitle="Buat / Lanjutkan / Gabung">
              <p>Daftar kampanye sebagai kartu.</p>
            </Card>
          </div>
        )}
        {tab === 'characters' && (
          <div className="grid grid-cols-1 gap-3">
            <Card title="Characters" subtitle="Wizard karakter & daftar">
              <p>Langkah-langkah wizard dan kartu karakter.</p>
            </Card>
          </div>
        )}
        {tab === 'hub' && (
          <Card title="Hub / Marketplace" subtitle="Item & spell">
            <p>Filter minimal dan grid kartu.</p>
          </Card>
        )}
        {tab === 'settings' && (
          <Card title="Settings" subtitle="Tema, haptics, akun">
            <p>Kontrol sederhana dan select tema.</p>
          </Card>
        )}
        {tab === 'explore' && (
          <div className="space-y-3">
            <Card title="Explore" subtitle="Map + marker actions">
              <p>Placeholder peta dan kartu tindakan kecil (Inspect, Move, Interact).</p>
            </Card>
            <SwipeCard
              title="Marker: Caravan Merchant"
              subtitle="Geser → konfirmasi perjalanan, ← lihat detail"
              onConfirm={() => setShowPersistBanner(true)}
              onDetail={() => setDrawerOpen(true)}
            >
              Lokasi terdekat: Oasis (2 jam). Hadiah perdagangan tersedia.
            </SwipeCard>
          </div>
        )}
        {tab === 'combat' && (
          <div className="space-y-3">
            <Card title="Combat" subtitle="Arena + Quick Actions">
              <div className="flex gap-2">
                <button className="px-3 py-2 bg-amber-700 text-white rounded-token-md" onClick={() => setRollOpen(true)}>Roll</button>
                <button className="px-3 py-2 bg-red-700 text-white rounded-token-md">End Turn</button>
              </div>
            </Card>
            <SwipeCard
              title="Aksi: Serangan Ringan"
              subtitle="Geser → konfirmasi, ← detail aksi"
              onConfirm={() => setShowPersistBanner(true)}
              onDetail={() => setDrawerOpen(true)}
            >
              Serang musuh terdekat dengan pedang (+5 to hit, 1d8).
            </SwipeCard>
          </div>
        )}
        {tab === 'chat' && (
          <Card title="Chat" subtitle="Text + PTT">
            <div className="space-y-2">
              <div className="text-sm text-text-secondary">Ketik pesan di bawah; Quick Dock akan auto-hide saat keyboard aktif.</div>
              <input
                type="text"
                placeholder="Ketik pesan..."
                className="w-full bg-bg-secondary text-text-primary rounded-token-md border border-gray-700 p-space-sm"
                onFocus={() => setChatFocus(true)}
                onBlur={() => setChatFocus(false)}
              />
              <button className="px-3 py-2 bg-sky-700 text-white rounded-token-md">PTT</button>
            </div>
          </Card>
        )}
      </div>
      {/* Quick Dock in-game (visible untuk tab explore/combat/chat) */}
      {['explore','combat','chat'].includes(tab) && (
        <QuickDock hidden={dock === 'chat' && chatFocus} active={dock} onChange={(d) => { setDock(d); setTab(d); }} />
      )}

  <Drawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} title="Drawer Game" />
  <ModalRoll isOpen={rollOpen} onClose={() => setRollOpen(false)} title="Roll" />
    </div>
  );
};

export default WireframePreview;