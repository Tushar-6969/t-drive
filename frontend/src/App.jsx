import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'

const TOKEN_KEY = 'dobby-drive-token'
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000'

function formatBytes(bytes) {
  if (!bytes) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** index

  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`
}

function assetUrl(path) {
  if (!path) return ''
  return path.startsWith('http') ? path : `${API_BASE_URL}${path}`
}

async function parseResponse(response) {
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.message || 'Request failed')
  }

  return data
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [currentUser, setCurrentUser] = useState(null)
  const [folders, setFolders] = useState([])
  const [images, setImages] = useState([])
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' })
  const [authError, setAuthError] = useState('')
  const [currentFolderId, setCurrentFolderId] = useState(null)
  const [folderName, setFolderName] = useState('')
  const [uploadName, setUploadName] = useState('')
  const [uploadFile, setUploadFile] = useState(null)
  const [notice, setNotice] = useState('')
  const [serverAlert, setServerAlert] = useState('')
  const [loading, setLoading] = useState(Boolean(token))
  const REQUEST_TIMEOUT_MS = 10000

  function formatBackendError(error) {
    if (error.name === 'AbortError') {
      return 'The backend is not responding. Please keep the web service running and try again in a few seconds.'
    }

    if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
      return 'render keeps the web service in sleep mode wait for few seconds then retry.'
    }

    return error.message || 'Request failed. Please try again in a few seconds.'
  }

  const api = useCallback(
    async (path, options = {}) => {
      const headers = {
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

      try {
        const response = await fetch(`${API_BASE_URL}${path}`, {
          ...options,
          headers,
          signal: controller.signal,
        })

        return await parseResponse(response)
      } catch (error) {
        const message = formatBackendError(error)
        throw new Error(message)
      } finally {
        clearTimeout(timeoutId)
      }
    },
    [token],
  )

  const loadDrive = useCallback(async () => {
    const data = await api('/api/folders')
    setFolders(data.folders)
    setImages(data.images)
    setServerAlert('')
  }, [api])

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setCurrentUser(null)
    setFolders([])
    setImages([])
    setCurrentFolderId(null)
    setNotice('')
  }, [])

  const visibleFolders = folders.filter((folder) => folder.parentId === currentFolderId)
  const visibleImages = images.filter((image) => image.folderId === currentFolderId)

  const breadcrumbs = useMemo(() => {
    const crumbs = []
    let pointer = currentFolderId

    while (pointer) {
      const folder = folders.find((item) => item.id === pointer)
      if (!folder) break
      crumbs.unshift(folder)
      pointer = folder.parentId
    }

    return crumbs
  }, [currentFolderId, folders])

  const stats = {
    folders: folders.length,
    images: images.length,
    storage: images.reduce((total, image) => total + image.size, 0),
  }

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }

    let isMounted = true

    async function restoreSession() {
      try {
        const [profile, drive] = await Promise.all([api('/api/auth/me'), api('/api/folders')])

        if (!isMounted) return
        setCurrentUser(profile.user)
        setFolders(drive.folders)
        setImages(drive.images)
        setServerAlert('')
      } catch (error) {
        if (isMounted) {
          setServerAlert(error.message)
          clearSession()
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    restoreSession()

    return () => {
      isMounted = false
    }
  }, [api, clearSession, token])

  function saveSession(nextToken, user) {
    localStorage.setItem(TOKEN_KEY, nextToken)
    setToken(nextToken)
    setCurrentUser(user)
    setServerAlert('')
  }

  async function handleAuthSubmit(event) {
    event.preventDefault()
    setAuthError('')

    const payload = {
      email: authForm.email.trim().toLowerCase(),
      password: authForm.password,
      ...(authMode === 'signup' ? { name: authForm.name.trim() } : {}),
    }

    if (!payload.email || !payload.password || (authMode === 'signup' && !payload.name)) {
      setAuthError('Please fill all required fields.')
      return
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/${authMode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await parseResponse(response)

      saveSession(data.token, data.user)
      setAuthForm({ name: '', email: '', password: '' })
      setLoading(true)
    } catch (error) {
      setAuthError(formatBackendError(error))
    }
  }

  async function handleCreateFolder(event) {
    event.preventDefault()
    const name = folderName.trim()
    if (!name) return

    try {
      await api('/api/folders', {
        method: 'POST',
        body: JSON.stringify({ name, parentId: currentFolderId }),
      })
      await loadDrive()
      setFolderName('')
      setNotice(`Created "${name}".`)
    } catch (error) {
      setNotice(formatBackendError(error))
    }
  }

  async function handleUpload(event) {
    event.preventDefault()

    if (!uploadFile || !uploadName.trim()) {
      setNotice('Image name and file are required.')
      return
    }

    const formData = new FormData()
    formData.append('name', uploadName.trim())
    formData.append('folderId', currentFolderId || '')
    formData.append('image', uploadFile)

    try {
      await api('/api/images', {
        method: 'POST',
        body: formData,
      })
      await loadDrive()
      setNotice(`Uploaded "${uploadName.trim()}".`)
      setUploadName('')
      setUploadFile(null)
      event.target.reset()
    } catch (error) {
      setNotice(formatBackendError(error))
    }
  }

  if (loading) {
    return (
      <main className="auth-shell">
        <section className="loading-panel">
          <p className="eyebrow">Dobby Drive</p>
          <h1>Loading workspace</h1>
        </section>
      </main>
    )
  }

  if (!currentUser) {
    return (
      <main className="auth-shell">
        <section className="auth-panel">
          <div>
            <p className="eyebrow">Dobby Ads Assignment</p>
            <h1>Image Drive</h1>
            <p className="lede">
              Register, log in, create nested folders, upload images, and keep every user&apos;s
              files private.
            </p>
          </div>

          <form className="auth-card" onSubmit={handleAuthSubmit}>
            {serverAlert && <p className="notice">{serverAlert}</p>}
            <div className="mode-switch" aria-label="Authentication mode">
              <button
                className={authMode === 'login' ? 'active' : ''}
                type="button"
                onClick={() => {
                  setAuthMode('login')
                  setAuthError('')
                }}
              >
                Login
              </button>
              <button
                className={authMode === 'signup' ? 'active' : ''}
                type="button"
                onClick={() => {
                  setAuthMode('signup')
                  setAuthError('')
                }}
              >
                Signup
              </button>
            </div>

            {authMode === 'signup' && (
              <label>
                Name
                <input
                  value={authForm.name}
                  onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })}
                  placeholder="Tushar"
                />
              </label>
            )}

            <label>
              Email
              <input
                type="email"
                value={authForm.email}
                onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}
                placeholder="you@example.com"
              />
            </label>

            <label>
              Password
              <input
                type="password"
                value={authForm.password}
                onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
                placeholder="Password"
              />
            </label>

            {authError && <p className="error">{authError}</p>}
            <button className="primary-action" type="submit">
              {authMode === 'login' ? 'Login' : 'Create account'}
            </button>
          </form>
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Dobby Drive</p>
          <h1>My Images</h1>
        </div>

        <div className="profile">
          <span>{currentUser.name.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{currentUser.name}</strong>
            <small>{currentUser.email}</small>
          </div>
        </div>

        <div className="stats">
          <article>
            <strong>{stats.folders}</strong>
            <span>Folders</span>
          </article>
          <article>
            <strong>{stats.images}</strong>
            <span>Images</span>
          </article>
          <article>
            <strong>{formatBytes(stats.storage)}</strong>
            <span>Total size</span>
          </article>
        </div>

        <button className="ghost-action" type="button" onClick={clearSession}>
          Logout
        </button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <nav className="breadcrumbs" aria-label="Current folder path">
            <button type="button" onClick={() => setCurrentFolderId(null)}>
              Root
            </button>
            {breadcrumbs.map((folder) => (
              <button key={folder.id} type="button" onClick={() => setCurrentFolderId(folder.id)}>
                {folder.name}
              </button>
            ))}
          </nav>
          <span>{visibleFolders.length + visibleImages.length} items</span>
        </header>

        <section className="actions">
          <form onSubmit={handleCreateFolder}>
            <label>
              New folder
              <input
                value={folderName}
                onChange={(event) => setFolderName(event.target.value)}
                placeholder="Campaign assets"
              />
            </label>
            <button type="submit">Create</button>
          </form>

          <form onSubmit={handleUpload}>
            <label>
              Image name
              <input
                value={uploadName}
                onChange={(event) => setUploadName(event.target.value)}
                placeholder="Homepage banner"
              />
            </label>
            <label className="file-picker">
              Image file
              <input
                type="file"
                accept="image/*"
                onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
              />
              <span>{uploadFile ? uploadFile.name : 'Choose image'}</span>
            </label>
            <button type="submit">Upload</button>
          </form>
        </section>

        {(serverAlert || notice) && (
          <p className="notice">{serverAlert || notice}</p>
        )}

        <section className="browser" aria-label="Folders and images">
          {visibleFolders.map((folder) => (
            <button
              className="folder-card"
              key={folder.id}
              type="button"
              onClick={() => setCurrentFolderId(folder.id)}
            >
              <span className="folder-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" role="img">
                  <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4H10l2 2h6.5A2.5 2.5 0 0 1 21 8.5v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5z" />
                </svg>
              </span>
              <strong>{folder.name}</strong>
              <small>{formatBytes(folder.size)}</small>
            </button>
          ))}

          {visibleImages.map((image) => (
            <article className="image-card" key={image.id}>
              <img src={assetUrl(image.src)} alt={image.name} />
              <div>
                <strong>{image.name}</strong>
                <small>{formatBytes(image.size)}</small>
              </div>
            </article>
          ))}

          {!visibleFolders.length && !visibleImages.length && (
            <div className="empty-state">
              <h2>This folder is empty</h2>
              <p>Create a nested folder or upload an image to get started.</p>
            </div>
          )}
        </section>
      </section>
    </main>
  )
}

export default App
