export type RouteContext<TEnv = unknown> = {
  req: Request;
  url: URL;
  env: TEnv;
};

export type RouteHandler<TEnv = unknown> = (
  context: RouteContext<TEnv>,
) => Promise<Response | null> | Response | null;

export async function route<TEnv>(
  context: RouteContext<TEnv>,
  handlers: RouteHandler<TEnv>[],
): Promise<Response | null> {
  for (const handler of handlers) {
    const response = await handler(context);
    if (response) return response;
  }
  return null;
}
