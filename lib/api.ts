import express from 'express'
import {Express} from 'express'
import {paramCase} from 'param-case'

export const DEFAULT_NAME = 'default'
export const DEFAULT_PORT = 3000

export type IApiMountApiHandler = (args: {[name: string]: any}) => Promise<any>

export interface IApiMountApi {
  [name: string]: IApiMountApiHandler
}

export type IApiMountBeforeExecution = (
  method: string,
  implementation: IApiMountApiHandler,
) => boolean

export type IApiMountBeforeResponse = (
  response: any,
  error: boolean,
  method: string,
) => void

export type IApiMountAfterResponse = (
  response: any,
  error: boolean,
  method: string,
) => void

export interface IApiMountConfig {
  name?: string
  port?: number
  basePath?: string
  beforeExecution?: IApiMountBeforeExecution
  beforeResponse?: IApiMountBeforeResponse
  afterResponse?: IApiMountAfterResponse
}

export type IApiMountLauncher = (config: IApiMountConfig) => Express

interface IApiMountLaunchCache {
  [hash: string]: boolean
}

interface IApiMountAppCache {
  [hash: string]: Express
}

interface IApiMountAppLaunchCache {
  [hash: string]: IApiMountLauncher
}

const launched: IApiMountLaunchCache = {}
const app: IApiMountAppCache = {}

const launch: IApiMountAppLaunchCache = {
  [DEFAULT_NAME]: (config: IApiMountConfig) => {
    const newApp = express()
    newApp.listen(config.port)
    return newApp
  },
}

const performLaunch = (config: IApiMountConfig) => {
  if (!launched[config.name]) {
    app[config.name] = launch[config.name](config)
    launched[config.name] = true
  }
}

export const injectLaunchCode = (
  injectedLaunch: IApiMountLauncher,
  name: string = DEFAULT_NAME,
) => {
  launch[name] = injectedLaunch
}

export const apiFactory = (sharedConfig: IApiMountConfig = {}) => {
  sharedConfig = {
    name: DEFAULT_NAME,
    port: DEFAULT_PORT,
    basePath: '',
    ...sharedConfig,
  }

  return {
    exposeClassBasedApi(
      obj: IApiMountApi,
      config: IApiMountConfig = sharedConfig,
    ) {
      config = {
        ...sharedConfig,
        ...config,
      }

      const namespace = paramCase(obj.constructor.name)
      this.exposeApi(obj, {basePath: `${config.basePath}/${namespace}`})
    },
    exposeApi(api: IApiMountApi, config: IApiMountConfig = sharedConfig) {
      config = {
        ...sharedConfig,
        ...config,
      }

      const {name, basePath} = config

      Object.entries(api).forEach(([method, implementation]) => {
        app[name].get(`${basePath}/${paramCase(method)}`, (req, res) => {
          if (!(config?.beforeExecution(method, implementation) ?? true)) {
            return
          }

          let lastResponse: any
          let error = false

          implementation
            .call(api, req.query)
            .then((response: any) => {
              if (config.beforeResponse) {
                config.beforeResponse(response, false, method)
              } else {
                res.json(response)
              }

              lastResponse = response
            })
            .catch((e: any) => {
              if (config.beforeResponse) {
                config.beforeResponse(e, true, method)
              } else {
                res.status(500)
                res.json(e)
              }

              lastResponse = e
              error = true
            })

          config?.afterResponse(lastResponse, error, method)
        })
      })
    },
  }
}
