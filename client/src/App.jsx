import { useEffect, useState } from 'react'
import { api } from './api'
import './App.css'

const EVENTS = [
  { value: 'ISSUE_OPENED', label: 'Issue Opened' },
  { value: 'PULL_REQUEST_OPENED', label: 'Pull Request Opened' },
  { value: 'PUSH', label: 'Push' },
]
const FILTER_FIELDS = [
  { value: 'TITLE', label: 'Title' },
  { value: 'AUTHOR', label: 'Author' },
  { value: 'BRANCH', label: 'Branch' },
]
const FILTER_OPERATORS = [
  { value: 'CONTAINS', label: 'Contains' },
  { value: 'EQUALS', label: 'Equals' },
  { value: 'STARTS_WITH', label: 'Starts With' },
  { value: 'ENDS_WITH', label: 'Ends With' },
]
const ACTIONS = [
  { value: 'ADD_LABEL', label: 'Add Label' },
  { value: 'SEND_SLACK', label: 'Send Slack' },
]

// The action's value means different things per action type.
const ACTION_VALUE_LABEL = {
  ADD_LABEL: 'Label',
  SEND_SLACK: 'Message (optional)',
}

const labelOf = (list, value) =>
  list.find((item) => item.value === value)?.label ?? value

// Compact "time ago" from an ISO timestamp.
function timeAgo(iso) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// Short description of the action an execution performed.
function describeAction(execution) {
  switch (execution.actionType) {
    case 'ADD_LABEL':
      return (
        <>
          Added label <strong>{execution.actionValue}</strong>
        </>
      )
    case 'SEND_SLACK':
      return execution.actionValue ? (
        <>
          Sent Slack message <strong>{execution.actionValue}</strong>
        </>
      ) : (
        'Sent Slack notification'
      )
    default:
      return `${labelOf(ACTIONS, execution.actionType)}: ${execution.actionValue}`
  }
}

export default function App() {
  // { status: 'loading' | 'unauthenticated' | 'authenticated', user }
  const [state, setState] = useState({ status: 'loading' })

  useEffect(() => {
    // /auth/me is the auth check: it returns the current user, or 401 if the
    // session cookie is missing/expired.
    api
      .getMe()
      .then((user) => setState({ status: 'authenticated', user }))
      .catch(() => setState({ status: 'unauthenticated' }))
  }, [])

  if (state.status === 'loading') {
    return (
      <div className="center">
        <div className="spinner" />
      </div>
    )
  }

  if (state.status === 'unauthenticated') {
    return <Login />
  }

  return (
    <Dashboard
      user={state.user}
      onLogout={() => setState({ status: 'unauthenticated' })}
    />
  )
}

function Login() {
  return (
    <div className="center">
      <div className="card login">
        <div className="mark">⚙</div>
        <h1>GitHub Automation</h1>
        <p className="muted">
          Automate labels and actions on issues, pull requests, and pushes.
        </p>
        <a className="btn btn-primary btn-block" href={api.loginUrl}>
          Login with GitHub
        </a>
      </div>
    </div>
  )
}

const NAV = [
  { key: 'rules', label: 'Rules' },
  { key: 'activity', label: 'Activity' },
  { key: 'settings', label: 'Settings' },
]

