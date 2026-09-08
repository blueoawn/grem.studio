import {
  createContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  DbConnection,
  type ErrorContext,
  type SubscriptionEventContext,
  type ReducerEventContext,
} from "../module_bindings";

const SPACETIMEDB_URI = import.meta.env.DEV
  ? "ws://localhost:3000"
  : "wss://grem.studio/spacetimedb/";
const MODULE_NAME = "site-feed";
const TOKEN_KEY = "site_feed_db_token";

export let globalErrorHandler: ((message: string) => void) | null = null;
export function setGlobalErrorHandler(handler: (message: string) => void) {
  globalErrorHandler = handler;
}

export interface SpacetimeState {
  connection: DbConnection | null;
  identity: string | null;
  currentAdmin: string | null;
  connected: boolean;
  dataReady: boolean;
  version: number;
}

export const SpacetimeContext = createContext<SpacetimeState>({
  connection: null,
  identity: null,
  currentAdmin: null,
  connected: false,
  dataReady: false,
  version: 0,
});

export function SpacetimeProvider({ children }: { children: ReactNode }) {
  const [connection, setConnection] = useState<DbConnection | null>(null);
  const [identity, setIdentity] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const [version, setVersion] = useState(0);

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY) ?? undefined;

    const subscriptionsApplied = { count: 0 };
    const TOTAL_SUBSCRIPTIONS = 2;

    const onSubscriptionApplied = (_ctx: SubscriptionEventContext) => {
      subscriptionsApplied.count++;
      if (subscriptionsApplied.count >= TOTAL_SUBSCRIPTIONS) {
        setDataReady(true);
      }
      bump();
    };

    DbConnection.builder()
      .withUri(SPACETIMEDB_URI)
      .withModuleName(MODULE_NAME)
      .withToken(token)
      .onConnect(
        (
          conn: DbConnection,
          ident: { toHexString(): string },
          newToken: string
        ) => {
          setConnection(conn);
          setIdentity(ident.toHexString());
          setConnected(true);
          localStorage.setItem(TOKEN_KEY, newToken);

          conn
            .subscriptionBuilder()
            .onApplied(onSubscriptionApplied)
            .subscribe("SELECT * FROM logged_in_admins");
          conn
            .subscriptionBuilder()
            .onApplied(onSubscriptionApplied)
            .subscribe("SELECT * FROM posts");

          conn.db.loggedInAdmins.onInsert(bump);
          conn.db.loggedInAdmins.onDelete(bump);
          conn.db.posts.onInsert(bump);
          conn.db.posts.onUpdate(bump);
          conn.db.posts.onDelete(bump);

          const handleReducerError = (ctx: ReducerEventContext, reducerName: string) => {
            if (ctx.event.status.tag === "Failed") {
              const errorMsg = ctx.event.status.value || `${reducerName} failed`;
              console.error(`${reducerName} error:`, errorMsg);
              if (globalErrorHandler) {
                globalErrorHandler(errorMsg);
              }
            }
          };

          conn.reducers.onLogin((ctx: ReducerEventContext) => handleReducerError(ctx, "login"));
          conn.reducers.onDeletePost((ctx: ReducerEventContext) => handleReducerError(ctx, "deletePost"));
        }
      )
      .onConnectError((_ctx: ErrorContext, err: Error) => {
        console.error("SpacetimeDB connection error:", err);
      })
      .onDisconnect((_ctx: ErrorContext) => {
        setConnected(false);
        setConnection(null);
      })
      .build();
  }, [bump]);

  let currentAdmin: string | null = null;
  if (connection && identity) {
    for (const admin of connection.db.loggedInAdmins.iter()) {
      if ((admin.identity as { toHexString(): string }).toHexString() === identity) {
        currentAdmin = admin.username;
        break;
      }
    }
  }

  return (
    <SpacetimeContext.Provider
      value={{
        connection,
        identity,
        currentAdmin,
        connected,
        dataReady,
        version,
      }}
    >
      {children}
    </SpacetimeContext.Provider>
  );
}
