'use client';

import { useAuth } from '@repo/shared-contexts';
import Link from 'next/link';

export default function Header() {
  const { user, isLoading, login, logout, devLogin } = useAuth();

  return (
    <header className="bg-gray-800 text-white p-4 shadow-md">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/" className="text-xl font-bold hover:text-gray-300">
          Mixtape In A Bottle
        </Link>
        <nav>
          {isLoading ? (
            <p>Loading...</p>
          ) : user ? (
            <div className="flex items-center space-x-4">
              <p>Welcome, {user.display_name}!</p>
              <button
                onClick={logout}
                className="px-4 py-2 bg-red-500 hover:bg-red-700 rounded transition-colors"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <button
                onClick={login}
                className="px-4 py-2 bg-green-500 hover:bg-green-700 rounded transition-colors"
              >
                Login with Spotify
              </button>
              {process.env.NODE_ENV === 'development' && devLogin && (
                <button
                  onClick={() => devLogin('your_dev_user_id')} // Replace 'your_dev_user_id' with your actual dev user ID
                  className="px-4 py-2 bg-purple-500 hover:bg-purple-700 rounded transition-colors"
                >
                  Dev Login
                </button>
              )}
            </div>
          )}
        </nav>
      </div>
    </header>
  );
} 