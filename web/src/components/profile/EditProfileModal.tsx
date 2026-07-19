'use client';

import React, { useState, useRef } from 'react';
import Image from 'next/image';
import { authFetch } from '@/lib/wallet';

interface EditProfileModalProps {
  open: boolean;
  onClose: () => void;
  publicKey: string;
  currentUsername: string;
  currentAvatarSrc: string;
  /** Called after a successful save with the new values, so the parent
   *  (Profile) can update what it renders without a full refetch. */
  onSaved: (next: { username: string; avatarSrc: string }) => void;
}

function CameraIcon({ className = '' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
      <circle cx="12" cy="13" r="4"></circle>
    </svg>
  );
}

function Spinner({ className = '' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

const MAX_USERNAME_LENGTH = 24;

export default function EditProfileModal({ open, onClose, publicKey, currentUsername, currentAvatarSrc, onSaved }: EditProfileModalProps) {
  const [username, setUsername] = useState(currentUsername);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const trimmed = username.trim();
  const isValid = trimmed.length >= 3 && trimmed.length <= MAX_USERNAME_LENGTH;
  const dirty = trimmed !== currentUsername || !!avatarFile;

  const handlePickFile = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB.');
      return;
    }
    setError('');
    setAvatarFile(file);

    // There's no image-upload endpoint yet — avatarUrl in the DB is just a
    // string column. As a stopgap we inline the image as a base64 data URL
    // and send that directly. This works but bloats the users table; swap
    // this for a real upload (S3/Cloudinary/etc. returning a hosted URL)
    // once one exists, and send that URL here instead.
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!isValid || saving) return;
    setSaving(true);
    setError('');

    try {
      const res = await authFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pubkey: publicKey,
          ...(trimmed !== currentUsername && { username: trimmed }),
          ...(avatarPreview && { avatarUrl: avatarPreview }),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? 'Failed to update profile');
      }

      onSaved({
        username: data.username ?? trimmed,
        avatarSrc: data.avatarUrl ?? currentAvatarSrc,
      });
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div className="w-full max-w-sm bg-white rounded-3xl p-6 space-y-5 shadow-xl">
        <h3 className="text-base font-semibold text-slate-800">Edit Profile</h3>

        {/* Avatar */}
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={handlePickFile}
            className="relative w-20 h-20 rounded-full overflow-hidden border-4 border-white shadow-md shadow-orange-900/10 bg-linear-to-b from-orange-50 to-orange-100 cursor-pointer group"
          >
            <Image
              src={avatarPreview || currentAvatarSrc}
              alt="Avatar preview"
              fill
              sizes="80px"
              className="object-contain p-2"
            />
            <span className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
              <CameraIcon className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </span>
          </button>
          <button type="button" onClick={handlePickFile} className="text-[11px] font-medium text-[#FF5E00] cursor-pointer">
            Change photo
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* Username */}
        <div className="space-y-1.5">
          <label htmlFor="edit-username" className="block text-[10px] uppercase tracking-wider text-slate-400 font-light">
            Username
          </label>
          <input
            id="edit-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={MAX_USERNAME_LENGTH}
            disabled={saving}
            placeholder="Your display name"
            className="w-full rounded-xl bg-slate-50 border border-slate-100 px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-[#A0F0F0] disabled:opacity-50 transition-colors"
          />
          <p className="text-[10px] text-slate-300 text-right">{trimmed.length}/{MAX_USERNAME_LENGTH}</p>
        </div>

        {error && (
          <div className="rounded-xl bg-rose-50 border border-rose-100 px-3 py-2.5">
            <p className="text-xs font-medium text-rose-600 leading-normal">{error}</p>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={!isValid || !dirty || saving}
            className="flex-1 py-2.5 rounded-xl bg-[#FF5E00] text-white text-[11px] font-semibold uppercase tracking-wider disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer"
          >
            {saving && <Spinner className="animate-spin h-3 w-3 text-white" />}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-2.5 text-[11px] uppercase tracking-wide text-slate-400 disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
