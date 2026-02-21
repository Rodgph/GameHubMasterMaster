import { ModuleHeader } from "../components";
import { ChatHomeRoute } from "./ChatHomeRoute";

export function ChatHomeLayout() {
  return (
    <div className="chat-home-layout" data-no-drag="true">
      <ModuleHeader />
      <div className="chat-home-layout-content" data-no-drag="true">
        <ChatHomeRoute />
      </div>
    </div>
  );
}
