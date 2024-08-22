import 'server-only'

import {generateText} from 'ai'
import {createAI, createStreamableValue, getMutableAIState, streamUI} from 'ai/rsc'
import {createOpenAI} from '@ai-sdk/openai'

import {BotCard, BotMessage, SpinnerMessage} from '@/components/stocks/message'

import {z} from 'zod'
import {nanoid} from '@/lib/utils'
import {Message} from '@/lib/types'
import {CryptocurrencyChart} from "@/components/tradingview/cryptocurrency-chart";
import {CryptocurrencyComparisonChart} from "@/components/tradingview/cryptocurrency-comparison-chart";
import {CryptocurrencyHeatmap} from "@/components/tradingview/cryptocurrency-heatmap";
import {CryptocurrencyPriceList} from "@/components/tradingview/cryptocurrency-price-list";
import {CryptocurrencyValue} from "@/components/tradingview/cryptocurrency-value";
import {CryptocurrencyDetails} from "@/components/tradingview/cryptocurrency-details";
import {CryptocurrencyDetailsWithExchanges} from "@/components/tradingview/cryptocurrency-details-with-exchanges";

export type AIState = {
    chatId: string
    messages: Message[]
}

export type UIState = {
    id: string
    display: React.ReactNode
}[]

interface MutableAIState {
    update: (newState: any) => void
    done: (newState: any) => void
    get: () => AIState
}

const baseUrl = process.env.LLAMAEDGE_BASE_URL || "https://llamatool.us.gaianet.network/v1"
const apiKey = process.env.LLAMAEDGE_API_KEY || "LLAMAEDGE"
const GROQ_API_KEY_ENV = process.env.GROQ_API_KEY || "LLAMAEDGE"
const TOOL_MODEL = 'llama3-70b-8192'
const modelName = process.env.LLAMAEDGE_MODEL_NAME || "llama"

type ComparisonSymbolObject = {
    symbol: string;
    position: "SameScale";
};

