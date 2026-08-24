"use client";

import {
  CalendarDays,
  Check,
  CircleAlert,
  Clock3,
  Copy,
  DatabaseZap,
  Edit3,
  ExternalLink,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Ticket,
  Trash2,
  UserCheck,
  UserMinus,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { BrowserProvider } from "ethers";
import {
  ChainEvent,
  DeploymentConfig,
  EthereumProvider,
  chainIdHex,
  createReadContract,
  createWriteContract,
  normalizeAddress,
  parseChainEvent,
  shortAddress,
} from "@/lib/eventManager";

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

type EventFilter = "active" | "registered" | "mine" | "all" | "deleted";
type FormState = {
  name: string;
  location: string;
  date: string;
  capacity: string;
};
type ToastState = { type: "success" | "error"; message: string } | null;

const EMPTY_FORM: FormState = {
  name: "",
  location: "",
  date: "",
  capacity: "",
};

const DEFAULT_DEPLOYMENT: DeploymentConfig = {
  contractAddress: "",
  chainId: 31337,
  networkName: "localhost",
  deployedAt: "",
};

const NETWORK_NAMES: Record<number, string> = {
  1: "Ethereum Mainnet",
  11155111: "Sepolia",
  31337: "Hardhat Local",
};

function localDateTimeValue(timestamp?: bigint) {
  const date = timestamp
    ? new Date(Number(timestamp) * 1000)
    : new Date(Date.now() + 24 * 60 * 60 * 1000);
  if (!timestamp) date.setHours(18, 0, 0, 0);

  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDate(timestamp: bigint) {
  return new Intl.DateTimeFormat("sr-Latn-RS", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(Number(timestamp) * 1000));
}

function errorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: number })?.code;

  if (code === 4001 || raw.includes("user rejected")) {
    return "Transakcija je otkazana u MetaMask-u.";
  }
  if (raw.includes("NotOrganizer")) {
    return "Samo organizator koji je kreirao događaj može da ga menja.";
  }
  if (raw.includes("InvalidEventDate")) {
    return "Datum događaja mora biti u budućnosti.";
  }
  if (raw.includes("InvalidCapacity")) {
    return "Kapacitet mora biti veći od nule.";
  }
  if (raw.includes("EmptyField")) {
    return "Naziv i lokacija su obavezni.";
  }
  if (raw.includes("TextTooLong")) {
    return "Naziv ili lokacija su duži od dozvoljenog.";
  }
  if (raw.includes("EventAlreadyDeleted")) {
    return "Ovaj događaj je već deaktiviran.";
  }
  if (raw.includes("AlreadyRegistered")) {
    return "Već si prijavljen na ovaj događaj.";
  }
  if (raw.includes("NotRegistered")) {
    return "Nisi prijavljen na ovaj događaj.";
  }
  if (raw.includes("EventFull")) {
    return "Nema više slobodnih mesta na ovom događaju.";
  }
  if (raw.includes("RegistrationClosed")) {
    return "Prijave za ovaj događaj su zatvorene.";
  }
  if (raw.includes("OrganizerCannotRegister")) {
    return "Organizator ne može da rezerviše mesto na svom događaju.";
  }
  if (raw.includes("CapacityBelowRegistrations")) {
    return "Kapacitet ne može biti manji od trenutnog broja prijavljenih.";
  }
  if (raw.includes("could not decode") || raw.includes("BAD_DATA")) {
    return "Na unetoj adresi nije pronađen odgovarajući EventManager ugovor.";
  }
  return "Došlo je do greške. Proveri mrežu, adresu ugovora i stanje MetaMask-a.";
}

