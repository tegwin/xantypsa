'use client';

import { useState } from 'react';
import { useApi, apiPost, apiPatch, apiDelete } from '@/hooks/useApi';
import { formatRelativeTime } from '@/lib/utils';
import { Pin, Trash2, Phone as PhoneIcon, Mail, Calendar, MessageSquare, CheckSquare } from 'lucide-react';

interface CrmNotesTabProps {
  company: any;
}

const NOTE_TYPES = [
  { value: 'note', label: 'Note', icon: MessageSquare },
  { value: 'call', label: 'Call', icon: PhoneIcon },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'meeting', label: 'Meeting', icon: Calendar },
  { value: 'task', label: 'Task', icon: CheckSquare },
];

export default function CrmNotesTab({ company }: CrmNotesTabProps) {
  const { data, loading, refetch } = useApi<any>(`/api/crm-notes?entityType=company&entityId=${company.id}`);
  const [content, setContent] = useState('');
  const [noteType, setNoteType] = useState('note');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setSubmitting(true);
    await apiPost('/api/crm-notes', {
      entityType: 'company',
      entityId: company.id,
      content: content.trim(),
      type: noteType,
    });
    setContent('');
    setSubmitting(false);
    refetch();
  };

  const togglePin = async (noteId: string, isPinned: boolean) => {
    await apiPatch(`/api/crm-notes/${noteId}`, { isPinned: !isPinned });
    refetch();
  };

  const deleteNote = async (noteId: string) => {
    await apiDelete(`/api/crm-notes/${noteId}`);
    refetch();
  };

  const notes = data?.items || [];

  return (
    <div className="space-y-4">
      {/* New Note Input */}
      <div className="glass rounded-xl p-4">
        <div className="flex gap-2 mb-3">
          {NOTE_TYPES.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.value} onClick={() => setNoteType(t.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${noteType === t.value ? 'bg-brand-600 text-white' : 'bg-white/5 text-slate-400 hover:text-white'}`}>
                <Icon className="w-3 h-3" /> {t.label}
              </button>
            );
          })}
        </div>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Add a note..."
          rows={3}
          className="w-full mb-3"
        />
        <div className="flex justify-end">
          <button onClick={handleSubmit} disabled={!content.trim() || submitting} className="btn-primary text-sm">
            {submitting ? 'Adding...' : 'Add Note'}
          </button>
        </div>
      </div>

      {/* Notes List */}
      {loading ? (
        <div className="text-center py-8 text-slate-400">Loading notes...</div>
      ) : notes.length > 0 ? (
        <div className="space-y-3">
          {notes.map((note: any) => {
            const TypeIcon = NOTE_TYPES.find(t => t.value === note.type)?.icon || MessageSquare;
            return (
              <div key={note.id} className={`glass rounded-xl p-4 ${note.isPinned ? 'ring-1 ring-amber-500/30' : ''}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <TypeIcon className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-medium text-slate-400 capitalize">{note.type}</span>
                    <span className="text-xs text-slate-500">by {note.user?.name || 'Unknown'}</span>
                    <span className="text-xs text-slate-600">{formatRelativeTime(note.createdAt)}</span>
                    {note.isPinned && <Pin className="w-3 h-3 text-amber-400" />}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => togglePin(note.id, note.isPinned)}
                      className={`p-1 rounded hover:bg-white/10 ${note.isPinned ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'}`}
                      title={note.isPinned ? 'Unpin' : 'Pin'}>
                      <Pin className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deleteNote(note.id)}
                      className="p-1 rounded hover:bg-white/10 text-slate-500 hover:text-red-400"
                      title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-slate-300 whitespace-pre-wrap">{note.content}</p>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass rounded-xl p-8 text-center text-sm text-slate-500">No notes yet. Add one above.</div>
      )}
    </div>
  );
}
