import { useState, useEffect, useRef } from "preact/hooks";
import { I18nProvider } from "../../shared/i18n/context";
import { ThemeProvider } from "../../shared/theme/context";
import { Header } from "./components/Header";
import { UpdateModal } from "./components/UpdateModal";
import { AccountList } from "./components/AccountList";
import { AddAccount } from "./components/AddAccount";
import { ProxyPool } from "./components/ProxyPool";
import { ApiConfig } from "./components/ApiConfig";
import { AnthropicSetup } from "./components/AnthropicSetup";
import { CodeExamples } from "./components/CodeExamples";
import { SettingsPanel } from "./components/SettingsPanel";
import { TestConnection } from "./components/TestConnection";
import { Footer } from "./components/Footer";
import { ProxySettings } from "./pages/ProxySettings";
import { useAccounts } from "../../shared/hooks/use-accounts";
import { useProxies } from "../../shared/hooks/use-proxies";
import { useStatus } from "../../shared/hooks/use-status";
import { useUpdateStatus } from "../../shared/hooks/use-update-status";
import { bearerFetch, clearStoredAdminApiKey, getStoredAdminApiKey, setStoredAdminApiKey } from "../../shared/utils/admin-auth";
import { useI18n } from "../../shared/i18n/context";

function useUpdateMessage() {
  const { t } = useI18n();
  const update = useUpdateStatus();

  let msg: string | null = null;
  let color = "text-primary";

  if (!update.checking && update.result) {
    const parts: string[] = [];
    const r = update.result;

    if (r.proxy?.error) {
      parts.push(`Proxy: ${r.proxy.error}`);
      color = "text-red-500";
    } else if (r.proxy?.update_available) {
      parts.push(t("updateAvailable"));
      color = "text-amber-500";
    }

    if (r.codex?.error) {
      parts.push(`Codex: ${r.codex.error}`);
      color = "text-red-500";
    } else if (r.codex_update_in_progress) {
      parts.push(t("fingerprintUpdating"));
    } else if (r.codex?.version_changed) {
      parts.push(`Codex: v${r.codex.current_version}`);
      color = "text-blue-500";
    }

    msg = parts.length > 0 ? parts.join(" · ") : t("upToDate");
  } else if (!update.checking && update.error) {
    msg = update.error;
    color = "text-red-500";
  }

  const hasUpdate = update.status?.proxy.update_available ?? false;
  const proxyUpdateInfo = hasUpdate
    ? {
        mode: update.status!.proxy.mode,
        commits: update.status!.proxy.commits,
        release: update.status!.proxy.release,
      }
    : null;

  return { ...update, msg, color, hasUpdate, proxyUpdateInfo };
}

function DashboardContent({ onAdminLogout }: { onAdminLogout: () => void }) {
  const accounts = useAccounts();
  const proxies = useProxies();
  const status = useStatus(accounts.list.length);
  const update = useUpdateMessage();
  const [showModal, setShowModal] = useState(false);
  const prevUpdateAvailable = useRef(false);

  useEffect(() => {
    if (update.hasUpdate && !prevUpdateAvailable.current) {
      setShowModal(true);
    }
    prevUpdateAvailable.current = update.hasUpdate;
  }, [update.hasUpdate]);

  const handleProxyChange = async (accountId: string, proxyId: string) => {
    accounts.patchLocal(accountId, { proxyId });
    await proxies.assignProxy(accountId, proxyId);
  };

  return (
    <>
      <Header
        onAddAccount={accounts.startAdd}
        onCheckUpdate={update.checkForUpdate}
        onOpenUpdateModal={() => setShowModal(true)}
        onAdminLogout={onAdminLogout}
        checking={update.checking}
        updateStatusMsg={update.msg}
        updateStatusColor={update.color}
        version={update.status?.proxy.version ?? null}
        commit={update.status?.proxy.commit ?? null}
        hasUpdate={update.hasUpdate}
      />
      <main class="flex-grow px-4 md:px-8 lg:px-40 py-8 flex justify-center">
        <div class="flex flex-col w-full max-w-[960px] gap-6">
          <AddAccount
            visible={accounts.addVisible}
            onSubmitRelay={accounts.submitRelay}
            addInfo={accounts.addInfo}
            addError={accounts.addError}
          />
          <AccountList
            accounts={accounts.list}
            loading={accounts.loading}
            onDelete={accounts.deleteAccount}
            onRefresh={accounts.refresh}
            refreshing={accounts.refreshing}
            lastUpdated={accounts.lastUpdated}
            proxies={proxies.proxies}
            onProxyChange={handleProxyChange}
          />
          <ProxyPool proxies={proxies} />
          <ApiConfig
            baseUrl={status.baseUrl}
            apiKey={status.apiKey}
            models={status.models}
            selectedModel={status.selectedModel}
            onModelChange={status.setSelectedModel}
            modelFamilies={status.modelFamilies}
            selectedEffort={status.selectedEffort}
            onEffortChange={status.setSelectedEffort}
            selectedSpeed={status.selectedSpeed}
            onSpeedChange={status.setSelectedSpeed}
          />
          <AnthropicSetup
            apiKey={status.apiKey}
            selectedModel={status.selectedModel}
            reasoningEffort={status.selectedEffort}
            serviceTier={status.selectedSpeed}
          />
          <CodeExamples
            baseUrl={status.baseUrl}
            apiKey={status.apiKey}
            model={status.selectedModel}
            reasoningEffort={status.selectedEffort}
            serviceTier={status.selectedSpeed}
          />
          <SettingsPanel />
          <TestConnection />
        </div>
      </main>
      <Footer updateStatus={update.status} />
      {update.proxyUpdateInfo && (
        <UpdateModal
          open={showModal}
          onClose={() => setShowModal(false)}
          mode={update.proxyUpdateInfo.mode}
          commits={update.proxyUpdateInfo.commits}
          release={update.proxyUpdateInfo.release}
          onApply={update.applyUpdate}
          applying={update.applying}
          restarting={update.restarting}
          restartFailed={update.restartFailed}
        />
      )}
    </>
  );
}