export default function Home() {
  const [deployment, setDeployment] =
    useState<DeploymentConfig>(DEFAULT_DEPLOYMENT);
  const [contractAddress, setContractAddress] = useState("");
  const [addressDraft, setAddressDraft] = useState("");
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState<number | null>(null);
  const [events, setEvents] = useState<ChainEvent[]>([]);
  const [filter, setFilter] = useState<EventFilter>("active");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ChainEvent | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<ChainEvent | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [copied, setCopied] = useState(false);
  const [hasMetaMask, setHasMetaMask] = useState(false);
  const [registeredEventIds, setRegisteredEventIds] = useState<Set<string>>(
    new Set(),
  );
  const [currentTimestamp, setCurrentTimestamp] = useState(0);

  const validContract = Boolean(normalizeAddress(contractAddress));
  const networkMismatch =
    chainId !== null && deployment.chainId !== 0 && chainId !== deployment.chainId;
  const ready = hasMetaMask && Boolean(account) && validContract && !networkMismatch;

  const showToast = useCallback((nextToast: ToastState) => {
    setToast(nextToast);
    window.setTimeout(() => setToast(null), 4200);
  }, []);

  const refreshEvents = useCallback(
    async (addressOverride?: string) => {
      const address = normalizeAddress(addressOverride ?? contractAddress);
      if (!window.ethereum || !address) return;

      setLoading(true);
      try {
        const provider = new BrowserProvider(window.ethereum, "any");
        const network = await provider.getNetwork();
        setChainId(Number(network.chainId));
        if (Number(network.chainId) !== deployment.chainId) return;

        const contract = createReadContract(provider, address);
        const rawEvents = (await contract.getAllEvents()) as unknown[];
        const parsed = rawEvents
          .map(parseChainEvent)
          .sort((a, b) => Number(b.date - a.date));
        setEvents(parsed);

        const nextRegisteredIds = new Set<string>();
        const registrationStates = await Promise.all(
          parsed.map((eventItem) =>
            contract.isRegistered(eventItem.id, account) as Promise<boolean>,
          ),
        );
        parsed.forEach((eventItem, index) => {
          if (registrationStates[index]) {
            nextRegisteredIds.add(eventItem.id.toString());
          }
        });
        setRegisteredEventIds(nextRegisteredIds);
      } catch (error) {
        setEvents([]);
        setRegisteredEventIds(new Set());
        showToast({ type: "error", message: errorMessage(error) });
      } finally {
        setLoading(false);
      }
    },
    [account, contractAddress, deployment.chainId, showToast],
  );

  useEffect(() => {
    const updateTimestamp = () =>
      setCurrentTimestamp(Math.floor(Date.now() / 1000));
    updateTimestamp();
    const timer = window.setInterval(updateTimestamp, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      let config = DEFAULT_DEPLOYMENT;
      try {
        const response = await fetch("/deployment.json", { cache: "no-store" });
        if (response.ok) config = (await response.json()) as DeploymentConfig;
      } catch {
        // The empty default keeps the setup screen usable before deployment.
      }

      if (cancelled) return;
      setDeployment(config);

      const stored = window.localStorage.getItem("eventchain-contract") ?? "";
      const envAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "";
      const initialAddress = normalizeAddress(
        stored || envAddress || config.contractAddress,
      );
      setContractAddress(initialAddress);
      setAddressDraft(initialAddress);

      setHasMetaMask(Boolean(window.ethereum));
      if (!window.ethereum) return;
      try {
        const accounts = (await window.ethereum.request({
          method: "eth_accounts",
        })) as string[];
        const currentChain = (await window.ethereum.request({
          method: "eth_chainId",
        })) as string;
        setAccount(accounts[0] ?? "");
        setChainId(Number.parseInt(currentChain, 16));
      } catch {
        // MetaMask may be locked; the connect button will request access.
      }
    }

    void initialize();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!account || !validContract || networkMismatch) return;
    const timer = window.setTimeout(() => void refreshEvents(), 0);
    return () => window.clearTimeout(timer);
  }, [account, validContract, networkMismatch, refreshEvents]);

  useEffect(() => {
    const ethereum = window.ethereum;
    if (!ethereum?.on) return;

    const accountsChanged = (...args: unknown[]) => {
      const accounts = (args[0] ?? []) as string[];
      setAccount(accounts[0] ?? "");
      setRegisteredEventIds(new Set());
    };
    const chainChanged = (...args: unknown[]) => {
      const nextChain = String(args[0] ?? "0x0");
      setChainId(Number.parseInt(nextChain, 16));
      setEvents([]);
      setRegisteredEventIds(new Set());
    };

    ethereum.on("accountsChanged", accountsChanged);
    ethereum.on("chainChanged", chainChanged);
    return () => {
      ethereum.removeListener?.("accountsChanged", accountsChanged);
      ethereum.removeListener?.("chainChanged", chainChanged);
    };
  }, []);

  const myEvents = useMemo(
    () =>
      events.filter(
        (eventItem) =>
          account && eventItem.organizer.toLowerCase() === account.toLowerCase(),
      ),
    [account, events],
  );

  const visibleEvents = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("sr");
    return events.filter((eventItem) => {
      const isMine =
        account && eventItem.organizer.toLowerCase() === account.toLowerCase();
      const isRegistered = registeredEventIds.has(eventItem.id.toString());
      const matchesFilter =
        filter === "all" ||
        (filter === "active" && eventItem.active) ||
        (filter === "registered" && isRegistered) ||
        (filter === "mine" && isMine) ||
        (filter === "deleted" && !eventItem.active);
      const matchesSearch =
        !query ||
        eventItem.name.toLocaleLowerCase("sr").includes(query) ||
        eventItem.location.toLocaleLowerCase("sr").includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [account, events, filter, registeredEventIds, search]);

  async function connectWallet() {
    if (!window.ethereum) {
      showToast({
        type: "error",
        message: "MetaMask nije instaliran. Instaliraj ekstenziju i osveži stranicu.",
      });
      return;
    }

    try {
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];
      const currentChain = (await window.ethereum.request({
        method: "eth_chainId",
      })) as string;
      setAccount(accounts[0] ?? "");
      setRegisteredEventIds(new Set());
      setChainId(Number.parseInt(currentChain, 16));
    } catch (error) {
      showToast({ type: "error", message: errorMessage(error) });
    }
  }

  async function switchNetwork() {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainIdHex(deployment.chainId) }],
      });
    } catch (error) {
      const code = (error as { code?: number })?.code;
      if (code === 4902 && deployment.chainId === 31337) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: chainIdHex(31337),
                chainName: "Hardhat Local",
                nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
                rpcUrls: ["http://127.0.0.1:8545"],
              },
            ],
          });
          return;
        } catch (addError) {
          showToast({ type: "error", message: errorMessage(addError) });
          return;
        }
      }
      showToast({ type: "error", message: errorMessage(error) });
    }
  }

  function openCreateForm() {
    setEditingEvent(null);
    setForm({ ...EMPTY_FORM, date: localDateTimeValue() });
    setFormOpen(true);
  }

  function openEditForm(eventItem: ChainEvent) {
    setEditingEvent(eventItem);
    setForm({
      name: eventItem.name,
      location: eventItem.location,
      date: localDateTimeValue(eventItem.date),
      capacity: eventItem.capacity.toString(),
    });
    setFormOpen(true);
  }

  async function submitEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!window.ethereum || !ready) return;

    const date = Math.floor(new Date(form.date).getTime() / 1000);
    const capacity = Number.parseInt(form.capacity, 10);
    if (!form.name.trim() || !form.location.trim() || !date || capacity < 1) {
      showToast({ type: "error", message: "Popuni sva polja ispravnim vrednostima." });
      return;
    }
    if (date <= Math.floor(Date.now() / 1000)) {
      showToast({ type: "error", message: "Datum događaja mora biti u budućnosti." });
      return;
    }

    setPendingAction(editingEvent ? `edit-${editingEvent.id}` : "create");
    try {
      const provider = new BrowserProvider(window.ethereum, "any");
      const contract = await createWriteContract(provider, contractAddress);
      const transaction = editingEvent
        ? await contract.updateEvent(
            editingEvent.id,
            form.name.trim(),
            form.location.trim(),
            BigInt(date),
            BigInt(capacity),
          )
        : await contract.createEvent(
            form.name.trim(),
            form.location.trim(),
            BigInt(date),
            BigInt(capacity),
          );
      await transaction.wait();
      setFormOpen(false);
      setForm(EMPTY_FORM);
      await refreshEvents();
      showToast({
        type: "success",
        message: editingEvent
          ? "Događaj je uspešno izmenjen na blokčejnu."
          : "Događaj je uspešno upisan na blokčejn.",
      });
    } catch (error) {
      showToast({ type: "error", message: errorMessage(error) });
    } finally {
      setPendingAction("");
    }
  }

  async function confirmDelete() {
    if (!window.ethereum || !deletingEvent || !ready) return;
    setPendingAction(`delete-${deletingEvent.id}`);
    try {
      const provider = new BrowserProvider(window.ethereum, "any");
      const contract = await createWriteContract(provider, contractAddress);
      const transaction = await contract.deleteEvent(deletingEvent.id);
      await transaction.wait();
      setDeletingEvent(null);
      await refreshEvents();
      showToast({
        type: "success",
        message: "Događaj je deaktiviran, a istorijski zapis je sačuvan.",
      });
    } catch (error) {
      showToast({ type: "error", message: errorMessage(error) });
    } finally {
      setPendingAction("");
    }
  }

  async function changeRegistration(
    eventItem: ChainEvent,
    register: boolean,
  ) {
    if (!window.ethereum || !ready) return;

    const action = register ? "register" : "cancel-registration";
    setPendingAction(`${action}-${eventItem.id}`);
    try {
      const provider = new BrowserProvider(window.ethereum, "any");
      const contract = await createWriteContract(provider, contractAddress);
      const transaction = register
        ? await contract.registerForEvent(eventItem.id)
        : await contract.cancelRegistration(eventItem.id);
      await transaction.wait();
      await refreshEvents();
      showToast({
        type: "success",
        message: register
          ? `Uspešno si se prijavio na „${eventItem.name}“.`
          : `Prijava za „${eventItem.name}“ je otkazana.`,
      });
    } catch (error) {
      showToast({ type: "error", message: errorMessage(error) });
    } finally {
      setPendingAction("");
    }
  }

  function saveContractAddress() {
    const address = normalizeAddress(addressDraft);
    if (!address) {
      showToast({ type: "error", message: "Unesi ispravnu Ethereum adresu ugovora." });
      return;
    }
    window.localStorage.setItem("eventchain-contract", address);
    setContractAddress(address);
    setSettingsOpen(false);
    setEvents([]);
    void refreshEvents(address);
    showToast({ type: "success", message: "Adresa ugovora je sačuvana u pregledaču." });
  }

  async function copyContractAddress() {
    if (!contractAddress) return;
    await navigator.clipboard.writeText(contractAddress);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  const connectionMessage = !hasMetaMask
    ? "MetaMask nije pronađen"
    : !account
      ? "Poveži novčanik"
      : !validContract
        ? "Unesi adresu ugovora"
        : networkMismatch
          ? "Promeni Ethereum mrežu"
          : "Aplikacija je spremna";

  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="EventChain početna">
          <span className="brand-mark"><DatabaseZap size={19} strokeWidth={2.2} /></span>
          <span>EventChain</span>
        </a>
        <div className="topbar-actions">
          <button
            className="icon-button"
            type="button"
            onClick={() => setSettingsOpen((value) => !value)}
            aria-label="Podešavanje ugovora"
            title="Podešavanje ugovora"
          >
            <Settings2 size={18} />
          </button>
          <button className="wallet-button" type="button" onClick={connectWallet}>
            <Wallet size={17} />
            {account ? shortAddress(account) : "Poveži MetaMask"}
          </button>
        </div>
      </header>

      {settingsOpen && (
        <section className="settings-panel" aria-label="Adresa pametnog ugovora">
          <div>
            <p className="settings-label">Pametni ugovor</p>
            <p className="settings-copy">
              Deployment skripta ovo polje popunjava automatski. Adresu možeš i ručno da promeniš.
            </p>
          </div>
          <div className="address-editor">
            <input
              value={addressDraft}
              onChange={(event) => setAddressDraft(event.target.value)}
              placeholder="0x..."
              aria-label="Adresa pametnog ugovora"
            />
            <button type="button" onClick={saveContractAddress}>Sačuvaj</button>
          </div>
        </section>
      )}

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><span /> On-chain registar događaja</p>
          <h1>Događaji koje ne drži jedna baza.</h1>
          <p className="hero-lead">
            Kreiraj događaj, rezerviši svoje mesto i prati popunjenost direktno
            na Ethereum mreži. Svaku promenu potvrđuje tvoj MetaMask novčanik.
          </p>
          <div className="hero-actions">
            <button className="primary-button" type="button" onClick={openCreateForm} disabled={!ready}>
              <Plus size={18} /> Novi događaj
            </button>
            <button className="secondary-button" type="button" onClick={() => void refreshEvents()} disabled={!ready || loading}>
              <RefreshCw size={17} className={loading ? "spin" : ""} /> Osveži podatke
            </button>
          </div>
          {!ready && <p className="setup-hint"><CircleAlert size={15} /> {connectionMessage}</p>}
        </div>

        <aside className="connection-card">
          <div className="connection-heading">
            <span>STATUS SISTEMA</span>
            <span className={`live-dot ${ready ? "online" : ""}`} />
          </div>
          <div className="connection-row">
            <span className="connection-icon"><Wallet size={18} /></span>
            <div><small>Novčanik</small><strong>{account ? shortAddress(account) : "Nije povezan"}</strong></div>
            {account && <Check size={17} className="status-check" />}
          </div>
          <div className="connection-row">
            <span className="connection-icon"><ShieldCheck size={18} /></span>
            <div><small>Mreža</small><strong>{chainId ? NETWORK_NAMES[chainId] ?? `Chain ${chainId}` : "Nije dostupna"}</strong></div>
            {networkMismatch && <button className="inline-action" type="button" onClick={switchNetwork}>Promeni</button>}
          </div>
          <div className="connection-row contract-row">
            <span className="connection-icon"><DatabaseZap size={18} /></span>
            <div><small>Ugovor</small><strong>{validContract ? shortAddress(contractAddress) : "Nije postavljen"}</strong></div>
            {validContract && (
              <button className="copy-button" type="button" onClick={copyContractAddress} aria-label="Kopiraj adresu ugovora">
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            )}
          </div>
          <div className="connection-footer">
            <span>Mreža ugovora</span>
            <strong>{NETWORK_NAMES[deployment.chainId] ?? deployment.networkName}</strong>
          </div>
        </aside>
      </section>

      <section className="stats" aria-label="Statistika događaja">
        <article><span className="stat-icon"><Ticket size={19} /></span><div><strong>{events.length}</strong><small>Ukupno zapisa</small></div></article>
        <article><span className="stat-icon"><CalendarDays size={19} /></span><div><strong>{events.filter((item) => item.active).length}</strong><small>Aktivnih događaja</small></div></article>
        <article><span className="stat-icon"><Users size={19} /></span><div><strong>{myEvents.length}</strong><small>Mojih događaja</small></div></article>
        <article><span className="stat-icon"><UserCheck size={19} /></span><div><strong>{registeredEventIds.size}</strong><small>Mojih prijava</small></div></article>
      </section>

      <section className="registry-section">
        <div className="section-heading">
          <div><p className="section-kicker">JAVNI REGISTAR</p><h2>Događaji na mreži</h2></div>
          <div className="search-box"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pretraži naziv ili lokaciju" aria-label="Pretraži događaje" /></div>
        </div>

        <div className="filter-tabs" role="tablist" aria-label="Filtriranje događaja">
          {([
            ["active", "Aktivni"],
            ["registered", "Moje prijave"],
            ["mine", "Moji događaji"],
            ["all", "Svi zapisi"],
            ["deleted", "Deaktivirani"],
          ] as [EventFilter, string][]).map(([value, label]) => (
            <button key={value} type="button" className={filter === value ? "active" : ""} onClick={() => setFilter(value)} role="tab" aria-selected={filter === value}>{label}</button>
          ))}
        </div>

        {!ready ? (
          <div className="empty-state">
            <span><Wallet size={27} /></span>
            <h3>Poveži aplikaciju sa blokčejnom</h3>
            <p>Pokreni lokalnu mrežu i ugovor, zatim poveži MetaMask da bi učitao događaje.</p>
            {!account ? (
              <button type="button" onClick={connectWallet}>Poveži MetaMask</button>
            ) : networkMismatch ? (
              <button type="button" onClick={switchNetwork}>Promeni mrežu</button>
            ) : !validContract ? (
              <button type="button" onClick={() => setSettingsOpen(true)}>Unesi adresu ugovora</button>
            ) : null}
          </div>
        ) : loading ? (
          <div className="loading-state"><Loader2 size={25} className="spin" /><span>Čitanje podataka sa mreže…</span></div>
        ) : visibleEvents.length === 0 ? (
          <div className="empty-state">
            <span><CalendarDays size={27} /></span>
            <h3>Nema događaja u ovom prikazu</h3>
            <p>{events.length ? "Promeni filter ili izraz za pretragu." : "Kreiraj prvi događaj i upiši ga na blokčejn."}</p>
            {!events.length && <button type="button" onClick={openCreateForm}><Plus size={17} /> Kreiraj prvi događaj</button>}
          </div>
        ) : (
          <div className="event-grid">
            {visibleEvents.map((eventItem) => {
              const owned = account.toLowerCase() === eventItem.organizer.toLowerCase();
              const registered = registeredEventIds.has(eventItem.id.toString());
              const full = eventItem.registeredCount >= eventItem.capacity;
              const registrationClosed =
                currentTimestamp > 0 &&
                BigInt(currentTimestamp) >= eventItem.date;
              const registrationAction = registered
                ? `cancel-registration-${eventItem.id}`
                : `register-${eventItem.id}`;
              const registrationBusy = pendingAction === registrationAction;
              const occupancy = Math.min(
                100,
                Number(
                  (eventItem.registeredCount * 100n) / eventItem.capacity,
                ),
              );
              return (
                <article className={`event-card ${!eventItem.active ? "inactive" : ""}`} key={eventItem.id.toString()}>
                  <div className="card-topline">
                    <span className={`status-pill ${eventItem.active ? "active" : "inactive"}`}><span />{eventItem.active ? "Aktivan" : "Deaktiviran"}</span>
                    <span className="event-id">ID #{eventItem.id.toString().padStart(3, "0")}</span>
                  </div>
                  <h3>{eventItem.name}</h3>
                  <div className="event-meta">
                    <p><CalendarDays size={17} /><span>{formatDate(eventItem.date)}</span></p>
                    <p><MapPin size={17} /><span>{eventItem.location}</span></p>
                    <p><Users size={17} /><span>Prijavljeno: {eventItem.registeredCount.toLocaleString("sr-RS")} / {eventItem.capacity.toLocaleString("sr-RS")}</span></p>
                  </div>
                  <div className="capacity-block">
                    <div className="capacity-copy">
                      <span>Popunjenost</span>
                      <strong>{(eventItem.capacity - eventItem.registeredCount).toLocaleString("sr-RS")} slobodnih mesta</strong>
                    </div>
                    <div className="capacity-track" role="progressbar" aria-label={`Popunjenost događaja ${eventItem.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={occupancy}>
                      <span style={{ width: `${occupancy}%` }} />
                    </div>
                  </div>
                  <div className="organizer-row">
                    <div className="avatar">{eventItem.organizer.slice(2, 4).toUpperCase()}</div>
                    <div><small>Organizator</small><strong>{owned ? "Vi" : shortAddress(eventItem.organizer)}</strong></div>
                    {owned && <span className="owner-badge">MOJ</span>}
                  </div>
                  {!owned && eventItem.active && (
                    <button
                      className={`registration-button ${registered ? "registered" : ""}`}
                      type="button"
                      onClick={() => void changeRegistration(eventItem, !registered)}
                      disabled={registrationBusy || registrationClosed || (full && !registered)}
                    >
                      {registrationBusy ? (
                        <Loader2 size={17} className="spin" />
                      ) : registered ? (
                        <UserMinus size={17} />
                      ) : (
                        <UserCheck size={17} />
                      )}
                      {registrationBusy
                        ? "Čeka se MetaMask…"
                        : registrationClosed
                          ? "Prijave su zatvorene"
                          : registered
                            ? "Otkaži prijavu"
                            : full
                              ? "Događaj je popunjen"
                              : "Prijavi se"}
                    </button>
                  )}
                  <div className="card-footer">
                    <span><Clock3 size={14} /> Ažurirano {new Intl.DateTimeFormat("sr-Latn-RS", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(new Date(Number(eventItem.updatedAt) * 1000))}</span>
                    {owned && eventItem.active && (
                      <div className="card-actions">
                        <button type="button" onClick={() => openEditForm(eventItem)} aria-label={`Izmeni ${eventItem.name}`}><Edit3 size={16} /></button>
                        <button className="danger" type="button" onClick={() => setDeletingEvent(eventItem)} aria-label={`Deaktiviraj ${eventItem.name}`}><Trash2 size={16} /></button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="how-it-works">
        <div><p className="section-kicker">KAKO RADI</p><h2>Tri koraka. Jedan proverljiv zapis.</h2></div>
        <ol>
          <li><span>01</span><div><strong>Poveži novčanik</strong><p>MetaMask predstavlja tvoj identitet i potpisuje zahteve.</p></div></li>
          <li><span>02</span><div><strong>Rezerviši mesto</strong><p>Prijava i otkazivanje prolaze kroz MetaMask transakciju.</p></div></li>
          <li><span>03</span><div><strong>Mreža čuva stanje</strong><p>Ugovor proverava vlasništvo, duple prijave i kapacitet.</p></div></li>
        </ol>
      </section>

      <footer>
        <div className="brand footer-brand"><span className="brand-mark"><DatabaseZap size={18} /></span><span>EventChain</span></div>
        <p>Studentski Web3 projekat · Solidity · Hardhat · MetaMask · React</p>
        <a href="https://ethereum.org" target="_blank" rel="noreferrer">Ethereum <ExternalLink size={13} /></a>
      </footer>

      {formOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !pendingAction && setFormOpen(false)}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="event-form-title">
            <div className="modal-header">
              <div><p>{editingEvent ? "UPDATE" : "CREATE"}</p><h2 id="event-form-title">{editingEvent ? "Izmeni događaj" : "Novi događaj"}</h2></div>
              <button type="button" onClick={() => setFormOpen(false)} disabled={Boolean(pendingAction)} aria-label="Zatvori"><X size={20} /></button>
            </div>
            <form onSubmit={submitEvent}>
              <label><span>Naziv događaja</span><input required maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="npr. Blockchain konferencija 2026" /></label>
              <label><span>Lokacija</span><input required maxLength={120} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="npr. Novi Sad, Master centar" /></label>
              <div className="form-grid">
                <label><span>Datum i vreme</span><input required type="datetime-local" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label>
                <label>
                  <span>Kapacitet</span>
                  <input required type="number" min={editingEvent && editingEvent.registeredCount > 0n ? editingEvent.registeredCount.toString() : "1"} step="1" value={form.capacity} onChange={(event) => setForm({ ...form, capacity: event.target.value })} placeholder="250" />
                  {editingEvent && editingEvent.registeredCount > 0n && <small>Najmanje {editingEvent.registeredCount.toString()}, koliko već ima prijavljenih.</small>}
                </label>
              </div>
              <div className="transaction-note"><ShieldCheck size={18} /><p><strong>MetaMask potvrda je obavezna.</strong><span>Podaci će biti javno zapisani u pametnom ugovoru.</span></p></div>
              <div className="modal-actions">
                <button className="secondary-button" type="button" onClick={() => setFormOpen(false)} disabled={Boolean(pendingAction)}>Otkaži</button>
                <button className="primary-button" type="submit" disabled={Boolean(pendingAction)}>
                  {pendingAction ? <Loader2 size={18} className="spin" /> : editingEvent ? <Edit3 size={18} /> : <Plus size={18} />}
                  {pendingAction ? "Čeka se potvrda…" : editingEvent ? "Sačuvaj izmene" : "Kreiraj događaj"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {deletingEvent && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !pendingAction && setDeletingEvent(null)}>
          <section className="modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-title">
            <span className="danger-icon"><Trash2 size={24} /></span>
            <h2 id="delete-title">Deaktivirati događaj?</h2>
            <p><strong>{deletingEvent.name}</strong> više neće biti prikazan kao aktivan. Zapis se zbog nepromenljivosti blokčejna ne briše fizički.</p>
            <div className="modal-actions">
              <button className="secondary-button" type="button" onClick={() => setDeletingEvent(null)} disabled={Boolean(pendingAction)}>Odustani</button>
              <button className="danger-button" type="button" onClick={() => void confirmDelete()} disabled={Boolean(pendingAction)}>
                {pendingAction ? <Loader2 size={18} className="spin" /> : <Trash2 size={18} />} Deaktiviraj
              </button>
            </div>
          </section>
        </div>
      )}

      {toast && (
        <div className={`toast ${toast.type}`} role="status">
          {toast.type === "success" ? <Check size={18} /> : <CircleAlert size={18} />}
          <span>{toast.message}</span>
          <button type="button" onClick={() => setToast(null)} aria-label="Zatvori obaveštenje"><X size={15} /></button>
        </div>
      )}
    </main>
  );
}
