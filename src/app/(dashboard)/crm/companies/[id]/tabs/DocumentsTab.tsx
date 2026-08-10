'use client';

import { useState, useRef } from 'react';
import { useApi, apiPost, apiDelete } from '@/hooks/useApi';
import { formatRelativeTime } from '@/lib/utils';
import { FileText, Upload, Trash2, Download } from 'lucide-react';

interface DocumentsTabProps {
  company: any;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function DocumentsTab({ company }: DocumentsTabProps) {
  const { data, loading, refetch } = useApi<any>(`/api/documents?entityType=company&entityId=${company.id}`);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    setUploading(true);
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityType', 'company');
      formData.append('entityId', company.id);

      await fetch('/api/documents', {
        method: 'POST',
        body: formData,
      });
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    refetch();
  };

  const handleDelete = async (docId: string) => {
    await apiDelete(`/api/documents/${docId}`);
    refetch();
  };

  const documents = data?.items || [];

  return (
    <div className="glass rounded-xl p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-white font-semibold">Documents ({documents.length})</h3>
        <label className="btn-primary flex items-center gap-1.5 text-sm cursor-pointer">
          <Upload className="w-3.5 h-3.5" /> {uploading ? 'Uploading...' : 'Upload'}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleUpload}
            className="hidden"
            disabled={uploading}
          />
        </label>
      </div>

      {loading ? (
        <div className="text-center py-8 text-slate-400">Loading documents...</div>
      ) : documents.length > 0 ? (
        <div className="space-y-2">
          {documents.map((doc: any) => (
            <div key={doc.id} className="flex items-center justify-between bg-white/5 rounded-lg p-3 hover:bg-white/10 transition-colors">
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-slate-400" />
                <div>
                  <span className="text-white text-sm font-medium">{doc.fileName}</span>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>{formatFileSize(doc.fileSize)}</span>
                    <span>by {doc.user?.name || 'Unknown'}</span>
                    <span>{formatRelativeTime(doc.createdAt)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {doc.fileUrl && (
                  <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                    className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-white">
                    <Download className="w-3.5 h-3.5" />
                  </a>
                )}
                <button onClick={() => handleDelete(doc.id)}
                  className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-red-400">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No documents uploaded yet</p>
        </div>
      )}
    </div>
  );
}
