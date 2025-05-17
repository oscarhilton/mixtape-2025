'use client';

import React from 'react';
import { useAuth } from '@repo/shared-contexts';
import Link from 'next/link';

export default function Header() {
  const { user, isLoading, login, logout, devLogin } = useAuth();

  return (
    <header className="bg-spotify-light-dark text-spotify-light-gray p-4 sticky top-0 z-50 shadow-lg">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/" className="text-2xl font-bold hover:text-white transition-colors">
          Mixtape In A Bottle
        </Link>
        <nav className="flex items-center space-x-4">
          {isLoading ? (
            <p className="italic">Loading user...</p>
          ) : user ? (
            <>
              <span className="text-sm">Welcome, {user.display_name}!</span>
              <button
                onClick={logout}
                className="px-4 py-2 bg-spotify-gray hover:bg-red-700 text-white rounded-md transition-colors text-sm font-medium"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <button
                onClick={login}
                className="px-4 py-2 bg-spotify-green hover:bg-opacity-80 text-white rounded-md transition-colors text-sm font-medium"
              >
                Login with Spotify
              </button>
              {process.env.NODE_ENV === 'development' && devLogin && (
                <button
                  onClick={() => devLogin('1')} // Default dev user ID to '1' or make it configurable
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors text-sm font-medium"
                  title="Ensure your backend supports dev login with this ID"
                >
                  Dev Login
                </button>
              )}
            </>
          )}
        </nav>
      </div>
    </header>
  );
} 