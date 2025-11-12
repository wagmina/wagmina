import type {
  AddMinaChainParameter,
  Address,
  Chain,
  Client,
  ProviderConnectInfo,
  ProviderMessage,
} from 'vimina'

import type { Transport } from '../createConfig.js'
import type { Emitter } from '../createEmitter.js'
import type { Storage } from '../createStorage.js'
import type { Compute } from '../types/utils.js'

export type ConnectorEventMap = {
  change: {
    accounts?: readonly Address[] | undefined
    networkId?: string | undefined
  }
  connect: { accounts: readonly Address[]; networkId: string }
  disconnect: never
  error: { error: Error }
  message: { type: string; data?: unknown | undefined }
}

export type CreateConnectorFn<
  provider = unknown,
  properties extends Record<string, unknown> = Record<string, unknown>,
  storageItem extends Record<string, unknown> = Record<string, unknown>,
> = (config: {
  chains: readonly [Chain, ...Chain[]]
  emitter: Emitter<ConnectorEventMap>
  storage?: Compute<Storage<storageItem>> | null | undefined
  transports?: Record<number, Transport> | undefined
}) => Compute<
  {
    readonly icon?: string | undefined
    readonly id: string
    readonly name: string
    readonly supportsSimulation?: boolean | undefined
    readonly type: string

    setup?(): Promise<void>
    connect(
      parameters?:
        | {
            networkId?: string | undefined
            isReconnecting?: boolean | undefined
          }
        | undefined,
    ): Promise<{
      accounts: readonly Address[]
      networkId: string
    }>
    disconnect(): Promise<void>
    getAccounts(): Promise<readonly Address[]>
    getNetworkId(): Promise<string>
    getProvider(
      parameters?: { networkId?: string | undefined } | undefined,
    ): Promise<provider>
    getClient?(
      parameters?: { networkId?: string | undefined } | undefined,
    ): Promise<Client>
    isAuthorized(): Promise<boolean>
    switchChain?(
      parameters: Compute<{
        addMinaChainParameter?: AddMinaChainParameter | undefined
        networkId: string
      }>,
    ): Promise<Chain>

    onAccountsChanged(accounts: string[]): void
    onChainChanged(networkId: string): void
    onConnect?(connectInfo: ProviderConnectInfo): void
    onDisconnect(error?: Error | undefined): void
    onMessage?(message: ProviderMessage): void
  } & properties
>

export function createConnector<
  provider,
  properties extends Record<string, unknown> = Record<string, unknown>,
  storageItem extends Record<string, unknown> = Record<string, unknown>,
>(createConnectorFn: CreateConnectorFn<provider, properties, storageItem>) {
  return createConnectorFn
}
