import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PlaylistForm } from 'shared-ui';
import { AuthContext } from 'shared-contexts';
import { useRouter } from 'next/navigation'; // mock is in jest.setup.js

// Mock global fetch
global.fetch = jest.fn();

describe('<PlaylistForm />', () => {
  const mockRouterRefresh = jest.fn();
  const mockLogin = jest.fn(); // Not used directly by form, but part of context
  const mockLogout = jest.fn(); // Not used directly by form, but part of context

  beforeEach(() => {
    (fetch as jest.Mock).mockClear();
    mockRouterRefresh.mockClear();
    const router = useRouter();
    router.refresh = mockRouterRefresh; // Ensure our specific mock is used
  });

  const mockAuthContextLoading = {
    user: null,
    isLoading: true,
    login: jest.fn(),
    logout: jest.fn(),
    accessToken: null,
  };

  const mockAuthContextLoggedOut = {
    user: null,
    isLoading: false,
    login: jest.fn(),
    logout: jest.fn(),
    accessToken: null,
  };

  const mockAuthContextLoggedIn = {
    user: { id: 1, spotify_id: 'testuser', display_name: 'Test User' },
    isLoading: false,
    login: jest.fn(),
    logout: jest.fn(),
    accessToken: 'mock-token',
  };

  it('shows loading message when auth is loading', () => {
    render(
      <AuthContext.Provider value={mockAuthContextLoading}>
        <PlaylistForm />
      </AuthContext.Provider>
    );
    expect(screen.getByText('Loading form...')).toBeInTheDocument();
  });

  it('prompts user to log in if not authenticated', () => {
    render(
      <AuthContext.Provider value={mockAuthContextLoggedOut}>
        <PlaylistForm />
      </AuthContext.Provider>
    );
    expect(screen.getByText('Please log in to add a new playlist.')).toBeInTheDocument();
  });

  it('renders the form when user is authenticated', () => {
    render(
      <AuthContext.Provider value={mockAuthContextLoggedIn}>
        <PlaylistForm />
      </AuthContext.Provider>
    );
    expect(screen.getByLabelText(/playlist name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/spotify playlist id/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add playlist/i })).toBeInTheDocument();
  });

  it('submits the form data and refreshes on success', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 1 }) });

    render(
      <AuthContext.Provider value={mockAuthContextLoggedIn}>
        <PlaylistForm />
      </AuthContext.Provider>
    );

    fireEvent.change(screen.getByLabelText(/playlist name/i), { target: { value: 'My Awesome Playlist' } });
    fireEvent.change(screen.getByLabelText(/spotify playlist id/i), { target: { value: 'spotify123' } });
    fireEvent.click(screen.getByRole('button', { name: /add playlist/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/playlists'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'My Awesome Playlist', spotify_playlist_id: 'spotify123', description: '' }),
        })
      );
    });
    await waitFor(() => expect(mockRouterRefresh).toHaveBeenCalledTimes(1));
    // Check if form fields are cleared
    expect((screen.getByLabelText(/playlist name/i) as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText(/spotify playlist id/i) as HTMLInputElement).value).toBe('');
  });

  it('shows an error message if submission fails', async () => {
    const errorMessage = 'Failed to create playlist due to an error';
    (fetch as jest.Mock).mockResolvedValueOnce({ 
        ok: false, 
        json: async () => ({ message: errorMessage }),
        status: 500 
    });

    render(
      <AuthContext.Provider value={mockAuthContextLoggedIn}>
        <PlaylistForm />
      </AuthContext.Provider>
    );

    fireEvent.change(screen.getByLabelText(/playlist name/i), { target: { value: 'Test Playlist' } });
    fireEvent.change(screen.getByLabelText(/spotify playlist id/i), { target: { value: 'failcase' } });
    fireEvent.click(screen.getByRole('button', { name: /add playlist/i }));

    await waitFor(() => {
      expect(screen.getByText(`Error: ${errorMessage}`)).toBeInTheDocument();
    });
  });
}); 