async function generateCaption(
    symbol: string,
    comparisonSymbols: ComparisonSymbolObject[],
    toolName: string,
    aiState: MutableAIState
): Promise<string> {
    // const LlamaEdge = createOpenAI({
    //   baseURL: 'https://api.groq.com/openai/v1',
    //   apiKey: GROQ_API_KEY_ENV
    // });

    // const LlamaEdge = createOpenAI({
    //   baseURL: "https://llama.us.gaianet.network/v1",
    //   apiKey: apiKey
    // });

    const LlamaEdge = createOpenAI({
        baseURL: baseUrl,
        apiKey: apiKey
    });

    const stockString = comparisonSymbols.length === 0
        ? symbol
        : [symbol, ...comparisonSymbols.map(obj => obj.symbol)].join(', ');
    console.log("messages", [...aiState.get().messages])
    aiState.update({
        ...aiState.get(),
        messages: [...aiState.get().messages]
    })

    const captionSystemMessage =
        `\
You are a stock market conversation bot. You can provide the user information about stocks include prices and charts in the UI. You do not have access to any information and should only provide information by calling functions.

These are the tools you have available:
1. showCryptocurrencyChart
This tool shows a cryptocurrency chart for a given coin using its full name.

2. showCryptocurrencyComparisonChart
This tool shows a comparison chart for 2 or more cryptocurrencies using their full names.

3. showCryptocurrencyHeatmap
This tool generates a heatmap of cryptocurrencies. If the user specifies a number, it will show the top N coins by their full names; otherwise, it will default to the top 100.

4. showCryptocurrencyPriceList
This tool generates a price list of cryptocurrencies. If no coins are mentioned, it returns an empty result. If coins are mentioned, it returns the prices for those coins using their full names.

5. getCryptocurrencyValue
This tool retrieves the value of a cryptocurrency. The response will use the cryptocurrency's full name, regardless of the quantity specified.

6. getCryptocurrencyDetails
This tool retrieves detailed information about a cryptocurrency, such as market cap, market cap rank, 24-hour trading volume, and highest/lowest prices. The response will use the cryptocurrency's full name, regardless of the quantity specified.

7. getCryptocurrencyDetailsWithExchanges
This tool retrieves detailed information about a cryptocurrency, such as market cap, market cap rank, 24-hour trading volume, and highest/lowest prices, along with real-time prices from various cryptocurrency exchanges. The response will use the cryptocurrency's full name, regardless of the quantity specified.



You have just called a tool (` +
        toolName +
        ` for ` +
        stockString +
        `) to respond to the user. Now generate text to go alongside that tool response, which may be a graphic like a chart or price history.
  
Example:

User: What is the price of AAPL?
Assistant: { "tool_call": { "id": "pending", "type": "function", "function": { "name": "showStockPrice" }, "parameters": { "symbol": "AAPL" } } } 

Assistant (you): The price of AAPL stock is provided above. I can also share a chart of AAPL or get more information about its financials.

or

Assistant (you): This is the price of AAPL stock. I can also generate a chart or share further financial data.

or 
Assistant (you): Would you like to see a chart of AAPL or get more information about its financials?

Example 2 :

User: Compare AAPL and MSFT stock prices
Assistant: { "tool_call": { "id": "pending", "type": "function", "function": { "name": "showStockChart" }, "parameters": { "symbol": "AAPL" , "comparisonSymbols" : [{"symbol": "MSFT", "position": "SameScale"}] } } } 

Assistant (you): The chart illustrates the recent price movements of Microsoft (MSFT) and Apple (AAPL) stocks. Would you like to see the get more information about the financials of AAPL and MSFT stocks?
or

Assistant (you): This is the chart for AAPL and MSFT stocks. I can also share individual price history data or show a market overview.

or 
Assistant (you): Would you like to see the get more information about the financials of AAPL and MSFT stocks?

## Guidelines
Talk like one of the above responses, but BE CREATIVE and generate a DIVERSE response. 

Your response should be BRIEF, about 2-3 sentences.

Besides the symbol, you cannot customize any of the screeners or graphics. Do not tell the user that you can.
    `

    try {
        const response = await generateText({
            // model: LlamaEdge(TOOL_MODEL),
            model: LlamaEdge(modelName),
            messages: [
                {
                    role: 'system',
                    content: captionSystemMessage
                },
                ...aiState.get().messages.map((message: any) => ({
                    role: message.role,
                    content: message.content,
                    name: message.name
                }))
            ]
        })
        return response.text || ''
    } catch (err) {
        // console.log(err)
        return '' // Send tool use without caption.
    }
}