function Dashboard({ user, onLogout }) {
  const [repos, setRepos] = useState([])
  // undefined = still loading; null = none connected; object = connected
  const [connectedRepo, setConnectedRepo] = useState(undefined)
  const [picking, setPicking] = useState(false)
  const [page, setPage] = useState('rules')

  // Data is loaded here (once) and passed to pages, so switching tabs doesn't
  // refetch. Pages re-fetch only on explicit actions (create/delete/refresh).
  const [rules, setRules] = useState([])
  const [executions, setExecutions] = useState([])

  function loadData(isActive = () => true) {
    api
      .getRules()
      .then((data) => isActive() && setRules(data))
      .catch(() => {})
    api
      .getExecutions()
      .then((data) => isActive() && setExecutions(data))
      .catch(() => {})
  }

  useEffect(() => {
    let active = true
    api
      .getRepositories()
      .then((data) => active && setRepos(data))
      .catch(() => {})

    api
      .getConnectedRepository()
      .then((repo) => {
        if (!active) return
        setConnectedRepo(repo)
        loadData(() => active)
      })
      .catch(() => active && setConnectedRepo(null))

    return () => {
      active = false
    }
  }, [])

  function handleConnected(repo) {
    setConnectedRepo(repo)
    setPicking(false)
    setPage('rules')
    // Different repo → refresh its rules and activity.
    loadData()
  }

  async function handleLogout() {
    try {
      await api.logout()
    } finally {
      onLogout()
    }
  }

  async function handleDeleteRule(id) {
    const previous = rules
    setRules((prev) => prev.filter((rule) => rule.id !== id))
    try {
      await api.deleteRule(id)
    } catch {
      setRules(previous)
    }
  }

  async function refreshActivity() {
    try {
      setExecutions(await api.getExecutions())
    } catch {
      // keep existing activity on failure
    }
  }

  if (connectedRepo === undefined) {
    return (
      <div className="center">
        <div className="spinner" />
      </div>
    )
  }

  const showPicker = !connectedRepo || picking

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <span className="mark small">⚙</span>
          GitHub Automation
        </div>
        <div className="user">
          {connectedRepo && (
            <button
              className="repo-chip"
              onClick={() => setPicking(true)}
              title="Change repository"
            >
              <span className="repo-dot" />
              {connectedRepo.fullName}
              <span className="repo-change">Change</span>
            </button>
          )}
          {user?.avatarUrl && (
            <img className="avatar" src={user.avatarUrl} alt="" />
          )}
          <span className="username">{user?.username}</span>
          <button className="btn btn-ghost" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      {showPicker ? (
        <div className="picker-screen">
          <RepoPicker
            repos={repos}
            currentId={connectedRepo?.githubId}
            canCancel={Boolean(connectedRepo)}
            onCancel={() => setPicking(false)}
            onConnected={handleConnected}
          />
        </div>
      ) : (
        <>
          <nav className="tabs">
            {NAV.map((item) => (
              <button
                key={item.key}
                className={page === item.key ? 'tab active' : 'tab'}
                onClick={() => setPage(item.key)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <main className="content">
            {page === 'rules' && (
              <RulesPage
                rules={rules}
                onCreated={(rule) => setRules((prev) => [rule, ...prev])}
                onDelete={handleDeleteRule}
              />
            )}
            {page === 'activity' && (
              <ActivityPage executions={executions} onRefresh={refreshActivity} />
            )}
            {page === 'settings' && <SettingsPage user={user} />}
          </main>
        </>
      )}
    </div>
  )
}

function RulesPage({ rules, onCreated, onDelete }) {
  return (
    <>
      <RuleForm onCreated={onCreated} />
      <RuleList rules={rules} onDelete={onDelete} />
    </>
  )
}

function ActivityPage({ executions, onRefresh }) {
  return <ActivityList executions={executions} onRefresh={onRefresh} />
}

function SettingsPage({ user }) {
  return <SlackSettings initialUrl={user?.slackWebhookUrl} />
}

function RepoPicker({ repos, currentId, canCancel, onCancel, onConnected }) {
  const [selectedRepo, setSelectedRepo] = useState(
    currentId ? String(currentId) : '',
  )
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')

  async function handleConnect() {
    if (!selectedRepo) return
    setConnecting(true)
    setError('')
    try {
      const res = await api.connectRepository(selectedRepo)
      onConnected(res.repository)
    } catch (err) {
      setError(err.message)
    } finally {
      setConnecting(false)
    }
  }

  return (
    <div className="card picker">
      <div className="mark">⚙</div>
      <h1>{canCancel ? 'Change repository' : 'Choose a repository'}</h1>
      <p className="muted">
        Select the repository you want to automate. You can change this later.
      </p>
      {canCancel && (
        <p className="warning">
          Your existing rules stay and will run against the repository you
          select here.
        </p>
      )}
      <select
        className="select"
        value={selectedRepo}
        onChange={(e) => setSelectedRepo(e.target.value)}
      >
        <option value="">Select a repository…</option>
        {repos.map((repo) => (
          <option key={repo.id} value={repo.id}>
            {repo.fullName}
          </option>
        ))}
      </select>
      {error && <p className="error">{error}</p>}
      <button
        className="btn btn-primary btn-block"
        onClick={handleConnect}
        disabled={!selectedRepo || connecting}
      >
        {connecting ? 'Connecting…' : 'Continue'}
      </button>
      {canCancel && (
        <button className="btn btn-ghost btn-block" onClick={onCancel}>
          Cancel
        </button>
      )}
    </div>
  )
}

function RuleForm({ onCreated }) {
  const empty = {
    event: EVENTS[0].value,
    filterField: '', // '' = no filter (rule applies to every event)
    filterOperator: FILTER_OPERATORS[0].value,
    filterValue: '',
    actionType: ACTIONS[0].value,
    actionValue: '',
  }
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })
  const hasFilter = Boolean(form.filterField)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        event: form.event,
        actionType: form.actionType,
        actionValue: form.actionValue.trim(),
        // Only send filter fields when a filter field is chosen.
        ...(hasFilter && {
          filterField: form.filterField,
          filterOperator: form.filterOperator,
          filterValue: form.filterValue.trim(),
        }),
      }
      const res = await api.createRule(payload)
      onCreated(res.rule)
      setForm(empty)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="card">
      <h2>Create Rule</h2>
      <form onSubmit={handleSubmit} className="form">
        <label className="field">
          <span>Event</span>
          <select className="select" value={form.event} onChange={set('event')}>
            {EVENTS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Filter (optional)</span>
          <select
            className="select"
            value={form.filterField}
            onChange={set('filterField')}
          >
            <option value="">No filter — run on every event</option>
            {FILTER_FIELDS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        {hasFilter && (
          <>
            <label className="field">
              <span>Operator</span>
              <select
                className="select"
                value={form.filterOperator}
                onChange={set('filterOperator')}
              >
                {FILTER_OPERATORS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Filter Value</span>
              <input
                className="input"
                value={form.filterValue}
                onChange={set('filterValue')}
                placeholder="e.g. bug"
                required
              />
            </label>
          </>
        )}

        <label className="field">
          <span>Action</span>
          <select
            className="select"
            value={form.actionType}
            onChange={set('actionType')}
          >
            {ACTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>{ACTION_VALUE_LABEL[form.actionType] ?? 'Value'}</span>
          <input
            className="input"
            value={form.actionValue}
            onChange={set('actionValue')}
            placeholder={
              form.actionType === 'SEND_SLACK' ? 'e.g. New issue opened' : 'e.g. triage'
            }
            required={form.actionType === 'ADD_LABEL'}
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button
          className="btn btn-primary btn-block"
          type="submit"
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Create Rule'}
        </button>
      </form>
    </section>
  )
}

function RuleList({ rules, onDelete }) {
  if (!rules.length) {
    return (
      <section className="card">
        <h2>Rules</h2>
        <p className="muted">No rules yet.</p>
      </section>
    )
  }

  return (
    <section className="card">
      <h2>Rules</h2>
      <div className="rules">
        {rules.map((rule) => (
          <div className="rule" key={rule.id}>
            <button
              className="rule-delete"
              onClick={() => onDelete(rule.id)}
              aria-label="Delete rule"
              title="Delete rule"
            >
              ×
            </button>
            <div className="rule-step">
              <span className="tag">When</span>
              <div>
                <div className="rule-title">{labelOf(EVENTS, rule.event)}</div>
                <div className="muted">
                  {rule.filterField
                    ? `${labelOf(FILTER_FIELDS, rule.filterField)} ${labelOf(
                        FILTER_OPERATORS,
                        rule.filterOperator,
                      ).toLowerCase()} “${rule.filterValue}”`
                    : 'Any event'}
                </div>
              </div>
            </div>
            <div className="arrow">↓</div>
            <div className="rule-step">
              <span className="tag tag-action">Then</span>
              <div>
                <div className="rule-title">
                  {labelOf(ACTIONS, rule.actionType)}
                </div>
                {rule.actionValue && (
                  <div className="muted">“{rule.actionValue}”</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function ActivityList({ executions, onRefresh }) {
  return (
    <section className="card">
      <div className="card-head">
        <h2>Activity</h2>
        <button className="btn btn-ghost" onClick={onRefresh}>
          Refresh
        </button>
      </div>

      {executions.length === 0 ? (
        <p className="muted">
          No activity yet. When a rule runs, it will show up here.
        </p>
      ) : (
        <div className="activity">
          {executions.map((execution) => (
            <div className="activity-item" key={execution.id}>
              <span
                className={
                  execution.status === 'SUCCESS'
                    ? 'activity-icon ok'
                    : 'activity-icon fail'
                }
                title={execution.status}
              >
                {execution.status === 'SUCCESS' ? '✓' : '✕'}
              </span>
              <div className="activity-body">
                <div>
                  {describeAction(execution)}
                  {' on '}
                  {execution.targetUrl ? (
                    <a
                      href={execution.targetUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {execution.target}
                    </a>
                  ) : (
                    <span>{execution.target}</span>
                  )}
                </div>
                {execution.status === 'FAILED' && execution.error && (
                  <div className="activity-error">{execution.error}</div>
                )}
              </div>
              <span className="activity-time">
                {timeAgo(execution.createdAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function SlackSettings({ initialUrl }) {
  const [url, setUrl] = useState(initialUrl ?? '')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setStatus(null)
    try {
      const me = await api.updateSlackWebhookUrl(url.trim())
      setUrl(me.slackWebhookUrl ?? '')
      setStatus({
        type: 'ok',
        message: me.slackWebhookUrl
          ? 'Connected — a test message was sent to your Slack.'
          : 'Slack disconnected.',
      })
    } catch (err) {
      setStatus({ type: 'error', message: err.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="card">
      <h2>Settings</h2>
      <form onSubmit={handleSubmit} className="form">
        <label className="field">
          <span>Slack Incoming Webhook URL</span>
          <input
            className="input"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://hooks.slack.com/services/..."
          />
        </label>
        <p className="muted">
          Used by <strong>Send Slack</strong> rules. Saving sends a test message
          to confirm it works. Leave empty to disable.
        </p>
        {status && (
          <p className={status.type === 'ok' ? 'connected' : 'error'}>
            {status.message}
          </p>
        )}
        <button
          className="btn btn-primary btn-block"
          type="submit"
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </form>
    </section>
  )
}
