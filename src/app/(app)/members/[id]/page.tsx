"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Member {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  dob: string | null;
  address: string | null;
  gender: string | null;
  maritalStatus: string | null;
  baptisedAt: string | null;
  joinedAt: string;
  type: string;
  archivedAt: string | null;
  tagIds: string[];
}

interface Note {
  id: string;
  bodyHtml: string;
  source: string;
  createdAt: string;
  authorName: string;
}

interface Tag {
  id: string;
  name: string;
  colour: string;
}

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [member, setMember] = useState<Member | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [tab, setTab] = useState<"profile" | "notes">("profile");

  const fetchMember = useCallback(async () => {
    const res = await fetch(`/api/members/${id}`);
    if (res.ok) setMember(await res.json());
    else router.push("/members");
  }, [id, router]);

  const fetchNotes = useCallback(async () => {
    const res = await fetch(`/api/members/${id}/notes`);
    if (res.ok) setNotes(await res.json());
  }, [id]);

  useEffect(() => {
    fetchMember();
    fetchNotes();
    fetch("/api/tags").then((r) => r.json()).then(setTags);
  }, [fetchMember, fetchNotes]);

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteText.trim()) return;
    setAddingNote(true);
    const res = await fetch(`/api/members/${id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bodyHtml: noteText }),
    });
    if (res.ok) {
      setNoteText("");
      fetchNotes();
    }
    setAddingNote(false);
  }

  async function handleArchive() {
    if (!confirm("Archive this member? They will be hidden from default views.")) return;
    await fetch(`/api/members/${id}`, { method: "DELETE" });
    router.push("/members");
  }

  if (!member) return <div className="text-gray-400">Loading…</div>;

  const memberTags = tags.filter((t) => member.tagIds.includes(t.id));

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/members" className="text-sm text-gray-500 hover:text-gray-700">← Members</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-semibold text-gray-900">{member.fullName}</h1>
        {member.type === "guest" && (
          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">Guest</span>
        )}
      </div>

      {/* Tags */}
      {memberTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {memberTags.map((tag) => (
            <span
              key={tag.id}
              className="px-2.5 py-1 rounded-full text-xs font-medium text-white"
              style={{ backgroundColor: tag.colour }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-5">
        {(["profile", "notes"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
              tab === t ? "border-b-2 border-indigo-600 text-indigo-600 -mb-px" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "profile" && (
        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          {[
            { label: "Phone", value: member.phone },
            { label: "Email", value: member.email },
            { label: "Date of Birth", value: member.dob },
            { label: "Gender", value: member.gender },
            { label: "Marital Status", value: member.maritalStatus },
            { label: "Address", value: member.address },
            { label: "Baptised", value: member.baptisedAt },
            { label: "Joined", value: member.joinedAt },
          ].map(({ label, value }) => (
            <div key={label} className="flex px-5 py-3 gap-4">
              <span className="w-36 text-sm text-gray-500 flex-shrink-0">{label}</span>
              <span className="text-sm text-gray-900">{value || "—"}</span>
            </div>
          ))}
          <div className="px-5 py-4">
            <button
              onClick={handleArchive}
              className="text-sm text-red-500 hover:underline"
            >
              Archive member
            </button>
          </div>
        </div>
      )}

      {tab === "notes" && (
        <div className="space-y-4">
          <form onSubmit={handleAddNote} className="bg-white border border-gray-200 rounded-xl p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Add Note</label>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={3}
              placeholder="Write a pastoral note…"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
            <div className="flex justify-end mt-2">
              <button
                type="submit"
                disabled={addingNote || !noteText.trim()}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {addingNote ? "Saving…" : "Save Note"}
              </button>
            </div>
          </form>

          {notes.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No notes yet.</p>
          ) : (
            notes.map((note) => (
              <div key={note.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-600">{note.authorName}</span>
                  <span className="text-xs text-gray-400">
                    {new Date(note.createdAt).toLocaleDateString()}
                    {note.source === "telegram" && (
                      <span className="ml-2 text-indigo-500">via Telegram</span>
                    )}
                  </span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.bodyHtml}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
