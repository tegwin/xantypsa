'use client';

import React, { useState } from 'react';
import { useSession } from '@/components/SessionProvider';
import { Bell, Search, ChevronDown, Building2, Check, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function Header() {
  const { data: session, update } = useSession();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  return (
    <header className="h-14 border-b border-surface-700/50 bg-surface-900/80 backdrop-blur-md flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
      {/* Left - Breadcrumb / Title area */}
      <div className="flex items-center gap-3 lg:ml-0 ml-12">
        <div className="hidden sm:flex items-center gap-2 text-sm">
          <span className="text-surface-500">{session?.user?.tenantName}</span>
        </div>
      </div>

      {/* Right - Actions */}
      <div className="flex items-center gap-2">
        {/* Global search */}
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="p-2 rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-colors"
        >
          <Search className="h-4.5 w-4.5" />
        </button>

        {/* Notifications */}
        <Link href="/help"
          className="p-2 rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-colors"
          title="Help & API Docs">
          <HelpCircle className="h-4.5 w-4.5" />
        </Link>

        {/* Notifications bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-colors relative"
          >
            <Bell className="h-4.5 w-4.5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand-500" />
          </button>

          {showNotifications && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
              <div className="absolute right-0 top-full mt-2 w-80 bg-surface-800 rounded-xl border border-surface-700 shadow-2xl z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-surface-700">
                  <h3 className="text-sm font-medium text-surface-100">Notifications</h3>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  <div className="px-4 py-8 text-center text-sm text-surface-500">
                    No new notifications
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Search overlay */}
      {showSearch && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setShowSearch(false)} />
          <div className="fixed top-20 left-1/2 -translate-x-1/2 w-full max-w-xl z-50 px-4">
            <div className="bg-surface-800 rounded-xl border border-surface-700 shadow-2xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3">
                <Search className="h-5 w-5 text-surface-400" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search tickets, contacts, invoices..."
                  className="flex-1 bg-transparent text-surface-100 placeholder:text-surface-500 focus:outline-none text-sm"
                />
                <kbd className="hidden sm:inline-flex px-2 py-0.5 rounded text-xs bg-surface-700 text-surface-400 border border-surface-600">
                  ESC
                </kbd>
              </div>
              <div className="border-t border-surface-700 px-4 py-6 text-center text-sm text-surface-500">
                Start typing to search across all modules
              </div>
            </div>
          </div>
        </>
      )}
    </header>
  );
}
