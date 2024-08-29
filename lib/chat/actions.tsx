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

const toolBaseUrl = process.env.LLAMAEDGE_TOOL_BASE_URL || "https://llamatool.us.gaianet.network/v1"
const chatBaseUrl = process.env.LLAMAEDGE_CHAT_BASE_URL || "https://llama.us.gaianet.network/v1"
const apiKey = process.env.LLAMAEDGE_API_KEY || "LLAMAEDGE"
const toolModelName = process.env.LLAMAEDGE_TOOL_MODEL_NAME || "llama"
const chatModelName = process.env.LLAMAEDGE_CHAT_MODEL_NAME || "llama"

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

    const LlamaEdge = createOpenAI({
        baseURL: chatBaseUrl,
        apiKey: apiKey
    });

    const stockString = comparisonSymbols.length === 0
        ? symbol
        : [symbol, ...comparisonSymbols.map(obj => obj.symbol)].join(', ');
    aiState.update({
        ...aiState.get(),
        messages: [...aiState.get().messages]
    })

    const captionSystemMessage =
        `\
You are a financial assistant with a focus on cryptocurrencies. You can provide the user with information about cryptocurrencies, including prices and charts, using the tools provided. You primarily rely on the tools to deliver accurate information. However, if a query falls outside the scope of these tools, use your knowledge to assist the user where possible.

These are the tools you have available:
1. showCryptocurrencyChart
This tool shows a chart for a single cryptocurrency using its full name. Use this when only one cryptocurrency is mentioned.

2. showCryptocurrencyComparisonChart
This tool shows a comparison chart for two or more cryptocurrencies using their full names. Use this when the user mentions more than one cryptocurrency.

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

User: What is the price of bitcoin?

Assistant: { "tool_call": { "id": "pending", "type": "function", "function": { "name": "getCryptocurrencyValue" }, "parameters": { "name": "bitcoin" } } }

Assistant (you): The price of bitcoin is provided above. I can also share a chart of bitcoin or get more detailed information about its market data.

or

Assistant (you): This is the price of bitcoin. I can also generate a chart or share further details such as market cap and trading volume.

or 
Assistant (you): Would you like to see a chart of bitcoin or gemore detailed market data?

Example 2 :

User: Compare bitcoin and ethereum prices
Assistant: { "tool_call": { "id": "pending", "type": "function", "function": { "name": "showCryptocurrencyComparisonChart" }, "parameters": { "name": "bitcoin", "comparisonSymbols": [{ "name": "ethereum", "position": "SameScale" }] } } }

Assistant (you): The chart illustrates the recent price movements of bitcoin and ethereum. Would you like to see more detailed market data for bitcoin and ethereum?
or

Assistant (you): This is the chart for bitcoin and ethereum. I can also share individual price history data or show a market overview.

or 
Assistant (you): Would you like to see more detailed market data for bitcoin and ethereum?

## Note
From the above examples, you should be able to understand that your role is just to help summarize, not to answer the questions raised by users. When users ask about the price of Bitcoin, you only need to summarize, not give the exact price.

## Guidelines
Talk like one of the above responses, but BE CREATIVE and generate a DIVERSE response. Return without tool_call option, without current prices

Your response should be BRIEF, about 2-3 sentences.

Besides the symbol, you cannot customize any of the screeners or graphics. Do not tell the user that you can. If a query is not directly related to cryptocurrencies, use your knowledge to assist the user as best as possible.
    `

    try {
        const response = await generateText({
            model: LlamaEdge(chatModelName),
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
        console.log("generateCaptionError", err)
        return '' // Send tool use without caption.
    }
}

async function generateCaptionWithSearch(
    aiState: MutableAIState
): Promise<string> {

    const LlamaEdge = createOpenAI({
        baseURL: chatBaseUrl,
        apiKey: apiKey
    });

    let queryData

    try {
        const searchSystemMessage ="Your task is to identify the most relevant search keyword or short phrase that you would use to find helpful information online to answer the user's question based on the previous conversation. Provide only the keyword or phrase, without any additional context or explanation."
        const searchResponse = await generateText({
            model: LlamaEdge(chatModelName),
            messages: [
                {
                    role: 'system',
                    content: searchSystemMessage
                },
                ...aiState.get().messages.map((message: any) => ({
                    role: message.role,
                    content: message.content,
                    name: message.name
                }))
            ]
        })
        const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(searchResponse.text)}&format=json`);
        queryData = await response.json();
    } catch (err) {
        console.log("search", err)
        return '' // Send tool use without caption.
    }

    if(queryData){
        aiState.update({
            ...aiState.get(),
            messages: [...aiState.get().messages,{
                id: nanoid(),
                role: 'assistant',
                content:JSON.stringify(queryData)
            }]
        })
    }

    const withSearchSystemMessage = "As a cryptocurrency assistant, your primary focus is to provide accurate and insightful information related to cryptocurrency. However, you may also encounter questions that are not directly related to cryptocurrency. When such questions arise, use the information retrieved from the search queries to generate a clear and informative response. Ensure that your answers are relevant, comprehensive, and easy to understand, while still maintaining your role as a cryptocurrency expert."

    try {
        const response = await generateText({
            model: LlamaEdge(chatModelName),
            messages: [
                {
                    role: 'system',
                    content: withSearchSystemMessage
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
        console.log("generateCaptionWithSearchError", err)
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
        // yield {id:nanoid(),display:<div>1231231231313123123</div>};
        const LlamaEdge = createOpenAI({
            baseURL: toolBaseUrl,
            apiKey: apiKey
        });
        const result = await streamUI({
            model: LlamaEdge(toolModelName),
            initial: <SpinnerMessage/>,
            maxRetries: 1,
            system: `\
You are a cryptocurrency market conversation bot. You can provide the user with information about cryptocurrencies, including prices and charts in the UI. Please avoid directly accessing information and instead provide responses primarily by calling functions. If the issue cannot be resolved through function calls, then use your knowledge to answer.

### Guidelines:

Never provide empty results to the user. If a relevant tool matches the user's request, use it. Otherwise, try to respond to the user's question using your knowledge.
Example:

User: What is the price of bitcoin?
Assistant (you): { "tool_call": { "id": "pending", "type": "function", "function": { "name": "getCryptocurrencyValue" }, "parameters": { "name": "bitcoin" } } }

Example 2:

User: What is the price of ethereum?
Assistant (you): { "tool_call": { "id": "pending", "type": "function", "function": { "name": "getCryptocurrencyValue" }, "parameters": { "name": "ethereum" } } }
    `,
            messages: [
                ...aiState.get().messages.map((message: any) => ({
                    role: message.role,
                    content: message.content,
                    name: message.name
                }))
            ],
            text: async ({content, done, delta}) => {
                if (!textStream) {
                    textStream = createStreamableValue('')
                    textNode = <BotMessage content={textStream.value}/>
                }
                try {
                    JSON.parse(content)
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
                } catch (e) {
                    const chatContent = await generateCaptionWithSearch(aiState)
                    textStream.done()
                    aiState.done({
                        ...aiState.get(),
                        messages: [
                            ...aiState.get().messages,
                            {
                                id: nanoid(),
                                role: 'assistant',
                                content: chatContent
                            }
                        ]
                    })
                    return <BotMessage content={chatContent}/>
                }
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
        console.log("toolError", err)
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
