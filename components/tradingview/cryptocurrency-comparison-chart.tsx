'use client'

import React, { useEffect, useRef, memo } from 'react'


export function CryptocurrencyComparisonChart({ symbol }: { symbol: string }) {
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!container.current) return
    const script = document.createElement('script')
    script.src =
      'https://widgets.coingecko.com/gecko-coin-compare-chart-widget.js'
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
    <div>
      <div
          className="tradingview-widget-container"
          ref={container}
          style={{height: '100%', width: '100%'}}
      >
        {/* @ts-ignore */}
        <gecko-coin-compare-chart-widget locale="en" outlined="true" coin-ids={symbol} initial-currency="usd"></gecko-coin-compare-chart-widget>
        <div className="tradingview-widget-copyright text-right text-gray-400">
          <a
              href="https://www.coingecko.com/"
              rel="noopener nofollow"
              target="_blank"
          >
            <span>Track all markets on CoinGecko</span>
          </a>
        </div>
      </div>
    </div>
  )
}

export default memo(CryptocurrencyComparisonChart)
