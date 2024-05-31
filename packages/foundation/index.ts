import express from "express";
import { merge } from "lodash";
import type { Handler, Request, Document } from "openapi-backend";
import OpenAPIBackend from "openapi-backend";
import type { StoreThunks } from "./store";
import { createSimulationStore } from "./store";
import type { SimulationInputSchema } from "./store/schema";
import type { SimulationStore } from "./store/setup";
import type { RecursivePartial, ReturnTypes } from "./store/types";

export type ThunksCreated = ReturnType<StoreThunks["create"]>;

export async function startServerStandalone<
  ExtendedStoreSchema extends SimulationInputSchema,
  ExtendedStoreActions extends (arg: {
    thunks: StoreThunks;
    store: SimulationStore["store"];
    schema: SimulationStore["schema"] &
      ReturnTypes<ReturnType<ExtendedStoreSchema>>;
  }) => { [Key: string]: ThunksCreated },
  SimulationStoreContext extends {
    store: SimulationStore["store"];
    schema: ExtendedStoreSchema;
    actions: ExtendedStoreActions;
  }
>({
  openapi,
  port = 9000,
  extendStore,
  extend,
}: {
  openapi?: {
    document: Document | [Document, RecursivePartial<Document>];
    handlers: ({
      simulationStore,
    }: {
      simulationStore: SimulationStoreContext;
    }) => Record<string, Handler | Record<string, Handler>>;
    apiRoot?: string;
  };
  port: number;
  extendStore?: { schema: ExtendedStoreSchema; actions: ExtendedStoreActions };
  extend?(
    router: express.Router,
    simulationStore: SimulationStoreContext
  ): void;
}) {
  let app = express();
  app.use(express.json());
  let simulationStore = createSimulationStore(extendStore);
  if (extend) {
    extend(app, simulationStore);
  }

  if (openapi) {
    let { document, handlers, apiRoot } = openapi;
    let mergedOAS = Array.isArray(document)
      ? merge(document[0], document[1])
      : document;

    let api = new OpenAPIBackend({ definition: mergedOAS, apiRoot });

    // register your framework specific request handlers here
    let handlerObjectRegistration = (
      handlerEntries: Record<string, Handler | Record<string, Handler>>,
      prefix?: string
    ) => {
      for (let [key, handler] of Object.entries(handlerEntries)) {
        if (typeof handler === "object") {
          handlerObjectRegistration(handler, key);
        } else {
          api.register(`${prefix ? `${prefix}/` : ""}${key}`, handler);
        }
      }
    };
    handlerObjectRegistration(handlers({ simulationStore }));

    api.register({
      validationFail: (c, req, res) =>
        res.status(400).json({ err: c.validation.errors }),
      notFound: (c, req, res) => res.status(404).json({ error: "not found" }),
      notImplemented: (c, req, res) => {
        let { status, mock } = c.api.mockResponseForOperation(
          // the route validates this exists and throws if it does not
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          c.operation.operationId!
        );
        return res.status(status).json(mock);
      },
    });

    // initalize the backend
    api.init();
    app.use((req, res) => api.handleRequest(req as Request, req, res));
  }

  let server = app.listen(port, () =>
    console.info(`api listening at http://localhost:${port}`)
  );

  if (!server.listening) {
    await new Promise<void>((resolve) => {
      server.once("listening", resolve);
    });
  }

  return server;
}
