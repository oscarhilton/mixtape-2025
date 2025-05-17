"use client";

import React from "react";
import { useAuth } from "@repo/shared-contexts";
import { ThemeToggle } from "./ThemeToggle";

export default function Header() {
  const { user, isLoading, login, logout, devLogin } = useAuth();

  return (
    <header className="bg-spotify-light-dark dark:bg-spotify-dark border-b border-spotify-gray sticky top-0 z-50">
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <a
              href="/"
              className="text-spotify-light-gray text-xl font-bold hover:text-spotify-green transition-colors"
            >
              Mixtape In A Bottle
            </a>
          </div>
          <div className="flex items-center space-x-4">
            <ThemeToggle />
            {isLoading ? (
              <p className="italic text-spotify-light-gray">Loading user...</p>
            ) : user ? (
              <div className="flex items-center space-x-4">
                <span className="text-spotify-light-gray">{user.display_name}</span>
                <button
                  onClick={logout}
                  className="px-4 py-2 text-sm font-medium bg-spotify-green rounded-full hover:bg-opacity-90 transition-colors"
                >
                  Logout
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={login}
                  className="px-4 py-2 bg-spotify-green hover:bg-opacity-80 rounded-full transition-colors text-sm font-medium"
                >
                  Login with Spotify
                </button>
                {process.env.NODE_ENV === "development" && devLogin && (
                  <button
                    onClick={() => devLogin("1")}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-full transition-colors text-sm font-medium"
                    title="Ensure your backend supports dev login with this ID"
                  >
                    Dev Login
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
