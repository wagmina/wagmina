import {
  type Address,
  type JSAPIStandardRequestFn,
  RpcRequestError,
  SwitchChainError,
  type Transport,
  UserRejectedRequestError,
  type WalletRpcSchema,
  custom,
  getAddress,
} from 'vimina'
import { getKlesiaRpcClient } from 'vimina/utils'

import {
  ChainNotConfiguredError,
  ConnectorNotConnectedError,
} from '../errors/config.js'
import { createConnector } from './createConnector.js'

export type MockParameters = {
  accounts: readonly [Address, ...Address[]]
  features?:
    | {
        connectError?: boolean | Error | undefined
        switchChainError?: boolean | Error | undefined
        signMessageError?: boolean | Error | undefined
        signTypedDataError?: boolean | Error | undefined
        reconnect?: boolean | undefined
        watchAssetError?: boolean | Error | undefined
      }
    | undefined
}

mock.type = 'mock' as const

export function mock(parameters: MockParameters) {
  const features = parameters.features ?? {}

  type Provider = ReturnType<
    Transport<'custom', unknown, JSAPIStandardRequestFn<WalletRpcSchema>>
  >
  let connected = false
  let connectedNetworkId: string

  return createConnector<Provider>((config) => ({
    id: 'mock',
    name: 'Mock Connector',
    type: mock.type,
    async setup() {
      connectedNetworkId = config.chains[0].id
    },
    async connect({ networkId } = {}) {
      if (features.connectError) {
        if (typeof features.connectError === 'boolean')
          throw new UserRejectedRequestError(new Error('Failed to connect.'))
        throw features.connectError
      }

      const provider = await this.getProvider()
      const accounts = await provider.request({
        method: 'mina_requestAccounts',
      })

      let currentNetworkId = await this.getNetworkId()
      if (networkId && currentNetworkId !== networkId) {
        const chain = await this.switchChain!({ networkId })
        currentNetworkId = chain.id
      }

      connected = true

      return {
        accounts: accounts.map((x) => getAddress(x)),
        networkId: currentNetworkId,
      }
    },
    async disconnect() {
      connected = false
    },
    async getAccounts() {
      if (!connected) throw new ConnectorNotConnectedError()
      const provider = await this.getProvider()
      const accounts = await provider.request({ method: 'mina_accounts' })
      return accounts.map((x) => getAddress(x))
    },
    async getNetworkId() {
      const provider = await this.getProvider()
      return provider.request({ method: 'mina_networkId' })
    },
    async isAuthorized() {
      if (!features.reconnect) return false
      if (!connected) return false
      const accounts = await this.getAccounts()
      return !!accounts.length
    },
    async switchChain({ networkId }) {
      const provider = await this.getProvider()
      const chain = config.chains.find((x) => x.id === networkId)
      if (!chain) throw new SwitchChainError(new ChainNotConfiguredError())

      await provider.request({
        method: 'mina_switchChain',
        params: [networkId],
      })
      return chain
    },
    onAccountsChanged(accounts) {
      if (accounts.length === 0) this.onDisconnect()
      else
        config.emitter.emit('change', {
          accounts: accounts.map((x) => getAddress(x)),
        })
    },
    onChainChanged(networkId) {
      config.emitter.emit('change', { networkId })
    },
    async onDisconnect(_error) {
      config.emitter.emit('disconnect')
      connected = false
    },
    async getProvider({ networkId } = {}) {
      const chain =
        config.chains.find((x) => x.id === networkId) ?? config.chains[0]
      const url = chain.rpcUrls.default.http[0]!

      const request: JSAPIStandardRequestFn = async ({ method, params }) => {
        // mina methods
        if (method === 'mina_networkId') return connectedNetworkId
        if (method === 'mina_requestAccounts') return parameters.accounts

        // wallet methods
        if (method === 'mina_switchChain') {
          if (features.switchChainError) {
            if (typeof features.switchChainError === 'boolean')
              throw new UserRejectedRequestError(
                new Error('Failed to switch chain.'),
              )
            throw features.switchChainError
          }
          type Params = [{ networkId: string }]
          connectedNetworkId = (params as Params)[0].networkId
          this.onChainChanged(connectedNetworkId.toString())
          return
        }

        const body = { method, params }
        const { error, result } = await getKlesiaRpcClient(url).request({
          body,
        })
        if (error) throw new RpcRequestError({ body, error, url })

        return result
      }
      return custom({ request })({ retryCount: 0 })
    },
  }))
}
