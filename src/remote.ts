import type { TypertRemoteContribution } from "@deepseek-ai/dsh-typert-protocol";

import { OIL_CREATOR_INVOCATIONS, PACKAGE_NAME } from "./remote-contract.ts";

export const TYPERT_REMOTE: TypertRemoteContribution = {
  package: PACKAGE_NAME,
  descriptors: OIL_CREATOR_INVOCATIONS,
};

export default TYPERT_REMOTE;