function AdminLogin({
  checking,
  error,
  onSubmit,
}: {
  checking: boolean;
  error: string | null;
  onSubmit: (key: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");

  return (
    <div class="min-h-screen bg-slate-50 dark:bg-bg-dark text-slate-900 dark:text-text-main flex items-center justify-center px-4">
      <div class="w-full max-w-md rounded-2xl border border-gray-200 dark:border-border-dark bg-white dark:bg-card-dark shadow-xl p-6">
        <div class="flex items-center gap-3 mb-6">
          <div class="flex items-center justify-center size-10 rounded-full bg-primary/10 text-primary border border-primary/20">
            <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2.25m6.364-8.614a9 9 0 11-12.728 0 9 9 0 0112.728 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 10-6 0c0 .928.42 1.757 1.08 2.307.53.441.92 1.063.92 1.743v.45h2v-.45c0-.68.39-1.302.92-1.743A2.99 2.99 0 0015 10.5z" />
            </svg>
          </div>
          <div>
            <h1 class="text-xl font-bold tracking-tight">Codex Proxy Admin</h1>
            <p class="text-sm text-slate-500 dark:text-text-dim">Use your ADMIN_API_KEY to unlock the management console.</p>
          </div>
        </div>

        <form
          class="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            await onSubmit(value);
          }}
        >
          <div>
            <label class="block text-sm font-medium mb-2">Admin API Key</label>
            <input
              type="password"
              value={value}
              onInput={(e) => setValue((e.target as HTMLInputElement).value)}
              class="w-full rounded-xl border border-gray-200 dark:border-border-dark bg-white dark:bg-bg-dark px-4 py-3 outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="Enter ADMIN_API_KEY"
              autoComplete="current-password"
            />
          </div>
          {error && (
            <div class="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={checking || !value.trim()}
            class="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {checking ? "Verifying..." : "Unlock Console"}
          </button>
        </form>

        <p class="mt-4 text-xs text-slate-500 dark:text-text-dim">
          This key is stored only in your current browser so the admin UI can call protected routes.
        </p>
      </div>
    </div>
  );
}

function useHash(): string {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const handler = () => setHash(location.hash);
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  return hash;
}

export function App() {
  const hash = useHash();
  const isProxySettings = hash === "#/proxy-settings";
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [adminReady, setAdminReady] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  const verifyAdminKey = async (key: string, persist: boolean) => {
    setCheckingAdmin(true);
    setAdminError(null);
    try {
      const resp = await bearerFetch("/auth/status", key, { signal: AbortSignal.timeout(5000) });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error((data as { error?: string }).error ?? `HTTP ${resp.status}`);
      }
      if (persist) {
        setStoredAdminApiKey(key);
      }
      setAdminReady(true);
    } catch (err) {
      if (persist) {
        clearStoredAdminApiKey();
      }
      setAdminReady(false);
      setAdminError(err instanceof Error ? err.message : "Invalid admin key");
    } finally {
      setCheckingAdmin(false);
    }
  };

  useEffect(() => {
    const stored = getStoredAdminApiKey();
    if (!stored) {
      setCheckingAdmin(false);
      setAdminReady(false);
      return;
    }
    verifyAdminKey(stored, false);
  }, []);

  const logoutAdmin = () => {
    clearStoredAdminApiKey();
    setAdminReady(false);
    setAdminError(null);
  };

  return (
    <I18nProvider>
      <ThemeProvider>
        {!adminReady ? (
          <AdminLogin
            checking={checkingAdmin}
            error={adminError}
            onSubmit={(key) => verifyAdminKey(key, true)}
          />
        ) : isProxySettings ? (
          <ProxySettingsPage onAdminLogout={logoutAdmin} />
        ) : (
          <DashboardContent onAdminLogout={logoutAdmin} />
        )}
      </ThemeProvider>
    </I18nProvider>
  );
}

function ProxySettingsPage({ onAdminLogout }: { onAdminLogout: () => void }) {
  const update = useUpdateMessage();

  return (
    <>
      <Header
        onAddAccount={() => { location.hash = ""; }}
        onCheckUpdate={update.checkForUpdate}
        onAdminLogout={onAdminLogout}
        checking={update.checking}
        updateStatusMsg={update.msg}
        updateStatusColor={update.color}
        version={update.status?.proxy.version ?? null}
        commit={update.status?.proxy.commit ?? null}
        isProxySettings
        hasUpdate={update.hasUpdate}
      />
      <ProxySettings />
    </>
  );
}
