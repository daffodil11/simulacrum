import { createSchema, slice as immerSlice } from "starfx";

type SimulationSlice = typeof immerSlice;
export type ExtendSimulationSchema = {
  slice: SimulationSlice;
};
export type ExtendSimulationSchemaInput<T> = ({
  slice,
}: ExtendSimulationSchema) => T;

export interface SimulationRoute {
  type: "OpenAPI" | "Explicit";
  url: string;
  method: "get" | "post" | "delete" | "patch";
  calls: number;
  defaultCode: number;
  responses: number[];
}

export function generateSchemaWithInputSlices<ExtendedSimulationSchema>(
  inputSchema: ExtendSimulationSchemaInput<ExtendedSimulationSchema>
) {
  let slices = inputSchema({ slice: immerSlice });

  let schemaAndInitialState = createSchema({
    cache: immerSlice.table({ empty: {} }),
    loaders: immerSlice.loaders(),
    simulationRoutes: immerSlice.table<SimulationRoute>({
      empty: {
        type: "Explicit",
        url: "",
        method: "get",
        calls: 0,
        defaultCode: 200,
        responses: [200],
      },
    }),
    ...slices,
  });

  return schemaAndInitialState;
}
