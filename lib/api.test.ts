import {apiFactory} from './api'
import fetch from 'node-fetch'

const request = async (path: string, args: any[] = []) =>
  await (
    await fetch(`http://127.0.0.1:3000${path}`, {
      method: 'POST',
      body: JSON.stringify({args}),
    })
  ).json()

describe('API Hook Server', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  it('is capable of exposing API from an object', async () => {
    const ApiMount = apiFactory()

    const api = {
      noArgNoPromise: jest.fn(() => 1),
      noArgPromise: jest.fn(() => Promise.resolve(2)),
      singleArg: jest.fn(arg => {
        console.log('here', arg)
        return arg
      }),
      multipleArgs: jest.fn((...args) => args),
    }

    ApiMount.exposeApi(api)

    const text = await (
      await fetch('http://127.0.0.1:3000/single-arg', {
        method: 'POST',
        body: JSON.stringify({args: [123]}),
      })
    ).text()

    console.log({text})

    expect(await request('/no-arg-no-promise')).toBe(1)
    expect(await request('/no-arg-promise')).toBe(2)
    expect(await request('/single-arg', [123])).toBe(123)
  })

  it('does not loose this context when exposing API', () => {
    // TODO: Not finished
  })

  it('exposes class-based object API', () => {
    // TODO: Not finished
  })

  it('exposes static class API', () => {
    // TODO: Not finished
  })

  it('responds with status code 500 and response on error', () => {
    // TODO: Not finished
  })

  it('allows creating multiple Express apps', () => {
    // TODO: Not finished
  })

  it('allows overriding port', () => {
    // TODO: Not finished
  })

  it('allows adding basePath', () => {
    // TODO: Not finished
  })

  it('allows using beforeExecution hook', () => {
    // TODO: Not finished
  })

  it('allows using beforeResponse hook', () => {
    // TODO: Not finished
  })

  it('allows using afterResponse hook', () => {
    // TODO: Not finished
  })

  it('allows overriding shared configuration when exposing API', () => {
    // TODO: Not finished
  })
})
