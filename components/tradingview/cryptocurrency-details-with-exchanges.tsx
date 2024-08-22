'use client'

import React, { useEffect, useRef, memo } from 'react'

export function CryptocurrencyDetailsWithExchanges({ symbol }: { symbol: string }) {
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!container.current) return
    const script = document.createElement('script')
    script.src =
      'https://widgets.coingecko.com/gecko-coin-market-ticker-list-widget.js'
    script.type = 'text/javascript'
    script.async = true

    container.current.appendChild(script)

    return () => {
      if (container.current) {
        container.current.removeChild(script)
      }
    }
  }, [])

  return (
    <div style={{ height: '500px' }}>
      <div
          className="tradingview-widget-container"
          ref={container}
          style={{height: '100%', width: '100%'}}
      >
        {/* @ts-ignore */}
        <gecko-coin-market-ticker-list-widget locale="en" outlined="true" coin-id={symbol} initial-currency="usd"></gecko-coin-market-ticker-list-widget>
        <div className="tradingview-widget-copyright">
          <a
              href="https://www.coingecko.com/"
              rel="noopener nofollow"
              target="_blank"
          >
            <span className="">Track all markets on CoinGecko</span>
          </a>
        </div>
      </div>
    </div>
  )
}

export default memo(CryptocurrencyDetailsWithExchanges)
