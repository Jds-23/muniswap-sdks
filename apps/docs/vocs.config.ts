import { defineConfig } from 'vocs'

export default defineConfig({
  rootDir: '.',
  title: 'Uniswap SDK',
  description: 'Documentation for Uniswap SDK Core, V2, V3, and V4',
  topNav: [
    { text: 'SDK Core', link: '/sdk-core' },
    { text: 'V2 SDK', link: '/v2-sdk' },
    { text: 'V3 SDK', link: '/v3-sdk' },
    { text: 'V4 SDK', link: '/v4-sdk' },
    { text: 'Guides', link: '/guides' },
    { text: 'GitHub', link: 'https://github.com/Uniswap/sdks' },
  ],
  sidebar: {
    '/sdk-core': [
      {
        text: 'Getting Started',
        items: [
          { text: 'Overview', link: '/sdk-core' },
          { text: 'Installation', link: '/sdk-core/installation' },
        ],
      },
      {
        text: 'Entities',
        items: [
          { text: 'Token', link: '/sdk-core/token' },
          { text: 'Currency', link: '/sdk-core/currency' },
          { text: 'Ether', link: '/sdk-core/ether' },
          { text: 'NativeCurrency', link: '/sdk-core/native-currency' },
          { text: 'WETH9', link: '/sdk-core/weth9' },
        ],
      },
      {
        text: 'Fractions',
        items: [
          { text: 'Fraction', link: '/sdk-core/fraction' },
          { text: 'CurrencyAmount', link: '/sdk-core/currency-amount' },
          { text: 'Price', link: '/sdk-core/price' },
          { text: 'Percent', link: '/sdk-core/percent' },
        ],
      },
      {
        text: 'Utilities',
        items: [
          { text: 'computePriceImpact', link: '/sdk-core/compute-price-impact' },
          { text: 'validateAndParseAddress', link: '/sdk-core/validate-and-parse-address' },
          { text: 'sqrt', link: '/sdk-core/sqrt' },
          { text: 'sortedInsert', link: '/sdk-core/sorted-insert' },
        ],
      },
      {
        text: 'Configuration',
        items: [
          { text: 'Constants', link: '/sdk-core/constants' },
          { text: 'Chains', link: '/sdk-core/chains' },
          { text: 'Addresses', link: '/sdk-core/addresses' },
        ],
      },
    ],
    '/v2-sdk': [
      {
        text: 'Getting Started',
        items: [
          { text: 'Overview', link: '/v2-sdk' },
          { text: 'Installation', link: '/v2-sdk/installation' },
        ],
      },
      {
        text: 'Entities',
        items: [
          { text: 'Pair', link: '/v2-sdk/pair' },
          { text: 'Route', link: '/v2-sdk/route' },
          { text: 'Trade', link: '/v2-sdk/trade' },
        ],
      },
      {
        text: 'Interfaces',
        items: [
          { text: 'Router', link: '/v2-sdk/router' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'Constants', link: '/v2-sdk/constants' },
          { text: 'Errors', link: '/v2-sdk/errors' },
        ],
      },
    ],
    '/v3-sdk': [
      {
        text: 'Getting Started',
        items: [
          { text: 'Overview', link: '/v3-sdk' },
          { text: 'Installation', link: '/v3-sdk/installation' },
        ],
      },
      {
        text: 'Entities',
        items: [
          { text: 'Pool', link: '/v3-sdk/pool' },
          { text: 'Position', link: '/v3-sdk/position' },
          { text: 'Route', link: '/v3-sdk/route' },
          { text: 'Trade', link: '/v3-sdk/trade' },
          { text: 'Tick', link: '/v3-sdk/tick' },
          { text: 'TickDataProvider', link: '/v3-sdk/tick-data-provider' },
        ],
      },
      {
        text: 'Contracts',
        items: [
          { text: 'SwapRouter', link: '/v3-sdk/swap-router' },
          { text: 'NFTPositionManager', link: '/v3-sdk/nft-position-manager' },
          { text: 'Quoter', link: '/v3-sdk/quoter' },
          { text: 'Staker', link: '/v3-sdk/staker' },
          { text: 'Multicall', link: '/v3-sdk/multicall' },
          { text: 'Payments', link: '/v3-sdk/payments' },
          { text: 'SelfPermit', link: '/v3-sdk/self-permit' },
        ],
      },
      {
        text: 'Utilities',
        items: [
          { text: 'computePoolAddress', link: '/v3-sdk/compute-pool-address' },
          { text: 'encodeSqrtRatioX96', link: '/v3-sdk/encode-sqrt-ratio-x96' },
          { text: 'tickMath', link: '/v3-sdk/tick-math' },
          { text: 'sqrtPriceMath', link: '/v3-sdk/sqrt-price-math' },
          { text: 'maxLiquidityForAmounts', link: '/v3-sdk/max-liquidity-for-amounts' },
          { text: 'priceTickConversions', link: '/v3-sdk/price-tick-conversions' },
          { text: 'encodeRouteToPath', link: '/v3-sdk/encode-route-to-path' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'Constants', link: '/v3-sdk/constants' },
        ],
      },
    ],
    '/v4-sdk': [
      {
        text: 'Getting Started',
        items: [
          { text: 'Overview', link: '/v4-sdk' },
          { text: 'Installation', link: '/v4-sdk/installation' },
        ],
      },
      {
        text: 'Entities',
        items: [
          { text: 'Pool', link: '/v4-sdk/pool' },
          { text: 'Position', link: '/v4-sdk/position' },
          { text: 'Route', link: '/v4-sdk/route' },
          { text: 'Trade', link: '/v4-sdk/trade' },
        ],
      },
      {
        text: 'Hooks',
        items: [
          { text: 'Hook', link: '/v4-sdk/hook' },
          { text: 'Hook Permissions', link: '/v4-sdk/hook-permissions' },
        ],
      },
      {
        text: 'Contracts',
        items: [
          { text: 'PositionManager', link: '/v4-sdk/position-manager' },
          { text: 'Multicall', link: '/v4-sdk/multicall' },
        ],
      },
      {
        text: 'Utilities',
        items: [
          { text: 'V4Planner', link: '/v4-sdk/v4-planner' },
          { text: 'V4PositionPlanner', link: '/v4-sdk/v4-position-planner' },
          { text: 'encodeRouteToPath', link: '/v4-sdk/encode-route-to-path' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'Constants', link: '/v4-sdk/constants' },
        ],
      },
    ],
    '/guides': [
      {
        text: 'Guides',
        items: [
          { text: 'Overview', link: '/guides' },
          { text: 'Building a Uniswap V4 UI', link: '/guides/building-a-uniswap-ui' },
        ],
      },
    ],
  },
})
