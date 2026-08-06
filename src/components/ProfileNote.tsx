"use client";

import { FormEvent, useState } from "react";

export function ProfileNote({
  bakedUsername,
  displayName,
}: {
  bakedUsername: string;
  displayName: string;
}) {
  const [input, setInput] = useState("");
  const [note, setNote] = useState<string | null>(null);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const value = input.trim().replace(/^@/, "").toLowerCase();
    if (!value) {
      setNote(null);
      return;
    }
    if (value === bakedUsername.toLowerCase()) {
      setNote(null);
      return;
    }
    setNote(`Diese Version zeigt nur das Profil ${displayName}.`);
  }

  return (
    <form onSubmit={onSubmit} className="search-form">
      <label htmlFor="letterboxd">Profil prüfen (optional)</label>
      <div className="search-row">
        <input
          id="letterboxd"
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={bakedUsername}
        />
        <button type="submit">Prüfen</button>
      </div>
      {note && <p className="hint">{note}</p>}
    </form>
  );
}
