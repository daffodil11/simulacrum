import { makeSchema } from 'nexus';
import path from 'path';
import { types } from './types';

export const schema = makeSchema({
  shouldGenerateArtifacts: path.basename(__dirname) !== 'dist',
  types,
  outputs: {
    schema: path.join(__dirname, '../__generated__/schema.graphql'),
    typegen: path.join(__dirname, '../__generated__/schema.types.d.ts'),
  },
  sourceTypes: {
    modules: [
      {
        module: path.join(__dirname, '../interfaces.ts'),
        alias: 'types',
        typeMatch: (type) => new RegExp(`(?:interface)\\s+(${type.name}s)\\W`),
      },
    ]
  },
  contextType: {
    module: path.join(__dirname, 'context.ts'),
    export: 'Context',
  },
});

export default schema;
