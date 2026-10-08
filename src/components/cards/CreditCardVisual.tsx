import React, { useState } from 'react';
import { Wifi, RotateCcw, Copy, Check, Eye, EyeOff } from 'lucide-react';
import { CreditCard } from '../../types';

export interface CardNetworkOption {
  id: string;
  name: string;
  label: string;
}

export const CARD_NETWORKS: CardNetworkOption[] = [
  { id: 'visa', name: 'Visa', label: 'VISA' },
  { id: 'mastercard', name: 'Mastercard', label: 'Mastercard' },
  { id: 'rupay', name: 'RuPay', label: 'RuPay' },
  { id: 'amex', name: 'American Express', label: 'Amex' },
  { id: 'discover', name: 'Discover', label: 'Discover' },
  { id: 'diners', name: 'Diners Club', label: 'Diners' },
];

interface CreditCardVisualProps {
  card: CreditCard;
  cardholderName?: string;
  showFlipButton?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

// Payment Network Vector Badges
export const NetworkLogo: React.FC<{ network: string; className?: string }> = ({
  network,
  className = 'h-7',
}) => {
  const norm = (network || 'visa').toLowerCase();

  if (norm.includes('master')) {
    return (
      <div className={`flex items-center justify-center shrink-0 ${className}`} title="Mastercard">
        <svg viewBox="0 0 138 84" className="h-full w-auto max-h-full max-w-full drop-shadow-sm select-none" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="42" cy="42" r="42" fill="#EB001B" />
          <circle cx="96" cy="42" r="42" fill="#F79E1B" />
          <path
            d="M69 11.8a41.8 41.8 0 0 1 0 60.4 41.8 41.8 0 0 1 0-60.4Z"
            fill="#FF5F00"
          />
        </svg>
      </div>
    );
  }

  if (norm.includes('rupay')) {
    return (
      <div className={`flex items-center justify-center shrink-0 ${className}`} title="RuPay">
        <div className="flex items-center gap-0.5 bg-white/95 px-1.5 py-0.5 rounded shadow-xs border border-white/60">
          <span className="text-[#0B2F64] text-[9px] font-black italic tracking-tighter leading-none">Ru</span>
          <span className="text-[#00843D] text-[9px] font-black italic tracking-tighter leading-none">Pay</span>
          <div className="flex -space-x-1 ml-0.5">
            <span className="text-[#0B2F64] font-black text-[8px] leading-none">▶</span>
            <span className="text-[#F26522] font-black text-[8px] leading-none">▶</span>
          </div>
        </div>
      </div>
    );
  }

  if (norm.includes('amex') || norm.includes('american')) {
    return (
      <div className={`flex items-center justify-center shrink-0 ${className}`} title="American Express">
        <div className="bg-[#002663] text-white font-black tracking-widest text-[8px] px-1.5 py-0.5 rounded border border-white/70 shadow-xs uppercase leading-none">
          AMEX
        </div>
      </div>
    );
  }

  if (norm.includes('discover')) {
    return (
      <div className={`flex items-center justify-center shrink-0 ${className}`} title="Discover">
        <div className="bg-white/95 text-neutral-900 px-1.5 py-0.5 rounded font-black tracking-tight text-[8px] shadow-xs border border-white/60 flex items-center leading-none">
          DISC<span className="inline-block w-1.5 h-1.5 rounded-full bg-[#F36F21] mx-0.5" />VER
        </div>
      </div>
    );
  }

  if (norm.includes('diner')) {
    return (
      <div className={`flex items-center justify-center shrink-0 ${className}`} title="Diners Club">
        <div className="flex items-center gap-1 bg-white/95 px-1.5 py-0.5 rounded text-[#004B87] font-extrabold text-[8px] shadow-xs border border-white/60 leading-none">
          <div className="flex -space-x-1">
            <div className="w-2.5 h-2.5 rounded-full border border-[#004B87]" />
            <div className="w-2.5 h-2.5 rounded-full border border-[#004B87]" />
          </div>
          <span>Diners</span>
        </div>
      </div>
    );
  }

  // Default: VISA with clean official typography & drop-shadow
  return (
    <div className={`flex items-center justify-center shrink-0 ${className}`} title="Visa">
      <svg viewBox="0 0 100 32" className="h-full w-auto max-h-full max-w-full drop-shadow-sm select-none" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M38.8 3.5L25.6 28.5h-5.4L11.5 8.9c-.6-2.4-1.2-3.1-3.2-4.1C5.3 3.3 2.1 2.5 0 2l.3 1.5c4.7 1 9.9 3.6 12.3 8.3l6.5 24.7h6l9.3-25h-5.6zm23.8 0c-4.4 0-7.7 2.3-7.9 5.8-.1 2.5 2.2 3.9 3.9 4.8 1.8.8 2.4 1.4 2.4 2.2 0 1.2-1.4 1.7-2.7 1.7-1.8 0-2.8-.3-4.3-.9l-.6-.3-.6 3.7c1 .5 2.8.9 4.7.9 4.7 0 7.8-2.3 7.8-6 0-2-.1-3.5-2.6-4.7-1.5-.8-2.4-1.3-2.4-2.1 0-.7.8-1.5 2.5-1.5 1.4 0 2.4.3 3.2.7l.4.2.6-3.6c-.9-.4-2.2-.6-3.8-.6zm18.3 0h-4.3c-1.3 0-2.3.4-2.9 1.8l-8.2 19.7h5.8l1.2-3.3h7.1l.7 3.3h5.1l-4.5-21.5zm-6.8 14.5l2.2-6.1 1.3 6.1h-3.5zm-33.8-14.5l-4.4 21.5h5.5l4.4-21.5h-5.5z"
          fill="#FFFFFF"
        />
      </svg>
    </div>
  );
};

// Compact Card Thumbnail for Dashboard & List Items
export const CardThumbnail: React.FC<{
  card: CreditCard;
  className?: string;
}> = ({ card, className = 'w-12 h-8' }) => {
  const network = detectCardNetwork(card);
  return (
    <div
      className={`relative rounded-lg shadow-xs flex items-center justify-between p-1.5 text-white shrink-0 overflow-hidden border border-white/20 select-none ${className}`}
      style={{
        backgroundColor: card.color || '#18181B',
        backgroundImage: `
          radial-gradient(circle at 10% 20%, rgba(255, 255, 255, 0.22) 0%, transparent 50%),
          linear-gradient(135deg, ${card.color || '#18181B'} 0%, rgba(10, 10, 20, 0.95) 120%)
        `,
      }}
    >
      {/* Mini Smart Chip */}
      <div className="w-2.5 h-2 rounded-[2px] bg-gradient-to-br from-[#FFEBA0] via-[#D4AF37] to-[#8C6D1F] border border-amber-300/80 shadow-2xs shrink-0" />

      {/* Network Emblem */}
      <div className="h-3 flex items-center justify-end max-w-[26px]">
        <NetworkLogo network={network} className="h-2.5" />
      </div>

      {/* Specular sheen */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-transparent pointer-events-none" />
    </div>
  );
};

// Authentic Realistic EMV Microchip
export const EmvChip: React.FC<{ variant?: 'gold' | 'silver'; size?: 'sm' | 'md' }> = ({
  variant = 'gold',
  size = 'md',
}) => {
  const isGold = variant === 'gold';
  const isSm = size === 'sm';
  return (
    <div
      className={`relative rounded-md overflow-hidden border shrink-0 ${
        isSm ? 'h-7 w-9.5' : 'h-8.5 w-11.5 sm:h-9.5 sm:w-12.5'
      } ${
        isGold
          ? 'border-[#8B6508]/80 bg-gradient-to-br from-[#FFEBA0] via-[#D4AF37] to-[#8C6D1F]'
          : 'border-slate-400 bg-gradient-to-br from-[#FFFFFF] via-[#CBD5E1] to-[#64748B]'
      }`}
      style={{
        boxShadow:
          'inset 0 1px 2px rgba(255,255,255,0.8), inset 0 -1px 2px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.3)',
      }}
      title="EMV Secure Smart Chip"
    >
      {/* Circuit lines */}
      <div className="absolute inset-0 flex flex-col justify-between p-1 opacity-75 pointer-events-none">
        {/* Top contact dividers */}
        <div className="flex justify-between border-b border-black/35 pb-0.5">
          <div className="w-2.5 h-0.5 border-r border-black/35" />
          <div className="w-3 h-0.5 border-l border-black/35" />
        </div>
        {/* Center contact pad rounded core */}
        <div className="self-center w-4 h-3 rounded-xs border border-black/40 bg-black/5 flex items-center justify-center">
          <div className="w-1.5 h-1 rounded-2xs border border-black/25" />
        </div>
        {/* Bottom contact dividers */}
        <div className="flex justify-between border-t border-black/35 pt-0.5">
          <div className="w-2.5 h-0.5 border-r border-black/35" />
          <div className="w-3 h-0.5 border-l border-black/35" />
        </div>
      </div>
      {/* Specular sheen */}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/35 to-transparent pointer-events-none" />
    </div>
  );
};

// Detect network from card.network or issuer or nickname
export function detectCardNetwork(card: { network?: string; issuer?: string; nickname?: string }): string {
  if (card.network && card.network.trim()) {
    return card.network.toLowerCase();
  }
  const combined = `${card.issuer || ''} ${card.nickname || ''}`.toLowerCase();
  if (combined.includes('master')) return 'mastercard';
  if (combined.includes('rupay')) return 'rupay';
  if (combined.includes('amex') || combined.includes('american')) return 'amex';
  if (combined.includes('discover')) return 'discover';
  if (combined.includes('diner')) return 'diners';
  return 'visa';
}

export const LUXURY_CARD_PRESETS = [
  { name: 'Obsidian Black', color: '#18181B', border: '#3F3F46', desc: 'Dark Titanium Metal' },
  { name: 'Midnight Sapphire', color: '#1E3A8A', border: '#3B82F6', desc: 'Imperial Blue' },
  { name: 'Emerald Royale', color: '#064E3B', border: '#10B981', desc: 'Prestige Jade' },
  { name: 'Rose Gold Velvet', color: '#831843', border: '#F43F5E', desc: 'Blush Velvet' },
  { name: 'Imperial Brass', color: '#78350F', border: '#F59E0B', desc: 'Executive Gold' },
  { name: 'Amethyst Luxe', color: '#4C1D95', border: '#8B5CF6', desc: 'Royal Violet' },
  { name: 'Cyber Titanium', color: '#0F172A', border: '#06B6D4', desc: 'Carbon Steel' },
  { name: 'Crimson Ruby', color: '#991B1B', border: '#EF4444', desc: 'High Net Ruby' },
];

export const CreditCardVisual: React.FC<CreditCardVisualProps> = ({
  card,
  cardholderName = 'VALUED CARDMEMBER',
  showFlipButton = true,
  className = '',
  size = 'md',
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [copied, setCopied] = useState(false);
  const [peekNumber, setPeekNumber] = useState(false);

  const isSm = size === 'sm';
  const network = detectCardNetwork(card);
  const isDarkMetal = !card.color || card.color.toLowerCase() === '#18181b' || card.color.toLowerCase() === '#000000';

  const handleCopyNumber = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`•••• •••• •••• ${card.last4}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Compute mock expiry date from statement day (stable display)
  const expMonth = String((card.statementDay % 12) + 1).padStart(2, '0');
  const expYear = String((new Date().getFullYear() + 4) % 100).padStart(2, '0');

  // Intelligent title formatting: avoid duplicated "ICICI \n ICICI"
  const normIssuer = (card.issuer || 'FINVAULT BANK').trim();
  const normNick = (card.nickname || '').trim();
  const isDuplicate =
    !normNick ||
    normNick.toLowerCase() === normIssuer.toLowerCase() ||
    normNick.toLowerCase() === `${normIssuer.toLowerCase()} bank`;

  const topBankLabel = normIssuer.toUpperCase();
  const cardProductTitle = isDuplicate
    ? `${network.toUpperCase()} PRESTIGE`
    : normNick.toUpperCase();

  const cardTier =
    card.creditLimit >= 500000 ? 'INFINITE' : card.creditLimit >= 200000 ? 'SIGNATURE' : 'PLATINUM';

  return (
    <div className={`relative flex flex-col items-center w-full ${className}`}>
      {/* 3D Card Container */}
      <div
        className={`w-full aspect-[1.586/1] cursor-pointer select-none [perspective:1200px] ${
          isSm ? 'max-w-[310px]' : 'max-w-[370px]'
        }`}
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <div
          className={`relative h-full w-full rounded-2xl transition-all duration-700 [transform-style:preserve-3d] shadow-2xl ${
            isFlipped ? '[transform:rotateY(180deg)]' : ''
          }`}
          style={{
            boxShadow: '0 20px 35px -10px rgba(0, 0, 0, 0.5), 0 8px 12px -5px rgba(0, 0, 0, 0.3)',
          }}
        >
          {/* ======================================================== */}
          {/* FRONT OF CARD */}
          {/* ======================================================== */}
          <div
            className={`absolute inset-0 h-full w-full rounded-2xl flex flex-col justify-between text-white overflow-hidden [backface-visibility:hidden] border border-white/20 transition-all ${
              isSm ? 'p-3.5' : 'p-4 sm:p-5'
            } ${card.isClosed ? 'grayscale-[0.6] opacity-85' : ''}`}
            style={{
              backgroundColor: card.color || '#18181B',
              backgroundImage: `
                radial-gradient(circle at 10% 20%, rgba(255, 255, 255, 0.18) 0%, transparent 40%),
                radial-gradient(circle at 90% 80%, rgba(0, 0, 0, 0.5) 0%, transparent 60%),
                linear-gradient(135deg, ${card.color || '#18181B'} 0%, rgba(10, 10, 20, 0.96) 100%)
              `,
            }}
          >
            {/* Holographic Specular Ribbon */}
            <div
              className="absolute -inset-full opacity-20 pointer-events-none rotate-25 bg-gradient-to-r from-transparent via-white to-transparent"
              style={{
                filter: 'blur(30px)',
              }}
            />

            {/* Subtle Security Guilloche Pattern lines */}
            <svg
              className="absolute inset-0 h-full w-full opacity-10 pointer-events-none mix-blend-overlay"
              xmlns="http://www.w3.org/2000/svg"
              width="100%"
              height="100%"
            >
              <defs>
                <pattern id={`pattern-${card.id || 'card'}`} width="30" height="30" patternUnits="userSpaceOnUse">
                  <circle cx="15" cy="15" r="14" fill="none" stroke="currentColor" strokeWidth="0.75" />
                  <path d="M0 15h30M15 0v30" stroke="currentColor" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill={`url(#pattern-${card.id || 'card'})`} />
            </svg>

            {/* Top Row: Bank Issuer & Card Product + Contactless / Closed Status */}
            <div className="relative z-10 flex items-start justify-between leading-tight">
              <div>
                <span
                  className={`font-bold tracking-widest uppercase text-white/70 drop-shadow-sm font-sans block ${
                    isSm ? 'text-[8.5px]' : 'text-[9.5px] sm:text-[10px]'
                  }`}
                >
                  {topBankLabel}
                </span>
                <h3
                  className={`font-extrabold tracking-wide text-white drop-shadow-md truncate max-w-[170px] sm:max-w-[210px] ${
                    isSm ? 'text-xs' : 'text-sm sm:text-base'
                  }`}
                >
                  {cardProductTitle}
                </h3>
              </div>

              <div className="flex items-center gap-1.5">
                {card.isClosed && (
                  <span className="rounded-md bg-rose-600/90 backdrop-blur-xs px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-white shadow-xs border border-white/30">
                    CLOSED
                  </span>
                )}
                {/* Contactless Waves */}
                <div
                  className="p-1 rounded-full bg-white/10 backdrop-blur-xs text-white/90"
                  title="Contactless Enabled"
                >
                  <Wifi className={`${isSm ? 'h-3.5 w-3.5' : 'h-4 w-4'} rotate-90`} />
                </div>
              </div>
            </div>

            {/* Middle Row: EMV Microchip & Card Tier */}
            <div className="relative z-10 flex items-center justify-between my-auto py-0.5">
              <EmvChip variant={isDarkMetal ? 'silver' : 'gold'} size={isSm ? 'sm' : 'md'} />

              {/* Card Tier Watermark */}
              <div className="text-right leading-none">
                <span
                  className={`font-mono tracking-widest uppercase text-white/60 block ${
                    isSm ? 'text-[7px]' : 'text-[8px]'
                  }`}
                >
                  TIER
                </span>
                <span
                  className={`font-black tracking-widest uppercase text-amber-300 drop-shadow-xs ${
                    isSm ? 'text-[9px]' : 'text-[10px] sm:text-[11px]'
                  }`}
                >
                  {cardTier}
                </span>
              </div>
            </div>

            {/* Bottom Section: Card Number, Cardholder, Expiry, and Network Logo */}
            <div className="relative z-10 flex flex-col gap-1.5">
              {/* Card Number (Pure, Embossed, NEVER wraps) */}
              <div className="flex items-center justify-between">
                <span
                  className={`font-mono text-white font-bold whitespace-nowrap drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] select-none ${
                    isSm
                      ? 'text-[13px] tracking-[0.15em]'
                      : 'text-sm sm:text-base tracking-[0.18em] sm:tracking-[0.22em]'
                  }`}
                  style={{
                    textShadow: '0 2px 4px rgba(0,0,0,0.9), 0 0 2px rgba(255,255,255,0.4)',
                  }}
                >
                  {peekNumber ? `4532 •••• •••• ${card.last4}` : `••••  ••••  ••••  ${card.last4}`}
                </span>
              </div>

              {/* Cardholder, Expiry & Network Brand */}
              <div className="flex items-end justify-between pt-1 border-t border-white/15 leading-none">
                <div className="flex flex-col">
                  <span
                    className={`font-mono tracking-widest text-white/60 uppercase mb-0.5 ${
                      isSm ? 'text-[6.5px]' : 'text-[7.5px]'
                    }`}
                  >
                    CARDHOLDER
                  </span>
                  <span
                    className={`font-mono font-bold tracking-wider text-white uppercase drop-shadow-sm truncate ${
                      isSm
                        ? 'text-[10px] max-w-[130px]'
                        : 'text-[11px] sm:text-xs max-w-[160px] sm:max-w-[200px]'
                    }`}
                  >
                    {cardholderName}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex flex-col text-right">
                    <span
                      className={`font-mono tracking-wider text-white/60 uppercase mb-0.5 ${
                        isSm ? 'text-[6px]' : 'text-[7px]'
                      }`}
                    >
                      VALID THRU
                    </span>
                    <span
                      className={`font-mono font-bold text-white tracking-widest drop-shadow-sm ${
                        isSm ? 'text-[10px]' : 'text-[11px] sm:text-xs'
                      }`}
                    >
                      {expMonth}/{expYear}
                    </span>
                  </div>

                  {/* Payment Network Emblem */}
                  <NetworkLogo network={network} className={isSm ? 'h-4.5 sm:h-5' : 'h-5.5 sm:h-6.5'} />
                </div>
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* BACK OF CARD (Rotated 180deg) */}
          {/* ======================================================== */}
          <div
            className={`absolute inset-0 h-full w-full rounded-2xl flex flex-col justify-between text-white overflow-hidden [transform:rotateY(180deg)] [backface-visibility:hidden] border border-white/20 shadow-2xl ${
              card.isClosed ? 'grayscale-[0.6] opacity-85' : ''
            }`}
            style={{
              backgroundColor: card.color || '#18181B',
              backgroundImage: `
                radial-gradient(circle at 80% 20%, rgba(255, 255, 255, 0.12) 0%, transparent 40%),
                linear-gradient(135deg, ${card.color || '#18181B'} 0%, #09090b 100%)
              `,
            }}
          >
            {/* Magnetic Stripe */}
            <div
              className={`w-full bg-neutral-950 border-y border-black/40 shadow-inner relative ${
                isSm ? 'h-8 mt-2.5' : 'h-9 sm:h-11 mt-3 sm:mt-4'
              }`}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
            </div>

            {/* Middle Section: Signature Strip & CVV Box */}
            <div className={`flex flex-col gap-1.5 ${isSm ? 'px-3.5 py-1' : 'px-5 py-2'}`}>
              <div className="flex items-center gap-2.5">
                {/* Signature Panel */}
                <div
                  className={`flex-1 bg-neutral-100 rounded flex items-center justify-between px-2 text-neutral-800 shadow-inner overflow-hidden border border-neutral-300 ${
                    isSm ? 'h-6 sm:h-7' : 'h-7 sm:h-8'
                  }`}
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0, 0, 0, 0.05) 4px, rgba(0, 0, 0, 0.05) 8px)',
                  }}
                >
                  <span className="font-serif italic text-[10px] text-neutral-600 select-none">
                    Signature
                  </span>
                  <span className="text-[7.5px] font-mono text-neutral-400 hidden sm:inline">
                    NOT VALID UNLESS SIGNED
                  </span>
                </div>

                {/* CVV Box */}
                <div className="bg-white rounded px-2.5 py-1 border border-neutral-300 shadow-inner text-center">
                  <span className="text-[6.5px] font-mono block text-neutral-400 uppercase tracking-wider leading-none">
                    CVV
                  </span>
                  <span className="font-mono font-bold text-xs text-neutral-900 tracking-wider">
                    842
                  </span>
                </div>
              </div>

              {/* Hologram Foil Sticker */}
              <div className="flex items-center justify-between pt-0.5">
                <div
                  className={`rounded border border-white/30 flex items-center justify-center font-bold tracking-tighter ${
                    isSm ? 'h-5 w-7 text-[7px]' : 'h-6 w-8 text-[7.5px]'
                  }`}
                  style={{
                    background:
                      'linear-gradient(135deg, #fbcfe8 0%, #c7d2fe 25%, #fed7aa 50%, #bbf7d0 75%, #fef08a 100%)',
                    color: '#1e1b4b',
                    boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.8), 0 1px 3px rgba(0,0,0,0.3)',
                  }}
                >
                  <span>SECURE</span>
                </div>

                <div className="flex flex-col text-right font-mono text-[8px] sm:text-[9px] text-white/70 leading-tight">
                  <span>Statement: <strong>{card.statementDay}th</strong></span>
                  <span>Payment Due: <strong>{card.paymentDueDay}th</strong></span>
                </div>
              </div>
            </div>

            {/* Bottom Disclaimers & Customer Care */}
            <div
              className={`border-t border-white/10 flex items-center justify-between text-white/50 leading-tight ${
                isSm ? 'px-3.5 pb-2.5 pt-1 text-[7px]' : 'px-5 pb-3.5 pt-1 text-[8px]'
              }`}
            >
              <p className="max-w-[220px] truncate">
                Issued by {card.issuer || 'FinVault Bank'}. 24/7 Support: 1800-FIN-VAULT.
              </p>
              <NetworkLogo network={network} className={isSm ? 'h-3.5' : 'h-4 sm:h-5 opacity-70'} />
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Helper Text & Action Controls */}
      {showFlipButton && (
        <div
          className={`mt-2.5 flex items-center justify-between w-full px-1 text-xs ${
            isSm ? 'max-w-[310px]' : 'max-w-[370px]'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsFlipped(!isFlipped)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 shadow-xs transition-colors font-medium cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5 text-indigo-500" />
              <span>{isFlipped ? 'Show Front' : 'Flip to Back'}</span>
            </button>
            <span className="text-[11px] text-neutral-400 hidden sm:inline">
              (Tap card to rotate)
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPeekNumber(!peekNumber)}
              title={peekNumber ? 'Hide mock number' : 'Peek full format'}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 text-xs shadow-xs transition-colors cursor-pointer"
            >
              {peekNumber ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              <span className="text-[11px]">{peekNumber ? 'Mask' : 'Peek'}</span>
            </button>
            <button
              type="button"
              onClick={handleCopyNumber}
              title="Copy card number"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 text-xs shadow-xs transition-colors cursor-pointer"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              <span className="text-[11px]">{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const MiniCreditCard: React.FC<{
  card: CreditCard;
  isActive?: boolean;
  onClick?: () => void;
}> = ({ card, isActive = false, onClick }) => {
  const network = detectCardNetwork(card);
  const normIssuer = (card.issuer || 'BANK').trim();
  const normNick = (card.nickname || '').trim();
  const displayName =
    normNick && normNick.toLowerCase() !== normIssuer.toLowerCase()
      ? normNick
      : normIssuer;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex flex-col justify-between shrink-0 w-48 sm:w-52 h-28 sm:h-30 rounded-xl p-3 text-white transition-all overflow-hidden text-left border cursor-pointer select-none ${
        isActive
          ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-neutral-950 shadow-lg shadow-indigo-500/20 border-white/50 opacity-100'
          : 'opacity-70 hover:opacity-100 hover:border-white/30 border-white/15'
      } ${card.isClosed ? 'grayscale-[0.6]' : ''}`}
      style={{
        backgroundColor: card.color || '#18181B',
        backgroundImage: `
          radial-gradient(circle at 10% 20%, rgba(255, 255, 255, 0.18) 0%, transparent 40%),
          linear-gradient(135deg, ${card.color || '#18181B'} 0%, rgba(10, 10, 20, 0.96) 100%)
        `,
      }}
    >
      {/* Top: Bank & Network */}
      <div className="flex items-center justify-between z-10 w-full">
        <span className="text-[9.5px] font-bold tracking-widest uppercase text-white/80 truncate max-w-[100px] drop-shadow-xs">
          {normIssuer}
        </span>
        <NetworkLogo network={network} className="h-4 sm:h-5" />
      </div>

      {/* Middle: Mini Gold Chip & Card Name */}
      <div className="flex items-center gap-2 z-10 my-auto">
        <div className="h-4 w-6 rounded bg-gradient-to-br from-[#FFEBA0] via-[#D4AF37] to-[#8C6D1F] border border-amber-300/80 shadow-xs flex items-center justify-center shrink-0">
          <div className="w-2.5 h-1.5 border border-black/35 rounded-xs" />
        </div>
        <span className="text-xs font-extrabold text-white truncate max-w-[125px] drop-shadow-xs">
          {displayName}
        </span>
      </div>

      {/* Bottom: Last 4 & Status */}
      <div className="flex items-center justify-between font-mono text-[10px] text-white/90 z-10 w-full pt-1 border-t border-white/10">
        <span className="tracking-widest font-bold">•••• {card.last4}</span>
        {card.isClosed ? (
          <span className="px-1.5 py-0.5 rounded bg-rose-600/90 text-[8px] font-black uppercase tracking-wider text-white">
            Closed
          </span>
        ) : (
          <span className="text-[9px] text-white/70">
            Due {card.paymentDueDay}th
          </span>
        )}
      </div>

      {/* Gloss overlay */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/15 via-transparent to-transparent pointer-events-none" />
    </button>
  );
};
