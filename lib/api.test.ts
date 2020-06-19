import {apiMountFactory, injectLaunchCode} from './api'
import fetch from 'node-fetch'
import express from 'express'
import bodyParser from 'body-parser'

interface IRequestOptions {
  port?: number
}

const request = async (
  path: string,
  args: any[] = [],
  {port = 3000}: IRequestOptions = {},
) => {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({args}),
  })

  const data = await response.json()
  const status = response.status

  return {data, status}
}

describe('API Hook Server', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  it('is capable of exposing API from an object', async () => {
    const ApiMount = apiMountFactory()

    const api = {
      noArgNoPromise: jest.fn(() => 1),
      noArgPromise: jest.fn(() => Promise.resolve(2)),
      singleArg: jest.fn(arg => arg),
      multipleArgs: jest.fn((...args) => args),
    }

    ApiMount.exposeApi(api)

    const requests = [
      {
        actual: await request('/no-arg-no-promise'),
        expected: {data: 1, status: 200},
      },
      {
        actual: await request('/no-arg-promise'),
        expected: {data: 2, status: 200},
      },
      {
        actual: await request('/single-arg', [123]),
        expected: {data: 123, status: 200},
      },
      {
        actual: await request('/multiple-args', [1, 2, 3]),
        expected: {data: [1, 2, 3], status: 200},
      },
    ]

    requests.forEach(({expected, actual}) => {
      expect(expected.data).toEqual(actual.data)
      expect(expected.status).toBe(actual.status)
    })
  })

  it('does not loose this context when exposing API', async () => {
    const ApiMount = apiMountFactory()

    const api = {
      test() {
        return this.sameObject()
      },
      sameObject() {
        return 123
      },
    }

    ApiMount.exposeApi(api)

    const {data, status} = await request('/test')

    expect(data).toBe(123)
    expect(status).toBe(200)
  })

  it('exposes class-based object API', async () => {
    const ApiMount = apiMountFactory()

    class SomeClass {
      test() {
        return 222
      }
    }

    ApiMount.exposeClassBasedApi(new SomeClass())

    const {data, status} = await request('/some-class/test')

    expect(data).toBe(222)
    expect(status).toBe(200)
  })

  it('exposes static class API', async () => {
    const ApiMount = apiMountFactory()

    // tslint:disable-next-line:max-classes-per-file
    class StaticClass {
      public static test() {
        return 333
      }
    }

    ApiMount.exposeClassBasedApi(StaticClass)

    const {data, status} = await request('/static-class/test')

    expect(data).toBe(333)
    expect(status).toBe(200)
  })

  it('responds with status code 500 and response on error', async () => {
    const ApiMount = apiMountFactory()

    const api = {
      causeError: () => Promise.reject(66),
    }

    ApiMount.exposeApi(api)

    const {data, status} = await request('/cause-error')

    expect(data).toBe(66)
    expect(status).toBe(500)
  })

  it('allows exposing multiple APIs', async () => {
    const ApiMount = apiMountFactory()

    // tslint:disable-next-line:max-classes-per-file
    class StaticA {
      static testA() {
        return 'a'
      }
    }

    // tslint:disable-next-line:max-classes-per-file
    class StaticB {
      static testB() {
        return 'b'
      }
    }

    ApiMount.exposeClassBasedApi(StaticA)
    ApiMount.exposeClassBasedApi(StaticB)

    const requests = [
      {
        actual: await request('/static-a/test-a'),
        expected: {data: 'a', status: 200},
      },
      {
        actual: await request('/static-b/test-b'),
        expected: {data: 'b', status: 200},
      },
    ]

    requests.forEach(({actual, expected}) => {
      expect(actual.data).toBe(expected.data)
      expect(actual.status).toBe(expected.status)
    })
  })

  it('allows creating multiple Express apps', async () => {
    const ApiMount3000 = apiMountFactory({port: 3000})
    const ApiMount3001 = apiMountFactory({port: 3001})

    const api3000 = {
      testPorts() {
        return 3000
      },
    }

    const api3001 = {
      testPorts() {
        return 3001
      },
    }

    ApiMount3000.exposeApi(api3000)
    ApiMount3001.exposeApi(api3001)

    const requests = [
      {
        actual: await request('/test-ports'),
        expected: {data: 3000, status: 200},
      },
      {
        actual: await request('/test-ports', [], {port: 3001}),
        expected: {data: 3001, status: 200},
      },
    ]

    requests.forEach(({actual, expected}) => {
      expect(actual.data).toBe(expected.data)
      expect(actual.status).toBe(expected.status)
    })
  })

  it('allows overriding port', async () => {
    const ApiMount = apiMountFactory({port: 3002})

    const api = {
      testPortChange() {
        return 3002
      },
    }

    ApiMount.exposeApi(api)

    const {data, status} = await request('/test-port-change', [], {port: 3002})

    expect(data).toBe(3002)
    expect(status).toBe(200)
  })

  it('allows adding basePath', async () => {
    const ApiMount = apiMountFactory({basePath: '/base'})

    const api = {
      testBasePath() {
        return 'base'
      },
    }

    ApiMount.exposeApi(api)

    const {data, status} = await request('/base/test-base-path')

    expect(data).toBe('base')
    expect(status).toBe(200)
  })

  it('allows using beforeExecution hook without overriding behavior', async () => {
    let args

    const ApiMount = apiMountFactory({
      beforeExecution: (someMethod, someImplementation, someContext) => {
        args = [someMethod, someImplementation, someContext]
        return true
      },
    })

    const method = 'someMethod'
    const implementation = () => 999
    const context = {} as any
    context[method] = implementation

    ApiMount.exposeApi(context)

    const {data, status} = await request('/some-method')

    expect(data).toBe(999)
    expect(status).toBe(200)
    expect(args).toEqual([method, implementation, context])
  })

  it('allows using beforeExecution hook with overriding behavior', async () => {
    const ApiMount = apiMountFactory({
      beforeExecution: (method, implementation, context, req, res) => {
        res.status(201)
        res.json(req.body?.args?.[0])
        return false
      },
    })

    const api = {
      customEndpoint() {
        return 'wrong'
      },
    }

    ApiMount.exposeApi(api)

    const {data, status} = await request('/custom-endpoint', ['custom'])

    expect(data).toBe('custom')
    expect(status).toBe(201)
  })

  it('allows using beforeResponse hook without overriding behavior', async () => {
    let args

    const ApiMount = apiMountFactory({
      beforeResponse: (response, error, someMethod, req, res) => {
        args = [response, error, someMethod]
        return true
      },
    })

    const method = 'anotherMethod'
    const implementation = () => 888
    const context = {} as any
    context[method] = implementation

    ApiMount.exposeApi(context)

    const {data, status} = await request('/another-method')

    expect(data).toBe(888)
    expect(status).toBe(200)
    expect(args).toEqual([888, false, method])
  })

  it('allows using beforeResponse hook with overriding behavior', async () => {
    const ApiMount = apiMountFactory({
      beforeResponse: (response, error, method, req, res) => {
        res.status(200)
        res.json(response + 1)
        return false
      },
    })

    const api = {
      addOneMagic(n: number) {
        return n
      },
    }

    ApiMount.exposeApi(api)

    const {data, status} = await request('/add-one-magic', [1])

    expect(data).toBe(2)
    expect(status).toBe(200)
  })

  it('provides error to beforeResponse hook', async () => {
    let args

    const ApiMount = apiMountFactory({
      beforeResponse: (response, error, method, req, res) => {
        args = [response, error, method]
        return true
      },
    })

    const api = {
      returnError() {
        return Promise.reject('error')
      },
    }

    ApiMount.exposeApi(api)

    const {data, status} = await request('/return-error')

    expect(data).toEqual('error')
    expect(status).toBe(500)
    expect(args).toEqual(['error', true, 'returnError'])
  })

  it('allows using afterResponse hook', async () => {
    let args

    const ApiMount = apiMountFactory({
      afterResponse: (response, error, method) => {
        args = [response, error, method]
      },
    })

    const api = {
      returnSomething() {
        return 'ok'
      },
    }

    ApiMount.exposeApi(api)
    await request('/return-something')

    expect(args).toEqual(['ok', false, 'returnSomething'])
  })

  it('allows using beforeListen hook', () => {
    let passedApp: any

    const ApiMount = apiMountFactory({
      beforeListen: app => {
        passedApp = app
      },
      port: 3010,
    })

    ApiMount.exposeApi({})
    expect(passedApp?.request).toBeDefined()
    expect(passedApp?.response).toBeDefined()
  })

  it('provides error to afterResponse hook', async () => {
    let args

    const ApiMount = apiMountFactory({
      afterResponse: (response, error, method) => {
        args = [response, error, method]
        return true
      },
    })

    const api = {
      returnSomeProblem() {
        throw new Error('someProblem')
      },
    }

    ApiMount.exposeApi(api)
    await request('/return-some-problem')

    expect(args).toEqual([new Error('someProblem'), true, 'returnSomeProblem'])
  })

  it('allows overriding shared configuration when exposing API', async () => {
    const shared = {
      afterResponse: jest.fn(),
      beforeExecution: jest.fn(() => true),
      beforeResponse: jest.fn(() => true),
    }

    const overridden = {
      afterResponse: jest.fn(),
      beforeExecution: jest.fn(() => true),
      beforeResponse: jest.fn(() => true),
    }

    const ApiMount = apiMountFactory({
      afterResponse: shared.afterResponse,
      basePath: '/shared',
      beforeExecution: shared.beforeExecution,
      beforeResponse: shared.beforeResponse,
      port: 3002,
    })

    const api = {
      testOverride() {
        return 'override'
      },
    }

    ApiMount.exposeApi(api, {
      afterResponse: overridden.afterResponse,
      basePath: '/overridden',
      beforeExecution: overridden.beforeExecution,
      beforeResponse: overridden.beforeResponse,
    })

    await request('/overridden/test-override', [], {port: 3002})

    Object.values(shared).forEach(sharedMethod => {
      expect(sharedMethod).not.toHaveBeenCalled()
    })

    Object.values(overridden).forEach(overriddenMethod => {
      expect(overriddenMethod).toHaveBeenCalledTimes(1)
    })
  })

  it('allows to initialize multiple custom instances', async () => {
    injectLaunchCode(() => {
      const newApp = express()
      newApp.use(bodyParser.urlencoded({extended: false}))
      newApp.use(bodyParser.json())
      newApp.listen(3007)
      return newApp
    }, '3007')

    injectLaunchCode(() => {
      const newApp = express()
      newApp.use(bodyParser.urlencoded({extended: false}))
      newApp.use(bodyParser.json())
      newApp.listen(3008)
      return newApp
    }, '3008')

    const api3007 = {
      test3007() {
        return 3007
      },
    }

    const api3008 = {
      test3008() {
        return 3008
      },
    }

    const ApiMount3007 = apiMountFactory({
      port: 3007,
      name: '3007 bad',
    })

    const ApiMount3008 = apiMountFactory({
      port: 3008,
      name: '3008 bad',
    })

    ApiMount3007.exposeApi(api3007, {name: '3007'})
    ApiMount3008.exposeApi(api3008, {name: '3008'})

    const {data: data3007, status: status3007} = await request(
      '/test3007',
      [],
      {port: 3007},
    )

    const {data: data3008, status: status3008} = await request(
      '/test3008',
      [],
      {port: 3008},
    )

    expect(data3007).toBe(3007)
    expect(status3007).toBe(200)
    expect(data3008).toBe(3008)
    expect(status3008).toBe(200)
  })
})
