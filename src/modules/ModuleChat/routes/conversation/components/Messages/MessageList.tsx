import { DaySeparator } from "./DaySeparator";
import { EmptyMessages } from "./EmptyMessages";
import { MessageBubble } from "./MessageBubble";
import "./MessageList.css";

type Message = {
  id: string;
  body: string;
  time: string;
  outgoing: boolean;
};

const mockMessages: Message[] = [
  { id: "m1", body: "Fechou, bora alinhar o módulo.", time: "09:12", outgoing: false },
  { id: "m2", body: "Perfeito, já subi a base visual.", time: "09:13", outgoing: true },
  { id: "m3", body: "Top. Agora entra no fluxo de conversa.", time: "09:14", outgoing: false },
  { id: "m4", body: "Já adicionei header e footer.", time: "09:15", outgoing: true },
  { id: "m5", body: "Sem mexer em backend, certo?", time: "09:16", outgoing: false },
  { id: "m6", body: "Sim, só UI e componentização.", time: "09:17", outgoing: true },
  { id: "m7", body: "Nice. Mantém o tema escuro.", time: "09:18", outgoing: false },
  { id: "m8", body: "Mantido: #111 e #020202.", time: "09:19", outgoing: true },
  { id: "m9", body: "Boa. Vamos para os próximos blocos.", time: "09:20", outgoing: false },
  { id: "m10", body: "Partiu.", time: "09:21", outgoing: true },
];

export function MessageList() {
  if (mockMessages.length === 0) {
    return (
      <section className="message-list" data-no-drag="true">
        <EmptyMessages />
      </section>
    );
  }

  return (
    <section className="message-list" data-no-drag="true">
      <DaySeparator label="Hoje" />
      {mockMessages.map((message) => (
        <MessageBubble
          key={message.id}
          body={message.body}
          time={message.time}
          outgoing={message.outgoing}
        />
      ))}
    </section>
  );
}
