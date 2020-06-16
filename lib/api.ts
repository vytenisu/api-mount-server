import express from 'express'
import bodyParser from 'body-parser'
import {Express, Request, Response} from 'express'
import {paramCase} from 'param-case'

/**
 * Default server port
 */
export const DEFAULT_PORT = 3000

/**
 * Default express app name prefix
 * If multiple apps are launched on different ports, by default this prefix will be used
 */
export const DEFAULT_NAME_PREFIX = 'default_'

/**
 * Default express app name
 * In theory there can be multiple but this is rarely needed
 */
export const DEFAULT_NAME = `${DEFAULT_NAME_PREFIX}${DEFAULT_PORT.toString()}`

/**
 * API method
 */
export type IApiMountApiHandler = (...args: any[]) => Promise<any> | any

/**
 * Collection of API methods
 */
export type IApiMountApi = object

/**
 * Hook to inject code before API execution
 * @param method name of called method
 * @param implementation implementation of called method
 * @param context context of this for called method implementation
 * @returns false prevents further default execution of request handler
 */
export type IApiMountBeforeExecution = (
  method: string,
  implementation: IApiMountApiHandler,
  context: IApiMountApi,
  req: Request,
  res: Response,
) => boolean

/**
 * Hook to inject custom server response logic after API execution
 * @param response API method response after execution
 * @param error true if API method exited with an error
 * @param method name of method which has been called
 * @returns false prevents automatic response from request handler
 */
export type IApiMountBeforeResponse = (
  response: any,
  error: boolean,
  method: string,
  req: Request,
  res: Response,
) => boolean

/**
 * Hook to inject logic after server responds
 * @param response API method response after it is sent out
 * @param error true if API method exited with an error
 * @param method name of method which has been called
 */
export type IApiMountAfterResponse = (
  response: any,
  error: boolean,
  method: string,
) => void

/**
 * API Mount Configuration
 */
export interface IApiMountConfig {
  /**
   * Express APP name - only needed in corner case when there are several
   */
  name?: string

  /**
   * Base path for end-points
   */
  basePath?: string

  /**
   * Hook for injecting logic before execution
   */
  beforeExecution?: IApiMountBeforeExecution

  /**
   * Hook for customizing server response logic
   */
  beforeResponse?: IApiMountBeforeResponse

  /**
   * Hook for injecting logic after server responds
   */
  afterResponse?: IApiMountAfterResponse
}

/**
 * Shared API Mount Configuration
 */
export interface ISharedApiMountConfig extends IApiMountConfig {
  /**
   * Server port number
   */
  port?: number
}

/**
 * Method which is responsible for initializing and launching Express server
 */
export type IApiMountLauncher = (config: ISharedApiMountConfig) => Express

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
  [DEFAULT_NAME]: (config: ISharedApiMountConfig) => {
    const newApp = express()
    newApp.use(bodyParser.urlencoded({extended: false}))
    newApp.use(bodyParser.json())
    newApp.listen(config.port)
    return newApp
  },
}

const performLaunch = (config: ISharedApiMountConfig) => {
  if (!launched[config.name]) {
    app[config.name] = launch[config.name]
      ? launch[config.name](config)
      : launch[DEFAULT_NAME](config)
    launched[config.name] = true
  }
}

/**
 * Allows overriding Express server initialization and launch
 * @param injectedLaunch injected launcher method
 * @param name Express app name - only needed if several Express instances are used
 */
export const injectLaunchCode = (
  injectedLaunch: IApiMountLauncher,
  name: string = DEFAULT_NAME,
) => {
  launch[name] = injectedLaunch
}

/**
 * API Mount factory
 * @param sharedConfig default configuration for exposed APIs
 * @returns object which is capable of exposing APIs
 */
export const apiMountFactory = (sharedConfig: ISharedApiMountConfig = {}) => {
  sharedConfig = {
    port: DEFAULT_PORT,
    basePath: '',
    ...sharedConfig,
  }

  if (!sharedConfig.name) {
    sharedConfig.name = DEFAULT_NAME_PREFIX + sharedConfig.port.toString()
  }

  return {
    /**
     * Expose class-based (named) object as an API
     * @param obj object of API methods - has to be based on class
     * @param config API Hook configuration
     */
    exposeClassBasedApi(
      obj: IApiMountApi,
      config: IApiMountConfig = sharedConfig,
    ) {
      config = {
        ...sharedConfig,
        ...config,
      }

      const className = (obj as any).name || obj.constructor.name

      if (className) {
        const namespace = paramCase(className)
        this.exposeApi(obj, {basePath: `${config.basePath}/${namespace}`})
      } else {
        throw new Error(
          'Could not expose object which is not based on a class!',
        )
      }
    },

    /**
     * Expose object as an API
     * @param api object of API methods
     * @param config API Hook configuration
     */
    exposeApi(api: IApiMountApi, config: IApiMountConfig = sharedConfig) {
      config = {
        ...sharedConfig,
        ...config,
      }

      performLaunch(config)

      const {name, basePath} = config

      const entries = []

      // tslint:disable-next-line:forin
      for (const method in api) {
        entries.push([method, (api as any)[method]])
      }

      entries.forEach(([method, implementation]) => {
        app[name].post(`${basePath}/${paramCase(method)}`, (req, res) => {
          if (
            !(
              config.beforeExecution?.(method, implementation, api, req, res) ??
              true
            )
          ) {
            return
          }

          let lastResponse: any
          let error = false

          const callImplementation = async () =>
            await implementation.apply(api, req.body?.args || {args: []})

          const executeAfterResponse = () => {
            config.afterResponse?.(lastResponse, error, method)
          }

          callImplementation()
            .then((response: any) => {
              if (
                config.beforeResponse?.(response, false, method, req, res) ??
                true
              ) {
                res.json(response)
              }

              lastResponse = response
              executeAfterResponse()
            })
            .catch((e: any) => {
              if (config.beforeResponse?.(e, true, method, req, res) ?? true) {
                res.status(500)

                if (e instanceof Error) {
                  res.json({name: e.name, message: e.message, stack: e.stack})
                } else {
                  res.json(e)
                }
              }

              lastResponse = e
              error = true
              executeAfterResponse()
            })
        })
      })
    },
  }
}
