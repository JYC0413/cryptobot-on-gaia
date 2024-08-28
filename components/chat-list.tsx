import {Separator} from '@/components/ui/separator'
import {UIState} from '@/lib/chat/actions'
import {Session} from '@/lib/types'
import {SpinnerMessage} from "@/components/stocks/message";

export interface ChatList {
    messages: UIState
    session?: Session
    isLoading: boolean
    isShared: boolean
}

export function ChatList({messages, isLoading, session, isShared}: ChatList) {
    if (!messages.length) {
        return null
    }

    return (
        <div className="relative mx-auto max-w-2xl px-4">
            {messages.map((message, index) => (
                <div key={message.id}>
                    {message.display}
                    {index < messages.length - 1 && <Separator className="my-4"/>}
                </div>
            ))}
            {isLoading ? <div><Separator className="my-4"/><SpinnerMessage/></div> : <></>}
        </div>
    )
}
