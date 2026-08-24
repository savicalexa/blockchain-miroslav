import { BrowserProvider, Contract, getAddress, isAddress } from "ethers";

export const EVENT_MANAGER_ABI = [
  "function createEvent(string name,string location,uint256 date,uint256 capacity) returns (uint256 id)",
  "function getEvent(uint256 id) view returns (tuple(uint256 id,string name,string location,uint256 date,uint256 capacity,uint256 registeredCount,address organizer,bool active,uint256 createdAt,uint256 updatedAt))",
  "function getAllEvents() view returns (tuple(uint256 id,string name,string location,uint256 date,uint256 capacity,uint256 registeredCount,address organizer,bool active,uint256 createdAt,uint256 updatedAt)[])",
  "function getActiveEvents() view returns (tuple(uint256 id,string name,string location,uint256 date,uint256 capacity,uint256 registeredCount,address organizer,bool active,uint256 createdAt,uint256 updatedAt)[])",
  "function getEventsByOrganizer(address organizer) view returns (tuple(uint256 id,string name,string location,uint256 date,uint256 capacity,uint256 registeredCount,address organizer,bool active,uint256 createdAt,uint256 updatedAt)[])",
  "function isRegistered(uint256 id,address attendee) view returns (bool)",
  "function registerForEvent(uint256 id)",
  "function cancelRegistration(uint256 id)",
  "function updateEvent(uint256 id,string name,string location,uint256 date,uint256 capacity)",
  "function deleteEvent(uint256 id)",
  "function nextEventId() view returns (uint256)",
  "event EventCreated(uint256 indexed id,address indexed organizer,string name,uint256 date)",
  "event EventUpdated(uint256 indexed id,address indexed organizer)",
  "event EventDeleted(uint256 indexed id,address indexed organizer)",
  "event AttendeeRegistered(uint256 indexed id,address indexed attendee)",
  "event RegistrationCancelled(uint256 indexed id,address indexed attendee)",
  "error EventDoesNotExist(uint256 id)",
  "error NotOrganizer(address caller)",
  "error EventAlreadyDeleted(uint256 id)",
  "error EmptyField()",
  "error TextTooLong()",
  "error InvalidEventDate()",
  "error InvalidCapacity()",
  "error AlreadyRegistered(uint256 id,address attendee)",
  "error NotRegistered(uint256 id,address attendee)",
  "error EventFull(uint256 id)",
  "error RegistrationClosed(uint256 id)",
  "error OrganizerCannotRegister(uint256 id)",
  "error CapacityBelowRegistrations(uint256 registeredCount)",
] as const;

export type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

export type DeploymentConfig = {
  contractAddress: string;
  chainId: number;
  networkName: string;
  deployedAt: string;
};

export type ChainEvent = {
  id: bigint;
  name: string;
  location: string;
  date: bigint;
  capacity: bigint;
  registeredCount: bigint;
  organizer: string;
  active: boolean;
  createdAt: bigint;
  updatedAt: bigint;
};

export function normalizeAddress(address: string) {
  return isAddress(address) ? getAddress(address) : "";
}

export function parseChainEvent(raw: unknown): ChainEvent {
  const item = raw as Record<string, unknown> & unknown[];
  return {
    id: BigInt(item.id ?? item[0]),
    name: String(item.name ?? item[1]),
    location: String(item.location ?? item[2]),
    date: BigInt(item.date ?? item[3]),
    capacity: BigInt(item.capacity ?? item[4]),
    registeredCount: BigInt(item.registeredCount ?? item[5]),
    organizer: String(item.organizer ?? item[6]),
    active: Boolean(item.active ?? item[7]),
    createdAt: BigInt(item.createdAt ?? item[8]),
    updatedAt: BigInt(item.updatedAt ?? item[9]),
  };
}

export function createReadContract(
  provider: BrowserProvider,
  contractAddress: string,
) {
  return new Contract(contractAddress, EVENT_MANAGER_ABI, provider);
}

export async function createWriteContract(
  provider: BrowserProvider,
  contractAddress: string,
) {
  const signer = await provider.getSigner();
  return new Contract(contractAddress, EVENT_MANAGER_ABI, signer);
}

export function shortAddress(address: string) {
  if (!address) return "";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function chainIdHex(chainId: number) {
  return `0x${chainId.toString(16)}`;
}
