import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface MenuItem {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
}

interface MenuProps {
  items: MenuItem[];
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement>;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

export const Menu: React.FC<MenuProps> = ({ items, open, onClose, anchorRef, position = 'bottom-right' }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open || !anchorRef.current) return null;

  const anchorRect = anchorRef.current.getBoundingClientRect();
  let top: number | 'auto' = anchorRect.bottom + 4;
  let left: number | 'auto' = anchorRect.left;
  let right: number | 'auto' = 'auto';

  if (position.includes('right')) {
    left = 'auto';
    right = window.innerWidth - anchorRect.right + 4;
  }
  if (position.includes('top')) {
    top = 'auto';
  }

  const menuContent = (
    <div
      ref={menuRef}
      className="menu"
      style={{
        position: 'fixed',
        top: position.includes('top') ? 'auto' : top,
        bottom: position.includes('top') ? window.innerHeight - anchorRect.top + 4 : 'auto',
        left: position.includes('right') ? 'auto' : left,
        right: position.includes('right') ? right : 'auto',
        zIndex: 200,
        minWidth: '180px',
        padding: '6px',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'saturate(180%) blur(20px)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-lg)',
      }}
      role="menu"
    >
      {items.map((item, i) => (
        <button
          key={i}
          role="menuitem"
          disabled={item.disabled}
          onClick={() => { item.onClick(); onClose(); }}
          className={`w-full px-3 py-2 text-left rounded-md text-ink text-sm transition-colors ${item.danger ? 'text-danger' : ''} ${item.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          {item.icon && <span>{item.icon}</span>}
          {item.label}
        </button>
      ))}
    </div>
  );

  return createPortal(menuContent, document.body);
};

export default Menu;