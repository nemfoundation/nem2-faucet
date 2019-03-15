const express = require('express')
const consola = require('consola')
const bodyParser = require('body-parser')
const { Nuxt, Builder } = require('nuxt')
const app = express()

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

require('dotenv').config({ path: '.env' })

const monitor = require('./monitor')
const bootstrap = require('./bootstrap')
const faucetHandler = require('./handlers/faucet.js')(bootstrap.config)
const claimsHandler = require('./handlers/claims.js')(bootstrap.config)

// Import and Set Nuxt.js options
const config = require('../nuxt.config.js')
config.dev = !(process.env.NODE_ENV === 'production')

async function start() {
  // Init Nuxt.js
  const nuxt = new Nuxt(config)

  const { host, port } = nuxt.options.server

  // Build only in dev mode
  if (config.dev) {
    const builder = new Builder(nuxt)
    await builder.build()
  } else {
    await nuxt.ready()
  }

  app.get('/', faucetHandler)
  app.post('/claims', claimsHandler)

  // Give nuxt middleware to express
  app.use(nuxt.render)

  // Listen the server
  app.listen(port, host)
  consola.ready({
    message: `Server listening on http://${host}:${port}`,
    badge: true
  })

  const { API_URL, FAUCET_ACCOUNT } = bootstrap.config
  monitor(API_URL, FAUCET_ACCOUNT.address)
}
start()
