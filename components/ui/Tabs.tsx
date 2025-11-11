import React from 'react';

export interface TabItem { key: string; label: string; }

interface TabsProps {
  items: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
}

export const Tabs: React.FC<TabsProps> = ({ items, activeKey, onChange }) => {
  return (
    <div className="flex border-b border-border-primary bg-bg-secondary" role="tablist" aria-orientation="horizontal">
      {items.map(it => (
        <button key={it.key} onClick={() => onChange(it.key)}
          className={`px-4 py-3 min-h-[44px] text-sm transition-standard ${activeKey === it.key ? 'text-amber-300 border-b-2 border-amber-500' : 'text-text-secondary hover:text-text-primary'}`}
          role="tab" aria-selected={activeKey === it.key} aria-controls={`tab-${it.key}`}>
          {it.label}
        </button>
      ))}
    </div>
  );
};

export default Tabs;