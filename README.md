# api-mount-server

_by Vytenis Urbonavičius_

_api-mount-server_ library provides a straightforward way of exposing API from a Node.js server application for consumption on a client side using [api-mount-client](http://npmjs.com/package/api-mount-client) library.

---

## Installation

```
npm install --save api-mount-server
```

## Usage

### Constructing API objects

This library allows exposing API objects. These objects can be constructed in multiple ways.

1. Simple object with methods:

```typescript
const api = {
  foo() {
    return 'foo'
  },
}
```

2. Set of functions collected into an API object:

```typescript
// api.js
export const foo = () => 'foo'
```

```typescript
// mount.js
import * as api from './api'
// ...
```

3. Object created from a class

```typescript
class SomeClass {
  foo() {
    return 'foo'
  }
}

const api = new SomeClass()
```

4. Static class (if supported)

```typescript
class StaticClass {
  static foo() {
    return 'foo'
  }
}
```

There may be more ways but these are just a few examples to showcase the possibilities.

### Writing API methods

API methods are normal methods or functions with one constraint - they can only operate with serializable values (arguments, return value). In this case serializable value is a value which can be converted into _JSON_ using _JSON.stringify()_ method.

In addition to the rule above, API may be asynchronous - it may return a _Promise_ if needed. It can also throw an exception.

Asynchronous API function example:

```typescript
// Using timer to simulate asynchronous behavior
const foo = () => new Promise(resolve => setTimeout(() => resolve('foo'), 1000))
```

Synchronous API function example:

```typescript
const foo = () => 'foo'
```

Please note that even when synchronous API is used, client will see these return values as promises which can be extracted either with _.then_ or with _async_ keyword:

```typescript
// ...

console.log(await API.foo()) // 'foo'

// or

API.foo().then(console.log) // 'foo'

// ...
```

You can find more information about how API can be accessed from client side here: [api-mount-client](http://npmjs.com/package/api-mount-client)

### Exposing API object

```typescript
import {apiMountFactory} from 'api-mount-server'

const api = {
  /* ... API methods ... */
}

const ApiMount = apiMountFactory()
ApiMount.exposeApi(api)
```

When exposing non-class-based objects, one needs to be aware that API will not be namespaced by default. In other words, _foo_ will be accessible via HTTP directly as:

```
  /foo
```

This may cause trouble when exposing multiple APIs - name clashes can cause trouble, also api methods from several API objects may be fused together into a single API object from the perspective of a client.

One possible solution is to provide namespaces manually like this:

```typescript
ApiMount.exposeApi(api, {basePath: '/some-namespace'})
```

There is also an easier way for those who prefer using classes. Namespaces are added automatically when using _exposeClassBasedApi_:

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

If one uses configuration which supports static classes (i.e. TypeScript), following approach can be used:

```typescript
class StaticClass {
  static foo() {
    return 'foo'
  }
}

ApiMount.exposeClassBasedApi(StaticClass)
```

In this case _foo_ will become accessible via HTTP as:

```
/static-class/foo
```

### CORS

One common problem when starting to use _api-mount-server_ is that requests are blocked by browser's CORS policy. Depending on client configuration symptoms may be either completely blocked requests or opaque responses (i.e. missing response information).

There are multiple ways to solve this problem like serving from same domain as client, using proxies, etc. However, one of the quickest solutions/workarounds is using _cors_ npm package when serving API to state that cross-domain requests should be accepted:

```typescript
// ...
const ApiMount = apiMountFactory({
  beforeListen: app => {
    // This is just for testing purposes
    // You would probably want to explicitly list
    // where you expect requests to be coming from
    // for security reasons
    app.use(require('cors')())
  },
})
// ...
```

## Supported Configuration

As one could see in the above examples, it is possible to pass configuration object which alters behavior of _api-mount_. All these methods accept configuration object as (last) argument:

- apiMountFactory
- exposeClassBasedApi
- exposeApi

Configuration object may contain following keys:

- name - express app name - only needed in corner case when there are several express apps initialized manually at the same time (using _injectLaunchCode_).
- basePath - path to be added to HTTP address before automatically generated part. Mostly useful for name-spacing.
- beforeListen - hook for altering Express configuration. It is very useful for things like CORS configuration, etc. This hook will not fire nor it is needed if custom launch code is injected.
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
