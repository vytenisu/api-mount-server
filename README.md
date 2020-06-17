# api-mount

_by Vytenis Urbonavičius_

_api-mount-server_ library provides a straightforward way of exposing API from a Node.js server application for consumption on a client side using [api-mount-client](http://npmjs.com/package/api-mount-client) library.

---

## Installation

```
npm install --save api-mount-server
```

## Usage

Exposing API object:

```typescript
import {apiMountFactory} from 'api-mount-server'

const api = {
  // Sync example
  foo() {
    return 'foo'
  },

  // Async example
  bar() {
    return new Promise(resolve => {
      // Timeout is used to simulate async behavior
      setTimeout(() => resolve('bar'), 1000)
    })
  },
}

const ApiMount = apiMountFactory()
ApiMount.exposeApi(api)
```

Different developers prefer different coding styles. If one prefers functional programming style, a set of individual functions can be exposed as API easily in a following way:

```typescript
// api.js

export const foo = () => {
  return 'bar'
}

export const foo2 = () => {
  return 'bar2'
}
```

```typescript
// mount.js
import * as api from './api'
import {apiMountFactory} from 'api-mount-server'

const ApiMount = apiMountFactory()
ApiMount.exposeApi(api)
```

However, when exposing such objects of methods, one needs to be aware that API will not be namespaced by default. In other words, _foo_ and _bar_ methods will be accessible via HTTP directly as:

```
  /foo
```

```
  /bar
```

This may cause trouble when exposing multiple APIs - name clashes can cause trouble. One possible solution is to provide namespaces manually like this:

```typescript
ApiMount.exposeApi(api, {basePath: '/some-namespace'})
```

However, if one prefers using classes, namespaces can be added automatically by using _exposeClassBasedApi_:

```typescript
class SomeClass {
  foo() {
    return 'foo'
  }
}

ApiMount.exposeClassBasedApi(new SomeClass())
```

In this case _foo_ will become available via HTTP as:

```
/some-class/foo
```

If one uses configuration which supports static class methods (i.e. TypeScript), following approach can be used as well:

```typescript
class StaticClass {
  public static foo() {
    return 'foo'
  }
}

ApiMount.exposeClassBasedApi(StaticClass)
```

In this case _foo_ will become accessible via HTTP as:

```
/static-class/test
```

## Supported Configuration

As one could see in the above examples, it is possible to pass configuration object which alters behavior of _api-mount_. All these methods accept configuration object as (last) argument:

- apiMountFactory
- exposeClassBasedApi
- exposeApi

Configuration object may contain following keys:

- name - express app name - only needed in corner case when there are several express apps initialized manually at the same time (using _injectLaunchCode_).
- basePath - path to be added to HTTP address before automatically generated part. Mostly useful for name-spacing.
- beforeExecution - hook for injecting logic before handling api request.
- beforeResponse - hook for customizing server response logic.
- afterResponse - hook for injecting logic after server responds.
- port - server port number - only available when calling _apiMountFactory_.

Should one want to customize how _express_ app is initialized, this is how it can be done:

```typescript
injectLaunchCode(() => {
  const newApp = express()
  newApp.use(bodyParser.urlencoded({extended: false}))
  newApp.use(bodyParser.json())
  newApp.listen(3007)
  return newApp
})
```

Above example would override default _express_ app initialization. However, should one want to have several different ways to initialize it, _injectLaunchCode_ supports a second argument - _name_. It must match _name_ which is provided in configuration object when exposing api or using _apiMountFactory_.

More information can be found in _docs_ directory inside the _api-mount-server_ package. Also, code suggestions should be available provided a compatible IDE is used (such as _VSCode_).

## Protocol

_api-mount-server_ is designed to expose API from a Node.js server. However, one might want to expose API from a different kind of back-end and still be able to consume it via _api-mount-client_. In order to do that one has to follow rules explained below. Note that although rules are customizable, below explanation describes default behavior.

Each API method name should be changed to _param-case_ and exposed as HTTP path.

In case of successful response, HTTP status should be 200.

In case of error response (promise rejection or exception), HTTP status should be 500.

All requests should be of method _POST_.

All arguments for API methods should be provided via body JSON which looks like this:

```json
{
  "args": []
}
```

Argument values should be listed under _args_ in a JSON format.

Response should be returned as a JSON object which either carries method return value or error information. As long as response is a valid JSON, there are no other defined constraints.

## TypeScript

When consuming some API exposed by _api-mount-server_, it would be convenient to have code suggestions (typings) available. This functionality is currently out of scope for _api-mount_ but can be achieved with a reasonably minor effort.

If one is developing using _TypeScript_, it allows generating _.d.ts_ files.

Let's say our API is a class defined inside _api.ts_ file. _TSC_ can generate a corresponding _api.d.ts_ file for it. This file could then be shared with _client_ in some way. For example - one could publish a package containing these generated typings every time server gets published.

When client creates an _api_ object using _api-mount-client_, this object/class could then be matched with a generated _d.ts_.
