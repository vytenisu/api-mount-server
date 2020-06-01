const Api = require('./dist/index').apiFactory()

const api = {
  test: arg => arg,
}

Api.exposeApi(api)
