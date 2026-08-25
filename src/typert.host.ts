import { OIL_CREATOR_INVOCATIONS, PACKAGE_NAME } from "./remote-contract.ts";
import { CREATOR_COCKPIT_INVOCATIONS } from "./cockpit/remote-contract.ts";

export const ALL_INVOCATIONS = [...OIL_CREATOR_INVOCATIONS, ...CREATOR_COCKPIT_INVOCATIONS];

export const TYPERT = {
  package: PACKAGE_NAME,
  face: "host" as const,
  schemas: [],
  model: {
    services: [],
    events: [],
    objects: [],
  },
  invocations: ALL_INVOCATIONS,
};
