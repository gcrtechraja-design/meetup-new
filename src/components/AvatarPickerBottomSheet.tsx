import React, { useState, useEffect } from 'react';
import { 
  X, 
  Upload, 
  Sparkles, 
  Check, 
  ArrowLeft, 
  Loader2, 
  User, 
  Search,
  CheckCircle2
} from 'lucide-react';

interface AvatarPickerBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentAvatarUrl?: string;
  onUploadFromDevice: () => void;
  onSaveAvatar: (avatarUrl: string) => Promise<void>;
  initialView?: 'menu' | 'avatars';
}

const TOTAL_AVATARS = 100;
const AVATAR_SEEDS = Array.from({ length: TOTAL_AVATARS }, (_, i) => i + 1);

export const getDicebearAvatarUrl = (seed: number | string): string => {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
};

export const AvatarPickerBottomSheet: React.FC<AvatarPickerBottomSheetProps> = ({
  isOpen,
  onClose,
  currentAvatarUrl,
  onUploadFromDevice,
  onSaveAvatar,
  initialView = 'menu',
}) => {
  const [viewMode, setViewMode] = useState<'menu' | 'avatars'>(initialView);
  const [selectedSeed, setSelectedSeed] = useState<number>(1);
  const [selectedUrl, setSelectedUrl] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [filterSeedRange, setFilterSeedRange] = useState<'all' | '1-25' | '26-50' | '51-75' | '76-100'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Extract initial seed from current avatar if applicable
  useEffect(() => {
    if (isOpen) {
      setViewMode(initialView);
      if (currentAvatarUrl && currentAvatarUrl.includes('avataaars/svg?seed=')) {
        const match = currentAvatarUrl.match(/seed=([0-9]+)/);
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (num >= 1 && num <= TOTAL_AVATARS) {
            setSelectedSeed(num);
            setSelectedUrl(getDicebearAvatarUrl(num));
            return;
          }
        }
      }
      // default selection
      setSelectedSeed(1);
      setSelectedUrl(getDicebearAvatarUrl(1));
    }
  }, [isOpen, initialView, currentAvatarUrl]);

  if (!isOpen) return null;

  const handleSelectAvatar = (seed: number) => {
    setSelectedSeed(seed);
    setSelectedUrl(getDicebearAvatarUrl(seed));
  };

  const handleConfirmSave = async () => {
    if (!selectedUrl) return;
    setSaving(true);
    try {
      await onSaveAvatar(selectedUrl);
      onClose();
    } catch (err) {
      console.error('Failed to save avatar:', err);
    } finally {
      setSaving(false);
    }
  };

  // Filter seeds based on active filter and search query
  const filteredSeeds = AVATAR_SEEDS.filter((seed) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return `avatar ${seed}`.includes(q) || `${seed}` === q;
    }
    if (filterSeedRange === '1-25') return seed >= 1 && seed <= 25;
    if (filterSeedRange === '26-50') return seed >= 26 && seed <= 50;
    if (filterSeedRange === '51-75') return seed >= 51 && seed <= 75;
    if (filterSeedRange === '76-100') return seed >= 76 && seed <= 100;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-0 sm:p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={saving ? undefined : onClose}
      />

      {/* Bottom Sheet Modal Container */}
      <div className="relative w-full max-w-lg bg-[#141419] border border-[#23232C] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] z-10 overflow-hidden animate-in slide-in-from-bottom-6 duration-200">
        {/* Drag Handle Bar for Mobile */}
        <div className="w-12 h-1.5 bg-zinc-700/60 rounded-full mx-auto mt-3 mb-1 shrink-0 sm:hidden" />

        {/* View: Menu View (Choose upload or avatars) */}
        {viewMode === 'menu' && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between pb-2 border-b border-[#23232C]">
              <div>
                <h3 className="text-lg font-black text-white">Change Profile Picture</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Upload a photo or pick a fun avatar</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Avatar Mini Preview */}
            {currentAvatarUrl && (
              <div className="flex items-center gap-3 p-3 bg-[#0B0B0E] rounded-2xl border border-zinc-800/80">
                <img
                  src={currentAvatarUrl}
                  alt="Current Avatar"
                  className="w-12 h-12 rounded-full object-cover border border-[#FF69B4]"
                />
                <div className="flex-1">
                  <span className="text-xs font-semibold text-white block">Current Picture</span>
                  <span className="text-[11px] text-zinc-400 block">Tap below to replace with a new photo or avatar</span>
                </div>
              </div>
            )}

            {/* 2 Main Action Cards */}
            <div className="grid grid-cols-1 gap-3">
              {/* Option 1: Upload from device */}
              <button
                onClick={() => {
                  onUploadFromDevice();
                  onClose();
                }}
                className="w-full p-4 rounded-2xl bg-[#1A1A22] border border-[#2E2E3A] hover:border-[#FF69B4]/60 hover:bg-[#20202B] transition flex items-center gap-4 text-left group active:scale-[0.99]"
              >
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#FF69B4] to-pink-600 flex items-center justify-center text-white shadow-[0_0_15px_rgba(255,105,180,0.3)] shrink-0 group-hover:scale-105 transition-transform">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white group-hover:text-[#FF69B4] transition">
                      Upload from device
                    </span>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/20">
                      Photo
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">
                    Choose an image from your gallery, camera, or files (JPG, PNG)
                  </p>
                </div>
              </button>

              {/* Option 2: Choose Avatar */}
              <button
                onClick={() => setViewMode('avatars')}
                className="w-full p-4 rounded-2xl bg-[#1A1A22] border border-[#2E2E3A] hover:border-purple-500/60 hover:bg-[#20202B] transition flex items-center gap-4 text-left group active:scale-[0.99]"
              >
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-[0_0_15px_rgba(168,85,247,0.3)] shrink-0 group-hover:scale-105 transition-transform">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white group-hover:text-purple-400 transition">
                      Choose Avatar
                    </span>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      100 Avatars
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">
                    Select from 100 expressive, colorful stylized cartoon avatars
                  </p>
                </div>
              </button>
            </div>

            <div className="pt-2">
              <button
                onClick={onClose}
                className="w-full py-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-semibold transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* View: Avatar Grid View (100 Avatars) */}
        {viewMode === 'avatars' && (
          <div className="flex flex-col h-full max-h-[88vh]">
            {/* Header */}
            <div className="p-4 px-5 border-b border-[#23232C] flex items-center justify-between shrink-0 bg-[#141419]">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode('menu')}
                  className="p-1.5 -ml-1 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                  title="Back to options"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    Choose Avatar
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#FF69B4]/20 text-[#FF69B4] border border-[#FF69B4]/30">
                      100 Styles
                    </span>
                  </h3>
                  <p className="text-[11px] text-zinc-400">Select any avatar and tap Save</p>
                </div>
              </div>
              <button
                onClick={onClose}
                disabled={saving}
                className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selected Avatar Preview Bar */}
            <div className="p-3.5 px-5 bg-[#0B0B0E] border-b border-zinc-800/80 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img
                    src={selectedUrl || getDicebearAvatarUrl(selectedSeed)}
                    alt={`Avatar #${selectedSeed}`}
                    className="w-14 h-14 rounded-full bg-zinc-800 p-0.5 border-2 border-[#FF69B4] shadow-[0_0_16px_rgba(255,105,180,0.5)] object-cover"
                  />
                  <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#FF69B4] text-white flex items-center justify-center text-[10px] font-bold shadow">
                    <Check className="w-3 h-3" />
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-white">Avatar #{selectedSeed}</span>
                    <span className="text-[10px] text-zinc-400">selected</span>
                  </div>
                  <span className="text-[11px] text-[#FF69B4] font-medium">Ready to set as profile picture</span>
                </div>
              </div>

              <button
                onClick={handleConfirmSave}
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#FF69B4] to-pink-600 hover:brightness-110 active:scale-95 text-white text-xs font-bold shadow-[0_0_15px_rgba(255,105,180,0.4)] transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Save Avatar</span>
                  </>
                )}
              </button>
            </div>

            {/* Filter Tabs / Quick Range Selector */}
            <div className="p-2.5 px-4 bg-[#141419] border-b border-zinc-800/60 flex items-center gap-1.5 overflow-x-auto shrink-0 scrollbar-none">
              {(
                [
                  { id: 'all', label: 'All 100' },
                  { id: '1-25', label: '1 - 25' },
                  { id: '26-50', label: '26 - 50' },
                  { id: '51-75', label: '51 - 75' },
                  { id: '76-100', label: '76 - 100' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setFilterSeedRange(tab.id);
                    setSearchQuery('');
                  }}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                    filterSeedRange === tab.id && !searchQuery
                      ? 'bg-[#FF69B4] text-white shadow-sm'
                      : 'bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 100 Avatars Grid */}
            <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-zinc-700">
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                {filteredSeeds.map((seed) => {
                  const url = getDicebearAvatarUrl(seed);
                  const isSelected = selectedSeed === seed;

                  return (
                    <button
                      key={seed}
                      type="button"
                      onClick={() => handleSelectAvatar(seed)}
                      className={`relative aspect-square rounded-2xl p-1.5 transition-all flex flex-col items-center justify-center group ${
                        isSelected
                          ? 'bg-[#FF69B4]/15 border-2 border-[#FF69B4] ring-2 ring-[#FF69B4]/40 shadow-[0_0_16px_rgba(255,105,180,0.35)] scale-98'
                          : 'bg-[#1A1A22] border border-zinc-800/90 hover:border-zinc-600 hover:bg-[#20202B]'
                      }`}
                    >
                      <img
                        src={url}
                        alt={`Avatar ${seed}`}
                        loading="lazy"
                        className="w-full h-full object-contain rounded-xl transition-transform group-hover:scale-105"
                      />

                      {/* Number Tag */}
                      <span className={`absolute bottom-1 right-1 text-[9px] font-bold px-1 rounded ${
                        isSelected ? 'bg-[#FF69B4] text-white' : 'bg-black/60 text-zinc-400'
                      }`}>
                        #{seed}
                      </span>

                      {/* Selected checkmark */}
                      {isSelected && (
                        <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#FF69B4] text-white flex items-center justify-center shadow">
                          <Check className="w-2.5 h-2.5" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {filteredSeeds.length === 0 && (
                <div className="py-12 text-center text-zinc-500 text-xs">
                  No avatars found.
                </div>
              )}
            </div>

            {/* Bottom Footer Action */}
            <div className="p-3.5 px-5 bg-[#141419] border-t border-[#23232C] flex items-center justify-between shrink-0">
              <span className="text-xs text-zinc-400">
                Selected: <strong className="text-white">Avatar #{selectedSeed}</strong>
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode('menu')}
                  disabled={saving}
                  className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition"
                >
                  Back
                </button>
                <button
                  onClick={handleConfirmSave}
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#FF69B4] to-pink-600 hover:brightness-110 active:scale-95 text-white text-xs font-bold shadow-[0_0_15px_rgba(255,105,180,0.4)] transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Set as Avatar</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
