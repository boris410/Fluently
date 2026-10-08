"use client";

import { useCallback, useState, type ReactNode } from "react";

type VoiceJSON = {
  id: string;
  voiceId: string;
  label: string;
  isFree: boolean;
};

type CharacterJSON = {
  id: string;
  name: string;
  elevenlabsVoiceId: string;
};

async function readApiError(res: Response): Promise<string> {
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? `請求失敗（${res.status}）`;
}

export function VoiceCatalog({
  initialVoices,
  initialCharacters,
}: {
  initialVoices: VoiceJSON[];
  initialCharacters: CharacterJSON[];
}) {
  const [voices, setVoices] = useState(initialVoices);
  const [characters, setCharacters] = useState(initialCharacters);

  const refresh = useCallback(async () => {
    const [voicesRes, charactersRes] = await Promise.all([
      fetch("/api/voices"),
      fetch("/api/characters"),
    ]);

    if (!voicesRes.ok) throw new Error(await readApiError(voicesRes));
    if (!charactersRes.ok) throw new Error(await readApiError(charactersRes));

    const voicesData = (await voicesRes.json()) as { voices?: VoiceJSON[] };
    const charactersData = (await charactersRes.json()) as {
      characters?: CharacterJSON[];
    };
    setVoices(voicesData.voices ?? []);
    setCharacters(charactersData.characters ?? []);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      {voices.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong bg-surface-2 px-6 py-14 text-center">
          <p className="text-[15px] text-ink-soft">還沒有任何音色。</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {voices.map((voice) => (
            <VoiceCard
              key={`${voice.id}:${voice.voiceId}:${voice.label}:${voice.isFree ? 1 : 0}`}
              voice={voice}
              onMutated={refresh}
            />
          ))}
        </div>
      )}

      <CreateVoiceForm onCreated={refresh} />

      <CharactersCard
        characters={characters}
        voices={voices}
        onMutated={refresh}
      />
    </div>
  );
}

function VoiceCard({
  voice,
  onMutated,
}: {
  voice: VoiceJSON;
  onMutated: () => Promise<void>;
}) {
  const [voiceId, setVoiceId] = useState(voice.voiceId);
  const [label, setLabel] = useState(voice.label);
  const [isFree, setIsFree] = useState(voice.isFree);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/voices/${encodeURIComponent(voice.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voiceId: voiceId.trim(),
          label: label.trim(),
          isFree,
        }),
      });
      if (!res.ok) throw new Error(await readApiError(res));
      await onMutated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新失敗");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/voices/${encodeURIComponent(voice.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await readApiError(res));
      await onMutated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "刪除失敗");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-mono text-[13px] text-ink">{voice.id}</p>
        {voice.isFree && (
          <span className="rounded-md bg-surface-2 px-2 py-1 text-[12px] text-ink-muted">
            免費
          </span>
        )}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="ElevenLabs 音色代號">
          <input
            value={voiceId}
            onChange={(e) => setVoiceId(e.target.value)}
            spellCheck={false}
            className={monoInputClass}
          />
        </Field>
        <Field label="名稱">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      <FreeCheckbox checked={isFree} onChange={setIsFree} />

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || deleting}
          className="inline-flex h-13 items-center rounded-full bg-clay px-7 text-[16px] font-medium text-on-clay shadow-[var(--shadow)] transition-colors hover:bg-clay-deep disabled:opacity-40"
        >
          {saving ? "儲存中…" : "儲存"}
        </button>
        <button
          type="button"
          onClick={() => void remove()}
          disabled={saving || deleting}
          className="rounded-full border border-line-strong px-4 py-2 font-medium text-ink transition-colors hover:border-clay hover:text-clay disabled:opacity-40"
        >
          {deleting ? "刪除中…" : "刪除"}
        </button>
      </div>

      {error && <ErrorWell message={error} className="mt-5" />}
    </div>
  );
}

function CreateVoiceForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const [id, setId] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [label, setLabel] = useState("");
  const [isFree, setIsFree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const create = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/voices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: id.trim(),
          voiceId: voiceId.trim(),
          label: label.trim(),
          isFree,
        }),
      });
      if (!res.ok) throw new Error(await readApiError(res));
      setId("");
      setVoiceId("");
      setLabel("");
      setIsFree(false);
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "新增失敗");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="rounded-2xl border border-line bg-surface p-5"
      onSubmit={(e) => {
        e.preventDefault();
        void create();
      }}
    >
      <h2 className="font-display text-[18px] leading-snug">新增音色</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="內部代號">
          <input
            value={id}
            onChange={(e) => setId(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            className={monoInputClass}
          />
        </Field>
        <Field label="ElevenLabs 音色代號">
          <input
            value={voiceId}
            onChange={(e) => setVoiceId(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            className={monoInputClass}
          />
        </Field>
        <Field label="名稱">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>
      <FreeCheckbox checked={isFree} onChange={setIsFree} />
      <div className="mt-5">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-13 items-center rounded-full bg-clay px-7 text-[16px] font-medium text-on-clay shadow-[var(--shadow)] transition-colors hover:bg-clay-deep disabled:opacity-40"
        >
          {saving ? "新增中…" : "新增"}
        </button>
      </div>
      {error && <ErrorWell message={error} className="mt-5" />}
    </form>
  );
}

function CharactersCard({
  characters,
  voices,
  onMutated,
}: {
  characters: CharacterJSON[];
  voices: VoiceJSON[];
  onMutated: () => Promise<void>;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="font-display text-[18px] leading-snug">人物</h2>
      {characters.length > 0 && (
        <ul className="mt-4 flex flex-col gap-5">
          {characters.map((character) => (
            <li key={character.id}>
              <CharacterRow
                key={`${character.id}:${character.elevenlabsVoiceId}`}
                character={character}
                voices={voices}
                onMutated={onMutated}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CharacterRow({
  character,
  voices,
  onMutated,
}: {
  character: CharacterJSON;
  voices: VoiceJSON[];
  onMutated: () => Promise<void>;
}) {
  const assigned = voices.some((v) => v.id === character.elevenlabsVoiceId)
    ? character.elevenlabsVoiceId
    : (voices[0]?.id ?? character.elevenlabsVoiceId);
  const [draft, setDraft] = useState<string | null>(null);
  const voiceId = draft ?? assigned;
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/characters/${encodeURIComponent(character.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ elevenlabsVoiceId: voiceId }),
        },
      );
      if (!res.ok) throw new Error(await readApiError(res));
      await onMutated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新失敗");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <p className="text-[15px] text-ink">{character.name}</p>
      <p className="mt-0.5 font-mono text-[12px] text-ink-muted">
        {character.id}
      </p>
      {voices.length > 0 ? (
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <select
            value={voiceId}
            onChange={(e) => setDraft(e.target.value)}
            aria-label={`${character.name} 的音色`}
            className="w-full min-w-0 rounded-xl border border-line bg-canvas px-3 py-2.5 text-[14px] text-ink focus:border-line-strong focus:outline-none sm:flex-1"
          >
            {voices.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}（{v.id}）
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex h-13 shrink-0 items-center rounded-full bg-clay px-7 text-[16px] font-medium text-on-clay shadow-[var(--shadow)] transition-colors hover:bg-clay-deep disabled:opacity-40"
          >
            {saving ? "儲存中…" : "儲存"}
          </button>
        </div>
      ) : null}
      {error && <ErrorWell message={error} className="mt-3" />}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[13px] text-ink-muted">{label}</span>
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

function FreeCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="mt-4 flex items-center gap-2 text-[14px] text-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-clay"
      />
      免費
    </label>
  );
}

function ErrorWell({
  message,
  className = "",
}: {
  message: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-line bg-surface-2 px-4 py-3 text-[14px] leading-6 text-ink-soft ${className}`}
    >
      {message}
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-[14px] text-ink placeholder:text-ink-muted focus:border-line-strong focus:outline-none";

const monoInputClass =
  "w-full rounded-xl border border-line bg-canvas px-3 py-2.5 font-mono text-[13px] text-ink placeholder:text-ink-muted focus:border-line-strong focus:outline-none";