async function submitUserMessage(content: string) {
    'use server'

    const aiState = getMutableAIState<typeof AI>()

    aiState.update({
        ...aiState.get(),
        messages: [
            ...aiState.get().messages,
            {
                id: nanoid(),
                role: 'user',
                content
            }
        ]
    })

    let textStream: undefined | ReturnType<typeof createStreamableValue<string>>
    let textNode: undefined | React.ReactNode

    try {
        const LlamaEdge = createOpenAI({
            baseURL: baseUrl,
            apiKey: apiKey
        });
        const result = await streamUI({
            model: LlamaEdge(modelName),
            initial: <SpinnerMessage/>,
            maxRetries: 1,
            system: `\
You are a stock market conversation bot. You can provide the user information about stocks include prices and charts in the UI. You do not have access to any information and should only provide information by calling functions.

### Cryptocurrency Tickers
For any cryptocurrency, append "USD" at the end of the ticker when using functions. For instance, "DOGE" should be "DOGEUSD".

### Guidelines:

Never provide empty results to the user. Provide the relevant tool if it matches the user's request. Otherwise, respond as the stock bot.
Example:

User: What is the price of AAPL?
Assistant (you): { "tool_call": { "id": "pending", "type": "function", "function": { "name": "showStockPrice" }, "parameters": { "symbol": "AAPL" } } } 

Example 2:

User: What is the price of AAPL?
Assistant (you): { "tool_call": { "id": "pending", "type": "function", "function": { "name": "showStockPrice" }, "parameters": { "symbol": "AAPL" } } } 
    `,
            messages: [
                ...aiState.get().messages.map((message: any) => ({
                    role: message.role,
                    content: message.content,
                    name: message.name
                }))
            ],
            text: ({content, done, delta}) => {
                if (!textStream) {
                    textStream = createStreamableValue('')
                    textNode = <BotMessage content={textStream.value}/>
                }

                if (done) {
                    textStream.done()
                    aiState.done({
                        ...aiState.get(),
                        messages: [
                            ...aiState.get().messages,
                            {
                                id: nanoid(),
                                role: 'assistant',
                                content
                            }
                        ]
                    })
                } else {
                    textStream.update(delta)
                }
                return textNode
            },
            tools: {
                showCryptocurrencyChart: {
                    description:
                        'Show a cryptocurrency chart of a given coin by its full name. Use this to show the chart to the user.',
                    parameters: z.object({
                        symbol: z
                            .string()
                            .describe(
                                'The name of the cryptocurrency. e.g. bitcoin/ethereum/tether.'
                            )
                    }),

                    generate: async function* ({symbol}) {
                        yield (
                            <BotCard>
                                <></>
                            </BotCard>
                        )

                        const toolCallId = nanoid()

                        aiState.done({
                            ...aiState.get(),
                            messages: [
                                ...aiState.get().messages,
                                {
                                    id: nanoid(),
                                    role: 'assistant',
                                    content: [
                                        {
                                            type: 'tool-call',
                                            toolName: 'showCryptocurrencyChart',
                                            toolCallId,
                                            args: {symbol}
                                        }
                                    ]
                                },
                                {
                                    id: nanoid(),
                                    role: 'tool',
                                    content: [
                                        {
                                            type: 'tool-result',
                                            toolName: 'showCryptocurrencyChart',
                                            toolCallId,
                                            result: {symbol}
                                        }
                                    ]
                                }
                            ]
                        })

                        const caption = await generateCaption(
                            symbol,
                            [],
                            'showCryptocurrencyChart',
                            aiState
                        )
                        console.log("showCryptocurrencyChart-symbol", symbol)

                        return (
                            <BotCard>
                                <CryptocurrencyChart symbol={symbol}/>
                                {caption}
                            </BotCard>
                        )
                    }
                },
                showCryptocurrencyComparisonChart: {
                    description:
                        'Show a comparison chart of 2 or more cryptocurrencies by their full names(like "bitcoin"). Use this to show the chart to the user.',
                    parameters: z.object({
                        symbol: z
                            .string()
                            .describe(
                                'Optional list of full names to compare. e.g. "cardano,solana"'
                            )
                    }),

                    generate: async function* ({symbol}) {
                        yield (
                            <BotCard>
                                <></>
                            </BotCard>
                        )

                        const toolCallId = nanoid()

                        aiState.done({
                            ...aiState.get(),
                            messages: [
                                ...aiState.get().messages,
                                {
                                    id: nanoid(),
                                    role: 'assistant',
                                    content: [
                                        {
                                            type: 'tool-call',
                                            toolName: 'showCryptocurrencyComparisonChart',
                                            toolCallId,
                                            args: {symbol}
                                        }
                                    ]
                                },
                                {
                                    id: nanoid(),
                                    role: 'tool',
                                    content: [
                                        {
                                            type: 'tool-result',
                                            toolName: 'showCryptocurrencyComparisonChart',
                                            toolCallId,
                                            result: {symbol}
                                        }
                                    ]
                                }
                            ]
                        })

                        const caption = await generateCaption(
                            symbol,
                            [],
                            'showCryptocurrencyComparisonChart',
                            aiState
                        )
                        console.log("showCryptocurrencyComparisonChart-symbol", symbol)

                        return (
                            <BotCard>
                                <CryptocurrencyComparisonChart symbol={symbol}/>
                                {caption}
                            </BotCard>
                        )
                    }
                },
                showCryptocurrencyHeatmap: {
                    description:
                        'Generate a cryptocurrency heatmap showing the top coins by their full names. If the user specifies a number, show that many top coins. Otherwise, show the top 100 coins.',
                    parameters: z.object({
                        symbol: z
                            .string()
                            .describe(
                                'The number of top cryptocurrencies to display. If not provided, defaults to "100"'
                            )
                    }),

                    generate: async function* ({symbol}) {
                        yield (
                            <BotCard>
                                <></>
                            </BotCard>
                        )

                        const toolCallId = nanoid()

                        aiState.done({
                            ...aiState.get(),
                            messages: [
                                ...aiState.get().messages,
                                {
                                    id: nanoid(),
                                    role: 'assistant',
                                    content: [
                                        {
                                            type: 'tool-call',
                                            toolName: 'showCryptocurrencyHeatmap',
                                            toolCallId,
                                            args: {symbol}
                                        }
                                    ]
                                },
                                {
                                    id: nanoid(),
                                    role: 'tool',
                                    content: [
                                        {
                                            type: 'tool-result',
                                            toolName: 'showCryptocurrencyHeatmap',
                                            toolCallId,
                                            result: {symbol}
                                        }
                                    ]
                                }
                            ]
                        })

                        const caption = await generateCaption(
                            symbol,
                            [],
                            'showCryptocurrencyHeatmap',
                            aiState
                        )
                        console.log("showCryptocurrencyHeatmap-symbol", symbol)

                        return (
                            <BotCard>
                                <CryptocurrencyHeatmap symbol={symbol}/>
                                {caption}
                            </BotCard>
                        )
                    }
                },
                showCryptocurrencyPriceList: {
                    description:
                        'Generate a list of cryptocurrency prices. If no specific coins are mentioned, return an empty result. If specific coins are mentioned, return their prices using their full names.',
                    parameters: z.object({
                        symbol: z
                            .string()
                            .describe(
                                'The full names of the cryptocurrencies to display prices for. If none are mentioned, the result will be empty.'
                            )
                    }),

                    generate: async function* ({symbol}) {
                        yield (
                            <BotCard>
                                <></>
                            </BotCard>
                        )

                        const toolCallId = nanoid()

                        aiState.done({
                            ...aiState.get(),
                            messages: [
                                ...aiState.get().messages,
                                {
                                    id: nanoid(),
                                    role: 'assistant',
                                    content: [
                                        {
                                            type: 'tool-call',
                                            toolName: 'showCryptocurrencyPriceList',
                                            toolCallId,
                                            args: {symbol}
                                        }
                                    ]
                                },
                                {
                                    id: nanoid(),
                                    role: 'tool',
                                    content: [
                                        {
                                            type: 'tool-result',
                                            toolName: 'showCryptocurrencyPriceList',
                                            toolCallId,
                                            result: {symbol}
                                        }
                                    ]
                                }
                            ]
                        })

                        const caption = await generateCaption(
                            symbol,
                            [],
                            'showCryptocurrencyPriceList',
                            aiState
                        )
                        console.log("showCryptocurrencyPriceList-symbol", symbol)

                        return (
                            <BotCard>
                                <CryptocurrencyPriceList symbol={symbol}/>
                                {caption}
                            </BotCard>
                        )
                    }
                },
                getCryptocurrencyValue: {
                    description:
                        "Get the value of a cryptocurrency, regardless of the quantity specified. Always return the value using the cryptocurrency's full name.",
                    parameters: z.object({
                        symbol: z
                            .string()
                            .describe(
                                'The full name of the cryptocurrency to get the value for.'
                            )
                    }),

                    generate: async function* ({symbol}) {
                        yield (
                            <BotCard>
                                <></>
                            </BotCard>
                        )

                        const toolCallId = nanoid()

                        aiState.done({
                            ...aiState.get(),
                            messages: [
                                ...aiState.get().messages,
                                {
                                    id: nanoid(),
                                    role: 'assistant',
                                    content: [
                                        {
                                            type: 'tool-call',
                                            toolName: 'getCryptocurrencyValue',
                                            toolCallId,
                                            args: {symbol}
                                        }
                                    ]
                                },
                                {
                                    id: nanoid(),
                                    role: 'tool',
                                    content: [
                                        {
                                            type: 'tool-result',
                                            toolName: 'getCryptocurrencyValue',
                                            toolCallId,
                                            result: {symbol}
                                        }
                                    ]
                                }
                            ]
                        })

                        const caption = await generateCaption(
                            symbol,
                            [],
                            'getCryptocurrencyValue',
                            aiState
                        )
                        console.log("getCryptocurrencyValue-symbol", symbol)

                        return (
                            <BotCard>
                                <CryptocurrencyValue symbol={symbol}/>
                                {caption}
                            </BotCard>
                        )
                    }
                },
                getCryptocurrencyDetails: {
                    description:
                        "Get detailed information about a cryptocurrency, including market cap, market cap rank, 24-hour trading volume, and highest/lowest prices. Always return the data using the cryptocurrency's full name, regardless of the quantity specified.",
                    parameters: z.object({
                        symbol: z
                            .string()
                            .describe(
                                'The full name of the cryptocurrency to get detailed data for.'
                            )
                    }),

                    generate: async function* ({symbol}) {
                        yield (
                            <BotCard>
                                <></>
                            </BotCard>
                        )

                        const toolCallId = nanoid()

                        aiState.done({
                            ...aiState.get(),
                            messages: [
                                ...aiState.get().messages,
                                {
                                    id: nanoid(),
                                    role: 'assistant',
                                    content: [
                                        {
                                            type: 'tool-call',
                                            toolName: 'getCryptocurrencyDetails',
                                            toolCallId,
                                            args: {symbol}
                                        }
                                    ]
                                },
                                {
                                    id: nanoid(),
                                    role: 'tool',
                                    content: [
                                        {
                                            type: 'tool-result',
                                            toolName: 'getCryptocurrencyDetails',
                                            toolCallId,
                                            result: {symbol}
                                        }
                                    ]
                                }
                            ]
                        })

                        const caption = await generateCaption(
                            symbol,
                            [],
                            'getCryptocurrencyDetails',
                            aiState
                        )
                        console.log("getCryptocurrencyDetails-symbol", symbol)

                        return (
                            <BotCard>
                                <CryptocurrencyDetails symbol={symbol}/>
                                {caption}
                            </BotCard>
                        )
                    }
                },
                getCryptocurrencyDetailsWithExchanges: {
                    description:
                        "Get detailed information about a cryptocurrency, including market cap, market cap rank, 24-hour trading volume, and highest/lowest prices. Additionally, provide real-time prices from various cryptocurrency exchanges. Always return the data using the cryptocurrency's full name, regardless of the quantity specified.",
                    parameters: z.object({
                        symbol: z
                            .string()
                            .describe(
                                'The full name of the cryptocurrency to get detailed data and exchange prices for.'
                            )
                    }),

                    generate: async function* ({symbol}) {
                        yield (
                            <BotCard>
                                <></>
                            </BotCard>
                        )

                        const toolCallId = nanoid()

                        aiState.done({
                            ...aiState.get(),
                            messages: [
                                ...aiState.get().messages,
                                {
                                    id: nanoid(),
                                    role: 'assistant',
                                    content: [
                                        {
                                            type: 'tool-call',
                                            toolName: 'getCryptocurrencyDetailsWithExchanges',
                                            toolCallId,
                                            args: {symbol}
                                        }
                                    ]
                                },
                                {
                                    id: nanoid(),
                                    role: 'tool',
                                    content: [
                                        {
                                            type: 'tool-result',
                                            toolName: 'getCryptocurrencyDetailsWithExchanges',
                                            toolCallId,
                                            result: {symbol}
                                        }
                                    ]
                                }
                            ]
                        })

                        const caption = await generateCaption(
                            symbol,
                            [],
                            'getCryptocurrencyDetailsWithExchanges',
                            aiState
                        )
                        console.log("getCryptocurrencyDetailsWithExchanges-symbol", symbol)

                        return (
                            <BotCard>
                                <CryptocurrencyDetailsWithExchanges symbol={symbol}/>
                                {caption}
                            </BotCard>
                        )
                    }
                }
            }
        })

        return {
            id: nanoid(),
            display: result.value
        }
    } catch (err: any) {
        console.log(err)
        return {
            id: nanoid(),
            display: (
                <div className="border p-4">
                    <div className="text-red-700 font-medium">Error: {err.message}</div>
                    <a
                        href="https://github.com/bklieger-groq/stockbot-on-groq/issues"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-sm text-red-800 hover:text-red-900"
                    >
                        If you think something has gone wrong, create an
                        <span className="ml-1" style={{textDecoration: 'underline'}}>
              {' '}
                            issue on Github.
            </span>
                    </a>
                </div>
            )
        }
    }
}

export const AI = createAI<AIState, UIState>({
    actions: {
        submitUserMessage
    },
    initialUIState: [],
    initialAIState: {chatId: nanoid(), messages: []}
})
