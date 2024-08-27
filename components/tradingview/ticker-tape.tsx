'use client'

import * as React from 'react'
import { useRef, useEffect } from 'react'
import Script from 'next/script'

export function TickerTape() {
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!container.current) return

    const script = document.createElement('script')
    script.src =
      'https://widgets.coingecko.com/gecko-coin-price-marquee-widget.js'
    script.async = true

    container.current.appendChild(script)

    return () => {
      if (container.current) {
        const scriptElement = container.current.querySelector('script')
        if (scriptElement) {
          container.current.removeChild(scriptElement)
        }
      }
    }
  }, [])

  return (
      <div
          className="tradingview-widget-container mb-2 md:min-h-20 min-h-28"
          ref={container}
      >
        {/* @ts-ignore */}
        <gecko-coin-price-marquee-widget locale="en" outlined="true" coin-ids="" initial-currency="usd"></gecko-coin-price-marquee-widget>
        <div className="tradingview-widget-copyright flex justify-end mr-2">
          <a
              href="https://www.coingecko.com/"
              rel="noopener nofollow"
              target="_blank"
          >
            <span>Track all markets on CoinGecko</span>
          </a>
        </div>
      </div>
  )
}
