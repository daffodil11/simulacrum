import express from "express";
import { merge } from "lodash";
import type { Handler, Request, Document } from "openapi-backend";
import OpenAPIBackend from "openapi-backend";
import type {
  SimulationStore,
  ExtendSimulationActionsInput,
  StoreThunks,
} from "./store";
import { createSimulationStore } from "./store";
import type {
  ExtendSimulationSchemaInput,
  SimulationSlice,
} from "./store/schema";
import type { RecursivePartial } from "./store/types";

export type { Context } from "openapi-backend";
export type { Request, Response } from "express";
export type { AnyState } from "starfx";
export type {
  StoreThunks as SimulationStoreThunks,
  SimulationSlice,
  SimulationStore,
};

export async function createFoundationSimulationServer<
  ExtendedSimulationSchema,
  ExtendedSimulationActions
>({
  port = 9000,
  openapi,
  extendStore,
  extendRouter,
}: {
  port: number;
  openapi?: {
    document: Document | RecursivePartial<Document>[];
    handlers: (
      simulationStore: SimulationStore<
        ExtendedSimulationSchema,
        ExtendedSimulationActions
      >
    ) => Record<string, Handler | Record<string, Handler>>;
    apiRoot?: string;
  };
  extendStore?: {
    schema: ExtendSimulationSchemaInput<ExtendedSimulationSchema>;
    actions: ExtendSimulationActionsInput<ExtendedSimulationActions>;
  };
  extendRouter?(
    router: express.Router,
    simulationStore: SimulationStore<
      ExtendedSimulationSchema,
      ExtendedSimulationActions
    >
  ): void;
}) {
  console.time(`api listening at http://localhost:${port}, started in`);
  let app = express();
  app.use(express.json());
  let simulationStore = createSimulationStore(extendStore);

  if (extendRouter) {
    extendRouter(app, simulationStore);
  }

  if (openapi) {
    let { document, handlers, apiRoot } = openapi;
    let mergedOAS = Array.isArray(document)
      ? mergeDocumentArray(document)
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
    handlerObjectRegistration(handlers(simulationStore));

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

  return {
    listen: async (portOverride?: number) => {
      let listeningPort = portOverride ?? port;
      let server = app.listen(listeningPort, () =>
        console.timeEnd(
          `api listening at http://localhost:${listeningPort}, started in`
        )
      );

      if (!server.listening) {
        await new Promise<void>((resolve) => {
          server.once("listening", resolve);
        });
      }

      return server;
    },
  };
}

const mergeDocumentArray = (
  documents: RecursivePartial<Document>[]
): Document => {
  let [firstDocument, secondDocument, ...remainingDocuments] = documents;
  let document = merge({ ...firstDocument }, { ...secondDocument });
  if (remainingDocuments.length > 0)
    return mergeDocumentArray([document].concat(remainingDocuments));
  return document as Document;
};

export async function startFoundationSimulationServer<
  ExtendedSimulationSchema,
  ExtendedSimulationActions
>(
  arg: Parameters<
    // eslint has a parsing error which means we can't fix this
    //  it is however valid TypeScript
    typeof createFoundationSimulationServer<
      ExtendedSimulationSchema,
      ExtendedSimulationActions
    >
  >[0]
) {
  let simulation = await createFoundationSimulationServer(arg);
  return simulation.listen();
}
