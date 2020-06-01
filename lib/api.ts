import express from 'express'
import {Express} from 'express'
import {paramCase} from 'param-case'

/**
 * Default express app name
 * In theory there can be multiple but this is rarely needed
 */
export const DEFAULT_NAME = 'default'

/**
 * Default server port
 */
export const DEFAULT_PORT = 3000

/**
 * API method
 */
export type IApiMountApiHandler = (...args: any[]) => Promise<any> | any

/**
 * Collection of API methods
 */
export interface IApiMountApi {
  [name: string]: IApiMountApiHandler
}

/**
 * Hook to inject code before API execution
 * @param method name of called method
 * @param implementation implementation of called method
 * @param context context of this for called method implementation
 * @returns true if default code needs to be executed afterwards
 */
export type IApiMountBeforeExecution = (
  method: string,
  implementation: IApiMountApiHandler,
  context: IApiMountApi,
) => boolean

/**
 * Hook to inject custom server response logic after API execution
 * @param response API method response after execution
 * @param error true if API method exited with an error
 * @param method name of method which has been called
 */
export type IApiMountBeforeResponse = (
  response: any,
  error: boolean,
  method: string,
) => void

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
 * Main API Mount configuration
 */
export interface IApiMountConfig {
  /**
   * Express APP name - only needed in corner case when there are several
   */
  name?: string

  /**
   * Server port number
   */
  port?: number

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
 * Method which is responsible for initializing and launching Express server
 */
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
    // newApp.configure(() => {
    //   newApp.use(express.json())
    // })
    //
    // const express = require("express");
    // const bodyParser = require("body-parser");
    // const router = express.Router();
    // const app = express();

    // //Here we are configuring express to use body-parser as middle-ware.
    // app.use(bodyParser.urlencoded({ extended: false }));
    // app.use(bodyParser.json());

    // router.post('handle',(request,response) => {
    //     //code to perform particular action.
    //     //To access POST variable use req.body()methods.
    //     console.log(request.body);
    // });

    // // add router in the Express app.
    // app.use("/", router);
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
export const apiFactory = (sharedConfig: IApiMountConfig = {}) => {
  sharedConfig = {
    name: DEFAULT_NAME,
    port: DEFAULT_PORT,
    basePath: '',
    ...sharedConfig,
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

      const className = obj.constructor.name || this.name

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

      Object.entries(api).forEach(([method, implementation]) => {
        app[name].post(`${basePath}/${paramCase(method)}`, (req, res) => {
          if (
            !(config.beforeExecution?.(method, implementation, api) ?? true)
          ) {
            return
          }

          let lastResponse: any
          let error = false

          console.log({method, body: req.body})

          const callImplementation = async () =>
            await implementation.apply(api, req.body?.args || {args: []})

          callImplementation()
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

                if (e instanceof Error) {
                  res.json({name: e.name, message: e.message, stack: e.stack})
                } else {
                  res.json(e)
                }
              }

              lastResponse = e
              error = true
            })

          config.afterResponse?.(lastResponse, error, method)
        })
      })
    },
  }
}
