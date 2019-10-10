const {
  Account,
  NetworkType,
  NetworkCurrencyMosaic,
  MosaicId
} = require('nem2-sdk')

const { MosaicService } = require('./services/mosaic.service')
const { BlockService } = require('./services/block.service')

const init = async () => {
  const API_URL = process.env.NEM_API_URL || 'http://localhost:3000'
  const MOSAIC_HEX = process.env.NEM_MOSAIC_HEX
  const MOSAIC_FQN = process.env.NEM_MOSAIC_FQN
  const MOSAIC_ID = MOSAIC_HEX || MOSAIC_FQN || NetworkCurrencyMosaic.NAMESPACE_ID.fullName
  const OUT_MIN = parseInt(process.env.NEM_OUT_MIN) || 100000000
  const OUT_MAX = parseInt(process.env.NEM_OUT_MAX) || 500000000
  const OUT_OPT = parseInt(process.env.NEM_OUT_OPT) || parseInt(OUT_MAX + OUT_MIN) / 2
  const RECAPTCHA_CLIENT_SECRET = process.env.RECAPTCHA_CLIENT_SECRET || undefined
  const RECAPTCHA_SERVER_SECRET = process.env.RECAPTCHA_SERVER_SECRET || undefined
  const RECAPTCHA_ENABLED = RECAPTCHA_CLIENT_SECRET && RECAPTCHA_SERVER_SECRET

  let generationHash = process.env.NEM_GENERATION_HASH
  if (!/[0-9A-Fa-f]{64}/.test(generationHash)) {
    const blockService = new BlockService(API_URL)
    generationHash = await blockService.getGenerationHash().toPromise()
    console.info(`Get GenerationHash from API Node: "${generationHash}"`)
  }

  let mosaicId = MOSAIC_ID
  if (!/[0-9A-Fa-f]{6}/.test(mosaicId)) {
    const mosaicService = new MosaicService(API_URL)
    mosaicId = await mosaicService
      .getDistributionMosaicId(MOSAIC_ID)
      .toPromise()
    console.info(`Get MosaicID from API Node: "${mosaicId.toHex()}"`)
  } else {
    mosaicId = new MosaicId(mosaicId)
  }

  const config = {
    API_URL,
    PUBLIC_URL: process.env.NEM_PUBLIC_URL || API_URL,
    NETWORK: process.env.NEM_NETWORK,
    GENERATION_HASH: generationHash,
    MOSAIC_FQN,
    MOSAIC_HEX,
    MOSAIC_ID: mosaicId,
    OUT_MIN,
    OUT_MAX,
    OUT_OPT,
    MAX_FEE: parseFloat(process.env.NEM_MAX_FEE) || 500000,
    MAX_DEADLINE: parseInt(process.env.NEM_MAX_DEADLINE) || 5,
    MAX_UNCONFIRMED: parseInt(process.env.NEM_MAX_UNCONFIRMED || '99'),
    MAX_BALANCE: parseInt(process.env.NEM_MAX_BALANCE) || 100000000000,
    WAIT_BLOCK: parseInt(process.env.NEM_WAIT_BLOCK || '0'),
    RECAPTCHA_ENABLED,
    RECAPTCHA_CLIENT_SECRET,
    RECAPTCHA_SERVER_SECRET,
    RECAPTCHA_ENDPOINT: 'https://www.google.com/recaptcha/api/siteverify',
    FAUCET_ACCOUNT: Account.createFromPrivateKey(
      process.env.NEM_PRIVATE_KEY,
      NetworkType[process.env.NEM_NETWORK]
    )
  }

  console.debug({ config })

  return config
}

module.exports = {
  init
}
